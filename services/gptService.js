// services/gptService.js
import OpenAI from "openai";
import { staffNames } from "../utils/staffNames.js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * สร้างคำตอบแอดมินแบบ "ฉลาด" พร้อม feed history แชทและล็อกชื่อ 10 นาที
 * @param {string} baseMessage ข้อความล่าสุดจากลูกค้า
 * @param {string} assistantName ชื่อแอดมิน (ส่งมาจะไม่เปลี่ยน)
 * @param {Array} history ประวัติแชท [{role: "user", content}, {role: "assistant", content}]
 * @returns {Promise<string>}
 */
export async function getCuteDynamicReply(baseMessage, assistantName = null, history = []) {
  const staffName = assistantName || staffNames[Math.floor(Math.random() * staffNames.length)];
  // history ย่อ 2-3 ข้อความล่าสุด
  const lastHistory = (history || []).slice(-3)
    .map(msg => `${msg.role === "user" ? "ลูกค้า" : staffName}: ${msg.content}`).join("\n");

  // ตัวอย่าง
  const examples = `
ตัวอย่าง
ลูกค้า: สอนแทงบอลสดหน่อยค่ะ
${staffName}: ได้เลยค่ะ แทงบอลสดกับ PGTHAI289 ง่ายมาก! เข้าเมนูกีฬา เลือกคู่บอลและประเภทเดิมพัน เช่น เต็มเวลา/ครึ่งแรก/สูง-ต่ำ ใส่จำนวนเงินแล้วกดยืนยันค่ะ ถ้าสงสัยขั้นตอนไหนถามต่อได้เลยนะคะ

ลูกค้า: วันนี้แมนยูต่อเท่าไหร่
${staffName}: ตอนนี้แมนยูต่อ 0.5 ลูกค่ะ อัตราจ่ายเปลี่ยนแปลงตามตลาดนะคะ สามารถเช็คในหน้ากีฬาได้ตลอดเลยค่ะ

ลูกค้า: โปรฝากแรกของวันมีอะไรบ้าง
${staffName}: โปรฝากแรกวันนี้ รับโบนัส 20% สูงสุด 1,000 บาท ทำเทิร์น 3 เท่า ถอนได้เลยค่ะ สนใจรับโปรแจ้งได้เลยนะคะ

ลูกค้า: เติมวอลเลทขั้นต่ำเท่าไหร่
${staffName}: เติมผ่านวอลเลทขั้นต่ำ 1 บาทค่ะ ฝากถอนได้ไวไม่มีค่าธรรมเนียม ดูวิธีได้ที่เมนูฝากถอนเลยค่ะ
`;

  const prompt = `
คุณคือแอดมินผู้หญิงชื่อ "${staffName}" ของเว็บ PGTHAI289
- ต้องตอบโดยวิเคราะห์และเข้าใจคำถามจากประวัติแชท (history) ด้านล่าง
- ตอบแบบน่ารัก อบอุ่น เป็นกันเอง มืออาชีพ ไม่แข็งทื่อ ไม่ซ้ำจำเจ
- คำตอบต้อง "ตรงกับคำถาม" เป็นหลัก หากลูกค้าถามเรื่องบอล/สล็อต/คาสิโน/โปร/ฝากถอน ฯลฯ ให้ตอบแบบ step-by-step หรือยกตัวอย่างที่เกี่ยวข้องจริง (ไม่ตอบกว้างๆ ว่า "เลือกเกมและใส่เงิน" เฉยๆ)
- ไม่ต้องโปรโมทหรือแทรกขายทุกข้อความ ให้เลือกใส่โปร/ชวนเล่นเฉพาะที่เหมาะสม หรือเชื่อมโยงเนียนๆ เท่านั้น
- หลีกเลี่ยงการเปลี่ยนชื่อแอดมินกลางแชท (ใช้ชื่อเดิมเสมอ 10 นาทีแรก)
- ห้ามเริ่มทุกข้อความด้วย "สวัสดีค่ะ" หรือแนะนำตัวซ้ำ
- ถ้าไม่มีข้อมูลหรือไม่แน่ใจ ให้ขอข้อมูลเพิ่ม/แนะนำแอดมินจริง/ไม่ตอบมั่ว

${examples}

${lastHistory ? `ประวัติแชทล่าสุด:\n${lastHistory}` : ""}

สถานการณ์: ${baseMessage}
`;

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
      max_tokens: 320,
    });
    return completion.choices[0].message.content.trim();
  } catch (err) {
    console.error("GPT Error:", err);
    return `${staffName} กำลังดูแลคุณอยู่นะคะ 💕`;
  }
}
