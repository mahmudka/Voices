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
        string sessionId, string inputPath,
        string voiceType, int age, string timbre)
    {
        try
        {
            await SendProgress(sessionId, 10, "Анализ F0...");

            var f0Result = await AnalyzeAsync(inputPath);

            await SendProgress(sessionId, 40, "Конвертация тембра...");

            var convertedPath = await ConvertTimbreAsync(inputPath, f0Result, voiceType, age, timbre);

            await SendProgress(sessionId, 70, "Синтез...");

            var outputPath = await SynthesizeAsync(convertedPath, voiceType, age, timbre);

            await SendProgress(sessionId, 95, "Сохранение...");

            var outputFile = Path.GetFileName(outputPath);
            await db.Conversions
                .Where(c => c.SessionId == sessionId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(c => c.OutputFile, outputFile)
                    .SetProperty(c => c.OutputPath, outputPath));

            await hub.Clients.Group(sessionId).ConversionCompleted(sessionId, outputFile);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Conversion failed for session {SessionId}", sessionId);
            await hub.Clients.Group(sessionId).ConversionFailed(sessionId, ex.Message);
        }
    }

    private async Task<string> AnalyzeAsync(string inputPath)
    {
        using var client = httpFactory.CreateClient("MlService");
        using var content = BuildFileContent(inputPath);

        var response = await client.PostAsync("/analyze", content);
        response.EnsureSuccessStatusCode();

        return await response.Content.ReadAsStringAsync();
    }

    private async Task<string> ConvertTimbreAsync(
        string inputPath, string f0Json, string voiceType, int age, string timbre)
    {
        using var client = httpFactory.CreateClient("MlService");
        using var form = new MultipartFormDataContent();

        form.Add(new StreamContent(File.OpenRead(inputPath)), "file", Path.GetFileName(inputPath));
        form.Add(new StringContent(f0Json), "f0");
        form.Add(new StringContent(voiceType), "voice_type");
        form.Add(new StringContent(age.ToString()), "age");
        form.Add(new StringContent(timbre), "timbre");

        var response = await client.PostAsync("/convert", form);
        response.EnsureSuccessStatusCode();

        var outputPath = Path.ChangeExtension(inputPath, null) + "_converted.wav";
        await using var fs = File.Create(outputPath);
        await response.Content.CopyToAsync(fs);

        return outputPath;
    }

    private async Task<string> SynthesizeAsync(
        string inputPath, string voiceType, int age, string timbre)
    {
        using var client = httpFactory.CreateClient("WorldService");
        using var form = new MultipartFormDataContent();

        form.Add(new StreamContent(File.OpenRead(inputPath)), "file", Path.GetFileName(inputPath));
        form.Add(new StringContent(voiceType), "voice_type");
        form.Add(new StringContent(age.ToString()), "age");
        form.Add(new StringContent(timbre), "timbre");

        var response = await client.PostAsync("/synthesize", form);
        response.EnsureSuccessStatusCode();

        var outputDir = Path.GetDirectoryName(inputPath)!
            .Replace("input", "output", StringComparison.OrdinalIgnoreCase);
        Directory.CreateDirectory(outputDir);

        var outputPath = Path.Combine(outputDir, Path.GetFileName(inputPath));
        await using var fs = File.Create(outputPath);
        await response.Content.CopyToAsync(fs);

        return outputPath;
    }

    private Task SendProgress(string sessionId, int percent, string stage)
        => hub.Clients.Group(sessionId).ProgressUpdated(sessionId, percent, stage);

    private static MultipartFormDataContent BuildFileContent(string path)
    {
        var form = new MultipartFormDataContent();
        form.Add(new StreamContent(File.OpenRead(path)), "file", Path.GetFileName(path));
        return form;
    }
}
