import { getCuteDynamicReply } from "./cuteReplies.js";
import { createFlexMenu } from "./flexMenu.js";
import { sendTelegramAlert, sendTelegramPhoto, getLineProfile } from "../services/telegramService.js";
import { getLineImage } from "../services/lineMediaService.js";

/**
 * แจ้งเตือน Telegram แบบครบ (ชื่อ OA, ลูกค้า, ข้อความ, รูป)
 */
async function notifyAdmin(event, message) {
  const profile = await getLineProfile(event.source.userId);
  const displayName = profile?.displayName || "ไม่ทราบชื่อ";
  const oaName = process.env.LINE_OA_NAME || "ไม่ทราบ OA";

  let text = `📢 <b>แจ้งเตือนจาก LINE OA:</b> ${oaName}\n👤 <b>ลูกค้า:</b> ${displayName}\n💬 <b>ข้อความ:</b> ${message}`;
  await sendTelegramAlert(text);

  // ✅ ถ้ามีรูปแนบ → ดึงจาก LINE API แล้วส่งเข้า Telegram
  if (event.message?.type === "image") {
    const photoUrl = await getLineImage(event.message.id);
    if (photoUrl) {
      await sendTelegramPhoto(photoUrl, `📷 รูปจาก ${displayName}`);
    }
  }
}

/**
 * Flow หลัก
 */
export async function handleCustomerFlow(event, userState) {
  const userText = event.message?.text || "";
  const replyMessages = [];

  // ✅ เพิ่มเพื่อน
  if (event.type === "follow") {
    const welcomeMsg = await getCuteDynamicReply(
      "ขอบคุณที่เพิ่มเพื่อนกับเราเลยนะคะ 🎉 เว็บ PGTHAI289 มั่นคง ปลอดภัย ฝาก-ถอนออโต้ อย่าลืมชวนเพื่อนมาเล่นด้วยกันนะคะ 💕"
    );
    replyMessages.push({ type: "text", text: welcomeMsg });
    replyMessages.push(createFlexMenu());
    await notifyAdmin(event, "ลูกค้าเพิ่มเพื่อนใหม่");
    return replyMessages;
  }

  // ✅ ลูกค้ากดปุ่มใน Flex
  if (event.type === "postback" && event.postback.data) {
    const buttonData = event.postback.data;
    await notifyAdmin(event, `กดปุ่ม: ${buttonData}`);

    switch (buttonData) {
      case "register_admin":
        replyMessages.push({
          type: "text",
          text: await getCuteDynamicReply("รบกวนพิมพ์ชื่อ-นามสกุล เบอร์โทร บัญชีหรือวอเลท และไอดีไลน์ด้วยนะคะ 💕"),
        });
        break;

      case "login_backup":
        replyMessages.push({
          type: "text",
          text: await getCuteDynamicReply("รบกวนแจ้งชื่อ+เบอร์โทรที่สมัครไว้นะคะ เดี๋ยวน้องจะตรวจสอบให้เลยค่า 💕"),
        });
        break;

      case "issue_deposit":
        replyMessages.push({
          type: "text",
          text: await getCuteDynamicReply("พี่รบกวนแจ้งชื่อ+เบอร์โทร และส่งรูปสลิปด้วยนะคะ เดี๋ยวน้องจะรีบดูแลให้เลยค่า 💕"),
        });
        break;

      case "issue_withdraw":
        replyMessages.push({
          type: "text",
          text: await getCuteDynamicReply("ยอดถอนกำลังดำเนินการผ่านระบบบริษัทนะคะ รอสักครู่ภายใน 3-5 นาทีค่า 💕"),
        });
        break;

      case "forgot_password":
        replyMessages.push({
          type: "text",
          text: await getCuteDynamicReply("รบกวนแจ้งชื่อ+เบอร์โทรที่สมัครไว้นะคะ เดี๋ยวน้องจะรีบช่วยทำรายการให้ค่า 💕"),
        });
        break;

      case "promo_info":
        replyMessages.push({
          type: "text",
          text: await getCuteDynamicReply("ตอนนี้เว็บเรามีโปรสมัครใหม่ ฝากแรกของวัน และโปรคืนยอดเสียทุกวันเลยค่ะ 💕 สนใจโปรไหนบอกน้องได้เลยนะคะ"),
        });
        break;

      default:
        replyMessages.push({
          type: "text",
          text: await getCuteDynamicReply("เดี๋ยวน้องจะรีบดูแลให้เลยนะคะ 💕"),
        });
        break;
    }
    return replyMessages;
  }

  // ✅ ถ้าลูกค้าส่งข้อความ
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
