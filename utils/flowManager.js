
// utils/flowManager.js
import { getCuteDynamicReply } from "../services/gptService.js";
import { sendTelegramAlert, sendTelegramPhoto, getLineProfile } from "../services/telegramService.js";
import { getLineImage } from "../services/lineMediaService.js";

// ================== STATE ==================
const userStates = {};
const userPausedStates = {};
const flexCooldown = 2 * 60 * 60 * 1000;
const lastGreetingTimes = {};

function getUserState(userId) {
  if (!userStates[userId]) {
    userStates[userId] = {
      lastFlexSent: 0,
      currentCase: null,
      caseData: {},
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

function shouldSendGreeting(userId) {
  const now = Date.now();
  if (!lastGreetingTimes[userId] || now - lastGreetingTimes[userId] > 10 * 60 * 1000) {
    lastGreetingTimes[userId] = now;
    return true;
  }
  return false;
}

// ================== UTILITIES ==================
function randomMaskedPhone() {
  const prefix = "08";
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}xxxx${suffix}`;
}

async function notifyAdmin(event, message) {
  try {
    const profile = await getLineProfile(event.source?.userId);
    const displayName = profile?.displayName || event.source?.userId || "ไม่ทราบชื่อ";
    const oaName = process.env.LINE_OA_NAME || "ไม่ทราบ OA";
    await sendTelegramAlert(`📢 แจ้งเตือนจาก ${oaName}
👤 ลูกค้า: ${displayName}
💬 ข้อความ: ${message}`);
    if (event.message?.type === "image") {
      const img = await getLineImage(event.message.id);
      if (img) await sendTelegramPhoto(img, `📷 รูปจากลูกค้า (${displayName})`);
    }
  } catch (e) {
    console.error("notifyAdmin Error:", e);
  }
}

// ================== STATIC MESSAGES ==================
let cachedMaxWithdrawDate = null;
let cachedMaxWithdrawAmount = null;

async function generateWithdrawReviewMessage() {
  const list = [];
  for (let i = 0; i < 10; i++) {
    const phone = randomMaskedPhone();
    const amount = (Math.floor(Math.random() * 45000) + 5000).toLocaleString();
    list.push(`ยูส ${phone} ถอน ${amount}`);
  }
  return `📊 รีวิวการถอนล่าสุด

${list.join("\n")}`;
}

async function generateMaxWithdrawMessage() {
  const today = new Date().toLocaleDateString("th-TH");
  if (cachedMaxWithdrawDate !== today) {
    cachedMaxWithdrawDate = today;
    cachedMaxWithdrawAmount = Math.floor(Math.random() * 200000) + 300000;
  }
  return `👑 ยอดถอนสูงสุดวันนี้\n\nยินดีกับคุณพี่ "สมชาย" ยูส ${randomMaskedPhone()} ถอน ${cachedMaxWithdrawAmount.toLocaleString()} บาท\nวันที่ ${cachedMaxWithdrawDate}`;
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
    "Jack the Giant Hunter • แจ็กผู้ฆ่ายัก"
  ];
  const selected = games.sort(() => 0.5 - Math.random()).slice(0, 5);
  let msg = "🎲 เกมสล็อตแตกบ่อยวันนี้\n\n";
  selected.forEach((g, i) => (msg += `${i + 1}. ${g} - ${Math.floor(Math.random() * 50) + 50}%\n`));
  msg += `\n💥 ฟรีสปินแตกล่าสุด: ${(Math.floor(Math.random() * 180000) + 20000).toLocaleString()} บาท\n`;
  msg += `💥 ปั่นธรรมดาแตกล่าสุด: ${(Math.floor(Math.random() * 47000) + 3000).toLocaleString()} บาท`;
  return msg;
}

async function generateReferralCommissionMessage() {
  const list = [];
  for (let i = 0; i < 10; i++) {
    const phone = randomMaskedPhone();
    const amount = (Math.floor(Math.random() * 97000) + 3000).toLocaleString();
    list.push(`ยูส ${phone} ได้ค่าคอมเพื่อน ${amount}`);
  }
  return `🤝 ค่าคอมมิชชั่นแนะนำเพื่อน\n\n${list.join("\n")}\n\n💡 ชวนเพื่อนมาสร้างรายได้ง่ายๆ ได้ทุกวัน!`;
}

// ================== GPT INTENT ==================
async function analyzeUserIntent(text) {
  const prompt = `
คุณคือระบบวิเคราะห์ Intent ของข้อความลูกค้า
- ประเภท: "problem" (ปัญหา), "finance" (การเงิน), "register" (สมัคร), "general_question" (คำถามทั่วไป), "emotion" (อารมณ์)
- ตอบ JSON เท่านั้น เช่น {"intent":"emotion","summary":"ลูกค้าหิว"}
ข้อความลูกค้า: "${text}"
`;
  try {
    const result = await getCuteDynamicReply(prompt);
    return JSON.parse(result);
  } catch {
    return { intent: "unknown", summary: text };
  }
}

async function generateSmartReply(text) {
  const intent = await analyzeUserIntent(text);
  let prompt = "";
  if (intent.intent === "emotion")
    prompt = `ลูกค้ารู้สึก ${intent.summary} ตอบแบบเพื่อนคุย น่ารัก และแนะนำ pgthai289 เบาๆ`;
  else if (intent.intent === "general_question")
    prompt = `ลูกค้าถาม ${intent.summary} ตอบสั้น กระชับ และชวนเล่น pgthai289`;
  else if (intent.intent === "register")
    prompt = `ลูกค้าต้องการสมัครสมาชิก อธิบายขั้นตอนสมัคร pgthai289 แบบกระชับและสุภาพ`;
  else if (intent.intent === "finance")
    prompt = `ลูกค้าถามเรื่องการเงิน (${intent.summary}) ตอบวิธีฝากถอน pgthai289 ชัดเจน`;
  else if (intent.intent === "problem")
    prompt = `ลูกค้ามีปัญหา (${intent.summary}) ตอบสุภาพ น่ารัก และบอกขั้นตอนแก้ปัญหา`;
  else
    prompt = `ตอบข้อความนี้อย่างสุภาพ เป็นกันเอง และแนะนำ pgthai289 เบาๆ: "${text}"`;

  return await getCuteDynamicReply(prompt);
}

// ================== POSTBACK MAP ==================
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
            { type: "text", text: "💎 สมัคร + Login", weight: "bold", size: "lg", color: "#8E44AD" },
            { type: "text", text: "สมัครง่าย มั่นคง จ่ายจริง 💵", size: "sm", color: "#4A235A", margin: "sm" },
          ],
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            { type: "button", style: "primary", color: "#8E44AD", action: { type: "uri", label: "✨ สมัครเอง", uri: "https://pgthai289.net/customer/register/LINEBOT/?openExternalBrowser=1" } },
            { type: "button", style: "primary", color: "#8E44AD", action: { type: "postback", label: "🤍 ให้เจ้าหน้าที่สมัครให้", data: "register_admin" } },
          ],
        },
      },
      {
        type: "bubble",
        hero: { type: "image", url: "https://i.ibb.co/SqbNcr1/image.jpg", size: "full", aspectRatio: "20:13", aspectMode: "cover" },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "text", text: "🛠 แจ้งปัญหา", weight: "bold", size: "lg", color: "#8E44AD" },
            { type: "text", text: "ฝาก ถอน เข้าเล่นไม่ได้ กดด้านล่างเลยค่ะ", size: "sm", color: "#4A235A", margin: "sm" },
          ],
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            { type: "button", style: "primary", color: "#8E44AD", action: { type: "postback", label: "💰 ปัญหาฝาก/ถอน", data: "issue_deposit" } },
            { type: "button", style: "primary", color: "#8E44AD", action: { type: "postback", label: "🔑 ลืมรหัสผ่าน", data: "forgot_password" } },
          ],
        },
      },
      {
        type: "bubble",
        hero: { type: "image", url: "https://i.ibb.co/SqbNcr1/image.jpg", size: "full", aspectRatio: "20:13", aspectMode: "cover" },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "text", text: "🏆 รีวิว & เกมแตก", weight: "bold", size: "lg", color: "#8E44AD" },
            { type: "text", text: "ดูรีวิวยอดถอน และเกมแตกบ่อย", size: "sm", color: "#4A235A", margin: "sm" },
          ],
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            { type: "button", style: "primary", color: "#8E44AD", action: { type: "postback", label: "💵 รีวิวยอดถอน", data: "review_withdraw" } },
            { type: "button", style: "primary", color: "#8E44AD", action: { type: "postback", label: "👑 ถอนสูงสุดวันนี้", data: "max_withdraw" } },
            { type: "button", style: "primary", color: "#8E44AD", action: { type: "postback", label: "🎲 เกมแตกบ่อย", data: "top_game" } },
            { type: "button", style: "primary", color: "#8E44AD", action: { type: "postback", label: "🤝 ค่าคอมเพื่อน", data: "referral_commission" } },
          ],
        },
      },
    ],
  };
}

// ================== HANDLE FLOW ==================
export async function handleCustomerFlow(event) {
  const userId = event.source?.userId;
  const state = getUserState(userId);
  const replyMessages = [];
  const userText = event.message?.text?.trim() || "";

  // Pause check
  if (userPausedStates[userId]) {
    if (userText.includes("ดำเนินการให้เรียบร้อยแล้วนะคะพี่")) {
      userPausedStates[userId] = false;
      updateUserState(userId, { currentCase: null, caseData: {} });
      replyMessages.push({ type: "text", text: "น้องกลับมาดูแลพี่แล้วค่ะ 💕" });
    } else {
      replyMessages.push({ type: "text", text: "ตอนนี้อยู่ในขั้นตอนการดำเนินการโดยหัวหน้าฝ่ายแก้ไข รอสักครู่ค่ะ 💕" });
    }
    return replyMessages;
  }

  // Postback
  if (event.type === "postback" && event.postback?.data) {
    const data = event.postback.data;
    replyMessages.push({ type: "text", text: `✅ คุณเลือก: ${data}` });

    if (["review_withdraw", "max_withdraw", "top_game", "referral_commission"].includes(data)) {
      if (data === "review_withdraw") replyMessages.push({ type: "text", text: await generateWithdrawReviewMessage() });
      if (data === "max_withdraw") replyMessages.push({ type: "text", text: await generateMaxWithdrawMessage() });
      if (data === "top_game") replyMessages.push({ type: "text", text: await generateTopGameMessage() });
      if (data === "referral_commission") replyMessages.push({ type: "text", text: await generateReferralCommissionMessage() });
      return replyMessages;
    }

    if (caseMap[data]) {
      updateUserState(userId, { currentCase: caseMap[data], caseData: {} });
      let askText = "";
      if (data === "register_admin") askText = "รบกวนแจ้งชื่อ-นามสกุล เบอร์โทร และบัญชี/วอเลท + ไลน์ไอดี ด้วยค่ะ 💕";
      if (data === "login_backup") askText = "รบกวนแจ้งชื่อ+เบอร์โทรที่สมัครไว้ เดี๋ยวน้องจะตรวจสอบให้นะคะ 💕";
      if (data === "issue_deposit") askText = "แจ้งชื่อ+เบอร์โทร และส่งสลิปฝากเงินด้วยค่ะ 💕";
      if (data === "issue_withdraw") askText = "ระบบกำลังดำเนินการถอนให้ค่ะ รอ 3-5 นาที 💕";
      if (data === "forgot_password") askText = "แจ้งชื่อ+เบอร์โทรที่สมัครไว้ เดี๋ยวน้องจะช่วยรีเซ็ตให้ค่ะ 💕";
      if (data === "promo_info") askText = "ตอนนี้มีโปรสมัครใหม่ โปรฝากแรกของวัน และโปรคืนยอดเสีย สนใจโปรไหนคุยกับน้องได้เลยค่ะ 💕";
      replyMessages.push({ type: "text", text: askText });
      return replyMessages;
    }
  }

  // Current Case Handling
  if (state.currentCase && !userPausedStates[userId]) {
    if (userText.length > 5 || event.message?.type === "image") {
      await notifyAdmin(event, `ข้อมูลจากลูกค้า (เคส ${state.currentCase}): ${userText}`);
      replyMessages.push({ type: "text", text: "ได้รับข้อมูลแล้วค่ะ กำลังส่งให้หัวหน้าฝ่ายแก้ไขดำเนินการ 💕" });
      replyMessages.push({ type: "text", text: "✨ เล่น PGTHAI289 มั่นคง ปลอดภัย ฝากถอนออโต้เลยค่ะ!" });
      userPausedStates[userId] = true;
      return replyMessages;
    } else {
      replyMessages.push({ type: "text", text: "รบกวนแจ้งข้อมูลให้ครบถ้วนนะคะ 💕" });
      return replyMessages;
    }
  }

  // General Messages
  if (event.type === "message") {
    if (shouldSendGreeting(userId)) {
      replyMessages.push({ type: "text", text: `สวัสดีค่ะ คุณ${["พีท","ฟาง","ตาล","บอส","แนน","ก้อง"][Math.floor(Math.random()*6)]} 😊` });
    }
    if (shouldSendFlex(userId)) {
      updateUserState(userId, { lastFlexSent: Date.now() });
      replyMessages.push({ type: "flex", altText: "🎀 เมนูพิเศษ", contents: createFlexMenuContents() });
    }
    const gptReply = await generateSmartReply(userText);
    replyMessages.push({ type: "text", text: gptReply });
    return replyMessages;
  }

  return replyMessages;
}
