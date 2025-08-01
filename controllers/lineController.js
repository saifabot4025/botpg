import fetch from "node-fetch";
import { createFlexMenu } from "../utils/flexMenu.js";
import { handleFlow } from "../utils/flowManager.js";

const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

async function replyMessage(replyToken, messages) {
  if (!replyToken || !messages || messages.length === 0) return;

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
  let replyMessages = [];

  // ✅ กรณีลูกค้าเพิ่มเพื่อน
  if (event.type === "follow") {
    replyMessages.push({
      type: "text",
      text: "ขอบคุณที่เพิ่มเพื่อนค่ะ 💕 ยินดีต้อนรับสู่ PGTHAI289 เว็บมั่นคง ปลอดภัย ฝาก-ถอนออโต้ ชวนเพื่อนมาเล่นรับโบนัสเพียบ!",
    });

    replyMessages.push(createFlexMenu());

    await replyMessage(event.replyToken, replyMessages);
    return;
  }

  // ✅ กรณีข้อความหรือกดปุ่ม
  if (event.type === "message" || event.type === "postback") {
    try {
      // 🔹 handleFlow ควร return เป็น array ของ message objects
      const flowResult = await handleFlow(event);

      if (flowResult && Array.isArray(flowResult)) {
        replyMessages.push(...flowResult);
      } else if (typeof flowResult === "string") {
        replyMessages.push({ type: "text", text: flowResult });
      }

      // ✅ ถ้าลูกค้าอยู่ใน flow ที่รอแอดมิน ไม่ต้องส่ง flex menu ซ้ำ
      const shouldSendFlex = !(
        flowResult &&
        typeof flowResult === "object" &&
        flowResult.skipFlex
      );

      if (shouldSendFlex) {
        replyMessages.push(createFlexMenu());
      }

      await replyMessage(event.replyToken, replyMessages);
    } catch (error) {
      console.error("❌ handleLineEvent Error:", error);
      await replyMessage(event.
