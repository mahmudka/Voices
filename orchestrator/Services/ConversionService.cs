using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using orchestrator.Data;
using orchestrator.Hubs;
using orchestrator.Models;

namespace orchestrator.Services;

public class ConversionService(
    AppDbContext db,
    IHubContext<ConvertHub, IConvertClient> hub,
    IHttpClientFactory httpFactory,
    ILogger<ConversionService> logger)
{
    public async Task ProcessAsync(
        string sessionId,
        string text,
        string voiceId,
        string? referenceAudioPath)
    {
        try
        {
            await SendProgress(sessionId, 10, "Синтез речи...");

            var outputWav = await GenerateAsync(text, voiceId, referenceAudioPath);

            await SendProgress(sessionId, 80, "Сохранение...");

            var outputDir  = GetOutputDir();
            var outputFile = $"{sessionId}_output.wav";
            var outputPath = Path.Combine(outputDir, outputFile);
            Directory.CreateDirectory(outputDir);
            await File.WriteAllBytesAsync(outputPath, outputWav);

            await db.Conversions
                .Where(c => c.SessionId == sessionId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(c => c.OutputFile, outputFile)
                    .SetProperty(c => c.OutputPath, outputPath));

            await hub.Clients.Group(sessionId).ConversionCompleted(sessionId, outputFile);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Generation failed for session {SessionId}", sessionId);
            await hub.Clients.Group(sessionId).ConversionFailed(sessionId, ex.Message);
        }
    }

    private async Task<byte[]> GenerateAsync(
        string text, string voiceId, string? referenceAudioPath)
    {
        using var client = httpFactory.CreateClient("MlService");
        using var form   = new MultipartFormDataContent();

        form.Add(new StringContent(text),    "text");
        form.Add(new StringContent(voiceId), "voice_id");

        if (!string.IsNullOrEmpty(referenceAudioPath) && File.Exists(referenceAudioPath))
        {
            var refBytes = await File.ReadAllBytesAsync(referenceAudioPath);
            form.Add(new ByteArrayContent(refBytes), "reference",
                     Path.GetFileName(referenceAudioPath));
        }

        var resp = await client.PostAsync("/generate", form);
        resp.EnsureSuccessStatusCode();
        return await resp.Content.ReadAsByteArrayAsync();
    }

    private Task SendProgress(string sessionId, int percent, string stage)
        => hub.Clients.Group(sessionId).ProgressUpdated(sessionId, percent, stage);

    private static string GetOutputDir()
    {
        // Resolve relative to the shared audio output folder
        var exe  = AppContext.BaseDirectory;
        var root = Path.GetFullPath(Path.Combine(exe, "..", "..", "..", "..", ".."));
        return Path.Combine(root, "shared", "audio", "output");
    }
}
