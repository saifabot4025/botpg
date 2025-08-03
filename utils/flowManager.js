// ==================== IMPORT ====================
import fetch from "node-fetch";
import { getCuteDynamicReply } from "../services/gptService.js";
import { sendTelegramAlert, sendTelegramPhoto, getLineProfile } from "../services/telegramService.js";
import { getLineImage } from "../services/lineMediaService.js";
import fs from "fs";

// ==================== STATE ====================
const userStates = {};
const userPausedStates = {};
const userPauseTimestamp = {};
const flexCooldown = 2 * 60 * 60 * 1000;
const greetCooldown = 10 * 60 * 1000;
const pauseAutoResume = 5 * 60 * 1000; // 5 นาที
let globalPause = false; // Pause ทั้งระบบ (admin mode)

const assistantNames = ["น้องฟาง", "น้องปุย", "น้องแพรว", "น้องมายด์", "น้องบัว", "น้องน้ำหวาน", "น้องแพม", "น้องจ๋า"];
function getRandomAssistantName() {
  return assistantNames[Math.floor(Math.random() * assistantNames.length)];
}
function analyzeSentiment(text) {
  const flirtWords = ["คิดถึง", "น่ารัก", "ชอบนะ", "จีบ", "เป็นแฟน", "รัก"];
  const adultWords = ["จูบ", "กอด", "ห้อง", "18+", "เซ็ก", "เสียว", "xxx"];
  const angryWords = ["โกง", "เหี้ย", "สัส", "ควย", "ห่วย", "กาก", "โมโห", "ไม่จ่าย"];
  if (angryWords.some(w => text.includes(w))) return "angry";
  if (flirtWords.some(w => text.includes(w))) return "flirt";
  if (adultWords.some(w => text.includes(w))) return "adult";
  if (text.endsWith("?")) return "info";
  return "neutral";
}
function limitSentences(text, maxSentences = 2) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences.slice(0, maxSentences).join(" ");
}
function sanitizeReply(reply, assistantName) {
  return reply.replace(/น้อง[^\s]+/g, assistantName);
}
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
      assistantName: getRandomAssistantName(),
      caseFollowUpCount: 0
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
function randomMaskedPhone() {
  const prefix = "08";
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}xxxx${suffix}`;
}

// =========== FETCH ข้อมูลจริง (DuckDuckGo, ฟุตบอล) ===========
async function fetchRealData(query) {
  const footballData = await fetchFootballData(query);
  if (footballData) return footballData;
  try {
    const url = "https://api.duckduckgo.com/?q=" + encodeURIComponent(query) + "&format=json";
    const res = await fetch(url);
    const json = await res.json();
    if (json.AbstractText) return json.AbstractText;
    if (json.RelatedTopics?.length) return json.RelatedTopics[0]?.Text || "ไม่พบข้อมูล";
    return "ไม่พบข้อมูลที่เกี่ยวข้อง";
  } catch (err) {
    return "ไม่สามารถค้นหาข้อมูลได้";
  }
}
async function fetchFootballData(query) {
  try {
    if (/ผลบอล|ผลบอลสด|score|live/i.test(query)) {
      const res = await fetch("https://www.ballchud.com/api/schedule/today");
      const json = await res.json();
      const matches = (json?.data || []).slice(0, 5).map(
        m => `${m.league} คู่ ${m.team_home} vs ${m.team_away} เวลา ${m.time} ผลล่าสุด ${m.score_home}-${m.score_away}`
      ).join("\n");
      return matches || "ขออภัย ยังไม่มีข้อมูลผลบอลล่าสุดตอนนี้ค่ะ";
    }
    if (/ตารางบอล|โปรแกรมบอล|fixtures/i.test(query)) {
      const res = await fetch("https://www.ballchud.com/api/schedule/today");
      const json = await res.json();
      const matches = (json?.data || []).slice(0, 5).map(
        m => `${m.league} : ${m.team_home} vs ${m.team_away} เวลา ${m.time}`
      ).join("\n");
      return matches || "ขออภัย ยังไม่มีโปรแกรมบอลใหม่ในระบบตอนนี้ค่ะ";
    }
    return "";
  } catch (err) {
    return "";
  }
}

// =========== Prompt Master ===========
function buildPrompt(assistantName, historyContext, realData, sentiment, text) {
  let roleDesc = `บทบาท: เป็นแอดมินผู้หญิงชื่อ ${assistantName} ของ PGTHAI289\n`;
  roleDesc += `ประวัติการคุยก่อนหน้า:\n${historyContext}\n`;
  roleDesc += `ข้อมูลจริง (ถ้ามี): ${realData}\n`;

  if (sentiment === "angry") {
    return `${roleDesc}
หน้าที่: ตอบลูกค้าที่โกรธหรือด่าอย่างสุภาพและปลอบใจ ใช้จิตวิทยาให้ลูกค้าสบายใจ ยืนยันว่าเว็บมั่นคงและดูแลลูกค้าจริง
1. ฟังลูกค้า เข้าใจอารมณ์ และปลอบใจ
2. อธิบายว่าเว็บ PGTHAI289 จ่ายจริง มั่นคง ปลอดภัย
3. เสนอช่วยเหลือ และปิดท้ายด้วยคำชวนเล่นแบบอบอุ่น
ข้อความลูกค้า: "${text}"`;
  }
  if (sentiment === "flirt") {
    return `${roleDesc}
หน้าที่: ตอบลูกค้าที่จีบหรือล้อเล่นแบบน่ารัก ขี้เล่น แต่ไม่เกินนโยบาย
1. ตอบแบบอ้อนๆ เป็นกันเอง
2. ใส่ความรู้สึกสนุกสนาน แต่ไม่หยาบคาย
3. ปิดท้ายชวนเล่นเว็บแบบเนียน
ข้อความลูกค้า: "${text}"`;
  }
  if (sentiment === "adult") {
    return `${roleDesc}
หน้าที่: ตอบลูกค้าที่คุยเรื่อง 18+ แบบแซวๆ ขี้เล่น แต่ไม่ส่ออนาจาร
1. ตอบให้ดูขำๆ น่ารัก แต่ไม่พูดหยาบหรือส่อไปทางเพศ
2. ทำให้บรรยากาศเป็นกันเอง
3. ปิดท้ายชวนเล่นเว็บแบบเนียน
ข้อความลูกค้า: "${text}"`;
  }
  if (sentiment === "info") {
    return `${roleDesc}
หน้าที่: ตอบคำถามข้อมูลของลูกค้าอย่างฉลาดและมืออาชีพ
1. ให้ข้อมูลจริงก่อน ถ้ามี
2. ปิดท้ายชวนเล่นเว็บ PGTHAI289 แบบเนียน
ข้อความลูกค้า: "${text}"`;
  }
  return `${roleDesc}
หน้าที่: ตอบลูกค้าแบบเป็นกันเอง น่ารัก ฉลาด
1. คุยกับลูกค้าอย่างอบอุ่น
2. ปิดท้ายด้วย Soft Sell ชวนเล่นเว็บ
ข้อความลูกค้า: "${text}"`;
}

// =========== MESSAGE GENERATORS ===========
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
    const names = [...assistantNames, "กิตติ", "สมชาย", "ณัฐพล", "ธีรภัทร"];
    global.cachedName = names[Math.floor(Math.random() * names.length)];
    global.cachedAmt = Math.floor(Math.random() * 200000) + 300000;
  }
  return `👑 ยอดถอนสูงสุดวันนี้\n\nยินดีกับคุณ "${global.cachedName}" ยูส ${randomMaskedPhone()} ถอน ${global.cachedAmt.toLocaleString()} บาท\nวันที่ ${today}`;
}
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
async function generateReferralCommissionMessage() {
  const lines = [];
  for (let i = 0; i < 10; i++) {
    const phone = randomMaskedPhone();
    const amt = (Math.floor(Math.random() * 97000) + 3000).toLocaleString();
    lines.push(`ยูส ${phone} ได้ค่าคอมมิชชั่น ${amt}`);
  }
  return `🤝 ค่าคอมมิชชั่นแนะนำเพื่อน\n\n${lines.join("\n")}\n\n💡 ชวนเพื่อนมาเล่น รับค่าคอมทุกวัน!`;
}

// =========== FLEX MENU ==============
function createFlexMenuContents() {
  return {
    type: "carousel",
    contents: [
      // BOX 1
      {
        type: "bubble",
        hero: { type: "image", url: "https://i.ibb.co/SqbNcr1/image.jpg", size: "full", aspectRatio: "20:13", aspectMode: "cover" },
        body: {
          type: "box", layout: "vertical", backgroundColor: "#4B0082", contents: [
            { type: "text", text: "สมัครสมาชิก + Login", weight: "bold", size: "lg", color: "#FFFFFF" },
            { type: "text", text: "เว็บเราสมัครฟรีไม่มีค่าใช้จ่าย หากติดขัดปัญหาด้านใดยินดีบริการ 24 ชั่วโมง", size: "sm", color: "#FFFFFF", wrap: true, margin: "md" },
          ]
        },
        footer: {
          type: "box", layout: "vertical", backgroundColor: "#4B0082", spacing: "sm", contents: [
            { type: "button", style: "primary", color: "#000000", action: { type: "uri", label: "⭐ สมัครเอง", uri: "https://pgthai289.net/customer/register/LINEBOT/?openExternalBrowser=1" } },
            { type: "button", style: "secondary", color: "#FFD700", action: { type: "postback", label: "📲 ให้แอดมินสมัครให้", data: "register_admin" } },
            { type: "button", style: "primary", color: "#000000", action: { type: "uri", label: "🔑 ทางเข้าเล่นหลัก", uri: "https://pgthai289.net/?openExternalBrowser=1" } },
            { type: "button", style: "secondary", color: "#FFD700", action: { type: "postback", label: "🚪 ทางเข้าเล่นสำรอง", data: "login_backup" } }
          ]
        }
      },
      // BOX 2
      {
        type: "bubble",
        hero: { type: "image", url: "https://i.ibb.co/SqbNcr1/image.jpg", size: "full", aspectRatio: "20:13", aspectMode: "cover" },
        body: {
          type: "box", layout: "vertical", backgroundColor: "#4B0082", contents: [
            { type: "text", text: "แจ้งปัญหาการใช้งาน", weight: "bold", size: "lg", color: "#FFFFFF" },
            { type: "text", text: "แจ้งปัญหาการใช้งาน แอดมินพร้อมดูแลตลอด 24 ชั่วโมงเลยนะคะ", size: "sm", color: "#FFFFFF", wrap: true, margin: "md" },
          ]
        },
        footer: {
          type: "box", layout: "vertical", backgroundColor: "#4B0082", spacing: "sm", contents: [
            { type: "button", style: "primary", color: "#000000", action: { type: "postback", label: "💰 ปัญหาฝาก/ถอน", data: "issue_deposit" } },
            { type: "button", style: "secondary", color: "#FFD700", action: { type: "postback", label: "🔑 ลืมรหัสผ่าน", data: "forgot_password" } },
            { type: "button", style: "primary", color: "#000000", action: { type: "postback", label: "🚪 เข้าเล่นไม่ได้", data: "login_backup" } },
            { type: "button", style: "secondary", color: "#FFD700", action: { type: "postback", label: "🎁 โปรโมชั่น/กิจกรรม", data: "promo_info" } }
          ]
        }
      },
      // BOX 3
      {
        type: "bubble",
        hero: { type: "image", url: "https://i.ibb.co/SqbNcr1/image.jpg", size: "full", aspectRatio: "20:13", aspectMode: "cover" },
        body: {
          type: "box", layout: "vertical", backgroundColor: "#4B0082", contents: [
            { type: "text", text: "รีวิวการถอน + โบนัสไทม์", weight: "bold", size: "lg", color: "#FFFFFF" },
            { type: "text", text: "รีวิวการถอน+โบนัสไทม์ เว็บเราจ่ายชัวร์หลักร้อยหรือล้านก็ไวไร้ประวัติโกง", size: "sm", color: "#FFFFFF", wrap: true, margin: "md" }
          ]
        },
        footer: {
          type: "box", layout: "vertical", backgroundColor: "#4B0082", spacing: "sm", contents: [
            { type: "button", style: "primary", color: "#000000", action: { type: "postback", label: "⭐ รีวิวถอนล่าสุด", data: "review_withdraw" } },
            { type: "button", style: "secondary", color: "#FFD700", action: { type: "postback", label: "👑 ถอนสูงสุดวันนี้", data: "max_withdraw" } },
            { type: "button", style: "primary", color: "#000000", action: { type: "postback", label: "🎮 เกมแตกบ่อย", data: "top_game" } },
            { type: "button", style: "secondary", color: "#FFD700", action: { type: "postback", label: "💎 ค่าคอมแนะนำเพื่อน", data: "referral_commission" } }
          ]
        }
      }
    ]
  };
}

// =============== PAUSE AUTO RESUME (5 นาที) =================
async function tryResumeFromPause(userId, lineClient) {
  if (userPausedStates[userId] && userPauseTimestamp[userId]) {
    const now = Date.now();
    if (now - userPauseTimestamp[userId] > pauseAutoResume) {
      userPausedStates[userId] = false;
      userPauseTimestamp[userId] = null;
      updateUserState(userId, { currentCase: null, caseData: {}, caseFollowUpCount: 0 });
      await lineClient.pushMessage(userId, {
        type: "text",
        text: "คุณพี่ต้องการสอบถามอะไรหรือติดขัดปัญหาอะไรแจ้งน้องได้เลยนะคะ หรืออยากให้แนะนำอะไรคุยเป็นเพื่อนระบายความทุกข์ก็บอกน้องได้ 24 ชั่วโมงเลยน้า 💕"
      });
    }
  }
}

// =============== MAIN FLOW MANAGER =================
export async function handleCustomerFlow(event, lineClient) {
  if (globalPause) return []; // **ถ้า pause ทั้งระบบ ไม่ตอบ**
  const userId = event.source?.userId;
  const state = getUserState(userId);
  updateUserState(userId, { lastActive: Date.now() });
  const reply = [];
  const text = event.message?.text?.trim() || "";

  await tryResumeFromPause(userId, lineClient);

  if (userPausedStates[userId]) return [];

  // == Negative Words ตอบจิตวิทยา/อ้อน ==
  const negativeWords = [
    "โกง", "เว็บโกง", "เว็บห่วย", "ขี้โกง", "ไม่จ่าย", "เชิดเงิน", "เว็บไม่ดี", "โดนโกง",
    "แม่ง", "สัส", "เหี้ย", "ชิบหาย", "กาก", "เลว", "ไอ้", "โง่", "ควย", "ฟาย",
    "หมดตัว", "เสียหมด", "ทุนหาย", "หมดกำลังใจ", "เจ๊ง", "ไม่เหลือ", "โดนกินหมด",
    "เว็บเชี้ย", "เว็บควย", "เล่นไม่แตก", "ไม่แตก", "ไม่แจก", "ห่วยแตก", "เว็บแย่",
    "ทำไมไม่จ่าย", "เว็บขยะ", "เสียหมดตูด", "เล่นหมด", "เงินหมด", "เล่นแล้วเจ๊ง"
  ];
  if (negativeWords.some(word => text.includes(word))) {
    const apologyReply = await getCuteDynamicReply(
      `บทบาท: เป็นแอดมินสาวมืออาชีพของ PGTHAI289
สิ่งที่ต้องทำ:
1. ฟังความรู้สึกลูกค้าและเข้าใจความผิดหวังหรืออารมณ์เสีย
2. ถ้าลูกค้าหาว่าเว็บโกง ให้ยืนยันว่า PGTHAI289 มั่นคง ปลอดภัย มีประวัติการจ่ายจริง ฝาก-ถอนได้แน่นอน
3. ถ้าลูกค้าเสียเยอะ ให้ปลอบใจด้วยน้ำเสียงอบอุ่นและแนะนำให้เล่นอย่างมีสติ 
4. เชิญชวนให้ลูกค้าสอบถามหรือขอความช่วยเหลือได้ 24 ชั่วโมง
5. ตอบสั้น กระชับ และเป็นกันเองไม่เกิน 2 ประโยค
ข้อความจากลูกค้า: "${text}"`
    );
    return [{ type: "text", text: apologyReply }];
  }

  // == Admin พิมพ์ "หัวหน้าแอดมินรับเคสค่ะ" > Pause
  if (text.replace(/\s/g, "").includes("หัวหน้าแอดมินรับเคสค่ะ")) {
    userPausedStates[userId] = true;
    userPauseTimestamp[userId] = Date.now();
    updateUserState(userId, { currentCase: "admin_case" });
    return [{
      type: "text",
      text: "หัวหน้าแอดมินกำลังดูแลพี่อยู่น้า น้องส่งต่อให้เรียบร้อยค่ะ 💕"
    }];
  }

  // == Follow/เพิ่มเพื่อนใหม่
  if (event.type === "follow" && shouldGreet(userId)) {
    reply.push({ type: "text", text: "สวัสดีค่ะ น้องฟางเป็นแอดมินดูแลลูกค้าของ PGTHAI289 นะคะ 💕" });
    reply.push({ type: "flex", altText: "🎀 เมนูพิเศษ", contents: createFlexMenuContents() });
    updateUserState(userId, { lastFlexSent: Date.now(), lastGreeted: Date.now() });
    await notifyAdmin(event, "ลูกค้าเพิ่มเพื่อนใหม่");
    return reply;
  }

  // == Postback == 
  if (event.type === "postback" && event.postback?.data) {
    const data = event.postback.data;
    reply.push({ type: "text", text: `✅ คุณกดปุ่ม: ${data}` });
    let msg = "";
    if (data === "register_admin") { msg = "ขอข้อมูล ชื่อ-นามสกุล เบอร์โทร บัญชี/วอเลท และไอดีไลน์ด้วยนะคะ 💕"; userPausedStates[userId] = true; userPauseTimestamp[userId] = Date.now(); }
    if (data === "login_backup") { msg = "แจ้งชื่อและเบอร์โทรที่สมัครไว้เพื่อตรวจสอบการเข้าเล่นค่ะ 💕"; userPausedStates[userId] = true; userPauseTimestamp[userId] = Date.now(); }
    if (data === "issue_deposit") { msg = "แจ้งชื่อ+เบอร์โทร และส่งสลิปฝากเงินให้ตรวจสอบนะคะ 💕"; userPausedStates[userId] = true; userPauseTimestamp[userId] = Date.now(); }
    if (data === "forgot_password") { msg = "แจ้งชื่อ+เบอร์โทรที่สมัครไว้ เดี๋ยวน้องช่วยรีเซ็ตให้ค่ะ 💕"; userPausedStates[userId] = true; userPauseTimestamp[userId] = Date.now(); }
    if (data === "promo_info") { msg = "พี่สนใจเล่นอะไรเป็นพิเศษคะ บอล สล็อต หวย คาสิโน หรืออื่นๆ 💕"; userPausedStates[userId] = true; userPauseTimestamp[userId] = Date.now(); }
    if (data === "review_withdraw") { msg = await generateWithdrawReviewMessage(); }
    if (data === "max_withdraw") { msg = await generateMaxWithdrawMessage(); }
    if (data === "top_game") { msg = await generateTopGameMessage(); }
    if (data === "referral_commission") { msg = await generateReferralCommissionMessage(); }
    reply.push({ type: "text", text: msg });
    await notifyAdmin(event, `ลูกค้ากดปุ่ม ${data}`);
    return reply;
  }

  // == ส่งข้อมูล (admin_case)
  if (state.currentCase && (text.length > 3 || event.message?.type === "image")) {
    reply.push({ type: "text", text: "ได้รับข้อมูลแล้วค่ะ กำลังส่งให้หัวหน้าฝ่ายดำเนินการ 💕" });
    userPausedStates[userId] = true;
    userPauseTimestamp[userId] = Date.now();
    await notifyAdmin(event, `ข้อมูลจากลูกค้า (เคส ${state.currentCase}): ${text || "ส่งรูป"}`);
    return reply;
  }

  // == ส่ง Flex ตามรอบ
  if (event.type === "message" && shouldSendFlex(userId)) {
    reply.push({ type: "flex", altText: "🎀 เมนูพิเศษ", contents: createFlexMenuContents() });
    updateUserState(userId, { lastFlexSent: Date.now() });
  }

  // == GPT ตอบแบบขี้อ้อน/ฉลาด/หา info สด ==
  try {
    const now = Date.now();
    if (!state.assistantName || now - state.lastGreeted > 10 * 60 * 1000) {
      const newName = getRandomAssistantName();
      updateUserState(userId, { assistantName: newName, lastGreeted: now });
      state.assistantName = newName;
    }
    const assistantName = state.assistantName;
    const sentiment = analyzeSentiment(text);
    const historyContext = state.chatHistory.map(h => `${h.role}: ${h.content}`).join('\n');
    let realData = "";
    if (sentiment === "info" || text.length > 5) realData = await fetchRealData(text);
    const gptPrompt = buildPrompt(assistantName, historyContext, realData, sentiment, text);

    let gptReply = await getCuteDynamicReply(gptPrompt);
    gptReply = sanitizeReply(limitSentences(gptReply), assistantName);

    reply.push({
      type: "text",
      text: gptReply
    });

    state.chatHistory.push({ role: "user", content: text });
    state.chatHistory.push({ role: "assistant", content: gptReply });
    updateUserState(userId, state);

    if (gptReply.trim().startsWith("สวัสดี")) {
      updateUserState(userId, { lastGreeted: now });
    }

    await notifyAdmin(event, text || "ลูกค้าส่งข้อความ/รูป");
    return reply;
  } catch (err) {
    reply.push({
      type: "text",
      text: "ขอโทษนะคะ รบกวนส่งข้อความใหม่ให้น้องอีกครั้งได้ไหมคะ 💕"
    });
    return reply;
  }
}

// ================== CRM FOLLOW-UP (3,7,15,30 วัน) ==================
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
          const msg = await getCuteDynamicReply(period.prompt);
          await lineClient.pushMessage(uid, { type: "text", text: msg });
          await lineClient.pushMessage(uid, { type: "flex", altText: "🎀 กลับมาเล่นกับเรา 🎀", contents: createFlexMenuContents() });
          await sendTelegramAlert(`📢 CRM (${period.days} วัน) ส่งข้อความหา: ${uid}`);
          updateUserState(uid, { lastActive: Date.now() });
        } catch (err) {
          console.error("CRM Error", err);
        }
      }
    }
  }, 6 * 60 * 60 * 1000);
}

// ===== DEBUG LOG/HEALTH CHECK =====
export async function debugLogToTelegram(msg) {
  try { await sendTelegramAlert(`[DEBUG LOG] ${msg}`); } catch (err) { }
}

export function getBotHealthStatus() {
  return {
    totalUsers: Object.keys(userStates).length,
    globalPause,
    memoryUsageMB: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
    uptimeMinutes: Math.floor(process.uptime() / 60)
  };
}

// === EXPORT AS MODULE (ESM) ===
export {
  handleCustomerFlow,
  tryResumeFromPause,
  createFlexMenuContents,
  initCRM,
  debugLogToTelegram,
  getBotHealthStatus
};
