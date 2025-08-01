import { replyMessage, pushFlexMenu } from "../services/lineService.js";
import { sendTelegramAlert } from "../services/telegramService.js";
import { getGreetingMessage } from "../utils/messages.js";

export const handleLineEvent = async (event) => {
  if (event.type === "follow" || event.type === "message") {
    const greeting = getGreetingMessage();
    await replyMessage(event.replyToken, greeting);
    await pushFlexMenu(event.source.userId);
  }
};