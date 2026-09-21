$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root "dist"
$public = Join-Path $dist "public"

if (Test-Path -LiteralPath $dist) {
  try {
    Remove-Item -LiteralPath $dist -Recurse -Force -ErrorAction SilentlyContinue
  } catch {}
}

New-Item -ItemType Directory -Force -Path $public | Out-Null
Get-ChildItem -Path $root -Filter "*.html" | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $public $_.Name) -Force
}

$imagesSource = Join-Path $root "Images"
if (Test-Path -LiteralPath $imagesSource) {
  Copy-Item -LiteralPath $imagesSource -Destination (Join-Path $public "Images") -Recurse
}

$manifestSource = Join-Path $root "manifest.json"
if (Test-Path -LiteralPath $manifestSource) {
  Copy-Item -LiteralPath $manifestSource -Destination (Join-Path $public "manifest.json") -Force
}

Write-Host "Built Cloudflare Workers assets to dist/public"
