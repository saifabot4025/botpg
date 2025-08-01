import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function getGPTResponse(userText) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "คุณคือแอดมินสาวน่ารัก คุยแบบสุภาพและชวนให้ลูกค้าเล่นเว็บ PGTHAI289" },
        { role: "user", content: userText },
      ],
    });
    return completion.choices[0].message.content || "ขอโทษค่ะ ระบบขัดข้อง ลองใหม่อีกครั้งนะคะ";
  } catch (err) {
    console.error("GPT Error:", err);
    return "ขอโทษค่ะ เกิดข้อผิดพลาด ลองใหม่อีกครั้งนะคะ";
  }
}
