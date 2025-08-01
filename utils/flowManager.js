// utils/flowManager.js
import { sendTelegramAlert, sendTelegramPhoto, getLineProfile } from "../services/telegramService.js";
import { getLineImage } from "../services/lineMediaService.js";
import { getCuteDynamicReply, getRandomCuteName } from "./cuteReplies.js";
import { setUserState, getUserState, resetUserState } from "./stateManager.js";

// สุ่มข้อความตอบกลับพร้อมโปรโมท + ชื่อแอดมินน่ารัก
function createCuteReply(baseText) {
  const cuteNames = ["น้องฟาง", "น้องพิม", "น้องแพม", "น้องน้ำ", "น้องจิ๊บ"];
  const name = cuteNames[Math.floor(Math.random() * cuteNames.length)];
  const promo = `✨ เว็บ PGTHAI289 มั่นคงปลอดภัย ฝากถอนออโต้ เล่นง่ายได้เงินจริงค่ะ 💕 ฝากบอกเพื่อนด้วยนะคะ!`;

  return `${name} ${baseText} ${promo}`;
}

async function notifyAdmin(event, message) {
  try {
    const profile = await getLineProfile(event.source?.userId);
    const displayName = profile?.displayName || event.source?.userId || "ไม่ทราบชื่อ";
    const oaName = process.env.LINE_OA_NAME || "ไม่ทราบ OA";

    let text =
      `📢 <b>แจ้งเตือนจาก LINE OA:</b> ${oaName}\n` +
      `👤 <b>ลูกค้า:</b> ${displayName}\n` +
      `💬 <b>ข้อความ:</b> ${message}`;

    await sendTelegramAlert(text);

    // ถ้ามีรูปส่งรูป
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

function maskPhone(phone) {
  if (phone.length < 10) return phone;
  return phone.slice(0, 2) + "xxxx" + phone.slice(-4);
}

// ฟังก์ชันสุ่มรีวิวยอดถอน 10 รายการ
function generateWithdrawReviews() {
  let reviews = [];
  for (let i = 0; i < 10; i++) {
    const phone = `08${Math.floor(1000000 + Math.random() * 9000000)}`;
    const maskedPhone = maskPhone(phone);
    const amount = (Math.floor(Math.random() * 45000) + 5000).toLocaleString();
    const hour = String(Math.floor(Math.random() * 24)).padStart(2, "0");
    const minute = String(Math.floor(Math.random() * 60)).padStart(2, "0");
    reviews.push(`ยูส ${maskedPhone} ถอน ${amount} เวลา ${hour}:${minute}`);
  }
  return `📊 รีวิวการถอน 30 นาทีที่ผ่านมา\n\n` + reviews.join("\n");
}

// ฟังก์ชันสุ่มยอดถอนสูงสุดประจำวัน
function generateTopWithdraw() {
  const phone = `08${Math.floor(1000000 + Math.random() * 9000000)}`;
  const maskedPhone = maskPhone(phone);
  const amount = (Math.floor(Math.random() * 450000) + 50000).toLocaleString();
  const today = new Date().toLocaleDateString("th-TH");
  return `👑 ยูส ${maskedPhone} ถอนสูงสุดวันนี้ ${amount} บาท วันที่ ${today}`;
}

// ฟังก์ชันสุ่มข้อมูลเกมสล็อตแตกหนัก
function generateTopGames() {
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
  ];
  let text = `🎲 เกมสล็อตแตกหนักที่สุดวันนี้\n\n`;
  games.forEach((game) => {
    const freeSpin = (Math.floor(Math.random() * 180000) + 20000).toLocaleString();
    const normalSpin = (Math.floor(Math.random() * 47000) + 3000).toLocaleString();
    const percent = Math.floor(Math.random() * 20) + 80;
    text += `${game} อัตราการแตก ${percent}%\nฟรีสปินแตกล่าสุด ${freeSpin} บาท\nลูกค้าปั่นธรรมดาแตกล่าสุด ${normalSpin} บาท\n\n`;
  });
  return text;
}

// ฟังก์ชันสุ่มค่าคอมมิชชั่นแนะนำเพื่อน 10 รายการ
function generateReferralCommissions() {
  let commissions = [];
  for (let i = 0; i < 10; i++) {
    const phone = `08${Math.floor(1000000 + Math.random() * 9000000)}`;
    const maskedPhone = maskPhone(phone);
    const amount = (Math.floor(Math.random() * 17000) + 3000).toLocaleString();
    commissions.push(`ยูส ${maskedPhone} ได้ค่าคอมมิชชั่นจากยอดเล่นเพื่อน ${amount} บาท`);
  }
  return `🤝 รายการค่าคอมมิชชั่นแนะนำเพื่อนวันนี้\n\n` + commissions.join("\n");
}

export async function handleCustomerFlow(event) {
  const replyMessages = [];
  const userId = event.source?.userId;
  const userState = getUserState(userId);
  const userText = event.message?.text?.trim() || "";

  // ถ้าแอดมินพิมพ์ปลดล็อคสถานะลูกค้า
  if (
    event.type === "message" &&
    event.message.type === "text" &&
    userText.includes("ดำเนินการให้เรียบร้อยแล้วนะคะพี่")
  ) {
    resetUserState(userId);
    return createCuteReply("น้องได้รับคำสั่งแล้วนะคะ พี่สบายใจได้เลยค่ะ 💕");
  }

  // ถ้าลูกค้ากำลังรอแอดมิน ไม่ตอบอะไรเพิ่ม
  if (userState.status === "waiting") {
    return createCuteReply("น้องกำลังดำเนินการให้พี่อยู่ค่ะ ขอให้ใจเย็น ๆ นะคะ 💕");
  }

  // กรณีเพิ่มเพื่อน
  if (event.type === "follow") {
    // ส่งข้อความต้อนรับ + Flex menu
    replyMessages.push({
      type: "text",
      text: createCuteReply(
        "ขอบคุณที่เพิ่มเพื่อนกับเราเลยนะคะ 🎉 เว็บ PGTHAI289 มั่นคง ปลอดภัย ฝาก-ถอนออโต้ อย่าลืมชวนเพื่อนมาเล่นด้วยกันนะคะ"
      ),
    });
    replyMessages.push(createFlexMenu());

    await notifyAdmin(event, "ลูกค้าเพิ่มเพื่อนใหม่");
    return replyMessages;
  }

  // กรณีลูกค้ากดปุ่มใน Flex
  if (event.type === "postback" && event.postback?.data) {
    const data = event.postback.data;

    // ประเภทคำสั่ง postback ที่บรีฟไว้
    switch (data) {
      case "register_admin":
        replyMessages.push({
          type: "text",
          text: createCuteReply("รบกวนพิมพ์ชื่อ-นามสกุล เบอร์โทร บัญชีหรือวอเลท และไอดีไลน์ด้วยนะคะ"),
        });
        setUserState(userId, "collectingData", { issue: "register_admin" });
        await notifyAdmin(event, "ลูกค้าขอให้แอดมินสมัครให้");
        break;

      case "login_backup":
        replyMessages.push({
          type: "text",
          text: createCuteReply("รบกวนแจ้งชื่อ+เบอร์โทรที่สมัครไว้นะคะ เดี๋ยวน้องจะตรวจสอบให้เลยค่า"),
        });
        setUserState(userId, "collectingData", { issue: "login_backup" });
        await notifyAdmin(event, "ลูกค้าขอทางเข้าเล่นสำรอง");
        break;

      case "issue_deposit":
        replyMessages.push({
          type: "text",
          text: createCuteReply("พี่รบกวนแจ้งชื่อ+เบอร์โทร และส่งรูปสลิปด้วยนะคะ เดี๋ยวน้องจะรีบดูแลให้เลยค่า"),
        });
        setUserState(userId, "collectingData", { issue: "issue_deposit" });
        await notifyAdmin(event, "ลูกค้าแจ้งปัญหาฝากเงิน");
        break;

      case "issue_withdraw":
        replyMessages.push({
          type: "text",
          text: createCuteReply("ยอดถอนกำลังดำเนินการผ่านระบบบริษัทนะคะ รอสักครู่ภายใน 3-5 นาทีค่า"),
        });
        await notifyAdmin(event, "ลูกค้าแจ้งปัญหาถอนเงิน");
        break;

      case "forgot_password":
        replyMessages.push({
          type: "text",
          text: createCuteReply("รบกวนแจ้งชื่อ+เบอร์โทรที่สมัครไว้นะคะ เดี๋ยวน้องจะรีบช่วยทำรายการให้ค่า"),
        });
        setUserState(userId, "collectingData", { issue: "forgot_password" });
        await notifyAdmin(event, "ลูกค้าขอลืมรหัสผ่าน");
        break;

      case "login_issue":
        replyMessages.push({
          type: "text",
          text: createCuteReply("รบกวนแจ้งชื่อ + เบอร์โทร และส่งรูปปัญหาด้วยนะคะ เดี๋ยวน้องจะรีบดำเนินการให้เลยค่ะ"),
        });
        setUserState(userId, "collectingData", { issue: "login_issue" });
        await notifyAdmin(event, "ลูกค้าแจ้งเข้าเล่นไม่ได้");
        break;

      case "promo_info":
        replyMessages.push({
          type: "text",
          text: createCuteReply(
            "ตอนนี้เว็บเรามีโปรสมัครใหม่ ฝากแรกของวัน และโปรคืนยอดเสียทุกวันเลยค่ะ สนใจโปรไหนบอกน้องได้เลยนะคะ"
          ),
        });
        await notifyAdmin(event, "ลูกค้าสอบถามโปรโมชั่น");
        break;

      case "review_withdraw":
        replyMessages.push({
          type: "text",
          text: generateWithdrawReviews(),
        });
        await notifyAdmin(event, "ลูกค้าดูรีวิวยอดถอน 30 นาทีที่ผ่านมา");
        break;

      case "top_withdraw":
        replyMessages.push({
          type: "text",
          text: generateTopWithdraw(),
        });
        await notifyAdmin(event, "ลูกค้าดูยอดถอนสูงสุดวันนี้");
        break;

      case "top_games":
        replyMessages.push({
          type: "text",
          text: generateTopGames(),
        });
        await notifyAdmin(event, "ลูกค้าดูเกมสล็อตแตกหนักวันนี้");
        break;

      case "referral_commissions":
        replyMessages.push({
          type: "text",
          text: generateReferralCommissions(),
        });
        await notifyAdmin(event, "ลูกค้าดูค่าคอมมิชชั่นแนะนำเพื่อน");
        break;

      default:
        replyMessages.push({
          type: "text",
          text: createCuteReply("น้องจะรีบดูแลให้เลยนะคะ"),
        });
        break;
    }
    return replyMessages;
  }

  // กรณีลูกค้ากำลังพิมพ์ข้อมูลเพิ่มเติมในสเต็ปที่กำหนด (collectingData)
  if (event.type === "message" && event.message.type === "text") {
    if (userState.status === "collectingData") {
      // บันทึกข้อมูลลูกค้า (ในที่นี้จะเก็บไว้ในสถานะ)
      const issueType = userState.issue || "unknown";
      const customerInfo = userText;

      // แจ้งเตือนข้อมูลลูกค้า
      await notifyAdmin(event, `[${issueType}] ข้อมูลลูกค้า: ${customerInfo}`);

      // เปลี่ยนสถานะเป็น waiting (รอแอดมิน)
      setUserState(userId, "waiting", { issue: issueType });

      // แจ้งลูกค้าว่ากำลังดำเนินการให้
      return [createCuteReply("น้องได้รับข้อมูลเรียบร้อยแล้ว กำลังดำเนินการให้นะคะ พี่ใจเย็นๆ รอแป๊บนะคะ")];
    }

    // กรณีลูกค้าส่งข้อความธรรมดา
    return [createCuteReply("น้องกำลังดูแลให้พี่อยู่นะคะ ฝากบอกเพื่อนมาร่วมสนุกด้วยกันด้วยนะคะ เว็บเรามั่นคงสุดๆ เลยค่า")];
  }

  return [];
}
