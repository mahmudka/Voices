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

    // ── Convert ──────────────────────────────────────────────────────────────

    [HttpPost("convert")]
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
            VoiceId = request.VoiceId,
            VoiceType = request.VoiceType,
            Age = request.Age,
            Timbre = request.Timbre,
        };
        db.Conversions.Add(conversion);
        await db.SaveChangesAsync();

        FireAndForget(sessionId, inputPath, request.VoiceId, request.VoiceType, request.Age, request.Timbre);

        return Ok(new { sessionId, status = "processing" });
    }

    [HttpPost("convert/rerender")]
    public async Task<IActionResult> Rerender([FromBody] RerenderRequest request)
    {
        var existing = await db.Conversions
            .Where(c => c.SessionId == request.SessionId)
            .OrderByDescending(c => c.CreatedAt)
            .FirstOrDefaultAsync();

        if (existing is null)
            return NotFound(new { error = "Сессия не найдена." });

        if (!System.IO.File.Exists(existing.InputPath))
            return UnprocessableEntity(new { error = "Исходный файл удалён." });

        var conversion = new Conversion
        {
            SessionId = request.SessionId,
            InputFile = existing.InputFile,
            InputPath = existing.InputPath,
            VoiceId = request.VoiceId,
            VoiceType = request.VoiceType,
            Age = request.Age,
            Timbre = request.Timbre,
        };
        db.Conversions.Add(conversion);
        await db.SaveChangesAsync();

        FireAndForget(request.SessionId, existing.InputPath, request.VoiceId, request.VoiceType, request.Age, request.Timbre);

        return Ok(new { sessionId = request.SessionId, status = "processing" });
    }

    // ── Record ───────────────────────────────────────────────────────────────

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

        capture.StartRecording(inputPath, sessionId);

        return Ok(new { sessionId, inputFile });
    }

    [HttpPost("record/stop")]
    public async Task<IActionResult> StopRecord([FromBody] RecordStopRequest request)
    {
        if (!capture.IsRecording)
            return BadRequest(new { error = "Запись не запущена." });

        var sessionId = capture.CurrentSessionId!;
        var inputPath = capture.StopRecording();
        var inputFile = Path.GetFileName(inputPath);

        var conversion = new Conversion
        {
            SessionId = sessionId,
            InputFile = inputFile,
            InputPath = inputPath,
            VoiceId = request.VoiceId,
            VoiceType = request.VoiceType,
            Age = request.Age,
            Timbre = request.Timbre,
        };
        db.Conversions.Add(conversion);
        await db.SaveChangesAsync();

        FireAndForget(sessionId, inputPath, request.VoiceId, request.VoiceType, request.Age, request.Timbre);

        return Ok(new { sessionId, inputFile, status = "processing" });
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
        var voices = await db.VoicePresets
            .OrderBy(v => v.Gender)
            .ThenBy(v => v.Name)
            .Select(v => new
            {
                v.VoiceId, v.Name, v.Gender, v.Description, v.Icon,
                v.DefaultAge, v.DefaultTimbre, v.AgeMin, v.AgeMax,
            })
            .ToListAsync();
        return Ok(voices);
    }

    // ── History ───────────────────────────────────────────────────────────────

    [HttpGet("history")]
    public async Task<IActionResult> GetHistory()
    {
        var items = await db.Conversions
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new
            {
                c.Id, c.SessionId, c.InputFile, c.InputPath,
                c.OutputFile, c.OutputPath,
                c.VoiceType, c.Age, c.Timbre, c.CreatedAt,
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

    [HttpDelete("history/session/{sessionId}")]
    public async Task<IActionResult> DeleteSession(string sessionId)
    {
        var items = await db.Conversions.Where(c => c.SessionId == sessionId).ToListAsync();
        foreach (var c in items) DeleteFiles(c.InputPath, c.OutputPath);
        db.Conversions.RemoveRange(items);
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
    public IActionResult ServeInput(string filename)
    {
        var dir = config["Paths:SharedAudioInput"]!;
        return ServeFile(dir, filename);
    }

    [HttpGet("audio/output/{filename}")]
    public IActionResult ServeOutput(string filename)
    {
        var dir = config["Paths:SharedAudioOutput"]!;
        return ServeFile(dir, filename);
    }

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
        {
            if (!string.IsNullOrEmpty(p) && System.IO.File.Exists(p))
                System.IO.File.Delete(p);
        }
    }

    private void FireAndForget(string sessionId, string inputPath, string? voiceId, string voiceType, int age, string timbre)
    {
        _ = Task.Run(async () =>
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var svc = scope.ServiceProvider.GetRequiredService<ConversionService>();
            await svc.ProcessAsync(sessionId, inputPath, voiceId, voiceType, age, timbre);
        });
    }
}

public record ConvertRequest(IFormFile? File, string? VoiceId, string VoiceType, int Age, string Timbre);
public record RerenderRequest(string SessionId, string? VoiceId, string VoiceType, int Age, string Timbre);
public record RecordStopRequest(string? VoiceId, string VoiceType, int Age, string Timbre);
