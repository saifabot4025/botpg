import fetch from "node-fetch";

const LINE_API = "https://api-data.line.me/v2/bot/message";

// URL ของ proxy server ที่จะช่วยดึงข้อมูล (ตัวอย่างใช้ free proxy สำหรับ dev เท่านั้น)
const PROXY_URL = "https://cors-anywhere.herokuapp.com"; // ถ้ารันจริงแนะนำเปลี่ยนเป็น proxy ส่วนตัว

/**
 * ดึงรูปจาก LINE API ผ่าน proxy
 * @param {string} messageId
 * @returns {Buffer|null}
 */
export async function getLineImage(messageId) {
  try {
    const url = `${LINE_API}/${messageId}/content`;
    const res = await fetch(`${PROXY_URL}/${url}`, {
      headers: {
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
    });

    if (!res.ok) {
      console.error("❌ LINE image fetch failed, status:", res.status);
      return null;
    }

    const buffer = await res.arrayBuffer();
    return Buffer.from(buffer);
  } catch (err) {
    console.error("❌ Error fetching LINE image:", err);
    return null;
  }
}
