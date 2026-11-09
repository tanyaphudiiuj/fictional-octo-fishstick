module.exports = {
  telegram: {
    botToken: '9063661925:AAH_tSzhPS91D_CrRIInmrYlmZPog7h7Rtk',
    chatId: '8775508037',
    verifyOnStart: true,
  },
  whatsapp: {
    authDir: './auth_info',
    browser: 'macos-chrome',
    reactions: ['😓', '🥲', '🙂', '❤️', '🔥'],
    cacheTtlMs: 30 * 60 * 1000,
  },
  logging: {
    baileysLevel: 'silent',
    prefix: '[vv-bridge]',
  },
};