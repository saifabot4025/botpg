import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

app.post("/webhook", (req, res) => {
  console.log("Webhook event:", req.body); // ดูว่ามี event อะไรส่งมาบ้าง
  return res.status(200).send("OK"); // ส่งกลับ 200 ให้ LINE
});

app.get("/", (req, res) => {
  res.send("Bot is running");
});

app.listen(3000, () => {
  console.log("Bot is running on port 3000");
});
