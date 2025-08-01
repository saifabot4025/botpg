import fetch from "node-fetch";
const LINE_API = "https://api-data.line.me/v2/bot/message";

export async function getLineImage(messageId) {
  try {
    const res = await fetch(`${LINE_API}/${messageId}/content`, {
      headers: {
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
    });

    // แปลงรูปเป็น Base64 แล้วอัพโหลดไป imgur / cloudinary
    const buffer = await res.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString("base64");

    // ✅ ถ้าใช้ Cloudinary → อัพโหลดต่อแล้วส่ง URL
    // หรือถ้ามี proxy image API → ใช้ URL จากนั้น
    // ตอนนี้จะ return เป็น Data URL (Telegram รองรับ)
    return `data:image/jpeg;base64,${base64Image}`;
  } catch (err) {
    console.error("Error fetching LINE image:", err);
    return null;
  }
}
