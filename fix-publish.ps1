# fix-publish.ps1
# Fixes workspace:* deps and bumps all packages to 0.1.2 for republishing
# Run from D:\tracepath: powershell -ExecutionPolicy Bypass -File fix-publish.ps1

Write-Host ""
Write-Host "Fixing workspace:* dependencies for npm publishing..." -ForegroundColor Cyan
Write-Host ""

function Write-JsonFile($path, $data) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  $json = $data | ConvertTo-Json -Depth 10
  [System.IO.File]::WriteAllText((Resolve-Path $path).Path, $json, $utf8NoBom)
}

# @tracepath/core
$corePkg = Get-Content "packages\core\package.json" -Raw | ConvertFrom-Json
$corePkg.version = "0.1.2"
Write-JsonFile "packages\core\package.json" $corePkg
Write-Host "  [OK] @tracepath/core -> 0.1.2" -ForegroundColor Green

# @tracepath/node
$nodePkg = Get-Content "packages\node\package.json" -Raw | ConvertFrom-Json
$nodePkg.version = "0.1.2"
$nodePkg.dependencies."@tracepath/core" = "^0.1.2"
Write-JsonFile "packages\node\package.json" $nodePkg
Write-Host "  [OK] @tracepath/node -> 0.1.2 (core dep fixed)" -ForegroundColor Green

# @tracepath/browser
$browserPkg = Get-Content "packages\browser\package.json" -Raw | ConvertFrom-Json
$browserPkg.version = "0.1.2"
$browserPkg.dependencies."@tracepath/core" = "^0.1.2"
Write-JsonFile "packages\browser\package.json" $browserPkg
Write-Host "  [OK] @tracepath/browser -> 0.1.2 (core dep fixed)" -ForegroundColor Green

# @tracepath/cli
$cliPkg = Get-Content "packages\cli\package.json" -Raw | ConvertFrom-Json
$cliPkg.version = "0.1.2"
$cliPkg.dependencies."@tracepath/core" = "^0.1.2"
Write-JsonFile "packages\cli\package.json" $cliPkg
Write-Host "  [OK] @tracepath/cli -> 0.1.2 (core dep fixed)" -ForegroundColor Green

Write-Host ""
Write-Host "Verifying fixes..." -ForegroundColor Cyan

$allGood = $true
foreach ($pkg in @("core", "node", "browser", "cli")) {
  $pkgJson = Get-Content "packages\$pkg\package.json" -Raw | ConvertFrom-Json
  $version = $pkgJson.version
  $rawJson = Get-Content "packages\$pkg\package.json" -Raw
  if ($rawJson -match "workspace:") {
    Write-Host "  [FAIL] @tracepath/$pkg still has workspace: reference!" -ForegroundColor Red
    $allGood = $false
  } else {
    Write-Host "  [OK] @tracepath/$pkg v$version - clean" -ForegroundColor Green
  }
}

Write-Host ""

if (-not $allGood) {
  Write-Host "Fix failed. Do not publish yet." -ForegroundColor Red
  exit 1
}

Write-Host "All package.json files fixed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Now run these commands one by one:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  pnpm build" -ForegroundColor White
Write-Host ""
Write-Host "  cd packages\core" -ForegroundColor White
Write-Host "  npm publish --access public" -ForegroundColor White
Write-Host ""
Write-Host "  cd ..\node" -ForegroundColor White
Write-Host "  npm publish --access public" -ForegroundColor White
Write-Host ""
Write-Host "  cd ..\browser" -ForegroundColor White
Write-Host "  npm publish --access public" -ForegroundColor White
Write-Host ""
Write-Host "  cd ..\cli" -ForegroundColor White
Write-Host "  npm publish --access public" -ForegroundColor White
Write-Host ""
