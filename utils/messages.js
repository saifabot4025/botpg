const adminNames = ["น้องมุก", "น้องน้ำผึ้ง", "น้องฝน", "น้องฟ้า", "น้องแป้ง"];

const promos = [
  "เว็บ PGTHAI289 แจกโบนัสทุกวัน 🎁 เล่นง่าย แตกจริง มั่นคง 100%",
  "สมัครวันนี้รับเครดิตฟรี 💰 และชวนเพื่อนมาเล่น รับค่าคอมไปเลย!",
  "โปรแรง! ฝากทุกวันรับโบนัสเพียบ 💎 อย่าพลาดนะคะ",
  "เว็บมั่นคง ปลอดภัย ฝากถอนออโต้ ชวนเพื่อนมารับค่าคอม 1% ได้เลย!"
];

export const getGreetingMessage = () => {
  const name = adminNames[Math.floor(Math.random() * adminNames.length)];
  const promo = promos[Math.floor(Math.random() * promos.length)];
  return `สวัสดีค่ะ ${name} แอดมินน่ารักมาดูแลพี่นะคะ 💖 ${promo}`;
};