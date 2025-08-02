// utils/flowManager.js
import { getCuteDynamicReply } from "../services/gptService.js";
import { sendTelegramAlert, sendTelegramPhoto, getLineProfile } from "../services/telegramService.js";
import { getLineImage } from "../services/lineMediaService.js";

// เก็บสถานะผู้ใช้ในหน่วยความจำชั่วคราว (เปลี่ยนเป็น DB ได้ในอนาคต)
const userStates = {};
const userPausedStates = {}; // สถานะ pause bot ต่อ user
const flexCooldown = 2 * 60 * 60 * 1000; // 2 ชั่วโมง

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

// ฟังก์ชันสุ่มเบอร์โทรแบบ 08xxxx1234
function randomMaskedPhone() {
  const prefix = "08";
  const suffix = Math.floor(1000 + Math.random() * 9000); // 4 หลักท้าย
  return `${prefix}xxxx${suffix}`;
}

// ฟังก์ชันสุ่มเวลาย้อนหลังไม่เกิน 30 นาทีในรูปแบบ HH:mm
function randomTimeWithinLast30Min() {
  const now = new Date();
  const pastTime = new Date(now.getTime() - Math.floor(Math.random() * 30 * 60000)); // ย้อนหลัง 0-30 นาที
  const hh = String(pastTime.getHours()).padStart(2, "0");
  const mm = String(pastTime.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// ฟังก์ชันส่งแจ้งเตือนแอดมินครบฟีลลิ่ง
async function notifyAdmin(event, message) {
  try {
    const profile = await getLineProfile(event.source?.userId);
    const displayName = profile?.displayName || event.source?.userId || "ไม่ทราบชื่อ";
    const oaName = process.env.LINE_OA_NAME || "ไม่ทราบ OA";

    let text = `📢 <b>แจ้งเตือนจาก LINE OA:</b> ${oaName}\n👤 <b>ลูกค้า:</b> ${displayName}\n💬 <b>ข้อความ:</b> ${message}`;
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

// ฟังก์ชันตรวจสอบว่า flex ควรถูกส่งไหม (2 ชั่วโมงครั้ง)
function shouldSendFlex(userId) {
  const state = getUserState(userId);
  const now = Date.now();
  return now - state.lastFlexSent > flexCooldown;
}

// ตัวแปรเก็บยอดถอนสูงสุดและวัน (คงที่ทั้งวัน)
let cachedMaxWithdrawDate = null;
let cachedMaxWithdrawAmount = null;

// ฟังก์ชันสร้างข้อความรีวิวยอดถอนแบบสุ่ม
async function generateWithdrawReviewMessage() {
  const reviews = [];
  for (let i = 0; i < 10; i++) {
    const phone = randomMaskedPhone();
    const amount = (Math.floor(Math.random() * (50000 - 5000)) + 5000).toLocaleString();
    const time = randomTimeWithinLast30Min();

    reviews.push(`ยูส ${phone} ถอน ${amount} เวลา ${time}`);
  }
  return `📊 รีวิวการถอน 30 นาทีที่ผ่านมา\n\n${reviews.join("\n")}`;
}

// ฟังก์ชันสร้างข้อความยอดถอนสูงสุดประจำวันแบบคงที่ทั้งวัน
async function generateMaxWithdrawMessage() {
  const today = new Date().toLocaleDateString("th-TH");
  if (cachedMaxWithdrawDate !== today) {
    cachedMaxWithdrawDate = today;
    cachedMaxWithdrawAmount = Math.floor(Math.random() * (500000 - 300000)) + 300000;
  }
  const phone = randomMaskedPhone();
  return `👑 ยอดถอนสูงสุดวันนี้\n\nยินดีกับคุณพี่ "สมชาย" ยูส ${phone} ถอน ${cachedMaxWithdrawAmount.toLocaleString()} บาท\nวันที่ ${cachedMaxWithdrawDate}`;
}

// ฟังก์ชันสร้างข้อความเกมแตกบ่อย พร้อม % การแตก และยอดฟรีสปิน/ยอดแตกธรรมดา
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
    "Jack the Giant Hunter • แจ็กผู้ฆ่ายัก",
  ];

  // สุ่มเกม 5 เกมที่แตกบ่อย
  const shuffled = games.sort(() => 0.5 - Math.random());
  const selectedGames = shuffled.slice(0, 5);

  // สุ่ม % การแตก 50-99%
  const randomPercent = () => Math.floor(Math.random() * 50) + 50;

  // สุ่มยอดฟรีสปิน 20,000 - 200,000
  const freeSpinAmount = Math.floor(Math.random() * (200000 - 20000)) + 20000;

  // สุ่มยอดแตกธรรมดา 3,000 - 50,000
  const normalAmount = Math.floor(Math.random() * (50000 - 3000)) + 3000;

  let message = `🎲 เกมสล็อตแตกบ่อยวันนี้\n\n`;
  selectedGames.forEach((game, idx) => {
    message += `${idx + 1}. ${game} - ${randomPercent()}%\n`;
  });
  message += `\n💥 ลูกค้าฟรีสปินแตกล่าสุด: ${freeSpinAmount.toLocaleString()} บาท\n`;
  message += `💥 ลูกค้าปั่นธรรมดาแตกล่าสุด: ${normalAmount.toLocaleString()} บาท\n`;
  message += `เล่นง่าย แตกบ่อย จ่ายจริง 💕`;
  return message;
}

// ฟังก์ชันสร้างข้อความค่าคอมมิชชั่นแนะนำเพื่อน (10 รายการ)
async function generateReferralCommissionMessage() {
  const lines = [];
  for (let i = 0; i < 10; i++) {
    const phone = randomMaskedPhone();
    const amount = (Math.floor(Math.random() * (100000 - 3000)) + 3000).toLocaleString();
    lines.push(`ยูส ${phone} ได้ค่าคอมมิชชั่นจากยอดเล่นเพื่อน ${amount}`);
  }
  return `🤝 ค่าคอมมิชชั่นแนะนำเพื่อน\n\n${lines.join("\n")}\n\nชวนมาสร้างรายได้ด้วยกันง่ายๆ สอบถามได้ที่แอดมินค่ะ 💕`;
}

// main flow
export async function handleCustomerFlow(event) {
  const userId = event.source?.userId;
  const state = getUserState(userId);
  const replyMessages = [];
  const userText = event.message?.text?.trim() || "";

  // เช็คสถานะ pause bot ถ้าหยุดไว้ ให้รอแอดมินปลดล็อก
  if (userPausedStates[userId]) {
    if (userText.includes("ดำเนินการให้เรียบร้อยแล้วนะคะพี่")) {
      userPausedStates[userId] = false;
      replyMessages.push({ type: "text", text: "น้องกลับมาดูแลพี่แล้วค่ะ ขอบคุณมากนะคะ 💕" });
      updateUserState(userId, { currentCase: null, caseData: {} });
      return replyMessages;
    } else {
      replyMessages.push({ type: "text", text: "ตอนนี้น้องต้องรอแอดมินช่วยดูแลนะคะ รบกวนรอสักครู่นะคะ 💕" });
      return replyMessages;
    }
  }

  // กรณีเพิ่มเพื่อน
  if (event.type === "follow") {
    const welcomeText = await getCuteDynamicReply(
      "ขอบคุณมากๆนะคะที่เพิ่มเพื่อนกับเรา 🎉 เว็บ PGTHAI289 มั่นคง ปลอดภัย ฝากถอนออโต้ เล่นง่ายได้เงินจริงค่ะ 💕 อย่าลืมชวนเพื่อนมาร่วมสนุกกับเราด้วยนะคะ!"
    );

    replyMessages.push({ type: "text", text: welcomeText });
    replyMessages.push({ type: "flex", altText: "🎀 เมนูพิเศษสำหรับคุณ 🎀", contents: createFlexMenuContents() });

    await notifyAdmin(event, "ลูกค้าเพิ่มเพื่อนใหม่");
    updateUserState(userId, { lastFlexSent: Date.now() });
    return replyMessages;
  }

  // ถ้าเคสยังไม่จบ ให้คุม flow ตามเคสเดิม
  if (state.currentCase) {
    switch (state.currentCase) {
      case "register_admin":
        if (!state.caseData.receivedInfo) {
          if (userText.length > 5) {
            await notifyAdmin(event, `ลูกค้าส่งข้อมูลสมัคร: ${userText}`);
            replyMessages.push({ type: "text", text: "ได้รับข้อมูลแล้วค่ะ กำลังดำเนินการให้คุณพี่นะคะ 💕" });
            updateUserState(userId, { currentCase: null, caseData: {} });
          } else {
            replyMessages.push({ type: "text", text: "รบกวนพิมพ์ชื่อ-นามสกุล เบอร์โทร บัญชีหรือวอเลท และไอดีไลน์ด้วยนะคะ 💕" });
          }
          return replyMessages;
        }
        break;

      case "login_backup":
        // ดึงข้อมูลและตอบตามเคส...
        break;

      case "issue_deposit":
        if (!state.caseData.receivedInfo) {
          if (userText.length > 5) {
            await notifyAdmin(event, `ลูกค้าส่งข้อมูลฝากเงิน: ${userText}`);
            replyMessages.push({ type: "text", text: "ได้รับข้อมูลแล้วค่ะ รบกวนส่งรูปสลิปมาด้วยนะคะ 💕" });
            updateUserState(userId, { caseData: { receivedInfo: true } });
          } else {
            replyMessages.push({ type: "text", text: "รบกวนแจ้งชื่อ+เบอร์โทร และส่งรูปสลิปด้วยนะคะ 💕" });
          }
          return replyMessages;
        } else if (!state.caseData.receivedSlip) {
          if (event.message?.type === "image") {
            await notifyAdmin(event, "ลูกค้าส่งรูปสลิปฝากเงิน");
            replyMessages.push({ type: "text", text: "ได้รับรูปสลิปแล้วค่ะ กำลังดำเนินการให้นะคะ 💕" });
            updateUserState(userId, { currentCase: null, caseData: {} });
          } else {
            replyMessages.push({ type: "text", text: "รบกวนส่งรูปสลิปฝากเงินด้วยนะคะ 💕" });
          }
          return replyMessages;
        }
        break;

      // เพิ่มเคสอื่นๆ แบบเดียวกัน...

      default:
        updateUserState(userId, { currentCase: null, caseData: {} });
        replyMessages.push({ type: "text", text: "น้องขอโทษนะคะ ไม่เข้าใจคำขอของพี่ รบกวนบอกใหม่ได้ไหมคะ 💕" });
        return replyMessages;
    }
  }

  // ถ้าเคสว่างเปล่า → ตรวจสอบคำสั่งจากข้อความหรือ postback แล้วกำหนดเคสใหม่หรือโต้ตอบทันที
  if (event.type === "postback" && event.postback?.data) {
    const data = event.postback.data;

    // กำหนดเคสตามปุ่มที่กด
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
      close_case: "close_case", // เคสปิดเคส
    };

    if (caseMap[data]) {
      updateUserState(userId, { currentCase: caseMap[data], caseData: {} });

      // หากเป็นปิดเคส แจ้งแอดมินว่าใช้เวลากี่นาที
      if (data === "close_case") {
        const caseStart = state.caseData.startTime || Date.now();
        const durationMs = Date.now() - caseStart;
        const durationMin = Math.round(durationMs / 60000);
        await sendTelegramAlert(`✅ แอดมินปิดเคสลูกค้าใช้เวลา ${durationMin} นาที`);
        updateUserState(userId, { currentCase: null, caseData: {} });
        return [{ type: "text", text: `ขอบคุณค่ะ เคสถูกปิดเรียบร้อย ใช้เวลาประมาณ ${durationMin} นาที` }];
      }
    }

    // ส่งข้อความเริ่มต้นเคสและโปรโมทเว็บด้วย GPT
    let startMsgBase = "";
    switch (data) {
      case "register_admin":
        startMsgBase = "รบกวนพิมพ์ชื่อ-นามสกุล เบอร์โทร บัญชีหรือวอเลท และไอดีไลน์ด้วยนะคะ 💕";
        break;
      case "login_backup":
        startMsgBase = "รบกวนแจ้งชื่อ+เบอร์โทรที่สมัครไว้นะคะ เดี๋ยวน้องจะตรวจสอบให้เลยค่า 💕";
        break;
      case "issue_deposit":
        startMsgBase = "พี่รบกวนแจ้งชื่อ+เบอร์โทร และส่งรูปสลิปด้วยนะคะ เดี๋ยวน้องจะรีบดูแลให้เลยค่า 💕";
        break;
      case "issue_withdraw":
        startMsgBase = "ยอดถอนกำลังดำเนินการผ่านระบบบริษัทนะคะ รอสักครู่ภายใน 3-5 นาทีค่า 💕";
        break;
      case "forgot_password":
        startMsgBase = "รบกวนแจ้งชื่อ+เบอร์โทรที่สมัครไว้นะคะ เดี๋ยวน้องจะรีบช่วยทำรายการให้ค่า 💕";
        break;
      case "promo_info":
        startMsgBase = "ตอนนี้เว็บเรามีโปรสมัครใหม่ ฝากแรกของวัน และโปรคืนยอดเสียทุกวันเลยค่ะ 💕 สนใจโปรไหนบอกน้องได้เลยนะคะ";
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
      default:
        startMsgBase = "เดี๋ยวน้องจะรีบดูแลให้เลยนะคะ 💕";
        break;
    }

    replyMessages.push({ type: "text", text: await getCuteDynamicReply(startMsgBase) });
    return replyMessages;
  }

  // กรณีข้อความธรรมดา เปิด flex ถ้าระยะเวลาเกิน 2 ชม. หรือยังไม่เคยส่ง
  if (event.type === "message") {
    if (shouldSendFlex(userId)) {
      replyMessages.push({ type: "flex", altText: "🎀 เมนูพิเศษสำหรับคุณ 🎀", contents: createFlexMenuContents() });
      updateUserState(userId, { lastFlexSent: Date.now() });
    }

    // GPT ตอบแบบน่ารัก อ้อนชวนลูกค้า
    let gptReply = "";
    try {
      gptReply = await getCuteDynamicReply(
        `ตอบแบบน่ารัก อ้อนๆ ชวนเล่นเว็บ pgthai289 หากลูกค้าพูดเรื่องอื่น เช่น หิว ให้แนะนำเมนูกะเพราไก่ พร้อมบอกว่าถ้าเล่นเว็บจะมีเงินกินข้าวแบบสบาย ๆ: "${userText}"`
      );

      // ตรวจสอบคำตอบ GPT ว่ามีคำที่บ่งชี้ว่าไม่เข้าใจหรือสับสนไหม
      const confusionKeywords = ["ไม่เข้าใจ", "ขอโทษ", "ช่วยอะไรไม่ได้", "ไม่สามารถ", "งง", "ไม่รู้"];
      const lowerReply = gptReply.toLowerCase();
      const isConfused = confusionKeywords.some((kw) => lowerReply.includes(kw));

      if (isConfused) {
        await sendTelegramAlert(`⚠️ ระบบ GPT สับสนหรือไม่เข้าใจลูกค้า (userId: ${userId}): "${userText}"`);
        userPausedStates[userId] = true; // หยุดบอท
        return [{ type: "text", text: "น้องยังไม่เข้าใจคำขอ รบกวนรอแอดมินช่วยดูแลนะคะ 💕" }];
      }
    } catch (error) {
      console.error("GPT Reply error:", error);
      gptReply = "น้องขอโทษค่ะ เกิดข้อผิดพลาดในการตอบกลับ รบกวนรอสักครู่ค่ะ 💕";
    }

    replyMessages.push({ type: "text", text: gptReply });
    await notifyAdmin(event, userText || "ลูกค้าส่งข้อความ/รูป");
    return replyMessages;
  }

  return [];
}

// ตัวอย่างฟังก์ชันสร้าง flex menu แบบง่าย (เรียกจากที่อื่น)
function createFlexMenuContents() {
  return {
    type: "carousel",
    contents: [
      // card 1
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
            { type: "text", text: "💎 สมัคร + Login", weight: "bold", size: "lg", color: "#8E44AD" },
            { type: "text", text: "🎀 สมัครง่าย ๆ เพียงกดปุ่มด้านล่าง มั่นคง 💯 จ่ายจริง 💵", size: "sm", color: "#4A235A", margin: "sm" },
          ],
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            { type: "button", style: "primary", color: "#8E44AD", height: "sm", action: { type: "uri", label: "✨ สมัครเอง", uri: "https://pgthai289.net/customer/register/LINEBOT/?openExternalBrowser=1" } },
            { type: "button", style: "primary", color: "#8E44AD", height: "sm", action: { type: "postback", label: "🤍 ให้แอดมินสมัครให้", data: "register_admin" } },
            { type: "button", style: "primary", color: "#8E44AD", height: "sm", action: { type: "uri", label: "🎰 ทางเข้าเล่นหลัก", uri: "https://pgthai289.net/?openExternalBrowser=1" } },
            { type: "button", style: "primary", color: "#8E44AD", height: "sm", action: { type: "postback", label: "🛡 ทางเข้าเล่นสำรอง", data: "login_backup" } },
          ],
        },
        styles: { footer: { separator: true } },
      },
      // card 2
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
            { type: "text", text: "หากพบปัญหาฝาก ถอน หรือเข้าเล่นไม่ได้ กดปุ่มที่ต้องการแจ้งได้เลยนะคะ 💬", size: "sm", color: "#4A235A", margin: "sm" },
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
            { type: "button", style: "primary", color: "#8E44AD", height: "sm", action: { type: "postback", label: "🎁 โปรโมชั่น/กิจกรรม", data: "promo_info" } },
          ],
        },
        styles: { footer: { separator: true } },
      },
      // card 3
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
            { type: "text", text: "ดูรีวิวยอดถอนล่าสุด และเกมที่แตกหนักที่สุดวันนี้ 🔥 มั่นใจทุกยอดถอน 💎", size: "sm", color: "#4A235A", margin: "sm" },
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
            { type: "button", style: "primary", color: "#8E44AD", height: "sm", action: { type: "postback", label: "✅ ปิดเคส", data: "close_case" } },
          ],
        },
        styles: { footer: { separator: true } },
      },
    ],
  };
}
