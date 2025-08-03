import fetch from "node-fetch";
import { getCuteDynamicReply } from "../services/gptService.js";
import { sendTelegramAlert, sendTelegramPhoto, getLineProfile } from "../services/telegramService.js";
import { getLineImage } from "../services/lineMediaService.js";
import { staffNames } from "../utils/staffNames.js";

const userStates = {};
const userPausedStates = {};
const flexCooldown = 2 * 60 * 60 * 1000; // 2 ชั่วโมง
const greetCooldown = 10 * 60 * 1000;    // 10 นาที
const nameLockMinutes = 10;              // 10 นาทีล็อกชื่อ

// คำสำคัญที่บ่งบอกว่าบอทควรหยุดตอบเพราะแอดมินรับเคสแล้ว
const pauseKeywords = [
  "แอดมินรับเคสแล้ว",
  "แอดมินกำลังดูแล",
  "หัวหน้าแอดมินรับเคส",
  "แอดมินกำลังดำเนินการ",
  "รับเคสแล้วค่ะ",
  "รับเรื่องแล้วนะคะ",
  "แอดมินกำลังช่วยอยู่",
  "กำลังตรวจสอบให้ค่ะ",
  "กำลังดำเนินการให้ค่ะ",
  "กำลังดูแลอยู่ค่ะ",
  "แอดมินมาดูแล",
  "แอดมินเข้ามาดูแลแล้ว",
  "รับเรื่องแล้วค่ะ",
  "รับเรื่องเรียบร้อยแล้ว"
];

// คำสำคัญที่บ่งบอกว่าบอทควรกลับมาทำงาน (unpause)
const unpauseKeywords = [
  "ดำเนินการให้เรียบร้อยแล้วค่ะ",
  "ดำเนินการเรียบร้อยแล้วค่ะ",
  "เคสนี้เสร็จแล้วค่ะ",
  "เสร็จเรียบร้อยแล้วค่ะ",
  "ดำเนินการเสร็จแล้วค่ะ",
  "เรียบร้อยแล้วค่ะ",
  "จัดการเสร็จแล้วค่ะ",
  "แก้ไขเรียบร้อยค่ะ",
  "เรียบร้อยแล้วนะคะ",
  "เสร็จแล้วค่ะ",
  "เคสเสร็จเรียบร้อยค่ะ"
].map(k => k.replace(/\s/g, ""));

// ดึงสถานะผู้ใช้ (สร้างถ้ายังไม่มี)
function getUserState(userId) {
  if (!userStates[userId]) {
    userStates[userId] = {
      lastFlexSent: 0,
      lastGreeted: 0,
      currentCase: null,
      caseData: {},
      lastActive: Date.now(),
      chatHistory: [],
      totalDeposit: 0,
      assistantName: null,
      assistantNameSetAt: 0,
      caseFollowUpCount: 0,
    };
  }
  return userStates[userId];
}

// อัพเดตสถานะผู้ใช้
function updateUserState(userId, newState) {
  userStates[userId] = { ...getUserState(userId), ...newState };
}

// เช็คว่าควรส่ง Flex Menu หรือไม่ (เว้น cooldown)
function shouldSendFlex(userId) {
  const state = getUserState(userId);
  return Date.now() - state.lastFlexSent > flexCooldown;
}

// เช็คว่าควรทักทายหรือไม่ (เว้น cooldown)
function shouldGreet(userId) {
  const state = getUserState(userId);
  return Date.now() - state.lastGreeted > greetCooldown;
}

// รีเซ็ตสถานะ pause ของผู้ใช้ พร้อมเคลียร์ข้อมูลเคส
function resetUserPauseState(userId) {
  userPausedStates[userId] = false;
  updateUserState(userId, {
    currentCase: null,
    caseData: {},
    caseFollowUpCount: 0,
    lastGreeted: 0,
  });
}

// เลือกชื่อน้องแอดมิน (ล็อก 10 นาที)
function pickAssistantName(userId, state) {
  const now = Date.now();
  if (state.assistantName && state.assistantNameSetAt && (now - state.assistantNameSetAt < nameLockMinutes * 60 * 1000)) {
    return state.assistantName;
  }
  const newName = staffNames[Math.floor(Math.random() * staffNames.length)];
  updateUserState(userId, { assistantName: newName, assistantNameSetAt: now });
  return newName;
}

// สุ่มเบอร์โทรแบบมาสก์
function randomMaskedPhone() {
  const prefix = "08";
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}xxxx${suffix}`;
}

// แจ้งเตือนแอดมินผ่าน Telegram พร้อมส่งรูปถ้ามี
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
  } catch (err) {
    console.error("notifyAdmin error:", err);
  }
}

// ตรวจสอบคำหยาบหรือคำรุนแรง
function detectNegative(text) {
  const negatives = [
    "โกง", "ขโมย", "ไม่จ่าย", "ถอนเงินไม่ได้", "แย่", "เสียใจ", "โมโห", "หัวร้อน", "โดนโกง", "ไม่ยอมโอน",
    "โดนหลอก", "บริการแย่", "จะฟ้อง", "ไม่คืนเงิน", "เว็บเถื่อน", "ไม่โปร่งใส", "หลอกลวง", "ไม่พอใจ",
    "เหี้ย", "สัส", "สัตว์", "ควาย", "โง่", "เฮงซวย", "ห่วย", "ไอ้เหี้ย", "ไอ้สัส", "ไอ้สัตว์", "ไอ้ควาย",
    "ไอ้โง่", "หน้าหี", "อีดอก", "อีเหี้ย", "อีควาย", "อีสัตว์", "อีหน้าหี", "อีสัส", "ชั่ว", "สถุน", "ถ่อย",
    "อัปรีย์", "ต่ำตม", "อีเวร", "เวร", "กรรม", "อีบ้า", "ไอ้บ้า", "กาก", "กะหรี่", "ร่าน", "แม่ง", "เชี่ย", "มึง", "กู", "ฟาย", "แดก", "หัวควย", "ขี้โกง", "โกงแดก", "มึงโกง",
    "เชี้ย", "สันขวาน", "หน้าส้นตีน", "ไร้มารยาท", "ไม่เคารพ", "หน้าด้าน", "น่ารังเกียจ", "ส้นตีน"
  ];
  return negatives.some(word => text.includes(word));
}

// แจ้งเตือนคำหยาบแรงใน Telegram
function logNegativeToTelegram(userId, text) {
  sendTelegramAlert(`⚠️ [คำหยาบ/คำแรง] จากยูสเซอร์ ${userId}\nข้อความ: ${text}`);
}

// ดึงข้อมูลจริงจาก Google Search (ใช้งานได้แบบง่ายๆ)
async function fetchRealData(query) {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://www.google.com/search?q=${encodedQuery}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
      }
    });
    const html = await res.text();
    const match = html.match(/<span class="BNeawe[^>]*>(.*?)<\/span>/);
    return match ? match[1] : "ไม่พบข้อมูลที่เกี่ยวข้อง";
  } catch (err) {
    console.error("fetchRealData Error:", err);
    return "ไม่สามารถค้นหาข้อมูลได้";
  }
}

// ตัวอย่างฟังก์ชันสร้างข้อความรีวิวถอน
async function generateWithdrawReviewMessage() {
  const reviews = [];
  for (let i = 0; i < 10; i++) {
    const phone = randomMaskedPhone();
    const amt = (Math.floor(Math.random() * 45000) + 5000).toLocaleString();
    reviews.push(`ยูส ${phone} ถอน ${amt}`);
  }
  return `📊 รีวิวการถอนล่าสุด\n\n${reviews.join("\n")}\n\nเว็บมั่นคง ปลอดภัย จ่ายจริง 💕`;
}

// ตัวอย่างฟังก์ชันสร้างข้อความยอดถอนสูงสุด
async function generateMaxWithdrawMessage() {
  const today = new Date().toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" });
  if (!global.cachedDate || global.cachedDate !== today) {
    global.cachedDate = today;
    const names = [
      "กิตติ", "สมชาย", "ณัฐพล", "ธีรภัทร", "จักรพงศ์", "ปิยะ", "อาทิตย์", "ชยพล", "ภาณุ", "สุรศักดิ์",
      "วิชัย", "ณรงค์", "กมล", "อนันต์", "ประเสริฐ", "พรชัย", "สกล", "พงษ์ศักดิ์", "ชัยวัฒน์", "สมบัติ",
      "สุพรรณ", "ปรีชา", "สมพงษ์", "วิทยา", "วรพล", "สุภาวดี", "กมลวรรณ", "พัชราภา", "ปวีณา", "สุภาวรรณ",
      "นภัสสร", "กัญญารัตน์", "ปาริชาติ", "อรอนงค์", "จันทร์เพ็ญ", "ธิดารัตน์", "สุธาสินี", "พิมพ์ชนก",
      "อารยา", "วราภรณ์", "สุวรรณา", "ศิริพร", "อัญชลี", "รัชนีกร", "ภัทรพร", "พัชรี", "มนัสวี", "สายพิณ",
      "รัตนาภรณ์", "ดวงกมล"
    ];
    global.cachedName = names[Math.floor(Math.random() * names.length)];
    global.cachedAmt = Math.floor(Math.random() * 200000) + 300000;
  }
  return `👑 ยอดถอนสูงสุดวันนี้\n\nยินดีกับคุณ "${global.cachedName}" ยูส ${randomMaskedPhone()} ถอน ${global.cachedAmt.toLocaleString()} บาท\nวันที่ ${today}`;
}

// ตัวอย่างฟังก์ชันสร้างข้อความเกมแตกบ่อย
async function generateTopGameMessage() {
  const games = [
    "Graffiti Rush • กราฟฟิตี้ รัช",
    "Treasures of Aztec • สาวถ้ำ",
    "Fortune Ox • วัวโดด",
    "Fortune Snake • งูทอง",
    "Fortune Rabbit • กระต่ายโชคลาภ",
    "Lucky Neko • แมวกวัก",
    "Fortune Mouse • หนูทอง",
    "Dragon Hatch • รังมังกร",
    "Wild Bounty Showdown • คาวบอย",
    "Ways of the Qilin • กิเลน",
    "Galaxy Miner • นักขุดอวกาศ",
    "Incan Wonders • สิ่งมหัศจรรย์อินคา",
    "Diner Frenzy Spins • มื้ออาหารสุดปัง",
    "Dragon's Treasure Quest • มังกรซ่อนสมบัติ",
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

// ตัวอย่างฟังก์ชันสร้างข้อความค่าคอมแนะนำเพื่อน
async function generateReferralCommissionMessage() {
  const lines = [];
  for (let i = 0; i < 10; i++) {
    const phone = randomMaskedPhone();
    const amt = (Math.floor(Math.random() * 97000) + 3000).toLocaleString();
    lines.push(`ยูส ${phone} ได้ค่าคอมมิชชั่น ${amt}`);
  }
  return `🤝 ค่าคอมมิชชั่นแนะนำเพื่อน\n\n${lines.join("\n")}\n\n💡 ชวนเพื่อนมาเล่น รับค่าคอมทุกวัน!`;
}

// สร้าง Flex Menu
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

// ฟังก์ชันหลักจัดการการโต้ตอบลูกค้า
async function handleCustomerFlow(event, lineClient) {
  if (event.source?.type !== 'user') return [];
  if (!event.message && event.type !== 'postback' && event.type !== 'follow') return [];

  const userId = event.source?.userId;
  const state = getUserState(userId);
  updateUserState(userId, { lastActive: Date.now() });

  const text = event.message?.text?.trim() || "";
  const normalizedText = text.toLowerCase().replace(/\s/g, "");
  const reply = [];

  // Debug log สถานะ pause และ currentCase
  console.log(`[PAUSE DEBUG] userId=${userId} isPaused=${!!userPausedStates[userId]} currentCase=${state.currentCase}`);
  console.log(`[PAUSE DEBUG] text='${text}' normalized='${normalizedText}'`);

  // คำสั่ง reset pause (สำหรับทดสอบ)
  if (/resetpause/.test(normalizedText)) {
    resetUserPauseState(userId);
    reply.push({ type: "text", text: "ระบบได้รีเซ็ตสถานะ pause ให้เรียบร้อยแล้วค่ะ" });
    return reply;
  }

  // ตรวจจับคำสั่ง pause (แอดมินรับเคส) ตาม pauseKeywords
  if (pauseKeywords.some(keyword => normalizedText.includes(keyword.replace(/\s/g, "")))) {
    userPausedStates[userId] = true;
    updateUserState(userId, { currentCase: "admin_case" });
    reply.push({ type: "text", text: "แอดมินกำลังดูแลพี่อยู่นะคะ น้องส่งต่อให้เรียบร้อยแล้วค่ะ 💕" });
    return reply;
  }

  // ปลด pause ถ้าคำในข้อความตรงกับ unpauseKeywords
  if (userPausedStates[userId] && unpauseKeywords.some(keyword => normalizedText.includes(keyword))) {
    resetUserPauseState(userId);
    reply.push({ type: "text", text: "ยินดีให้บริการตลอด 24 ชั่วโมงเลยนะคะ ถ้ามีคำถามหรือปัญหาเพิ่มเติม แจ้งน้องได้เลยค่ะ 💖" });
    reply.push({ type: "flex", altText: "🎀 เมนูพิเศษ", contents: createFlexMenuContents() });
    return reply;
  }

  // ถ้า pause mode และเป็นเคส admin_case ให้รับข้อมูลรูปหรือข้อความได้
  if (userPausedStates[userId] && state.currentCase === "admin_case" && (text.length > 3 || event.message?.type === "image")) {
    reply.push({ type: "text", text: "ได้รับข้อมูลแล้วค่ะ น้องจะประสานงานกับหัวหน้าฝ่ายให้เร็วที่สุดนะคะ 💕" });
    await notifyAdmin(event, `ข้อมูลจากลูกค้า (เคส ${state.currentCase}): ${text || "ส่งรูป"}`);
    return reply;
  }

  // ถ้า pause อยู่ห้ามตอบข้อความอื่นๆ
  if (userPausedStates[userId]) {
    console.log(`[PAUSE DEBUG] Pause mode active, ไม่ตอบข้อความอื่น userId=${userId}`);
    return [];
  }

  // LOCKED ASSISTANT NAME
  const assistantName = pickAssistantName(userId, state);

  // fetch ข้อมูลจริง (หวย/ข่าว/บอล/ทั่วไป)
  let realData = "";
  if (text.includes("หวย") || text.includes("เลขเด็ด")) realData = await fetchRealData("เลขเด็ด หวยไทยรัฐ งวดนี้");
  else if (text.includes("ผลบอล") || text.includes("ฟุตบอล")) realData = await fetchRealData("ผลบอลวันนี้");
  else if (text.includes("ข่าว") || text.includes("วันนี้")) realData = await fetchRealData("ข่าวล่าสุดวันนี้");
  else if (text.length > 2) realData = await fetchRealData(text);

  // ตอบลูกค้าสั้น (คะ ครับ เค ok)
  const shortReplies = ["ครับ", "คับ", "ค่ะ", "คะ", "ค่า", "เค", "ok", "โอเค", "ครับผม", "ค่ะจ้า"];
  if (shortReplies.includes(text.toLowerCase())) {
    state.caseFollowUpCount = (state.caseFollowUpCount || 0) + 1;
    updateUserState(userId, state);
    let followUpMsg = "";
    if (state.caseFollowUpCount === 1) {
      followUpMsg = `ยินดีดูแลพี่เสมอนะคะ 💕 หากมีปัญหาหรือข้อสงสัยแจ้งได้เลยน้า เว็บ PGTHAI289 มั่นคง ปลอดภัย ถอนได้หลักล้านไวมากค่ะ ✨`;
      return [{ type: "text", text: followUpMsg }];
    }
    if (state.caseFollowUpCount === 2) {
      setTimeout(() => {
        lineClient.pushMessage(userId, {
          type: "text",
          text: `อยู่ดูแลพี่อยู่นะคะ 💕 ถ้ามีอะไรเพิ่มเติมถามได้เลยน้า เว็บ PGTHAI289 ฝาก-ถอนไว เล่นง่าย และถอนได้หลักล้านแบบชัวร์ๆ เลยค่ะ ✨`
        });
      }, 3000);
      return [];
    }
    if (state.caseFollowUpCount >= 3) {
      setTimeout(() => {
        lineClient.pushMessage(userId, {
          type: "text",
          text: `ถ้าพี่มีคำถามเพิ่มเติม พร้อมช่วยดูแลเสมอนะคะ 🥰 และอย่าลืมชวนเพื่อนมาเล่น PGTHAI289 รับค่าคอมทุกวันด้วยน้า 💕`
        });
      }, 3000);
      state.caseFollowUpCount = 0;
      updateUserState(userId, state);
      return [];
    }
  }

  // ทักทายตอนลูกค้าเพิ่มเพื่อนใหม่ หรือสวัสดีครั้งแรก
  if (
    (event.type === "follow" && shouldGreet(userId)) ||
    (["สวัสดี", "hello", "hi"].includes(text.toLowerCase()))
  ) {
    reply.push({ type: "flex", altText: "🎀 เมนูพิเศษ", contents: createFlexMenuContents() }); // ส่ง flex ก่อนข้อความ
    reply.push({ type: "text", text: `สวัสดีค่ะ ${assistantName} เป็นแอดมินดูแลลูกค้าของเว็บ PGTHAI289 นะคะ 💕` });
    updateUserState(userId, { lastFlexSent: Date.now(), lastGreeted: Date.now() });
    await notifyAdmin(event, "ลูกค้าเพิ่มเพื่อนใหม่หรือทักทาย");
    return reply;
  }

  // กดปุ่ม Postback
  if (event.type === "postback" && event.postback?.data) {
    const data = event.postback.data;
    reply.push({ type: "text", text: `✅ คุณกดปุ่ม: ${data}` });
    let msg = "";
    // ตั้ง pause และ currentCase ให้ถูกต้องทุกกรณีเพื่อรับข้อมูลลูกค้า
    if (data === "register_admin") {
      msg = "ขอข้อมูล ชื่อ-นามสกุล เบอร์โทร บัญชี/วอเลท และไอดีไลน์ด้วยนะคะ 💕";
      userPausedStates[userId] = true;
      updateUserState(userId, { currentCase: "admin_case" });
    } else if (data === "login_backup") {
      msg = "แจ้งชื่อและเบอร์โทรที่สมัครไว้เพื่อตรวจสอบการเข้าเล่นค่ะ 💕";
      userPausedStates[userId] = true;
      updateUserState(userId, { currentCase: "login_backup" });
    } else if (data === "issue_deposit") {
      msg = "แจ้งชื่อ+เบอร์โทร และส่งสลิปฝากเงินให้ตรวจสอบนะคะ 💕";
      userPausedStates[userId] = true;
      updateUserState(userId, { currentCase: "issue_deposit" });
    } else if (data === "forgot_password") {
      msg = "แจ้งชื่อ+เบอร์โทรที่สมัครไว้ เดี๋ยวน้องช่วยรีเซ็ตให้ค่ะ 💕";
      userPausedStates[userId] = true;
      updateUserState(userId, { currentCase: "forgot_password" });
    } else if (data === "promo_info") {
      msg = "พี่สนใจเล่นอะไรเป็นพิเศษคะ บอล สล็อต หวย คาสิโน หรืออื่นๆ 💕";
      userPausedStates[userId] = true;
      updateUserState(userId, { currentCase: "promo_info" });
    } else if (data === "review_withdraw") {
      msg = await generateWithdrawReviewMessage();
    } else if (data === "max_withdraw") {
      msg = await generateMaxWithdrawMessage();
    } else if (data === "top_game") {
      msg = await generateTopGameMessage();
    } else if (data === "referral_commission") {
      msg = await generateReferralCommissionMessage();
    }
    reply.push({ type: "text", text: msg });
    await notifyAdmin(event, `ลูกค้ากดปุ่ม ${data}`);
    return reply;
  }

  // ถ้าอยู่ใน pause mode และ currentCase มีค่า ให้รับข้อมูลข้อความหรือรูป
  if (userPausedStates[userId] && state.currentCase && (text.length > 3 || event.message?.type === "image")) {
    reply.push({ type: "text", text: "ได้รับข้อมูลแล้วค่ะ น้องจะประสานงานกับหัวหน้าฝ่ายให้เร็วที่สุดนะคะ 💕" });
    await notifyAdmin(event, `ข้อมูลจากลูกค้า (เคส ${state.currentCase}): ${text || "ส่งรูป"}`);
    return reply;
  }

  // ถ้า pause mode อยู่ ห้ามตอบข้อความอื่นๆ
  if (userPausedStates[userId]) {
    console.log(`[PAUSE DEBUG] Pause mode active, ไม่ตอบข้อความอื่น userId=${userId}`);
    return [];
  }

  // เลือกชื่อน้องแอดมิน
  const assistantName = pickAssistantName(userId, state);

  // ดึงข้อมูลจริงตามคำถามลูกค้า
  let realData = "";
  if (text.includes("หวย") || text.includes("เลขเด็ด")) realData = await fetchRealData("เลขเด็ด หวยไทยรัฐ งวดนี้");
  else if (text.includes("ผลบอล") || text.includes("ฟุตบอล")) realData = await fetchRealData("ผลบอลวันนี้");
  else if (text.includes("ข่าว") || text.includes("วันนี้")) realData = await fetchRealData("ข่าวล่าสุดวันนี้");
  else if (text.length > 2) realData = await fetchRealData(text);

  // ตอบคำสั้นๆ เช่น ครับค่ะ
  const shortReplies = ["ครับ", "คับ", "ค่ะ", "คะ", "ค่า", "เค", "ok", "โอเค", "ครับผม", "ค่ะจ้า"];
  if (shortReplies.includes(text.toLowerCase())) {
    state.caseFollowUpCount = (state.caseFollowUpCount || 0) + 1;
    updateUserState(userId, state);
    if (state.caseFollowUpCount === 1) {
      return [{ type: "text", text: `ยินดีดูแลพี่เสมอนะคะ 💕 หากมีปัญหาหรือข้อสงสัยแจ้งได้เลยน้า เว็บ PGTHAI289 มั่นคง ปลอดภัย ถอนได้หลักล้านไวมากค่ะ ✨` }];
    }
    if (state.caseFollowUpCount === 2) {
      setTimeout(() => {
        lineClient.pushMessage(userId, {
          type: "text",
          text: `อยู่ดูแลพี่อยู่นะคะ 💕 ถ้ามีอะไรเพิ่มเติมถามได้เลยน้า เว็บ PGTHAI289 ฝาก-ถอนไว เล่นง่าย และถอนได้หลักล้านแบบชัวร์ๆ เลยค่ะ ✨`
        });
      }, 3000);
      return [];
    }
    if (state.caseFollowUpCount >= 3) {
      setTimeout(() => {
        lineClient.pushMessage(userId, {
          type: "text",
          text: `ถ้าพี่มีคำถามเพิ่มเติม พร้อมช่วยดูแลเสมอนะคะ 🥰 และอย่าลืมชวนเพื่อนมาเล่น PGTHAI289 รับค่าคอมทุกวันด้วยน้า 💕`
        });
      }, 3000);
      state.caseFollowUpCount = 0;
      updateUserState(userId, state);
      return [];
    }
  }

  // ทักทายลูกค้าเพิ่มเพื่อนใหม่ หรือพิมพ์สวัสดี
  if (
    (event.type === "follow" && shouldGreet(userId)) ||
    (["สวัสดี", "hello", "hi"].includes(text.toLowerCase()))
  ) {
    reply.push({ type: "flex", altText: "🎀 เมนูพิเศษ", contents: createFlexMenuContents() });
    reply.push({ type: "text", text: `สวัสดีค่ะ ${assistantName} เป็นแอดมินดูแลลูกค้าของเว็บ PGTHAI289 นะคะ 💕` });
    updateUserState(userId, { lastFlexSent: Date.now(), lastGreeted: Date.now() });
    await notifyAdmin(event, "ลูกค้าเพิ่มเพื่อนใหม่หรือทักทาย");
    return reply;
  }

  // ส่ง Flex Menu ตามเวลา cooldown
  if (event.type === "message" && shouldSendFlex(userId)) {
    reply.push({ type: "flex", altText: "🎀 เมนูพิเศษ", contents: createFlexMenuContents() });
    updateUserState(userId, { lastFlexSent: Date.now() });
  }

  // สร้าง prompt สำหรับ GPT
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
  reply.push({ type: "text", text: gptReply });

  // บันทึกประวัติแชท
  state.chatHistory.push({ role: "assistant", content: gptReply });
  updateUserState(userId, state);

  await notifyAdmin(event, text || "ลูกค้าส่งข้อความ/รูป");
  return reply;
}

/* =========== CRM FOLLOW-UP ============ */
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

export { initCRM, handleCustomerFlow };
