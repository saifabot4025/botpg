import { sendTelegramAlert } from "../services/telegramService.js";
import { getCuteDynamicReply } from "./cuteReplies.js";

const activeCases = {}; // เก็บ state ของแต่ละ userId

export async function handleFlow(event) {
  const userId = event.source.userId;
  const userText = event.message?.text || "";

  // ตรวจสอบ state ของลูกค้า
  if (!activeCases[userId]) {
    activeCases[userId] = { step: "start" };
  }

  let response = null;

  // ขั้นตอนเริ่มต้น
  if (activeCases[userId].step === "start") {
    response = await getCuteDynamicReply("สวัสดีค่ะ พี่ต้องการทำรายการอะไรคะ?");
    activeCases[userId].step = "awaiting_issue";
  }

  // ถ้าลูกค้าพิมพ์หรือกดปุ่ม (postback)
  if (event.type === "postback" || userText) {
    const data = event.postback?.data || userText;

    // ✅ สมัครให้
    if (data === "register_admin") {
      response = "รบกวนพี่แจ้ง **ชื่อ-นามสกุล / เบอร์โทร / บัญชีหรือวอเลท / ไอดีไลน์** นะคะ 💕";
      activeCases[userId].step = "awaiting_register_info";
    }

    // ✅ ปัญหาฝาก/ถอน
    if (data === "issue_deposit") {
      response = "พี่เจอปัญหาฝากหรือถอนคะ? ถ้าฝากไม่เข้า รบกวนแจ้ง **ชื่อ+เบอร์โทร** และส่งรูปสลิปให้หนูด้วยนะคะ 📄";
      activeCases[userId].step = "awaiting_deposit_info";
    }

    // ✅ ลืมรหัสผ่าน
    if (data === "forgot_password") {
      response = "พี่แจ้ง **ชื่อ+เบอร์โทรที่สมัคร** ไว้ด้วยนะคะ เดี๋ยวน้องดูให้ค่ะ 💕";
      activeCases[userId].step = "awaiting_forgot_info";
    }

    // ✅ เข้าเล่นไม่ได้
    if (data === "login_issue") {
      response = "พี่แจ้ง **ชื่อ+เบอร์โทร** และแคปภาพที่เข้าไม่ได้มานะคะ 📸";
      activeCases[userId].step = "awaiting_login_info";
    }

    // ✅ โปรโมชั่น
    if (data === "promo_info") {
      response = "โปรโมชันเว็บเรามีเพียบเลยค่ะ 🎁 เดี๋ยวน้องจะบอกคร่าวๆ ให้ก่อนนะคะ แล้วถ้าพี่สนใจโปรไหนบอกหนูได้เลย 💜";
      activeCases[userId].step = "awaiting_promo_followup";
    }

    // ✅ รีวิว / เกมแตก
    if (data === "review_withdraw") {
      response = generateRandomWithdrawList();
    }
    if (data === "review_top") {
      response = generateTopWithdraw();
    }
    if (data === "review_game") {
      response = generateGameStats();
    }
    if (data === "review_commission") {
      response = generateCommissionList();
    }
  }

  // ✅ ถ้าลูกค้าส่งข้อมูลตามที่บอทถาม
  if (activeCases[userId].step?.startsWith("awaiting_") && userText) {
    await sendTelegramAlert(`📩 เคสใหม่จากไลน์ OA\nชื่อไลน์ OA: PGTHAI289\nข้อความ: ${userText}`);
    response = "ได้รับข้อมูลแล้ว น้องกำลังดำเนินการให้นะคะ 💕 รอสักครู่ค่ะ";

    // หยุดตอบจนกว่าฝั่งแอดมินจะพิมพ์ "ดำเนินการให้เรียบร้อยแล้วนะคะพี่"
    activeCases[userId].step = "paused";
  }

  return response;
}

// ✅ ฟังก์ชันสุ่มข้อมูลรีวิว / เกมแตก
function generateRandomWithdrawList() {
  const list = [];
  for (let i = 0; i < 10; i++) {
    const phone = `08xxxx${Math.floor(1000 + Math.random() * 9000)}`;
    const amount = (Math.floor(Math.random() * 45) + 5) * 1000;
    const time = new Date(Date.now() - Math.random() * 1800000)
      .toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    list.push(`ยูส ${phone} ถอน ${amount.toLocaleString()} เวลา ${time}`);
  }
  return list.join("\n");
}

function generateTopWithdraw() {
  const phone = `08xxxx${Math.floor(1000 + Math.random() * 9000)}`;
  const amount = (Math.floor(Math.random() * 450) + 50) * 1000;
  const date = new Date().toLocaleDateString("th-TH");
  return `ยูส ${phone} ถอน ${amount.toLocaleString()} วันที่ ${date}`;
}

function generateGameStats() {
  const games = [
    "Graffiti Rush", "Treasures of Aztec", "Fortune Ox", "Fortune Snake",
    "Fortune Rabbit", "Lucky Neko", "Fortune Mouse", "Dragon Hatch",
    "Wild Bounty Showdown", "Ways of the Qilin", "Galaxy Miner",
    "Incan Wonders", "Diner Frenzy Spins", "Dragon's Treasure Quest",
    "Jack the Giant Hunter",
  ];
  const game = games[Math.floor(Math.random() * games.length)];
  const freeSpin = (Math.floor(Math.random() * 180) + 20) * 1000;
  const normal = (Math.floor(Math.random() * 47) + 3) * 1000;
  const rate = Math.floor(Math.random() * 20) + 80;
  return `${game}\nอัตราการแตก ${rate}%\nฟรีสปินแตก ${freeSpin.toLocaleString()} บาท\nปั่นธรรมดาแตก ${normal.toLocaleString()} บาท`;
}

function generateCommissionList() {
  const list = [];
  for (let i = 0; i < 10; i++) {
    const phone = `08xxxx${Math.floor(1000 + Math.random() * 9000)}`;
    const amount = (Math.floor(Math.random() * 17) + 3) * 1000;
    list.push(`ยูส ${phone} ได้ค่าคอมมิชชั่น ${amount.toLocaleString()} บาท`);
  }
  return list.join("\n");
}
