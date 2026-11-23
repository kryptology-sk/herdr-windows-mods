# Herdr Windows mods — agent tree, usage limits, history and assembly line

Custom mods and layouts for [Herdr App](https://github.com/herdrdev/herdr-app) on Windows.

**English** | [Slovenčina](README.sk.md)

## Before you install

- Windows 10 and 11 only. The panels read data through Windows PowerShell 5.1.
- Published as we use it, with no warranty and no support.
- Panel texts are in Slovak for now. A translation is planned. Installer messages are in Slovak too.
- Mods in Herdr run without restrictions under your account. What each one reads and runs is in part 4.
- Three commands of the Limity (“Limits”) panel connect to servers through your signed-in programs. `claude -p /usage` runs when the panel opens and, while any agent in Herdr is working, at most once every 5 minutes, otherwise once an hour. `codex app-server` and `agy -p /usage` run when the panel opens and then once an hour. No model is called by them.

## 1. What it is

Five mods in `mods\` and two layouts in `layouts\`.

| Item | What it does |
|---|---|
| `agents-tree` | The Agents panel as shipped, which also shows Claude Code subagents and background commands as rows under their agent, and a nested subagent under its parent. |
| `limity` | The Limity panel shows the usage of your Claude, Codex and agy subscriptions in percent, together with the reset time. |
| `historia` | The História (“History”) panel lists past Claude Code, Codex and agy conversations for the current folder, with search in titles and a “všade” (“everywhere”) switch for all folders. |
| `pas` | An assembly line for demos. Agents are robots that move through the zones Depo (“Depot”), Pás (“Belt”) and Výstup (“Output”) according to their status. |
| `panely` | The top bar with tabs as shipped, with four panel buttons Files, Changes, Limity and História. |
| `vychytavky` | Working layout. It is a copy of the shipped `main` layout that contains these mods. |
| `pasova-vyroba` | The same layout with the assembly line above the terminals. |

`doplnky\` contains status line scripts for Claude Code and agy, which write data for the Limity panel, and two diffs (`.diff`) to restore the `agents-tree` mod after a Herdr update.

The origin of the code and the licenses are described in [ORIGIN.md](ORIGIN.md).

## 2. Requirements

- Windows 10 or 11 (tested on Windows 11).
- Herdr App 0.1.17 and herdr-core 0.1.22. The mods run on these versions. The installer was tested on 0.1.16 and 0.1.21. Other versions may break something.
- Claude Code in the terminal, at least 2.1.329, runnable as `claude`. Older versions do not send records of background commands.
- Windows PowerShell 5.1, which is part of Windows.
- Optionally Codex CLI (`codex`) and Antigravity CLI (`agy`). Node.js (`node`) is needed by the agy status line and by the Limity panel for the hourly reading of Codex limits.

On macOS and Linux, História and Limity will not work, because they read data through PowerShell. The agent tree, Pás and the bar should work there, but this is not tested.

## 3. Installation

1. Start Herdr App at least once. This creates the folder `%USERPROFILE%\.config\herdr-app` with the subfolders `mods` and `layouts`.
2. Download this repository (Code, Download ZIP, or `git clone`) and unpack it anywhere, for example into `Downloads\herdr-windows-mods`.
3. Read the code, or at least part 4. Mods in Herdr run without restrictions.
4. Open PowerShell in the unpacked folder and run

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\instalacia.ps1
   ```

   The script copies the five mods and two layouts to `%USERPROFILE%\.config\herdr-app`. Whatever is already there, it skips and says so. On uninstall it leaves in place any mod or layout that differs from the package (part 8). It changes nothing else — not the Herdr or Claude Code settings, not the network, not other programs. You can set a different Herdr folder with the parameter `-HerdrHome "D:\path\herdr-app"`.
5. In Herdr, press Ctrl+Shift+L until the `vychytavky` layout appears. The command `herdr-app do layout.switch --name vychytavky` works too. Switching does not affect the terminals. If the new layout does not appear, close Herdr and open it again.
6. Check that nothing broke. The `errors` field in the output should be empty.

   ```powershell
   herdr-app status | Out-String
   ```

   Without `| Out-String`, PowerShell does not wait for the output. If `herdr-app` is not in PATH, it is at `%LOCALAPPDATA%\Programs\herdr-app\herdr-app.exe`.
7. Optionally connect the status lines for the Limity panel (part 5).

## 4. What each mod reads and runs

`~` is your home folder (`%USERPROFILE%`). A mod starts running when its panel is shown for the first time. After that it runs as long as the layout is shown, even if you hide the panel.

| Item | What it reads | What it runs | What it writes |
|---|---|---|---|
| `agents-tree` | Herdr data about agents, terminals and spaces. For a new Claude Code subagent, `~\.claude*\sessions\<pid>.json` (only `sessionId`) and `~\.claude*\projects\*\<sessionId>\subagents\agent-*.meta.json` (the subagent's parent and description). `.claude*` is every folder in `~` whose name starts with `.claude`. | On Windows, `powershell -NoProfile -Command …` for each new subagent until it finds the file, at most 6 attempts. For an agent on another computer, `sh -c …` through Herdr on that computer. The Herdr commands `pane.focus`, `terminal.peek`, `terminal.pin`, `layout.resize`. | The mod's own storage in Herdr (when an agent's status changed, pins), the same as the shipped `agents`. |
| `limity` | Every 15 s, `~\.cache\limity\claude.json` and `~\.cache\limity\agy.json`. Every minute, the last 20 lines of the 5 newest `~\.codex\sessions\**\rollout-*.jsonl` (only the last `rate_limits` record) and `~\.claude.json`. It loads that file in full, including the account e-mail and settings, and passes only the percentages and reset times from `cachedUsageUtilization` to the panel. | To read Codex and `~\.claude.json`, `powershell -NoProfile -Command …`. In addition `claude -p /usage --no-session-persistence --strict-mcp-config` in `~` — when the panel opens and, while any agent in Herdr is working, at most once every 5 minutes, otherwise once an hour. Claude Code then uses its own sign-in to download the usage from Anthropic's servers and stores it in `~\.claude.json`. It does not call a model, does not save a session and does not start MCP servers. When the panel opens and then once an hour, also `node -e …`, which starts `codex app-server` and asks it for the account limits (request `account/rateLimits/read`), and `agy -p /usage --output-format json` in `~`. Codex and agy connect to their servers with their own sign-in, do not call a model and spend no tokens. | Nothing. |
| `historia` | In normal mode once a minute, in “všade” mode once every 5 minutes. Claude — `~\.claude\sessions\*.json` (which sessions are running) and the transcripts `~\.claude\projects\<folder>\*.jsonl` (the end of the file for the title, the beginning for the first message and the original folder). Codex — `~\.codex\session_index.jsonl` and the first line of `~\.codex\sessions\**\rollout-*.jsonl`, and the beginning of the transcript when there is no title. agy — in `~\.gemini\antigravity-cli` the files `history.jsonl`, `cache\conversation_metadata.json`, `annotations\<id>.pbtxt`, the first line of `brain\<id>\.system_generated\logs\transcript.jsonl` and the timestamps of the `conversations\*.db` files. Of the conversation content, only the title or the first 60 characters of the first message reach the panel. | For reading, one `powershell -NoProfile -Command …` command with a 30 s limit. It also checks running processes (`Get-Process`). After a click on a conversation, a new tab or space with `claude --resume <id>`, `codex resume --no-daemon <id>` or `agy --conversation <id>`. | Nothing. |
| `pas` | Only Herdr data about agents, terminals and spaces. | Only the Herdr commands `pane.focus` and `terminal.peek` after a click. | Nothing. |
| `panely` | Herdr data about tabs, spaces and the layout. | Herdr commands for tabs, panels and the window. | The mod's own storage (which panel was open in which space), the same as the shipped `tabs`. |
| `doplnky\statusline-limity.ps1` | The input that Claude Code sends to the status line. | Nothing. | `~\.cache\limity\claude.json` (only `rate_limits` and the time of writing). |
| `doplnky\agy-statusline.mjs` | The input that agy sends to the status line. | Nothing. | `~\.cache\limity\agy.json` (only percentages and reset times) or the file from the `AGY_LIMITS_FILE` variable. |
| `instalacia.ps1` | The `mods` and `layouts` folders of Herdr. | Nothing. | Copies its mods and layouts. With `-Odinstaluj -Potvrdit` it deletes only those identical to the package, a layout together with its state in `layouts\.state`. With `-AjZmenene` it also deletes those that differ from the package. |

No mod or script calls the network on its own or reads sign-in files (`~\.claude\.credentials.json`, `~\.codex\auth.json`, agy tokens). Only three commands of the Limity panel go out — `claude -p /usage`, `codex app-server` and `agy -p /usage`. With them it is Claude Code, Codex or agy that connects to the server with its own sign-in, not the mod. A click in História starts Claude Code, Codex or agy, which then work as usual.

Mods in Herdr run as an ordinary program under your account, without restrictions. Read the code before you install. It is in the `main.js` and `art.js` files, about 2,100 lines in total. The PowerShell in them is in the strings `META_WIN`, `CODEX_PS`, `CLAUDE_MODELY_PS` and `HISTORIA_PS`, the Node script in `CODEX_SERVER_JS`.

## 5. Limity — setup

### Claude

The panel takes the weekly window, and the five-hour window if your plan has one, from the file `~\.cache\limity\claude.json`. That file is written by the Claude Code status line. Claude Code sends limit data to the status line only on the Pro, Max or Ultra plans, and only after the first reply in a session. The Claude Code extension in VS Code does not run the status line, so the value is refreshed only while you work in the terminal.

**Option A — the included status line.** It draws the model, a context bar and the folder on two lines.

1. Copy `doplnky\statusline-limity.ps1` to `%USERPROFILE%\.claude\statusline-limity.ps1`.
2. In `%USERPROFILE%\.claude\settings.json`, add or replace the `statusLine` key. `<name>` is your Windows user name. If the path contains a space, put it in quotes, in JSON as `\"…\"`.

   ```json
   "statusLine": {
     "type": "command",
     "command": "powershell -NoProfile -ExecutionPolicy Bypass -File C:/Users/<name>/.claude/statusline-limity.ps1"
   }
   ```

3. Start a new Claude Code session in the terminal. After the first reply, `~\.cache\limity\claude.json` is created.

**Option B — your own status line.** If you already have a status line in PowerShell, insert the block from `doplnky\statusline-limity-vlozka.ps1` right after the line that reads the input into the `$data` variable. If it is in another language, write the same thing to `~\.cache\limity\claude.json` — `{"updated": <unix seconds>, "rate_limits": <rate_limits from the input>}`.

**Models with their own limit.** If your plan has a separate weekly limit for a model, the panel shows it on its own as another row under the week. It takes it from `cachedUsageUtilization` in `~\.claude.json`, which Claude Code refreshes on the `/usage` command. That is why the panel runs `claude -p /usage` from time to time (part 4). The field is not documented and may change. The panel also takes the week from there when it is fresher than the value from the status line. So without the status line you still see the week and the models, only not the five-hour window.

### Codex

Nothing to set up. The panel reads the last limits record in the newest Codex sessions (`~\.codex\sessions`) and shows the plan and the windows that Codex writes. When the panel opens and then once an hour, it also asks Codex directly (`codex app-server`), so that the value is fresh even after runs that do not save a session (`codex exec --ephemeral`). This needs `codex` and `node` in PATH. Without them only the value from the sessions remains.

### agy

Without any setup, the panel asks agy with `agy -p /usage` when it opens and then once an hour (`agy` must be in PATH). No model is called and no quota is spent. If the terms of your account or program forbid automated agy calls, turn the hourly reading off — in `mods\limity\main.js`, in the function `obnovKvoty`, delete the line with `citajAgyUsage`.

The status line is optional and refreshes the value continuously while you work in agy.

1. Copy `doplnky\agy-statusline.mjs` to `%USERPROFILE%\.gemini\antigravity-cli\statusline.mjs`.
2. In agy, enter

   ```
   /statusline node C:/Users/<name>/.gemini/antigravity-cli/statusline.mjs
   ```

3. To turn it off, enter `/statusline delete`.

On Windows, agy splits the status line command only at spaces, and quotes do not help. The path to the script therefore must not contain spaces. If your user name has one, put the script for example into `C:\herdr\agy-statusline.mjs`. The script prints the mode, the model and how full the context is. It writes `~\.cache\limity\agy.json` only when agy sends quota data, and it skips the windows of third-party models (the key starts with `3p`).

## 6. How to use it

- Ctrl+Shift+L switches layouts. `vychytavky` is for work, `pasova-vyroba` for showing, `main` is the shipped one. Terminals and agents lose nothing when you switch.
- The Files, Changes, Limity and História buttons are on the right of the top bar. One click opens a panel, a second click closes it. The bar remembers the open panel for each space separately. Changes can be hidden on the welcome screen (command palette Ctrl+Shift+P, Welcome). Limity and História are always on.
- In the Agents panel, subagents and background commands are rows under their agent. A click on such a row focuses the agent's terminal. When it finishes, the row disappears. A background command is named after the description Claude gave it.
- História shows conversations for the folder of the active terminal, the same one as the Files panel. The “hľadať v názvoch…” (“search in titles…”) field filters as you type, in conversation titles and program names, ignoring case and diacritics. It takes keyboard input only after you click into it. Esc clears it. A click on a conversation resumes it in a new tab of the current space. A running Claude conversation is marked “beží” (“running”) and cannot be opened, so that two programs do not write into one record.
- The “všade” switch loads up to 500 newest conversations from all folders except temporary ones (`%TEMP%`), shows 40 of them and writes the folder name next to each row. You can search by the folder name too. A click opens the conversation in its original folder and in the space that belongs to it. It first looks for a space named like the folder, then for the space with the most terminals running in that folder, and otherwise creates a new space.
- In the Pás panel, a click on a robot focuses the agent's terminal and a click on an `hc run` worker opens it in the preview. For a demo without agents, add the property `"props": { "demo": true }` to the `pas` block in `pasova-vyroba.json`.

## 7. Known limitations

- `agents-tree` and `panely` are copies of the shipped mods `agents` and `tabs` from Herdr App 0.1.16, and `vychytavky` is a copy of the `main` layout. They are not updated with the app. After a Herdr update they may miss new features or break. The `agents-tree` mod can be restored — rename the old one, clone the shipped one with `herdr-app do mod.clone --name agents --as agents-tree`, and in its folder apply `git apply -p4 <path>\doplnky\pr1212-mainjs.diff` and then `git apply -p1 <path>\doplnky\windows-vnorenie.diff`. If the #1212 fix has been merged into Herdr by then, the second diff is enough.
- Codex history only goes back a few days. Codex packs older threads (`.jsonl.zst`, older than about 6 days) and the panel does not read them.
- “beží” is only an estimate for Codex and agy, based on whether the conversation changed in the last 2 minutes. An idle conversation open in another tab can be clicked and would open a second copy.
- História searches only in titles, not in the content of conversations. It does not work for folders on another computer.
- Pás does not draw nesting. All subagents stand as smaller robots next to the main one. An idle agent whose subagents are still working stands with them in Depo. Pás is drawn in the Cascadia Mono font, which comes with Windows Terminal. Without it, it may look different.
- Codex and agy limits are refreshed when you work with them in the terminal, when the panel opens and once an hour. In between, the value can be up to an hour old. The panel shows the age of the value and draws a value older than an hour in a muted color.
- Closing the last tab closes the whole space, and Herdr does not offer closed spaces anywhere. Keep a PowerShell tab open in important spaces. This is how Herdr behaves, not the mods.
- História resumes a Codex conversation with `codex resume --no-daemon <id>`, the same way Herdr starts it. If your Codex does not know the `--no-daemon` switch, the new tab ends with an error. Update Codex, or in `mods\historia\main.js` delete `"--no-daemon", ` from the `OBNOVENIE` constant. Herdr reloads the mod by itself after you save.

## 8. Uninstalling

1. In Herdr, switch to `main` (Ctrl+Shift+L).
2. Run `powershell -ExecutionPolicy Bypass -File .\instalacia.ps1 -Odinstaluj`. It lists what it would delete and what it would leave in place, and deletes nothing.
3. Run `powershell -ExecutionPolicy Bypass -File .\instalacia.ps1 -Odinstaluj -Potvrdit`. It deletes only the mods and layouts that are identical to the package, a layout together with its saved state in `layouts\.state`. A mod whose `main.js` differs from the package (a modified mod, or another mod with the same name that was there before installation) and a layout that differs from the package are left in place and listed as kept.
4. To delete the kept ones too, add the `-AjZmenene` switch — `powershell -ExecutionPolicy Bypass -File .\instalacia.ps1 -Odinstaluj -AjZmenene -Potvrdit`.
5. Restore the status lines by hand — the `statusLine` key in `~\.claude\settings.json`, and `/statusline delete` in agy. You can delete the `~\.cache\limity` folder.

## 9. Troubleshooting

- **The Limity and História buttons are missing.** Neither the `vychytavky` nor the `pasova-vyroba` layout is shown. Switch to one with Ctrl+Shift+L. If the installer skipped the `panely` mod because it already existed, the layout uses the existing one.
- **A panel is empty or says “históriu sa nepodarilo načítať” (“history could not be loaded”).** Run `herdr-app status | Out-String` and look at the `errors` field. You can check a mod with `herdr-app check "$HOME\.config\herdr-app\mods\historia" | Out-String`. Both História and Limity need `powershell` in PATH. With a very large number of conversations, reading can exceed the 30 s limit.
- **Limity shows “bez údaja” (“no data”).** For Claude, `~\.cache\limity\claude.json` is missing (the status line is not connected, or no reply has arrived in the terminal yet) and `claude -p /usage` stored nothing. The message “automatická obnova čerpania Claude zlyhala” (“automatic refresh of Claude usage failed”) means that Herdr did not find `claude` in PATH or the command ended with an error. For Codex, there is no session with limits data yet and the hourly reading failed (`codex` or `node` is not in PATH, or Codex is not signed in). For agy, the status line from `doplnky` is not connected and `agy -p /usage` failed (`agy` is not in PATH or is not signed in).
- **No subagents or background commands under an agent.** Claude Code below 2.1.329 does not send background commands. If subagents are listed flat and not under their parent, the `agent-*.meta.json` files could not be read through PowerShell.
- **Something is broken after a Herdr update.** Switch to the shipped `main` layout (Ctrl+Shift+L). The terminals stay. Then look at `herdr-app status | Out-String` and restore `agents-tree` as described in part 7.
- **Uninstalling left a mod or layout in place.** It differs from the package. It is a modified mod or layout, or another mod with the same name that was there before installation. You can delete it with the `-AjZmenene` switch (part 8).

## License

Apache License 2.0, see [LICENSE](LICENSE) and [NOTICE](NOTICE). Copyright 2026 Kryptology s. r. o. The origin of third-party code is described in [ORIGIN.md](ORIGIN.md).
