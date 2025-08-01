import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function getGPTResponse(userText) {
  const prompt = `
  ลูกค้าส่งข้อความว่า: "${userText}"
  สร้างคำตอบแบบน่ารัก อ้อน ๆ ใส่ใจลูกค้า
  พร้อมโปรโมทว่าเว็บมั่นคง ปลอดภัย ฝาก-ถอนง่าย และชวนเพื่อนมาเล่นด้วยกัน
  ห้ามใช้คำซ้ำกัน และให้เหมือนพนักงานตัวจริงตอบ
  `;

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    return completion.choices[0].message.content.replace(/\n/g, "");
  } catch (err) {
    console.error("GPT Error:", err);
    return "ขอบคุณที่ติดต่อมานะคะ น้องกำลังดูแลให้ค่า 💕";
  }
}
