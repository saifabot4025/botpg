// 📂 config.js
export default {
  webName: "PGTHAI289",
  line: {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
    proxyUrl: "https://api.telegram.org", // ถ้าจะใช้ Proxy สามารถใส่ URL Proxy ได้
  },
  gpt: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  flex: {
    registerUrl: "https://pgthai289.net/customer/register/LINEBOT/?openExternalBrowser=1",
    mainUrl: "https://pgthai289.net/?openExternalBrowser=1",
    backupUrl: "https://pgthai289.net/?openExternalBrowser=1",
    groups: {
      liveFootball: "https://t.me/+aCx3bHddwkkzMmU9",
      tips: "https://t.me/+aCx3bHddwkkzMmU9",
      lottery: "https://t.me/+aCx3bHddwkkzMmU9",
      news: "https://t.me/+aCx3bHddwkkzMmU9",
    },
  },
};
