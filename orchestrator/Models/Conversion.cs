using System.ComponentModel.DataAnnotations;

namespace orchestrator.Models;

public class Conversion
{
    public int Id { get; set; }

    [Required, MaxLength(36)]
    public string SessionId { get; set; } = string.Empty;

    [Required, MaxLength(255)]
    public string InputFile { get; set; } = string.Empty;

    [Required, MaxLength(500)]
    public string InputPath { get; set; } = string.Empty;

    [MaxLength(255)]
    public string? OutputFile { get; set; }

    [MaxLength(500)]
    public string? OutputPath { get; set; }

    [Required, MaxLength(20)]
    public string VoiceType { get; set; } = string.Empty;

    public int Age { get; set; }

    [Required, MaxLength(20)]
    public string Timbre { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
