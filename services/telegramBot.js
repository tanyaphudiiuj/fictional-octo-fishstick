const TelegramBot = require('node-telegram-bot-api');
const config = require('../config-loader');

const P = config.logging.prefix;

// Polling is on so the bot can receive /reqpair commands.
const bot = new TelegramBot(config.telegram.botToken, { polling: true });

bot.on('polling_error', (e) => {
  console.error(`${P} Telegram polling error: ${e.code || ''} ${e.message}`);
});

async function verify() {
  if (!config.telegram.verifyOnStart) return null;
  try {
    const me = await bot.getMe();
    console.log(`${P} Telegram @${me.username} ready`);
    return me;
  } catch (e) {
    console.error(`${P} Telegram auth failed: ${e.message}`);
    throw e;
  }
}

async function notify(text, opts = {}) {
  return bot.sendMessage(config.telegram.chatId, text, opts).catch((e) => {
    console.error(`${P} Telegram notify failed: ${e.message}`);
  });
}

/**
 * Register the /reqpair command.
 * handler(phoneDigits) must resolve to the pairing code string (or throw).
 * Only the chat configured in config.telegram.chatId may use it.
 */
function onReqPair(handler) {
  bot.onText(/^\/reqpair(?:@\w+)?(?:\s+(.+))?$/i, async (msg, match) => {
    const chatId = msg.chat.id;

    if (String(chatId) !== config.telegram.chatId) {
      console.warn(`${P} /reqpair ignored from unauthorized chat ${chatId}`);
      return;
    }

    const raw = (match[1] || '').trim();
    const phone = raw.replace(/[^0-9]/g, '');

    if (!raw) {
      return bot.sendMessage(chatId, 'Usage: /reqpair +559455836487');
    }
    if (phone.length < 8 || phone.length > 15) {
      return bot.sendMessage(chatId, '❌ Invalid number. Use international format, e.g. /reqpair +559455836487');
    }

    try {
      await bot.sendMessage(chatId, `⏳ Requesting pairing code for +${phone}...`);
      const code = await handler(phone);
      const pretty = code.match(/.{1,4}/g)?.join('-') || code;
      await bot.sendMessage(
        chatId,
        `🔗 Pairing code for +${phone}:\n\n<code>${pretty}</code>\n\n` +
        `📲 WhatsApp → Settings → Linked Devices → Link a device → Link with phone number instead`,
        { parse_mode: 'HTML' }
      );
    } catch (e) {
      console.error(`${P} /reqpair failed: ${e.message}`);
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
  });
}

async function deliver(buf, type, meta = {}) {
  const chatId = config.telegram.chatId;
  const opts = { caption: meta.caption || undefined, filename: meta.filename };

  try {
    if (type === 'image') return await bot.sendPhoto(chatId, buf, opts);
    if (type === 'video') return await bot.sendVideo(chatId, buf, opts);
    if (type === 'audio') {
      try {
        return await bot.sendVoice(chatId, buf, {
          caption: opts.caption,
          filename: meta.filename || 'voice.ogg',
        });
      } catch {
        console.warn(`${P} sendVoice failed → document fallback`);
        return await bot.sendDocument(chatId, buf, {
          caption: opts.caption,
          filename: meta.filename || 'voice.ogg',
        });
      }
    }
    return await bot.sendDocument(chatId, buf, opts);
  } catch (err) {
    console.error(`${P} Telegram deliver error: ${err.message}`);
    throw err;
  }
}

module.exports = { bot, verify, deliver, notify, onReqPair };
