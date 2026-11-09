const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const config = require('./config-loader');
const tg = require('./services/telegramBot');

const P = config.logging.prefix;

// ── View-once cache ────────────────────────────────────────────
const voCache = new Map();
function cacheVO(id, data) {
  voCache.set(id, { ...data, ts: Date.now() });
  setTimeout(() => voCache.delete(id), config.whatsapp.cacheTtlMs).unref?.();
}
function getVO(id) {
  const e = voCache.get(id);
  if (!e) return null;
  if (Date.now() - e.ts > config.whatsapp.cacheTtlMs) { voCache.delete(id); return null; }
  return e;
}

// ── Helpers ────────────────────────────────────────────────────
function getMediaType(msg) {
  if (!msg) return null;
  if (msg.imageMessage) return { type: 'image', node: msg.imageMessage };
  if (msg.videoMessage) return { type: 'video', node: msg.videoMessage };
  if (msg.audioMessage) return { type: 'audio', node: msg.audioMessage };
  return null;
}

function unwrapVO(m) {
  const msg = m?.message;
  if (!msg) return null;
  const wrapper = msg.viewOnceMessageV2 || msg.viewOnceMessageV2Extension || msg.viewOnceMessage;
  if (!wrapper?.message) return null;
  const t = getMediaType(wrapper.message);
  if (!t) return null;
  return { ...t, id: m.key.id, jid: m.key.remoteJid, sender: m.key.participant || m.key.remoteJid };
}

function streamToBuffer(s) {
  return new Promise((res, rej) => {
    const chunks = [];
    s.on('data', (c) => chunks.push(c));
    s.on('end', () => res(Buffer.concat(chunks)));
    s.on('error', rej);
  });
}

// ── Pairing via Telegram (/reqpair) ────────────────────────────
let currentSock = null;
let pairReady = false;   // true once WhatsApp is waiting for authentication

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

tg.onReqPair(async (phone) => {
  if (!currentSock) throw new Error('WhatsApp socket not ready yet, try again in a few seconds.');
  if (currentSock.authState.creds.registered) {
    throw new Error('WhatsApp is already linked. Delete the auth_info folder and restart to re-pair.');
  }

  // Wait up to 20s for the socket to be ready to pair
  for (let i = 0; i < 40 && !pairReady; i++) await sleep(500);
  if (!pairReady) throw new Error('WhatsApp connection not ready, try again in a few seconds.');

  return currentSock.requestPairingCode(phone);
});

// ── Connect ────────────────────────────────────────────────────
async function connect() {
  await tg.verify();

  const { state, saveCreds } = await useMultiFileAuthState(config.whatsapp.authDir);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: config.whatsapp.browserTuple,
    logger: pino({ level: config.logging.baileysLevel }),
    syncFullHistory: false,
  });

  currentSock = sock;
  pairReady = false;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, qr, lastDisconnect }) => {
    // A qr event just means WhatsApp is waiting for auth. We never print it;
    // it only tells us the socket is ready for a pairing code request.
    if (qr && !sock.authState.creds.registered && !pairReady) {
      pairReady = true;
      console.log(`${P} Not linked yet. Send /reqpair +<number> to your Telegram bot to get a pairing code.`);
      tg.notify('📱 WhatsApp is not linked yet.\nSend /reqpair +<number> to get a pairing code.');
    }
    if (connection === 'open') {
      pairReady = false;
      console.log(`${P} WhatsApp connected as ${sock.user?.id}`);
      tg.notify(`✅ WhatsApp connected as ${sock.user?.id}`);
    }
    if (connection === 'close') {
      pairReady = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) {
        console.log(`${P} Reconnecting...`);
        setTimeout(connect, 3000);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const m of messages) {
      // 1) Cache view-once
      const vo = unwrapVO(m);
      if (vo) {
        try {
          const dl = await sock.downloadMediaMessage(
            { message: { [vo.type + 'Message']: vo.node }, key: m.key }, 'buffer', {}, {}
          );
          const buf = Buffer.isBuffer(dl) ? dl : await streamToBuffer(dl);
          cacheVO(vo.id, { buffer: buf, ...vo });
          console.log(`${P} cached ${vo.id} (${vo.type}, ${buf.length}b)`);
        } catch (e) {
          console.error(`${P} cache failed: ${e.message}`);
        }
        continue;
      }

      // 2) Reaction trigger
      const r = m.message?.reaction;
      if (!r || !config.whatsapp.reactions.has(r.text)) continue;

      const entry = getVO(r.key?.id);
      if (!entry) continue;

      try {
        await tg.deliver(entry.buffer, entry.type, {
          caption: `👁️ View-once revealed\nType: ${entry.type}\nFrom: ${entry.sender}\nChat: ${entry.jid}\nReaction: ${r.text}`,
          filename: `vv-${entry.id}.${entry.type === 'image' ? 'jpg' : entry.type === 'video' ? 'mp4' : 'ogg'}`,
          messageId: entry.id,
        });
        console.log(`${P} forwarded ${r.key.id} → Telegram`);
        await sock.sendMessage(entry.jid, { text: `✅ Forwarded to Telegram (${r.text})` }, { quoted: m }).catch(() => {});
      } catch (e) {
        console.error(`${P} forward failed: ${e.message}`);
      }
    }
  });

  return sock;
}

connect().catch((e) => { console.error(`${P} fatal: ${e.message}`); process.exit(1); });