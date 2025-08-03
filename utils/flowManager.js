/* ================== FLOW MANAGER (FINAL PRO VERSION) ================== */
import { getCuteDynamicReply } from "../services/gptService.js";
import { sendTelegramAlert, sendTelegramPhoto, getLineProfile } from "../services/telegramService.js";
import { getLineImage } from "../services/lineMediaService.js";
import fs from "fs";

/* ================== STATE ================== */
const userStates = {};
const userPausedStates = {};
const flexCooldown = 2 * 60 * 60 * 1000; // 2 ชั่วโมง
const greetCooldown = 10 * 60 * 1000; // 10 นาที

function getUserState(userId) {
  if (!userStates[userId]) {
    userStates[userId] = {
      lastFlexSent: 0,
      lastGreeted: 0,
      currentCase: null,
      caseData: {},
      lastActive: Date.now(),
      chatHistory: [],
      totalDeposit: 0
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

/* ================== UTILITIES ================== */
function randomMaskedPhone() {
  const prefix = "08";
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}xxxx${suffix}`;
}

async function getRandomName() {
  try {
    const name = await getCuteDynamicReply("สุ่มชื่อเล่นคนไทย 1 ชื่อ ตอบแค่ชื่อ");
    return name.replace(/\n/g, "").trim();
  } catch {
    const fallback = ["ฟ้า", "น้ำตาล", "กิ๊ฟ", "ฝน", "น้องเนย", "พิม", "จ๋า", "ขนม", "ฝ้าย", "เกด"];
    return fallback[Math.floor(Math.random() * fallback.length)];
  }
}

async function notifyAdmin(event, msg) {
  try {
    const profile = await getLineProfile(event.source?.userId);
    const name = profile?.displayName || "ไม่ทราบชื่อ";
    const oa = process.env.LINE_OA_NAME || "OA";
    await sendTelegramAlert(`📢 แจ้งเตือนจาก ${oa}\n👤 ลูกค้า: ${name}\n💬 ข้อความ: ${msg});
    if (event.message?.type === "image") {
      const photo = await getLineImage(event.message.id);
      if (photo) await sendTelegramPhoto(photo, 📷 รูปจากลูกค้า (${name}));
    }
  } catch (err) { console.error("notifyAdmin error:", err); }
}

/* ================== MESSAGE GENERATORS ================== */
async function generateWithdrawReviewMessage() {
  const reviews = [];
  for (let i=0;i<10;i++){
    const phone = randomMaskedPhone();
    const amt = (Math.floor(Math.random()*45000)+5000).toLocaleString();
    reviews.push(ยูส ${phone} ถอน ${amt});
  }
  return `📊 รีวิวการถอนล่าสุด\n\n${reviews.join("\n")}\n\nเว็บมั่นคง ปลอดภัย จ่ายจริง 💕;
}

async function generateMaxWithdrawMessage() {
  const today = new Date().toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" });
  if (!global.cachedDate || global.cachedDate !== today) {
    global.cachedDate = today;

    // ✅ ไม่เรียก GPT แต่สุ่มจาก Array ที่กำหนดเอง
    const names = ["กิตติ", "สมชาย", "ณัฐพล", "ธีรภัทร", "จักรพงศ์","ปิยะ", "อาทิตย์", "ชยพล", "ภาณุ", "สุรศักดิ์", "วิชัย", "ณรงค์", "กมล", "อนันต์", "ประเสริฐ","พรชัย", "สกล", "พงษ์ศักดิ์", "ชัยวัฒน์", "สมบัติ", "สุพรรณ", "ปรีชา", "สมพงษ์", "วิทยา", "วรพล",
  "สุภาวดี", "กมลวรรณ", "พัชราภา", "ปวีณา", "สุภาวรรณ",
  "นภัสสร", "กัญญารัตน์", "ปาริชาติ", "อรอนงค์", "จันทร์เพ็ญ",
  "ธิดารัตน์", "สุธาสินี", "พิมพ์ชนก", "อารยา", "วราภรณ์",
  "สุวรรณา", "ศิริพร", "อัญชลี", "รัชนีกร", "ภัทรพร",
  "พัชรี", "มนัสวี", "สายพิณ", "รัตนาภรณ์", "ดวงกมล"
];
    global.cachedName = names[Math.floor(Math.random() * names.length)];

    global.cachedAmt = Math.floor(Math.random() * 200000) + 300000;
  }

  return 👑 ยอดถอนสูงสุดวันนี้\n\nยินดีกับคุณ "${global.cachedName}" ยูส ${randomMaskedPhone()} ถอน ${global.cachedAmt.toLocaleString()} บาท\nวันที่ ${today};
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
  const selected = games.sort(()=>0.5-Math.random()).slice(0,5);
  const freeSpin = Math.floor(Math.random()*(500000-50000))+50000;
  const normal = Math.floor(Math.random()*(50000-5000))+5000;
  let msg = "🎲 เกมสล็อตแตกบ่อยวันนี้\n\n";
  selected.forEach((g,i)=>msg += ${i+1}. ${g} - ${Math.floor(Math.random()*20)+80}%\n);
  msg += \n💥 ฟรีสปินแตกล่าสุด: ${freeSpin.toLocaleString()} บาท\n💥 ปั่นธรรมดาแตกล่าสุด: ${normal.toLocaleString()} บาท\nเล่นเลย แตกง่าย จ่ายจริง 💕;
  return msg;
}

async function generateReferralCommissionMessage() {
  const lines=[];
  for (let i=0;i<10;i++){
    const phone = randomMaskedPhone();
    const amt=(Math.floor(Math.random()*97000)+3000).toLocaleString();
    lines.push(ยูส ${phone} ได้ค่าคอมมิชชั่น ${amt});
  }
  return 🤝 ค่าคอมมิชชั่นแนะนำเพื่อน\n\n${lines.join("\n")}\n\n💡 ชวนเพื่อนมาเล่น รับค่าคอมทุกวัน!;
}

/* ================== FLEX ================== */
function createFlexMenuContents() {
  return {
    type: "carousel",
    contents: [
      // 📦 BOX 1 – สมัครสมาชิก + Login
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
          backgroundColor: "#4B0082", // ม่วงเข้ม
          contents: [
            { type: "text", text: "สมัครสมาชิก + Login", weight: "bold", size: "lg", color: "#FFFFFF" },
            {
              type: "text",
              text: "เว็บเราสมัครฟรีไม่มีค่าใช้จ่าย หากติดขัดปัญหาด้านใดยินดีบริการ 24 ชั่วโมง",
              size: "sm",
              color: "#FFFFFF",
              wrap: true,
              margin: "md",
            },
          ],
        },
        footer: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#4B0082",
          spacing: "sm",
          contents: [
            {
              type: "button",
              style: "primary",
              color: "#000000", // ปุ่มขาว
              action: {
                type: "uri",
                label: "⭐ สมัครเอง",
                uri: "https://pgthai289.net/customer/register/LINEBOT/?openExternalBrowser=1",
              },
            },
            {
              type: "button",
              style: "secondary",
              color: "#FFD700", // ปุ่มเหลือง
              action: { type: "postback", label: "📲 ให้แอดมินสมัครให้", data: "register_admin" },
            },
            {
              type: "button",
              style: "primary",
              color: "#000000",
              action: {
                type: "uri",
                label: "🔑 ทางเข้าเล่นหลัก",
                uri: "https://pgthai289.net/?openExternalBrowser=1",
              },
            },
            {
              type: "button",
              style: "secondary",
              color: "#FFD700",
              action: { type: "postback", label: "🚪 ทางเข้าเล่นสำรอง", data: "login_backup" },
            },
          ],
        },
      },

      // 📦 BOX 2 – แจ้งปัญหาการใช้งาน
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
          backgroundColor: "#4B0082",
          contents: [
            { type: "text", text: "แจ้งปัญหาการใช้งาน", weight: "bold", size: "lg", color: "#FFFFFF" },
            {
              type: "text",
              text: "แจ้งปัญหาการใช้งาน แอดมินพร้อมดูแลตลอด 24 ชั่วโมงเลยนะคะ",
              size: "sm",
              color: "#FFFFFF",
              wrap: true,
              margin: "md",
            },
          ],
        },
        footer: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#4B0082",
          spacing: "sm",
          contents: [
            {
              type: "button",
              style: "primary",
              color: "#000000",
              action: { type: "postback", label: "💰 ปัญหาฝาก/ถอน", data: "issue_deposit" },
            },
            {
              type: "button",
              style: "secondary",
              color: "#FFD700",
              action: { type: "postback", label: "🔑 ลืมรหัสผ่าน", data: "forgot_password" },
            },
            {
              type: "button",
              style: "primary",
              color: "#000000",
              action: { type: "postback", label: "🚪 เข้าเล่นไม่ได้", data: "login_backup" },
            },
            {
              type: "button",
              style: "secondary",
              color: "#FFD700",
              action: { type: "postback", label: "🎁 โปรโมชั่น/กิจกรรม", data: "promo_info" },
            },
          ],
        },
      },

      // 📦 BOX 3 – รีวิวการถอน + โบนัสไทม์
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
          backgroundColor: "#4B0082",
          contents: [
            { type: "text", text: "รีวิวการถอน + โบนัสไทม์", weight: "bold", size: "lg", color: "#FFFFFF" },
            {
              type: "text",
              text: "รีวิวการถอน+โบนัสไทม์ เว็บเราจ่ายชัวร์หลักร้อยหรือล้านก็ไวไร้ประวัติโกง",
              size: "sm",
              color: "#FFFFFF",
              wrap: true,
              margin: "md",
            },
          ],
        },
        footer: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#4B0082",
          spacing: "sm",
          contents: [
            {
              type: "button",
              style: "primary",
              color: "#000000",
              action: { type: "postback", label: "⭐ รีวิวถอนล่าสุด", data: "review_withdraw" },
            },
            {
              type: "button",
              style: "secondary",
              color: "#FFD700",
              action: { type: "postback", label: "👑 ถอนสูงสุดวันนี้", data: "max_withdraw" },
            },
            {
              type: "button",
              style: "primary",
              color: "#000000",
              action: { type: "postback", label: "🎮 เกมแตกบ่อย", data: "top_game" },
            },
            {
              type: "button",
              style: "secondary",
              color: "#FFD700",
              action: { type: "postback", label: "💎 ค่าคอมแนะนำเพื่อน", data: "referral_commission" },
            },
          ],
        },
      },
    ],
  };
}
function limitSentences(text, maxSentences = 2) {
  const sentences = text.split(/(?<=[.!?])\s+/); // ตัดตาม ., !, ?
  return sentences.slice(0, maxSentences).join(" ");
}

function sanitizeReply(reply, assistantName) {
  return reply.replace(/น้อง[^\s]+/g, assistantName); // ถ้า GPT ตอบชื่อผิดจะถูกแทนด้วย assistantName
}
/* ================== MAIN FLOW ================== */
export async function handleCustomerFlow(event){
  const userId=event.source?.userId;
  const state=getUserState(userId);
  updateUserState(userId, { lastActive: Date.now() });
  const reply=[];
  const text=event.message?.text?.trim()||"";
  // ✅ ตรวจจับคำด่า/ข้อความเชิงลบ
const negativeWords = [
  "โกง", "เว็บโกง", "เว็บห่วย", "ขี้โกง", "ไม่จ่าย", "เชิดเงิน", "เว็บไม่ดี", "โดนโกง",
  "แม่ง", "สัส", "เหี้ย", "ชิบหาย", "กาก", "เลว", "ไอ้", "โง่", "ควย", "ฟาย",
  "หมดตัว", "เสียหมด", "ทุนหาย", "หมดกำลังใจ", "เจ๊ง", "ไม่เหลือ", "โดนกินหมด",
  "เว็บเชี้ย", "เว็บควย", "เล่นไม่แตก", "ไม่แตก", "ไม่แจก", "ห่วยแตก", "เว็บแย่",
  "ทำไมไม่จ่าย", "เว็บขยะ", "เสียหมดตูด", "เล่นหมด", "เงินหมด", "เล่นแล้วเจ๊ง"
];

const containsNegative = negativeWords.some(word => text.includes(word));

if (containsNegative) {
  const apologyReply = await getCuteDynamicReply(
    บทบาท: เป็นแอดมินสาวมืออาชีพของ PGTHAI289 
สิ่งที่ต้องทำ:
1. ฟังความรู้สึกลูกค้าและเข้าใจความผิดหวังหรืออารมณ์เสีย
2. ถ้าลูกค้าหาว่าเว็บโกง ให้ยืนยันว่า PGTHAI289 มั่นคง ปลอดภัย มีประวัติการจ่ายจริง ฝาก-ถอนได้แน่นอน
3. ถ้าลูกค้าเสียเยอะ ให้ปลอบใจด้วยน้ำเสียงอบอุ่นและแนะนำให้เล่นอย่างมีสติ 
4. เชิญชวนให้ลูกค้าสอบถามหรือขอความช่วยเหลือได้ 24 ชั่วโมง
5. ตอบสั้น กระชับ และเป็นกันเองไม่เกิน 2 ประโยค
ข้อความจากลูกค้า: "${text}"
  );
 return [{ type: "text", text: apologyReply }]; // ✅ ตรงนี้ OK แล้ว
}
  // ✅ ถ้าแอดมินพิมพ์ว่า "หัวหน้าแอดมินรับเคสค่ะ" → ให้บอทหยุดตอบทันที
if (text.replace(/\s/g, "").includes("หัวหน้าแอดมินรับเคสค่ะ")) {
  userPausedStates[userId] = true;
  updateUserState(userId, { currentCase: "admin_case" });
  return [{ 
    type: "text", 
    text: "หัวหน้าแอดมินกำลังดูแลพี่อยู่น้า น้องส่งต่อให้เรียบร้อยค่ะ 💕" 
  }];
}

// ✅ ถ้าอยู่ในโหมด pause → ตรวจว่ามีข้อความจากแอดมินให้กลับมาทำงาน
if (userPausedStates[userId]) {
  const normalizedText = text.replace(/\s/g, "").trim();
  const keywords = [
  "ดำเนินการให้เรียบร้อยแล้ว",
  "ดำเนินการเรียบร้อยแล้ว",
  "ดำเนินการเสร็จแล้ว",
  "เรียบร้อยแล้ว",
  "ทำเสร็จแล้ว",
  "เสร็จแล้ว",
  "เรียบร้อย",
  "เคสนี้เสร็จแล้ว",
  "เคสนี้เรียบร้อยแล้ว",
  "จัดการเสร็จแล้ว",
  "ดำเนินการเรียบร้อย"
];
  // ✅ ถ้าหัวหน้าแอดมินพิมพ์เสร็จแล้ว → บอทกลับมาทำงาน พร้อมโปรโมทเว็บ
  if (keywords.some(keyword => normalizedText.includes(keyword))) {
    userPausedStates[userId] = false;
    updateUserState(userId, { currentCase: null, caseData: {}, caseFollowUpCount: 0 });
    return [{
      type: "text",
      text: "💕 หากมีปัญหาหรืออยากสอบถามเพิ่มเติม น้องพร้อมดูแล 24 ชม.เลยนะคะ มาสนุกกับ PGTHAI289 กันน้า! 🎰✨ แนะนำเพื่อนมาเล่น รับค่าคอมทุกวันด้วยนะคะ 💖"
    }];
  } 

  // ✅ ถ้ายังรอ → ให้ตอบเป็นสเต็ป
  const followUpCount = (state.caseFollowUpCount || 0) + 1;
  updateUserState(userId, { caseFollowUpCount: followUpCount });

  let msg = "";

  if (followUpCount === 1) {
    msg = "ขณะนี้หัวหน้าฝ่ายกำลังดำเนินการให้อยู่นะคะ 💕 ระหว่างนี้ลองดูโปรโมชั่นดีๆ ของ PGTHAI289 ได้น้า!";
  } 
  else if (followUpCount === 2) {
    msg = "อยู่ในคิวเรียบร้อยแล้วค่ะ 💕 น้องขอให้พี่ใจเย็นๆ ระหว่างนี้ลองชวนเพื่อนมาเล่น PGTHAI289 กัน รับค่าคอมทุกวันด้วยน้า!";
  } 
  else {
    msg = "พี่ไม่ต้องกังวลน้า ทีมงานกำลังเร่งทำให้สุดความสามารถเลยค่ะ 💕 ระหว่างรอ ลองเข้าไปดูโปรใหม่ๆ ที่ PGTHAI289 และชวนเพื่อนมาเล่นด้วยกันนะคะ!";
  }

  return [{ type: "text", text: msg }];
}

// ✅ ทักทายตอนลูกค้าเพิ่มเพื่อนใหม่
if (event.type === "follow" && shouldGreet(userId)) {
  reply.push({ type: "text", text: สวัสดีค่ะ น้องฟางเป็นแอดมินดูแลลูกค้าของ PGTHAI289 นะคะ 💕 });
  reply.push({ type: "flex", altText: "🎀 เมนูพิเศษ", contents: createFlexMenuContents() });
  updateUserState(userId, { lastFlexSent: Date.now(), lastGreeted: Date.now() });
  await notifyAdmin(event, "ลูกค้าเพิ่มเพื่อนใหม่");
  return reply;
}

  if(event.type==="postback" && event.postback?.data){
    const data=event.postback.data;
    reply.push({type:"text",text:✅ คุณกดปุ่ม: ${data}});
    let msg="";
    if(data==="register_admin"){ msg="ขอข้อมูล ชื่อ-นามสกุล เบอร์โทร บัญชี/วอเลท และไอดีไลน์ด้วยนะคะ 💕"; userPausedStates[userId]=true; }
    if(data==="login_backup"){ msg="แจ้งชื่อและเบอร์โทรที่สมัครไว้เพื่อตรวจสอบการเข้าเล่นค่ะ 💕"; userPausedStates[userId]=true; }
    if(data==="issue_deposit"){ msg="แจ้งชื่อ+เบอร์โทร และส่งสลิปฝากเงินให้ตรวจสอบนะคะ 💕"; userPausedStates[userId]=true; }
    if(data==="forgot_password"){ msg="แจ้งชื่อ+เบอร์โทรที่สมัครไว้ เดี๋ยวน้องช่วยรีเซ็ตให้ค่ะ 💕"; userPausedStates[userId]=true; }
    if(data==="promo_info"){ msg="พี่สนใจเล่นอะไรเป็นพิเศษคะ บอล สล็อต หวย คาสิโน หรืออื่นๆ 💕"; userPausedStates[userId]=true; }
    if(data==="review_withdraw"){ msg=await generateWithdrawReviewMessage(); }
    if(data==="max_withdraw"){ msg=await generateMaxWithdrawMessage(); }
    if(data==="top_game"){ msg=await generateTopGameMessage(); }
    if(data==="referral_commission"){ msg=await generateReferralCommissionMessage(); }
    reply.push({type:"text",text:msg});
    await notifyAdmin(event,ลูกค้ากดปุ่ม ${data});
    return reply;
  }

  if(state.currentCase && (text.length>3 || event.message?.type==="image")){
    reply.push({type:"text",text:"ได้รับข้อมูลแล้วค่ะ กำลังส่งให้หัวหน้าฝ่ายดำเนินการ 💕"});
    userPausedStates[userId]=true;
    await notifyAdmin(event,ข้อมูลจากลูกค้า (เคส ${state.currentCase}): ${text||"ส่งรูป"});
    return reply;
  }

  if(event.type==="message" && shouldSendFlex(userId)){
    reply.push({type:"flex",altText:"🎀 เมนูพิเศษ",contents:createFlexMenuContents()});
    updateUserState(userId,{lastFlexSent:Date.now()});
  }


try {
  const now = Date.now();
  const tooSoon = now - state.lastGreeted < 10 * 60 * 1000; // 10 นาที

  // ✅ ถ้ายังไม่มี assistantName หรือคุยห่างกันเกิน 10 นาที → เปลี่ยนชื่อใหม่
  if (!state.assistantName || !tooSoon) {
    const newName = getRandomAssistantName();
    updateUserState(userId, { assistantName: newName, lastGreeted: now });
    state.assistantName = newName;
  }

  const assistantName = state.assistantName;

  // ✅ ตรวจคำด่าหรือข้อความเชิงลบ
  const negativeWords = [
    "โกง", "เว็บโกง", "เว็บห่วย", "ชั่ว", "บ้า", "เลว", "แย่", "เหี้ย",
    "ไม่จ่าย", "โดนโกง", "หลอก", "เชี่ย", "กาก", "ควย", "ห่วย", "เสียเงินฟรี",
    "เว็บขยะ", "เว็บกาก", "เว็บเชี่ย", "เว็บเหี้ย"
  ];
  const containsNegative = negativeWords.some(word => text.includes(word));

  const assistantNames = ["น้องฟาง", "น้องปุย", "น้องแพรว", "น้องมายด์", "น้องบัว", "น้องน้ำหวาน", "น้องแพม", "น้องจ๋า"];

function getRandomAssistantName() {
  return assistantNames[Math.floor(Math.random() * assistantNames.length)];
}

if (!state.assistantName || now - state.lastGreeted > 10 * 60 * 1000 || event.type === "follow") {
  const newName = getRandomAssistantName();
  updateUserState(userId, { assistantName: newName, lastGreeted: now });
  state.assistantName = newName; // ✅ อัปเดต state ใน memory ด้วย
}
const assistantName = state.assistantName;
// ✅ สร้าง prompt แบบฉลาด
  let gptPrompt;
  if (containsNegative) {
    gptPrompt = 
บทบาท: เป็นแอดมินผู้หญิงชื่อ ${assistantName} ของ PGTHAI289
หน้าที่: ตอบลูกค้าอย่างมืออาชีพ สุภาพ และปลอบใจลูกค้าที่ใช้คำแรงหรือสงสัยว่าเว็บโกง
สิ่งที่ต้องทำ:
1. ตอบแบบอ่อนโยน มีความเข้าใจความรู้สึกลูกค้า
2. อธิบายให้มั่นใจว่าเว็บ PGTHAI289 มั่นคง ปลอดภัย เปิดมานาน และดูแลลูกค้าตลอด 24 ชม.
3. ใช้คำพูดน่ารัก อบอุ่น อ้อนๆ แต่จริงใจ ไม่เถียง ไม่ประชด
4. จำกัดไม่เกิน 2 ประโยค
ข้อความจากลูกค้า: "${text}"
;
  } else {
    gptPrompt = 
บทบาท: เป็นแอดมินผู้หญิงชื่อ ${assistantName} ของ PGTHAI289
หน้าที่: ตอบคำถามลูกค้าอย่างฉลาด มืออาชีพ และเป็นกันเอง
วิธีตอบ:
1. วิเคราะห์คำถามลูกค้าและหาคำตอบที่ตรงกับคำถามให้ก่อน เช่น ถ้าถามเรื่องเพลง ให้แนะนำชื่อเพลงใหม่จริงๆ
2. หลังจากตอบคำถามแล้ว ชวนลูกค้าเล่นกับเว็บ PGTHAI289 แบบเนียนๆ
3. ใช้สรรพนาม "${assistantName}" หรือ "น้อง"
4. ใช้คำพูดแบบผู้หญิง เช่น ค่ะ จ้า น้า
5. จำกัดไม่เกิน 2 ประโยค แต่ให้ดูอบอุ่นและชวนคุยต่อ
6. ถ้าเพิ่งคุยกันไม่เกิน 10 นาที ห้ามเริ่มด้วย "สวัสดี" แต่ให้ต่อเนื่องจากการคุยเดิม
ข้อความจากลูกค้า: "${text}"
;
  }
// ✅ ตรวจคำตอบสั้นๆ (ครับ/ค่ะ/ค่า/เค/ok) 
const shortReplies = ["ครับ", "คับ", "ค่ะ", "คะ", "ค่า", "เค", "ok", "โอเค", "ครับผม", "ค่ะจ้า"];
if (shortReplies.includes(text.toLowerCase())) {
  state.caseFollowUpCount = (state.caseFollowUpCount || 0) + 1;
  updateUserState(userId, state);

  let followUpMsg = "";

  if (state.caseFollowUpCount === 1) {
    followUpMsg = ${assistantName} ยินดีดูแลพี่เสมอนะคะ 💕 หากมีปัญหาหรือข้อสงสัยแจ้งได้เลยน้า เว็บ PGTHAI289 มั่นคง ปลอดภัย ถอนได้หลักล้านไวมากค่ะ ✨;
    return [{ type: "text", text: followUpMsg }];
  } 
  
  if (state.caseFollowUpCount === 2) {
    // ✅ ดีเลย์ 3 วินาทีก่อนตอบ
    setTimeout(() => {
      lineClient.pushMessage(userId,
        { 
          type: "text", 
          text: `${assistantName}` อยู่ดูแลพี่อยู่นะคะ 💕 ถ้ามีอะไรเพิ่มเติมถามได้เลยน้า เว็บ PGTHAI289 ฝาก-ถอนไว เล่นง่าย และถอนได้หลักล้านแบบชัวร์ๆ เลยค่ะ ✨
        }
      ]);
    }, 3000);
    return [];
  }

  if (state.caseFollowUpCount >= 3) {
    // ✅ ดีเลย์ 3 วินาทีแล้วตอบพร้อมรีเซ็ตนับใหม่
    setTimeout(() => {
      lineClient.pushMessage(userId,
        { 
          type: "text", 
          text: ถ้าพี่มีคำถามเพิ่มเติม ${assistantName} พร้อมช่วยดูแลเสมอนะคะ 🥰 และอย่าลืมชวนเพื่อนมาเล่น PGTHAI289 รับค่าคอมทุกวันด้วยน้า 💕
        }
      ]);
    }, 3000);
    state.caseFollowUpCount = 0;
    updateUserState(userId, state);
    return [];
  }
}
  // ✅ เรียก GPT
  let gptReply = '';
  try {
    gptReply = await getCuteDynamicReply(gptPrompt);
  } catch (err) {
    console.error('GPT Error:', err);
    gptReply = `${assistantName} พร้อมดูแลพี่เสมอนะคะ 💕 หากมีปัญหาสอบถามได้เลยน้า`;
  }

  // ✅ push ข้อความตอบกลับ
  reply.push({
    type: "text",
    text: sanitizeReply(limitSentences(gptReply), assistantName),
  });

  // ✅ เก็บแชทใน state
  state.chatHistory.push({ role: "assistant", content: gptReply });
  updateUserState(userId, state);

  // ✅ ถ้า GPT เริ่มตอบด้วย "สวัสดี" → อัปเดตเวลา
  if (gptReply.trim().startsWith("สวัสดี")) {
    updateUserState(userId, { lastGreeted: now });
  }

  await notifyAdmin(event, text || "ลูกค้าส่งข้อความ/รูป");
  return reply;
} catch (err) {
  reply.push({
    type: "text",
    text: "ขอโทษนะคะ รบกวนส่งข้อความใหม่ให้น้องอีกครั้งได้ไหมคะ 💕",
  });
  return reply;
}

/* ================== CRM FOLLOW-UP (3,7,15,30 วัน) ================== */
function initCRM(lineClient) {
  setInterval(async () => {
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
          await sendTelegramAlert(`📢 CRM (${period.days} วัน) ส่งข้อความหา: ${uid});
          updateUserState(uid, { lastActive: Date.now() });
        } catch (err) {
          console.error(CRM Error (${period.days} วัน):, err);
        }
      }
    }
  }, 6 * 60 * 60 * 1000);
}
module.exports = { initCRM, handleCustomerFlow };
}
