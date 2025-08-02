
/* ================== FLOW MANAGER (FINAL + CRM + GPT VARIETY) ================== */
import { getCuteDynamicReply } from "../services/gptService.js";
import { sendTelegramAlert, sendTelegramPhoto, getLineProfile } from "../services/telegramService.js";
import { getLineImage } from "../services/lineMediaService.js";
import fs from "fs";
import path from "path";

/* ================== STATE MANAGEMENT ================== */
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
      chatHistory: [],
      totalDeposit: 0
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

/* ✅ ใช้ GPT สุ่มชื่อแบบ Dynamic */
async function getRandomName() {
  const prompt = "สุ่มรายชื่อคนไทย 1 ชื่อ (อาจเป็นชายหรือหญิง) ตอบแค่ชื่อเดียว";
  try {
    const name = await getCuteDynamicReply(prompt);
    return name.replace(/\n/g, "").trim();
  } catch {
    const fallbackNames = ["สมชาย", "กิตติ", "อนันต์", "วีรพล", "ณัฐพล", "ปกรณ์", "นที", "วิทยา", "สมหญิง", "ศิริพร"];
    return fallbackNames[Math.floor(Math.random() * fallbackNames.length)];
  }
}

/* ✅ แจ้งเตือนแอดมินผ่าน Telegram */
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

/* ✅ Dynamic Prompt */
async function generateDynamicPrompt(type) {
  let prompt = "";
  if (type === "welcome") prompt = "สุ่มคำทักทายลูกค้าแบบน่ารัก 1 ประโยค";
  if (type === "ask_info") prompt = "สุ่มประโยคขอข้อมูลลูกค้า (ชื่อ-นามสกุล เบอร์โทร บัญชี/วอเลท ไลน์)";
  if (type === "confirm_info") prompt = "สุ่มประโยคแจ้งว่ารับข้อมูลแล้ว 1 ประโยค";
  try {
    const msg = await getCuteDynamicReply(prompt);
    return msg.replace(/\n/g, "").trim();
  } catch {
    if (type === "welcome") return "🎉 ยินดีต้อนรับค่า มาสนุกกันเลยนะคะ 💕";
    if (type === "ask_info") return "ขอข้อมูล ชื่อ-นามสกุล เบอร์โทร บัญชี/วอเลท และไอดีไลน์ด้วยนะคะ 💕";
    if (type === "confirm_info") return "ได้รับข้อมูลแล้วค่ะ ทีมงานกำลังดูแลให้นะคะ 💕";
  }
}

/* ================== RANDOMIZED MESSAGES ================== */
let cachedMaxWithdrawDate = null;
let cachedMaxWithdrawAmount = null;
let cachedMaxWithdrawName = null;

async function generateWithdrawReviewMessage() {
  const reviews = [];
  for (let i = 0; i < 10; i++) {
    const phone = randomMaskedPhone();
    const amount = (Math.floor(Math.random() * 45000) + 5000).toLocaleString();
    reviews.push(`ยูส ${phone} ถอน ${amount}`);
  }
  try {
    const extraText = await getCuteDynamicReply("สร้างประโยคปิดท้ายรีวิวถอนเงินแบบมั่นคง ปลอดภัย 1 ประโยค");
    return `📊 รีวิวการถอนล่าสุด\n\n${reviews.join("\n")}\n\n${extraText.trim()}`;
  } catch {
    return `📊 รีวิวการถอนล่าสุด\n\n${reviews.join("\n")}\n\nเว็บมั่นคง จ่ายจริง 💕`;
  }
}

async function generateMaxWithdrawMessage() {
  const today = new Date().toLocaleDateString("th-TH");
  if (cachedMaxWithdrawDate !== today) {
    cachedMaxWithdrawDate = today;
    cachedMaxWithdrawAmount = Math.floor(Math.random() * 200000) + 300000;
    cachedMaxWithdrawName = await getRandomName();
  }
  const phone = randomMaskedPhone();
  return `👑 ยอดถอนสูงสุดวันนี้\n\nยินดีกับคุณ "${cachedMaxWithdrawName}" ยูส ${phone} ถอน ${cachedMaxWithdrawAmount.toLocaleString()} บาท\nวันที่ ${cachedMaxWithdrawDate}`;
}

async function generateTopGameMessage() {
  const games = ["สาวถ้ำ", "กิเลน", "Lucky Neko", "Fortune Ox", "Dragon Hatch", "Fortune Rabbit"];
  const selected = games.sort(() => 0.5 - Math.random()).slice(0, 5);
  let msg = "🎲 เกมสล็อตแตกบ่อยวันนี้\n\n";
  selected.forEach((g, i) => { msg += `${i + 1}. ${g}\n`; });
  try {
    const extra = await getCuteDynamicReply("เขียนประโยคชวนเล่นสล็อตแตกง่ายแบบน่ารัก 1 ประโยค");
    return msg + extra.trim();
  } catch {
    return msg + "เล่นง่าย แตกบ่อย จ่ายจริง 💕";
  }
}

async function generateReferralCommissionMessage() {
  const lines = [];
  for (let i = 0; i < 10; i++) {
    const phone = randomMaskedPhone();
    const amount = (Math.floor(Math.random() * 97000) + 3000).toLocaleString();
    lines.push(`ยูส ${phone} ได้ค่าคอมมิชชั่น ${amount}`);
  }
  try {
    const extra = await getCuteDynamicReply("ประโยคชวนชวนเพื่อนรับค่าคอมแบบน่ารัก 1 ประโยค");
    return `🤝 ค่าคอมมิชชั่นแนะนำเพื่อน\n\n${lines.join("\n")}\n\n${extra.trim()}`;
  } catch {
    return `🤝 ค่าคอมมิชชั่นแนะนำเพื่อน\n\n${lines.join("\n")}\n\n💡 ชวนเพื่อนมาสร้างรายได้ง่ายๆ ได้ทุกวัน!`;
  }
}

/* ================== FLEX MENU ================== */
function createFlexMenuContents() {
  return {
    type: "carousel",
    contents: [
      {
        type: "bubble",
        hero: { type: "image", url: "https://i.ibb.co/SqbNcr1/image.jpg", size: "full", aspectRatio: "20:13", aspectMode: "cover" },
        body: { type: "box", layout: "vertical", contents: [ { type: "text", text: "PGTHAI289", weight: "bold", size: "xl", color: "#FFD700" }, { type: "text", text: "มั่นคงปลอดภัย จ่ายจริง", size: "sm", color: "#FFFFFF" } ] },
        footer: { type: "box", layout: "vertical", contents: [
          { type: "button", style: "primary", color: "#A569BD", action: { type: "postback", label: "⭐ สมัครเอง", data: "register_admin" }},
          { type: "button", style: "secondary", color: "#BB8FCE", action: { type: "postback", label: "📲 ให้แอดมินสมัครให้", data: "register_admin" }},
          { type: "button", style: "primary", color: "#A569BD", action: { type: "postback", label: "🔑 ทางเข้าเล่นหลัก", data: "login_backup" }},
          { type: "button", style: "secondary", color: "#BB8FCE", action: { type: "postback", label: "🚪 ทางเข้าเล่นสำรอง", data: "login_backup" }},
        ]}
      },
      {
        type: "bubble",
        hero: { type: "image", url: "https://i.ibb.co/SqbNcr1/image.jpg", size: "full", aspectRatio: "20:13", aspectMode: "cover" },
        body: { type: "box", layout: "vertical", contents: [ { type: "text", text: "PGTHAI289", weight: "bold", size: "xl", color: "#FFD700" }, { type: "text", text: "มั่นคงปลอดภัย จ่ายจริง", size: "sm", color: "#FFFFFF" } ] },
        footer: { type: "box", layout: "vertical", contents: [
          { type: "button", style: "primary", color: "#A569BD", action: { type: "postback", label: "💰 ปัญหาฝาก/ถอน", data: "issue_deposit" }},
          { type: "button", style: "secondary", color: "#BB8FCE", action: { type: "postback", label: "🔑 ลืมรหัสผ่าน", data: "forgot_password" }},
          { type: "button", style: "primary", color: "#A569BD", action: { type: "postback", label: "🚪 เข้าเล่นไม่ได้", data: "login_backup" }},
          { type: "button", style: "secondary", color: "#BB8FCE", action: { type: "postback", label: "🎁 โปรโมชั่น/กิจกรรม", data: "promo_info" }},
        ]}
      },
      {
        type: "bubble",
        hero: { type: "image", url: "https://i.ibb.co/SqbNcr1/image.jpg", size: "full", aspectRatio: "20:13", aspectMode: "cover" },
        body: { type: "box", layout: "vertical", contents: [ { type: "text", text: "PGTHAI289", weight: "bold", size: "xl", color: "#FFD700" }, { type: "text", text: "มั่นคงปลอดภัย จ่ายจริง", size: "sm", color: "#FFFFFF" } ] },
        footer: { type: "box", layout: "vertical", contents: [
          { type: "button", style: "primary", color: "#A569BD", action: { type: "postback", label: "⭐ รีวิวถอนล่าสุด", data: "review_withdraw" }},
          { type: "button", style: "secondary", color: "#BB8FCE", action: { type: "postback", label: "👑 ถอนสูงสุดวันนี้", data: "max_withdraw" }},
          { type: "button", style: "primary", color: "#A569BD", action: { type: "postback", label: "🎮 เกมแตกบ่อย", data: "top_game" }},
          { type: "button", style: "secondary", color: "#BB8FCE", action: { type: "postback", label: "💎 ค่าคอมแนะนำเพื่อน", data: "referral_commission" }},
        ]}
      }
    ]
  };
}

/* ✅ MAIN FLOW */
export async function handleCustomerFlow(event) {
  const userId = event.source?.userId;
  const state = getUserState(userId);
  const replyMessages = [];
  const userText = event.message?.text?.trim() || "";

  if (userPausedStates[userId]) {
    if (userText.includes("ดำเนินการให้เรียบร้อยแล้วนะคะพี่")) {
      userPausedStates[userId] = false;
      updateUserState(userId, { currentCase: null, caseData: {} });
      replyMessages.push({ type: "text", text: "น้องกลับมาดูแลพี่แล้วค่ะ ขอบคุณมากนะคะ 💕" });
    } else {
      replyMessages.push({ type: "text", text: "ขณะนี้หัวหน้าฝ่ายกำลังดูแลอยู่ รอสักครู่นะคะ 💕" });
    }
    return replyMessages;
  }

  if (event.type === "follow") {
    const welcomeText = await generateDynamicPrompt("welcome");
    replyMessages.push({ type: "text", text: welcomeText });
    replyMessages.push({ type: "flex", altText: "🎀 เมนูพิเศษ", contents: createFlexMenuContents() });
    await notifyAdmin(event, "ลูกค้าเพิ่มเพื่อนใหม่");
    updateUserState(userId, { lastFlexSent: Date.now() });
    return replyMessages;
  }

  if (event.type === "postback" && event.postback?.data) {
    const data = event.postback.data;
    let msg = "";
    switch (data) {
      case "register_admin": msg = await generateDynamicPrompt("ask_info"); break;
      case "login_backup": msg = await getCuteDynamicReply("แจ้งชื่อและเบอร์โทรที่สมัครไว้เพื่อตรวจสอบการเข้าเล่น"); break;
      case "issue_deposit": msg = await getCuteDynamicReply("แจ้งชื่อ+เบอร์โทร และส่งสลิปฝากเงินให้ตรวจสอบ"); break;
      case "issue_withdraw": msg = "ระบบกำลังดำเนินการถอนให้ค่ะ รอ 3-5 นาที 💕"; break;
      case "forgot_password": msg = "แจ้งชื่อ+เบอร์โทรที่สมัครไว้ เดี๋ยวน้องจะช่วยรีเซ็ตให้ค่ะ 💕"; break;
      case "promo_info": msg = "ตอนนี้มีโปรสมัครใหม่ ฝากแรก และคืนยอดเสีย สนใจโปรไหนคุยกับน้องได้เลยค่ะ 💕"; break;
      case "review_withdraw": msg = await generateWithdrawReviewMessage(); break;
      case "max_withdraw": msg = await generateMaxWithdrawMessage(); break;
      case "top_game": msg = await generateTopGameMessage(); break;
      case "referral_commission": msg = await generateReferralCommissionMessage(); break;
    }
    replyMessages.push({ type: "text", text: msg });
    return replyMessages;
  }

  if (state.currentCase && (userText.length > 3 || event.message?.type === "image")) {
    await notifyAdmin(event, `ข้อมูลจากลูกค้า (เคส ${state.currentCase}): ${userText || "ส่งรูป"}`);
    replyMessages.push({ type: "text", text: await generateDynamicPrompt("confirm_info") });
    userPausedStates[userId] = true;
    return replyMessages;
  }

  if (event.type === "message" && shouldSendFlex(userId)) {
    replyMessages.push({ type: "flex", altText: "🎀 เมนูพิเศษ", contents: createFlexMenuContents() });
    updateUserState(userId, { lastFlexSent: Date.now() });
  }

  try {
    const gptReply = await getCuteDynamicReply(userText);
    replyMessages.push({ type: "text", text: gptReply });
    await notifyAdmin(event, userText || "ลูกค้าส่งข้อความ/รูป");
    return replyMessages;
  } catch {
    replyMessages.push({ type: "text", text: "เกิดข้อผิดพลาด กรุณาลองใหม่ค่ะ 💕" });
    return replyMessages;
  }
}

/* ================== CRM AUTO-SEND ================== */
export function initCRM(lineClient) {
  setInterval(async () => {
    const now = Date.now();
    const inactive = Object.keys(userStates).filter(uid => now - (userStates[uid]?.lastActive || 0) > 3 * 24 * 60 * 60 * 1000);
    for (const uid of inactive) {
      try {
        const followText = await getCuteDynamicReply("สร้างข้อความชวนลูกค้าที่หายไป 3 วันกลับมาเล่น PGTHAI289 แบบน่ารัก 1 ประโยค");
        await lineClient.pushMessage(uid, { type: "text", text: followText });
        await lineClient.pushMessage(uid, { type: "flex", altText: "🎀 กลับมาเล่นกับเรา 🎀", contents: createFlexMenuContents() });
        await sendTelegramAlert(`📢 CRM ส่งข้อความหา: ${uid}`);
        updateUserState(uid, { lastActive: Date.now() });
      } catch (err) {
        console.error("CRM Error:", err);
      }
    }
  }, 6 * 60 * 60 * 1000);
}
