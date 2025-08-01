import { getCuteDynamicReply } from "./cuteReplies.js";
import { sendTelegramAlert } from "../services/telegramService.js";
import { createFlexMenu } from "../utils/flexMenu.js";

/**
 * จัดการ Flow การสนทนาตามประเภทปัญหาและปุ่มที่ลูกค้ากด
 */
export async function handleCustomerFlow(event, userState) {
  const userText = event.message?.text || "";
  const replyToken = event.replyToken;
  let replyMessages = [];

  // ✅ กรณีเพิ่มเพื่อน → ส่ง Flex 3 กล่อง + ข้อความต้อนรับแบบสุ่ม
  if (event.type === "follow") {
    const welcomeMsg = await getCuteDynamicReply(
      "ขอบคุณที่เพิ่มเพื่อนกับเราเลยนะคะ 🎉 เว็บ PGTHAI289 มั่นคง ปลอดภัย ฝาก-ถอนออโต้ อย่าลืมชวนเพื่อนมาเล่นด้วยกันนะคะ 💕"
    );
    replyMessages.push({ type: "text", text: welcomeMsg });
    replyMessages.push(createFlexMenu());
    await sendTelegramAlert(`📥 ลูกค้าใหม่เพิ่มเพื่อน: ${event.source.userId}`);
    return replyMessages;
  }

  // ✅ ถ้าลูกค้ากดปุ่มใน Flex
  if (event.type === "postback" && event.postback.data) {
    const buttonData = event.postback.data;

    switch (buttonData) {
      case "register_admin":
        await sendTelegramAlert("📝 ลูกค้าต้องการให้แอดมินสมัครให้");
        replyMessages.push({
          type: "text",
          text: await getCuteDynamicReply("รบกวนพิมพ์ชื่อ-นามสกุล เบอร์โทร บัญชีหรือวอเลท และไอดีไลน์ด้วยนะคะ 💕"),
        });
        break;

      case "login_backup":
        await sendTelegramAlert("🔑 ลูกค้าขอทางเข้าเล่นสำรอง");
        replyMessages.push({
          type: "text",
          text: await getCuteDynamicReply("รบกวนแจ้งชื่อ+เบอร์โทรที่สมัครไว้นะคะ เดี๋ยวน้องจะตรวจสอบให้เลยค่า 💕"),
        });
        break;

      case "issue_deposit":
        await sendTelegramAlert("💸 ลูกค้าแจ้งปัญหาฝากเงิน");
        replyMessages.push({
          type: "text",
          text: await getCuteDynamicReply("พี่รบกวนแจ้งชื่อ+เบอร์โทร และส่งรูปสลิปด้วยนะคะ เดี๋ยวน้องจะรีบดูแลให้เลยค่า 💕"),
        });
        break;

      case "issue_withdraw":
        await sendTelegramAlert("🏧 ลูกค้าแจ้งปัญหาถอนเงิน");
        replyMessages.push({
          type: "text",
          text: await getCuteDynamicReply("ยอดถอนกำลังดำเนินการผ่านระบบบริษัทนะคะ รอสักครู่ภายใน 3-5 นาทีค่า 💕"),
        });
        break;

      case "forgot_password":
        await sendTelegramAlert("🔐 ลูกค้าขอรีเซ็ตรหัสผ่าน");
        replyMessages.push({
          type: "text",
          text: await getCuteDynamicReply("รบกวนแจ้งชื่อ+เบอร์โทรที่สมัครไว้นะคะ เดี๋ยวน้องจะรีบช่วยทำรายการให้ค่า 💕"),
        });
        break;

      case "promo_info":
        await sendTelegramAlert("🎁 ลูกค้าสนใจโปรโมชั่น");
        replyMessages.push({
          type: "text",
          text: await getCuteDynamicReply("ตอนนี้เว็บเรามีโปรสมัครใหม่ ฝากแรกของวัน และโปรคืนยอดเสียทุกวันเลยค่ะ 💕 สนใจโปรไหนบอกน้องได้เลยนะคะ"),
        });
        break;

      case "review_withdraw":
        await sendTelegramAlert("📊 ลูกค้าดูรีวิวยอดถอน");
        replyMessages.push({
          type: "text",
          text: generateRandomWithdrawReview(),
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

  // ✅ ถ้าลูกค้าส่งข้อความมาเอง
  if (event.type === "message" && event.message.type === "text") {
    await sendTelegramAlert(`📩 ลูกค้าส่งข้อความ: ${userText}`);
    replyMessages.push({
      type: "text",
      text: await getCuteDynamicReply("น้องกำลังดูแลให้พี่อยู่นะคะ 💕 ฝากบอกเพื่อนมาร่วมสนุกด้วยกันด้วยนะคะ เว็บเรามั่นคงสุดๆ เลยค่า 🎉"),
    });
    replyMessages.push(createFlexMenu());
    return replyMessages;
  }

  return [];
}

/**
 * ✅ สร้างรีวิวยอดถอนแบบสุ่ม
 */
function generateRandomWithdrawReview() {
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
