$ErrorActionPreference = 'Stop'
docker rm -f myn-Recicla-01 2>$null | Out-Null
docker run -d --name myn-Recicla-01 -p 5188:5188 -v Recicla-dados:/data myn-Recicla-01
Start-Sleep -Seconds 4
try {
  $r = Invoke-WebRequest -Uri 'http://127.0.0.1:5188/' -UseBasicParsing -TimeoutSec 10
  Write-Output "site HTTP $($r.StatusCode) — http://127.0.0.1:5188"
} catch { Write-Output "site ainda subindo: $($_.Exception.Message)" }
