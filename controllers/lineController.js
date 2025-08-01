// controllers/lineController.js
import { handleCustomerFlow } from "../utils/flowManager.js";
import { createFlexMenu } from "../utils/flexMenu.js";
import { sendTelegramAlert } from "../services/telegramService.js";
import fetch from "node-fetch";

const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

async function replyMessage(replyToken, messages) {
  if (!replyToken || !messages || messages.length === 0) return;

  try {
    await fetch(LINE_REPLY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: Array.isArray(messages) ? messages : [messages],
      }),
    });
  } catch (error) {
    console.error("Error sending reply message:", error);
  }
}

export async function handleLineEvent(event) {
  try {
    // บันทึก log
    console.log("Event received:", event);

    // เรียก flowManager
    const replyMessages = await handleCustomerFlow(event);

    // ส่งข้อความตอบกลับถ้ามี
    if (replyMessages.length > 0) {
      await replyMessage(event.replyToken, replyMessages);
    }
  } catch (error) {
    console.error("handleLineEvent error:", error);
    await replyMessage(event.replyToken, [
      {
        type: "text",
        text:
          "ขออภัยค่ะ พี่แอดมินกำลังตรวจสอบอยู่ค่ะ โปรดลองใหม่อีกครั้งนะคะ 💕",
      },
    ]);
  }
}
