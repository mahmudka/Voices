using Microsoft.EntityFrameworkCore;
using orchestrator.Models;

namespace orchestrator.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Conversion> Conversions => Set<Conversion>();
    public DbSet<VoicePreset> VoicePresets => Set<VoicePreset>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Conversion>(e =>
        {
            e.HasIndex(c => c.SessionId);
            e.Property(c => c.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
        });
    }
}
