// História — bočný panel so zoznamom minulých rozhovorov Claude Code, Codexu a agy
// pre priečinok, v ktorom sa práve pracuje (ten istý ako v paneli Files).
// Číta len lokálne súbory a nič nezapisuje, bez siete. Z obsahu rozhovorov ide von
// len názov alebo začiatok prvej správy človeka:
// - Claude: ~/.claude/projects/<priečinok>/<id>.jsonl, názov z custom-title, inak ai-title,
//   bežiace sedenia z ~/.claude/sessions/<pid>.json so živým procesom,
// - Codex: ~/.codex/sessions/RRRR/MM/DD/rollout-*.jsonl, len interaktívne (source cli
//   alebo vscode, thread_source user), názov zo ~/.codex/session_index.jsonl,
// - agy: ~/.gemini/antigravity-cli, len rozhovory napísané v termináli (history.jsonl),
//   názov z cache/conversation_metadata.json.
// Klik otvorí rozhovor v novej karte. Bežiaci rozhovor sa neotvára, dva programy
// nad jedným rozhovorom by si prepisovali záznam.
// Pole pod hlavičkou filtruje počas písania v názve rozhovoru a programu, bez ohľadu
// na veľkosť písmen a diakritiku. Klávesnicu berie len po kliknutí doň, Esc ho zmaže.
// Prepínač „všade" ukáže rozhovory zo všetkých priečinkov okrem dočasných (%TEMP%) s názvom
// priečinka pri riadku, klik ich otvorí v ich pôvodnom priečinku.
// Prop `filter` je počiatočný text poľa, prop `vsade` počiatočný stav prepínača.

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { spaces, panes, focused, exec, theme, run, knownAgents, checking, props, terminals } from "herdr";

const OBNOVA_MS = 60000;
const OBNOVA_VSADE_MS = 300000;
const CITANIE_MS = 30000;
// Koľko najnovších rozhovorov sa načíta (v nich sa hľadá) a koľko riadkov sa ukáže.
const NACITAT = 500;
const ZOBRAZIT = 40;

// Jeden príkaz PowerShellu (vzor CODEX_PS v limity), argumenty priečinok a $vsade. Vráti
// {"spolu": N, "zoznam": [{id, program, nazov, zmenene, bezi}]} — najviac NACITAT
// najnovších podľa času zmeny súboru (unix sekundy), v režime „všade" aj s poľami
// priecinok (pôvodný priečinok rozhovoru) a existuje. Veľké súbory sa nečítajú celé:
// Claude posledných 64 KiB (1 MiB a 8 MiB, keď tam názov nie je), Codex prvý riadok,
// agy prvý riadok prepisu. Chyba jedného zdroja ostatné nezastaví.
// JSON sa číta cez JavaScriptSerializer, ConvertFrom-Json v PowerShell 5.1 padá na kľúčoch
// líšiacich sa veľkosťou písmen.
// Bez dvojitých úvodzoviek (úvodzovka je [char]34), aby prešiel argumentom procesu bez úprav.
const HISTORIA_PS = [
  "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false);",
  "& { param($cwd, $vsade)",
  "Add-Type -AssemblyName System.Web.Extensions;",
  "$js = New-Object System.Web.Script.Serialization.JavaScriptSerializer; $js.MaxJsonLength = 67108864;",
  "$utf8 = New-Object System.Text.UTF8Encoding($false); $q = [string][char]34; $teraz = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds();",
  "$uuid = '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';",
  "function Get-Unix($cas) { [DateTimeOffset]::new($cas).ToUnixTimeSeconds() };",
  // Položka výstupu s pevnými typmi (reťazec, číslo, áno/nie).
  "function Get-Polozka($id, $program, $nazov, $zmenene, $bezi) { @{ id = [string]$id; program = [string]$program; nazov = [string]$nazov; zmenene = [int64]$zmenene; bezi = [bool]$bezi } };",
  // Cesta bez predpony \\?\, s opačnými lomkami a bez koncovej lomky (porovnanie -eq je bez ohľadu na veľkosť písmen).
  "function Get-Normal($cesta) { $p = ([string]$cesta).Trim() -replace '/', '\\';",
  "if ($p.StartsWith('\\\\?\\')) { $p = $p.Substring(4) }; if ($p -match '^\\\\[A-Za-z]:') { $p = $p.Substring(1) };",
  "if ($p.Length -gt 3) { $p = $p.TrimEnd([char]92) }; $p };",
  // Prvých alebo posledných $max bajtov súboru ako text, pri konci bez načatého prvého riadku.
  "function Read-Usek($cesta, $odKonca, $max) { $fs = [IO.File]::Open($cesta, 'Open', 'Read', 'ReadWrite, Delete');",
  "try { $n = [int][Math]::Min([int64]$max, $fs.Length); $od = [int64]0; if ($odKonca) { $od = $fs.Length - $n };",
  "[void]$fs.Seek($od, 'Begin'); $b = New-Object byte[] $n; $r = 0;",
  "while ($r -lt $n) { $k = $fs.Read($b, $r, $n - $r); if ($k -le 0) { break }; $r += $k };",
  "$t = $utf8.GetString($b, 0, $r); if ($od -gt 0) { $t = $t.Substring($t.IndexOf([char]10) + 1) }; $t } finally { $fs.Dispose() } };",
  "function Get-PrvyRiadok($cesta) { $fs = [IO.File]::Open($cesta, 'Open', 'Read', 'ReadWrite, Delete'); try { (New-Object IO.StreamReader($fs, $utf8)).ReadLine() } finally { $fs.Dispose() } };",
  // Značka záznamu "type":"<typ>" (riadok JSONL ho obsahuje, text vo vnútri reťazca má úvodzovky escapované).
  "function Get-Znacka($typ) { $q + 'type' + $q + ':' + $q + $typ + $q };",
  // Celý riadok JSONL okolo pozície $i, deserializovaný. Nedopísaný riadok (bez konca) $null.
  "function Get-RiadokOkolo($text, $i) { $a = $text.LastIndexOf([char]10, $i) + 1; $b = $text.IndexOf([char]10, $i); if ($b -lt 0) { return $null };",
  "try { $js.DeserializeObject($text.Substring($a, $b - $a)) } catch { $null } };",
  // Riadky so značkou od začiatku textu (pre prvú správu).
  "function Get-Riadky($text, $typ) { $z = Get-Znacka $typ; $i = $text.IndexOf($z, [StringComparison]::Ordinal);",
  "while ($i -ge 0) { Get-RiadokOkolo $text $i; $i = $text.IndexOf($z, $i + 1, [StringComparison]::Ordinal) } };",
  // Hodnota kľúča z posledného celého záznamu daného typu (pre názov), inak $null.
  "function Find-Hodnota($text, $typ, $kluc) { $z = Get-Znacka $typ; $i = $text.LastIndexOf($z, [StringComparison]::Ordinal);",
  "while ($i -ge 0) { $o = Get-RiadokOkolo $text $i; if ($o -and $o['type'] -eq $typ -and $o[$kluc]) { return [string]$o[$kluc] };",
  "if ($i -eq 0) { break }; $i = $text.LastIndexOf($z, $i - 1, [StringComparison]::Ordinal) }; $null };",
  // Začiatok správy na jednom riadku bez značiek, najviac 60 znakov.
  "function Get-Zaciatok($t) { $t = (([string]$t -replace '<[^>]*>', ' ') -replace '\\s+', ' ').Trim(); if ($t.Length -gt 60) { $t = $t.Substring(0, 60).TrimEnd() }; $t };",
  "function Get-PrvaSpravaClaude($text) { foreach ($o in @(Get-Riadky $text 'user')) {",
  "try { if ($o['type'] -ne 'user' -or $o['isMeta'] -or $o['isSidechain']) { continue }; $c = $o['message']['content'];",
  "$t = if ($c -is [string]) { $c } else { (@($c) | Where-Object { $_ -is [Collections.IDictionary] -and $_['type'] -eq 'text' } | ForEach-Object { $_['text'] }) -join ' ' };",
  "$t = Get-Zaciatok $t; if ($t) { return $t } } catch { } } };",
  // Claude pri každom uložení pripisuje custom-title (premenovanie) a ai-title na koniec prepisu.
  // Najprv posledných 64 KiB, bez názvu 1 MiB a 8 MiB (dlhý ťah), nakoniec prvá správa človeka.
  "function Get-NazovClaude($cesta, $dlzka) { foreach ($max in 65536, 1048576, 8388608) { $text = Read-Usek $cesta $true $max;",
  "$n = Find-Hodnota $text 'custom-title' 'customTitle'; if (-not $n) { $n = Find-Hodnota $text 'ai-title' 'aiTitle' }; if ($n) { return $n };",
  "if ($dlzka -le $max) { break } }; Get-PrvaSpravaClaude (Read-Usek $cesta $false 1048576) };",
  "function Get-PrvaSpravaCodex($text) { foreach ($o in @(Get-Riadky $text 'user_message')) {",
  "try { if ($o['type'] -eq 'event_msg' -and $o['payload']['type'] -eq 'user_message') { $t = Get-Zaciatok $o['payload']['message']; if ($t) { return $t } } } catch { } } };",
  "function Get-NazovAgy($id) { $s = $null; if ($meta -and $meta.ContainsKey($id) -and $meta[$id] -is [Collections.IDictionary]) { $s = $meta[$id]['summary'] };",
  "if ($s -and $s['Title']) { return [string]$s['Title'] };",
  "$a = Join-Path $agy ('annotations/' + $id + '.pbtxt');",
  "if (Test-Path -LiteralPath $a) { $m = [regex]::Match((Read-Usek $a $false 65536), 'title:' + $q + '((?:[^' + $q + '\\\\]|\\\\.)*)' + $q);",
  "if ($m.Success -and $m.Groups[1].Value) { return ($m.Groups[1].Value -replace '\\\\(.)', '$1') } };",
  "if ($s -and $s['Preview']) { return Get-Zaciatok $s['Preview'] };",
  "$k = $js.DeserializeObject((Get-PrvyRiadok (Join-Path $agy ('brain/' + $id + '/.system_generated/logs/transcript.jsonl'))));",
  "if ($k['type'] -eq 'USER_INPUT') { return Get-Zaciatok $k['content'] }; $null };",
  // Priečinky pod systémovým dočasným priečinkom (skúšobné behy) režim „všade" vynecháva.
  "$docasne = @(@($env:TEMP, (Join-Path $env:LOCALAPPDATA 'Temp'), [IO.Path]::GetTempPath()) | Where-Object { $_ } | ForEach-Object { Get-Normal $_ } | Select-Object -Unique);",
  "function Test-Docasny($p) { $n = Get-Normal $p; foreach ($t in $docasne) { if ($n -eq $t -or $n.StartsWith($t + '\\', [StringComparison]::OrdinalIgnoreCase)) { return $true } }; $false };",
  // Či rozhovor z priečinka $p patrí do zoznamu: bežný režim len ten istý priečinok, „všade" každý okrem dočasných.
  "function Test-Patri($p) { if ($vsade) { return -not (Test-Docasny $p) }; (Get-Normal $p) -eq $ciel };",
  // Pôvodný priečinok rozhovoru Claude je prvé pole cwd v prepise (neskôr sa mení s príkazom cd).
  "function Get-CwdClaude($cesta) { foreach ($max in 65536, 1048576) { $m = [regex]::Match((Read-Usek $cesta $false $max), $q + 'cwd' + $q + ':' + $q + '((?:[^' + $q + '\\\\]|\\\\.)*)' + $q);",
  "if ($m.Success) { return Get-Normal ($js.DeserializeObject($q + $m.Groups[1].Value + $q)) } }; $null };",
  // Najprv kandidáti bez čítania názvov (súbor, čas zmeny, priečinok), názvy až pre najnovších.
  "$ciel = Get-Normal $cwd; $kand = New-Object System.Collections.ArrayList; $bezia = @{}; $mena = @{};",
  "function Add-Kandidat($program, $id, $cesta, $dlzka, $zmenene, $priecinok) { [void]$kand.Add(@{ program = $program; id = [string]$id; cesta = $cesta; dlzka = $dlzka; zmenene = [int64]$zmenene; priecinok = $priecinok }) };",
  // Claude: bežiace sedenia (živý proces s tým istým časom štartu), potom prepisy priečinka projektu,
  // v režime „všade" všetkých priečinkov okrem dočasných. Priečinok projektu je cesta, v ktorej je
  // každý znak okrem písmen a číslic pomlčka (nad 200 znakov s príponou).
  "try {",
  "foreach ($f in @(Get-ChildItem -LiteralPath (Join-Path $HOME '.claude/sessions') -Filter '*.json' -File -ErrorAction SilentlyContinue)) {",
  "try { if ($f.Name -notmatch '^[0-9]+[.]json$') { continue }; $o = $js.DeserializeObject((Read-Usek $f.FullName $false 1048576));",
  "$p = Get-Process -Id ([int]$o['pid']) -ErrorAction Stop;",
  "if ($o['procStart'] -and [string]$p.StartTime.ToFileTimeUtc() -ne [string]$o['procStart']) { continue };",
  "if ($o['sessionId']) { $bezia[[string]$o['sessionId']] = $true } } catch { } };",
  "$projekty = Join-Path $HOME '.claude/projects';",
  "if ($vsade) { $tmpNazvy = @($docasne | ForEach-Object { $_ -replace '[^a-zA-Z0-9]', '-' });",
  "$adresare = @(Get-ChildItem -LiteralPath $projekty -Directory | Where-Object { $n = $_.Name; -not ($tmpNazvy | Where-Object { $n -eq $_ -or $n.StartsWith($_ + '-', [StringComparison]::OrdinalIgnoreCase) }) } | ForEach-Object { $_.FullName }) }",
  "else { $nazov = $ciel -replace '[^a-zA-Z0-9]', '-'; $projekt = Join-Path $projekty $nazov;",
  "if (-not (Test-Path -LiteralPath $projekt) -and $nazov.Length -gt 200) { $projekt = @(Get-ChildItem -LiteralPath $projekty -Directory -Filter ($nazov.Substring(0, 200) + '*'))[0].FullName };",
  "$adresare = @($projekt | Where-Object { $_ -and (Test-Path -LiteralPath $_) }) };",
  "foreach ($d in $adresare) { foreach ($f in @(Get-ChildItem -LiteralPath $d -Filter '*.jsonl' -File)) {",
  "if ($f.BaseName -match $uuid) { Add-Kandidat 'claude' $f.BaseName $f.FullName $f.Length (Get-Unix $f.LastWriteTimeUtc) $ciel } } } } catch { };",
  // Codex: len interaktívne vlákna priečinka. Behy codex exec majú source exec (originator codex_exec),
  // pomocné vlákna thread_source subagent, guardian_review alebo agent_created_thread.
  "try { $index = Join-Path $HOME '.codex/session_index.jsonl';",
  "if (Test-Path -LiteralPath $index) { foreach ($r in (Read-Usek $index $false 67108864) -split [char]10) {",
  "try { $o = $js.DeserializeObject($r); if ($o['id'] -and $o['thread_name']) { $mena[[string]$o['id']] = [string]$o['thread_name'] } } catch { } } };",
  "foreach ($f in @(Get-ChildItem -LiteralPath (Join-Path $HOME '.codex/sessions') -Recurse -File -Filter 'rollout-*.jsonl' -ErrorAction SilentlyContinue)) {",
  "try { if (-not $f.Name.EndsWith('.jsonl')) { continue }; $m = $js.DeserializeObject((Get-PrvyRiadok $f.FullName)); $p = $m['payload'];",
  "if ($m['type'] -ne 'session_meta') { continue }; $pc = Get-Normal $p['cwd']; if (-not (Test-Patri $pc)) { continue };",
  "if (@('cli', 'vscode') -notcontains $p['source'] -or @('', 'user') -notcontains [string]$p['thread_source']) { continue };",
  "$id = [string]$p['id']; if ($id -notmatch $uuid) { continue };",
  "Add-Kandidat 'codex' $id $f.FullName $f.Length (Get-Unix $f.LastWriteTimeUtc) $pc } catch { } } } catch { };",
  // agy: len rozhovory, do ktorých sa písalo v termináli v tomto priečinku (history.jsonl, agy -p tam nepíše).
  // Prvá správa rozhovoru sa tam zapisuje bez id — rozhovor sa jej priradí podľa času prvého kroku prepisu (do 5 s).
  "try { $agy = Join-Path $HOME '.gemini/antigravity-cli'; $hist = Join-Path $agy 'history.jsonl';",
  "if (Test-Path -LiteralPath $hist) { $idy = @{}; $bezId = New-Object System.Collections.ArrayList;",
  "foreach ($r in (Read-Usek $hist $false 67108864) -split [char]10) {",
  // Rozhovor dostane priečinok, v ktorom sa do neho naposledy písalo.
  "try { $o = $js.DeserializeObject($r); $w = Get-Normal $o['workspace']; if (-not (Test-Patri $w)) { continue };",
  "if ($o['conversationId']) { $idy[[string]$o['conversationId']] = $w } elseif ($o['type'] -ne 'slash_command' -and $o['timestamp']) { [void]$bezId.Add(@(([double]$o['timestamp'] / 1000), $w)) } } catch { } };",
  "if ($bezId.Count) { foreach ($f in @(Get-ChildItem -LiteralPath (Join-Path $agy 'conversations') -Filter '*.db' -File -ErrorAction SilentlyContinue)) {",
  "try { $id = $f.BaseName; if ($id -notmatch $uuid -or $idy.ContainsKey($id)) { continue }; $vznik = Get-Unix $f.CreationTimeUtc;",
  "if (-not ($bezId | Where-Object { [Math]::Abs($_[0] - $vznik) -le 120 })) { continue };",
  "$k = $js.DeserializeObject((Get-PrvyRiadok (Join-Path $agy ('brain/' + $id + '/.system_generated/logs/transcript.jsonl'))));",
  "$cas = [DateTimeOffset]::Parse([string]$k['created_at']).ToUnixTimeSeconds();",
  "$zhoda = @($bezId | Where-Object { [Math]::Abs($_[0] - $cas) -le 5 }); if ($zhoda.Count) { $idy[$id] = $zhoda[0][1] } } catch { } } };",
  "$meta = $null; try { $meta = $js.DeserializeObject((Read-Usek (Join-Path $agy 'cache/conversation_metadata.json') $false 67108864))['conversations'] } catch { };",
  "foreach ($id in @($idy.Keys)) { try { if ($id -notmatch $uuid) { continue }; $db = Join-Path $agy ('conversations/' + $id + '.db');",
  "if (Test-Path -LiteralPath $db) { $z = Get-Unix (Get-Item -LiteralPath $db).LastWriteTimeUtc }",
  "elseif ($meta -and $meta.ContainsKey($id)) { $z = [DateTimeOffset]::Parse([string]$meta[$id]['last_modified_time']).ToUnixTimeSeconds() } else { continue };",
  "Add-Kandidat 'agy' $id $null 0 $z $idy[$id] } catch { } } } } catch { };",
  // Názvy len pre najnovších kandidátov, kým sa nenazbiera NACITAT rozhovorov so správou človeka.
  // spolu = načítané + kandidáti, ktorí sa už nečítali (pri tých sa správa človeka neoverila).
  "$vysledok = New-Object System.Collections.ArrayList; $vyriesene = 0;",
  `foreach ($kn in @($kand | Sort-Object { $_.zmenene } -Descending)) { if ($vysledok.Count -ge ${NACITAT}) { break }; $vyriesene++;`,
  "try { $pc = $kn.priecinok;",
  "if ($kn.program -eq 'claude') { $n = Get-NazovClaude $kn.cesta $kn.dlzka; if ($n -and $vsade) { $pc = Get-CwdClaude $kn.cesta; if (-not $pc -or (Test-Docasny $pc)) { continue } } }",
  "elseif ($kn.program -eq 'codex') { $n = $mena[$kn.id]; if (-not $n) { $n = Get-PrvaSpravaCodex (Read-Usek $kn.cesta $false 1048576) } }",
  "else { $n = Get-NazovAgy $kn.id };",
  "if (-not $n) { continue }; $beh = ($teraz - $kn.zmenene) -lt 120; if ($kn.program -eq 'claude') { $beh = $bezia[$kn.id] };",
  "$x = Get-Polozka $kn.id $kn.program $n $kn.zmenene $beh;",
  "if ($vsade) { $x['priecinok'] = [string]$pc; $x['existuje'] = [bool](Test-Path -LiteralPath $pc -PathType Container) };",
  "[void]$vysledok.Add($x) } catch { } };",
  "@{ spolu = [int]($vysledok.Count + $kand.Count - $vyriesene); zoznam = @($vysledok) } | ConvertTo-Json -Compress -Depth 4 }",
].join(" ");

// Kľúč programu v tabuľke programov Herdru (knownAgents) — odtiaľ ikona, ako v dodávaných modoch.
const PROGRAMY = { claude: "claude", codex: "codex", agy: "antigravity" };

// Príkaz novej karty, ktorý rozhovor obnoví. Codex bez zdieľaného démona, ako ho spúšťa Herdr.
const OBNOVENIE = {
  claude: (id) => ["claude", "--resume", id],
  codex: (id) => ["codex", "resume", "--no-daemon", id],
  agy: (id) => ["agy", "--conversation", id],
};

// Priečinok aktívneho panelu, inak priestoru — ako location() v mode files.
function location() {
  const space = spaces().find(s => s.active), f = focused();
  const pane = f?.pane ? panes().find(p => p.pane === f.pane) : null;
  const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  return { cwd: pane?.cwd || f?.cwd || space?.folder, on, space: space?.id };
}
const kluc = () => JSON.stringify(location());

// Cesta ako reťazec PowerShellu v jednoduchých úvodzovkách (aj typografické sa zdvojujú, vzor files).
const psRetazec = (s) => "'" + s.replace(/['‘’‚‛]/g, "$&$&") + "'";

// Text na porovnanie: malé písmená bez diakritiky („Návrh článku" → „navrh clanku").
const naPorovnanie = (s) => String(s).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// Cesta na porovnanie dvoch priečinkov: rovnaké lomky, bez lomky na konci, malé písmená.
const normCesta = (p) => String(p ?? "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();

// Otvorený priestor, do ktorého patrí rozhovor z daného priečinka, alebo null.
// Priečinok evidovaný pri priestore (`folder`) sa na to nehodí, je to len miesto, kde priestor
// vznikol. Rozhoduje preto 1. priestor pomenovaný ako posledný priečinok cesty („web"),
// 2. priestor, v ktorom v tom priečinku práve beží najviac terminálov (štítok `herdr.space`).
function priestorPre(priecinok) {
  const ciel = normCesta(priecinok), meno = naPorovnanie(ciel.split("/").pop());
  const miestne = spaces().filter((s) => !s.machine);
  const podlaMena = miestne.find((s) => naPorovnanie(s.name) === meno);
  if (podlaMena) return podlaMena;
  const pocty = new Map();
  for (const t of terminals()) {
    const id = t.labels?.["herdr.space"];
    if (t.state !== "live" || !id || normCesta(t.cwd) !== ciel) continue;
    pocty.set(id, (pocty.get(id) ?? 0) + 1);
  }
  const najviac = [...pocty.entries()].sort((a, b) => b[1] - a[1])[0];
  return najviac ? miestne.find((s) => s.id === najviac[0]) ?? null : null;
}

const nazovPriecinka = (cwd) => String(cwd ?? "").split(/[\\/]/).filter(Boolean).pop() ?? "";

// Riadok z PowerShellu, ktorému panel rozumie, s názvom na jednom riadku. `hladat` je názov,
// program (claude, codex, agy aj antigravity) a v režime „všade" názov priečinka, pripravené
// na porovnanie s filtrom. `priecinok` a `existuje` posiela len režim „všade".
function platnyRiadok(r) {
  if (typeof r?.id !== "string" || !OBNOVENIE[r.program] || typeof r.zmenene !== "number") return null;
  const nazov = String(r.nazov ?? "").replace(/\s+/g, " ").trim();
  if (!nazov) return null;
  const priecinok = typeof r.priecinok === "string" && r.priecinok ? r.priecinok : null;
  const hladat = naPorovnanie(`${nazov} ${r.program} ${PROGRAMY[r.program]} ${nazovPriecinka(priecinok)}`);
  return { id: r.id, program: r.program, nazov, zmenene: r.zmenene, bezi: r.bezi === true, hladat, priecinok, existuje: r.existuje !== false };
}

// Rozhovory, v ktorých sa nájdu všetky slová filtra. Prázdny filter nechá všetky.
function zhody(zoznam, filtr) {
  const slova = naPorovnanie(filtr).split(/\s+/).filter(Boolean);
  return slova.length ? zoznam.filter((r) => slova.every((s) => r.hladat.includes(s))) : zoznam;
}

// Zoznam pre priečinok `cwd`, alebo pri `vsade` zo všetkých priečinkov.
async function citajHistoriu(cwd, vsade = false) {
  const argumenty = `${psRetazec(vsade ? "" : cwd)} ${vsade ? "$true" : "$false"}`;
  const r = await exec("powershell", ["-NoProfile", "-Command", `${HISTORIA_PS} ${argumenty}`], { timeout: CITANIE_MS });
  if (r.code !== 0) throw new Error(r.stderr || `kód ${r.code}`);
  const data = JSON.parse(r.stdout.trim());
  const zoznam = (Array.isArray(data?.zoznam) ? data.zoznam : []).map(platnyRiadok).filter(Boolean);
  return { zoznam, spolu: typeof data?.spolu === "number" ? data.spolu : zoznam.length };
}

// „teraz", „12 min", „3 h", „2 d" — ako zoznam rozhovorov Claude Code vo VS Code.
function vek(zmenene) {
  const s = Math.max(0, Date.now() / 1000 - zmenene);
  if (s < 60) return "teraz";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} d`;
}

// Ikona programu: jednofarebný znak v farbe textu, inak obrázok (vzor icon() v agents).
function ikona(p, velkost, farba) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(velkost).flex_none().text_color(farba) : image(p.icon).w(velkost).h(velkost).flex_none();
}

const maly = (text, farba) => div().text_size(11).text_color(farba).child(text);

export default class Historia extends View {
  init(_props, cx) {
    this.programy = [];
    // Pole hľadania. Klávesnicu nikdy neberie samo (žiadne focus()), len po kliknutí doň.
    const pociatocny = props()?.filter;
    this.filtr = typeof pociatocny === "string" ? pociatocny : "";
    this.input = InputState.new({ placeholder: "hľadať v názvoch…", value: this.filtr });
    this.input.on("change", (_e, cx) => { this.filtr = this.input.value(); cx.notify(); });
    // Kým je kurzor v poli, priečinok zoznamu sa nemení — klik do panela nesmie prepnúť zoznam.
    this.input.on("focus", () => { this.vPoli = true; });
    this.input.on("blur", (_e, cx) => { this.vPoli = false; cx.notify(); });
    // Prepínač „všade" je pri každom načítaní vypnutý, prop `vsade` ho zapne (napr. pre snímku).
    this.vsade = props()?.vsade === true;
    this.vsadeKontext = { data: null, chyba: false, nacitava: false };
    // Pri `herdr-app check` nič nečítať a nespúšťať.
    if (checking()) return;
    this.obnov(cx);
    if (this.vsade) this.obnovVsade(cx);
    // Bežný režim každú minútu, „všade" každých 5 minút (medzitým sa len prekreslí vek).
    cx.timer.every(OBNOVA_MS, (cx) => { if (this.vsade) cx.notify(); else this.obnov(cx); });
    cx.timer.every(OBNOVA_VSADE_MS, (cx) => { if (this.vsade) this.obnovVsade(cx); });
    cx.spawn(async (cx) => {
      try { this.programy = await knownAgents(); cx.notify(); } catch { /* ostane záložná ikona */ }
    });
  }

  // Pri zmene priečinka nový kontext (zoznam sa načíta znova, filter sa vyprázdni, okrem návratu
  // z režimu „všade"), inak len obnova toho istého. Text poľa ani kurzor obnova nemení.
  obnov(cx, zachovajFilter = false) {
    if (checking()) return;
    const { cwd, on, space } = location(), novy = kluc();
    if (!this.kontext || (novy !== this.kontext.kluc && !this.vPoli)) {
      if (this.kontext && !zachovajFilter) this.vycistiFilter(cx);
      this.kontext = { kluc: novy, cwd, on, space, data: null, chyba: false, nacitava: false };
    }
    const kontext = this.kontext;
    if (!kontext.cwd || kontext.on || kontext.nacitava) return;
    kontext.nacitava = true;
    cx.spawn(async (cx) => {
      try { kontext.data = await citajHistoriu(kontext.cwd); kontext.chyba = false; }
      catch { kontext.chyba = true; }
      finally { kontext.nacitava = false; cx.notify(); }
    });
  }

  // Zoznam zo všetkých priečinkov. Pokým sa číta, ostáva predošlý.
  obnovVsade(cx) {
    const kontext = this.vsadeKontext;
    if (checking() || kontext.nacitava) return;
    kontext.nacitava = true;
    cx.spawn(async (cx) => {
      try { kontext.data = await citajHistoriu(null, true); kontext.chyba = false; }
      catch { kontext.chyba = true; }
      finally { kontext.nacitava = false; cx.notify(); }
    });
  }

  // Zapnutie načíta všetky priečinky, vypnutie sa vráti na aktuálny priečinok. Text poľa ostáva.
  prepniVsade(cx) {
    this.vsade = !this.vsade;
    if (this.vsade) this.obnovVsade(cx);
    else this.obnov(cx, true);
    cx.notify();
  }

  aktivny() {
    return this.vsade ? this.vsadeKontext : this.kontext;
  }

  // Filter sa hneď prestane uplatňovať, text poľa sa zmaže až mimo vykresľovania.
  vycistiFilter(cx) {
    if (!this.filtr) return;
    this.filtr = "";
    cx.spawn(async (cx) => { this.input.set_value(""); cx.notify(); });
  }

  program(nastroj) {
    const kluc = PROGRAMY[nastroj];
    return this.programy.find((a) => a.key === kluc) ?? { icon: `icons/${kluc}.svg`, tint: false };
  }

  // Nová karta, ktorá rozhovor obnoví. V bežnom režime v aktuálnom priestore a priečinku.
  // V režime „všade" v priestore, ktorý patrí pôvodnému priečinku rozhovoru — ak taký priestor
  // je otvorený, karta pribudne doň a Herdr sa naň prepne, inak sa pre priečinok založí nový.
  otvor(r) {
    const argv = OBNOVENIE[r.program](r.id);
    if (!this.vsade) {
      run("tab.new", { space: this.kontext.space, folder: this.kontext.cwd, argv });
      return;
    }
    const ciel = priestorPre(r.priecinok);
    if (!ciel) {
      run("space.new", { folder: r.priecinok, argv });
      return;
    }
    run("tab.new", { space: ciel.id, folder: r.priecinok, argv });
    run("space.select", { id: ciel.id });
  }

  // Riadok rozhovoru. Bežiaci ani rozhovor, ktorého priečinok už neexistuje, sa neotvára.
  riadok(r, t) {
    const pic = ikona(this.program(r.program), 16, t.foreground);
    const bezPriecinka = this.vsade && !r.bezi && !r.existuje;
    const tlmeny = r.bezi || bezPriecinka;
    return h_flex().id(`hist-${r.program}-${r.id}`).px(8).h(30).flex_none().rounded(8).items_center().gap(9)
      .when(!tlmeny, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover)).on_click(() => this.otvor(r)))
      .when(r.bezi, (el) => el.tooltip("Rozhovor beží, druhé otvorenie by si prepisovalo záznam"))
      .when(bezPriecinka, (el) => el.tooltip("priečinok už neexistuje"))
      .when(Boolean(pic), (el) => el.child(pic))
      .child(div().flex_1().min_w(0).truncate().text_color(tlmeny ? t.muted : t.foreground).child(r.nazov))
      .when(this.vsade && Boolean(r.priecinok), (el) => el.child(div().id(`hist-p-${r.program}-${r.id}`).flex_none().max_w(110).truncate()
        .text_size(11).text_color(t.dim).tooltip(r.priecinok).child(nazovPriecinka(r.priecinok))))
      .child(div().flex_none().text_size(11).text_color(r.bezi ? t.working : t.dim).child(r.bezi ? "beží" : vek(r.zmenene)));
  }

  // Text namiesto zoznamu: bez priečinka, iný počítač (len bežný režim), načítavanie, chyba, prázdny zoznam.
  stav() {
    if (!this.vsade && !this.kontext?.cwd) return "žiadny priečinok";
    if (!this.vsade && this.kontext.on) return "história je len pre priečinky na tomto počítači";
    const kontext = this.aktivny();
    if (!kontext.data) return kontext.chyba ? "históriu sa nepodarilo načítať" : "načítava sa…";
    if (kontext.data.zoznam.length) return null;
    return this.vsade ? "žiadne rozhovory" : "žiadne rozhovory v tomto priečinku";
  }

  // Pätička: s filtrom počet zhôd medzi načítanými alebo „nič sa nenašlo", bez filtra koľko z koľkých.
  // V režime „všade" aj koľko rozhovorov je na disku, keď ich je viac než načítaných.
  pata(data, najdene) {
    const filter = Boolean(this.filtr.trim()), n = data.zoznam.length;
    if (filter && !najdene.length) return "nič sa nenašlo";
    if (!this.vsade) {
      if (filter) return `nájdených ${najdene.length} z ${n}`;
      const ukazanych = Math.min(ZOBRAZIT, n);
      return data.spolu > ukazanych ? `zobrazených ${ukazanych} z ${data.spolu}` : null;
    }
    const zaklad = filter ? `nájdených ${najdene.length} z ${n} načítaných` : `zobrazených ${Math.min(ZOBRAZIT, n)} z ${n} načítaných`;
    return data.spolu > n ? `${zaklad} (najnovších ${n} z ${data.spolu})` : zaklad;
  }

  // Pole hľadania pod hlavičkou (vzor picker) a vedľa neho prepínač „všade". Esc v poli zmaže text.
  pole(t) {
    const vsade = this.vsade;
    const pole = h_flex().id("historia-hladat").h(30).flex_1().min_w(0).px(8).gap(6).items_center().rounded(7).border_1().border_color(t.input).bg(t.background)
      .on_key_down((e, cx) => {
        if (e.key !== "escape") return;
        this.input.set_value("");
        this.filtr = "";
        cx.stop_propagation();
        cx.notify();
      })
      .child(svg("mods/workspace-chrome/search.svg").size(13).flex_none().text_color(t.dim))
      .child(Input.new(this.input).flex_1().h_full().text_size(12.5).text_color(t.foreground));
    const prepinac = div().id("historia-vsade").flex_none().h(24).px(8).flex().items_center().rounded(6).text_size(11).cursor_pointer()
      .border_1().border_color(vsade ? t.accent : t.input).bg(vsade ? t.accent : t.background).text_color(vsade ? t.accent_foreground : t.muted)
      .when(!vsade, (el) => el.hover((s) => s.bg(t.hover)))
      .tooltip(vsade ? "Hľadá sa vo všetkých priečinkoch" : "Hľadať vo všetkých priečinkoch")
      .on_click((_e, cx) => this.prepniVsade(cx))
      .child("všade");
    return h_flex().flex_none().mx(6).mt(6).gap(6).items_center().child(pole).child(prepinac);
  }

  render(cx) {
    if (!this.vsade && !this.vPoli && kluc() !== this.kontext?.kluc) this.obnov(cx);
    const t = theme(), stav = this.stav(), data = this.aktivny()?.data;
    const najdene = stav ? [] : zhody(data.zoznam, this.filtr), pata = stav ? null : this.pata(data, najdene);
    const podnadpis = this.vsade ? "všetky priečinky" : nazovPriecinka(this.kontext?.cwd);
    return v_flex().id("historia").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13)
      .child(h_flex().h(42).flex_none().px(14).items_center().border_b(1).border_color(t.border)
        .child(v_flex().flex_1().min_w(0)
          .child(div().font_semibold().child("História"))
          .when(Boolean(podnadpis), (el) => el.child(maly(podnadpis, t.dim).truncate()))))
      .child(this.pole(t))
      .child(v_flex().id("historia-zoznam").flex_1().min_h(0).overflow_y_scrollbar().p(6)
        .children(najdene.slice(0, ZOBRAZIT).map((r) => this.riadok(r, t)))
        .when(Boolean(stav), (el) => el.child(div().p(8).text_size(12).text_color(t.dim).child(stav)))
        .when(Boolean(pata), (el) => el.child(maly(pata, t.dim).p(8))));
  }
}
