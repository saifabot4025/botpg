
// ================== FLOW MANAGER (FINAL + CRM + GPT VARIETY) ==================
import { getCuteDynamicReply } from "../services/gptService.js";
import { sendTelegramAlert, sendTelegramPhoto, getLineProfile } from "../services/telegramService.js";
import { getLineImage } from "../services/lineMediaService.js";
import line from "@line/bot-sdk";
import fs from "fs";
import path from "path";

// ================== STATE MANAGEMENT ==================
const userStates = {};
const userPausedStates = {};
const flexCooldown = 2 * 60 * 60 * 1000;

function getUserState(userId) {
  if (!userStates[userId]) {
    userStates[userId] = {
      lastFlexSent: 0,
      currentCase: null,
      caseData: {},
      lastActive: Date.now(),
      greeted: false,
      chatHistory: [],
      totalDeposit: 0,
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

// ================== RANDOM NAME ==================
let usedNamesToday = new Set();
let currentDate = new Date().toLocaleDateString("th-TH");

async function getRandomName() {
  const today = new Date().toLocaleDateString("th-TH");
  if (today !== currentDate) {
    usedNamesToday.clear();
    currentDate = today;
  }
  for (let i = 0; i < 5; i++) {
    try {
      const name = (await getCuteDynamicReply("สุ่มรายชื่อคนไทย 1 ชื่อ ตอบแค่ชื่อเดียว")).replace(/\n/g, "").trim();
      if (name && !usedNamesToday.has(name)) {
        usedNamesToday.add(name);
        return name;
      }
    } catch {}
  }
  const fallbackNames = ["สมชาย","กิตติ","อนันต์","วีรพล","ณัฐพล","ปกรณ์","นที","วิทยา","สมหญิง","กัญญา","ศิริพร","วาสนา","จิราพร","สุพัตรา","อัญชลี","พิมพ์ใจ"];
  let name;
  do { name = fallbackNames[Math.floor(Math.random() * fallbackNames.length)]; } while (usedNamesToday.has(name));
  usedNamesToday.add(name);
  return name;
}

// ================== ADMIN ALERT ==================
async function notifyAdmin(event, message) {
  try {
    const profile = await getLineProfile(event.source?.userId);
    const displayName = profile?.displayName || "ไม่ทราบชื่อ";
    const oaName = process.env.LINE_OA_NAME || "ไม่ทราบ OA";
    const text = `📢 แจ้งเตือนจาก ${oaName}\n👤 ลูกค้า: ${displayName}\n💬 ข้อความ: ${message}`;
    await sendTelegramAlert(text);
    if (event.message?.type === "image" && event.message.id) {
      const photoBuffer = await getLineImage(event.message.id);
      if (photoBuffer) await sendTelegramPhoto(photoBuffer, `📷 รูปจากลูกค้า (${displayName})`);
    }
  } catch (err) { console.error("notifyAdmin Error:", err); }
}

// ================== GPT PROMPTS ==================
async function generateDynamicPrompt(baseType) {
  let prompt = "";
  if (baseType === "welcome") prompt = "สุ่มคำทักทายลูกค้าแบบน่ารัก 1 ประโยค เช่น ยินดีต้อนรับค่าา 💕 มาสนุกกันเลย!";
  if (baseType === "ask_info") prompt = "สุ่มประโยคขอข้อมูลลูกค้า 1 ประโยค (ต้องมี ชื่อ-นามสกุล เบอร์โทร บัญชี/วอเลท และไอดีไลน์)";
  if (baseType === "confirm_info") prompt = "สุ่มประโยคแจ้งว่ารับข้อมูลแล้ว 1 ประโยค เช่น ได้รับข้อมูลแล้วค่ะ ทีมงานกำลังดำเนินการให้นะคะ 💕";
  try { return (await getCuteDynamicReply(prompt)).replace(/\n/g, "").trim(); }
  catch { if (baseType==="welcome") return "🎉 ยินดีต้อนรับค่า มาสนุกกันเลยนะคะ 💕";
          if (baseType==="ask_info") return "ขอข้อมูล ชื่อ-นามสกุล เบอร์โทร บัญชี/วอเลท และไอดีไลน์ด้วยนะคะ 💕";
          if (baseType==="confirm_info") return "ได้รับข้อมูลแล้วค่ะ ทีมงานกำลังดูแลให้เลยนะคะ 💕"; }
}

// ================== RANDOMIZED MESSAGES ==================
let cachedMaxWithdrawDate=null,cachedMaxWithdrawAmount=null,cachedMaxWithdrawName=null;

async function generateWithdrawReviewMessage(){...} // (ย่อเพื่อความกระชับ แต่ในไฟล์จริงจะใส่โค้ดเต็ม)
async function generateMaxWithdrawMessage(){...}
async function generateTopGameMessage(){...}
async function generateReferralCommissionMessage(){...}

// ================== INTENT & SMART REPLY ==================
const logPath = path.join(process.cwd(),"intent_logs.json");
let lastRepliesCache={};

function logIntent(userText,intent,reply){...} 
function getEmojiByIntent(intent){...} 
const fallbackTemplates={...}; 
async function analyzeUserIntent(userText){...}
async function generateSmartReply(userText){...}

// ================== FLEX MENU ==================
function createFlexMenuContents() {
  return { type: "carousel", contents: [/* 3 bubble + ปุ่มครบทุกฟังก์ชัน ตามที่ออกแบบ */] };
}

// ================== MAIN FLOW ==================
const recentMessages={};
function isDuplicateMessage(userId,text){...}

export async function handleCustomerFlow(event){...}

// ================== CRM FOLLOW-UP ==================
const crmHistory={};const crmTemplates=[...];
function getRandomTemplate(){...}
function randomDelay(){...}
async function generateBehaviorBasedMessage(uid){...}
export function initCRM(lineClient){...}
