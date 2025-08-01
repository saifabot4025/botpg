import { getCuteDynamicReply } from "./cuteReplies.js";
import { createFlexMenu } from "./flexMenu.js";
import { sendTelegramAlert, sendTelegramPhoto, getLineProfile } from "../services/telegramService.js";
import { getLineImage } from "../services/lineMediaService.js";

/**
 * ✅ แจ้งเตือน Telegram พร้อมรายละเอียด
 * - แจ้งชื่อ OA (มาจาก process.env.LINE_OA_NAME)
 * - แจ้งชื่อ displayName ลูกค้า (ดึงจาก LINE API)
 * - แจ้งข้อความหรือปุ่มที่กด
 * - ถ้ามีรูป → ส่งภาพไป Telegram ด้วย
 */
async function notifyAdmin(event, message) {
  try {
    const profile = await getLineProfile(event.source?.userId);
    const displayName = profile?.displayName || "ไม่ทราบชื่อ";
    const oaName = process.env.LINE_OA_NAME || "ไม่ทราบ OA";

    let text =
      `📢 <b>แจ้งเตือนจาก LINE OA:</b> ${oaName}\n` +
      `👤 <b>ลูกค้า:</b> ${displayName}\n` +
      `💬 <b>ข้อความ:</b> ${message}`;

    await sendTelegramAlert(text);

    // ✅ ถ้าลูกค้าส่งรูป → ดึงรูปจาก LINE API และส่งไป Telegram
    if (event.message?.type === "image" && event.message.id) {
      const photoUrl = await getLineImage(event.message.id);
      if (photoUrl) {
        await sendTelegramPhoto(photoUrl, `📷 รูปจากลูกค้า (${displayName})`);
      }
    }
  } catch (err) {
    console.error("❌ notifyAdmin Error:", err);
  }
}

/**
 * ✅ Flow หลัก จัดการข้อความและปุ่ม
 */
export async function handleCustomerFlow(event) {
  const userText = event.message?.text || "";
  const replyMessages = [];

  // 🟢 ลูกค้าเพิ่มเพื่อน
  if (event.type === "follow") {
    const welcomeMsg = await getCuteDynamicReply(
      "ขอบคุณที่เพิ่มเพื่อนกับเราเลยนะคะ 🎉 เว็บ PGTHAI289 มั่นคง ปลอดภัย ฝาก-ถอนออโต้ อย่าลืมชวนเพื่อนมาเล่นด้วยกันนะคะ 💕"
    );

    replyMessages.push({ type: "text", text: welcomeMsg });
    replyMessages.push(createFlexMenu());

    await notifyAdmin(event, "ลูกค้าเพิ่มเพื่อนใหม่");
    return replyMessages;
  }

  // 🟢 ลูกค้ากดปุ่มใน Flex
  if (event.type === "postback" && event.postback?.data) {
    const buttonData = event.postback.data;
    await notifyAdmin(event, `กดปุ่ม: ${buttonData}`);

    const replies = {
      register_admin: "รบกวนพิมพ์ชื่อ-นามสกุล เบอร์โทร บัญชีหรือวอเลท และไอดีไลน์ด้วยนะคะ 💕",
      login_backup: "รบกวนแจ้งชื่อ+เบอร์โทรที่สมัครไว้นะคะ เดี๋ยวน้องจะตรวจสอบให้เลยค่า 💕",
      issue_deposit: "พี่รบกวนแจ้งชื่อ+เบอร์โทร และส่งรูปสลิปด้วยนะคะ เดี๋ยวน้องจะรีบดูแลให้เลยค่า 💕",
      issue_withdraw: "ยอดถอนกำลังดำเนินการผ่านระบบบริษัทนะคะ รอสักครู่ภายใน 3-5 นาทีค่า 💕",
      forgot_password: "รบกวนแจ้งชื่อ+เบอร์โทรที่สมัครไว้นะคะ เดี๋ยวน้องจะรีบช่วยทำรายการให้ค่า 💕",
      promo_info: "ตอนนี้เว็บเรามีโปรสมัครใหม่ ฝากแรกของวัน และโปรคืนยอดเสียทุกวันเลยค่ะ 💕 สนใจโปรไหนบอกน้องได้เลยนะคะ",
    };

    const replyText = replies[buttonData] || "เดี๋ยวน้องจะรีบดูแลให้เลยนะคะ 💕";

    replyMessages.push({
      type: "text",
      text: await getCuteDynamicReply(replyText),
    });

    return replyMessages;
  }

  // 🟢 ลูกค้าส่งข้อความเอง
  if (event.type === "message") {
    await notifyAdmin(event, userText || "ลูกค้าส่งข้อความ/รูป");

    replyMessages.push({
      type: "text",
      text: await getCuteDynamicReply(
        "น้องกำลังดูแลให้พี่อยู่นะคะ 💕 ฝากบอกเพื่อนมาร่วมสนุกด้วยกันด้วยนะคะ เว็บเรามั่นคงสุดๆ เลยค่า 🎉"
      ),
    });

    replyMessages.push(createFlexMenu());
    return replyMessages;
  }

  return [];
}
