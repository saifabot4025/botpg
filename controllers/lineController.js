
import { replyMessage, pushFlexMenu } from "../services/lineService.js";
import { sendTelegramAlert } from "../services/telegramService.js";
import { getGreetingMessage } from "../utils/messages.js";

export const handleLineEvent = async (event) => {
  if (event.type === "follow" || event.type === "message") {
    const greeting = getGreetingMessage();
    await replyMessage(event.replyToken, greeting);
    await pushFlexMenu(event.source.userId);

    if (event.message?.type === "image") {
      const imageUrl = event.message.contentProvider?.originalContentUrl;
      if (imageUrl) {
        const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl)}`;
        await sendTelegramAlert(`🖼 มีลูกค้าส่งรูป: <a href="${proxyUrl}">ดูรูปที่นี่</a>`);
      }
    }
  }
};
