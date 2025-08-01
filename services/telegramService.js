
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

export const sendTelegramAlert = async (message) => {
  await bot.sendMessage(process.env.TELEGRAM_CHAT_ID, message, { parse_mode: "HTML", disable_web_page_preview: false });
};
