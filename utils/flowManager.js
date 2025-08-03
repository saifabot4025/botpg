import fetch from "node-fetch";
import { getCuteDynamicReply } from "../services/gptService.js";
import { sendTelegramAlert, sendTelegramPhoto, getLineProfile } from "../services/telegramService.js";
import { getLineImage } from "../services/lineMediaService.js";
import { staffNames } from "../utils/staffNames.js";

// --- STATE ---
const userStates = {};
let globalPause = false;
let pauseBy = null;
const flexCooldown = 2 * 60 * 60 * 1000;
const greetCooldown = 10 * 60 * 1000;
const nameLockMinutes = 10;
const usedAssistantNames = {};

// --- KEYWORDS ---
const pauseKeywords = [
  "แอดมินรับเคสแล้ว", "แอดมินกำลังดูแล", "หัวหน้าแอดมินรับเคส", "แอดมินกำลังดำเนินการ",
  "รับเคสแล้วค่ะ", "รับเรื่องแล้วนะคะ", "แอดมินกำลังช่วยอยู่", "กำลังตรวจสอบให้ค่ะ",
  "กำลังดำเนินการให้ค่ะ", "กำลังดูแลอยู่ค่ะ", "แอดมินมาดูแล", "แอดมินเข้ามาดูแลแล้ว",
  "รับเรื่องแล้วค่ะ", "รับเรื่องเรียบร้อยแล้ว"
].map(k => k.replace(/\s/g, ""));
const unpauseKeywords = [
  "ดำเนินการให้เรียบร้อยแล้วค่ะ","ดำเนินการเรียบร้อยแล้วค่ะ","เคสนี้เสร็จแล้วค่ะ","เสร็จเรียบร้อยแล้วค่ะ",
  "ดำเนินการเสร็จแล้วค่ะ","เรียบร้อยแล้วค่ะ","จัดการเสร็จแล้วค่ะ","แก้ไขเรียบร้อยค่ะ",
  "เรียบร้อยแล้วนะคะ","เสร็จแล้วค่ะ","เคสเสร็จเรียบร้อยค่ะ"
].map(k => k.replace(/\s/g, ""));
const shortReplies = ["ครับ", "คับ", "ค่ะ", "คะ", "ค่า", "เค", "ok", "โอเค", "ครับผม", "ค่ะจ้า", "รับทราบ", "yes", "จ้า", "จัดไป", "ครับผม"];
const negativeWords = [
  "โกง","ขโมย","ไม่จ่าย","ถอนเงินไม่ได้","แย่","เสียใจ","โมโห","หัวร้อน","โดนโกง","ไม่ยอมโอน","โดนหลอก","บริการแย่","จะฟ้อง","ไม่คืนเงิน",
  "เว็บเถื่อน","ไม่โปร่งใส","หลอกลวง","ไม่พอใจ","เหี้ย","สัส","สัตว์","ควาย","โง่","เฮงซวย","ห่วย","ไอ้เหี้ย","ไอ้สัส","ไอ้สัตว์","ไอ้ควาย",
  "ไอ้โง่","หน้าหี","อีดอก","อีเหี้ย","อีควาย","อีสัตว์","อีหน้าหี","อีสัส","ชั่ว","สถุน","ถ่อย","อัปรีย์","ต่ำตม","อีเวร","เวร","กรรม","อีบ้า",
  "ไอ้บ้า","กาก","กะหรี่","ร่าน","แม่ง","เชี่ย","มึง","กู","ฟาย","แดก","หัวควย","ขี้โกง","โกงแดก","มึงโกง","เชี้ย","สันขวาน","หน้าส้นตีน","ไร้มารยาท",
  "ไม่เคารพ","หน้าด้าน","น่ารังเกียจ","ส้นตีน"
];

// --- FLEX MENU ---
function createFlexMenuContents() {
  return {
    type: "carousel",
    contents: [
      {
        type: "bubble",
        hero: { type: "image", url: "https://i.ibb.co/SqbNcr1/image.jpg", size: "full", aspectRatio: "20:13", aspectMode: "cover" },
        body: {
          type: "box", layout: "vertical", backgroundColor: "#4B0082",
          contents: [
            { type: "text", text: "สมัครสมาชิก + Login", weight: "bold", size: "lg", color: "#FFFFFF" },
            { type: "text", text: "เว็บเราสมัครฟรีไม่มีค่าใช้จ่าย หากติดขัดปัญหาด้านใดยินดีบริการ 24 ชั่วโมง", size: "sm", color: "#FFFFFF", wrap: true, margin: "md" },
          ],
        },
        footer: {
          type: "box", layout: "vertical", backgroundColor: "#4B0082", spacing: "sm",
          contents: [
            { type: "button", style: "primary", color: "#000000", action: { type: "uri", label: "⭐ สมัครเอง", uri: "https://pgthai289.net/customer/register/LINEBOT/?openExternalBrowser=1" } },
            { type: "button", style: "secondary", color: "#FFD700", action: { type: "postback", label: "📲 ให้แอดมินสมัครให้", data: "register_admin" } },
            { type: "button", style: "primary", color: "#000000", action: { type: "uri", label: "🔑 ทางเข้าเล่นหลัก", uri: "https://pgthai289.net/?openExternalBrowser=1" } },
            { type: "button", style: "secondary", color: "#FFD700", action: { type: "postback", label: "🚪 ทางเข้าเล่นสำรอง", data: "login_backup" } },
          ],
        },
      },
      {
        type: "bubble",
        hero: { type: "image", url: "https://i.ibb.co/SqbNcr1/image.jpg", size: "full", aspectRatio: "20:13", aspectMode: "cover" },
        body: {
          type: "box", layout: "vertical", backgroundColor: "#4B0082",
          contents: [
            { type: "text", text: "แจ้งปัญหาการใช้งาน", weight: "bold", size: "lg", color: "#FFFFFF" },
            { type: "text", text: "แจ้งปัญหาการใช้งาน แอดมินพร้อมดูแลตลอด 24 ชั่วโมงเลยนะคะ", size: "sm", color: "#FFFFFF", wrap: true, margin: "md" },
          ],
        },
        footer: {
          type: "box", layout: "vertical", backgroundColor: "#4B0082", spacing: "sm",
          contents: [
            { type: "button", style: "primary", color: "#000000", action: { type: "postback", label: "💰 ปัญหาฝาก", data: "issue_deposit" } },
            { type: "button", style: "secondary", color: "#FFD700", action: { type: "postback", label: "💸 ปัญหาถอน", data: "issue_withdraw" } },
            { type: "button", style: "primary", color: "#000000", action: { type: "postback", label: "🔑 ลืมรหัสผ่าน", data: "forgot_password" } },
            { type: "button", style: "secondary", color: "#FFD700", action: { type: "postback", label: "🚪 เข้าเล่นไม่ได้", data: "login_backup" } },
          ],
        },
      },
      {
        type: "bubble",
        hero: { type: "image", url: "https://i.ibb.co/SqbNcr1/image.jpg", size: "full", aspectRatio: "20:13", aspectMode: "cover" },
        body: {
          type: "box", layout: "vertical", backgroundColor: "#4B0082",
          contents: [
            { type: "text", text: "รีวิวการถอน + โบนัสไทม์", weight: "bold", size: "lg", color: "#FFFFFF" },
            { type: "text", text: "รีวิวการถอน+โบนัสไทม์ เว็บเราจ่ายชัวร์หลักร้อยหรือล้านก็ไวไร้ประวัติโกง", size: "sm", color: "#FFFFFF", wrap: true, margin: "md" },
          ],
        },
        footer: {
          type: "box", layout: "vertical", backgroundColor: "#4B0082", spacing: "sm",
          contents: [
            { type: "button", style: "primary", color: "#000000", action: { type: "postback", label: "⭐ รีวิวถอนล่าสุด", data: "review_withdraw" } },
            { type: "button", style: "secondary", color: "#FFD700", action: { type: "postback", label: "👑 ถอนสูงสุดวันนี้", data: "max_withdraw" } },
            { type: "button", style: "primary", color: "#000000", action: { type: "postback", label: "🎮 เกมแตกบ่อย", data: "top_game" } },
            { type: "button", style: "secondary", color: "#FFD700", action: { type: "postback", label: "💎 ค่าคอมแนะนำเพื่อน", data: "referral_commission" } },
          ],
        },
      },
    ],
  };
}

// --- ASSISTANT NAME (กันชื่อซ้ำ) ---
function pickAssistantName(userId, state) {
  const now = Date.now();
  if (state.assistantName && state.assistantNameSetAt && (now - state.assistantNameSetAt < nameLockMinutes * 60 * 1000)) {
    return state.assistantName;
  }
  let available = staffNames.filter(n => !Object.values(usedAssistantNames).includes(n));
  if (!available.length) available = staffNames;
  const newName = available[Math.floor(Math.random() * available.length)];
  usedAssistantNames[userId] = newName;
  state.assistantName = newName;
  state.assistantNameSetAt = now;
  return newName;
}
function clearAssistantName(userId) { delete usedAssistantNames[userId]; }

// --- Q/A FORM DETECT ---
function checkRegisterAdmin(text) {
  const phone = text.match(/\d{9,12}/);
  const account = text.match(/([0-9]{9,20}|wallet|วอลเลท|truewallet)/i);
  const line = text.match(/([lL]ine.?id|@[\w\-_.]+|[a-zA-Z0-9]{4,})/);
  const hasName = /ชื่อ/.test(text) || /นามสกุล/.test(text);
  return hasName && phone && account && line;
}
function checkRegisterProblem(text) {
  const phone = text.match(/\d{9,12}/);
  const hasName = /ชื่อ/.test(text) || /นามสกุล/.test(text);
  return hasName && phone;
}
function checkDeposit(text) {
  const phone = text.match(/\d{9,12}/);
  const hasName = /ชื่อ/.test(text) || /นามสกุล/.test(text);
  const slip = /(สลิป|slip|หลักฐาน|jpg|png|pdf)/i.test(text);
  return hasName && phone && slip;
}
function checkWithdraw(text) {
  const phone = text.match(/\d{9,12}/);
  const amt = text.match(/\d{2,}/);
  return phone && amt;
}
function checkLoginProblem(text) {
  const phone = text.match(/\d{9,12}/);
  const hasName = /ชื่อ/.test(text) || /นามสกุล/.test(text);
  return hasName && phone;
}
function detectNegative(text) {
  return negativeWords.some(word => text.includes(word));
}
function logNegativeToTelegram(userId, text) {
  sendTelegramAlert(`⚠️ [คำหยาบ/คำแรง] จากยูสเซอร์ ${userId}\nข้อความ: ${text}`);
}

// --- FETCH REAL DATA ---
async function fetchRealData(query) {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://www.google.com/search?q=${encodedQuery}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36" }
    });
    const html = await res.text();
    const match = html.match(/<span class="BNeawe[^>]*>(.*?)<\/span>/);
    return match ? match[1] : "";
  } catch (err) {
    return "";
  }
}

// --- NOTIFY ADMIN ---
async function notifyAdmin(event, msg) {
  try {
    const profile = await getLineProfile(event.source?.userId);
    const name = profile?.displayName || "ไม่ทราบชื่อ";
    const oa = process.env.LINE_OA_NAME || "OA";
    await sendTelegramAlert(`📢 แจ้งเตือนจาก ${oa}\n👤 ลูกค้า: ${name}\n💬 ข้อความ: ${msg}`);
    if (event.message?.type === "image") {
      const photo = await getLineImage(event.message.id);
      if (photo) await sendTelegramPhoto(photo, `📷 รูปจากลูกค้า (${name})`);
    }
  } catch (err) { }
}

// --- FLEX MENU AUTO ---
function shouldSendFlex(userId) {
  const state = getUserState(userId);
  return Date.now() - (state.lastFlexSent || 0) > flexCooldown;
}
function getUserState(userId) {
  if (!userStates[userId]) {
    userStates[userId] = {
      lastFlexSent: 0, lastGreeted: 0, currentCase: null, caseData: {}, lastActive: Date.now(),
      chatHistory: [], totalDeposit: 0, assistantName: null, assistantNameSetAt: 0, caseFollowUpCount: 0,
      currentForm: null
    };
  }
  return userStates[userId];
}
function updateUserState(userId, newState) {
  userStates[userId] = { ...getUserState(userId), ...newState };
}

// --- MAIN FLOW ---
async function handleCustomerFlow(event, lineClient) {
  const userId = event.source?.userId;
  const state = getUserState(userId);
  updateUserState(userId, { lastActive: Date.now() });
  const text = event.message?.text?.trim() || "";
  const checkText = text.toLowerCase().replace(/\s/g, "");

  // PAUSE/UNPAUSE
  if (pauseKeywords.some(k => checkText.includes(k))) {
    globalPause = true; pauseBy = userId;
    Object.keys(userStates).forEach(uid => updateUserState(uid, { currentForm: null, formData: {} }));
    await sendTelegramAlert(`[PAUSE] (${pauseBy}) เปิด pause`);
    return [{ type: "text", text: "โหมด pause: หัวหน้าแอดมินกำลังดูแลค่ะ" }];
  }
  if (globalPause && unpauseKeywords.some(k => checkText.includes(k))) {
    globalPause = false; pauseBy = null;
    await sendTelegramAlert(`[UNPAUSE] (${userId}) ปลด pause`);
    return [
      { type: "text", text: "กลับมาเปิดระบบปกติแล้วค่ะ ถาม/แจ้งปัญหาได้เลย 💖" },
      { type: "flex", altText: "🎀 เมนูพิเศษ", contents: createFlexMenuContents() }
    ];
  }
  if (globalPause) {
    await sendTelegramAlert(`[DEBUG] ignore, pause by ${pauseBy}, msg="${text}"`);
    return [];
  }

  // FLEX AUTO
  if (event.type === "message" && shouldSendFlex(userId)) {
    updateUserState(userId, { lastFlexSent: Date.now() });
    return [{ type: "flex", altText: "🎀 เมนูพิเศษ", contents: createFlexMenuContents() }];
  }

  // POSTBACK BUTTONS : FORM
  if (event.type === "postback") {
    const data = event.postback.data;
    if (data === "register_admin") {
      updateUserState(userId, { currentForm: "register_admin" });
      const askText = await getCuteDynamicReply(
        "แต่งประโยคขอข้อมูล 'ชื่อ-นามสกุล, เบอร์, เลขบัญชีหรือวอลเลท, LINE ID' จากลูกค้าให้ส่งครบในครั้งเดียว น่ารัก ไม่ซ้ำเดิม",
        pickAssistantName(userId, state)
      );
      return [
        { type: "text", text: "📲 ลูกค้ากดปุ่ม “ให้แอดมินสมัครให้”" },
        { type: "text", text: askText }
      ];
    }
    if (data === "issue_deposit") {
      updateUserState(userId, { currentForm: "deposit" });
      const askText = await getCuteDynamicReply(
        "แต่งประโยคขอข้อมูล 'ชื่อ-นามสกุล, เบอร์, สลิป/หลักฐานการโอน' ให้ส่งทีเดียว",
        pickAssistantName(userId, state)
      );
      return [
        { type: "text", text: "💰 ลูกค้ากดปุ่ม “แจ้งปัญหาฝาก”" },
        { type: "text", text: askText }
      ];
    }
    if (data === "issue_withdraw") {
      updateUserState(userId, { currentForm: "withdraw" });
      const askText = await getCuteDynamicReply(
        "แต่งประโยคขอข้อมูล 'เบอร์โทร, ยอดถอน' ให้ส่งทีเดียว น่ารัก",
        pickAssistantName(userId, state)
      );
      return [
        { type: "text", text: "💸 ลูกค้ากดปุ่ม “แจ้งปัญหาถอน”" },
        { type: "text", text: askText }
      ];
    }
    if (data === "forgot_password" || data === "login_backup") {
      updateUserState(userId, { currentForm: "login_problem" });
      const askText = await getCuteDynamicReply(
        "แต่งประโยคขอข้อมูล 'ชื่อ-นามสกุล, เบอร์โทร' ขอทีเดียว น่ารัก",
        pickAssistantName(userId, state)
      );
      return [
        { type: "text", text: "🔑 ลูกค้ากดปุ่ม “ลืมรหัส/เข้าเล่นไม่ได้”" },
        { type: "text", text: askText }
      ];
    }
    if (data === "review_withdraw") {
      return [{ type: "text", text: await generateWithdrawReviewMessage() }];
    }
    if (data === "max_withdraw") {
      return [{ type: "text", text: await generateMaxWithdrawMessage() }];
    }
    if (data === "top_game") {
      return [{ type: "text", text: await generateTopGameMessage() }];
    }
    if (data === "referral_commission") {
      return [{ type: "text", text: await generateReferralCommissionMessage() }];
    }
    return [{ type: "text", text: "ขออภัย ไม่พบคำสั่งนี้" }];
  }

  // FORM FLOW : รับข้อความหลังจากขอข้อมูล
  if (state.currentForm === "register_admin") {
    if (checkRegisterAdmin(text)) {
      await notifyAdmin(event, `สมัครผ่านแอดมิน: ${text}`);
      updateUserState(userId, { currentForm: null });
      clearAssistantName(userId);
      const reply = await getCuteDynamicReply("แต่งข้อความแจ้งลูกค้าว่าได้รับข้อมูลสมัครแล้ว กำลังประสานหัวหน้าให้นะคะ", pickAssistantName(userId, state));
      return [{ type: "text", text: reply }];
    }
    return [{ type: "text", text: "กรุณาส่ง ชื่อ-นามสกุล, เบอร์, เลขบัญชี/วอลเลท, LINE ID ให้ครบในข้อความเดียวค่ะ" }];
  }
  if (state.currentForm === "deposit") {
    if (checkDeposit(text)) {
      await notifyAdmin(event, `ฝาก: ${text}`);
      updateUserState(userId, { currentForm: null });
      clearAssistantName(userId);
      const reply = await getCuteDynamicReply("แต่งข้อความแจ้งลูกค้าว่าได้รับข้อมูลฝากแล้ว กำลังประสานให้นะคะ", pickAssistantName(userId, state));
      return [{ type: "text", text: reply }];
    }
    return [{ type: "text", text: "กรุณาส่ง ชื่อ-นามสกุล, เบอร์, สลิป/หลักฐานโอน ในข้อความเดียวค่ะ" }];
  }
  if (state.currentForm === "withdraw") {
    if (checkWithdraw(text)) {
      await notifyAdmin(event, `ถอน: ${text}`);
      updateUserState(userId, { currentForm: null });
      clearAssistantName(userId);
      const reply = await getCuteDynamicReply("แต่งข้อความแจ้งลูกค้าว่าได้รับข้อมูลถอนแล้ว กำลังเร่งประสานให้นะคะ", pickAssistantName(userId, state));
      return [{ type: "text", text: reply }];
    }
    return [{ type: "text", text: "กรุณาส่ง เบอร์โทร + ยอดถอน ในข้อความเดียวค่ะ" }];
  }
  if (state.currentForm === "login_problem") {
    if (checkLoginProblem(text)) {
      await notifyAdmin(event, `เข้าเล่น/ลืมรหัส: ${text}`);
      updateUserState(userId, { currentForm: null });
      clearAssistantName(userId);
      const reply = await getCuteDynamicReply("แต่งข้อความแจ้งลูกค้าว่าได้รับข้อมูลแล้ว กำลังประสานหัวหน้าฝ่าย", pickAssistantName(userId, state));
      return [{ type: "text", text: reply }];
    }
    return [{ type: "text", text: "กรุณาส่ง ชื่อ-นามสกุล, เบอร์โทร ในข้อความเดียวค่ะ" }];
  }

  // สมัครไม่ได้/OTP
  if (/สมัครไม่ได้|otp|สมัครล้มเหลว|สมัครติดปัญหา/.test(text)) {
    updateUserState(userId, { currentForm: "register_problem" });
    const askText = await getCuteDynamicReply("แต่งประโยคขอข้อมูล 'ชื่อ-นามสกุล, เบอร์โทร' สำหรับปัญหาสมัคร/otp ขอทีเดียว", pickAssistantName(userId, state));
    return [{ type: "text", text: askText }];
  }
  if (state.currentForm === "register_problem") {
    if (checkRegisterProblem(text)) {
      await notifyAdmin(event, `ปัญหาสมัคร/otp: ${text}`);
      updateUserState(userId, { currentForm: null });
      clearAssistantName(userId);
      const reply = await getCuteDynamicReply("แต่งข้อความแจ้งลูกค้าว่าได้รับข้อมูลแล้ว กำลังประสานหัวหน้าฝ่าย", pickAssistantName(userId, state));
      return [{ type: "text", text: reply }];
    }
    return [{ type: "text", text: "กรุณาส่ง ชื่อ-นามสกุล, เบอร์โทร ในข้อความเดียวค่ะ" }];
  }

  // SHORT REPLIES (กันหาย)
  if (shortReplies.includes(text.trim().toLowerCase())) {
    return [
      { type: "text", text: "รับทราบค่ะ ถ้ามีอะไรสอบถามเพิ่มเติมได้เสมอนะคะ" }
    ];
  }

  // GREETING / FLEX
  if (event.type === "follow" || ["สวัสดี", "hello", "hi"].includes(text.toLowerCase())) {
    updateUserState(userId, { lastFlexSent: Date.now() });
    await notifyAdmin(event, "ลูกค้าเพิ่มเพื่อนใหม่หรือทักทาย");
    return [
      { type: "flex", altText: "🎀 เมนูพิเศษ", contents: createFlexMenuContents() },
      { type: "text", text: `สวัสดีค่ะ ${pickAssistantName(userId, state)} เป็นแอดมินดูแลลูกค้าของเว็บ PGTHAI289 นะคะ 💕` }
    ];
  }

  // DETECT คำหยาบ & Q&A GPT + Real Data
  if (detectNegative(text)) {
    logNegativeToTelegram(userId, text);
    let realData = "";
    if (text.includes("หวย")) realData = await fetchRealData("เลขเด็ด หวยไทยรัฐ งวดนี้");
    else if (text.includes("ผลบอล")) realData = await fetchRealData("ผลบอลวันนี้");
    else if (text.includes("ข่าว")) realData = await fetchRealData("ข่าวล่าสุดวันนี้");
    let gptPrompt = `
บทบาท: เป็นแอดมินผู้หญิงชื่อ ${pickAssistantName(userId, state)} ของ PGTHAI289
หน้าที่: ตอบลูกค้าที่ใช้คำหยาบหรืออารมณ์เสีย (หัวร้อน) ด้วยความเข้าใจและวิธีแบบนักจิตวิทยา
สิ่งที่ต้องทำ: 
- ตอบปลอบใจ/ลดความตึงเครียด/ขอโทษ/ให้กำลังใจ/ประนีประนอม ไม่ตอบโต้
- เสนอความช่วยเหลือ/ยืนยันเว็บดูแลจริง
- จำกัด 2 ประโยคหลัก + 1 ประโยคเสริม
ข้อมูลจริง: ${realData}
ข้อความลูกค้า: "${text}"
`;
    let reply = "";
    try { reply = await getCuteDynamicReply(gptPrompt, pickAssistantName(userId, state)); }
    catch { reply = "เข้าใจความรู้สึกค่ะ เดี๋ยวช่วยดูแลอย่างดีที่สุดนะคะ"; }
    await notifyAdmin(event, text);
    return [{ type: "text", text: reply }];
  }

  // Q&A GPT + ดึง Real Data
  let realData = "";
  if (text.includes("หวย")) realData = await fetchRealData("เลขเด็ด หวยไทยรัฐ งวดนี้");
  else if (text.includes("ผลบอล")) realData = await fetchRealData("ผลบอลวันนี้");
  else if (text.includes("ข่าว")) realData = await fetchRealData("ข่าวล่าสุดวันนี้");
  else if (text.length > 5) realData = await fetchRealData(text);

  let gptPrompt = `บทบาท: เป็นแอดมินผู้หญิงชื่อ ${pickAssistantName(userId, state)} ของ PGTHAI289
หน้าที่: ตอบคำถามลูกค้าอย่างฉลาด มืออาชีพ เป็นกันเอง มีข้อมูลจริง
- ตอบ Q ก่อนด้วยข้อมูลจริง (ถ้ามี)
- หลังตอบ ชวนเล่นกับเว็บเนียนๆ
- จำกัด 2 ประโยค
ข้อมูลจริง: ${realData}
ข้อความ: "${text}"`;

  let gptReply = "";
  try { gptReply = await getCuteDynamicReply(gptPrompt, pickAssistantName(userId, state)); }
  catch { gptReply = "สอบถามเพิ่มเติมได้เลยค่ะ พร้อมดูแลตลอด 24 ชม. 💕"; }
  await notifyAdmin(event, text || "ลูกค้าส่งข้อความ/รูป");
  return [{ type: "text", text: gptReply }];
}

// --- CRM FOLLOW-UP ---
function initCRM(lineClient) {
  setInterval(async () => {
    const now = Date.now();
    const followupPeriods = [
      { days: 3, prompt: "สร้างข้อความน่ารัก ชวนลูกค้าที่หายไป 3 วัน กลับมาเล่น PGTHAI289 แบบมืออาชีพ" },
      { days: 7, prompt: "สร้างข้อความชวนลูกค้าที่หายไป 7 วัน กลับมาเล่น PGTHAI289 พร้อมบอกว่ามีโปรดีๆ รออยู่" },
      { days: 15, prompt: "สร้างข้อความชวนลูกค้าที่หายไป 15 วัน ให้กลับมาเล่น PGTHAI289 ด้วยคำพูดอบอุ่น" },
      { days: 30, prompt: "สร้างข้อความพิเศษชวนลูกค้าที่หายไป 30 วัน กลับมาเล่น PGTHAI289 พร้อมบอกถึงโปรเด็ดและเกมใหม่" },
    ];
    for (const period of followupPeriods) {
      const inactive = Object.keys(userStates).filter(
        uid => now - (userStates[uid]?.lastActive || 0) > period.days * 24 * 60 * 60 * 1000
      );
      for (const uid of inactive) {
        try {
          const state = getUserState(uid);
          const name = pickAssistantName(uid, state);
          const msg = await getCuteDynamicReply(period.prompt, name);
          await lineClient.pushMessage(uid, { type: "text", text: msg });
          await lineClient.pushMessage(uid, { type: "flex", altText: "🎀 กลับมาเล่นกับเรา 🎀", contents: createFlexMenuContents() });
          await sendTelegramAlert(`📢 CRM (${period.days} วัน) ส่งข้อความหา: ${uid}`);
          updateUserState(uid, { lastActive: Date.now() });
        } catch (err) { }
      }
    }
  }, 6 * 60 * 60 * 1000);
}

// --- EXPORT ---
export { handleCustomerFlow, createFlexMenuContents, initCRM };
