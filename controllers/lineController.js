import fetch from "node-fetch";
import { createFlexMenu } from "../utils/flexMenu.js";
import { handleCustomerFlow } from "../utils/flowManager.js";
import { sendTelegramAlert } from "../services/telegramService.js";

const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

/**
 * ✅ ฟังก์ชันส่งข้อความตอบกลับไปยัง LINE
 */
async function replyMessage(replyToken, messages) {
  if (!replyToken || !messages || messages.length === 0) {
    console.warn("⚠️ replyMessage ไม่ทำงานเพราะไม่มี replyToken หรือ messages");
    return;
  }

  console.log("📤 [replyMessage] กำลังส่งข้อความ:", messages);

  try {
    const res = await fetch(LINE_REPLY_URL, {
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

    const data = await res.json().catch(() => ({}));
    console.log("✅ [replyMessage] ส่งข้อความเรียบร้อย:", data);
  } catch (error) {
    console.error("❌ Error sending reply message:", error);
  }
}

/**
 * ✅ จัดการ Event ที่มาจาก LINE
 */
export async function handleLineEvent(event) {
  console.log("🔥 [handleLineEvent Triggered] Event:", event);

  let replyMessages = [];

  try {
    // ✅ กรณีลูกค้าเพิ่มเพื่อน
    if (event.type === "follow") {
      console.log("📥 Event: follow");

      replyMessages.push({
        type: "text",
        text:
          "ขอบคุณที่เพิ่มเพื่อนค่ะ 💕 ยินดีต้อนรับสู่ PGTHAI289\n" +
          "เว็บมั่นคง ปลอดภัย ฝาก-ถอนออโต้\n" +
          "🔥 สมัครวันนี้ หนูแถมใจให้ทันทีเลยค่าพี่ บริการไม่ดียินดีคืนเงิน! 🔥",
      });

      replyMessages.push(createFlexMenu());

      await sendTelegramAlert(`📥 ลูกค้าใหม่เพิ่มเพื่อน (LINE OA: PGTHAI289)\nID: ${event.source?.userId}`);

      await replyMessage(event.replyToken, replyMessages);
      return;
    }

    // ✅ กรณีลูกค้าส่งข้อความ หรือ กดปุ่ม Postback
    if (event.type === "message" || event.type === "postback") {
      console.log("💬 Event: message/postback", event.type);

      const flowResult = await handleCustomerFlow(event);
      console.log("📩 Flow Result:", flowResult);

      if (Array.isArray(flowResult)) {
        replyMessages.push(...flowResult.filter((m) => m.type));
      } else if (typeof flowResult === "string") {
        replyMessages.push({ type: "text", text: flowResult });
      }

      console.log("📝 replyMessages ก่อนเพิ่ม Flex:", replyMessages);

      // ✅ ตรวจสอบว่าต้องเพิ่ม Flex Menu หรือไม่
      const skipFlex =
        Array.isArray(flowResult) && flowResult.some((m) => m.skipFlex === true);

      if (!skipFlex) {
        replyMessages.push(createFlexMenu());
      }

      console.log("✅ replyMessages ที่จะส่ง:", replyMessages);

      await replyMessage(event.replyToken, replyMessages);
    }
  } catch (error) {
    console.error("❌ handleLineEvent Error:", error);

    await replyMessage(event.replyToken, [
      {
        type: "text",
        text:
          "ขออภัยค่ะ 😥 รอสักครู่นะคะพี่แอดมินตรวจสอบให้ค่ะ\n" +
          "หากยังมีปัญหา แอดมินจะรีบช่วยเหลือคุณพี่โดยเร็วค่ะ 💕",
      },
    ]);
  }
}
