using Microsoft.EntityFrameworkCore;
using orchestrator.Data;
using orchestrator.Hubs;
using orchestrator.Services;

var builder = WebApplication.CreateBuilder(args);

// Resolve relative config paths against the project root (ContentRootPath).
{
    var root = builder.Environment.ContentRootPath;
    string[] pathKeys = ["Paths:SharedAudioInput", "Paths:SharedAudioOutput", "Paths:SharedModels"];
    foreach (var key in pathKeys)
    {
        var val = builder.Configuration[key];
        if (val is not null && !Path.IsPathRooted(val))
            builder.Configuration[key] = Path.GetFullPath(Path.Combine(root, val));
    }
}

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddSignalR();

builder.Services.AddHttpClient("MlService", c =>
    c.BaseAddress = new Uri(builder.Configuration["Services:MlServiceUrl"]!));

builder.Services.AddHttpClient("WorldService", c =>
    c.BaseAddress = new Uri(builder.Configuration["Services:WorldServiceUrl"]!));

builder.Services.AddScoped<ConversionService>();
builder.Services.AddScoped<VoiceSeeder>();
builder.Services.AddSingleton<AudioCaptureService>();

builder.Services.AddControllersWithViews();
builder.Services.AddControllers();

builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins("http://localhost:5173")
     .AllowAnyHeader()
     .AllowAnyMethod()
     .AllowCredentials()));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();

    var seeder = scope.ServiceProvider.GetRequiredService<VoiceSeeder>();
    await seeder.SeedAsync();
}

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
    app.UseHttpsRedirection();
}
app.UseStaticFiles();
app.UseRouting();
app.UseCors();
app.UseAuthorization();

app.MapHub<ConvertHub>("/convertHub");
app.MapControllers();
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
