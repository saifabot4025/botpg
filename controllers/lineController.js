import fetch from "node-fetch";
import { createFlexMenu } from "../utils/flexMenu.js";
import { handleFlow } from "../utils/flowManager.js";

const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

/**
 * ส่งข้อความตอบกลับไปที่ LINE
 */
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
    console.error("❌ Error sending reply message:", error);
  }
}

/**
 * จัดการ Event ที่มาจาก LINE
 */
export async function handleLineEvent(event) {
  let replyMessages = [];

  // ✅ กรณีลูกค้าเพิ่มเพื่อน
  if (event.type === "follow") {
    replyMessages.push({
      type: "text",
      text:
        "ขอบคุณที่เพิ่มเพื่อนค่ะ 💕 ยินดีต้อนรับสู่ PGTHAI289\n" +
        "เว็บมั่นคง ปลอดภัย ฝาก-ถอนออโต้\n" +
        "🔥 สมัครวันนี้ รับสิทธิพิเศษทันที! 🔥",
    });

    replyMessages.push(createFlexMenu());

    await replyMessage(event.replyToken, replyMessages);
    return;
  }

  // ✅ กรณีลูกค้าส่งข้อความ หรือ กดปุ่ม Postback
  if (event.type === "message" || event.type === "postback") {
    try {
      // 📌 ดึงผลลัพธ์จาก Flow Manager
      const flowResult = await handleFlow(event);

      if (Array.isArray(flowResult)) {
        replyMessages.push(...flowResult.filter((m) => m.type));
      } else if (typeof flowResult === "string") {
        replyMessages.push({ type: "text", text: flowResult });
      }

      // ✅ ตรวจสอบว่าต้องส่ง Flex Menu หรือไม่
      const skipFlex =
        Array.isArray(flowResult) &&
        flowResult.some((m) => m.skipFlex === true);

      if (!skipFlex) {
        replyMessages.push(createFlexMenu());
      }

      await replyMessage(event.replyToken, replyMessages);
    } catch (error) {
      console.error("❌ handleLineEvent Error:", error);

      await replyMessage(event.replyToken, [
        {
          type: "text",
          text:
            "ขออภัยค่ะ 😥 เกิดข้อผิดพลาดชั่วคราว กรุณาลองใหม่อีกครั้ง\n" +
            "หากยังมีปัญหา แอดมินจะรีบช่วยเหลือคุณพี่โดยเร็วค่ะ 💕",
        },
      ]);
    }
  }
}
