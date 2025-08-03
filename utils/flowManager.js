// ==================== IMPORT ====================
import fetch from "node-fetch";
import { getCuteDynamicReply } from "../services/gptService.js";
import { sendTelegramAlert, sendTelegramPhoto } from "../services/telegramService.js";
import { getLineImage } from "../services/lineMediaService.js";
import fs from "fs";

// ==================== STATE ====================
const userStates = {};
const userPausedStates = {};
const userPauseTimestamp = {};
const flexCooldown = 2 * 60 * 60 * 1000;  // 2 ชั่วโมง
const greetCooldown = 10 * 60 * 1000;     // 10 นาที
const pauseAutoResume = 5 * 60 * 1000;    // 5 นาที
let globalPause = false;

// ==================== INTENT & KEYWORD ===============
const explicitWords = [
  "เย็ด", "อม", "เงี่ยน", "หี", "ควย", "ขย่ม", "โดนเย็ด", "xxx", "จิ๋ม", "sex", "porn",
  "จู๋", "จูบ", "กอด", "69", "ข่มขืน", "แตกใน", "ซั่ม"
];
const flirtWords = [
  "จีบ", "ชอบ", "คิดถึง", "รัก", "แฟน", "น่ารัก", "แต่งงาน", "ไปเดท", "หวง", "หึง", "มองตา"
];
const angryWords = [
  "โกง", "เว็บโกง", "เว็บห่วย", "ขี้โกง", "ไม่จ่าย", "เชิดเงิน", "แม่ง", "สัส", "เหี้ย",
  "กาก", "เลว", "โง่", "ควย", "หมดตัว", "เจ๊ง", "เงินหมด", "เสียหมด", "เสียหมดตูด"
];
const teamWords = [
  "แมนยู", "ลิเวอร์พูล", "อาร์เซน่อล", "เชลซี", "แมนซิตี้", "สเปอร์", "บาร์เซโลนา", "เรอัลมาดริด"
];

// ============ ASSISTANT ===============
const assistantNames = ["น้องฟาง", "น้องปุย", "น้องแพรว", "น้องมายด์", "น้องบัว", "น้องน้ำหวาน", "น้องแพม", "น้องจ๋า"];
function getRandomAssistantName(lastName) {
  let name;
  do {
    name = assistantNames[Math.floor(Math.random() * assistantNames.length)];
  } while (name === lastName);
  return name;
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
      assistantName: getRandomAssistantName(""),
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

// =============== Pause/Resume Pattern ===============
function isPauseCommand(text) {
  const patterns = [
    /หัวหน้าแอดมิน\s*รับเคส/gi,
    /\bรับเคส\b/gi,
    /\bรับเรื่อง\b/gi,
    /\bpause\b/gi,
    /\bรับดูแล\b/gi,
    /\bขอดูแล\b/gi,
    /\bขอเป็นผู้ดูแล\b/gi,
    /\bดำเนินการให้แล้ว\b/gi,
  ];
  return patterns.some(pat => pat.test(text));
}
function isResumeCommand(text) {
  const patterns = [
    /\bปลดพอส\b/gi,
    /\bresume\b/gi,
    /\bดำเนินการเสร็จ\b/gi,
    /\bปลดแชท\b/gi,
    /\bกลับมาดูแล\b/gi,
    /\bจบเคส\b/gi,
    /\bunpause\b/gi
  ];
  return patterns.some(pat => pat.test(text));
}

// =========== INTENT DETECT ===========
function detectIntent(text) {
  if (explicitWords.some(w => text.includes(w))) return "explicit";
  if (flirtWords.some(w => text.includes(w))) return "flirt";
  if (angryWords.some(w => text.includes(w))) return "angry";
  if (/(\bscore\b|ผลบอล|ผลบอลสด|ผลการแข่งขัน|สกอ|ฟุตบอล|แมนยู|ลิเวอร์พูล|อาร์เซน่อล|เชลซี|แมนซิตี้|สเปอร์|บาร์เซโลนา|เรอัลมาดริด)/i.test(text)) return "football";
  if (/หวย|lotto|lott|สลาก|ตรวจหวย|เลขเด็ด|งวดนี้|เลข/i.test(text)) return "lotto";
  if (text.endsWith("?")) return "info";
  return "neutral";
}

// =========== FETCH REAL DATA ===========
async function fetchRealData(intent, query) {
  if (intent === "football") return await fetchFootballData(query);
  if (intent === "lotto") return await fetchLottoData(query);
  return "";
}
async function fetchFootballData(query) {
  try {
    const res = await fetch("https://www.ballchud.com/api/schedule/today");
    const json = await res.json();
    let matches = json?.data || [];
    const teamKeyword = teamWords.find(team => query.includes(team));
    if (teamKeyword) {
      matches = matches.filter(m => [m.team_home, m.team_away].some(t => t.includes(teamKeyword)));
    }
    if (!matches.length) return "";
    matches = matches.slice(0, 5).map(
      m => `${m.league} คู่ ${m.team_home} vs ${m.team_away} เวลา ${m.time} ผลล่าสุด ${m.score_home}-${m.score_away}`
    ).join("\n");
    return matches || "";
  } catch (err) {
    return "";
  }
}
async function fetchLottoData(query) {
  try {
    const res = await fetch("https://www.boydunglotto.com/api/latest");
    const json = await res.json();
    if (json && json.result && json.result.length) {
      return "ผลหวยรัฐบาลล่าสุด: " + json.result.join(", ");
    }
    return "";
  } catch (err) {
    return "";
  }
}

// =========== Prompt Master GPT ===========
function buildPrompt(assistantName, historyContext, intent, realData, text) {
  let roleDesc = `บทบาท: เป็นแอดมินผู้หญิงชื่อ ${assistantName} ของ PGTHAI289\n` +
    `ประวัติการคุยก่อนหน้า:\n${historyContext}\n` +
    `ข้อมูลสดที่หาได้: ${realData}\n`;

  switch (intent) {
    case "explicit":
      return roleDesc + `
หน้าที่: ตอบลูกค้าที่ถามหรือพูดคุยแนว 18+ หรือเรื่องเพศ ด้วยมุกขำ ๆ เล่น ๆ แบบผู้หญิงขี้อาย น่ารัก ไม่หยาบคาย ไม่ตอบอนาจาร
1. เบี่ยงประเด็นแบบขำ ๆ หรือหยอกกลับเบา ๆ
2. ปิดท้ายชวนคุยเรื่องเว็บหรือโปรโมทเบา ๆ
ข้อความลูกค้า: "${text}"`;
    case "flirt":
      return roleDesc + `
หน้าที่: ตอบลูกค้าที่จีบหรือล้อเล่นแนวขี้เล่น น่ารัก อ้อนบ้าง ให้รู้ว่ารับมุกแต่ไม่ถึงกับหวานเว่อร์
1. ตอบแบบกันเอง ไม่เขินมาก
2. ปิดท้ายด้วยการชวนเล่นหรือสอบถามเว็บ
ข้อความลูกค้า: "${text}"`;
    case "angry":
      return roleDesc + `
หน้าที่: ตอบลูกค้าที่อารมณ์เสียหรือด่าเว็บ ต้องปลอบใจ ยืนยันความมั่นคง ดูแลให้ดีที่สุด ไม่บวกอารมณ์เพิ่ม
1. ฟังและปลอบใจ
2. ยืนยันเว็บมั่นคง ปลอดภัย
3. ชวนเล่นต่อหรือสอบถามได้ 24 ชม.
ข้อความลูกค้า: "${text}"`;
    case "football":
      return roleDesc + `
หน้าที่: ลูกค้าต้องการข้อมูลฟุตบอล/ผลบอล ให้ตอบด้วยข้อมูลจริงสด ถ้าไม่มีบอกชวนเข้าเว็บดูผลสดได้
ข้อความลูกค้า: "${text}"`;
    case "lotto":
      return roleDesc + `
หน้าที่: ลูกค้าต้องการข้อมูลหวยหรือเลขเด็ด ให้ตอบด้วยข้อมูลจริงสด และชวนดูโปรหวยในเว็บ
ข้อความลูกค้า: "${text}"`;
    case "info":
      return roleDesc + `
หน้าที่: ตอบคำถามข้อมูลอย่างมืออาชีพ
1. ให้ข้อมูลจริงก่อน (ถ้ามี)
2. ชวนเล่นหรือสอบถามเพิ่มได้ 24 ชม.
ข้อความลูกค้า: "${text}"`;
    default:
      return roleDesc + `
หน้าที่: คุยกับลูกค้าแบบอบอุ่น ฉลาด ทะลึ่งนิดๆ ถ้าเหมาะสม
1. คุยเป็นกันเอง
2. ปิดท้ายด้วย soft sell เว็บ
ข้อความลูกค้า: "${text}"`;
  }
}

// =========== FLEX MENU ==============
export function createFlexMenuContents() {
  return {
    type: "carousel",
    contents: [
      {
        type: "bubble",
        hero: { type: "image", url: "https://i.ibb.co/SqbNcr1/image.jpg", size: "full", aspectRatio: "20:13", aspectMode: "cover" },
        body: {
          type: "box", layout: "vertical", backgroundColor: "#4B0082", contents: [
            { type: "text", text: "สมัครสมาชิก + Login", weight: "bold", size: "lg", color: "#FFFFFF" },
            { type: "text", text: "เว็บเราสมัครฟรีไม่มีค่าใช้จ่าย หากติดขัดปัญหาด้านใดยินดีบริการ 24 ชั่วโมง", size: "sm", color: "#FFFFFF", wrap: true, margin: "md" }
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
      {
        type: "bubble",
        hero: { type: "image", url: "https://i.ibb.co/SqbNcr1/image.jpg", size: "full", aspectRatio: "20:13", aspectMode: "cover" },
        body: {
          type: "box", layout: "vertical", backgroundColor: "#4B0082", contents: [
            { type: "text", text: "แจ้งปัญหาการใช้งาน", weight: "bold", size: "lg", color: "#FFFFFF" },
            { type: "text", text: "แจ้งปัญหาการใช้งาน แอดมินพร้อมดูแลตลอด 24 ชั่วโมงเลยนะคะ", size: "sm", color: "#FFFFFF", wrap: true, margin: "md" }
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
export async function tryResumeFromPause(userId, lineClient) {
  if (userPausedStates[userId] && userPauseTimestamp[userId]) {
    const now = Date.now();
    if (now - userPauseTimestamp[userId] > pauseAutoResume) {
      userPausedStates[userId] = false;
      userPauseTimestamp[userId] = null;
      updateUserState(userId, { currentCase: null, caseData: {}, caseFollowUpCount: 0 });
      await lineClient.pushMessage(userId, {
        type: "text",
        text: "คิดถึงคุณพี่จังเลยค่ะ ถ้าต้องการสอบถามหรือปรึกษาเรื่องไหนแจ้งน้องได้ทุกเวลานะคะ 💖"
      });
      await sendTelegramAlert(`[AUTO RESUME] ระบบปลด pause อัตโนมัติ (ครบ 5 นาที) userId: ${userId}`);
    }
  }
}

// =============== MAIN FLOW MANAGER =================
export async function handleCustomerFlow(event, lineClient) {
  if (globalPause) return [];
  const userId = event.source?.userId;
  const state = getUserState(userId);
  updateUserState(userId, { lastActive: Date.now() });
  const reply = [];
  const text = event.message?.text?.trim() || "";
  let flexSent = false;

  await tryResumeFromPause(userId, lineClient);
  if (userPausedStates[userId]) return [];

  // Pause/Unpause
  if (isPauseCommand(text)) {
    userPausedStates[userId] = true;
    userPauseTimestamp[userId] = Date.now();
    updateUserState(userId, { currentCase: "admin_case" });
    await notifyAdmin(event, `🔴 [PAUSE] มีการ pause แชทจากข้อความ: "${text}"`);
    return [{ type: "text", text: "หัวหน้าแอดมินกำลังดูแลพี่อยู่น้า น้องส่งต่อให้เรียบร้อยค่ะ 💕" }];
  }
  if (isResumeCommand(text)) {
    userPausedStates[userId] = false;
    userPauseTimestamp[userId] = null;
    updateUserState(userId, { currentCase: null, caseData: {}, caseFollowUpCount: 0 });
    await notifyAdmin(event, `🟢 [RESUME] ปลด pause แชทจากข้อความ: "${text}"`);
    return [{ type: "text", text: "น้องกลับมาดูแลต่อแล้วนะคะ มีอะไรสอบถามเพิ่มเติมแจ้งได้เลยค่า 💕" }];
  }

  // == Follow/เพิ่มเพื่อนใหม่ (1 เฟล็ก)
  if (event.type === "follow" && shouldGreet(userId)) {
    const introName = getUserState(userId).assistantName;
    reply.push({ type: "text", text: `สวัสดีค่า ยินดีต้อนรับเข้าสู่ PGTHAI289 นะคะ 💖 วันนี้${introName}ขอดูแลคุณพี่เป็นพิเศษเลย พร้อมช่วยทุกเรื่อง 24 ชั่วโมง!` });
    reply.push({ type: "flex", altText: "🎀 เมนูพิเศษ", contents: createFlexMenuContents() });
    updateUserState(userId, { lastFlexSent: Date.now(), lastGreeted: Date.now() });
    await notifyAdmin(event, "ลูกค้าเพิ่มเพื่อนใหม่");
    return reply;
  }

  // == ฟังชั่น postback กรณีปุ่ม Flex ==
  if (event.type === "postback" && event.postback?.data) {
    const data = event.postback.data;
    reply.push({ type: "text", text: `✅ คุณกดปุ่ม: ${data}` });
    let msg = "";
    if (data === "register_admin") { msg = "ขอข้อมูล ชื่อ-นามสกุล เบอร์โทร บัญชี/วอเลท และไอดีไลน์ด้วยนะคะ 💕"; userPausedStates[userId] = true; userPauseTimestamp[userId] = Date.now(); }
    if (data === "login_backup") { msg = "แจ้งชื่อและเบอร์โทรที่สมัครไว้เพื่อตรวจสอบการเข้าเล่นค่ะ 💕"; userPausedStates[userId] = true; userPauseTimestamp[userId] = Date.now(); }
    if (data === "issue_deposit") { msg = "แจ้งชื่อ+เบอร์โทร และส่งสลิปฝากเงินให้ตรวจสอบนะคะ 💕"; userPausedStates[userId] = true; userPauseTimestamp[userId] = Date.now(); }
    if (data === "forgot_password") { msg = "แจ้งชื่อ+เบอร์โทรที่สมัครไว้ เดี๋ยวน้องช่วยรีเซ็ตให้ค่ะ 💕"; userPausedStates[userId] = true; userPauseTimestamp[userId] = Date.now(); }
    if (data === "promo_info") { msg = "พี่สนใจเล่นอะไรเป็นพิเศษคะ บอล สล็อต หวย คาสิโน หรืออื่นๆ 💕"; userPausedStates[userId] = true; userPauseTimestamp[userId] = Date.now(); }
    reply.push({ type: "text", text: msg });
    if (shouldSendFlex(userId) && !flexSent) {
      reply.push({ type: "flex", altText: "🎀 เมนูพิเศษ", contents: createFlexMenuContents() });
      updateUserState(userId, { lastFlexSent: Date.now() });
      flexSent = true;
    }
    await notifyAdmin(event, `ลูกค้ากดปุ่ม ${data}`);
    return reply;
  }

  // == กรณี admin_case รับข้อมูลหลังพอส ==
  if (state.currentCase === "admin_case" && (text.length > 3 || event.message?.type === "image")) {
    reply.push({ type: "text", text: "ได้รับข้อมูลแล้วค่ะ กำลังส่งให้หัวหน้าฝ่ายดำเนินการ 💕" });
    userPausedStates[userId] = true;
    userPauseTimestamp[userId] = Date.now();
    await notifyAdmin(event, `ข้อมูลจากลูกค้า (เคส ${state.currentCase}): ${text || "ส่งรูป"}`);
    return reply;
  }

  // == Intent ที่ต้อง Fetch Real Data == ***ถ้าไม่ได้ผลสด = return [] ไม่ตอบเลย
  let realData = "";
  const intent = detectIntent(text);
  if (["football", "lotto"].includes(intent)) {
    realData = await fetchRealData(intent, text);
    if (!realData) return [];
    reply.push({ type: "text", text: realData });
    if (shouldSendFlex(userId) && !flexSent) {
      reply.push({ type: "flex", altText: "🎀 เมนูพิเศษ", contents: createFlexMenuContents() });
      updateUserState(userId, { lastFlexSent: Date.now() });
      flexSent = true;
    }
    await notifyAdmin(event, text || "ลูกค้าส่งข้อความ/รูป");
    return reply;
  }

  // == Negative Words ==
  if (intent === "angry") {
    const apologyReply = await getCuteDynamicReply(
      buildPrompt(state.assistantName, "", intent, realData, text)
    );
    reply.push({ type: "text", text: sanitizeReply(limitSentences(apologyReply), state.assistantName) });
    if (shouldSendFlex(userId) && !flexSent) {
      reply.push({ type: "flex", altText: "🎀 เมนูพิเศษ", contents: createFlexMenuContents() });
      updateUserState(userId, { lastFlexSent: Date.now() });
      flexSent = true;
    }
    await notifyAdmin(event, text);
    return reply;
  }

  // == ส่ง Flex (ถ้าเข้า Cooldown และยังไม่เคยส่งในรอบนี้) สำหรับ message ปกติ
  if (event.type === "message" && shouldSendFlex(userId) && !flexSent) {
    reply.push({ type: "flex", altText: "🎀 เมนูพิเศษ", contents: createFlexMenuContents() });
    updateUserState(userId, { lastFlexSent: Date.now() });
    flexSent = true;
  }

  // == GPT Chat (default)
  try {
    const now = Date.now();
    if (!state.assistantName || now - state.lastGreeted > 10 * 60 * 1000) {
      const newName = getRandomAssistantName(state.assistantName);
      updateUserState(userId, { assistantName: newName, lastGreeted: now });
      state.assistantName = newName;
    }
    const assistantName = state.assistantName;
    const historyContext = state.chatHistory.map(h => `${h.role}: ${h.content}`).join('\n');
    const gptPrompt = buildPrompt(assistantName, historyContext, intent, realData, text);

    let gptReply = await getCuteDynamicReply(gptPrompt);
    gptReply = sanitizeReply(limitSentences(gptReply), assistantName);

    reply.push({ type: "text", text: gptReply });

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
// ====== Utility: แจ้งเตือน admin เมื่อมี event สำคัญ ======
async function notifyAdmin(event, detail = "") {
  try {
    let msg = `[LINE OA] Event: ${event.type || "-"}\nuserId: ${event.source?.userId || "-"}\n${detail}`;
    if (event.message?.type === "image") {
      const imageBuffer = await getLineImage(event.message.id);
      await sendTelegramPhoto(imageBuffer, msg);
    } else {
      await sendTelegramAlert(msg);
    }
  } catch (err) {}
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

// =============== CRM FOLLOW-UP (3,7,15,30 วัน) =================
export function initCRM(lineClient) {
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
  }, 6 * 60 * 60 * 1000); // ทุก 6 ชม.
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

// ========== EXPORT ==========
export default {
  handleCustomerFlow,
  tryResumeFromPause,
  createFlexMenuContents,
  debugLogToTelegram,
  getBotHealthStatus,
  initCRM
};
