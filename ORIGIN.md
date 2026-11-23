# Code origin and licenses

Part of the package is derived from third-party code. That code keeps its own license. The package's own code is licensed under Apache 2.0, and its author and copyright holder is Kryptology s. r. o.

## Derived from Herdr App

Herdr App is in the repository [herdrdev/herdr-app](https://github.com/herdrdev/herdr-app) under the Apache 2.0 license. The evidence is the `LICENSE` file in the app installation (`%LOCALAPPDATA%\Programs\herdr-app\LICENSE`) and the repository license on GitHub.

| Item | Derived from | Changes in the package |
|---|---|---|
| `mods\agents-tree` | clone of the shipped `agents` mod from Herdr App 0.1.16 (`cloned_from` in `mod.json`) | Changes from the open pull request [#1212](https://github.com/herdrdev/herdr-app/pull/1212) “fix: the agents list shows what an agent runs in its own process” by `dkremsa`. Only the part for `defaults/mods/agents/main.js` is taken from it, and it is in `doplnky\pr1212-mainjs.diff`. In addition an own extension for Windows (the `META_WIN` constant and a branch in `loadMeta`), which is in `doplnky\windows-vnorenie.diff`. |
| `mods\panely` | clone of the shipped `tabs` mod from Herdr App 0.1.16 (`cloned_from` in `mod.json`), the `win-*.svg` icons are taken from it unchanged | Buttons for the Limity and História panels, icon paths under the new mod name, the title `Panely` in `mod.json`. |
| `layouts\vychytavky.json` | clone of the shipped `main` layout from Herdr App 0.1.16 | The Agents panel points to `agents-tree`, the bar to `panely`, and the blocks `limity` and `historia` were added to the `panel-body` stack. |
| `layouts\pasova-vyroba.json` | copy of `vychytavky.json` | A `pas` block was added above the terminals. |

Small routines in `mods\historia` and `mods\pas` follow the shipped mods, as the code comments say (`location()` after the `files` mod, `ikona()` after `icon()` in the `agents` mod, the search field after the `picker` mod).

## Techniques adopted in the `pas` mod

| What | From | License |
|---|---|---|
| Smooth move of a robot to a new zone — a stable element id per agent, drawing in a fixed order and `transition("left")`. Own code in `mods\pas\main.js`. | the `tower` mod in [lcalmsky/herdr-control-tower](https://github.com/lcalmsky/herdr-control-tower), reviewed commit `88fb125b` | MIT, Copyright (c) 2026 lcalmsky. According to the repository README, MIT applies to the `tower` mod. |
| A robot made of a few rectangles in absolute coordinates and a blinking light through an opacity `loop`. Own code in `mods\pas\art.js`, the robot shape and the belt are own work. | `art.js` (the functions `r()` and `bot()`) in [funny-it-worked-last-time-gsv/herdr-sit-and-watch](https://github.com/funny-it-worked-last-time-gsv/herdr-sit-and-watch), reviewed commit `dfb381dc` | MIT, Copyright (c) 2026 The herdr-office-layout authors, Copyright (c) 2026 funny-it-worked-last-time-gsv. According to the README of that repository, the pixel art helper functions come from [zuccs/herdr-office-layout](https://github.com/zuccs/herdr-office-layout), also MIT. |

The comments in `main.js` and `art.js` name an adopted technique, not adopted code.

## Own code

- `mods\limity`, `mods\historia`, `mods\pas` (except the techniques above), the Windows extension in `mods\agents-tree` and the panel additions in `mods\panely`.
- `doplnky\statusline-limity.ps1`, `doplnky\statusline-limity-vlozka.ps1`, `doplnky\agy-statusline.mjs`.
- `instalacia.ps1`, `README.md`, `README.sk.md`, this file and its Slovak version [POVOD.md](POVOD.md).

A large part of the own code was written by AI coding assistants following the instructions of Kryptology s. r. o.

The own code is licensed under Apache 2.0, and the license text is in the [LICENSE](LICENSE) file. Copyright 2026 Kryptology s. r. o.

## The part from pull request #1212

Part of the pull request [#1212](https://github.com/herdrdev/herdr-app/pull/1212) by `dkremsa` is in `mods\agents-tree\main.js` and in `doplnky\pr1212-mainjs.diff`.

As of 2026-11-23 the pull request is open and does not state a license of its own. It lives in a fork of the Herdr App repository, and that fork is licensed under Apache 2.0. The GitHub [Terms of Service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service), section D.6, say that content added to a repository with a license notice is licensed under the same license.

> Whenever you add Content to a repository containing notice of a license, you license that Content under the same terms, and you agree that you have the right to license that Content under those terms.

The `CONTRIBUTING.md` of the Herdr App repository does not mention a contributor license agreement. We therefore distribute this part under Apache 2.0 with attribution to its author.
