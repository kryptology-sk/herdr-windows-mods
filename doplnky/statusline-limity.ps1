# Claude Code status line script (PowerShell 5.1 compatible)
# Reads JSON from stdin and prints a 2-line status line.

$rawInput = [Console]::In.ReadToEnd()

try {
    $data = $rawInput | ConvertFrom-Json
} catch {
    Write-Output "Claude Code"
    exit 0
}

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

# --- Model name ---
$modelName = $null
if ($data.model -and $data.model.display_name) {
    $modelName = $data.model.display_name
} else {
    $modelName = "Claude"
}

# --- Current working directory (abbreviate home with ~) ---
$cwd = $null
if ($data.workspace -and $data.workspace.current_dir) {
    $cwd = $data.workspace.current_dir
} elseif ($data.cwd) {
    $cwd = $data.cwd
}

$homeDir = $env:USERPROFILE
if ($cwd -and $homeDir -and $cwd.ToLower().StartsWith($homeDir.ToLower())) {
    $cwd = "~" + $cwd.Substring($homeDir.Length)
}
if (-not $cwd) { $cwd = "." }

# --- ANSI colors ---
$esc = [char]27
$green = "$esc[32m"
$dim = "$esc[2m"
$reset = "$esc[0m"

function Format-TokenCount {
    param([double]$n)
    if ($n -ge 1000) {
        return "{0}K" -f [math]::Round($n / 1000, 0)
    }
    return "{0}" -f [math]::Round($n, 0)
}

# --- Context window usage bar ---
$barLine = $null
$ctx = $data.context_window
if ($ctx -and $ctx.context_window_size) {
    $total = [double]$ctx.context_window_size
    $used = 0
    if ($null -ne $ctx.total_input_tokens) {
        $used = [double]$ctx.total_input_tokens
    }

    $pct = $null
    if ($null -ne $ctx.used_percentage) {
        $pct = [double]$ctx.used_percentage
    } elseif ($total -gt 0) {
        $pct = ($used / $total) * 100
    }

    if ($null -ne $pct) {
        $pctRound = [math]::Round($pct, 0)

        $barWidth = 20
        $filled = [math]::Floor($barWidth * $pctRound / 100)
        if ($filled -gt $barWidth) { $filled = $barWidth }
        if ($filled -lt 0) { $filled = 0 }
        $empty = $barWidth - $filled

        $bar = ("#" * $filled) + ("-" * $empty)
        $usedStr = Format-TokenCount $used
        $totalStr = Format-TokenCount $total

        $barLine = "$green[$bar]$reset $usedStr/$totalStr ${pctRound}%"
    }
}

# --- Build output lines ---
$line1 = $modelName
if ($barLine) {
    $line1 = "$modelName  $barLine"
}
$line2 = "$dim$cwd$reset"

Write-Output $line1
Write-Output $line2
