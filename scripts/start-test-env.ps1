$ErrorActionPreference = 'Continue'
$project = 'C:\Users\HP\Desktop\Retrouveobjet'
$cloudflared = 'C:\WINDOWS\TEMP\opencode\cloudflared.exe'
$logs = 'C:\WINDOWS\TEMP\opencode'
$cfErr = "$logs\cf.err.log"
$cfErr2 = "$logs\cf-test.err.log"

Write-Host '=== RetrouveMoi - Environnement de test ==='

# 1. MySQL
if (-not (Get-NetTCPConnection -LocalPort 3306 -State Listen -ErrorAction SilentlyContinue)) {
  if (Test-Path 'c:\xampp\mysql\bin\mysqld.exe') {
    Write-Host '[1/3] Demarrage MySQL (XAMPP)...'
    Start-Process 'c:\xampp\mysql\bin\mysqld.exe' -ArgumentList '--defaults-file=c:\xampp\mysql\bin\my.ini' -WindowStyle Hidden
    $d = (Get-Date).AddSeconds(30)
    while (-not (Get-NetTCPConnection -LocalPort 3306 -State Listen -ErrorAction SilentlyContinue) -and (Get-Date) -lt $d) { Start-Sleep 2 }
  }
} else { Write-Host '[1/3] MySQL deja actif (port 3306)' }

# 2. App Next.js
if (-not (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)) {
  Write-Host '[2/3] Demarrage de l app (npm run dev) - premier chargement lent...'
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'npm run dev' -WorkingDirectory $project -WindowStyle Hidden -RedirectStandardOutput "$logs\app.log" -RedirectStandardError "$logs\app.err.log"
  $d = (Get-Date).AddSeconds(120)
  while (-not (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) -and (Get-Date) -lt $d) { Start-Sleep 2 }
} else { Write-Host '[2/3] App deja active (http://localhost:3000)' }

# 3. Cloudflare tunnel
if (-not (Get-Process cloudflared -ErrorAction SilentlyContinue)) {
  Write-Host '[3/3] Creation du tunnel public...'
  Remove-Item "$cfErr2" -ErrorAction SilentlyContinue
  Start-Process -FilePath $cloudflared -ArgumentList 'tunnel', '--url', 'http://localhost:3000', '--no-autoupdate' -WorkingDirectory $logs -WindowStyle Hidden -RedirectStandardOutput "$logs\cf-test.log" -RedirectStandardError "$cfErr2"
} else { Write-Host '[3/3] Tunnel deja actif (reutilisation)' }

$url = $null
$d = (Get-Date).AddSeconds(40)
while ((Get-Date) -lt $d -and -not $url) {
  Start-Sleep 2
  foreach ($f in @($cfErr2, $cfErr)) {
    if (Test-Path $f) {
      $m = (Select-String -Path $f -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue | Select-Object -Last 1)
      if ($m -and $m.Matches.Count -gt 0) { $url = $m.Matches[0].Value; break }
    }
  }
}

Write-Host ''
Write-Host '--------------------------------------------'
if ($url) { Write-Host "LIEN PUBLIC  : $url" } else { Write-Host 'Lien public : non trouve (voir cf-test.err.log)' }
Write-Host "App locale   : http://localhost:3000"
if ($url) {
  Write-Host 'Ouverture du navigateur...'
  Start-Process $url
}
Write-Host ''
Write-Host 'Comptes de test :'
Write-Host '  Admin : digihouse10@gmail.com / AdmIn@2024'
Write-Host '  User  : testmigration@retrouvemoi.test / retrouve123'
Write-Host '--------------------------------------------'
Write-Host 'Le lien change a chaque redemarrage du tunnel (mode gratuit).'
Write-Host 'L app et la base restent accessibles tant que le PC est allume.'