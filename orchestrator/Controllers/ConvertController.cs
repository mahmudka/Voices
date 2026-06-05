using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using orchestrator.Data;
using orchestrator.Models;
using orchestrator.Services;

namespace orchestrator.Controllers;

[ApiController]
[Route("api")]
public class ConvertController(
    AppDbContext db,
    IServiceScopeFactory scopeFactory,
    AudioCaptureService capture,
    IConfiguration config) : ControllerBase
{
    // ── Health ────────────────────────────────────────────────────────────────

    [HttpGet("/health")]
    public IActionResult Health() =>
        Ok(new { status = "ok", service = "orchestrator" });

    // ── Generate (text → speech) ─────────────────────────────────────────────

    [HttpPost("generate")]
    public async Task<IActionResult> Generate([FromForm] GenerateRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Text))
            return BadRequest(new { error = "Текст не передан." });

        if (string.IsNullOrWhiteSpace(req.VoiceId))
            return BadRequest(new { error = "voice_id не передан." });

        var sessionId  = Guid.NewGuid().ToString();
        var inputDir   = config["Paths:SharedAudioInput"]!;
        Directory.CreateDirectory(inputDir);

        // Optionally save reference audio to disk
        string? refPath = null;
        if (req.Reference is { Length: > 0 })
        {
            var refFile = $"{sessionId}_ref.wav";
            refPath = Path.Combine(inputDir, refFile);
            await using var fs = System.IO.File.Create(refPath);
            await req.Reference.CopyToAsync(fs);
        }

        var conversion = new Conversion
        {
            SessionId = sessionId,
            InputText = req.Text,
            InputFile = refPath is not null ? Path.GetFileName(refPath) : string.Empty,
            InputPath = refPath ?? string.Empty,
            VoiceId   = req.VoiceId,
            VoiceType = "tts",
            Age       = 0,
            Timbre    = string.Empty,
        };
        db.Conversions.Add(conversion);
        await db.SaveChangesAsync();

        FireAndForget(sessionId, req.Text, req.VoiceId, refPath);

        return Ok(new { sessionId, status = "processing" });
    }

    // ── Record ───────────────────────────────────────────────────────────────

    [HttpPost("record/start")]
    public IActionResult StartRecord()
    {
        if (capture.IsRecording)
            return Conflict(new { error = "Запись уже идёт." });

        var sessionId = Guid.NewGuid().ToString();
        var inputDir  = config["Paths:SharedAudioInput"]!;
        Directory.CreateDirectory(inputDir);

        var inputFile = $"{sessionId}_mic.wav";
        var inputPath = Path.Combine(inputDir, inputFile);

        capture.StartRecording(inputPath, sessionId);
        return Ok(new { sessionId, inputFile });
    }

    [HttpPost("record/stop")]
    public async Task<IActionResult> StopRecord()
    {
        if (!capture.IsRecording)
            return BadRequest(new { error = "Запись не запущена." });

        var sessionId = capture.CurrentSessionId!;
        var refPath   = await capture.StopRecordingAsync();
        var inputFile = Path.GetFileName(refPath);

        return Ok(new { sessionId, inputFile, refPath, status = "ready" });
    }

    [HttpGet("devices")]
    public IActionResult GetDevices()
    {
        var devices = capture.GetInputDevices().Select(d => new { d.Id, d.Name });
        return Ok(devices);
    }

    // ── Voices ───────────────────────────────────────────────────────────────

    [HttpGet("voices")]
    public async Task<IActionResult> GetVoices()
    {
        // Forward to ml-service which returns Edge TTS voice list
        using var http = new HttpClient();
        try
        {
            var resp = await http.GetStringAsync("http://localhost:8001/voices");
            return Content(resp, "application/json");
        }
        catch
        {
            return Ok(Array.Empty<object>());
        }
    }

    // ── History ───────────────────────────────────────────────────────────────

    [HttpGet("history")]
    public async Task<IActionResult> GetHistory()
    {
        var items = await db.Conversions
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new
            {
                c.Id, c.SessionId,
                c.InputText, c.InputFile, c.InputPath,
                c.OutputFile, c.OutputPath,
                c.VoiceId, c.CreatedAt,
            })
            .ToListAsync();
        return Ok(items);
    }

    [HttpDelete("history/{id:int}")]
    public async Task<IActionResult> DeleteOne(int id)
    {
        var c = await db.Conversions.FindAsync(id);
        if (c is null) return NotFound();
        DeleteFiles(c.InputPath, c.OutputPath);
        db.Conversions.Remove(c);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("history")]
    public async Task<IActionResult> DeleteAll()
    {
        var items = await db.Conversions.ToListAsync();
        foreach (var c in items) DeleteFiles(c.InputPath, c.OutputPath);
        db.Conversions.RemoveRange(items);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // ── Audio streaming ───────────────────────────────────────────────────────

    [HttpGet("audio/input/{filename}")]
    public IActionResult ServeInput(string filename) =>
        ServeFile(config["Paths:SharedAudioInput"]!, filename);

    [HttpGet("audio/output/{filename}")]
    public IActionResult ServeOutput(string filename) =>
        ServeFile(config["Paths:SharedAudioOutput"]!, filename);

    // ── Helpers ───────────────────────────────────────────────────────────────

    private IActionResult ServeFile(string dir, string filename)
    {
        var safe = Path.GetFileName(filename);
        var path = Path.Combine(dir, safe);
        if (!System.IO.File.Exists(path)) return NotFound();
        return PhysicalFile(Path.GetFullPath(path), "audio/wav", safe);
    }

    private static void DeleteFiles(params string?[] paths)
    {
        foreach (var p in paths)
            if (!string.IsNullOrEmpty(p) && System.IO.File.Exists(p))
                System.IO.File.Delete(p);
    }

    private void FireAndForget(string sessionId, string text, string voiceId, string? refPath)
    {
        _ = Task.Run(async () =>
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var svc = scope.ServiceProvider.GetRequiredService<ConversionService>();
            await svc.ProcessAsync(sessionId, text, voiceId, refPath);
        });
    }
}

public record GenerateRequest(
    string? Text,
    string? VoiceId,
    IFormFile? Reference);
