import express from "express";
import line from "@line/bot-sdk";
import dotenv from "dotenv";
import { handleLineEvent } from "./controllers/lineController.js";

dotenv.config();

const app = express();
app.use(express.json());

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    await Promise.all(req.body.events.map((event) => handleLineEvent(event)));
    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Webhook Error:", err);
    res.status(500).send("Error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Bot is running on port ${PORT}`);
});
