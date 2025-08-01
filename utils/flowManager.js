// utils/flowManager.js
import { createFlexMenu } from "./flexMenu.js";
import { sendTelegramAlert, sendTelegramPhoto, getLineProfile } from "../services/telegramService.js";
import { getLineImage } from "../services/lineMediaService.js";
import { getUserState, setUserState, resetUserState } from "./stateManager.js";

// ✅ ชื่อแอดมินสุ่ม
const staffNames = ["น้องฟาง", "น้องพิม", "น้องใบเฟิร์น", "น้องเมย์", "น้องแพรว", "น้องน้ำหวาน", "น้องเจน", "น้องแป้ง"];
const introPhrases = [
  "กำลังดูแลพี่อยู่น้า 💕",
  "กำลังช่วยพี่อย่างเต็มที่เลยค่า 🥰",
  "มาดูแลพี่อย่างไวเลยค่า 😍",
  "ไม่ต้องห่วงนะคะ น้องจัดการให้เลยค่า 💖",
];
const infoRequests = [
  "รบกวนพิมพ์ชื่อ-นามสกุล เบอร์โทร และบัญชีหรือวอเลทให้หน่อยนะคะ 💕",
  "พิมพ์ชื่อ-นามสกุล เบอร์โทร และบัญชี/วอเลทให้ด้วยน้า น้องจะรีบดูแลเลยค่า 🥰",
  "ขอข้อมูล ชื่อ-นามสกุล เบอร์โทร และบัญชี/วอเลท ด้วยนะคะ เดี๋ยวน้องดูแลให้ทันทีค่า 💖",
];
const promos = [
  "เว็บ PGTHAI289 มั่นคง ปลอดภัย ฝากถอนออโต้ใน 10 วิเลยค่า 🎉",
  "แตกง่าย จ่ายจริง เว็บนี้พี่เล่นแล้วต้องรักเลยค่า 💕",
  "สมัครวันนี้รับโบนัสฟรีทันที! อย่าลืมชวนเพื่อนมาด้วยนะคะ ได้ค่าคอมเพิ่มอีกด้วยค่า 😍",
  "เว็บเราแจกจริงไม่จกตา แนะนำเพื่อนมาเล่นด้วย รับค่าคอมทันทีเลยค่า 💖",
];

// ✅ ฟังก์ชันสร้างข้อความสุ่ม
function getCuteReply(action = "normal") {
  const staff = staffNames[Math.floor(Math.random() * staffNames.length)];
  const intro = introPhrases[Math.floor(Math.random() * introPhrases.length)];
  const promo = promos[Math.floor(Math.random() * promos.length)];

  if (action === "info") {
    const info = infoRequests[Math.floor(Math.random() * infoRequests.length)];
    return `${staff} ${intro}\n${info}\n✨ ${promo}`;
  }
  if (action === "done") {
    return `${staff} ได้รับข้อมูลแล้วนะคะ กำลังดำเนินการให้ค่า 💕\n🌟 ขอบคุณที่ไว้ใจเว็บ PGTHAI289 ของเรานะคะ อย่าลืมชวนเพื่อนมาเล่นด้วยกันน้า 🎉`;
  }
  return `${staff} ${intro} น้องจะดูแลพี่อย่างดีเลยค่า 💕\n✨ ${promo}`;
}

// ✅ แจ้งเตือน Telegram พร้อมรูป
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

// ✅ ฟังก์ชันหลัก
export async function handleCustomerFlow(event) {
  const replyMessages = [];
  const userId = event.source?.userId;
  const userState = getUserState(userId);
  const userText = event.message?.text || "";

  // ถ้ากำลังรอแอดมิน → ไม่ตอบ
  if (userState.status === "waiting") return [];

  // 🟢 เพิ่มเพื่อน
  if (event.type === "follow") {
    replyMessages.push({ type: "text", text: getCuteReply("normal") });
    replyMessages.push(createFlexMenu());
    await notifyAdmin(event, "ลูกค้าเพิ่มเพื่อนใหม่");
    return replyMessages;
  }

  // 🟢 ลูกค้ากดปุ่มใน Flex
  if (event.type === "postback" && event.postback?.data) {
    const data = event.postback.data;
    await notifyAdmin(event, `กดปุ่ม: ${data}`);

    const replies = {
      register_admin: "info",
      login_backup: "info",
      issue_deposit: "info",
      issue_withdraw: "normal",
      forgot_password: "info",
      promo_info: "normal",
    };

    replyMessages.push({
      type: "text",
      text: getCuteReply(replies[data] || "normal"),
    });

    // ถ้าปุ่มเป็นแบบที่ต้องรอข้อมูล → เซ็ตสถานะเป็น waiting
    if (["register_admin", "login_backup", "issue_deposit", "forgot_password"].includes(data)) {
      setUserState(userId, "waiting", { action: data });
    }

    return replyMessages;
  }

  // 🟢 ลูกค้าส่งข้อความ
  if (event.type === "message") {
    // ถ้ากำลังเก็บข้อมูล → เมื่อได้ข้อมูลครบ → ตอบและหยุดทำงาน
    if (userState.status !== "normal") {
      replyMessages.push({ type: "text", text: getCuteReply("done") });
      await notifyAdmin(event, `📩 ข้อมูลจากลูกค้า: ${userText}`);
      setUserState(userId, "waiting", userState); // รอแอดมินพิมพ์ "ดำเนินการให้เรียบร้อยแล้วนะคะพี่"
      return replyMessages;
    }

    // ถ้าส่งข้อความปกติ
    await notifyAdmin(event, userText || "ลูกค้าส่งข้อความ/รูป");
    replyMessages.push({ type: "text", text: getCuteReply("normal") });
    replyMessages.push(createFlexMenu());
    return replyMessages;
  }

  return [];
}
