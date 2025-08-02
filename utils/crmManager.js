import sqlite3 from "sqlite3";
import { open } from "sqlite";
import cron from "node-cron";
import { sendTelegramAlert } from "../services/telegramService.js";

let db;
let lineClient;

// ✅ ฟังก์ชันเริ่มต้น CRM + สร้างตาราง
export async function initCRM(client) {
  lineClient = client;
  db = await open({
    filename: "./crm.db",
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      userId TEXT PRIMARY KEY,
      displayName TEXT,
      lastActive INTEGER
    )
  `);

  console.log("✅ CRM Database Initialized");

  // ตั้งเวลา cron job (ทุกวันเที่ยง)
  cron.schedule("0 12 * * *", () => {
    sendAutoFollowUp();
  });
}

// ✅ บันทึกกิจกรรมลูกค้า
export async function trackUserActivity(userId, displayName = "ไม่ทราบชื่อ") {
  const now = Date.now();
  const existing = await db.get("SELECT * FROM customers WHERE userId = ?", [userId]);

  if (existing) {
    await db.run("UPDATE customers SET lastActive = ?, displayName = ? WHERE userId = ?", [
      now,
      displayName,
      userId,
    ]);
  } else {
    await db.run("INSERT INTO customers (userId, displayName, lastActive) VALUES (?, ?, ?)", [
      userId,
      displayName,
      now,
    ]);
  }
}

// ✅ Template ข้อความแบบสุ่ม
function getRandomMessageTemplate(days, name) {
  const templates = {
    3: [
      `👋 สวัสดีค่ะคุณ${name} ไม่เจอกัน 3 วันแล้วนะคะ 🎉 วันนี้มีเกมดี ๆ รออยู่เลย`,
      `💎 คุณ${name} หายไป 3 วันแล้วน้าา กลับมาลองเกมที่กำลังฮิตกันหน่อยไหมคะ`,
      `🔥 คุณ${name} หายไป 3 วัน! ช่วงนี้หลายคนปั่นเกมกันสนุกเลย มาลองด้วยกันมั้ยคะ`,
    ],
    7: [
      `📅 คุณ${name} ไม่ได้เข้ามา 7 วันแล้ว 🎁 มีโปรดี ๆ รออยู่นะคะ`,
      `💖 คิดถึงคุณ${name} จังเลยค่ะ 7 วันแล้วนะ มาเจอกันหน่อยน้า`,
      `🎲 คุณ${name} หายไปนาน 7 วันเลย! ลองกลับมาสนุกกับเกมใหม่ ๆ ดูสิคะ`,
    ],
    15: [
      `🗓 คุณ${name} ไม่ได้เข้ามา 15 วันแล้วนะคะ ช่วงนี้มีคนถอนรัว ๆ เลยค่ะ`,
      `💥 15 วันแล้วที่ไม่ได้เจอคุณ${name} มาสนุกกับเพื่อน ๆ กันอีกครั้งน้า`,
      `🚀 คุณ${name} หายไป 15 วัน! กลับมาลุ้นโชคกันหน่อยมั้ยคะ`,
    ],
    30: [
      `⏳ คุณ${name} หายไป 30 วันแล้ว! ตอนนี้มีโบนัสและกิจกรรมใหญ่ ๆ เลยค่ะ`,
      `🎁 30 วันแล้วที่ไม่ได้เจอคุณ${name} กลับมารับสิทธิ์พิเศษกันนะคะ`,
      `✨ คุณ${name} หายไป 30 วันเต็ม! ลองกลับมาสนุกกับเกมที่กำลังมาแรงสิคะ`,
    ],
  };

  const list = templates[days] || templates[3];
  return list[Math.floor(Math.random() * list.length)];
}

// ✅ ฟังก์ชันส่งข้อความหาลูกค้าที่ไม่ Active
async function sendAutoFollowUp() {
  const now = Date.now();
  const customers = await db.all("SELECT * FROM customers");
  let report = "📊 รายงานการส่งข้อความติดต่อลูกค้า\n";

  const targets = [];

  customers.forEach((c) => {
    const days = Math.floor((now - c.lastActive) / (1000 * 60 * 60 * 24));
    if ([3, 7, 15, 30].includes(days)) {
      targets.push({ ...c, days });
    }
  });

  let success = 0;
  let fail = 0;

  for (const t of targets) {
    const msg = getRandomMessageTemplate(t.days, t.displayName || "คุณ");
    try {
      await lineClient.pushMessage(t.userId, [{ type: "text", text: msg }]);
      success++;
    } catch (err) {
      fail++;
      console.error(`❌ ส่งข้อความไปยัง ${t.userId} ล้มเหลว`, err);
    }
  }

  report += `👥 รวมลูกค้าที่เข้าเกณฑ์: ${targets.length} คน\n`;
  report += `✅ ส่งสำเร็จ: ${success} คน\n❌ ส่งล้มเหลว: ${fail} คน`;

  await sendTelegramAlert(report);
  console.log(report);
}

// ✅ ฟังก์ชันทดสอบส่งทันที (ไม่ต้องรอเวลา)
export async function testFollowUp() {
  await sendAutoFollowUp();
}
