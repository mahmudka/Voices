using System.ComponentModel.DataAnnotations;

namespace orchestrator.Models;

public class VoicePreset
{
    public int Id { get; set; }

    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required, MaxLength(20)]
    public string VoiceType { get; set; } = string.Empty;

    public int Age { get; set; }

    [Required, MaxLength(20)]
    public string Timbre { get; set; } = string.Empty;
}
