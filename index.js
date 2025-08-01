import express from "express";
import crypto from "crypto";
import dotenv from "dotenv";
import { handleLineEvent } from "./controllers/lineController.js";

dotenv.config();

const app = express();

const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;

if (!CHANNEL_ACCESS_TOKEN || !CHANNEL_SECRET) {
  console.error("❌ ERROR: Missing LINE_CHANNEL_ACCESS_TOKEN or LINE_CHANNEL_SECRET in .env");
  process.exit(1);
}

// ✅ ใช้ express.json() เก็บ raw body (ต้องใช้สำหรับตรวจ signature)
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// ✅ ตรวจสอบ Signature
function verifySignature(req) {
  const signature = crypto
    .createHmac("SHA256", CHANNEL_SECRET)
    .update(req.rawBody)
    .digest("base64");
  const isValid = signature === req.get("x-line-signature");
  console.log("🔑 Signature Valid:", isValid);
  return isValid;
}

// ✅ Webhook Endpoint
app.post("/webhook", async (req, res) => {
  console.log("🔥 [Webhook Triggered]");
  console.log("📩 Headers:", req.headers);
  console.log("📨 Body:", JSON.stringify(req.body, null, 2));

  if (!verifySignature(req)) {
    console.warn("🚨 Signature verification failed!");
    return res.status(403).send("Invalid signature");
  }

  try {
    const results = await Promise.all(
      req.body.events.map((event) => {
        console.log("✅ Event Received:", event);
        return handleLineEvent(event);
      })
    );
    res.json(results);
  } catch (err) {
    console.error("❌ Error handling event:", err);
    res.status(500).send("Internal Server Error");
  }
});

// ✅ Start Server
app.listen(3000, () => {
  console.log("🚀 Bot is running on port 3000");
});
