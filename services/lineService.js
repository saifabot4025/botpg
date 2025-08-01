import line from "@line/bot-sdk";
import dotenv from "dotenv";

dotenv.config();

const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

export const replyMessage = async (replyToken, message) => {
  try {
    await client.replyMessage(replyToken, {
      type: "text",
      text: message,
    });
  } catch (err) {
    console.error("❌ replyMessage Error:", err);
  }
};

export const pushFlexMenu = async (userId) => {
  try {
    await client.pushMessage(userId, {
      type: "text",
      text: "นี่คือข้อความต้อนรับจาก LINE Bot 🎉",
    });
  } catch (err) {
    console.error("❌ pushFlexMenu Error:", err);
  }
};
