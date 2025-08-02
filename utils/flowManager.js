// ================== FLOW MANAGER (ULTIMATE + CRM) ==================
import { getCuteDynamicReply } from "../services/gptService.js";
import { sendTelegramAlert, sendTelegramPhoto, getLineProfile } from "../services/telegramService.js";
import { getLineImage } from "../services/lineMediaService.js";
import line from "@line/bot-sdk";

// ================== STATE MANAGEMENT ==================
const userStates = {};
const userPausedStates = {};
const flexCooldown = 2 * 60 * 60 * 1000; // 2 ชั่วโมง

function getUserState(userId) {
  if (!userStates[userId]) {
    userStates[userId] = {
      lastFlexSent: 0,
      currentCase: null,
      caseData: {},
      lastActive: Date.now(),
      greeted: false,
    };
  }
  return userStates[userId];
}

function updateUserState(userId, newState) {
  userStates[userId] = { ...getUserState(userId), ...newState };
}

function shouldSendFlex(userId) {
  const state = getUserState(userId);
  return Date.now() - state.lastFlexSent > flexCooldown;
}

function randomMaskedPhone() {
  const prefix = "08";
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}xxxx${suffix}`;
}

async function getRandomName() {
  const prompt = "สุ่มรายชื่อคนไทย 1 ชื่อ (ผู้ชาย) เพียงชื่อเดียว ตอบแค่ชื่อเท่านั้น";
  try {
    const name = await getCuteDynamicReply(prompt);
    return name.replace(/\n/g, "").trim();
  } catch {
    const fallbackNames = ["สมชาย", "กิตติ", "อนันต์", "วีรพล", "ณัฐพล", "ปกรณ์", "นที", "วิทยา"];
    return fallbackNames[Math.floor(Math.random() * fallbackNames.length)];
  }
}

// แจ้งเตือนแอดมินผ่าน Telegram
async function notifyAdmin(event, message) {
  try {
    const profile = await getLineProfile(event.source?.userId);
    const displayName = profile?.displayName || "ไม่ทราบชื่อ";
    const oaName = process.env.LINE_OA_NAME || "ไม่ทราบ OA";

    const text = `📢 แจ้งเตือนจาก ${oaName}\n👤 ลูกค้า: ${displayName}\n💬 ข้อความ: ${message}`;
    await sendTelegramAlert(text);

    if (event.message?.type === "image" && event.message.id) {
      const photoBuffer = await getLineImage(event.message.id);
      if (photoBuffer) {
        await sendTelegramPhoto(photoBuffer, `📷 รูปจากลูกค้า (${displayName})`);
      }
    }
  } catch (err) {
    console.error("notifyAdmin Error:", err);
  }
}

// ================== RANDOMIZED MESSAGES ==================
let cachedMaxWithdrawDate = null;
let cachedMaxWithdrawAmount = null;
let cachedMaxWithdrawName = null;

async function generateWithdrawReviewMessage() {
  const reviews = [];
  for (let i = 0; i < 10; i++) {
    const phone = randomMaskedPhone();
    const amount = (Math.floor(Math.random() * (50000 - 5000)) + 5000).toLocaleString();
    reviews.push(`ยูส ${phone} ถอน ${amount}`);
  }
  return `📊 รีวิวการถอนล่าสุด\n\n${reviews.join("\n")}`;
}

async function generateMaxWithdrawMessage() {
  const today = new Date().toLocaleDateString("th-TH");
  if (cachedMaxWithdrawDate !== today) {
    cachedMaxWithdrawDate = today;
    cachedMaxWithdrawAmount = Math.floor(Math.random() * (500000 - 300000)) + 300000;
    cachedMaxWithdrawName = await getRandomName();
  }
  const phone = randomMaskedPhone();
  return `👑 ยอดถอนสูงสุดวันนี้\n\nยินดีกับคุณพี่ "${cachedMaxWithdrawName}" ยูส ${phone} ถอน ${cachedMaxWithdrawAmount.toLocaleString()} บาท\nวันที่ ${cachedMaxWithdrawDate}`;
}

async function generateTopGameMessage() {
  const games = [
    "Graffiti Rush • กราฟฟิตี้ รัช",
    "Treasures of Aztec • สาวถ้ำ",
    "Fortune Ox • วัวโดด",
    "Fortune Snake • งู",
    "Fortune Rabbit • เกมกระต่าย",
    "Lucky Neko • ลัคกี้ เนโกะ แมว",
    "Fortune Mouse • เกมหนูสามแถว",
    "Dragon Hatch • เกมมังกร",
    "Wild Bounty Showdown • คาวบอย",
    "Ways of the Qilin • กิเลน",
    "Galaxy Miner • อวกาศพาโชค",
    "Incan Wonders • สัญลักษณ์ชนเผ่า",
    "Diner Frenzy Spins • อาหารมั่งคั่ง",
    "Dragon's Treasure Quest • มังกรซ่อนสมบัติ",
    "Jack the Giant Hunter • แจ็กผู้ฆ่ายักษ์",
  ];
  const selected = games.sort(() => 0.5 - Math.random()).slice(0, 5);
  const randomPercent = () => Math.floor(Math.random() * 50) + 50;
  const freeSpinAmount = Math.floor(Math.random() * (200000 - 20000)) + 20000;
  const normalAmount = Math.floor(Math.random() * (50000 - 3000)) + 3000;

  let msg = "🎲 เกมสล็อตแตกบ่อยวันนี้\n\n";
  selected.forEach((g, i) => {
    msg += `${i + 1}. ${g} - ${randomPercent()}%\n`;
  });
  msg += `\n💥 ฟรีสปินแตกล่าสุด: ${freeSpinAmount.toLocaleString()} บาท\n`;
  msg += `💥 ปั่นธรรมดาแตกล่าสุด: ${normalAmount.toLocaleString()} บาท\n`;
  msg += `เล่นง่าย แตกบ่อย จ่ายจริง 💕`;
  return msg;
}

async function generateReferralCommissionMessage() {
  const lines = [];
  for (let i = 0; i < 10; i++) {
    const phone = randomMaskedPhone();
    const amount = (Math.floor(Math.random() * (100000 - 3000)) + 3000).toLocaleString();
    lines.push(`ยูส ${phone} ได้ค่าคอมมิชชั่นจากยอดเล่นเพื่อน ${amount}`);
  }
  return `🤝 ค่าคอมมิชชั่นแนะนำเพื่อน\n\n${lines.join("\n")}\n\n💡 ชวนเพื่อนมาสร้างรายได้ง่ายๆ ได้ทุกวัน!`;
}

// ================== GPT INTENT ==================
async function analyzeUserIntent(userText) {
  const prompt = `
คุณคือระบบวิเคราะห์ Intent ของข้อความลูกค้าเว็บพนัน
- วิเคราะห์ข้อความว่าเกี่ยวข้องกับ: 
  "problem", "finance", "register", "general_question", "emotion"
- ให้ตอบเป็น JSON เช่น: { "intent": "problem", "summary": "ลูกค้าถอนเงินไม่เข้า" }

ข้อความลูกค้า: "${userText}"
  `;
  try {
    const res = await getCuteDynamicReply(prompt);
    return JSON.parse(res);
  } catch {
    return { intent: "unknown", summary: userText };
  }
}

async function generateSmartReply(userText) {
  const intentData = await analyzeUserIntent(userText);
  let prompt = "";

  switch (intentData.intent) {
    case "emotion":
      prompt = `ลูกค้ารู้สึกว่า ${intentData.summary} 
ตอบแบบเพื่อนคุยที่น่ารัก ให้กำลังใจ และชวนเล่นเว็บ pgthai289 เบา ๆ`;
      break;
    case "general_question":
      prompt = `ลูกค้าถามเรื่องทั่วไป (${intentData.summary}) 
ตอบสั้น กระชับ และชวนใช้ pgthai289`;
      break;
    case "register":
      prompt = `ลูกค้าต้องการสมัครสมาชิก 
อธิบายขั้นตอนสมัคร pgthai289 แบบกระชับ ถ้าสมัครไม่ได้ให้บอกว่ากดปุ่มสมัครให้ได้`;
      break;
    case "finance":
      prompt = `ลูกค้าสนใจเรื่องการเงิน (${intentData.summary}) 
ตอบข้อมูลวิธีฝาก-ถอน pgthai289 แบบละเอียด และเชิญชวนให้ทำรายการ`;
      break;
    case "problem":
      prompt = `ลูกค้ามีปัญหา (${intentData.summary}) 
ตอบสุภาพ ให้คำแนะนำแก้ปัญหา และบอกว่าสามารถให้หัวหน้าฝ่ายช่วยดูแลต่อได้`;
      break;
    default:
      prompt = `ตอบอย่างสุภาพ เป็นกันเอง และชวนเล่น pgthai289 เบา ๆ: "${userText}"`;
  }

  return await getCuteDynamicReply(prompt);
}

// ================== FLEX MENU ==================
function createFlexMenuContents() {
  return {
    type: "carousel",
    contents: [
      {
        type: "bubble",
        hero: { type: "image", url: "https://i.ibb.co/SqbNcr1/image.jpg", size: "full", aspectRatio: "20:13", aspectMode: "cover" },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "text", text: "💎 สมัคร + ทางเข้า", weight: "bold", size: "lg", color: "#8E44AD" },
            { type: "text", text: "เริ่มต้นเล่นกับเว็บตรง PGTHAI289 มั่นคง 💯 จ่ายจริง 💵", size: "sm", color: "#4A235A", margin: "sm" },
          ],
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            { type: "button", style: "primary", color: "#8E44AD", height: "sm", action: { type: "uri", label: "✨ สมัครเอง", uri: "https://pgthai289.net/customer/register/LINEBOT/?openExternalBrowser=1" } },
            { type: "button", style: "primary", color: "#8E44AD", height: "sm", action: { type: "postback", label: "🤍 ให้สมัครให้", data: "register_admin" } },
            { type: "button", style: "primary", color: "#8E44AD", height: "sm", action: { type: "uri", label: "🎰 ทางเข้าเล่นหลัก", uri: "https://pgthai289.net/?openExternalBrowser=1" } },
            { type: "button", style: "primary", color: "#8E44AD", height: "sm", action: { type: "postback", label: "🛡 ทางเข้าเล่นสำรอง", data: "login_backup" } },
          ],
        },
        styles: { footer: { separator: true } },
      },
      // BOX 2 และ BOX 3 (แจ้งปัญหา และ รีวิว & เกมแตก) คงแบบเดิม
    ],
  };
}

// ================== MAIN FLOW + CRM ==================
export async function handleCustomerFlow(event) {
  // ... [โค้ดส่วนหลัก handleCustomerFlow เหมือนที่ให้ไว้ก่อนหน้านี้]
}

export function initCRM(lineClient) {
  setInterval(async () => {
    const now = Date.now();
    const inactiveUsers = Object.keys(userStates).filter(
      (uid) => now - userStates[uid].lastActive > 3 * 24 * 60 * 60 * 1000
    );

    for (const uid of inactiveUsers) {
      try {
        const msg = await generateTopGameMessage();
        await lineClient.pushMessage(uid, { type: "text", text: msg });
        await sendTelegramAlert(`📢 CRM ส่งข้อความตามลูกค้า: ${uid}`);
        updateUserState(uid, { lastActive: Date.now() });
      } catch (err) {
        console.error("CRM Error:", err);
      }
    }
  }, 6 * 60 * 60 * 1000);
}

export {
  getUserState,
  updateUserState,
  shouldSendFlex,
  notifyAdmin,
  randomMaskedPhone,
  generateWithdrawReviewMessage,
  generateMaxWithdrawMessage,
  generateTopGameMessage,
  generateReferralCommissionMessage,
  generateSmartReply,
  analyzeUserIntent,
  createFlexMenuContents,
};
