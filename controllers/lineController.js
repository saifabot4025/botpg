import fetch from "node-fetch";
import { createFlexMenu } from "../utils/flexMenu.js";
import { handleFlow } from "../utils/flowManager.js";

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
  let messages = [];

  if (event.type === "follow") {
    messages.push({ type: "text", text: "ขอบคุณที่เพิ่มเพื่อนค่ะ 💕" });
    messages.push(createFlexMenu());
    await replyMessage(event.replyToken, messages);
    return;
  }

  if (event.type === "message" || event.type === "postback") {
    const flowResponse = await handleFlow(event);
    if (flowResponse) {
      messages.push({ type: "text", text: flowResponse });
    }
    messages.push(createFlexMenu());
    await replyMessage(event.replyToken, messages);
  }
}
