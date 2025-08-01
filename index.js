import express from "express";
import crypto from "crypto";
import dotenv from "dotenv";
import { handleLineEvent } from "./controllers/lineController.js";

dotenv.config();

const app = express();

// ✅ โหลดค่าจาก .env
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;

if (!CHANNEL_ACCESS_TOKEN || !CHANNEL_SECRET) {
  console.error("❌ ERROR: Missing LINE_CHANNEL_ACCESS_TOKEN or LINE_CHANNEL_SECRET in .env");
  process.exit(1);
}

// ✅ ใช้ express.json() เพื่อเก็บ raw body (สำหรับตรวจลายเซ็น)
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// ✅ ฟังก์ชันตรวจสอบ Signature
function verifySignature(req) {
  const signature = crypto
    .createHmac("SHA256", CHANNEL_SECRET)
    .update(req.rawBody)
    .digest("base64");
  return signature === req.get("x-line-signature");
}

// ✅ Webhook ของ LINE
app.post("/webhook", async (req, res) => {
  if (!verifySignature(req)) {
    return res.status(403).send("Invalid signature");
  }

  try {
    const results = await Promise.all(
      req.body.events.map((event) => handleLineEvent(event))
    );
    res.json(results);
  } catch (err) {
    console.error("❌ Error handling event:", err);
    res.status(500).send("Internal Server Error");
  }
});

// ✅ เริ่มเซิร์ฟเวอร์
app.listen(3000, () => {
  console.log("🚀 Bot is running on port 3000");
});
