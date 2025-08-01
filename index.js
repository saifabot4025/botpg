import express from "express";
import line from "@line/bot-sdk";
import dotenv from "dotenv";
import { handleLineEvent } from "./controllers/lineController.js";

dotenv.config();

const app = express();
app.use(express.json());

// ✅ Config LINE SDK
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

// ✅ เพิ่ม root route เพื่อตรวจสอบว่าเซิร์ฟเวอร์ทำงาน
app.get("/", (req, res) => {
  res.send("LINE Bot is running ✅");
});

// ✅ เพิ่ม webhook endpoint
app.post("/webhook", line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map((event) => handleLineEvent(event)))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// ✅ ทำให้ไม่ error เวลา Verify
app.get("/webhook", (req, res) => {
  res.status(200).send("Webhook OK ✅");
});

// ✅ Start server
app.listen(3000, () => {
  console.log("🚀 Bot is running on port 3000");
});
