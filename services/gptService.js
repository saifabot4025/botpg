// services/gptService.js
import OpenAI from "openai";
import { staffNames } from "../utils/staffNames.js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * สร้างคำตอบแอดมินแบบใช้ชื่อเดิม ถ้าให้ assistantName มา จะไม่สุ่มชื่อใหม่
 * @param {string} baseMessage
 * @param {string} assistantName
 * @returns {Promise<string>}
 */
export async function getCuteDynamicReply(baseMessage, assistantName = null) {
  const staffName = assistantName || staffNames[Math.floor(Math.random() * staffNames.length)];
  const prompt = `
  คุณคือแอดมินผู้หญิงชื่อ "${staffName}" ของเว็บ PGTHAI289
  - ตอบแบบน่ารัก อบอุ่น อ้อน ๆ เป็นกันเอง มืออาชีพ
  - คำตอบห้ามแข็งทื่อ, หลีกเลี่ยงคำซ้ำ, ไม่ยาวเกินไป
  - สร้างความเชื่อมั่นให้ลูกค้าเว็บมั่นคง ปลอดภัย ฝาก-ถอนง่าย
  - ถ้าเพิ่งคุยกันใน 10 นาทีแรก ห้ามเปลี่ยนชื่อ, ให้เหมือนแชทกับคนเดิม
  - ห้ามแนะนำตัวซ้ำในทุกข้อความ (เช่น สวัสดีค่ะ...ชื่อ...)
  - ถ้าคำถามเกี่ยวกับโปร ระบบ คาสิโน สล็อต บอล ฯลฯ ให้เนียนชวนเล่น
  - ถ้าไม่ได้คำตอบ ให้ถามต่อหรือแนะนำให้แจ้งแอดมินจริง
  - ถ้ามีข้อมูลจริงแนบมา ให้ตอบตามข้อมูลนั้น

  สถานการณ์: ${baseMessage}
  `;

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });
    return completion.choices[0].message.content.trim();
  } catch (err) {
    console.error("GPT Error:", err);
    return `${staffName} กำลังดูแลคุณอยู่นะคะ 💕`;
  }
}
