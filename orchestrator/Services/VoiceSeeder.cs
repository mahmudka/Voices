namespace orchestrator.Services;

// VoicePresets DB table kept for history compatibility.
// Voice list is now served dynamically from ml-service (Edge TTS).
public class VoiceSeeder
{
    public Task SeedAsync() => Task.CompletedTask;
}
