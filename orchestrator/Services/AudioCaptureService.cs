using NAudio.CoreAudioApi;
using NAudio.Wave;
using NAudio.Wave.SampleProviders;

namespace orchestrator.Services;

public class AudioCaptureService : IDisposable
{
    private WasapiCapture? _capture;
    private WaveFileWriter? _writer;
    private string? _currentOutputPath;
    private TaskCompletionSource? _stopTcs;
    private bool _disposed;

    public string? CurrentSessionId { get; private set; }

    public IReadOnlyList<(string Id, string Name)> GetInputDevices()
    {
        using var enumerator = new MMDeviceEnumerator();
        return enumerator
            .EnumerateAudioEndPoints(DataFlow.Capture, DeviceState.Active)
            .Select(d => (d.ID, d.FriendlyName))
            .ToList();
    }

    public void StartRecording(string outputPath, string sessionId)
    {
        if (_capture is not null)
            throw new InvalidOperationException("Recording already in progress.");

        var device = FindDevice("MV7i");

        _capture = device is not null
            ? new WasapiCapture(device)
            : new WasapiCapture();

        _currentOutputPath = outputPath;
        CurrentSessionId = sessionId;
        _writer = new WaveFileWriter(outputPath, _capture.WaveFormat);

        _capture.DataAvailable += OnDataAvailable;
        _capture.RecordingStopped += OnRecordingStopped;
        _capture.StartRecording();
    }

    // Waits until NAudio fully flushes and closes the file before returning.
    public async Task<string> StopRecordingAsync()
    {
        if (_capture is null || _currentOutputPath is null)
            throw new InvalidOperationException("No recording in progress.");

        _stopTcs = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var path = _currentOutputPath;
        CurrentSessionId = null;

        _capture.StopRecording();          // triggers OnRecordingStopped asynchronously
        await _stopTcs.Task;               // wait until file is closed

        // WASAPI Shared Mode gives IEEE_FLOAT 32-bit which Web Audio API (WaveSurfer) can't decode.
        // Convert to PCM 16-bit mono so the browser player can display the waveform.
        ConvertToPcm16InPlace(path);

        return path;
    }

    private static void ConvertToPcm16InPlace(string path)
    {
        using (var probe = new WaveFileReader(path))
        {
            if (probe.WaveFormat.Encoding == WaveFormatEncoding.Pcm &&
                probe.WaveFormat.BitsPerSample == 16)
                return; // already PCM16, nothing to do
        }

        var tempPath = path + ".tmp";
        using (var reader = new WaveFileReader(path))
        {
            ISampleProvider samples = reader.ToSampleProvider();
            if (samples.WaveFormat.Channels > 1)
                samples = new StereoToMonoSampleProvider(samples);

            var pcm16 = new SampleToWaveProvider16(samples);
            WaveFileWriter.CreateWaveFile(tempPath, pcm16);
        }

        File.Move(tempPath, path, overwrite: true);
    }

    public bool IsRecording => _capture is not null;

    private MMDevice? FindDevice(string namePart)
    {
        using var enumerator = new MMDeviceEnumerator();
        return enumerator
            .EnumerateAudioEndPoints(DataFlow.Capture, DeviceState.Active)
            .FirstOrDefault(d => d.FriendlyName.Contains(namePart, StringComparison.OrdinalIgnoreCase));
    }

    private void OnDataAvailable(object? sender, WaveInEventArgs e)
    {
        _writer?.Write(e.Buffer, 0, e.BytesRecorded);
    }

    private void OnRecordingStopped(object? sender, StoppedEventArgs e)
    {
        _writer?.Flush();
        _writer?.Dispose();
        _writer = null;

        _capture?.Dispose();
        _capture = null;

        _stopTcs?.TrySetResult();
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        if (_capture?.CaptureState == CaptureState.Capturing)
            _capture.StopRecording();

        _writer?.Dispose();
        _capture?.Dispose();
    }
}
