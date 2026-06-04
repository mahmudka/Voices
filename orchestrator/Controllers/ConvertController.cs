using Microsoft.AspNetCore.Mvc;
using orchestrator.Data;
using orchestrator.Models;
using orchestrator.Services;

namespace orchestrator.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ConvertController(
    AppDbContext db,
    IServiceScopeFactory scopeFactory,
    AudioCaptureService capture,
    IConfiguration config) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Convert([FromForm] ConvertRequest request)
    {
        if (request.File is null || request.File.Length == 0)
            return BadRequest(new { error = "Файл не передан." });

        if (!request.File.FileName.EndsWith(".wav", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "Допустимый формат: WAV." });

        var sessionId = Guid.NewGuid().ToString();
        var inputDir = config["Paths:SharedAudioInput"]!;
        Directory.CreateDirectory(inputDir);

        var inputFile = $"{sessionId}_{Path.GetFileName(request.File.FileName)}";
        var inputPath = Path.Combine(inputDir, inputFile);

        await using (var fs = System.IO.File.Create(inputPath))
            await request.File.CopyToAsync(fs);

        var conversion = new Conversion
        {
            SessionId = sessionId,
            InputFile = inputFile,
            InputPath = inputPath,
            VoiceType = request.VoiceType,
            Age = request.Age,
            Timbre = request.Timbre,
        };
        db.Conversions.Add(conversion);
        await db.SaveChangesAsync();

        _ = Task.Run(async () =>
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var svc = scope.ServiceProvider.GetRequiredService<ConversionService>();
            await svc.ProcessAsync(sessionId, inputPath, request.VoiceType, request.Age, request.Timbre);
        });

        return Ok(new { sessionId, status = "processing" });
    }

    [HttpPost("record/start")]
    public IActionResult StartRecord()
    {
        if (capture.IsRecording)
            return Conflict(new { error = "Запись уже идёт." });

        var sessionId = Guid.NewGuid().ToString();
        var inputDir = config["Paths:SharedAudioInput"]!;
        Directory.CreateDirectory(inputDir);

        var inputFile = $"{sessionId}_mic.wav";
        var inputPath = Path.Combine(inputDir, inputFile);

        capture.StartRecording(inputPath);

        return Ok(new { sessionId, inputFile });
    }

    [HttpPost("record/stop")]
    public async Task<IActionResult> StopRecord([FromBody] RecordStopRequest request)
    {
        if (!capture.IsRecording)
            return BadRequest(new { error = "Запись не запущена." });

        var inputPath = capture.StopRecording();
        var inputFile = Path.GetFileName(inputPath);

        var conversion = new Conversion
        {
            SessionId = request.SessionId,
            InputFile = inputFile,
            InputPath = inputPath,
            VoiceType = request.VoiceType,
            Age = request.Age,
            Timbre = request.Timbre,
        };
        db.Conversions.Add(conversion);
        await db.SaveChangesAsync();

        _ = Task.Run(async () =>
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var svc = scope.ServiceProvider.GetRequiredService<ConversionService>();
            await svc.ProcessAsync(request.SessionId, inputPath, request.VoiceType, request.Age, request.Timbre);
        });

        return Ok(new { sessionId = request.SessionId, status = "processing" });
    }

    [HttpGet("devices")]
    public IActionResult GetDevices()
    {
        var devices = capture.GetInputDevices()
            .Select(d => new { d.Id, d.Name });
        return Ok(devices);
    }
}

public record ConvertRequest(
    IFormFile? File,
    string VoiceType,
    int Age,
    string Timbre);

public record RecordStopRequest(
    string SessionId,
    string VoiceType,
    int Age,
    string Timbre);
