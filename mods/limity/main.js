// Limity — bočný panel s čerpaním limitov predplatného Claude, Codexu a agy.
// Číta len lokálne zdroje a nič nezapisuje:
// - ~/.cache/limity/claude.json (zapisuje ho skript stavového riadku Claude Code),
// - posledný záznam token_count v najnovších sedeniach Codexu (~/.codex/sessions),
// - voliteľný ~/.cache/limity/agy.json,
// - odložené čerpanie v ~/.claude.json (cachedUsageUtilization), z neho len percentá a časy obnovy.
// Sám na sieť nevolá. Občas však spustí `claude -p /usage`, pri ktorom si Claude Code čerpanie
// stiahne vlastným prihlásením (pozri obnovUsage), a raz za hodinu sa na čerpanie rovnako opýta
// Codexu (`codex app-server`) a agy (`agy -p /usage`), bez volania modelu (pozri obnovKvoty).

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, readTextFile, home, theme, checking, agents, shared, setShared } from "herdr";

const SUBORY_KAZDYCH_MS = 15000;
const CODEX_KAZDYCH_MS = 60000;
// Kedy nechať Claude Code, aby si sám stiahol čerstvé čerpanie (to isté, čo /usage):
// pri otvorení panela, kým v Herdri pracuje niektorý agent najviac raz za 5 minút, inak raz za hodinu.
const USAGE_KAZDYCH_MS = 300000;
const USAGE_NAJVIAC_MS = 3600000;
// Ako často sa na čerpanie opýtať priamo Codexu a agy (pri otvorení panela a potom v tomto takte).
const KVOTY_KAZDYCH_MS = 3600000;
const STARY_UDAJ_MIN = 60;
const VYSTRAHA_PCT = 80;
const KRITICKE_PCT = 95;

// Texty panela po anglicky a po slovensky, s rovnakými kľúčmi. Text s hodnotami je funkcia.
const TEXTY = {
  en: {
    nadpis: "Limits",
    nacitava: "loading…",
    bezUdaja: "no data",
    agyBezSuboru: "agy does not write usage locally",
    vekNeznamy: "age unknown",
    udajChvila: "updated just now",
    udajMin: (n) => `updated ${n} min ago`,
    udajHodin: (n) => `updated ${n} h ago`,
    udajDni: (n) => `updated ${n} days ago`,
    obnovaO: (cas) => `resets in ${cas}`,
    obnovaDna: (den, cas) => `resets ${den} ${cas}`,
    dni: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    kod: (kod, vystup) => `code ${kod} ${vystup}`,
    usageZlyhala: (dovod) => `automatic refresh of Claude usage failed: ${dovod}`,
    hodin5: "5 hours",
    tyzden: "week",
    den: "day",
    mesiac: "month",
    okno: "window",
  },
  sk: {
    nadpis: "Limity",
    nacitava: "načítava sa…",
    bezUdaja: "bez údaja",
    agyBezSuboru: "agy čerpanie lokálne nezapisuje",
    vekNeznamy: "vek údaja neznámy",
    udajChvila: "údaj spred chvíle",
    udajMin: (n) => `údaj spred ${n} min`,
    udajHodin: (n) => `údaj spred ${n} h`,
    udajDni: (n) => `údaj spred ${n} dní`,
    obnovaO: (cas) => `obnova o ${cas}`,
    obnovaDna: (den, cas) => `obnova ${den} ${cas}`,
    dni: ["ne", "po", "ut", "st", "št", "pi", "so"],
    kod: (kod, vystup) => `kód ${kod} ${vystup}`,
    usageZlyhala: (dovod) => `automatická obnova čerpania Claude zlyhala: ${dovod}`,
    hodin5: "5 hodín",
    tyzden: "týždeň",
    den: "deň",
    mesiac: "mesiac",
    okno: "okno",
  },
};

// Jazyk panelov je jedna zdieľaná hodnota pre všetky mody. Chýbajúca alebo iná hodnota je angličtina.
const KLUC_JAZYKA = "windows-mods.lang";
const jazyk = () => (shared(KLUC_JAZYKA) === "sk" ? "sk" : "en");

// Text v aktuálnom jazyku, číta sa pri kreslení. Funkcii odovzdá hodnoty.
function tx(kluc, ...hodnoty) {
  const text = TEXTY[jazyk()][kluc];
  return typeof text === "function" ? text(...hodnoty) : text;
}

// Prepne jazyk všetkých panelov. setShared prekreslí všetky mody.
const prepniJazyk = () => setShared(KLUC_JAZYKA, jazyk() === "sk" ? "en" : "sk");

// Popisy okien sa v dátach držia po slovensky, rovnako ako ich do agy.json píše skript
// stavového riadku. Do jazyka panela ich prekladá popisOkna pri kreslení.
const POPISY_CLAUDE = { five_hour: TEXTY.sk.hodin5, seven_day: TEXTY.sk.tyzden };
const OBDOBIA = ["hodin5", "tyzden", "den", "mesiac", "okno"];

// Jeden riadok PowerShellu (vzor META_WIN v agents-tree). Vezme 5 najnovších sedení Codexu
// podľa času zmeny, z každého len posledných 20 riadkov, a prvý nájdený posledný záznam
// token_count s rate_limits vypíše ako {"updated": čas zmeny súboru v unix sekundách,
// "rate_limits": …}. Nič iné zo sedenia von nejde, chyby parsovania sa ticho preskočia.
// Bez dvojitých úvodzoviek, aby prešiel argumentom procesu bez úprav.
const CODEX_PS = [
  "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false);",
  "& {",
  "$subory = Get-ChildItem -LiteralPath (Join-Path $HOME '.codex\\sessions') -Recurse -File -Filter 'rollout-*.jsonl' -ErrorAction SilentlyContinue | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 5;",
  "foreach ($f in $subory) {",
  "$riadky = @(Get-Content -LiteralPath $f.FullName -Tail 20 -Encoding UTF8 -ErrorAction SilentlyContinue);",
  "for ($i = $riadky.Count - 1; $i -ge 0; $i--) {",
  "$r = $riadky[$i];",
  "if (-not ($r.Contains('token_count') -and $r.Contains('rate_limits'))) { continue };",
  "try { $o = $r | ConvertFrom-Json -ErrorAction Stop } catch { continue };",
  "if ($o.type -ne 'event_msg' -or $o.payload.type -ne 'token_count' -or -not $o.payload.rate_limits) { continue };",
  "@{ updated = [DateTimeOffset]::new($f.LastWriteTimeUtc).ToUnixTimeSeconds(); rate_limits = $o.payload.rate_limits } | ConvertTo-Json -Compress -Depth 6;",
  "return } } }",
].join(" ");

// Skript pre `node -e`. Spustí `codex app-server`, ohlási sa mu a vypýta si limity účtu
// (account/rateLimits/read, tou istou požiadavkou si ich číta aplikácia Codex). Nevolá model
// a nemíňa tokeny. Vypíše {"updated", "rate_limits": {plan_type, primary, secondary}} a server
// ukončí zatvorením jeho vstupu, po 20 s ho zabije. Cez Node, lebo exec nevie poslať vstup
// a PowerShell 5.1 vkladá pred prvú správu značku BOM, na ktorej server padá.
const CODEX_SERVER_JS = [
  "const server = require('node:child_process').spawn('codex app-server', { shell: true, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });",
  "const NL = String.fromCharCode(10);",
  "const posli = (sprava) => server.stdin.write(JSON.stringify(sprava) + NL);",
  "posli({ id: 0, method: 'initialize', params: { clientInfo: { name: 'limity', version: '1.0.0' } } });",
  "posli({ method: 'initialized' });",
  "posli({ id: 1, method: 'account/rateLimits/read' });",
  "let zvysok = '';",
  "server.stdout.on('data', (kus) => {",
  "const riadky = (zvysok + kus).split(NL); zvysok = riadky.pop();",
  "for (const riadok of riadky) {",
  "let sprava; try { sprava = JSON.parse(riadok); } catch { continue; }",
  "if (sprava.id !== 1) continue;",
  "const l = sprava.result && sprava.result.rateLimits;",
  "if (l) console.log(JSON.stringify({ updated: Math.floor(Date.now() / 1000), rate_limits: { plan_type: l.planType, primary: l.primary, secondary: l.secondary } }));",
  "server.stdin.end(); } });",
  "server.on('exit', () => process.exit(0));",
  "setTimeout(() => { server.kill(); process.exit(1); }, 20000);",
].join(" ");

// Týždenné okná po modeloch (napr. Fable). Stavový riadok ich nedostáva, Claude Code si ich
// odkladá v ~/.claude.json (cachedUsageUtilization, obnoví ho príkaz /usage). Príkaz z toho
// súboru vypíše len percentá a časy obnovy modelových okien v tvare {"updated", "windows"}.
// JavaScriptSerializer preto, že ConvertFrom-Json v PowerShell 5.1 na tom súbore padá.
const CLAUDE_MODELY_PS = [
  "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false);",
  "& { Add-Type -AssemblyName System.Web.Extensions;",
  "$s = New-Object System.Web.Script.Serialization.JavaScriptSerializer; $s.MaxJsonLength = 67108864;",
  "$c = $s.DeserializeObject([IO.File]::ReadAllText((Join-Path $HOME '.claude.json'), [Text.Encoding]::UTF8))['cachedUsageUtilization'];",
  "if (-not $c -or -not $c['utilization']) { return };",
  "$w = @();",
  "foreach ($l in @($c['utilization']['limits'])) {",
  "if (-not $l) { continue };",
  "$sc = $l['scope']; $nm = $null;",
  "if ($sc -and $sc['model'] -and $sc['model']['display_name']) { $nm = [string]$sc['model']['display_name'] } elseif ($l['kind'] -eq 'weekly_all') { $nm = '_all' };",
  "if (-not $nm) { continue };",
  "if ($null -eq $l['percent']) { continue };",
  "$r = $null; if ($l['resets_at']) { $r = ([DateTimeOffset]::Parse([string]$l['resets_at'])).ToUnixTimeSeconds() };",
  "$w += @{ label = $nm; used_percent = [double]$l['percent']; resets_at = $r } };",
  "$u = $null; if ($c['fetchedAtMs']) { $u = [int64]([double]$c['fetchedAtMs'] / 1000) };",
  "@{ updated = $u; windows = $w } | ConvertTo-Json -Compress -Depth 6 }",
].join(" ");

const cislo = (x) => typeof x === "number" && Number.isFinite(x);
const teraz = () => Date.now() / 1000;
const cesta = (meno) => `${home()}/.cache/limity/${meno}`;

function parsuj(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

// Jedno okno limitu: popis, percento čerpania a čas obnovy (unix sekundy alebo null).
const okno = (popis, pct, obnova) => ({ popis, pct, obnova: cislo(obnova) ? obnova : null });

// Všeobecný tvar {"windows": [{label, used_percent, resets_at}]} — agy.json aj claude.json.
function oknaZoZoznamu(windows) {
  if (!Array.isArray(windows)) return [];
  return windows.filter((w) => cislo(w?.used_percent)).map((w) => okno(String(w.label ?? TEXTY.sk.okno), w.used_percent, w.resets_at));
}

// claude.json: každý kľúč rate_limits s číselným used_percentage, k tomu prípadné windows.
function oknaClaude(data) {
  const limity = data?.rate_limits;
  const okna = [];
  if (limity && typeof limity === "object") {
    for (const [kluc, o] of Object.entries(limity)) {
      if (!cislo(o?.used_percentage)) continue;
      okna.push(okno(POPISY_CLAUDE[kluc] ?? kluc.replace(/_/g, " "), o.used_percentage, o.resets_at));
    }
  }
  return okna.concat(oknaZoZoznamu(data?.windows));
}

function popisMinut(minuty) {
  if (minuty === 300) return TEXTY.sk.hodin5;
  if (minuty === 10080) return TEXTY.sk.tyzden;
  return cislo(minuty) ? `${minuty} min` : TEXTY.sk.okno;
}

// Codex: okná primary a secondary, popis podľa dĺžky okna. Uložené sedenia píšu polia
// s podčiarkovníkom (used_percent), app-server v camelCase (usedPercent).
function oknaCodex(limity) {
  return [limity?.primary, limity?.secondary]
    .map((o) => okno(popisMinut(o?.window_minutes ?? o?.windowDurationMins), o?.used_percent ?? o?.usedPercent, o?.resets_at ?? o?.resetsAt))
    .filter((o) => cislo(o.pct));
}

const POPISY_AGY = { weekly: TEXTY.sk.tyzden, "5h": "5 h" };

// agy: výstup `agy -p /usage --output-format json`, skupiny modelov a v nich okná so zostatkom.
// Berú sa len okná Gemini, rovnako ako v skripte stavového riadku (okná 3p-* sa vynechávajú),
// v rovnakom poradí ako v agy.json, teda kratšie okno prvé.
function oknaAgyUsage(data) {
  const okna = [];
  for (const skupina of data?.command?.data?.groups ?? []) {
    const model = String(skupina?.name ?? "").replace(/\s*models$/i, "");
    for (const b of skupina?.buckets ?? []) {
      if (String(b?.id ?? "").startsWith("3p") || !cislo(b?.remaining_fraction)) continue;
      const popis = `${model} ${POPISY_AGY[b.window] ?? b.window ?? TEXTY.sk.okno}`.trim();
      okna.push(okno(popis, (1 - b.remaining_fraction) * 100, Date.parse(b.reset_time) / 1000));
    }
  }
  return okna.sort((a, b) => (a.obnova ?? Infinity) - (b.obnova ?? Infinity));
}

// Údaj zdroja: okná, čas zápisu a plán. Prázdne okná znamenajú „bez údaja",
// `chyba` hovorí prečo ("subor": súbor nie je, "citanie": nedá sa prečítať).
function udaj(data, okna, plan = null) {
  if (!okna.length) return { okna, chyba: "citanie" };
  return { okna, updated: cislo(data?.updated) ? data.updated : null, plan };
}

async function citajSubor(meno, naOkna) {
  try {
    const text = await readTextFile(cesta(meno));
    if (text === null) return { okna: [], chyba: "subor" };
    const data = parsuj(text);
    return udaj(data, naOkna(data));
  } catch {
    return { okna: [], chyba: "citanie" };
  }
}

// Bez argumentov číta uložené sedenia, s `node -e CODEX_SERVER_JS` sa opýta app-servera.
// Oba príkazy vypisujú ten istý tvar {"updated", "rate_limits"}.
async function citajCodex(program = "powershell", argumenty = ["-NoProfile", "-Command", CODEX_PS]) {
  try {
    const r = await exec(program, argumenty);
    const data = r.code === 0 ? parsuj(r.stdout.trim()) : null;
    const plan = typeof data?.rate_limits?.plan_type === "string" ? data.rate_limits.plan_type : null;
    return udaj(data, oknaCodex(data?.rate_limits), plan);
  } catch {
    return { okna: [], chyba: "citanie" };
  }
}

async function citajClaudeModely() {
  try {
    const r = await exec("powershell", ["-NoProfile", "-Command", CLAUDE_MODELY_PS]);
    const data = r.code === 0 ? parsuj(r.stdout.trim()) : null;
    return udaj(data, oknaZoZoznamu(data?.windows));
  } catch {
    return { okna: [], chyba: "citanie" };
  }
}

// agy sa na čerpanie opýta sám seba príkazom /usage. Nevolá model a nemíňa kvótu (0 ťahov, 0 tokenov).
async function citajAgyUsage() {
  try {
    const r = await exec("agy", ["-p", "/usage", "--output-format", "json", "--print-timeout", "1m"], { cwd: home(), timeout: 60000 });
    const data = r.code === 0 ? parsuj(r.stdout.trim()) : null;
    return udaj({ updated: teraz() }, oknaAgyUsage(data));
  } catch {
    return { okna: [], chyba: "citanie" };
  }
}

// Z dvoch zdrojov toho istého nástroja vráti ten s novším údajom, zdroj bez okien prehráva.
function novsi(a, b) {
  if (!b?.okna.length) return a;
  if (!a?.okna.length) return b;
  return (b.updated ?? 0) > (a.updated ?? 0) ? b : a;
}

// „obnova o 2 h 15 min" do 24 h, inak „obnova št 14:20". Bez času alebo v minulosti null.
function textObnovy(obnova) {
  if (!cislo(obnova)) return null;
  const zostava = obnova - teraz();
  if (zostava <= 0) return null;
  if (zostava < 24 * 3600) {
    const min = Math.ceil(zostava / 60), h = Math.floor(min / 60), m = min % 60;
    const casti = [];
    if (h) casti.push(`${h} h`);
    if (m || !h) casti.push(`${m} min`);
    return tx("obnovaO", casti.join(" "));
  }
  const d = new Date(obnova * 1000);
  return tx("obnovaDna", tx("dni")[d.getDay()], `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`);
}

// „údaj spred 3 min", nad hodinu „údaj spred 2 h" tlmenou farbou (stary).
function vekUdaja(updated) {
  if (!cislo(updated)) return { text: tx("vekNeznamy"), stary: true };
  const min = Math.floor(Math.max(0, teraz() - updated) / 60);
  if (min < 1) return { text: tx("udajChvila"), stary: false };
  if (min <= STARY_UDAJ_MIN) return { text: tx("udajMin", min), stary: false };
  const h = Math.floor(min / 60);
  const text = h < 48 ? tx("udajHodin", h) : tx("udajDni", Math.floor(h / 24));
  return { text, stary: true };
}

// Popis okna v jazyku panela. Prekladá sa celý popis alebo slovo obdobia na jeho konci
// („Gemini týždeň" → „Gemini week"), ostatné (názvy modelov, „300 min") ostáva.
function popisOkna(popis) {
  for (const kluc of OBDOBIA) {
    const sk = TEXTY.sk[kluc];
    if (popis === sk || popis.endsWith(` ${sk}`)) return popis.slice(0, popis.length - sk.length) + tx(kluc);
  }
  return popis;
}

// Dôvod zlyhania obnovy čerpania Claude: kód a chybový výstup programu, alebo správa výnimky.
const dovodChyby = (chyba) => (chyba.kod === null ? chyba.vystup : tx("kod", chyba.kod, chyba.vystup));

// Prepínač jazyka panelov v hlavičke: kód aktuálneho jazyka, klik prepne na druhý.
function tlacidloJazyka(t) {
  return div().id("limity-jazyk").flex_none().h(20).px(6).flex().items_center().rounded(5).text_size(10).cursor_pointer()
    .border_1().border_color(t.input).text_color(t.muted).hover((s) => s.bg(t.hover))
    .on_click(() => prepniJazyk())
    .child(jazyk().toUpperCase());
}

// Bežná farba témy, výstražná (blocked, ako varovania v dodávaných modoch), kritická (ansi1, červená).
function farbaPruhu(pct, t) {
  if (pct >= KRITICKE_PCT) return t.ansi1;
  if (pct >= VYSTRAHA_PCT) return t.blocked;
  return t.accent;
}

const maly = (text, farba) => div().text_size(10).text_color(farba).child(text);

// Riadok okna: popis, pruh podľa percenta a číslo, pod ním menším písmom čas obnovy.
function riadokOkna(o, t, bezObnovy = false) {
  const pct = Math.min(100, Math.max(0, o.pct));
  const obnova = bezObnovy ? null : textObnovy(o.obnova);
  return v_flex().gap(2)
    .child(h_flex().gap(6).items_center()
      .child(div().w(72).flex_none().truncate().text_color(t.muted).child(popisOkna(o.popis)))
      .child(div().flex_1().min_w(0).max_w(64).h(5).rounded(3).overflow_hidden().bg(t.border)
        .child(div().h_full().w(`${pct}%`).rounded(3).bg(farbaPruhu(pct, t))))
      .child(div().flex_none().min_w(32).text_right().child(`${Math.round(o.pct)} %`)))
    .when(Boolean(obnova), (el) => el.child(maly(obnova, t.dim)));
}

// Sekcia jedného nástroja: názov (pri Codexe aj plán), vek údaja a riadok na každé okno.
function sekcia(nazov, zdroj, t, poznamkaBezSuboru = null) {
  const hlavicka = h_flex().gap(6).items_center()
    .child(div().font_semibold().child(nazov))
    .when(Boolean(zdroj?.plan), (el) => el.child(maly(zdroj.plan, t.dim)));
  if (!zdroj) return v_flex().gap(2).child(hlavicka).child(maly(tx("nacitava"), t.dim));
  if (!zdroj.okna.length) {
    return v_flex().gap(2).child(hlavicka).child(div().text_color(t.muted).child(tx("bezUdaja")))
      .when(Boolean(poznamkaBezSuboru) && zdroj.chyba === "subor", (el) => el.child(maly(poznamkaBezSuboru, t.dim)));
  }
  const vek = vekUdaja(zdroj.updated);
  return v_flex().gap(7)
    .child(v_flex().gap(2).child(hlavicka).child(maly(vek.text, vek.stary ? t.dim : t.muted)))
    .children(zdroj.okna.map((o, i) => riadokOkna(o, t, rovnakaObnova(o, zdroj.okna[i - 1]))));
}

// Okno s tým istým časom obnovy ako riadok nad ním (rozdiel do 2 min) čas neopakuje.
function rovnakaObnova(o, predosle) {
  return Boolean(predosle) && cislo(o.obnova) && cislo(predosle.obnova) && Math.abs(o.obnova - predosle.obnova) < 120;
}

// Claude: týždenné okno a hneď pod ním okná po modeloch (Fable). Týždeň je v oboch zdrojoch
// (stavový riadok aj odložený údaj, tam pod značkou "_all"), berie sa ten čerstvejší.
// Vek sekcie je vek najstaršieho zobrazeného údaja.
function spojClaude(hlavny, modely) {
  const odlozene = modely?.okna ?? [];
  const tyzden = odlozene.find((o) => o.popis === "_all");
  const extra = odlozene.filter((o) => o.popis !== "_all");
  const maHlavny = Boolean(hlavny?.okna.length);
  const odlozenyJeNovsi = !maHlavny || !cislo(hlavny.updated) || (cislo(modely?.updated) && modely.updated >= hlavny.updated);
  if (tyzden && odlozenyJeNovsi) return { okna: [{ ...tyzden, popis: TEXTY.sk.tyzden }, ...extra], updated: modely.updated };
  if (!maHlavny) return extra.length ? { okna: extra, updated: modely.updated } : hlavny;
  if (!extra.length) return hlavny;
  const casy = [hlavny.updated, modely.updated].filter(cislo);
  return { okna: [...hlavny.okna, ...extra], updated: casy.length ? Math.min(...casy) : null };
}

export default class Limity extends View {
  init(_props, cx) {
    // Pri `herdr-app check` nič nečítať a nespúšťať.
    if (checking()) return;
    this.obnovSubory(cx);
    this.obnovCodex(cx);
    cx.timer.every(SUBORY_KAZDYCH_MS, (cx) => this.obnovSubory(cx));
    cx.timer.every(CODEX_KAZDYCH_MS, (cx) => this.obnovCodex(cx));
    this.obnovUsage(cx);
    this.obnovKvoty(cx);
    cx.timer.every(KVOTY_KAZDYCH_MS, (cx) => this.obnovKvoty(cx));
  }

  // Volá sa pri každom 15-sekundovom takte. Zapamätá si, že v Herdri pracoval niektorý agent,
  // a čerpanie nechá stiahnuť, keď od posledného stiahnutia ubehlo 5 minút a agent medzitým
  // pracoval (teda aj hneď po spustení práce a raz po jej skončení), alebo keď ubehla hodina.
  // Počíta sa každý agent, nielen Claude. Codex a agy si Claude spúšťajú ako pomocníka
  // (`claude -p`), ktorý čerpá limit Claude, ale v zozname agentov ho nevidno.
  skontrolujUsage(cx) {
    const pracuje = agents().some((a) => a.status === "working" || a.status === "blocked");
    if (pracuje) this.agentAktivny = true;
    const od = Date.now() - (this.usageKedy ?? 0);
    if (od >= USAGE_NAJVIAC_MS || (this.agentAktivny && od >= USAGE_KAZDYCH_MS)) this.obnovUsage(cx);
  }

  // Spustí `claude -p /usage` bez rozhovoru: Claude Code si vlastným prihlásením stiahne
  // čerpanie a odloží ho do ~/.claude.json, odkiaľ ho číta citajClaudeModely. Nevolá model,
  // neukladá sedenie a nespúšťa MCP servery. Výstup sa nepoužíva, chyba sa ticho preskočí.
  obnovUsage(cx) {
    if (this.usageBezi) return;
    this.usageBezi = true;
    this.usageKedy = Date.now();
    this.agentAktivny = false;
    cx.spawn(async (cx) => {
      try {
        const r = await exec("claude", ["-p", "/usage", "--no-session-persistence", "--strict-mcp-config"], { cwd: home(), timeout: 60000 });
        // Dôvod sa skladá do textu až pri kreslení, aby sa riadil jazykom panela (dovodChyby).
        this.usageChyba = r.code === 0 ? null : { kod: r.code, vystup: String(r.stderr ?? "").trim().slice(0, 160) };
        this.claudeModely = await citajClaudeModely();
      } catch (e) {
        this.usageChyba = { kod: null, vystup: String(e?.message ?? e).slice(0, 160) };
      }
      finally { this.usageBezi = false; cx.notify(); }
    });
  }

  // claude.json a agy.json; každý takt zároveň prekreslí vek údajov.
  obnovSubory(cx) {
    this.skontrolujUsage(cx);
    cx.spawn(async (cx) => {
      this.claude = await citajSubor("claude.json", oknaClaude);
      this.agy = await citajSubor("agy.json", (data) => oknaZoZoznamu(data?.windows));
      cx.notify();
    });
  }

  obnovCodex(cx) {
    if (this.codexBezi) return;
    this.codexBezi = true;
    cx.spawn(async (cx) => {
      try {
        this.codex = await citajCodex();
        // Okná po modeloch majú vlastný vek, čítajú sa v tom istom minútovom takte.
        this.claudeModely = await citajClaudeModely();
      }
      finally { this.codexBezi = false; cx.notify(); }
    });
  }

  // Čerstvé čerpanie Codexu a agy priamo od ich programov, bez volania modelu. Dopĺňa lokálne
  // zdroje, ktoré sa obnovia len pri interaktívnej práci (uložené sedenie Codexu, stavový riadok
  // agy). Behy `codex exec --ephemeral` a `agy -p` spustené spod Claude by inak v paneli chýbali.
  obnovKvoty(cx) {
    if (this.kvotyBezia) return;
    this.kvotyBezia = true;
    cx.spawn(async (cx) => {
      try {
        this.codexServer = await citajCodex("node", ["-e", CODEX_SERVER_JS]);
        this.agyUsage = await citajAgyUsage();
      }
      finally { this.kvotyBezia = false; cx.notify(); }
    });
  }

  render() {
    const t = theme();
    return v_flex().id("limity").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(11)
      .child(h_flex().h(32).flex_none().px(10).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().flex_1().font_semibold().child(tx("nadpis")))
        .child(tlacidloJazyka(t)))
      .child(v_flex().id("limity-obsah").flex_1().min_h(0).overflow_y_scrollbar().p(10).gap(14)
        .child(sekcia("Claude", spojClaude(this.claude, this.claudeModely), t))
        .when(Boolean(this.usageChyba), (el) => el.child(maly(tx("usageZlyhala", dovodChyby(this.usageChyba)), t.dim)))
        .child(sekcia("Codex", novsi(this.codex, this.codexServer), t))
        .child(sekcia("agy", novsi(this.agy, this.agyUsage), t, tx("agyBezSuboru"))));
  }
}
