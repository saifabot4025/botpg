
const messages = [
  "🎉 สวัสดีค่ะ น้องฟ้าจาก PGTHAI289 ยินดีให้บริการค่ะ เว็บมั่นคง ปลอดภัย 💎",
  "💎 สวัสดีค่ะ น้องพิมจาก PGTHAI289 พร้อมดูแลพี่ ๆ ทุกคนเลยค่ะ",
  "🔥 น้องมุก PGTHAI289 มาดูแลค่ะ สมัครง่าย เล่นสนุก ปลอดภัยแน่นอน!"
];

export const getGreetingMessage = () => {
  return messages[Math.floor(Math.random() * messages.length)];
};
