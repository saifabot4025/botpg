import express from "express";
import line from "@line/bot-sdk";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

// ✅ เช็คว่าเซิร์ฟเวอร์ทำงาน
app.get("/", (req, res) => {
  res.send("Bot is running!");
});

// ✅ Webhook จาก LINE
app.post("/webhook", line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then(() => res.status(200).end())
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// ✅ ฟังก์ชันจัดการข้อความ
async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") {
    return Promise.resolve(null);
  }

  const replyText = `คุณพิมพ์ว่า: ${event.message.text}`;

  return client.replyMessage(event.replyToken, {
    type: "text",
    text: replyText,
  });
}

app.listen(3000, () => {
  console.log("Bot is running on port 3000");
});
