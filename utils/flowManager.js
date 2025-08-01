// utils/flowManager.js
import { getCuteDynamicReply } from "../services/gptService.js";
import { sendTelegramAlert, sendTelegramPhoto, getLineProfile } from "../services/telegramService.js";
import { getLineImage } from "../services/lineMediaService.js";

// เก็บสถานะผู้ใช้ในหน่วยความจำชั่วคราว (เปลี่ยนเป็น DB ได้ในอนาคต)
const userStates = {};
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

// ฟังก์ชัน main สำหรับจัดการ flow ลูกค้า
export async function handleCustomerFlow(event) {
  const userId = event.source?.userId;
  const state = getUserState(userId);
  const replyMessages = [];
  const userText = event.message?.text?.trim() || "";

  // กรณีเพิ่มเพื่อน - ส่ง flex menu ทันที + ข้อความอ้อนโปรโมท
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

  // ถ้าเคสยังไม่จบ ให้คุม flow ตามเคสนั้นก่อน
  if (state.currentCase) {
    // ตัวอย่างโครงสร้างเคส แก้ไขตามเคสจริง
    switch (state.currentCase) {
      case "register_admin":
        if (!state.caseData.receivedInfo) {
          // รับข้อมูลลูกค้า
          if (userText.length > 5) {
            // สมมติข้อมูลครบ
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
        // ตัวอย่างเดียวกับ register_admin ปรับข้อความและการแจ้งเตือนได้
        break;

      case "issue_deposit":
        // รอข้อมูลและรูป
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

      // เพิ่มเคสอื่นๆแบบเดียวกัน...

      default:
        // เคสไม่รู้จัก รีเซ็ตสถานะ
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
    };

    if (caseMap[data]) {
      updateUserState(userId, { currentCase: caseMap[data], caseData: {} });
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

    // ส่งตอบด้วย GPT ช่วยอ้อนโปรโมทเว็บ
    const replyText = await getCuteDynamicReply(
      `${userText} น้องกำลังดูแลให้พี่อยู่นะคะ ฝากบอกเพื่อนมาร่วมสนุกด้วยกันด้วยนะคะ เว็บเรามั่นคงสุดๆเลยค่า ✨`
    );
    replyMessages.push({ type: "text", text: replyText });
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
          ],
        },
        styles: { footer: { separator: true } },
      },
    ],
  };
}

// ตัวอย่างฟังก์ชันสร้างข้อความรีวิวยอดถอนแบบสุ่ม
async function generateWithdrawReviewMessage() {
  const reviews = [];
  for (let i = 0; i < 10; i++) {
    const phone = `08${Math.floor(1000000 + Math.random() * 9000000)}`;
    const hiddenPhone = `${phone.slice(0, 2)}xxxx${phone.slice(-4)}`;
    const amount = (Math.floor(Math.random() * 45000) + 5000).toLocaleString();
    const hour = String(Math.floor(Math.random() * 24)).padStart(2, "0");
    const minute = String(Math.floor(Math.random() * 60)).padStart(2, "0");

    reviews.push(`ยูส ${hiddenPhone} ถอน ${amount} เวลา ${hour}:${minute}`);
  }
  return `📊 รีวิวการถอน 30 นาทีที่ผ่านมา\n\n${reviews.join("\n")}`;
}

// ตัวอย่างฟังก์ชันสร้างข้อความยอดถอนสูงสุดประจำวันแบบสุ่ม
async function generateMaxWithdrawMessage() {
  const phone = `08${Math.floor(1000000 + Math.random() * 9000000)}`;
  const hiddenPhone = `${phone.slice(0, 2)}xxxx${phone.slice(-4)}`;
  const amount = (Math.floor(Math.random() * 450000) + 50000).toLocaleString();
  const today = new Date().toLocaleDateString("th-TH");

  return `👑 ยอดถอนสูงสุดวันนี้\n\nยูส ${hiddenPhone} ถอนสูงสุด ${amount} บาท\nวันที่ ${today}`;
}

// ตัวอย่างฟังก์ชันสร้างข้อความเกมแตกบ่อย
async function generateTopGameMessage() {
  return `🎲 เกมแตกบ่อย\n\n1. สาวถ้ำ\n2. กิเลน\n3. Mahjong Ways\n4. Dragon Hatch\n5. Ninja vs Samurai\nเล่นง่าย แตกบ่อย จ่ายจริง 💕`;
}

// ตัวอย่างฟังก์ชันสร้างข้อความค่าคอมมิชชั่นแนะนำเพื่อน
async function generateReferralCommissionMessage() {
  return `🤝 ค่าคอมมิชชั่นแนะนำเพื่อน\n\nแนะนำเพื่อนมาร่วมสนุก รับค่าคอมมิชชั่น 1% จากยอดเล่นของเพื่อนทันทีค่ะ 💕\nสมัครเลยที่ https://pgthai289.net/customer/register/LINEBOT/?openExternalBrowser=1`;
}
