# Herdr mody — strom agentov, Limity, História a Pás

Vlastné mody a rozloženia pre [Herdr App](https://github.com/herdrdev/herdr-app) na Windows.

[English](README.md) | **Slovenčina**

## Skôr než začneš

- Len Windows 10 a 11. Panely čítajú dáta cez Windows PowerShell 5.1.
- Zverejnené tak, ako to používame, bez záruky a bez podpory.
- Panely sú predvolene po anglicky, Limity a História sa vtedy volajú Limits a History. Tlačidlo EN/SK v týchto dvoch paneloch ich prepne do slovenčiny. Správy inštalátora sú po slovensky.
- Mody v Herdri bežia bez obmedzení pod tvojím účtom. Čo ktorý číta a spúšťa, je v časti 4.
- Tri príkazy panela Limity sa pripájajú na servery cez tvoje prihlásené programy. `claude -p /usage` pri otvorení panela, kým v Herdri pracuje niektorý agent najviac raz za 5 minút, inak raz za hodinu. `codex app-server` a `agy -p /usage` pri otvorení panela a potom raz za hodinu. Model sa pri nich nevolá.

## 1. Čo to je

Päť modov v `mods\` a jedno rozloženie `pasova-vyroba` v `layouts\`. Pracovné rozloženie `vychytavky` je v `doplnky\vychytavky.json`. Inštalátor nainštaluje obe rozloženia.

| Kus | Čo robí |
|---|---|
| `agents-tree` | Panel Agents ako dodávaný, navyše ukáže subagentov Claude Code a príkazy na pozadí ako riadky pod agentom a vnoreného subagenta pod jeho rodičom. V záhlaví panela sú súčty — agenti podľa stavu a jedno číslo `sub` za subagentov a príkazy na pozadí, ktoré pracujú alebo čakajú. |
| `limity` | Panel Limity ukáže čerpanie predplatného Claude, Codexu a agy v percentách aj s časom obnovy. |
| `historia` | Panel História so zoznamom minulých rozhovorov Claude Code, Codexu a agy pre aktuálny priečinok, s hľadaním v názvoch a prepínačom „všade" pre všetky priečinky. |
| `pas` | Pásová výroba na predvádzanie. Agenti sú roboti, ktorí podľa stavu prechádzajú zónami Depo, Pás a Výstup. |
| `panely` | Horná lišta s kartami ako dodávaná, so štyrmi tlačidlami panelov Files, Changes, Limity a História. |
| `vychytavky` | Pracovné rozloženie. Je to kópia dodávaného `main`, v ktorej sú tieto mody. |
| `pasova-vyroba` | To isté rozloženie s pásom nad terminálmi. |

Okrem rozloženia `vychytavky` sú v `doplnky\` skripty stavového riadku pre Claude Code a agy, ktoré zapisujú údaje pre panel Limity, a tri rozdiely (`.diff`) na obnovu modu `agents-tree` po aktualizácii Herdru.

[RECIPE.md](RECIPE.md) je recept rozloženia `pasova-vyroba` vo formáte galérie Herdru, po anglicky. Podľa neho vie agent postaviť to isté rozloženie v prázdnom priečinku.

Pôvod kódu a licencie sú v [POVOD.md](POVOD.md).

## 2. Požiadavky

- Windows 10 alebo 11 (vyskúšané na Windows 11).
- Herdr App 0.1.18 a herdr-core 0.1.22. Na týchto verziách mody bežia, inštalátor bol vyskúšaný na 0.1.16 a 0.1.21. Na iných sa môže niečo rozbiť.
- Claude Code v termináli, aspoň 2.1.329, spustiteľný ako `claude`. Staršia verzia neposiela záznamy o príkazoch na pozadí.
- Windows PowerShell 5.1, ktorý je súčasťou Windows.
- Voliteľne Codex CLI (`codex`) a Antigravity CLI (`agy`). Node.js (`node`) potrebuje stavový riadok agy a panel Limity na hodinové čítanie limitov Codexu.

Na macOS a Linuxe História a Limity nepôjdu, lebo dáta čítajú cez PowerShell. Strom agentov, Pás a lišta by tam ísť mali, vyskúšané to nie je.

## 3. Inštalácia

1. Herdr App aspoň raz spusti. Vznikne priečinok `%USERPROFILE%\.config\herdr-app` s podpriečinkami `mods` a `layouts`.
2. Stiahni si tento repozitár (Code, Download ZIP, alebo `git clone`) a rozbaľ ho kamkoľvek, napríklad do `Downloads\herdr-windows-mods`.
3. Prečítaj si kód, prípadne aspoň časť 4. Mody v Herdri bežia bez obmedzení.
4. Otvor PowerShell v rozbalenom priečinku a spusti

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\instalacia.ps1
   ```

   Skript skopíruje päť modov a dve rozloženia do `%USERPROFILE%\.config\herdr-app`. Čo tam už je, preskočí a povie to. Pri odinštalovaní nechá na mieste mod alebo rozloženie, ktoré sa líši od balíčka (časť 8). Nič iné nemení — nastavenia Herdru ani Claude Code, sieť ani iné programy. Iný priečinok Herdru zadáš parametrom `-HerdrHome "D:\cesta\herdr-app"`.
5. V Herdri stláčaj Ctrl+Shift+L, kým sa neukáže rozloženie `vychytavky`. Ide to aj príkazom `herdr-app do layout.switch --name vychytavky`. Terminály prepnutie neovplyvní. Ak sa nové rozloženie neukáže, Herdr zavri a znova otvor.
6. Over, že sa nič nepokazilo. Pole `errors` vo výpise má byť prázdne.

   ```powershell
   herdr-app status | Out-String
   ```

   Bez `| Out-String` PowerShell na výpis nepočká. Ak `herdr-app` nie je v PATH, je v `%LOCALAPPDATA%\Programs\herdr-app\herdr-app.exe`.
7. Voliteľne zapoj stavové riadky pre panel Limity (časť 5).

## 4. Čo ktorý mod číta a spúšťa

`~` je tvoj domovský priečinok (`%USERPROFILE%`). Mod začne bežať, keď sa jeho panel prvýkrát zobrazí. Potom beží, kým je rozloženie zobrazené, aj keď panel skryješ.

| Kus | Čo číta | Čo spúšťa | Čo zapisuje |
|---|---|---|---|
| `agents-tree` | Údaje Herdru o agentoch, termináloch a priestoroch. Pri novom subagentovi Claude Code `~\.claude*\sessions\<pid>.json` (len `sessionId`) a `~\.claude*\projects\*\<sessionId>\subagents\agent-*.meta.json` (rodič a popis subagenta). `.claude*` je každý priečinok v `~`, ktorého meno začína na `.claude`. | Na Windows `powershell -NoProfile -Command …` pri každom novom subagentovi, kým súbor nenájde, najviac 6 pokusov. Pre agenta na inom počítači `sh -c …` cez Herdr na tom počítači. Príkazy Herdru `pane.focus`, `terminal.peek`, `terminal.pin`, `layout.resize`. | Vlastné úložisko modu v Herdri (kedy sa zmenil stav agenta, pripnutia) a zdieľané hodnoty Herdru `agents.sort`, `sidebar.width` a `sidebar.collapsed`, rovnako ako dodávaný `agents`. |
| `limity` | Každých 15 s `~\.cache\limity\claude.json` a `~\.cache\limity\agy.json`. Každú minútu posledných 20 riadkov z 5 najnovších `~\.codex\sessions\**\rollout-*.jsonl` (len posledný záznam `rate_limits`) a `~\.claude.json`. Ten načíta celý, je v ňom aj e-mail účtu a nastavenia, do panela pustí len percentá a časy obnovy z `cachedUsageUtilization`. | Na čítanie Codexu a `~\.claude.json` `powershell -NoProfile -Command …`. Navyše `claude -p /usage --no-session-persistence --strict-mcp-config` v `~` — pri otvorení panela, kým v Herdri pracuje niektorý agent najviac raz za 5 minút, inak raz za hodinu. Claude Code si pri tom vlastným prihlásením stiahne čerpanie zo serverov Anthropicu a odloží ho do `~\.claude.json`. Nevolá model, neukladá sedenie a nespúšťa MCP servery. Pri otvorení panela a potom raz za hodinu ešte `node -e …`, ktorý spustí `codex app-server` a vypýta si od neho limity účtu (požiadavka `account/rateLimits/read`), a `agy -p /usage --output-format json --print-timeout 1m` v `~`. Codex aj agy sa pri tom pripájajú na svoje servery vlastným prihlásením, model nevolajú a tokeny nemíňajú. | Po kliku na tlačidlo jazyka zdieľanú hodnotu Herdru `windows-mods.lang`. Nič iné. |
| `historia` | V bežnom režime raz za minútu, v režime „všade" raz za 5 minút. Claude — `~\.claude\sessions\*.json` (ktoré sedenia bežia) a prepisy `~\.claude\projects\<priečinok>\*.jsonl` (koniec súboru kvôli názvu, začiatok kvôli prvej správe a pôvodnému priečinku). Codex — `~\.codex\session_index.jsonl` a prvý riadok `~\.codex\sessions\**\rollout-*.jsonl`, bez názvu aj začiatok prepisu. agy — v `~\.gemini\antigravity-cli` súbory `history.jsonl`, `cache\conversation_metadata.json`, `annotations\<id>.pbtxt`, prvý riadok `brain\<id>\.system_generated\logs\transcript.jsonl` a časy súborov `conversations\*.db`. Z obsahu rozhovorov ide do panela len názov alebo prvých 60 znakov prvej správy. | Na čítanie jeden príkaz `powershell -NoProfile -Command …` s limitom 30 s. Zisťuje v ňom aj bežiace procesy (`Get-Process`). Po kliku na rozhovor novú kartu alebo priestor s `claude --resume <id>`, `codex resume --no-daemon <id>` alebo `agy --conversation <id>`. | Po kliku na tlačidlo jazyka zdieľanú hodnotu Herdru `windows-mods.lang`. Nič iné. |
| `pas` | Len údaje Herdru o agentoch, termináloch a priestoroch a zdieľanú hodnotu Herdru `windows-mods.lang`. | Len príkazy Herdru `pane.focus` a `terminal.peek` po kliku. | Nič. |
| `panely` | Údaje Herdru o kartách, priestoroch a rozložení a zdieľanú hodnotu Herdru `windows-mods.lang`. | Príkazy Herdru pre karty, panely a okno. | Vlastné úložisko modu (ktorý panel bol otvorený v ktorom priestore), rovnako ako dodávaný `tabs`. |
| `doplnky\statusline-limity.ps1` | Vstup, ktorý Claude Code posiela stavovému riadku. | Nič. | `~\.cache\limity\claude.json` (len `rate_limits` a čas zápisu). |
| `doplnky\agy-statusline.mjs` | Vstup, ktorý agy posiela stavovému riadku. | Nič. | `~\.cache\limity\agy.json` (len percentá a časy obnovy) alebo súbor z premennej `AGY_LIMITS_FILE`. |
| `instalacia.ps1` | Priečinky `mods` a `layouts` Herdru. | Nič. | Kopíruje svoje mody a rozloženia. Pri `-Odinstaluj -Potvrdit` maže len tie, ktoré sú zhodné s balíčkom, rozloženie aj s jeho stavom v `layouts\.state`. S `-AjZmenene` maže aj tie, ktoré sa od balíčka líšia. |

Žiadny mod ani skript sám nevolá sieť a nečíta prihlasovacie súbory (`~\.claude\.credentials.json`, `~\.codex\auth.json`, tokeny agy). Von vedú len tri príkazy panela Limity — `claude -p /usage`, `codex app-server` a `agy -p /usage`. Na server sa pri nich pripája Claude Code, Codex alebo agy so svojím prihlásením, nie mod. Klik v Histórii spustí Claude Code, Codex alebo agy, ktoré potom pracujú ako zvyčajne.

Mody v Herdri bežia ako bežný program pod tvojím účtom, bez obmedzení. Pred inštaláciou si preto kód prečítaj. Je v súboroch `main.js` a `art.js`, spolu asi 2 300 riadkov. PowerShell je v nich ako reťazce `META_WIN`, `CODEX_PS`, `CLAUDE_MODELY_PS` a `HISTORIA_PS`, skript pre Node ako `CODEX_SERVER_JS`.

## 5. Limity — nastavenie

### Claude

Týždenné okno a päťhodinové okno, ak ho predplatné má, berie panel zo súboru `~\.cache\limity\claude.json`. Ten zapisuje stavový riadok Claude Code. Claude Code posiela stavovému riadku údaje o limitoch len pri predplatnom Pro, Max alebo Ultra a až po prvej odpovedi v sedení. Rozšírenie Claude Code vo VS Code stavový riadok nespúšťa, údaj sa preto obnovuje len pri práci v termináli.

**Cesta A — priložený stavový riadok.** Kreslí model, lištu kontextu a priečinok na dvoch riadkoch.

1. Skopíruj `doplnky\statusline-limity.ps1` do `%USERPROFILE%\.claude\statusline-limity.ps1`.
2. V `%USERPROFILE%\.claude\settings.json` doplň alebo nahraď kľúč `statusLine`. `<meno>` je tvoje meno používateľa vo Windows. Ak je v ceste medzera, daj ju do úvodzoviek, v JSON ako `\"…\"`.

   ```json
   "statusLine": {
     "type": "command",
     "command": "powershell -NoProfile -ExecutionPolicy Bypass -File C:/Users/<meno>/.claude/statusline-limity.ps1"
   }
   ```

3. Spusti nové sedenie Claude Code v termináli. Po prvej odpovedi vznikne `~\.cache\limity\claude.json`.

**Cesta B — vlastný stavový riadok.** Ak už stavový riadok v PowerShelli máš, vlož doň blok z `doplnky\statusline-limity-vlozka.ps1` hneď za riadok, ktorý načíta vstup do premennej `$data`. Ak je v inom jazyku, zapisuj do `~\.cache\limity\claude.json` to isté — `{"updated": <unix sekundy>, "rate_limits": <rate_limits zo vstupu>}`.

**Modely s vlastným limitom.** Ak má tvoje predplatné pre niektorý model vlastný týždenný limit, panel ho ukáže sám ako ďalší riadok pod týždňom. Berie ho z `cachedUsageUtilization` v `~\.claude.json`, ktorý Claude Code obnoví pri príkaze `/usage`. Preto panel občas spustí `claude -p /usage` (časť 4). Pole nie je zdokumentované a môže sa zmeniť. Odtiaľ panel vezme aj týždeň, keď je čerstvejší než údaj zo stavového riadku. Bez stavového riadku teda uvidíš týždeň aj modely, len nie päťhodinové okno.

### Codex

Netreba nič nastavovať. Panel číta posledný záznam o limitoch v najnovších sedeniach Codexu (`~\.codex\sessions`) a ukáže plán a okná, ktoré Codex zapisuje. Pri otvorení a potom raz za hodinu sa navyše opýta priamo Codexu (`codex app-server`), aby bol údaj čerstvý aj po behoch, ktoré sedenie neukladajú (`codex exec --ephemeral`). Na to treba `codex` a `node` v PATH, bez nich ostáva len údaj zo sedení.

### agy

Bez nastavenia sa panel pri otvorení a potom raz za hodinu opýta agy príkazom `agy -p /usage` (treba `agy` v PATH). Model sa pri tom nevolá a kvóta sa nemíňa. Ak podmienky tvojho účtu alebo programu automatické volania agy zakazujú, hodinové čítanie vypni — v `mods\limity\main.js` vo funkcii `obnovKvoty` zmaž riadok s `citajAgyUsage`.

Stavový riadok je voliteľný a údaj obnovuje priebežne počas práce v agy.

1. Skopíruj `doplnky\agy-statusline.mjs` do `%USERPROFILE%\.gemini\antigravity-cli\statusline.mjs`.
2. V agy zadaj

   ```
   /statusline node C:/Users/<meno>/.gemini/antigravity-cli/statusline.mjs
   ```

3. Vypnutie je `/statusline delete`.

agy na Windows delí príkaz stavového riadku len podľa medzier a úvodzovky nepomôžu. Cesta ku skriptu preto nesmie obsahovať medzery. Ak ich má tvoje meno používateľa, daj skript napríklad do `C:\herdr\agy-statusline.mjs`. Skript vypíše režim, model a zaplnenie kontextu. `~\.cache\limity\agy.json` zapíše, len keď agy pošle údaje o kvóte, a okná modelov tretích strán (kľúč začína na `3p`) vynechá.

## 6. Ako sa to používa

- Rozloženia prepína Ctrl+Shift+L. `vychytavky` je na prácu, `pasova-vyroba` na ukazovanie, `main` je dodávané. Terminály a agenti prepnutím nič nestratia.
- Tlačidlá Files, Changes, Limity a História sú vpravo v hornej lište. Klik panel otvorí, druhý ho zavrie. Lišta si pamätá otvorený panel pre každý priestor zvlášť. Changes sa dá skryť na uvítacej obrazovke (paleta príkazov Ctrl+Shift+P, Welcome). Limity a História sú zapnuté natvrdo.
- V paneli Agents sú subagenti a príkazy na pozadí riadky pod agentom. Klik na taký riadok zameria terminál agenta. Po skončení riadok zmizne. Príkaz na pozadí sa volá podľa popisu, ktorý mu dal Claude.
- História ukazuje rozhovory pre priečinok aktívneho terminálu, ten istý ako panel Files. Pole „hľadať v názvoch…" filtruje počas písania v názvoch rozhovorov a programov, bez ohľadu na veľkosť písmen a diakritiku. Klávesnicu berie až po kliknutí doň, Esc ho vymaže. Klik na rozhovor ho obnoví v novej karte aktuálneho priestoru. Bežiaci rozhovor Claude je označený „beží" a otvoriť sa nedá, aby do jedného záznamu nepísali dva programy.
- Prepínač „všade" načíta až 500 najnovších rozhovorov zo všetkých priečinkov okrem dočasných (`%TEMP%`), ukáže ich 40 a pri riadku napíše názov priečinka. Hľadá sa aj podľa neho. Klik otvorí rozhovor v jeho pôvodnom priečinku a v priestore, ktorý k nemu patrí. Najprv hľadá priestor pomenovaný ako priečinok, potom priestor, v ktorom v tom priečinku beží najviac terminálov, inak založí nový priestor.
- V Páse klik na robota zameria terminál agenta a klik na pracovníka `hc run` ho otvorí v náhľade. Na ukážku bez agentov doplň do bloku `pas` v `pasova-vyroba.json` vlastnosť `"props": { "demo": true }`.
- Malé tlačidlo EN/SK prepína texty panelov medzi angličtinou a slovenčinou. Je v hlavičke panela Limity a v paneli História vedľa prepínača „všade" a ukazuje aktuálny jazyk. Voľba platí naraz pre Limity, Históriu, Pás a tlačidlá Limity a História v lište a Herdr si ju pamätá v zdieľanej hodnote `windows-mods.lang`. Panely Agents, Files a Changes a tlačidlá Files a Changes ostávajú po anglicky, rovnako ako dodávané.

## 7. Známe obmedzenia

- `agents-tree` a `panely` sú kópie dodávaných modov `agents` a `tabs` z Herdr App 0.1.16 a `vychytavky` je kópia rozloženia `main`. S aplikáciou sa neaktualizujú. Po aktualizácii Herdru im môžu chýbať novinky alebo sa rozbijú. Mod `agents-tree` sa dá obnoviť — premenuj starý, naklonuj dodávaný príkazom `herdr-app do mod.clone --name agents --as agents-tree` a v jeho priečinku aplikuj `git apply -p4 <cesta>\doplnky\pr1212-mainjs.diff` potom `git apply -p1 <cesta>\doplnky\windows-vnorenie.diff` a potom `git apply -p1 <cesta>\doplnky\zahlavie-sucty.diff`. Ak bude oprava #1212 v Herdri medzitým zlúčená, stačí druhý a tretí rozdiel.
- História Codexu siaha len pár dní dozadu. Staršie vlákna si Codex zbalí (`.jsonl.zst`, staršie než asi 6 dní) a panel ich nečíta.
- „beží" je pri Codexe a agy len odhad podľa toho, či sa rozhovor zmenil za posledné 2 minúty. Nečinný rozhovor otvorený v inej karte sa dá kliknúť a otvoril by druhú kópiu.
- História hľadá len v názvoch, nie v obsahu rozhovorov. Pre priečinky na inom počítači nefunguje.
- Pás nekreslí vnorenie. Všetci subagenti stoja ako menší roboti pri hlavnom. Nečinný agent, ktorému ešte pracujú subagenti, stojí aj s nimi v Depe. Samotný pás je kreslený znakmi písma Cascadia Mono, ktoré prichádza s Windows Terminal. Bez neho môže pás vyzerať inak.
- Limity Codexu a agy sa obnovia pri práci s nimi v termináli, pri otvorení panela a raz za hodinu. Medzi tým môže byť údaj až hodinu starý. Panel ukazuje vek údaja a údaj starší než hodinu píše tlmenou farbou.
- Zatvorenie poslednej karty zatvorí celý priestor a Herdr zatvorené priestory nikde neponúka. V dôležitých priestoroch preto nechaj otvorenú kartu s PowerShellom. Toto je správanie Herdru, nie modov.
- História obnovuje rozhovor Codexu príkazom `codex resume --no-daemon <id>`, rovnako ako ho spúšťa Herdr. Ak tvoj Codex prepínač `--no-daemon` nepozná, nová karta skončí chybou. Aktualizuj Codex, alebo v `mods\historia\main.js` v konštante `OBNOVENIE` zmaž `"--no-daemon", `. Herdr mod po uložení sám načíta znova.

## 8. Odinštalovanie

1. V Herdri sa prepni na `main` (Ctrl+Shift+L).
2. Spusti `powershell -ExecutionPolicy Bypass -File .\instalacia.ps1 -Odinstaluj`. Vypíše, čo by zmazal a čo nechá na mieste, a nič nezmaže.
3. Spusti `powershell -ExecutionPolicy Bypass -File .\instalacia.ps1 -Odinstaluj -Potvrdit`. Zmaže len mody a rozloženia, ktoré sú zhodné s balíčkom, rozloženie aj s jeho uloženým stavom v `layouts\.state`. Mod, ktorého `main.js` sa líši od balíčka (upravený alebo cudzí mod s rovnakým menom, ktorý tam bol už pred inštaláciou), a rozloženie, ktoré sa líši od balíčka, nechá na mieste a vypíše ich ako ponechané.
4. Ak chceš zmazať aj ponechané, pridaj prepínač `-AjZmenene` — `powershell -ExecutionPolicy Bypass -File .\instalacia.ps1 -Odinstaluj -AjZmenene -Potvrdit`.
5. Stavový riadok vráť ručne — v `~\.claude\settings.json` kľúč `statusLine`, v agy `/statusline delete`. Priečinok `~\.cache\limity` môžeš zmazať.

## 9. Riešenie problémov

- **Tlačidlá Limity a História chýbajú.** Nie je zobrazené rozloženie `vychytavky` ani `pasova-vyroba`. Prepni ho cez Ctrl+Shift+L. Ak inštalátor mod `panely` preskočil, lebo už existoval, rozloženie používa ten existujúci.
- **Panel je prázdny alebo píše „históriu sa nepodarilo načítať".** Spusti `herdr-app status | Out-String` a pozri pole `errors`. Mod skontroluješ príkazom `herdr-app check "$HOME\.config\herdr-app\mods\historia" | Out-String`. História aj Limity potrebujú `powershell` v PATH. Pri veľmi veľa rozhovoroch môže čítanie prekročiť limit 30 s.
- **Limity ukazujú „bez údaja".** Pri Claude chýba `~\.cache\limity\claude.json` (stavový riadok nie je zapojený alebo v termináli ešte neprišla odpoveď) a `claude -p /usage` nič neodložilo. Hláška „automatická obnova čerpania Claude zlyhala" znamená, že Herdr nenašiel `claude` v PATH alebo príkaz skončil chybou. Pri Codexe ešte nie je žiadne sedenie s údajom o limitoch a hodinové čítanie zlyhalo (chýba `codex` alebo `node` v PATH, alebo Codex nie je prihlásený). Pri agy nie je zapojený stavový riadok z `doplnky` a zlyhalo `agy -p /usage` (chýba `agy` v PATH alebo nie je prihlásený).
- **Pod agentom nevidno subagentov ani príkazy na pozadí.** Claude Code pod 2.1.329 príkazy na pozadí neposiela. Ak sú subagenti naplocho a nie pod svojím rodičom, nepodarilo sa prečítať súbory `agent-*.meta.json` cez PowerShell.
- **Po aktualizácii Herdru je niečo rozbité.** Prepni sa na dodávané rozloženie `main` (Ctrl+Shift+L), terminály ostanú. Potom pozri `herdr-app status | Out-String` a podľa časti 7 obnov `agents-tree`.
- **Odinštalovanie nechalo mod alebo rozloženie na mieste.** Líši sa od balíčka. Je to upravený mod alebo rozloženie, alebo cudzí mod s rovnakým menom, ktorý tam bol už pred inštaláciou. Zmažeš ho prepínačom `-AjZmenene` (časť 8).

## Licencia

Apache License 2.0, pozri [LICENSE](LICENSE) a [NOTICE](NOTICE). Copyright 2026 Kryptology s. r. o. Pôvod cudzieho kódu je v [POVOD.md](POVOD.md).
