using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using orchestrator.Data;
using orchestrator.Models;

namespace orchestrator.Services;

public class VoiceSeeder(AppDbContext db, IConfiguration config, ILogger<VoiceSeeder> logger)
{
    public async Task SeedAsync()
    {
        var modelsPath = config["Paths:SharedModels"]!;
        var voicesFile = Path.Combine(modelsPath, "voices.json");

        if (!File.Exists(voicesFile))
        {
            logger.LogWarning("voices.json not found at {Path}", voicesFile);
            return;
        }

        var json = await File.ReadAllTextAsync(voicesFile);
        var catalog = JsonSerializer.Deserialize<VoiceCatalog>(json,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        if (catalog?.Voices is null) return;

        foreach (var v in catalog.Voices)
        {
            var exists = await db.VoicePresets.AnyAsync(p => p.VoiceId == v.VoiceId);
            if (!exists)
            {
                db.VoicePresets.Add(new VoicePreset
                {
                    VoiceId       = v.VoiceId,
                    Name          = v.Name,
                    Gender        = v.Gender,
                    Description   = v.Description,
                    Icon          = v.Icon,
                    ModelFile     = v.ModelFile,
                    DefaultAge    = v.DefaultAge,
                    DefaultTimbre = v.DefaultTimbre,
                    AgeMin        = v.AgeMin,
                    AgeMax        = v.AgeMax,
                });
            }
        }

        await db.SaveChangesAsync();
        logger.LogInformation("Voice library seeded: {Count} voices", catalog.Voices.Count);
    }
}

public record VoiceCatalog(List<VoiceCatalogEntry> Voices);

public record VoiceCatalogEntry(
    string VoiceId,
    string Name,
    string Gender,
    string Description,
    string Icon,
    string ModelFile,
    int DefaultAge,
    string DefaultTimbre,
    int AgeMin,
    int AgeMax);
