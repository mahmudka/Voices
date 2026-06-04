using NAudio.CoreAudioApi;
using NAudio.Wave;

namespace orchestrator.Services;

public class AudioCaptureService : IDisposable
{
    private WasapiCapture? _capture;
    private WaveFileWriter? _writer;
    private string? _currentOutputPath;
    private bool _disposed;

    public IReadOnlyList<(string Id, string Name)> GetInputDevices()
    {
        using var enumerator = new MMDeviceEnumerator();
        return enumerator
            .EnumerateAudioEndPoints(DataFlow.Capture, DeviceState.Active)
            .Select(d => (d.ID, d.FriendlyName))
            .ToList();
    }

    public void StartRecording(string outputPath)
    {
        if (_capture is not null)
            throw new InvalidOperationException("Recording already in progress.");

        var device = FindDevice("MV7i");

        _capture = device is not null
            ? new WasapiCapture(device)
            : new WasapiCapture();

        _currentOutputPath = outputPath;
        _writer = new WaveFileWriter(outputPath, _capture.WaveFormat);

        _capture.DataAvailable += OnDataAvailable;
        _capture.RecordingStopped += OnRecordingStopped;
        _capture.StartRecording();
    }

    public string StopRecording()
    {
        if (_capture is null || _currentOutputPath is null)
            throw new InvalidOperationException("No recording in progress.");

        _capture.StopRecording();

        return _currentOutputPath;
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
