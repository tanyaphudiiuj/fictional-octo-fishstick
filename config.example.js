module.exports = {
  telegram: {
    // From @BotFather → /newbot → token
    botToken: 'REPLACE_ME',

    // Chat / group / channel ID where media lands.
    // Get it by adding the bot to the chat, sending a message,
    // then GET https://api.telegram.org/bot<TOKEN>/getUpdates
    chatId: 'REPLACE_ME',

    // If true, bot logs getMe() on startup to confirm token
    verifyOnStart: true,
  },

  whatsapp: {
    // Where Baileys stores session creds. Persist this across restarts.
    authDir: './auth_info',

    // Canonical browser tuple. Do NOT change — see notes below.
    // Baileys ships helpers: Browsers.macOS('Chrome'), Browsers.ubuntu('Chrome'),
    // Browsers.windows('Firefox'). Use one of those in code, not a raw array.
    browser: 'macos-chrome',

    // Emojis that trigger forwarding when reacted to a view-once message
    reactions: ['😓', '🥲', '🙂', '❤️', '🔥'],

    // How long (ms) to keep cached view-once media before eviction
    cacheTtlMs: 30 * 60 * 1000,
  },

  logging: {
    // 'silent' | 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace'
    baileysLevel: 'silent',
    // Console prefix for our own logs
    prefix: '[vv-bridge]',
  },
};