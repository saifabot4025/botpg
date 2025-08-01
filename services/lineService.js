
import line from "@line/bot-sdk";
import dotenv from "dotenv";
import { flexMenu } from "../utils/flexMenu.js";

dotenv.config();

const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});

export const replyMessage = async (replyToken, text) => {
  await client.replyMessage(replyToken, { type: "text", text });
};

export const pushFlexMenu = async (userId) => {
  await client.pushMessage(userId, flexMenu);
};
