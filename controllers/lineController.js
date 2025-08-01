import { replyMessage, pushFlexMenu } from "../services/lineService.js";
import { getGreetingMessage } from "../utils/messages.js";

export const handleLineEvent = async (event) => {
  try {
    if (event.type === "follow" || event.type === "message") {
      const greeting = getGreetingMessage();
      await replyMessage(event.replyToken, greeting);
      await pushFlexMenu(event.source.userId);
    }
  } catch (err) {
    console.error("❌ handleLineEvent Error:", err);
  }
};
