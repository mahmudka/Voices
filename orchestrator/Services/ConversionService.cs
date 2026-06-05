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
    IConfiguration config,
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
            await hub.Clients.All.ProgressUpdated(sessionId, 10, "Синтез речи...");

            var outputWav = await GenerateAsync(text, voiceId, referenceAudioPath);

            await hub.Clients.All.ProgressUpdated(sessionId, 80, "Сохранение...");

            var outputDir  = config["Paths:SharedAudioOutput"]!;
            Directory.CreateDirectory(outputDir);
            var outputFile = $"{sessionId}_output.wav";
            var outputPath = Path.Combine(outputDir, outputFile);
            await File.WriteAllBytesAsync(outputPath, outputWav);

            await db.Conversions
                .Where(c => c.SessionId == sessionId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(c => c.OutputFile, outputFile)
                    .SetProperty(c => c.OutputPath, outputPath));

            await hub.Clients.All.ConversionCompleted(sessionId, outputFile);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Generation failed for session {SessionId}", sessionId);
            await hub.Clients.All.ConversionFailed(sessionId, ex.Message);
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
}
