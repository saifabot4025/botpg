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
    await sendTelegramAlert(`📢 แจ้งเตือนจาก ${oa}\n👤 ลูกค้า: ${name}\n💬 ข้อความ: ${msg}`);
    if (event.message?.type === "image") {
      const photo = await getLineImage(event.message.id);
      if (photo) await sendTelegramPhoto(photo, `📷 รูปจากลูกค้า (${name})`);
    }
  } catch (err) { console.error("notifyAdmin error:", err); }
}

/* ================== MESSAGE GENERATORS ================== */
async function generateWithdrawReviewMessage() {
  const reviews = [];
  for (let i=0;i<10;i++){
    const phone = randomMaskedPhone();
    const amt = (Math.floor(Math.random()*45000)+5000).toLocaleString();
    reviews.push(`ยูส ${phone} ถอน ${amt}`);
  }
  return `📊 รีวิวการถอนล่าสุด\n\n${reviews.join("\n")}\n\nเว็บมั่นคง ปลอดภัย จ่ายจริง 💕`;
}

async function generateMaxWithdrawMessage() {
  const today = new Date().toLocaleDateString("th-TH");
  if (!global.cachedDate || global.cachedDate !== today) {
    global.cachedDate = today;
    global.cachedName = await getRandomName();
    global.cachedAmt = Math.floor(Math.random()*200000)+300000;
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
  const selected = games.sort(()=>0.5-Math.random()).slice(0,5);
  const freeSpin = Math.floor(Math.random()*(500000-50000))+50000;
  const normal = Math.floor(Math.random()*(50000-5000))+5000;
  let msg = "🎲 เกมสล็อตแตกบ่อยวันนี้\n\n";
  selected.forEach((g,i)=>msg += `${i+1}. ${g} - ${Math.floor(Math.random()*20)+80}%\n`);
  msg += `\n💥 ฟรีสปินแตกล่าสุด: ${freeSpin.toLocaleString()} บาท\n💥 ปั่นธรรมดาแตกล่าสุด: ${normal.toLocaleString()} บาท\nเล่นเลย แตกง่าย จ่ายจริง 💕`;
  return msg;
}

async function generateReferralCommissionMessage() {
  const lines=[];
  for (let i=0;i<10;i++){
    const phone = randomMaskedPhone();
    const amt=(Math.floor(Math.random()*97000)+3000).toLocaleString();
    lines.push(`ยูส ${phone} ได้ค่าคอมมิชชั่น ${amt}`);
  }
  return `🤝 ค่าคอมมิชชั่นแนะนำเพื่อน\n\n${lines.join("\n")}\n\n💡 ชวนเพื่อนมาเล่น รับค่าคอมทุกวัน!`;
}

/* ================== FLEX ================== */
function createFlexMenuContents(){
  return {
    type:"carousel",
    contents:[
      /* BOX 1 */
      {
        type:"bubble",
        hero:{type:"image",url:"https://i.ibb.co/SqbNcr1/image.jpg",size:"full",aspectRatio:"20:13",aspectMode:"cover"},
        body:{type:"box",layout:"vertical",contents:[
          {type:"text",text:"PGTHAI289",weight:"bold",size:"xl",color:"#FFD700"},
          {type:"text",text:"สมัครง่าย มั่นคง ปลอดภัย",size:"sm",color:"#FFFFFF",wrap:true}
        ]},
        footer:{type:"box",layout:"vertical",contents:[
          {type:"button",style:"primary",color:"#FFD700",action:{type:"uri",label:"⭐ สมัครเอง",uri:"https://pgthai289.net/customer/register/LINEBOT/?openExternalBrowser=1"}},
          {type:"button",style:"secondary",color:"#333333",action:{type:"postback",label:"📲 ให้แอดมินสมัครให้",data:"register_admin"}},
          {type:"button",style:"primary",color:"#FFD700",action:{type:"uri",label:"🔑 ทางเข้าเล่นหลัก",uri:"https://pgthai289.net/?openExternalBrowser=1"}},
          {type:"button",style:"secondary",color:"#333333",action:{type:"postback",label:"🚪 ทางเข้าเล่นสำรอง",data:"login_backup"}}
        ]}
      },
      /* BOX 2 */
      {
        type:"bubble",
        hero:{type:"image",url:"https://i.ibb.co/SqbNcr1/image.jpg",size:"full",aspectRatio:"20:13",aspectMode:"cover"},
        body:{type:"box",layout:"vertical",contents:[
          {type:"text",text:"PGTHAI289",weight:"bold",size:"xl",color:"#FFD700"},
          {type:"text",text:"แจ้งปัญหา & โปรโมชั่น",size:"sm",color:"#FFFFFF",wrap:true}
        ]},
        footer:{type:"box",layout:"vertical",contents:[
          {type:"button",style:"primary",color:"#FFD700",action:{type:"postback",label:"💰 ปัญหาฝาก/ถอน",data:"issue_deposit"}},
          {type:"button",style:"secondary",color:"#333333",action:{type:"postback",label:"🔑 ลืมรหัสผ่าน",data:"forgot_password"}},
          {type:"button",style:"primary",color:"#FFD700",action:{type:"postback",label:"🚪 เข้าเล่นไม่ได้",data:"login_backup"}},
          {type:"button",style:"secondary",color:"#333333",action:{type:"postback",label:"🎁 โปรโมชั่น/กิจกรรม",data:"promo_info"}}
        ]}
      },
      /* BOX 3 */
      {
        type:"bubble",
        hero:{type:"image",url:"https://i.ibb.co/SqbNcr1/image.jpg",size:"full",aspectRatio:"20:13",aspectMode:"cover"},
        body:{type:"box",layout:"vertical",contents:[
          {type:"text",text:"PGTHAI289",weight:"bold",size:"xl",color:"#FFD700"},
          {type:"text",text:"รีวิว & เกมแตก",size:"sm",color:"#FFFFFF",wrap:true}
        ]},
        footer:{type:"box",layout:"vertical",contents:[
          {type:"button",style:"primary",color:"#FFD700",action:{type:"postback",label:"⭐ รีวิวถอนล่าสุด",data:"review_withdraw"}},
          {type:"button",style:"secondary",color:"#333333",action:{type:"postback",label:"👑 ถอนสูงสุดวันนี้",data:"max_withdraw"}},
          {type:"button",style:"primary",color:"#FFD700",action:{type:"postback",label:"🎮 เกมแตกบ่อย",data:"top_game"}},
          {type:"button",style:"secondary",color:"#333333",action:{type:"postback",label:"💎 ค่าคอมแนะนำเพื่อน",data:"referral_commission"}}
        ]}
      }
    ]
  };
}

/* ================== MAIN FLOW ================== */
export async function handleCustomerFlow(event){
  const userId=event.source?.userId;
  const state=getUserState(userId);
  const reply=[];
  const text=event.message?.text?.trim()||"";

  if(userPausedStates[userId]){
    if(text.includes("ดำเนินการให้เรียบร้อยแล้วนะคะพี่")){
      userPausedStates[userId]=false;
      updateUserState(userId,{currentCase:null,caseData:{}});
      reply.push({type:"text",text:"น้องกลับมาดูแลพี่แล้วค่ะ 💕"});
    }else{
      reply.push({type:"text",text:"ขณะนี้หัวหน้าฝ่ายกำลังดำเนินการให้อยู่ค่ะ 💕"});
    }
    return reply;
  }

  if(event.type==="follow" && shouldGreet(userId)){
    reply.push({type:"text",text:`สวัสดีค่ะ น้องฟางเป็นแอดมินดูแลลูกค้าของ PGTHAI289 นะคะ 💕`});
    reply.push({type:"flex",altText:"🎀 เมนูพิเศษ",contents:createFlexMenuContents()});
    updateUserState(userId,{lastFlexSent:Date.now(),lastGreeted:Date.now()});
    await notifyAdmin(event,"ลูกค้าเพิ่มเพื่อนใหม่");
    return reply;
  }

  if(event.type==="postback" && event.postback?.data){
    const data=event.postback.data;
    reply.push({type:"text",text:`✅ คุณกดปุ่ม: ${data}`});
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
    await notifyAdmin(event,`ลูกค้ากดปุ่ม ${data}`);
    return reply;
  }

  if(state.currentCase && (text.length>3 || event.message?.type==="image")){
    reply.push({type:"text",text:"ได้รับข้อมูลแล้วค่ะ กำลังส่งให้หัวหน้าฝ่ายดำเนินการ 💕"});
    userPausedStates[userId]=true;
    await notifyAdmin(event,`ข้อมูลจากลูกค้า (เคส ${state.currentCase}): ${text||"ส่งรูป"}`);
    return reply;
  }

  if(event.type==="message" && shouldSendFlex(userId)){
    reply.push({type:"flex",altText:"🎀 เมนูพิเศษ",contents:createFlexMenuContents()});
    updateUserState(userId,{lastFlexSent:Date.now()});
  }

  try{
    const gptReply=await getCuteDynamicReply(`ลูกค้าพูดว่า: "${text}"\nตอบแบบเพื่อนคุยน่ารัก อ้อนๆ มืออาชีพ แนะนำเล่น PGTHAI289`);
    reply.push({type:"text",text:gptReply});
    await notifyAdmin(event,text||"ลูกค้าส่งข้อความ/รูป");
    return reply;
  }catch(err){
    reply.push({type:"text",text:"เกิดข้อผิดพลาด กรุณาลองใหม่ค่ะ 💕"});
    return reply;
  }
}

/* ================== CRM ================== */
export function initCRM(lineClient){
  setInterval(async()=>{
    const now=Date.now();
    const inactive=Object.keys(userStates).filter(uid=>now-(userStates[uid]?.lastActive||0)>3*24*60*60*1000);
    for(const uid of inactive){
      try{
        const follow=await getCuteDynamicReply("สร้างข้อความน่ารัก ชวนลูกค้าที่หายไป 3 วัน กลับมาเล่น PGTHAI289 แบบมืออาชีพ");
        await lineClient.pushMessage(uid,{type:"text",text:follow});
        await lineClient.pushMessage(uid,{type:"flex",altText:"🎀 กลับมาเล่นกับเรา 🎀",contents:createFlexMenuContents()});
        await sendTelegramAlert(`📢 CRM ส่งข้อความหา: ${uid}`);
        updateUserState(uid,{lastActive:Date.now()});
      }catch(err){ console.error("CRM error:",err); }
    }
  },6*60*60*1000);
}


/* ================== CRM FOLLOW-UP (3,7,15,30 วัน) ================== */
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
          console.error(`CRM Error (${period.days} วัน):`, err);
        }
      }
    }
  }, 6 * 60 * 60 * 1000);
}
