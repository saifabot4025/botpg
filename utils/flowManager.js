// ================== FLOW MANAGER (FINAL + CRM + GPT VARIETY) ==================
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

// ✅ ใช้ GPT สุ่มชื่อแบบ Dynamic (กันชื่อซ้ำ + รองรับทั้งชายและหญิง)
let usedNamesToday = new Set();
let currentDate = new Date().toLocaleDateString("th-TH");

async function getRandomName() {
  const today = new Date().toLocaleDateString("th-TH");
  if (today !== currentDate) {
    usedNamesToday.clear(); // ✅ เคลียร์ชื่อเมื่อเปลี่ยนวัน
    currentDate = today;
  }

  for (let i = 0; i < 5; i++) {
    try {
      const name = (await getCuteDynamicReply(`
สุ่มรายชื่อคนไทย 1 ชื่อ (อาจเป็นผู้หญิงหรือผู้ชาย) 
ห้ามใส่นามสกุล ตอบแค่ชื่อเดียว
      `)).replace(/\n/g, "").trim();

      if (name && !usedNamesToday.has(name)) {
        usedNamesToday.add(name);
        return name;
      }
    } catch {}
  }

  // ✅ fallback ถ้า GPT error หรือสุ่มชื่อไม่ได้
  const fallbackNames = [
    "สมชาย", "กิตติ", "อนันต์", "วีรพล", "ณัฐพล", "ปกรณ์", "นที", "วิทยา", // ผู้ชาย
    "สมหญิง", "กัญญา", "ศิริพร", "วาสนา", "จิราพร", "สุพัตรา", "อัญชลี", "พิมพ์ใจ" // ผู้หญิง
  ];

  let name;
  do {
    name = fallbackNames[Math.floor(Math.random() * fallbackNames.length)];
  } while (usedNamesToday.has(name));

  usedNamesToday.add(name);
  return name;
}

// ✅ ฟังก์ชันแจ้งเตือนแอดมิน
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

// ✅ ฟังก์ชันให้ GPT เจนคำพูดแบบสุ่ม (ใช้กับการขอข้อมูล/ทักทาย)
async function generateDynamicPrompt(baseType) {
  let prompt = "";
  if (baseType === "welcome") {
    prompt = `สุ่มคำทักทายลูกค้าแบบน่ารัก 1 ประโยค เช่น "ยินดีต้อนรับค่าา 💕 มาสนุกกันเลย!"`;
  } else if (baseType === "ask_info") {
    prompt = `สุ่มประโยคขอข้อมูลลูกค้า 1 ประโยค (ต้องมี ชื่อ-นามสกุล เบอร์โทร บัญชี/วอเลท และไอดีไลน์) 
    เช่น "ขอข้อมูล ชื่อ-นามสกุล เบอร์โทร บัญชีหรือวอเลท และไอดีไลน์ ด้วยนะคะ 💕"`;
  } else if (baseType === "confirm_info") {
    prompt = `สุ่มประโยคแจ้งว่ารับข้อมูลแล้ว 1 ประโยค เช่น "ได้รับข้อมูลแล้วค่ะ ทีมงานกำลังดำเนินการให้นะคะ 💕"`;
  }

  try {
    const msg = await getCuteDynamicReply(prompt);
    return msg.replace(/\n/g, "").trim();
  } catch {
    if (baseType === "welcome") return "🎉 ยินดีต้อนรับค่า มาสนุกกันเลยนะคะ 💕";
    if (baseType === "ask_info") return "ขอข้อมูล ชื่อ-นามสกุล เบอร์โทร บัญชี/วอเลท และไอดีไลน์ด้วยนะคะ 💕";
    if (baseType === "confirm_info") return "ได้รับข้อมูลแล้วค่ะ ทีมงานกำลังดูแลให้เลยนะคะ 💕";
  }
}
// ================== RANDOMIZED MESSAGES ==================
let cachedMaxWithdrawDate = null;
let cachedMaxWithdrawAmount = null;
let cachedMaxWithdrawName = null;

// ✅ รีวิวการถอนล่าสุด (10 รายการ) – ใช้ตัวเลขสุ่ม + GPT เพิ่มประโยคปิดท้าย
async function generateWithdrawReviewMessage() {
  const reviews = [];
  for (let i = 0; i < 10; i++) {
    const phone = randomMaskedPhone();
    const amount = (Math.floor(Math.random() * (50000 - 5000)) + 5000).toLocaleString();
    reviews.push(`ยูส ${phone} ถอน ${amount}`);
  }

  try {
    const extraText = await getCuteDynamicReply(
      "สร้างประโยคสั้นๆ ปิดท้ายรีวิวถอนเงิน ที่ให้ความรู้สึกมั่นคง ปลอดภัย จ่ายจริง และเป็นกันเอง ใช้ 1 ประโยค"
    );
    return `📊 รีวิวการถอนล่าสุด\n\n${reviews.join("\n")}\n\n${extraText.trim()}`;
  } catch {
    return `📊 รีวิวการถอนล่าสุด\n\n${reviews.join("\n")}\n\nเว็บมั่นคง จ่ายจริง 💕`;
  }
}

// ✅ ยอดถอนสูงสุดประจำวัน (สุ่มชื่อทุกวัน และแสดงเหมือนเดิม 24 ชม.)
async function generateMaxWithdrawMessage() {
  const today = new Date().toLocaleDateString("th-TH");

  if (cachedMaxWithdrawDate !== today) {
    cachedMaxWithdrawDate = today;
    cachedMaxWithdrawAmount = Math.floor(Math.random() * (500000 - 300000)) + 300000;
    cachedMaxWithdrawName = await getRandomName();
  }

  const phone = randomMaskedPhone();
  return `👑 ยอดถอนสูงสุดวันนี้\n\nยินดีกับคุณ "${cachedMaxWithdrawName}" ยูส ${phone} ถอน ${cachedMaxWithdrawAmount.toLocaleString()} บาท\nวันที่ ${cachedMaxWithdrawDate}`;
}

// ✅ เกมแตกบ่อย (สุ่ม 5 เกม) + GPT เพิ่มคำเชิญชวนท้ายข้อความ
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

  try {
    const extraText = await getCuteDynamicReply(
      "สร้างประโยคสั้นๆ เชิญชวนเล่นสล็อตเว็บตรง แตกง่าย จ่ายจริง แบบน่ารัก 1 ประโยค"
    );
    return msg + `${extraText.trim()}`;
  } catch {
    return msg + "เล่นง่าย แตกบ่อย จ่ายจริง 💕";
  }
}

// ✅ ค่าคอมแนะนำเพื่อน (10 รายการ) + GPT เพิ่มคำเชิญชวนท้ายข้อความ
async function generateReferralCommissionMessage() {
  const lines = [];
  for (let i = 0; i < 10; i++) {
    const phone = randomMaskedPhone();
    const amount = (Math.floor(Math.random() * (100000 - 3000)) + 3000).toLocaleString();
    lines.push(`ยูส ${phone} ได้ค่าคอมมิชชั่นจากยอดเล่นเพื่อน ${amount}`);
  }

  try {
    const extraText = await getCuteDynamicReply(
      "สร้างประโยคสั้นๆ ชวนคนชวนเพื่อนมาเล่น รับค่าคอมทุกวัน แบบเป็นกันเอง 1 ประโยค"
    );
    return `🤝 ค่าคอมมิชชั่นแนะนำเพื่อน\n\n${lines.join("\n")}\n\n${extraText.trim()}`;
  } catch {
    return `🤝 ค่าคอมมิชชั่นแนะนำเพื่อน\n\n${lines.join("\n")}\n\n💡 ชวนเพื่อนมาสร้างรายได้ง่ายๆ ได้ทุกวัน!`;
  }
}
// ================== GPT INTENT (FINAL 100%) ==================
import fs from "fs";
import path from "path";

const logPath = path.join(process.cwd(), "intent_logs.json");
let lastRepliesCache = {}; // ✅ ป้องกันตอบซ้ำใน 1 นาที

// ✅ Utility: เก็บ Log Intent & Reply
function logIntent(userText, intent, reply) {
  try {
    const logs = fs.existsSync(logPath)
      ? JSON.parse(fs.readFileSync(logPath, "utf8"))
      : [];
    logs.push({
      time: new Date().toISOString(),
      userText,
      intent,
      reply,
    });
    fs.writeFileSync(logPath, JSON.stringify(logs.slice(-200), null, 2));
  } catch (err) {
    console.error("❌ Error saving intent log:", err);
  }
}

// ✅ Utility: สุ่ม Emoji ตาม Intent
function getEmojiByIntent(intent) {
  const emojiMap = {
    emotion: ["🥰", "💖", "😊", "🤗"],
    finance: ["💸", "🏦", "💳", "💰"],
    register: ["📝", "💎", "✨", "🎉"],
    promotion: ["🎁", "🔥", "💥", "💎"],
    game_suggestion: ["🎰", "🎮", "🔥", "🌟"],
    withdraw_time: ["⌛", "⏳", "💳", "💵"],
    problem: ["🛠", "🔧", "📢", "💬"],
    general_question: ["🤔", "💡", "📌", "✨"],
    unknown: ["💬", "🤝", "🌟", "🎀"],
  };
  const list = emojiMap[intent] || emojiMap.unknown;
  return list[Math.floor(Math.random() * list.length)];
}

// ✅ Template Fallback ถ้า GPT ใช้งานไม่ได้
const fallbackTemplates = {
  emotion: [
    "น้องเข้าใจพี่เลยนะคะ 💕 มาสนุกด้วยกันนะคะ",
    "ไม่เป็นไรนะคะ น้องอยู่ตรงนี้เสมอค่า 🥰",
  ],
  finance: [
    "การฝาก-ถอนที่ pgthai289 ทำง่ายนิดเดียว 💳 ใช้เวลาแค่ 1-3 นาทีเท่านั้นค่า",
    "ฝาก-ถอนออโต้ สะดวก รวดเร็ว ปลอดภัย 100% เลยค่า 💸",
  ],
  register: [
    "สมัครสมาชิกได้ง่ายๆ เลยค่ะ กดปุ่มสมัครเองหรือให้แอดมินช่วยก็ได้ค่า ✨",
    "กดปุ่มสมัครได้เลยค่า ถ้าสมัครไม่ได้แจ้งน้องช่วยสมัครให้เลยน้า 💕",
  ],
  promotion: [
    "ตอนนี้มีโปรสมัครใหม่ ฝากแรก และคืนยอดเสียเพียบเลยค่า 🎁",
    "โปรแรง โบนัสเยอะ มาดูกันได้เลยค่า 💥",
  ],
  game_suggestion: [
    "แนะนำสาวถ้ำ, กิเลน, Lucky Neko เลยค่า แตกง่ายสุดๆ 🎰",
    "ลองสาวถ้ำกับกิเลนดูนะคะ เกมฮิตเลยค่า 🔥",
  ],
  withdraw_time: [
    "ถอนเงินใช้เวลาเพียง 1-3 นาทีเท่านั้นค่ะ ⏳",
    "ระบบถอนออโต้ รวดเร็วทันใจค่า 💳",
  ],
  problem: [
    "ไม่ต้องห่วงนะคะ เดี๋ยวน้องช่วยดูแลให้ค่า 🛠",
    "น้องขอดูแลเรื่องนี้ให้เลยนะคะ 💕",
  ],
  general_question: [
    "ขอบคุณที่ถามนะคะ 💡 สนใจสมัครเล่นด้วยกันได้เลยค่า",
    "น้องพร้อมช่วยเหลือทุกเรื่องเลยค่า 🤗",
  ],
  unknown: [
    "น้องอยู่ตรงนี้เสมอค่ะ 💕 สนใจเล่นกับ pgthai289 แจ้งน้องได้เลยนะคะ",
  ],
};

// ✅ วิเคราะห์ Intent ด้วย GPT
async function analyzeUserIntent(userText) {
  const prompt = `
คุณคือระบบวิเคราะห์ Intent ของข้อความลูกค้าเว็บพนัน
- วิเคราะห์ข้อความว่าเกี่ยวข้องกับ:
  "problem", "finance", "register", "promotion", "game_suggestion", "withdraw_time", "emotion", "general_question"
- ให้ตอบเป็น JSON เช่น:
{ "intent": "problem", "summary": "ลูกค้าถอนเงินไม่เข้า" }

ข้อความลูกค้า: "${userText}"
  `;
  try {
    const res = await getCuteDynamicReply(prompt);
    return JSON.parse(res);
  } catch (err) {
    console.error("❌ analyzeUserIntent Error:", err);
    return { intent: "unknown", summary: userText };
  }
}

// ✅ สร้างคำตอบหลัก
async function generateSmartReply(userText) {
  const cacheKey = userText.trim();
  if (lastRepliesCache[cacheKey] && Date.now() - lastRepliesCache[cacheKey].time < 60 * 1000) {
    return lastRepliesCache[cacheKey].reply;
  }

  const intentData = await analyzeUserIntent(userText);
  let prompt = `
ลูกค้าพูดว่า: "${userText}"
- Intent: ${intentData.intent}
- เขียนคำตอบที่ไม่ซ้ำเดิมทุกครั้ง
- ใช้โทนน่ารัก เป็นกันเอง ใส่ Emoji ให้เหมาะสม
- จำกัดไม่เกิน 2 ประโยค
- แนะนำ pgthai289 เบาๆ
`;

  try {
    const reply = await getCuteDynamicReply(prompt);
    const finalReply = reply.trim() + " " + getEmojiByIntent(intentData.intent);
    logIntent(userText, intentData.intent, finalReply);
    lastRepliesCache[cacheKey] = { reply: finalReply, time: Date.now() };
    return finalReply;
  } catch (err) {
    console.error("❌ generateSmartReply Error:", err);
    const fallback = fallbackTemplates[intentData.intent] || fallbackTemplates.unknown;
    const finalReply = fallback[Math.floor(Math.random() * fallback.length)] + " " + getEmojiByIntent(intentData.intent);
    logIntent(userText, intentData.intent, finalReply);
    return finalReply;
  }
}
// ================== MAIN FLOW (FINAL 100%) ==================
const recentMessages = {}; // เก็บข้อความล่าสุดของ user

function isDuplicateMessage(userId, text) {
  const now = Date.now();
  if (!recentMessages[userId]) {
    recentMessages[userId] = { text, time: now };
    return false;
  }
  if (recentMessages[userId].text === text && now - recentMessages[userId].time < 5000) {
    return true; // ข้อความซ้ำภายใน 5 วิ
  }
  recentMessages[userId] = { text, time: now };
  return false;
}
  // ✅ ป้องกันตอบซ้ำถ้าผู้ใช้ส่งข้อความเดิมภายใน 5 วิ
  if (isDuplicateMessage(userId, userText)) {
    console.log(`⏩ ข้อความซ้ำของ ${userId} ภายใน 5 วิ, ไม่ตอบซ้ำ`);
  }

  // ✅ ถ้าบอทถูก pause → ต้องรอหัวหน้าฝ่ายแก้ไขปลดล็อก
  if (userPausedStates[userId]) {
    if (userText.includes("ดำเนินการให้เรียบร้อยแล้วนะคะพี่")) {
      userPausedStates[userId] = false;
      updateUserState(userId, { currentCase: null, caseData: {} });
      replyMessages.push({ type: "text", text: "น้องกลับมาดูแลพี่แล้วค่ะ ขอบคุณมากนะคะ 💕" });
    } else {
      replyMessages.push({ type: "text", text: "ขณะนี้หัวหน้าฝ่ายแก้ไขกำลังดูแลเรื่องนี้อยู่ รบกวนรอสักครู่นะคะ 💕" });
    }
  }

  // ✅ เมื่อลูกค้าเพิ่มเพื่อนใหม่
  if (event.type === "follow") {
    const welcomePrompt = `
สร้างข้อความต้อนรับลูกค้าเว็บพนันให้ดูน่ารัก สุภาพ และชวนเริ่มต้นเล่นกับ PGTHAI289
ให้ข้อความไม่ซ้ำกันบ่อย แต่ต้องสั้น กระชับ อ่านแล้วอบอุ่น
`;
    try {
      const welcomeText = await getCuteDynamicReply(welcomePrompt);
      replyMessages.push({ type: "text", text: welcomeText });
    } catch {
      replyMessages.push({ type: "text", text: "🎉 ยินดีต้อนรับค่า มาสนุกกับ PGTHAI289 กันเลยนะคะ 💕" });
    }

    replyMessages.push({ type: "flex", altText: "🎀 เมนูพิเศษสำหรับคุณ 🎀", contents: createFlexMenuContents() });
    await notifyAdmin(event, "ลูกค้าเพิ่มเพื่อนใหม่");
    updateUserState(userId, { lastFlexSent: Date.now() });
    return replyMessages;
  }

  // ✅ ตรวจสอบ Postback
  if (event.type === "postback" && event.postback?.data) {
    const data = event.postback.data;
    replyMessages.push({ type: "text", text: `✅ คุณเลือก: ${data}` });

    const caseMap = {
      register_admin: "register_admin",
      login_backup: "login_backup",
      issue_deposit: "issue_deposit",
      issue_withdraw: "issue_withdraw",
      forgot_password: "forgot_password",
      promo_info: "promo_info",
      review_withdraw: "review_withdraw",
      max_withdraw: "max_withdraw",
      top_game: "top_game",
      referral_commission: "referral_commission",
    };

    if (caseMap[data]) {
      updateUserState(userId, { currentCase: caseMap[data], caseData: {} });
    }

    try {
      let msg = "";
      if (data === "register_admin") {
        msg = await getCuteDynamicReply("สร้างข้อความสุภาพ ขอข้อมูลสมัครสมาชิก (ชื่อ-นามสกุล, เบอร์โทร, บัญชี/วอเลท, ไอดีไลน์) ให้ลูกค้าส่งให้แอดมิน");
      } else if (data === "login_backup") {
        msg = await getCuteDynamicReply("สร้างข้อความสุภาพ ขอให้ลูกค้าแจ้งชื่อและเบอร์โทรที่สมัครไว้เพื่อช่วยตรวจสอบการเข้าเล่น");
      } else if (data === "issue_deposit") {
        msg = await getCuteDynamicReply("สร้างข้อความสุภาพ ขอให้ลูกค้าแจ้งชื่อ+เบอร์โทร และส่งสลิปฝากเงินให้แอดมินตรวจสอบ");
      } else if (data === "issue_withdraw") {
        msg = "ระบบกำลังดำเนินการถอนให้ค่ะ รอ 3-5 นาที 💕";
      } else if (data === "forgot_password") {
        msg = "แจ้งชื่อ+เบอร์โทรที่สมัครไว้ เดี๋ยวน้องจะช่วยรีเซ็ตให้ค่ะ 💕";
      } else if (data === "promo_info") {
        msg = "ตอนนี้มีโปรสมัครใหม่ ฝากแรกของวัน และโปรคืนยอดเสีย สนใจโปรไหนคุยกับน้องได้เลยค่ะ 💕";
      } else if (data === "review_withdraw") {
        msg = await generateWithdrawReviewMessage();
      } else if (data === "max_withdraw") {
        msg = await generateMaxWithdrawMessage();
      } else if (data === "top_game") {
        msg = await generateTopGameMessage();
      } else if (data === "referral_commission") {
        msg = await generateReferralCommissionMessage();
      }

      replyMessages.push({ type: "text", text: msg });
    } catch (err) {
      replyMessages.push({ type: "text", text: "เกิดข้อผิดพลาด กรุณาลองอีกครั้งค่ะ 💕" });
    }

    return replyMessages;
  }

  // ✅ ถ้าลูกค้าอยู่ในเคส → เก็บข้อมูลและแจ้งหัวหน้าฝ่าย
  if (state.currentCase && (userText.length > 3 || event.message?.type === "image")) {
    await notifyAdmin(event, `ข้อมูลจากลูกค้า (เคส ${state.currentCase}): ${userText || "ส่งรูป"}`);
    replyMessages.push({ type: "text", text: "ได้รับข้อมูลแล้วค่ะ หัวหน้าฝ่ายกำลังดำเนินการให้นะคะ 💕" });
    userPausedStates[userId] = true;
    return replyMessages;
  }

  // ✅ ส่ง Flex Menu อัตโนมัติทุก 2 ชั่วโมง
  if (event.type === "message" && shouldSendFlex(userId)) {
    replyMessages.push({ type: "flex", altText: "🎀 เมนูพิเศษ", contents: createFlexMenuContents() });
    updateUserState(userId, { lastFlexSent: Date.now() });
  }

  // ✅ GPT ช่วยตอบข้อความทั่วไป
  try {
    const gptReply = await generateSmartReply(userText);
    replyMessages.push({ type: "text", text: gptReply });
    await notifyAdmin(event, userText || "ลูกค้าส่งข้อความ/รูป");
    return replyMessages;
  } catch (error) {
    console.error("GPT Reply error:", error);
    replyMessages.push({ type: "text", text: "ขอโทษค่ะ ระบบขัดข้อง กรุณาลองอีกครั้ง 💕" });
    return replyMessages;
  }
}
// ================== MAIN FLOW (FINAL 100%) ==================
export async function handleCustomerFlow(event) {
  const userId = event.source?.userId;
  const state = getUserState(userId);
  const replyMessages = [];
  const userText = event.message?.text?.trim() || "";

  // ✅ อัปเดตประวัติการคุย
  if (!state.chatHistory) state.chatHistory = [];
  if (userText) state.chatHistory.push({ role: "user", text: userText, time: new Date().toISOString() });
  if (state.chatHistory.length > 10) state.chatHistory.shift(); // เก็บแค่ 10 ข้อความล่าสุด

  // ✅ ถ้าบอทถูก pause
  if (userPausedStates[userId]) {
    if (userText.includes("ดำเนินการให้เรียบร้อยแล้วนะคะพี่")) {
      userPausedStates[userId] = false;
      updateUserState(userId, { currentCase: null, caseData: {} });
      replyMessages.push({ type: "text", text: "น้องกลับมาดูแลพี่แล้วค่ะ ขอบคุณมากนะคะ 💕" });
    } else {
      replyMessages.push({ type: "text", text: "ขณะนี้หัวหน้าฝ่ายกำลังดูแลเรื่องนี้อยู่ รอสักครู่นะคะ 💕" });
    }
    return replyMessages;
  }

  // ✅ เมื่อลูกค้าเพิ่มเพื่อน
  if (event.type === "follow") {
    const welcomePrompt = `
สร้างข้อความต้อนรับลูกค้าเว็บพนันแบบสุภาพ น่ารัก ชวนเริ่มเล่นกับ PGTHAI289
อย่าให้ประโยคซ้ำกันบ่อย ให้เหมือนคนจริง
`;
    const welcomeText = await getCuteDynamicReply(welcomePrompt);

    replyMessages.push({ type: "text", text: welcomeText });
    replyMessages.push({ type: "flex", altText: "🎀 เมนูพิเศษสำหรับคุณ 🎀", contents: createFlexMenuContents() });

    await notifyAdmin(event, "📢 ลูกค้าเพิ่มเพื่อนใหม่");
    updateUserState(userId, { lastFlexSent: Date.now(), customerTag: "NEW" });
    return replyMessages;
  }

  // ✅ ตรวจสอบ Postback
  if (event.type === "postback" && event.postback?.data) {
    const data = event.postback.data;

    // ✅ ให้ GPT ช่วยเจนประโยคตอบ postback แบบไม่ซ้ำ
    const gptConfirmText = await getCuteDynamicReply(
      `สร้างประโยคตอบกลับลูกค้าแบบสุภาพและสั้นๆ ว่าได้รับคำสั่ง "${data}" แล้ว`
    );
    replyMessages.push({ type: "text", text: gptConfirmText });

    const caseMap = {
      register_admin: "register_admin",
      login_backup: "login_backup",
      issue_deposit: "issue_deposit",
      issue_withdraw: "issue_withdraw",
      forgot_password: "forgot_password",
      promo_info: "promo_info",
      review_withdraw: "review_withdraw",
      max_withdraw: "max_withdraw",
      top_game: "top_game",
      referral_commission: "referral_commission",
    };

    if (caseMap[data]) {
      updateUserState(userId, { currentCase: caseMap[data], caseData: {} });
    }

    let msg = "";
    switch (data) {
      case "register_admin":
        msg = await generateDynamicPrompt("ask_info");
        break;
      case "login_backup":
        msg = await getCuteDynamicReply(
          "สร้างข้อความสุภาพ ขอให้ลูกค้าแจ้งชื่อและเบอร์โทรที่สมัครไว้เพื่อช่วยตรวจสอบการเข้าเล่น"
        );
        break;
      case "issue_deposit":
        msg = await getCuteDynamicReply(
          "สร้างข้อความสุภาพ ขอให้ลูกค้าแจ้งชื่อ+เบอร์โทร และส่งสลิปฝากเงินให้แอดมินตรวจสอบ"
        );
        break;
      case "issue_withdraw":
        msg = "ระบบกำลังดำเนินการถอนให้ค่ะ รอ 3-5 นาที 💕";
        break;
      case "forgot_password":
        msg = "แจ้งชื่อ+เบอร์โทรที่สมัครไว้ เดี๋ยวน้องจะช่วยรีเซ็ตให้ค่ะ 💕";
        break;
      case "promo_info":
        msg = "ตอนนี้มีโปรสมัครใหม่ ฝากแรกของวัน และโปรคืนยอดเสีย สนใจโปรไหนคุยกับน้องได้เลยค่ะ 💕";
        break;
      case "review_withdraw":
        msg = await generateWithdrawReviewMessage();
        break;
      case "max_withdraw":
        msg = await generateMaxWithdrawMessage();
        break;
      case "top_game":
        msg = await generateTopGameMessage();
        break;
      case "referral_commission":
        msg = await generateReferralCommissionMessage();
        break;
    }

    replyMessages.push({ type: "text", text: msg });
    return replyMessages;
  }

  // ✅ ถ้าลูกค้าอยู่ในเคส → เก็บข้อมูลและแจ้งหัวหน้าฝ่าย
  if (state.currentCase && (userText.length > 3 || event.message?.type === "image")) {
    const confirmMsg = await generateDynamicPrompt("confirm_info");
    replyMessages.push({ type: "text", text: confirmMsg });

    await notifyAdmin(
      event,
      `ข้อมูลใหม่จากลูกค้า (เคส ${state.currentCase}): ${userText || "ส่งรูป"}\n\n📜 ประวัติล่าสุด:\n${state.chatHistory
        .slice(-5)
        .map((c) => `• ${c.role}: ${c.text}`)
        .join("\n")}`
    );

    userPausedStates[userId] = true;
    return replyMessages;
  }

  // ✅ ส่ง Flex Menu ทุก 2 ชั่วโมง
  if (event.type === "message" && shouldSendFlex(userId)) {
    replyMessages.push({ type: "flex", altText: "🎀 เมนูพิเศษ", contents: createFlexMenuContents() });
    updateUserState(userId, { lastFlexSent: Date.now() });
  }

  // ✅ GPT ตอบข้อความทั่วไป โดยใส่ context ประวัติการคุย
  try {
    const historyContext = state.chatHistory
      .slice(-5)
      .map((c) => `${c.role === "user" ? "ลูกค้า" : "บอท"}: ${c.text}`)
      .join("\n");

    const smartPrompt = `
นี่คือประวัติการคุยล่าสุด:
${historyContext}

ลูกค้าส่งข้อความใหม่: "${userText}"

ให้ตอบแบบเพื่อนคุยน่ารักๆ สุภาพ และชวนเล่น pgthai289 แบบไม่ซ้ำเดิม
ตอบไม่เกิน 2 ประโยค
`;
    const gptReply = await getCuteDynamicReply(smartPrompt);
    replyMessages.push({ type: "text", text: gptReply });

    await notifyAdmin(event, userText || "ลูกค้าส่งข้อความ/รูป");
    return replyMessages;
  } catch (error) {
    console.error("GPT Reply error:", error);
    replyMessages.push({ type: "text", text: "เกิดข้อผิดพลาดในการตอบกลับ รอสักครู่นะคะ 💕" });
    return replyMessages;
  }
}
// ================== CRM FOLLOW-UP SYSTEM (ULTIMATE) ==================
const crmHistory = {}; // เก็บประวัติการส่ง CRM { userId: timestamp }
const crmTemplates = [
  `สร้างข้อความทักลูกค้าที่หายไป 3 วัน
  ชวนกลับมาเล่น PGTHAI289 ด้วยน้ำเสียงน่ารัก อบอุ่น
  เน้นบอกว่ามีเกมใหม่แตกง่าย โบนัสเยอะ และโปรโมชั่นพิเศษรออยู่`,
  
  `เขียนข้อความสุภาพน่ารักสำหรับลูกค้าที่หายไป 3 วัน
  กระตุ้นให้ลูกค้ากลับมาเล่น PGTHAI289 พร้อมบอกว่า
  มีเกมสล็อตใหม่ โบนัสแตกง่าย และโปรพิเศษสำหรับลูกค้ากลับมา`,
  
  `สร้างประโยคทักลูกค้าที่ไม่ได้คุยมา 3 วัน
  ให้เน้นความเป็นกันเอง เชิญชวนให้ลูกค้ากลับมาเล่น PGTHAI289
  พร้อมบอกข่าวดีเรื่องเกมแตกง่าย และโปรโบนัสจัดเต็ม`
];

// ✅ ฟังก์ชันเลือก Template แบบสุ่ม
function getRandomTemplate() {
  return crmTemplates[Math.floor(Math.random() * crmTemplates.length)];
}

// ✅ ฟังก์ชันเลือกเวลาหน่วงการส่ง (ป้องกันส่งพร้อมกันทุกคน)
function randomDelay() {
  return Math.floor(Math.random() * 600000); // 0 - 10 นาที
}

// ✅ ฟังก์ชันเลือกข้อความตามพฤติกรรมลูกค้า
async function generateBehaviorBasedMessage(uid) {
  const state = userStates[uid] || {};
  let behavior = "ทั่วไป";

  if (state.totalDeposit > 5000) behavior = "ลูกค้าที่ฝากเยอะ";
  else if (state.totalDeposit > 0) behavior = "ลูกค้าที่เคยฝากแต่หายไป";
  else behavior = "ลูกค้าที่สมัครไว้แต่ยังไม่ฝาก";

  const prompt = `
คุณคือผู้ช่วย CRM
สร้างข้อความทักลูกค้าที่หายไป 3 วัน
- ประเภทลูกค้า: ${behavior}
- ต้องสุภาพ น่ารัก อบอุ่น
- แนะนำให้กลับมาเล่น PGTHAI289
- แจ้งว่ามีเกมใหม่แตกง่าย โบนัสเยอะ และโปรพิเศษ
- ข้อความไม่เกิน 2 ประโยค
`;

  try {
    return await getCuteDynamicReply(prompt);
  } catch {
    return "น้องคิดถึงพี่นะคะ มาลองเกมใหม่โบนัสเพียบที่ PGTHAI289 กันค่ะ 💕";
  }
}

// ✅ ฟังก์ชันหลัก CRM
export function initCRM(lineClient) {
  setInterval(async () => {
    const now = Date.now();

    // ✅ คัดเฉพาะลูกค้าที่หายไป >3 วัน และไม่ได้รับ CRM ภายใน 24 ชม.
    const inactiveUsers = Object.keys(userStates).filter((uid) => {
      const lastActive = userStates[uid]?.lastActive || 0;
      const lastCRM = crmHistory[uid] || 0;
      return now - lastActive > 3 * 24 * 60 * 60 * 1000 && now - lastCRM > 24 * 60 * 60 * 1000;
    });

    for (const uid of inactiveUsers) {
      try {
        // ✅ ใช้ GPT + Behavior-Based Message
        const followUpText = await generateBehaviorBasedMessage(uid);

        // ✅ หน่วงเวลาส่ง (สุ่ม 0-10 นาที)
        setTimeout(async () => {
          await lineClient.pushMessage(uid, { type: "text", text: followUpText });

          await lineClient.pushMessage(uid, {
            type: "flex",
            altText: "🎀 กลับมาเล่นกับเรา 🎀",
            contents: createFlexMenuContents(),
          });

          await sendTelegramAlert(`📢 CRM ส่งข้อความตามลูกค้า: ${uid}`);
          crmHistory[uid] = Date.now(); // ✅ บันทึกว่าลูกค้าคนนี้ได้รับ CRM แล้ว
        }, randomDelay());
      } catch (err) {
        console.error("CRM Error:", err);
      }
    }
  }, 6 * 60 * 60 * 1000); // ✅ ตรวจทุก 6 ชม.
}
