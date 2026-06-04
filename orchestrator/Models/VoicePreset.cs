using System.ComponentModel.DataAnnotations;

namespace orchestrator.Models;

public class VoicePreset
{
    public int Id { get; set; }

    [Required, MaxLength(50)]
    public string VoiceId { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required, MaxLength(20)]
    public string Gender { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Description { get; set; } = string.Empty;

    [MaxLength(10)]
    public string Icon { get; set; } = string.Empty;

    [MaxLength(100)]
    public string ModelFile { get; set; } = string.Empty;

    public int DefaultAge { get; set; }

    [Required, MaxLength(20)]
    public string DefaultTimbre { get; set; } = string.Empty;

    public int AgeMin { get; set; }
    public int AgeMax { get; set; }
}
