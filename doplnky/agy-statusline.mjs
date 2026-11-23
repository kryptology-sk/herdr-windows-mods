// Vlastna stavova lista (statusLine) pre Antigravity CLI (agy).
// Cita JSON stav relacie zo stdin, vypise rezim, model a zaplnenie kontextoveho okna
// a pri pritomnej kvote zapise suhrn limitov pre Herdr do ~/.cache/limity/agy.json.
// Zapnutie v agy (cesta musi byt bez medzier a uvodzoviek, overene na agy 1.5.13):
//   /statusline node C:/Users/<meno>/.gemini/antigravity-cli/statusline.mjs
// Vypnutie / navrat na predvolenu: /statusline delete

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const LIMITS_FILE =
  process.env.AGY_LIMITS_FILE ||
  path.join(os.homedir(), '.cache', 'limity', 'agy.json');

const PERIOD_LABELS = {
  weekly: 'týždeň',
  week: 'týždeň',
  '7d': 'týždeň',
  daily: 'deň',
  day: 'deň',
  '24h': 'deň',
  '1d': 'deň',
  monthly: 'mesiac',
  month: 'mesiac',
  '30d': 'mesiac',
};

const MODEL_TOKENS = {
  gpt: 'GPT',
  ai: 'AI',
  pro: 'Pro',
  flash: 'Flash',
  gemini: 'Gemini',
  claude: 'Claude',
  neon: 'Neon',
  argon: 'Argon',
  carbon: 'Carbon',
  hydrogen: 'Hydrogen',
};

function formatTokens(count) {
  if (!count || count <= 0) return '0';
  if (count >= 1_000_000) {
    return (count / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (count >= 1_000) return Math.round(count / 1_000) + 'k';
  return String(count);
}

function colorForPercent(pct) {
  if (pct >= 80) return '\x1b[31m';
  if (pct >= 50) return '\x1b[33m';
  return '\x1b[32m';
}

function formatPeriodToken(token) {
  if (PERIOD_LABELS[token]) return PERIOD_LABELS[token];
  const hours = token.match(/^(\d+)h$/);
  if (hours) return `${hours[1]} h`;
  const days = token.match(/^(\d+)d$/);
  if (days) return `${days[1]} d`;
  return null;
}

function formatModelToken(token) {
  if (MODEL_TOKENS[token]) return MODEL_TOKENS[token];
  if (/^\d+(\.\d+)?$/.test(token)) return token;
  return token.charAt(0).toUpperCase() + token.slice(1);
}

function formatQuotaLabel(key) {
  const parts = String(key || '')
    .trim()
    .toLowerCase()
    .split(/[-_\s]+/)
    .filter(Boolean);

  if (parts.length === 0) return 'Limit';

  const lastPeriod = formatPeriodToken(parts[parts.length - 1]);
  const modelParts = lastPeriod ? parts.slice(0, -1) : parts;
  const formattedModel = modelParts.map(formatModelToken).join(' ');

  if (formattedModel && lastPeriod) return `${formattedModel} ${lastPeriod}`;
  return formattedModel || lastPeriod || String(key);
}

function extractUsedPercent(entry) {
  if (typeof entry.remaining_fraction === 'number' && Number.isFinite(entry.remaining_fraction)) {
    return clampPercent((1 - entry.remaining_fraction) * 100);
  }
  if (typeof entry.remainingFraction === 'number' && Number.isFinite(entry.remainingFraction)) {
    return clampPercent((1 - entry.remainingFraction) * 100);
  }
  if (typeof entry.used_percent === 'number' && Number.isFinite(entry.used_percent)) {
    return clampPercent(entry.used_percent);
  }
  if (typeof entry.used_percentage === 'number' && Number.isFinite(entry.used_percentage)) {
    return clampPercent(entry.used_percentage);
  }
  if (typeof entry.used_fraction === 'number' && Number.isFinite(entry.used_fraction)) {
    return clampPercent(entry.used_fraction * 100);
  }
  return null;
}

function clampPercent(value) {
  return Math.round(Math.min(100, Math.max(0, value)));
}

function extractResetsAt(entry, nowSec) {
  const rawTime = entry.reset_time ?? entry.resetTime;
  if (typeof rawTime === 'string' && rawTime.trim()) {
    const ms = Date.parse(rawTime);
    if (Number.isFinite(ms) && ms > 0) return Math.floor(ms / 1000);
  }
  if (typeof rawTime === 'number' && Number.isFinite(rawTime) && rawTime > 0) {
    return rawTime > 1e12 ? Math.floor(rawTime / 1000) : Math.floor(rawTime);
  }

  const rawInSec = entry.reset_in_seconds ?? entry.resetInSeconds;
  if (typeof rawInSec === 'number' && Number.isFinite(rawInSec) && rawInSec >= 0) {
    return nowSec + Math.round(rawInSec);
  }

  return null;
}

function extractQuotaWindows(quota, nowSec) {
  if (!quota || typeof quota !== 'object') return [];

  const entries = Array.isArray(quota)
    ? quota.map((item, idx) => [item?.id || item?.name || item?.label || `limit-${idx + 1}`, item])
    : Object.entries(quota);

  const windows = [];
  for (const [key, entry] of entries) {
    if (/^3p([-_\s]|$)/i.test(String(key || '').trim())) continue;
    if (!entry || typeof entry !== 'object') continue;
    const usedPercent = extractUsedPercent(entry);
    if (usedPercent === null) continue;

    windows.push({
      label: formatQuotaLabel(key),
      used_percent: usedPercent,
      resets_at: extractResetsAt(entry, nowSec),
    });
  }

  return windows;
}

function writeLimitsCache(data) {
  const nowSec = Math.floor(Date.now() / 1000);
  const windows = extractQuotaWindows(data.quota, nowSec);
  if (windows.length === 0) return;

  const dir = path.dirname(LIMITS_FILE);
  const tmpFile = path.join(dir, `.agy.${process.pid}.${Date.now()}.tmp`);
  const payload = JSON.stringify({ updated: nowSec, windows }) + '\n';

  fs.mkdirSync(dir, { recursive: true });
  try {
    fs.writeFileSync(tmpFile, payload, 'utf8');
    fs.renameSync(tmpFile, LIMITS_FILE);
  } catch (err) {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // ignore cleanup error
    }
    throw err;
  }
}

function renderStatusLine(data) {
  const mode = data.cycle_mode || '';
  const model = data.model?.display_name || data.model?.id || '';
  const ctx = data.context_window || {};
  const size = Number(ctx.context_window_size ?? 0);

  let pct = ctx.used_percentage != null ? Number(ctx.used_percentage) : 0;
  if (ctx.used_percentage == null && size > 0) {
    const total = Number(ctx.total_input_tokens ?? 0) + Number(ctx.total_output_tokens ?? 0);
    pct = (total / size) * 100;
  }

  const pctText = pct > 0 && pct < 10 ? pct.toFixed(1) : String(Math.round(pct));
  let ctxLabel = `ctx ${pctText} %`;
  if (size > 0) {
    const used = Math.round((size * pct) / 100);
    ctxLabel += ` (${formatTokens(used)} / ${formatTokens(size)})`;
  }

  const coloredCtx = `${colorForPercent(pct)}${ctxLabel}\x1b[0m`;
  const parts = [mode, model, coloredCtx].filter(Boolean);
  return parts.join(' - ') + '\n';
}

function main() {
  const raw = fs.readFileSync(0, 'utf8').trim();
  const data = raw ? JSON.parse(raw) : {};

  process.stdout.write(renderStatusLine(data));

  try {
    writeLimitsCache(data);
  } catch {
    // Chyba zapisu limitov nesmie zhodit stavovy riadok.
  }
}

try {
  main();
} catch {
  process.stdout.write('ctx ?\n');
}
