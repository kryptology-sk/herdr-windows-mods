# Vlozka pre vlastny stavovy riadok Claude Code v PowerShelli (kompatibilne s PowerShell 5.1).
# Vloz ju do svojho skriptu hned za riadok, ktory nacita JSON zo stdin do premennej $data,
# napriklad
#   $data = [Console]::In.ReadToEnd() | ConvertFrom-Json
# Ak je tvoj stavovy riadok v inom jazyku, sprav to iste po svojom - do suboru
# ~\.cache\limity\claude.json zapis {"updated": <unix sekundy>, "rate_limits": <rate_limits zo vstupu>}.

# --- Cerpanie limitov pre panel Limity v Herdri ---
# Zapise len to, co Claude Code poslal v rate_limits, do lokalneho suboru
# ~\.cache\limity\claude.json. Ziadna siet, ziadne tokeny. Chyba zapisu sa ignoruje.
try {
    if ($data.rate_limits) {
        $limDir = Join-Path $env:USERPROFILE ".cache\limity"
        if (-not (Test-Path -LiteralPath $limDir)) {
            New-Item -ItemType Directory -Force -Path $limDir | Out-Null
        }
        $limJson = [ordered]@{
            updated     = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
            rate_limits = $data.rate_limits
        } | ConvertTo-Json -Depth 6 -Compress
        # Najprv docasny subor, potom presun, aby citatel nevidel rozpisany subor.
        $limTmp = Join-Path $limDir ("claude.$PID.tmp")
        [IO.File]::WriteAllText($limTmp, $limJson, (New-Object System.Text.UTF8Encoding($false)))
        Move-Item -LiteralPath $limTmp -Destination (Join-Path $limDir "claude.json") -Force
    }
} catch {}
