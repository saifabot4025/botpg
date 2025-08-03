import fetch from "node-fetch";
import { getCuteDynamicReply } from "../services/gptService.js";
import { sendTelegramAlert, sendTelegramPhoto, getLineProfile } from "../services/telegramService.js";
import { getLineImage } from "../services/lineMediaService.js";
import { staffNames } from "../utils/staffNames.js";

const userStates = {};
const flexCooldown = 2 * 60 * 60 * 1000; // 2 ชม.
const greetCooldown = 10 * 60 * 1000;
const nameLockMinutes = 10;

let globalPause = false;

const pauseKeywords = [
  "แอดมินรับเคสแล้ว", "แอดมินกำลังดูแล", "หัวหน้าแอดมินรับเคส", "แอดมินกำลังดำเนินการ",
  "รับเคสแล้วค่ะ", "รับเรื่องแล้วนะคะ", "แอดมินกำลังช่วยอยู่", "กำลังตรวจสอบให้ค่ะ",
  "กำลังดำเนินการให้ค่ะ", "กำลังดูแลอยู่ค่ะ", "แอดมินมาดูแล", "แอดมินเข้ามาดูแลแล้ว",
  "รับเรื่องแล้วค่ะ", "รับเรื่องเรียบร้อยแล้ว"
];
const unpauseKeywords = [
  "ดำเนินการให้เรียบร้อยแล้วค่ะ", "ดำเนินการเรียบร้อยแล้วค่ะ", "เคสนี้เสร็จแล้วค่ะ", "เสร็จเรียบร้อยแล้วค่ะ",
  "ดำเนินการเสร็จแล้วค่ะ", "เรียบร้อยแล้วค่ะ", "จัดการเสร็จแล้วค่ะ", "แก้ไขเรียบร้อยค่ะ",
  "เรียบร้อยแล้วนะคะ", "เสร็จแล้วค่ะ", "เคสเสร็จเรียบร้อยค่ะ"
].map(k => k.replace(/\s/g, ""));

// ---------- UTILS ----------
function getUserState(userId) {
  if (!userStates[userId]) {
    userStates[userId] = {
      lastFlexSent: 0, lastGreeted: 0, lastActive: Date.now(),
      assistantName: null, assistantNameSetAt: 0, chatHistory: [],
      crmLevel: 0, formStatus: null, formData: {}, caseFollowUpCount: 0,
      currentCase: null
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
function shouldGreet(userId) {
  const state = getUserState(userId);
  return Date.now() - state.lastGreeted > greetCooldown;
}
function pickAssistantName(userId, state) {
  const now = Date.now();
  if (state.assistantName && (now - state.assistantNameSetAt < nameLockMinutes * 60 * 1000)) {
    return state.assistantName;
  }
  const newName = staffNames[Math.floor(Math.random() * staffNames.length)];
  updateUserState(userId, { assistantName: newName, assistantNameSetAt: now });
  return newName;
}
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
  } catch (err) { console.error("notifyAdmin error:", err); }
}
function detectNegative(text) {
  const negatives = [
    "โกง","ขโมย","ไม่จ่าย","ถอนเงินไม่ได้","แย่","เสียใจ","โมโห","หัวร้อน","โดนโกง","ไม่ยอมโอน","โดนหลอก","บริการแย่","จะฟ้อง",
    "ไม่คืนเงิน","เว็บเถื่อน","ไม่โปร่งใส","หลอกลวง","ไม่พอใจ","เหี้ย","สัส","สัตว์","ควาย","โง่","เฮงซวย","ห่วย","ไอ้เหี้ย","ไอ้สัส","ไอ้สัตว์","ไอ้ควาย","ไอ้โง่",
    "หน้าหี","อีดอก","อีเหี้ย","อีควาย","อีสัตว์","อีหน้าหี","อีสัส","ชั่ว","สถุน","ถ่อย","อัปรีย์","ต่ำตม","อีเวร","เวร","กรรม","อีบ้า","ไอ้บ้า","กาก",
    "กะหรี่","ร่าน","แม่ง","เชี่ย","มึง","กู","ฟาย","แดก","หัวควย","ขี้โกง","โกงแดก","มึงโกง","เชี้ย","สันขวาน","หน้าส้นตีน","ไร้มารยาท","ไม่เคารพ","หน้าด้าน","น่ารังเกียจ","ส้นตีน"
  ];
  return negatives.some(word => text.includes(word));
}
function logNegativeToTelegram(userId, text) {
  sendTelegramAlert(`⚠️ [คำหยาบ/คำแรง] จากยูสเซอร์ ${userId}\nข้อความ: ${text}`);
}
async function fetchRealData(query) {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://www.google.com/search?q=${encodedQuery}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    const html = await res.text();
    const match = html.match(/<span class="BNeawe[^>]*>(.*?)<\/span>/);
    return match ? match[1] : "ไม่พบข้อมูลที่เกี่ยวข้อง";
  } catch (err) {
    console.error("fetchRealData Error:", err);
    return "ไม่สามารถค้นหาข้อมูลได้";
  }
}
function randomMaskedPhone() {
  const prefix = "08";
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}xxxx${suffix}`;
}
async function generateWithdrawReviewMessage() {
  const reviews = [];
  for (let i = 0; i < 10; i++) {
    const phone = randomMaskedPhone();
    const amt = (Math.floor(Math.random() * 45000) + 5000).toLocaleString();
    reviews.push(`ยูส ${phone} ถอน ${amt}`);
  }
  return `📊 รีวิวการถอนล่าสุด\n\n${reviews.join("\n")}\n\nเว็บมั่นคง ปลอดภัย จ่ายจริง 💕`;
}
async function generateMaxWithdrawMessage() {
  const today = new Date().toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" });
  if (!global.cachedDate || global.cachedDate !== today) {
    global.cachedDate = today;
    const names = ["กิตติ","สมชาย","ณัฐพล","ธีรภัทร","จักรพงศ์","ปิยะ","อาทิตย์","ชยพล","ภาณุ","สุรศักดิ์",
      "วิชัย","ณรงค์","กมล","อนันต์","ประเสริฐ","พรชัย","สกล","พงษ์ศักดิ์","ชัยวัฒน์","สมบัติ",
      "สุพรรณ","ปรีชา","สมพงษ์","วิทยา","วรพล","สุภาวดี","กมลวรรณ","พัชราภา","ปวีณา","สุภาวรรณ",
      "นภัสสร","กัญญารัตน์","ปาริชาติ","อรอนงค์","จันทร์เพ็ญ","ธิดารัตน์","สุธาสินี","พิมพ์ชนก",
      "อารยา","วราภรณ์","สุวรรณา","ศิริพร","อัญชลี","รัชนีกร","ภัทรพร","พัชรี","มนัสวี","สายพิณ",
      "รัตนาภรณ์","ดวงกมล"
    ];
    global.cachedName = names[Math.floor(Math.random() * names.length)];
    global.cachedAmt = Math.floor(Math.random() * 200000) + 300000;
  }
  return `👑 ยอดถอนสูงสุดวันนี้\n\nยินดีกับคุณ "${global.cachedName}" ยูส ${randomMaskedPhone()} ถอน ${global.cachedAmt.toLocaleString()} บาท\nวันที่ ${today}`;
}
async function generateTopGameMessage() {
  const games = [
    "Graffiti Rush • กราฟฟิตี้ รัช","Treasures of Aztec • สาวถ้ำ","Fortune Ox • วัวโดด",
    "Fortune Snake • งูทอง","Fortune Rabbit • กระต่ายโชคลาภ","Lucky Neko • แมวกวัก",
    "Fortune Mouse • หนูทอง","Dragon Hatch • รังมังกร","Wild Bounty Showdown • คาวบอย",
    "Ways of the Qilin • กิเลน","Galaxy Miner • นักขุดอวกาศ","Incan Wonders • สิ่งมหัศจรรย์อินคา",
    "Diner Frenzy Spins • มื้ออาหารสุดปัง","Dragon's Treasure Quest • มังกรซ่อนสมบัติ",
    "Jack the Giant Hunter • แจ็กผู้ฆ่ายักษ์"
  ];
  const selected = games.sort(() => 0.5 - Math.random()).slice(0, 5);
  const freeSpin = Math.floor(Math.random() * (500000 - 50000)) + 50000;
  const normal = Math.floor(Math.random() * (50000 - 5000)) + 5000;
  let msg = "🎲 เกมสล็อตแตกบ่อยวันนี้\n\n";
  selected.forEach((g, i) => msg += `${i + 1}. ${g} - ${Math.floor(Math.random() * 20) + 80}%\n`);
  msg += `\n💥 ฟรีสปินแตกล่าสุด: ${freeSpin.toLocaleString()} บาท\n💥 ปั่นธรรมดาแตกล่าสุด: ${normal.toLocaleString()} บาท\nเล่นเลย แตกง่าย จ่ายจริง 💕`;
  return msg;
}
async function generateReferralCommissionMessage() {
  const lines = [];
  for (let i = 0; i < 10; i++) {
    const phone = randomMaskedPhone();
    const amt = (Math.floor(Math.random() * 97000) + 3000).toLocaleString();
    lines.push(`ยูส ${phone} ได้ค่าคอมมิชชั่น ${amt}`);
  }
  return `🤝 ค่าคอมมิชชั่นแนะนำเพื่อน\n\n${lines.join("\n")}\n\n💡 ชวนเพื่อนมาเล่น รับค่าคอมทุกวัน!`;
}
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
            { type: "button", style: "primary", color: "#000000", action: { type: "postback", label: "💰 ปัญหาฝาก/ถอน", data: "issue_deposit" } },
            { type: "button", style: "secondary", color: "#FFD700", action: { type: "postback", label: "🔑 ลืมรหัสผ่าน", data: "forgot_password" } },
            { type: "button", style: "primary", color: "#000000", action: { type: "postback", label: "🚪 เข้าเล่นไม่ได้", data: "login_backup" } },
            { type: "button", style: "secondary", color: "#FFD700", action: { type: "postback", label: "🎁 โปรโมชั่น/กิจกรรม", data: "promo_info" } },
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

// ===== MAIN FLOW =====
async function handleCustomerFlow(event, lineClient) {
  const userId = event.source?.userId;
  const state = getUserState(userId);
  updateUserState(userId, { lastActive: Date.now() });
  const text = event.message?.text?.trim() || "";
  const normalizedText = text.toLowerCase().replace(/\s/g, "");

  // GLOBAL PAUSE/UNPAUSE จับข้อความ "ทั้งห้อง"
  if (pauseKeywords.some(k => normalizedText.includes(k.replace(/\s/g, "")))) {
    globalPause = true;
    await sendTelegramAlert(`[PAUSE] (GLOBAL) ห้องนี้ถูก pause`);
    return [{ type: "text", text: "หัวหน้าแอดมินกำลังดูแลลูกค้าอยู่ค่ะ น้องส่งต่อให้เรียบร้อยแล้ว 💕 (โหมด pause)" }];
  }
  if (globalPause && unpauseKeywords.some(k => normalizedText.includes(k))) {
    globalPause = false;
    await sendTelegramAlert(`[UNPAUSE] (GLOBAL) ห้องนี้กลับมาเปิดใช้งาน`);
    return [
      { type: "text", text: "ยินดีให้บริการตลอด 24 ชั่วโมงเลยนะคะ ถ้ามีคำถามหรือปัญหาเพิ่มเติม แจ้งน้องได้เลยค่ะ 💖" },
      { type: "flex", altText: "🎀 เมนูพิเศษ", contents: createFlexMenuContents() }
    ];
  }
  if (globalPause) return [];

  // ต่อด้วย logic รับข้อมูล/postback/CRM/FLEX/ฯลฯ ตามเวอร์ชั่นที่เคยให้

  // ทักทาย/เพิ่มเพื่อน
  const assistantName = pickAssistantName(userId, state);
  if (
    (event.type === "follow" && shouldGreet(userId)) ||
    (["สวัสดี", "hello", "hi"].includes(text.toLowerCase()))
  ) {
    updateUserState(userId, { lastFlexSent: Date.now(), lastGreeted: Date.now() });
    await notifyAdmin(event, "ลูกค้าเพิ่มเพื่อนใหม่หรือทักทาย");
    return [
      { type: "flex", altText: "🎀 เมนูพิเศษ", contents: createFlexMenuContents() },
      { type: "text", text: `สวัสดีค่ะ ${assistantName} เป็นแอดมินดูแลลูกค้าของเว็บ PGTHAI289 นะคะ 💕` }
    ];
  }

  // กดปุ่ม postback
  if (event.type === "postback") {
    const data = event.postback.data;
    if (data === "register_admin") {
      state.formStatus = "register";
      return [{ type: "text", text: "กรุณาพิมพ์ข้อมูล: ชื่อ-นามสกุล เบอร์โทร เลขบัญชี/วอลเลท และ LINE ID ใน 1 ข้อความค่ะ" }];
    }
    if (data === "login_backup" || data === "forgot_password") {
      state.formStatus = "login_backup";
      return [{ type: "text", text: "กรุณาพิมพ์ชื่อ-นามสกุล และเบอร์โทรที่สมัครไว้ใน 1 ข้อความค่ะ" }];
    }
    if (data === "issue_deposit") {
      state.formStatus = "deposit";
      return [{ type: "text", text: "กรุณาพิมพ์ชื่อ, เบอร์โทร และแนบสลิป (ถ้ามี) ในข้อความเดียวกันค่ะ" }];
    }
    if (data === "promo_info") {
      return [{ type: "text", text: "สนใจโปรหรือกิจกรรมแบบไหนทักได้เลยค่ะ 💕" }];
    }
    if (data === "review_withdraw") return [{ type: "text", text: await generateWithdrawReviewMessage() }];
    if (data === "max_withdraw") return [{ type: "text", text: await generateMaxWithdrawMessage() }];
    if (data === "top_game") return [{ type: "text", text: await generateTopGameMessage() }];
    if (data === "referral_commission") return [{ type: "text", text: await generateReferralCommissionMessage() }];
  }

  // รับข้อมูล (ฟอร์ม)
  if (state.formStatus === "register" && text.length > 10) {
    await notifyAdmin(event, `ข้อมูลสมัครสมาชิก: ${text}`);
    updateUserState(userId, { formStatus: null });
    return [{ type: "text", text: "น้องรับข้อมูลครบแล้วค่ะ ส่งเรื่องให้แอดมินประสานให้เรียบร้อย รอสักครู่นะคะ 💕" }];
  }
  if (state.formStatus === "login_backup" && text.length > 6) {
    await notifyAdmin(event, `ปัญหาทางเข้า/ลืมรหัส: ${text}`);
    updateUserState(userId, { formStatus: null });
    return [{ type: "text", text: "น้องรับข้อมูลครบแล้วค่ะ เดี๋ยวประสานหัวหน้าฝ่ายให้ทันทีนะคะ" }];
  }
  if (state.formStatus === "deposit" && text.length > 6) {
    await notifyAdmin(event, `แจ้งปัญหาฝาก: ${text}`);
    updateUserState(userId, { formStatus: null });
    return [{ type: "text", text: "ได้รับข้อมูลฝากและสลิปแล้วค่ะ เดี๋ยวประสานงานให้ทันทีนะคะ" }];
  }

  // FLEX ทุก 2 ชม.
  if (event.type === "message" && shouldSendFlex(userId)) {
    updateUserState(userId, { lastFlexSent: Date.now() });
    return [{ type: "flex", altText: "🎀 เมนูพิเศษ", contents: createFlexMenuContents() }];
  }

  // ============ GPT ตอบฉลาด + ข้อมูลจริง + คำหยาบ ============
  let realData = "";
  if (text.includes("หวย") || text.includes("เลขเด็ด")) realData = await fetchRealData("เลขเด็ด หวยไทยรัฐ งวดนี้");
  else if (text.includes("ผลบอล") || text.includes("ฟุตบอล")) realData = await fetchRealData("ผลบอลวันนี้");
  else if (text.includes("ข่าว") || text.includes("วันนี้")) realData = await fetchRealData("ข่าวล่าสุดวันนี้");
  else if (text.length > 2) realData = await fetchRealData(text);

  let gptPrompt;
  if (detectNegative(text)) {
    logNegativeToTelegram(userId, text);
    gptPrompt = `
บทบาท: เป็นแอดมินผู้หญิงชื่อ ${assistantName} ของ PGTHAI289
หน้าที่: ตอบลูกค้าที่ใช้คำหยาบหรืออารมณ์เสีย (หัวร้อน) ด้วยความเข้าใจและวิธีแบบนักจิตวิทยา
สิ่งที่ต้องทำ:
1. วิเคราะห์เหตุผลเบื้องหลังอารมณ์เสีย/คำด่าของลูกค้า (โดยประมาณ) จากข้อความที่ได้รับ
2. ตอบปลอบใจ/ลดความตึงเครียด/ขอโทษ/ให้กำลังใจ/ประนีประนอม ไม่ตอบโต้หรือย้อนด่า
3. เสนอความช่วยเหลือ ให้มั่นใจว่าเว็บดูแลลูกค้าจริง มีแอดมินตรวจสอบเสมอ
4. หลีกเลี่ยงการใช้อารมณ์หรือคำพูดรุนแรงเด็ดขาด
5. จำกัด 2 ประโยคหลัก + 1 ประโยคเสริมแนะนำการติดต่อ admin
ข้อมูลจริง:
${realData}
ข้อความลูกค้า: "${text}"
`;
  } else {
    gptPrompt = `
บทบาท: เป็นแอดมินผู้หญิงชื่อ ${assistantName} ของ PGTHAI289
หน้าที่: ตอบคำถามลูกค้าอย่างฉลาด มืออาชีพ และเป็นกันเอง
วิธีตอบ:
1. วิเคราะห์คำถามลูกค้าและหาคำตอบที่ตรงกับคำถามให้ก่อน (ใช้ข้อมูลจริงถ้ามี)
2. หลังจากตอบคำถามแล้ว ชวนลูกค้าเล่นกับเว็บ PGTHAI289 แบบเนียนๆ
3. ใช้สรรพนาม "${assistantName}" หรือ "น้อง" ได้ แต่ห้ามขึ้นต้นทุกข้อความด้วยชื่อนี้!
4. ใช้คำพูดแบบผู้หญิง เช่น ค่ะ จ้า น้า
5. จำกัดไม่เกิน 2 ประโยค ให้เป็นธรรมชาติ อบอุ่น ไม่แข็งทื่อ
6. ถ้าเพิ่งคุยกันไม่เกิน 10 นาที ห้ามเริ่มด้วย "สวัสดี" แต่ให้ต่อเนื่องจากการคุยเดิม
ข้อมูลจริง:
${realData}
ข้อความจากลูกค้า: "${text}"
`;
  }

  let gptReply = '';
  try {
    gptReply = await getCuteDynamicReply(gptPrompt, assistantName);
  } catch (err) {
    console.error('GPT Error:', err);
    gptReply = `พร้อมดูแลพี่เสมอนะคะ 💕 หากมีปัญหาสอบถามได้เลยน้า`;
  }
  state.chatHistory.push({ role: "assistant", content: gptReply });
  updateUserState(userId, state);
  await notifyAdmin(event, text || "ลูกค้าส่งข้อความ/รูป");
  return [{ type: "text", text: gptReply }];
}

// ==== CRM FOLLOW-UP ====
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
        } catch (err) {
          console.error(`CRM Error (${period.days} วัน):`, err);
        }
      }
    }
  }, 6 * 60 * 60 * 1000);
}

// ==== EXPORT ====
export { handleCustomerFlow, createFlexMenuContents, initCRM };
