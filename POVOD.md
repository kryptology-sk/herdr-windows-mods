# Pôvod kódu a licencie

Časť balíčka je odvodená z cudzieho kódu. Ten si drží svoju licenciu. Vlastný kód balíčka je pod licenciou Apache 2.0, autor a držiteľ práv je Kryptology s. r. o.

## Odvodené z Herdr App

Herdr App je v repozitári [herdrdev/herdr-app](https://github.com/herdrdev/herdr-app) pod licenciou Apache 2.0. Doklad je súbor `LICENSE` v inštalácii aplikácie (`%LOCALAPPDATA%\Programs\herdr-app\LICENSE`) a licencia repozitára na GitHube.

| Kus | Z čoho | Zmeny v balíčku |
|---|---|---|
| `mods\agents-tree` | klon dodávaného modu `agents` z Herdr App 0.1.16 (`cloned_from` v `mod.json`) | Zmeny z otvorenej žiadosti o zlúčenie [#1212](https://github.com/herdrdev/herdr-app/pull/1212) „fix: the agents list shows what an agent runs in its own process", autor `dkremsa`. Z nej je len časť pre `defaults/mods/agents/main.js`, je v `doplnky\pr1212-mainjs.diff`. Navyše vlastný doplnok pre Windows (konštanta `META_WIN` a vetva v `loadMeta`), je v `doplnky\windows-vnorenie.diff`. |
| `mods\panely` | klon dodávaného modu `tabs` z Herdr App 0.1.16 (`cloned_from` v `mod.json`), ikony `win-*.svg` sú z neho bez zmeny | Tlačidlá panelov Limits a History s textami po anglicky aj po slovensky, cesty k ikonám pod novým menom modu, názov `Panels` v `mod.json`. |
| `doplnky\vychytavky.json` | klon dodávaného rozloženia `main` z Herdr App 0.1.16 | Panel Agents ukazuje na `agents-tree`, lišta na `panely`, v zásobníku `panel-body` pribudli bloky `limity` a `historia`. |
| `layouts\pasova-vyroba.json` | kópia `vychytavky.json` | Pribudol blok `pas` nad terminálmi. |

Malé postupy v `mods\historia` a `mods\pas` sú podľa dodávaných modov, ako hovoria komentáre v kóde (`location()` podľa modu `files`, `ikona()` podľa `icon()` v mode `agents`, pole hľadania podľa modu `picker`).

## Prevzaté postupy v mode `pas`

| Čo | Odkiaľ | Licencia |
|---|---|---|
| Plynulý presun robota do novej zóny — stabilné id prvku na agenta, kreslenie v pevnom poradí a `transition("left")`. Vlastný kód v `mods\pas\main.js`. | mod `tower` v [lcalmsky/herdr-control-tower](https://github.com/lcalmsky/herdr-control-tower), prezretý commit `88fb125b` | MIT, Copyright (c) 2026 lcalmsky. Podľa README repozitára platí MIT pre mod `tower`. |
| Robot z pár obdĺžnikov v absolútnych súradniciach a blikajúce svetlo cez `loop` opacity. Vlastný kód v `mods\pas\art.js`, tvar robota a pás sú vlastné. | `art.js` (funkcie `r()` a `bot()`) v [funny-it-worked-last-time-gsv/herdr-sit-and-watch](https://github.com/funny-it-worked-last-time-gsv/herdr-sit-and-watch), prezretý commit `dfb381dc` | MIT, Copyright (c) 2026 The herdr-office-layout authors, Copyright (c) 2026 funny-it-worked-last-time-gsv. Podľa README toho repozitára sú pomocné funkcie pixelovej kresby z [zuccs/herdr-office-layout](https://github.com/zuccs/herdr-office-layout), tiež MIT. |

Komentáre v `main.js` a `art.js` uvádzajú prevzatý postup, nie prevzatý kód.

## Vlastný kód

- `mods\limity`, `mods\historia`, `mods\pas` (okrem postupov vyššie), doplnok pre Windows v `mods\agents-tree` a doplnky panelov v `mods\panely`.
- `doplnky\statusline-limity.ps1`, `doplnky\statusline-limity-vlozka.ps1`, `doplnky\agy-statusline.mjs`.
- `instalacia.ps1`, `README.md`, `README.sk.md`, `RECIPE.md`, tento súbor a jeho anglická verzia [ORIGIN.md](ORIGIN.md).

Veľkú časť vlastného kódu napísali AI asistenti pri programovaní podľa zadania Kryptology s. r. o.

Vlastný kód je pod licenciou Apache 2.0, text licencie je v súbore [LICENSE](LICENSE). Copyright 2026 Kryptology s. r. o.

## Časť zo žiadosti o zlúčenie #1212

Časť žiadosti o zlúčenie [#1212](https://github.com/herdrdev/herdr-app/pull/1212) od autora `dkremsa` je v `mods\agents-tree\main.js` a v `doplnky\pr1212-mainjs.diff`.

Žiadosť je k 2026-11-23 otvorená a vlastnú licenciu neuvádza. Žije vo forku repozitára Herdr App a ten fork je pod licenciou Apache 2.0. Podmienky GitHubu ([Terms of Service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service), časť D.6) hovoria, že obsah pridaný do repozitára s licenčným oznámením ide pod tou istou licenciou.

> Whenever you add Content to a repository containing notice of a license, you license that Content under the same terms, and you agree that you have the right to license that Content under those terms.

`CONTRIBUTING.md` repozitára Herdr App nespomína zmluvu prispievateľa. Túto časť preto šírime pod licenciou Apache 2.0 s uvedením autora.
