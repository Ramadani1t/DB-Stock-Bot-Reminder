$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root "dist"
$public = Join-Path $dist "public"

if (Test-Path -LiteralPath $dist) {
  Remove-Item -LiteralPath $dist -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $public | Out-Null
Copy-Item -LiteralPath (Join-Path $root "index.html") -Destination (Join-Path $public "index.html")

$imagesSource = Join-Path $root "Images"
if (Test-Path -LiteralPath $imagesSource) {
  Copy-Item -LiteralPath $imagesSource -Destination (Join-Path $public "Images") -Recurse
}

Write-Host "Built Cloudflare Workers assets to dist/public"
