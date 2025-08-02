import { sendTelegramAlert } from "./services/telegramService.js";

(async () => {
  await sendTelegramAlert("🚨 ทดสอบแจ้งเตือน Telegram จากระบบ LINE BOT");
  console.log("ส่งข้อความทดสอบเสร็จ");
})();
