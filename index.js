import express from "express";
import line from "@line/bot-sdk";
import dotenv from "dotenv";
import { handleLineEvent } from "./controllers/lineController.js";

dotenv.config();

const app = express();
app.use(express.json());

// ✅ ตั้งค่า config LINE SDK
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

// ✅ Route สำหรับเช็คว่าเซิร์ฟเวอร์ทำงานอยู่
app.get("/", (req, res) => {
  res.send("✅ LINE Bot Server is Running!");
});

// ✅ Route สำหรับให้ LINE ใช้ Verify Webhook
app.get("/webhook", (req, res) => {
  res.status(200).send("✅ Webhook Verified");
});

// ✅ Route สำหรับรับ Webhook Event จริง
app.post("/webhook", line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map((event) => handleLineEvent(event)))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error("❌ Webhook Error:", err);
      res.status(500).end();
    });
});

// ✅ Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Bot is running on port ${PORT}`);
});
