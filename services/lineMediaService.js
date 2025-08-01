import fetch from "node-fetch";
const LINE_API = "https://api-data.line.me/v2/bot/message";

export async function getLineImage(messageId) {
  try {
    const res = await fetch(`${LINE_API}/${messageId}/content`, {
      headers: {
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
    });

    const buffer = await res.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString("base64");

    // ✅ ส่งเป็น Data URL (Telegram รองรับได้)
    return `data:image/jpeg;base64,${base64Image}`;
  } catch (err) {
    console.error("Error fetching LINE image:", err);
    return null;
  }
}
