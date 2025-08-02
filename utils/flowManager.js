// utils/flowManager.js
import { getCuteDynamicReply } from "../services/gptService.js";
import { sendTelegramAlert, sendTelegramPhoto, getLineProfile } from "../services/telegramService.js";
import { getLineImage } from "../services/lineMediaService.js";

const userStates = {};
const userPausedStates = {};
const flexCooldown = 2 * 60 * 60 * 1000;

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
  userStates[userId] = {
    ...getUserState(userId),
    ...newState,
  };
}

// วิเคราะห์ Intent
async function analyzeUserIntent(userText) {
  const analysisPrompt = `
คุณคือระบบวิเคราะห์ Intent ของข้อความลูกค้า
- วิเคราะห์ข้อความว่าเกี่ยวข้องกับ: "problem" (ปัญหา), "finance" (การเงิน ฝาก ถอน), "register" (สมัคร), "general_question" (คำถามทั่วไป), หรือ "emotion" (อารมณ์/ความรู้สึก)
- ให้ตอบ JSON เท่านั้น เช่น:
{ "intent": "emotion", "summary": "ลูกค้าหิว" }

ข้อความลูกค้า: "${userText}"
`;
  try {
    const analysisResult = await getCuteDynamicReply(analysisPrompt);
    try {
      return JSON.parse(analysisResult);
    } catch {
      return { intent: "unknown", summary: userText };
    }
  } catch (err) {
    console.error("analyzeUserIntent Error:", err);
    return { intent: "unknown", summary: userText };
  }
}

// ตอบตาม Intent
async function generateSmartReply(userText) {
  const intentData = await analyzeUserIntent(userText);
  let prompt = "";
  switch (intentData.intent) {
    case "emotion":
      prompt = `ลูกค้ากำลังแสดงอารมณ์ (${intentData.summary}) 
ตอบแบบเป็นกันเอง ให้กำลังใจ และชวนเล่นเว็บ pgthai289 แบบเนียน ๆ แต่ไม่ยัดเยียด`;
      break;
    case "general_question":
      prompt = `ลูกค้าถามเรื่องทั่วไป (${intentData.summary}) 
ตอบสั้น ๆ ชัดเจน แล้วชวนเล่นเว็บ pgthai289 แบบน่ารัก ๆ`;
      break;
    case "register":
      prompt = `ลูกค้าต้องการสมัครสมาชิก
ตอบขั้นตอนสมัครสมาชิก pgthai289 แบบกระชับและสุภาพ พร้อมชวนสมัครเลย`;
      break;
    case "finance":
      prompt = `ลูกค้าสนใจเรื่องฝากถอน (${intentData.summary}) 
ตอบข้อมูลฝากถอน pgthai289 แบบชัดเจน และบอกวิธีทำรายการให้เสร็จได้ทันที`;
      break;
    case "problem":
      prompt = `ลูกค้ากำลังมีปัญหาใช้งาน (${intentData.summary}) 
ตอบด้วยน้ำเสียงสุภาพ น่ารัก และบอกขั้นตอนแก้ปัญหาชัดเจน`;
      break;
    default:
      prompt = `ตอบข้อความนี้แบบสุภาพ เป็นกันเอง และชวนเล่น pgthai289 เบา ๆ: "${userText}"`;
      break;
  }
  return await getCuteDynamicReply(prompt);
}

// echo ปุ่ม postback
function pushEchoPostbackMessage(replyMessages, postbackData) {
  replyMessages.push({ type: "text", text: `✅ คุณเลือก: ${postbackData}` });
}

// ตรวจสอบว่าควรส่ง flex ไหม
function shouldSendFlex(userId) {
  const state = getUserState(userId);
  return Date.now() - state.lastFlexSent > flexCooldown;
}

// main flow
export async function handleCustomerFlow(event) {
  const userId = event.source?.userId;
  const state = getUserState(userId);
  const replyMessages = [];
  const userText = event.message?.text?.trim() || "";

  // echo ถ้าลูกค้ากดปุ่มที่เป็น message action
  if (event.type === "message" && userText) {
    const predefinedButtons = ["สมัครเอง", "ทางเข้าเล่นหลัก", "ทางเข้าเล่นสำรอง"];
    if (predefinedButtons.includes(userText)) {
      replyMessages.push({ type: "text", text: `✅ คุณเลือก: ${userText}` });
    }
  }

  if (event.type === "postback" && event.postback?.data) {
    pushEchoPostbackMessage(replyMessages, event.postback.data);
  }

  // ตอบ GPT ด้วย Intent
  try {
    let gptReply = await generateSmartReply(userText || event.postback?.data || "");
    replyMessages.push({ type: "text", text: gptReply });
  } catch (e) {
    replyMessages.push({ type: "text", text: "น้องขอโทษค่ะ เกิดข้อผิดพลาด รอสักครู่ค่ะ 💕" });
  }

  return replyMessages;
}
