import { getCuteDynamicReply } from "./cuteReplies.js";
import { createFlexMenu } from "./flexMenu.js";
import { sendTelegramAlert, sendTelegramPhoto, getLineProfile } from "../services/telegramService.js";
import { getLineImage } from "../services/lineMediaService.js";

// เก็บสถานะลูกค้าที่กำลังดำเนินการ (userId)
const userProcessing = new Set();

// ฟังก์ชันสุ่มข้อความตอบแบบน่ารักสุ่มไม่ซ้ำ
function getRandomReply(name) {
  const templates = [
    `${name} น้องดูแลอย่างดีเลยค่ะ 💕 สมัครวันนี้รับโบนัสฟรีทันที! อย่าลืมชวนเพื่อนมาด้วยนะคะ 🌟`,
    `สวัสดีค่ะ ${name} น้องพร้อมช่วยทุกเรื่องเลยนะคะ 🎉 เล่นง่าย จ่ายจริง ที่นี่ที่เดียว!`,
    `น้องยินดีดูแล ${name} เต็มที่ค่ะ 💖 สมัครเลย รับโปรโมชั่นสุดคุ้มมากมาย รออยู่นะคะ!`,
    `${name} น้องดูแลคุณพี่อย่างใจจริงเลยค่ะ 🥰 มาเล่นกับเราสนุก และได้เงินจริงแน่นอน!`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

// แจ้งเตือน Telegram พร้อมรายละเอียดครบถ้วน
async function notifyAdmin(event, message) {
  try {
    const profile = await getLineProfile(event.source?.userId);
    const displayName = profile?.displayName || event.source?.userId || "ไม่ทราบชื่อ";
    const oaName = process.env.LINE_OA_NAME || "ไม่ทราบ OA";

    const text =
      `📢 <b>แจ้งเตือนจาก LINE OA:</b> ${oaName}\n` +
      `👤 <b>ลูกค้า:</b> ${displayName}\n` +
      `💬 <b>ข้อความ:</b> ${message}`;

    await sendTelegramAlert(text);

    // ถ้ามีรูปภาพ ส่งรูปไป Telegram ด้วย
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

export async function handleCustomerFlow(event) {
  const replyMessages = [];
  const userText = event.message?.text || "";
  const userId = event.source?.userId;

  if (userProcessing.has(userId)) {
    // กำลังดำเนินการอยู่ ตอบข้อความแจ้งและหยุดทำงานซ้ำ
    replyMessages.push({
      type: "text",
      text: "น้องกำลังดำเนินการให้พี่อยู่นะคะ 💕 รอแป๊บนะคะ อย่าพึ่งส่งซ้ำค่ะ",
      skipFlex: true,
    });
    return replyMessages;
  }

  // เพิ่มสถานะกำลังดำเนินการ
  userProcessing.add(userId);

  // กรณีเพิ่มเพื่อน
  if (event.type === "follow") {
    const welcomeMsg = getRandomReply("พี่");
    replyMessages.push({ type: "text", text: welcomeMsg });
    replyMessages.push(createFlexMenu());
    await notifyAdmin(event, "ลูกค้าเพิ่มเพื่อนใหม่");
    userProcessing.delete(userId);
    return replyMessages;
  }

  // กรณีกดปุ่มใน Flex
  if (event.type === "postback" && event.postback?.data) {
    const data = event.postback.data;
    await notifyAdmin(event, `กดปุ่ม: ${data}`);

    const replies = {
      register_admin:
        getRandomReply("พี่") +
        " รบกวนพิมพ์ชื่อ-นามสกุล เบอร์โทร บัญชีหรือวอเลท และไอดีไลน์ด้วยนะคะ 💕",
      login_backup:
        getRandomReply("พี่") +
        " รบกวนแจ้งชื่อ+เบอร์โทรที่สมัครไว้นะคะ เดี๋ยวน้องจะตรวจสอบให้เลยค่า 💕",
      issue_deposit:
        getRandomReply("พี่") +
        " รบกวนแจ้งชื่อ+เบอร์โทร และส่งรูปสลิปด้วยนะคะ เดี๋ยวน้องจะรีบดูแลให้เลยค่า 💕",
      issue_withdraw:
        getRandomReply("พี่") +
        " ยอดถอนกำลังดำเนินการผ่านระบบบริษัทนะคะ รอสักครู่ภายใน 3-5 นาทีค่า 💕",
      forgot_password:
        getRandomReply("พี่") +
        " รบกวนแจ้งชื่อ+เบอร์โทรที่สมัครไว้นะคะ เดี๋ยวน้องจะรีบช่วยทำรายการให้ค่า 💕",
      promo_info:
        getRandomReply("พี่") +
        " ตอนนี้เว็บเรามีโปรสมัครใหม่ ฝากแรกของวัน และโปรคืนยอดเสียทุกวันเลยค่ะ 💕 สนใจโปรไหนบอกน้องได้เลยนะคะ",
    };

    replyMessages.push({
      type: "text",
      text: replies[data] || getRandomReply("พี่"),
    });

    userProcessing.delete(userId);
    return replyMessages;
  }

  // กรณีลูกค้าส่งข้อความ
  if (event.type === "message") {
    await notifyAdmin(event, userText || "ลูกค้าส่งข้อความ/รูป");

    replyMessages.push({
      type: "text",
      text:
        getRandomReply("พี่") +
        " ฝากบอกเพื่อนมาร่วมสนุกด้วยกันด้วยนะคะ เว็บเรามั่นคงสุดๆ เลยค่า 🎉",
    });
    replyMessages.push(createFlexMenu());

    userProcessing.delete(userId);
    return replyMessages;
  }

  // default
  userProcessing.delete(userId);
  return [];
}
