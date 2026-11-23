<#
.SYNOPSIS
  Nainštaluje mody a rozloženia z tohto balíčka do Herdr App, alebo ich odstráni.

.DESCRIPTION
  Skopíruje päť modov (agents-tree, limity, historia, pas, panely) a dve rozloženia
  (vychytavky, pasova-vyroba) do priečinka Herdr App. Nič neprepisuje — čo už existuje,
  preskočí. Nemení nastavenia Herdru ani Claude Code, nepoužíva sieť a nič nespúšťa.

.PARAMETER HerdrHome
  Priečinok Herdr App. Predvolene $HOME\.config\herdr-app.

.PARAMETER Odinstaluj
  Odstráni to, čo balíček nainštaloval. Bez -Potvrdit iba vypíše, čo by zmazal. Mod alebo
  rozloženie, ktoré sa líši od balíčka (upravené, alebo cudzie s rovnakým menom), nechá na mieste.

.PARAMETER Potvrdit
  Spolu s -Odinstaluj naozaj zmaže vypísané priečinky a súbory.

.PARAMETER AjZmenene
  Spolu s -Odinstaluj zmaže aj mody a rozloženia, ktoré sa líšia od balíčka.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\instalacia.ps1

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\instalacia.ps1 -Odinstaluj -Potvrdit
#>
[CmdletBinding()]
param(
    [string]$HerdrHome = (Join-Path $HOME '.config\herdr-app'),
    [switch]$Odinstaluj,
    [switch]$Potvrdit,
    [switch]$AjZmenene
)

$ErrorActionPreference = 'Stop'

$balik = $PSScriptRoot
$mody = @('agents-tree', 'limity', 'historia', 'pas', 'panely')
$rozlozenia = @('vychytavky', 'pasova-vyroba')
$modsCiel = Join-Path $HerdrHome 'mods'
$layoutsCiel = Join-Path $HerdrHome 'layouts'

if (($Potvrdit -or $AjZmenene) -and -not $Odinstaluj) {
    Write-Host 'Prepínače -Potvrdit a -AjZmenene platia len spolu s -Odinstaluj. Nič som nespravil.'
    exit 1
}

if (-not (Test-Path -LiteralPath $modsCiel -PathType Container) -or -not (Test-Path -LiteralPath $layoutsCiel -PathType Container)) {
    Write-Host "V priečinku $HerdrHome chýba mods alebo layouts."
    Write-Host 'Herdr App treba najprv raz spustiť, potom spusti tento skript znova.'
    exit 1
}

# Skopíruje jeden mod. mod.json ide prvý, main.js posledný. Herdr, ktorý uvidí priečinok modu
# bez mod.json, si mod sám vloží do zobrazeného rozloženia, a main.js bez ostatných súborov
# by sa načítal neúplný.
function Copy-HerdrMod([string]$meno) {
    $zdroj = Join-Path $balik "mods\$meno"
    $ciel = Join-Path $modsCiel $meno
    if (Test-Path -LiteralPath $ciel) { return $false }
    New-Item -ItemType Directory -Path $ciel | Out-Null
    Copy-Item -LiteralPath (Join-Path $zdroj 'mod.json') -Destination $ciel
    Get-ChildItem -LiteralPath $zdroj -File | Where-Object { $_.Name -ne 'mod.json' -and $_.Name -ne 'main.js' } |
        ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $ciel }
    Copy-Item -LiteralPath (Join-Path $zdroj 'main.js') -Destination $ciel
    return $true
}

function Copy-HerdrLayout([string]$meno) {
    $ciel = Join-Path $layoutsCiel "$meno.json"
    if (Test-Path -LiteralPath $ciel) { return $false }
    Copy-Item -LiteralPath (Join-Path $balik "layouts\$meno.json") -Destination $ciel
    return $true
}

# Či sa nainštalovaný mod líši od verzie v balíčku (upravený alebo cudzí mod s rovnakým menom).
function Test-ZmenenyMod([string]$meno) {
    $nainstalovany = Join-Path $modsCiel "$meno\main.js"
    $vBaliku = Join-Path $balik "mods\$meno\main.js"
    if (-not (Test-Path -LiteralPath $nainstalovany)) { return $true }
    return (Get-FileHash -LiteralPath $nainstalovany).Hash -ne (Get-FileHash -LiteralPath $vBaliku).Hash
}

# Či sa nainštalované rozloženie líši od verzie v balíčku.
function Test-ZmeneneRozlozenie([string]$meno) {
    $nainstalovane = Join-Path $layoutsCiel "$meno.json"
    $vBaliku = Join-Path $balik "layouts\$meno.json"
    return (Get-FileHash -LiteralPath $nainstalovane).Hash -ne (Get-FileHash -LiteralPath $vBaliku).Hash
}

# Rozdelí nainštalované kusy na tie, čo sa zmažú, a tie, čo ostanú. Kus, ktorý sa líši od balíčka
# (upravený, alebo cudzí s rovnakým menom, ktorý inštalácia preskočila), sa maže len s -AjZmenene.
function Get-PlanOdinstalovania {
    $zmazat = New-Object System.Collections.ArrayList
    $ponechat = New-Object System.Collections.ArrayList
    foreach ($m in $mody) {
        $p = Join-Path $modsCiel $m
        if (-not (Test-Path -LiteralPath $p)) { continue }
        if ((Test-ZmenenyMod $m) -and -not $AjZmenene) { [void]$ponechat.Add($p); continue }
        [void]$zmazat.Add($p)
    }
    foreach ($r in $rozlozenia) {
        $p = Join-Path $layoutsCiel "$r.json"
        $stav = Join-Path $layoutsCiel ".state\$r.json"
        if ((Test-Path -LiteralPath $p) -and (Test-ZmeneneRozlozenie $r) -and -not $AjZmenene) { [void]$ponechat.Add($p); continue }
        foreach ($s in @($p, $stav)) { if (Test-Path -LiteralPath $s) { [void]$zmazat.Add($s) } }
    }
    return @{ Zmazat = $zmazat; Ponechat = $ponechat }
}

function Invoke-Odinstalovanie {
    $plan = Get-PlanOdinstalovania
    if ($plan.Zmazat.Count -eq 0 -and $plan.Ponechat.Count -eq 0) {
        Write-Host "V $HerdrHome nie je nič z tohto balíčka. Nič som nezmazal."
        return
    }
    if ($plan.Zmazat.Count) {
        Write-Host $(if ($Potvrdit) { 'Mažem:' } else { 'Zmazalo by sa:' })
        foreach ($c in $plan.Zmazat) { Write-Host "  $c" }
    }
    if ($plan.Ponechat.Count) {
        Write-Host 'Ostáva na mieste, lebo sa líši od balíčka (upravené, alebo cudzie s rovnakým menom):'
        foreach ($c in $plan.Ponechat) { Write-Host "  $c" }
        Write-Host 'Ak to chceš zmazať tiež, pridaj -AjZmenene.'
    }
    if (-not $Potvrdit) {
        Write-Host ''
        Write-Host 'Nič som nezmazal. Na zmazanie spusti skript znova s -Odinstaluj -Potvrdit.'
        Write-Host 'Ak máš v Herdri zobrazené rozloženie vychytavky alebo pasova-vyroba, najprv sa prepni na main (Ctrl+Shift+L).'
        return
    }
    foreach ($c in $plan.Zmazat) { Remove-Item -LiteralPath $c -Recurse -Force -Confirm:$false }
    Write-Host ''
    Write-Host "Hotovo, zmazaných $($plan.Zmazat.Count) položiek. Stavový riadok Claude Code a agy si vráť ručne podľa README.md."
}

function Invoke-Instalacia {
    $skopirovane = New-Object System.Collections.ArrayList
    $preskocene = New-Object System.Collections.ArrayList
    # Najprv mody, potom rozloženia, aby rozloženie po príchode našlo svoje mody.
    foreach ($m in $mody) {
        if (Copy-HerdrMod $m) { [void]$skopirovane.Add("mods\$m") } else { [void]$preskocene.Add("mods\$m") }
    }
    foreach ($r in $rozlozenia) {
        if (Copy-HerdrLayout $r) { [void]$skopirovane.Add("layouts\$r.json") } else { [void]$preskocene.Add("layouts\$r.json") }
    }
    Write-Host "Cieľ: $HerdrHome"
    Write-Host ''
    Write-Host 'Skopírované:'
    if ($skopirovane.Count) { foreach ($s in $skopirovane) { Write-Host "  $s" } } else { Write-Host '  nič' }
    Write-Host 'Preskočené, lebo už existujú (nič som neprepísal):'
    if ($preskocene.Count) { foreach ($s in $preskocene) { Write-Host "  $s" } } else { Write-Host '  nič' }
    $cudzie = @($mody | Where-Object { $preskocene -contains "mods\$_" -and (Test-ZmenenyMod $_) })
    if ($cudzie.Count) {
        Write-Host ''
        Write-Host ('Pozor — tieto mody už existovali a líšia sa od balíčka: ' + ($cudzie -join ', ') + '.')
        Write-Host 'Rozloženia z balíčka použijú tie existujúce.'
    }
    Write-Host ''
    Write-Host 'Ďalšie kroky:'
    Write-Host '  1. V Herdri stláčaj Ctrl+Shift+L, kým sa neukáže rozloženie vychytavky (alebo pasova-vyroba).'
    Write-Host '  2. Voliteľne zapoj stavový riadok Claude Code pre panel Limity — README.md, časť Limity.'
    Write-Host '  3. Voliteľne zapoj stavový riadok agy — README.md, časť Limity.'
}

if ($Odinstaluj) { Invoke-Odinstalovanie } else { Invoke-Instalacia }
