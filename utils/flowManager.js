// ================== ULTIMATE VERSION (PART 1) ==================
import { getCuteDynamicReply } from "../services/gptService.js";
import { sendTelegramAlert, sendTelegramPhoto, getLineProfile } from "../services/telegramService.js";
import { getLineImage } from "../services/lineMediaService.js";

// เก็บสถานะผู้ใช้ (ในหน่วยความจำ)
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
      greeted: false, // สำหรับกันสวัสดีซ้ำ
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

// ✅ ฟังก์ชันสุ่มชื่อทักทาย
function randomName() {
  const names = ["พีท", "ฟาง", "ต้น", "มายด์", "เก่ง", "แพรว", "เจน", "ตั้ม"];
  return names[Math.floor(Math.random() * names.length)];
}

// ✅ ฟังก์ชันสุ่มเบอร์โทร
function randomMaskedPhone() {
  const prefix = "08";
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}xxxx${suffix}`;
}

// ✅ แจ้งเตือน Telegram
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
// ================== ULTIMATE VERSION (PART 2) ==================

// ตัวแปรเก็บยอดถอนสูงสุดประจำวัน (คงที่ทั้งวัน)
let cachedMaxWithdrawDate = null;
let cachedMaxWithdrawAmount = null;

// ✅ ฟังก์ชันรีวิวยอดถอน (ตัดเวลาออก)
async function generateWithdrawReviewMessage() {
  const reviews = [];
  for (let i = 0; i < 10; i++) {
    const phone = randomMaskedPhone();
    const amount = (Math.floor(Math.random() * (50000 - 5000)) + 5000).toLocaleString();
    reviews.push(`ยูส ${phone} ถอน ${amount}`);
  }
  return `📊 รีวิวการถอนล่าสุด\n\n${reviews.join("\n")}`;
}

// ✅ ฟังก์ชันสร้างข้อความยอดถอนสูงสุดประจำวัน
async function generateMaxWithdrawMessage() {
  const today = new Date().toLocaleDateString("th-TH");
  if (cachedMaxWithdrawDate !== today) {
    cachedMaxWithdrawDate = today;
    cachedMaxWithdrawAmount = Math.floor(Math.random() * (500000 - 300000)) + 300000;
  }
  const phone = randomMaskedPhone();
  return `👑 ยอดถอนสูงสุดวันนี้\n\nยินดีกับคุณพี่ "สมชาย" ยูส ${phone} ถอน ${cachedMaxWithdrawAmount.toLocaleString()} บาท\nวันที่ ${cachedMaxWithdrawDate}`;
}

// ✅ ฟังก์ชันสร้างข้อความเกมแตกบ่อย (ใช้ชื่อเกม 15 เกม)
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

  let message = "🎲 เกมสล็อตแตกบ่อยวันนี้\n\n";
  selected.forEach((game, i) => {
    message += `${i + 1}. ${game} - ${randomPercent()}%\n`;
  });
  message += `\n💥 ฟรีสปินแตกล่าสุด: ${freeSpinAmount.toLocaleString()} บาท\n`;
  message += `💥 ปั่นธรรมดาแตกล่าสุด: ${normalAmount.toLocaleString()} บาท\n`;
  message += `เล่นง่าย แตกบ่อย จ่ายจริง 💕`;
  return message;
}

// ✅ ฟังก์ชันสร้างข้อความค่าคอมมิชชั่นแนะนำเพื่อน
async function generateReferralCommissionMessage() {
  const lines = [];
  for (let i = 0; i < 10; i++) {
    const phone = randomMaskedPhone();
    const amount = (Math.floor(Math.random() * (100000 - 3000)) + 3000).toLocaleString();
    lines.push(`ยูส ${phone} ได้ค่าคอมมิชชั่นจากยอดเล่นเพื่อน ${amount}`);
  }
  return `🤝 ค่าคอมมิชชั่นแนะนำเพื่อน\n\n${lines.join("\n")}\n\n💡 ชวนเพื่อนมาสร้างรายได้ง่ายๆ ได้ทุกวัน!`;
}
// ================== ULTIMATE VERSION (PART 3) ==================

// ✅ วิเคราะห์ Intent จากข้อความลูกค้า
async function analyzeUserIntent(userText) {
  const prompt = `
คุณคือระบบวิเคราะห์ Intent ของข้อความลูกค้าเว็บพนัน
- วิเคราะห์ข้อความว่าเกี่ยวข้องกับ: 
  "problem" (ปัญหา เช่น ฝากเงินไม่เข้า ถอนเงินช้า เล่นเกมค้าง เข้าเล่นไม่ได้),
  "finance" (การเงิน ฝาก ถอน โปรโมชั่น โบนัส),
  "register" (สมัครสมาชิก สมัครไม่สำเร็จ สมัครให้หน่อย),
  "general_question" (คำถามทั่วไปเกี่ยวกับเว็บ วิธีใช้งาน กติกาเกม),
  "emotion" (อารมณ์/ความรู้สึก เช่น ดีใจ เสียใจ โกรธ เบื่อ หิว ฯลฯ)
- ให้ตอบเป็น JSON เท่านั้น เช่น:
{ "intent": "problem", "summary": "ลูกค้าถอนเงินไม่เข้า" }

ข้อความลูกค้า: "${userText}"
  `;
  try {
    const analysisResult = await getCuteDynamicReply(prompt);
    return JSON.parse(analysisResult);
  } catch (err) {
    console.error("analyzeUserIntent Error:", err);
    return { intent: "unknown", summary: userText };
  }
}

// ✅ ฟังก์ชันสร้าง Prompt เพื่อให้ GPT ตอบได้ตรง Intent
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
ตอบแบบสั้น กระชับ เข้าใจง่าย พร้อมชวนใช้บริการ pgthai289`;
      break;

    case "register":
      prompt = `ลูกค้าต้องการสมัครสมาชิก 
อธิบายขั้นตอนสมัคร pgthai289 แบบกระชับและสุภาพ ถ้าสมัครไม่ได้ให้แนะนำว่ากดปุ่มสมัครให้ได้เลย`;
      break;

    case "finance":
      prompt = `ลูกค้าสนใจเรื่องการเงิน (${intentData.summary}) 
ตอบข้อมูลวิธีฝาก-ถอน pgthai289 แบบละเอียด เข้าใจง่าย และแนะนำการทำรายการทันที`;
      break;

    case "problem":
      prompt = `ลูกค้ามีปัญหา (${intentData.summary}) 
ตอบด้วยน้ำเสียงสุภาพ ให้คำแนะนำวิธีแก้ปัญหาอย่างชัดเจน และแจ้งว่าสามารถให้หัวหน้าฝ่ายแก้ไขช่วยดูแลต่อได้`;
      break;

    default:
      prompt = `ตอบข้อความนี้อย่างสุภาพ เป็นกันเอง และแนะนำ pgthai289 เบา ๆ: "${userText}"`;
      break;
  }

  return await getCuteDynamicReply(prompt);
}

// ✅ ฟังก์ชัน push ข้อความ echo เวลากดปุ่ม Postback
function pushEchoPostbackMessage(replyMessages, postbackData) {
  replyMessages.push({ type: "text", text: `✅ คุณเลือก: ${postbackData}` });
}
// ================== ULTIMATE VERSION (PART 4) ==================

export async function handleCustomerFlow(event) {
  const userId = event.source?.userId;
  const state = getUserState(userId);
  const replyMessages = [];
  const userText = event.message?.text?.trim() || "";

  // ✅ ถ้าบอทถูก pause → ต้องรอหัวหน้าฝ่ายแก้ไขปลดล็อก
  if (userPausedStates[userId]) {
    if (userText.includes("ดำเนินการให้เรียบร้อยแล้วนะคะพี่")) {
      userPausedStates[userId] = false;
      updateUserState(userId, { currentCase: null, caseData: {} });
      replyMessages.push({ type: "text", text: "น้องกลับมาดูแลพี่แล้วค่ะ ขอบคุณมากนะคะ 💕" });
    } else {
      replyMessages.push({ type: "text", text: "ขณะนี้หัวหน้าฝ่ายแก้ไขกำลังดูแลเรื่องนี้อยู่ รบกวนรอสักครู่นะคะ 💕" });
    }
    return replyMessages;
  }

  // ✅ ลูกค้าเพิ่มเพื่อนใหม่
  if (event.type === "follow") {
    const welcomeText = await getCuteDynamicReply(
      "🎉 ยินดีต้อนรับสู่ PGTHAI289 เว็บตรงมั่นคง ปลอดภัย ฝาก-ถอนออโต้รวดเร็ว 💕"
    );
    replyMessages.push({ type: "text", text: welcomeText });
    replyMessages.push({ type: "flex", altText: "🎀 เมนูพิเศษสำหรับคุณ 🎀", contents: createFlexMenuContents() });
    await notifyAdmin(event, "ลูกค้าเพิ่มเพื่อนใหม่");
    updateUserState(userId, { lastFlexSent: Date.now() });
    return replyMessages;
  }

  // ✅ ตรวจสอบ Postback (ปุ่มที่กด)
  if (event.type === "postback" && event.postback?.data) {
    const data = event.postback.data;
    pushEchoPostbackMessage(replyMessages, data);

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

    let startMsgBase = "";
    switch (data) {
      case "register_admin":
        startMsgBase = "รบกวนแจ้งชื่อ-นามสกุล เบอร์โทร บัญชี/วอเลท และไอดีไลน์ด้วยนะคะ 💕";
        break;
      case "login_backup":
        startMsgBase = "แจ้งชื่อ+เบอร์โทรที่สมัครไว้ เดี๋ยวน้องจะตรวจสอบให้นะคะ 💕";
        break;
      case "issue_deposit":
        startMsgBase = "รบกวนแจ้งชื่อ+เบอร์โทร และส่งสลิปฝากเงินด้วยค่ะ 💕";
        break;
      case "issue_withdraw":
        startMsgBase = "ระบบกำลังดำเนินการถอนให้ค่ะ รอ 3-5 นาที 💕";
        break;
      case "forgot_password":
        startMsgBase = "แจ้งชื่อ+เบอร์โทรที่สมัครไว้ เดี๋ยวน้องจะช่วยรีเซ็ตให้ค่ะ 💕";
        break;
      case "promo_info":
        startMsgBase = "ตอนนี้มีโปรสมัครใหม่ ฝากแรกของวัน และโปรคืนยอดเสีย สนใจโปรไหนคุยกับน้องได้เลยค่ะ 💕";
        break;
      case "review_withdraw":
        startMsgBase = await generateWithdrawReviewMessage();
        break;
      case "max_withdraw":
        startMsgBase = await generateMaxWithdrawMessage();
        break;
      case "top_game":
        startMsgBase = await generateTopGameMessage();
        break;
      case "referral_commission":
        startMsgBase = await generateReferralCommissionMessage();
        break;
    }

    replyMessages.push({ type: "text", text: startMsgBase });
    return replyMessages;
  }

  // ✅ ถ้าลูกค้าอยู่ในเคส → รับข้อมูล + แจ้งหัวหน้าฝ่ายแก้ไข
  if (state.currentCase && (userText.length > 5 || event.message?.type === "image")) {
    await notifyAdmin(event, `ข้อมูลจากลูกค้า (เคส ${state.currentCase}): ${userText || "ส่งรูป"} `);
    replyMessages.push({ type: "text", text: "ได้รับข้อมูลแล้วค่ะ หัวหน้าฝ่ายแก้ไขกำลังดำเนินการให้นะคะ 💕" });
    userPausedStates[userId] = true;
    return replyMessages;
  }

  // ✅ Flex Menu (ส่งทุก 2 ชม.)
  if (event.type === "message" && shouldSendFlex(userId)) {
    replyMessages.push({ type: "flex", altText: "🎀 เมนูพิเศษ", contents: createFlexMenuContents() });
    updateUserState(userId, { lastFlexSent: Date.now() });
  }

  // ✅ GPT ตอบข้อความทั่วไป
  try {
    let gptReply = await generateSmartReply(userText);

    const confusionKeywords = ["ไม่เข้าใจ", "ขอโทษ", "ช่วยอะไรไม่ได้", "ไม่สามารถ", "งง", "ไม่รู้"];
    const isConfused = confusionKeywords.some((kw) => gptReply.toLowerCase().includes(kw));

    if (isConfused) {
      await sendTelegramAlert(`⚠️ GPT ไม่เข้าใจลูกค้า (userId: ${userId}): "${userText}"`);
      userPausedStates[userId] = true;
      return [{ type: "text", text: "น้องยังไม่เข้าใจคำขอ รบกวนรอหัวหน้าฝ่ายแก้ไขมาตรวจสอบนะคะ 💕" }];
    }

    replyMessages.push({ type: "text", text: gptReply });
    await notifyAdmin(event, userText || "ลูกค้าส่งข้อความ/รูป");
    return replyMessages;
  } catch (error) {
    console.error("GPT Reply error:", error);
    replyMessages.push({ type: "text", text: "เกิดข้อผิดพลาดในการตอบกลับ รบกวนรอสักครู่ค่ะ 💕" });
    return replyMessages;
  }
}
// ================== ULTIMATE VERSION (PART 5) ==================

function createFlexMenuContents() {
  return {
    type: "carousel",
    contents: [
      // 🔹 BOX 1: สมัคร + ทางเข้า
      {
        type: "bubble",
        hero: {
          type: "image",
          url: "https://i.ibb.co/SqbNcr1/image.jpg",
          size: "full",
          aspectRatio: "20:13",
          aspectMode: "cover",
        },
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

      // 🔹 BOX 2: แจ้งปัญหา
      {
        type: "bubble",
        hero: {
          type: "image",
          url: "https://i.ibb.co/SqbNcr1/image.jpg",
          size: "full",
          aspectRatio: "20:13",
          aspectMode: "cover",
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "text", text: "🛠 แจ้งปัญหา", weight: "bold", size: "lg", color: "#8E44AD" },
            { type: "text", text: "ฝาก-ถอน / ลืมรหัส / เข้าเล่นไม่ได้ เลือกได้เลยค่ะ 💬", size: "sm", color: "#4A235A", margin: "sm" },
          ],
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            { type: "button", style: "primary", color: "#8E44AD", height: "sm", action: { type: "postback", label: "💰 ปัญหาฝาก/ถอน", data: "issue_deposit" } },
            { type: "button", style: "primary", color: "#8E44AD", height: "sm", action: { type: "postback", label: "🔑 ลืมรหัสผ่าน", data: "forgot_password" } },
            { type: "button", style: "primary", color: "#8E44AD", height: "sm", action: { type: "postback", label: "🚪 เข้าเล่นไม่ได้", data: "login_backup" } },
            { type: "button", style: "primary", color: "#8E44AD", height: "sm", action: { type: "postback", label: "🎁 โปรโมชั่น", data: "promo_info" } },
          ],
        },
        styles: { footer: { separator: true } },
      },

      // 🔹 BOX 3: รีวิว + เกมแตก
      {
        type: "bubble",
        hero: {
          type: "image",
          url: "https://i.ibb.co/SqbNcr1/image.jpg",
          size: "full",
          aspectRatio: "20:13",
          aspectMode: "cover",
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "text", text: "🏆 รีวิว & เกมแตก", weight: "bold", size: "lg", color: "#8E44AD" },
            { type: "text", text: "ดูรีวิวยอดถอนล่าสุด และเกมแตกหนักวันนี้ 🔥", size: "sm", color: "#4A235A", margin: "sm" },
          ],
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            { type: "button", style: "primary", color: "#8E44AD", height: "sm", action: { type: "postback", label: "💵 รีวิวยอดถอน", data: "review_withdraw" } },
            { type: "button", style: "primary", color: "#8E44AD", height: "sm", action: { type: "postback", label: "👑 ถอนสูงสุดวันนี้", data: "max_withdraw" } },
            { type: "button", style: "primary", color: "#8E44AD", height: "sm", action: { type: "postback", label: "🎲 เกมแตกบ่อย", data: "top_game" } },
            { type: "button", style: "primary", color: "#8E44AD", height: "sm", action: { type: "postback", label: "🤝 ค่าคอมแนะนำเพื่อน", data: "referral_commission" } },
          ],
        },
        styles: { footer: { separator: true } },
      },
    ],
  };
}

// ✅ Export ฟังก์ชันทั้งหมด
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
  pushEchoPostbackMessage,
  createFlexMenuContents,
};
