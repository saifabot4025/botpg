import express from "express";
import line from "@line/bot-sdk";
import dotenv from "dotenv";
import { handleLineEvent } from "./controllers/lineController.js";

dotenv.config();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

console.log("🚀 TOKEN:", process.env.LINE_CHANNEL_ACCESS_TOKEN);
console.log("🚀 SECRET:", process.env.LINE_CHANNEL_SECRET);

const app = express();
app.use(express.json());

app.post("/webhook", line.middleware(config), (req, res) => {
  console.log("📩 Incoming Event:", req.body.events); // ดูว่า LINE ส่งอะไรมา

  Promise.all(req.body.events.map(handleLineEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error("❌ Error in webhook:", err);
      res.status(500).end();
    });
});

app.get("/", (req, res) => res.send("LINE Bot is running!"));

app.listen(3000, () => console.log("✅ Bot is running on port 3000"));
