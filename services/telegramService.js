import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

export const sendTelegramAlert = async (text) => {
  await bot.sendMessage(process.env.TELEGRAM_CHAT_ID, text);
};