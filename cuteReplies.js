import OpenAI from "openai";
import { staffNames } from "./staffNames.js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function getCuteDynamicReply(baseMessage) {
  const randomStaff = staffNames[Math.floor(Math.random() * staffNames.length)];
  const prompt = `
  สร้างข้อความตอบลูกค้าแบบน่ารัก อ้อน ๆ เป็นกันเอง
  ใส่ชื่อ "${randomStaff}" เป็นผู้ช่วยลูกค้า
  เนื้อหาต้องชวนให้ลูกค้าเชื่อมั่นว่าเว็บมั่นคง ปลอดภัย ฝาก-ถอนง่าย
  ให้ดูเหมือนเป็นพนักงานตัวจริงตอบ มีความเป็นกันเองและสุภาพ
  ห้ามใช้คำซ้ำ จำเจ หรือยาวเกินไป

  ประโยคหลัก: "${baseMessage}"
  `;

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    return completion.choices[0].message.content.replace(/\n/g, "");
  } catch (err) {
    console.error("GPT Error:", err);
    return `${randomStaff} กำลังดูแลคุณอยู่นะคะ 💕`;
  }
}
