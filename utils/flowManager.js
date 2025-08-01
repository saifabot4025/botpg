import { getCuteDynamicReply } from "./cuteReplies.js";
import { createFlexMenu } from "./flexMenu.js";
import { sendTelegramAlert, sendTelegramPhoto, getLineProfile } from "../services/telegramService.js";
import { getLineImage } from "../services/lineMediaService.js";

// ✅ ฟังก์ชันแจ้งเตือนแอดมิน + ส่งรูปถ้ามี
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

// ✅ ใช้ GPT ช่วยทำให้คำตอบน่ารักและโปรโมทเว็บ
async function gptEnhancedReply(baseText) {
  const promoTemplates = [
    "เว็บ PGTHAI289 ของเรามั่นคง ปลอดภัยสุดๆ 💎 ฝากถอนออโต้ไวมาก ลองเลยนะคะ",
    "เล่นกับ PGTHAI289 รับรองฟินแน่นอน 🎰 แตกง่าย จ่ายจริง อย่าลืมชวนเพื่อนมาด้วยนะคะ",
    "PGTHAI289 เว็บอันดับ 1 ที่ใครๆ ก็เลือก 💕 สมัครง่าย ได้จริง ไม่มีโกงเลยค่า",
    "พี่ลองฝากกับ PGTHAI289 สิคะ 💖 ระบบออโต้ทันใจ แถมโปรโมชั่นดีๆ เพียบเลยค่า",
  ];
  const promoText = promoTemplates[Math.floor(Math.random() * promoTemplates.length)];

  return getCuteDynamicReply(`${baseText} 🌟 ${promoText}`);
}

export async function handleCustomerFlow(event) {
  const replyMessages = [];
  const userText = event.message?.text || "";

  // 🟢 เพิ่มเพื่อน
  if (event.type === "follow") {
    const welcomeMsg = await gptEnhancedReply(
      "ขอบคุณที่เพิ่มเพื่อนกับเราเลยนะคะ 🎉 ยินดีต้อนรับครอบครัว PGTHAI289 ค่า"
    );
    replyMessages.push({ type: "text", text: welcomeMsg });
    replyMessages.push(createFlexMenu());
    await notifyAdmin(event, "ลูกค้าเพิ่มเพื่อนใหม่");
    return replyMessages;
  }

  // 🟢 กดปุ่มใน Flex
  if (event.type === "postback" && event.postback?.data) {
    const data = event.postback.data;
    await notifyAdmin(event, `กดปุ่ม: ${data}`);

    const replies = {
      register_admin: "รบกวนพิมพ์ชื่อ-นามสกุล เบอร์โทร บัญชีหรือวอเลท และไอดีไลน์ด้วยนะคะ เดี๋ยวน้องจะดูแลให้เองค่า 💕",
      login_backup: "พี่รบกวนแจ้งชื่อ+เบอร์โทรที่สมัครไว้นะคะ เดี๋ยวน้องจะตรวจสอบให้ทันทีเลยค่า 💕",
      issue_deposit: "ขอชื่อ+เบอร์โทรพร้อมแนบสลิปด้วยนะคะ น้องจะรีบช่วยดำเนินการให้เลยค่า 💕",
      issue_withdraw: "ยอดถอนกำลังดำเนินการผ่านระบบบริษัทนะคะ รอสักครู่ภายใน 3-5 นาทีค่า 💕",
      forgot_password: "รบกวนแจ้งชื่อ+เบอร์โทรที่สมัครไว้นะคะ น้องจะรีบช่วยตั้งรหัสให้เลยค่า 💕",
      promo_info: "ตอนนี้เว็บเรามีโปรสมัครใหม่ ฝากแรกของวัน และโปรคืนยอดเสียทุกวันเลยค่า สนใจโปรไหนบอกน้องได้เลยนะคะ 💕",
    };

    const replyText = replies[data] || "เดี๋ยวน้องจะรีบดูแลให้เลยนะคะ 💕";
    replyMessages.push({
      type: "text",
      text: await gptEnhancedReply(replyText),
    });

    return replyMessages;
  }

  // 🟢 ลูกค้าส่งข้อความ
  if (event.type === "message") {
    await notifyAdmin(event, userText || "ลูกค้าส่งข้อความ/รูป");

    const replyText = await gptEnhancedReply(
      "น้องกำลังดูแลให้พี่อยู่นะคะ ฝากบอกเพื่อนมาร่วมสนุกกับเว็บเราได้เลยค่า 💕"
    );

    replyMessages.push({ type: "text", text: replyText });
    replyMessages.push(createFlexMenu());
    return replyMessages;
  }

  return [];
}
