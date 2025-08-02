import fs from "fs";
import path from "path";
import { sendTelegramAlert } from "../services/telegramService.js";

const DB_PATH = path.resolve("./crm-data.json");

// ✅ โหลดฐานข้อมูลลูกค้า
function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ users: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

// ✅ บันทึกฐานข้อมูลลูกค้า
function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// ✅ เพิ่มหรืออัปเดตกิจกรรมลูกค้า
export function updateUserActivity(userId) {
  const db = loadDB();
  const now = new Date().toISOString();

  let user = db.users.find((u) => u.userId === userId);
  if (!user) {
    user = { userId, lastActive: now, messagesSent: 0, lastFollowUp: null };
    db.users.push(user);
  } else {
    user.lastActive = now;
  }

  saveDB(db);
}

// ✅ ส่งข้อความผ่าน LINE
async function sendLineMessage(lineClient, userId, text) {
  try {
    await lineClient.pushMessage(userId, [{ type: "text", text }]);
    console.log(`📨 ส่งข้อความถึง ${userId}: ${text}`);
  } catch (err) {
    console.error(`❌ Error sending message to ${userId}:`, err);
  }
}

// ✅ ตรวจสอบและส่ง Follow-Up
async function checkFollowUps(lineClient) {
  const db = loadDB();
  const now = new Date();

  const followUpDays = [3, 7, 15, 30];

  for (const user of db.users) {
    const lastActive = new Date(user.lastActive);
    const inactiveDays = Math.floor((now - lastActive) / (1000 * 60 * 60 * 24));

    for (const day of followUpDays) {
      if (inactiveDays === day && user.lastFollowUp !== day) {
        const message = generateFollowUpMessage(day);
        await sendLineMessage(lineClient, user.userId, message);
        await sendTelegramAlert(`📢 [Follow-Up] ส่งข้อความถึงลูกค้า ${user.userId} (ไม่ได้คุยมา ${day} วัน)`);

        user.lastFollowUp = day;
        saveDB(db);
      }
    }
  }
}

// ✅ สร้างข้อความ Follow-Up แบบไม่จำเจ
function generateFollowUpMessage(day) {
  const templates = {
    3: [
      "น้องแอดมินคิดถึงพี่แล้วน้า 💕 เข้ามาสนุกกับ PGTHAI289 กันหน่อยมั้ยคะ?",
      "ไม่ได้เจอกัน 3 วันแล้วนะ! วันนี้ลองเล่นเกมใหม่ ๆ กับน้องไหมคะ? 🎰",
    ],
    7: [
      "ครบอาทิตย์แล้วน้า พี่หายไปไหนเอ่ย? 💖 กลับมาลองเสี่ยงโชคกันเถอะ!",
      "วันนี้มีโบนัสเด็ด ๆ รอพี่อยู่ค่ะ 💎 แอดมินเลยอยากชวนพี่กลับมาสนุกด้วยกัน!",
    ],
    15: [
      "คิดถึงจังเลยยยย 💕 น้องรอพี่กลับมาเล่นด้วยกันนะคะ",
      "พี่ไม่มาเล่นตั้ง 15 วันแล้ว! มาลองเกมใหม่ ๆ ที่แตกง่ายกันค่า 💥",
    ],
    30: [
      "ครบเดือนแล้วนะพี่ 💖 น้องแอดมินรออยู่ กลับมาสนุกกันเถอะค่า!",
      "พี่หายไปนานเลย 🥹 มาลองเสี่ยงโชคกับเกมแตกหนัก ๆ กันค่ะ!",
    ],
  };

  const msgs = templates[day] || ["น้องแอดมินคิดถึงพี่แล้วน้า 💕"];
  return msgs[Math.floor(Math.random() * msgs.length)];
}

// ✅ เริ่มระบบ CRM
export function initCRM(lineClient) {
  console.log("🚀 CRM System Started");

  // เช็ก Follow-Up ทุก 1 ชั่วโมง
  setInterval(() => {
    console.log("⏳ ตรวจสอบลูกค้าที่หายไป...");
    checkFollowUps(lineClient);
  }, 60 * 60 * 1000); // 1 ชั่วโมง
}
