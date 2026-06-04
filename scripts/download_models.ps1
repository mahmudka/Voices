#Requires -Version 5.1

# Voice Converter — Model Download Helper
# Run this script to set up voice models for the RVC pipeline.
#
# Required files in shared\models\:
#   content-vec-best.onnx   — HuBERT/ContentVec encoder (universal, ~190 MB)
#   male_neutral.onnx       — RVC v2 decoder for each voice preset
#   male_deep.onnx
#   male_elder.onnx
#   female_neutral.onnx
#   female_soft.onnx
#   child.onnx

$ROOT       = Split-Path $PSScriptRoot -Parent
$MODELS_DIR = "$ROOT\shared\models"

function Write-Info  { param($m) Write-Host "  $m" -ForegroundColor Cyan }
function Write-Ok    { param($m) Write-Host "  OK  $m" -ForegroundColor Green }
function Write-Warn  { param($m) Write-Host "  !!  $m" -ForegroundColor Yellow }

Write-Host ""
Write-Host "  Voice Converter — Model Setup" -ForegroundColor White
Write-Host "  ==============================" -ForegroundColor White
Write-Host ""

# --- Check current state ---

$files = @(
    @{ name = "content-vec-best.onnx"; desc = "HuBERT encoder (required for RVC)"; required = $true },
    @{ name = "male_neutral.onnx";    desc = "Нейтральный мужской";   required = $false },
    @{ name = "male_deep.onnx";       desc = "Глубокий мужской";      required = $false },
    @{ name = "male_elder.onnx";      desc = "Пожилой мужской";       required = $false },
    @{ name = "female_neutral.onnx";  desc = "Нейтральный женский";   required = $false },
    @{ name = "female_soft.onnx";     desc = "Мягкий женский";        required = $false },
    @{ name = "child.onnx";           desc = "Детский";               required = $false }
)

Write-Host "  Status of model files in: $MODELS_DIR" -ForegroundColor White
Write-Host ""
foreach ($f in $files) {
    $path = "$MODELS_DIR\$($f.name)"
    if (Test-Path $path) {
        $size = [math]::Round((Get-Item $path).Length / 1MB, 1)
        Write-Ok "$($f.name) ($($size) MB) — $($f.desc)"
    } else {
        Write-Warn "MISSING  $($f.name) — $($f.desc)"
    }
}

Write-Host ""
Write-Host "  How to get models:" -ForegroundColor White
Write-Host ""
Write-Info "1. content-vec-best.onnx (HuBERT/ContentVec encoder):"
Write-Info "   Search HuggingFace for: 'content-vec-best onnx'"
Write-Info "   Repository: RVC-Boss/ContentVec or lj1995/VoiceConversionWebUI"
Write-Info "   File: pretrained_v2/vec-768-layer-12.onnx (same model, different name)"
Write-Host ""
Write-Info "2. Voice model files (RVC v2 ONNX decoders):"
Write-Info "   Use Applio (https://github.com/IAHispano/Applio) to export .pth -> .onnx"
Write-Info "   Or search HuggingFace for: 'rvc onnx' with appropriate license"
Write-Info "   Place the .onnx file in shared\models\ with the name from voices.json"
Write-Host ""
Write-Info "3. Rename downloaded files to match voices.json:"
foreach ($f in $files | Where-Object { -not $_.required }) {
    Write-Info "   $($f.name)  ($($f.desc))"
}
Write-Host ""
Write-Host "  Without model files, the app still works using WORLD vocoder" -ForegroundColor Yellow
Write-Host "  (pitch+formant transformation — no RVC neural conversion)." -ForegroundColor Yellow
Write-Host ""
