import express from "express";
import crypto from "crypto";
import dotenv from "dotenv";
import { handleLineEvent } from "./controllers/lineController.js";

dotenv.config();

const app = express();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

function verifySignature(req) {
  const signature = crypto
    .createHmac("SHA256", config.channelSecret)
    .update(req.rawBody)
    .digest("base64");
  return signature === req.get("x-line-signature");
}

app.post("/webhook", (req, res) => {
  if (!verifySignature(req)) {
    return res.status(403).send("Invalid signature");
  }

  Promise.all(req.body.events.map((event) => handleLineEvent(event)))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error("Error handling event:", err);
      res.status(500).end();
    });
});

app.listen(3000, () => {
  console.log("Bot is running on port 3000");
});
