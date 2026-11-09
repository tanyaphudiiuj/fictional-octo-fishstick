const { Browsers } = require('@whiskeysockets/baileys');

const BROWSER_MAP = {
  'macos-chrome':   () => Browsers.macOS('Chrome'),
  'macos-firefox':  () => Browsers.macOS('Firefox'),
  'ubuntu-chrome':  () => Browsers.ubuntu('Chrome'),
  'ubuntu-firefox': () => Browsers.ubuntu('Firefox'),
  'windows-chrome': () => Browsers.windows('Chrome'),
  'windows-edge':   () => Browsers.windows('Edge'),
};

function fail(msg) {
  console.error(`\n❌ config.js error: ${msg}\n`);
  process.exit(1);
}

function load() {
  let cfg;
  try {
    cfg = require('./config');
  } catch (e) {
    fail(`cannot load ./config.js — did you copy config.example.js? (${e.message})`);
  }

  // ── Telegram ────────────────────────────────────────────────
  const tg = cfg.telegram || {};
  if (!tg.botToken || tg.botToken === 'REPLACE_ME') {
    fail('telegram.botToken is missing or still REPLACE_ME');
  }
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(tg.botToken)) {
    fail('telegram.botToken does not look like a BotFather token (digits:alphanum)');
  }
  if (!tg.chatId || tg.chatId === 'REPLACE_ME') {
    fail('telegram.chatId is missing or still REPLACE_ME');
  }

  // ── WhatsApp ────────────────────────────────────────────────
  const wa = cfg.whatsapp || {};
  if (!wa.authDir || typeof wa.authDir !== 'string') {
    fail('whatsapp.authDir must be a string path');
  }
  const browserKey = wa.browser || 'macos-chrome';
  if (!BROWSER_MAP[browserKey]) {
    fail(`whatsapp.browser "${browserKey}" is unknown. Valid: ${Object.keys(BROWSER_MAP).join(', ')}`);
  }
  if (!Array.isArray(wa.reactions) || wa.reactions.length === 0) {
    fail('whatsapp.reactions must be a non-empty array of emoji strings');
  }
  if (typeof wa.cacheTtlMs !== 'number' || wa.cacheTtlMs <= 0) {
    fail('whatsapp.cacheTtlMs must be a positive number');
  }

  // ── Logging ─────────────────────────────────────────────────
  const log = cfg.logging || {};
  const validLevels = ['silent', 'fatal', 'error', 'warn', 'info', 'debug', 'trace'];
  if (log.baileysLevel && !validLevels.includes(log.baileysLevel)) {
    fail(`logging.baileysLevel must be one of: ${validLevels.join(', ')}`);
  }

  // ── Normalize ───────────────────────────────────────────────
  return {
    telegram: {
      botToken: tg.botToken,
      chatId: String(tg.chatId),
      verifyOnStart: tg.verifyOnStart !== false,
    },
    whatsapp: {
      authDir: wa.authDir,
      browserTuple: BROWSER_MAP[browserKey](),   // resolved array
      browserLabel: browserKey,
      reactions: new Set(wa.reactions),
      cacheTtlMs: wa.cacheTtlMs,
    },
    logging: {
      baileysLevel: log.baileysLevel || 'silent',
      prefix: log.prefix || '[vv-bridge]',
    },
  };
}

module.exports = load();