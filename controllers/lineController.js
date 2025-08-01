import fetch from "node-fetch";
import { createFlexMenu } from "../utils/flexMenu.js"; // ไฟล์ flexMenu.js สำหรับสร้าง Flex 3 กล่อง
import { getGPTResponse } from "../utils/gptService.js"; // ดึงคำตอบจาก GPT
import { sendTelegramAlert } from "../services/telegramService.js"; // แจ้งเตือนไป Telegram

const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

async function replyMessage(replyToken, messages) {
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
}

export async function handleLineEvent(event) {
  if (event.type === "follow") {
    // เมื่อมีลูกค้าเพิ่มเพื่อน → ส่งข้อความ + Flex 3 กล่อง
    await replyMessage(event.replyToken, [
      { type: "text", text: "ยินดีต้อนรับเข้าสู่pgthai289นะคะพี่ กดปุ่มด้านล่างได้เลยน้าาาาา 💕" },
      createFlexMenu(), // Flex 3 กล่อง
    ]);

    // แจ้งเตือน Telegram
    await sendTelegramAlert(`มีลูกค้าใหม่เพิ่มเพื่อน: ${event.source.userId}`);
    return;
  }

  if (event.type === "message" && event.message.type === "text") {
    const userText = event.message.text;

    // ✅ ดึงคำตอบจาก GPT
    const gptReply = await getGPTResponse(userText);

    // ✅ ส่ง Flex 3 กล่อง + คำตอบ GPT
    await replyMessage(event.replyToken, [
      { type: "text", text: gptReply },
      createFlexMenu(),
    ]);

    // ✅ แจ้งเตือน Telegram
    await sendTelegramAlert(
      `📩 ลูกค้าส่งข้อความ:\n${userText}\n\nบอทตอบว่า:\n${gptReply}`
    );
  }
}
