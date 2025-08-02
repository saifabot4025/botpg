import fetch from "node-fetch";
import FormData from "form-data";

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const LINE_API = "https://api-data.line.me/v2/bot/message";

/**
 * ✅ แจ้งเตือนข้อความไป Telegram Group
 */
export async function sendTelegramAlert(text) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_GROUP_CHAT_ID) {
    console.warn("⚠️ TELEGRAM_BOT_TOKEN หรือ TELEGRAM_GROUP_CHAT_ID ไม่ได้ตั้งค่า");
    return;
  }

  console.log("[Telegram Alert] Sending message:", text);

  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_GROUP_CHAT_ID,
        text,
        parse_mode: "HTML",
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("❌ Telegram sendMessage failed:", errorText);
    } else {
      console.log("✅ Telegram sendMessage success");
    }
  } catch (err) {
    console.error("❌ Error sending Telegram alert:", err);
  }
}

/**
 * ✅ ส่งรูปไป Telegram Group
 */
export async function sendTelegramPhoto(photoBuffer, caption = "") {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_GROUP_CHAT_ID) {
    console.warn("⚠️ TELEGRAM_BOT_TOKEN หรือ TELEGRAM_GROUP_CHAT_ID ไม่ได้ตั้งค่า");
    return;
  }

  try {
    const formData = new FormData();
    formData.append("chat_id", process.env.TELEGRAM_GROUP_CHAT_ID);
    formData.append("caption", caption);
    formData.append("photo", photoBuffer, "line-image.jpg");

    const res = await fetch(`${TELEGRAM_API}/sendPhoto`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("❌ Telegram sendPhoto error:", errorText);
    } else {
      console.log("✅ Telegram sendPhoto success");
    }
  } catch (err) {
    console.error("❌ Error sending photo to Telegram:", err);
  }
}

/**
 * ✅ ดึงโปรไฟล์ลูกค้าจาก LINE
 */
export async function getLineProfile(userId) {
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    console.warn("⚠️ LINE_CHANNEL_ACCESS_TOKEN ไม่ได้ตั้งค่า");
    return null;
  }

  try {
    const res = await fetch(
      `https://api.line.me/v2/bot/profile/${userId}`,
      {
        headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
      }
    );

    if (!res.ok) {
      console.error("❌ LINE profile fetch failed, status:", res.status);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("❌ Error fetching LINE profile:", err);
    return null;
  }
}

/**
 * ✅ ดึงรูปจาก LINE API → Buffer (ส่งเข้า Telegram ได้เลย)
 */
export async function getLineImage(messageId) {
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    console.warn("⚠️ LINE_CHANNEL_ACCESS_TOKEN ไม่ได้ตั้งค่า");
    return null;
  }

  try {
    const res = await fetch(`${LINE_API}/${messageId}/content`, {
      headers: {
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
    });

    if (!res.ok) {
      console.error("❌ LINE image fetch failed, status:", res.status);
      return null;
    }
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.error("❌ Error fetching LINE image:", err);
    return null;
  }
}

// ฟังก์ชันทดสอบส่งข้อความแจ้งเตือน Telegram
export async function testTelegramAlert() {
  await sendTelegramAlert("🛠️ ทดสอบแจ้งเตือน Telegram จากระบบ LINE OA เรียบร้อยค่ะ");
}
