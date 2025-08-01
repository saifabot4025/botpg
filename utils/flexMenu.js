export function createFlexMenu() {
  return {
    type: "flex",
    altText: "🎀 เมนูพิเศษสำหรับคุณ 🎀",
    contents: {
      type: "carousel",
      contents: [
        createCard(
          "💎 สมัคร + Login",
          "🎀 สมัครง่าย ๆ เพียงกดปุ่มด้านล่าง เลือกวิธีที่คุณสะดวกที่สุด มั่นคง 💯 จ่ายจริง 💵",
          "https://i.ibb.co/SqbNcr1/image.jpg",
          [
            { label: "✨ สมัครเอง", action: { type: "uri", uri: "https://pgthai289.net/customer/register/LINEBOT/?openExternalBrowser=1" } },
            { label: "🤍 ให้แอดมินสมัครให้", action: { type: "message", text: "สมัครให้" } },
            { label: "🎰 ทางเข้าเล่นหลัก", action: { type: "uri", uri: "https://pgthai289.net/?openExternalBrowser=1" } },
            { label: "🛡 ทางเข้าเล่นสำรอง", action: { type: "message", text: "ขอทางเข้าสำรอง" } }
          ]
        ),
        createCard(
          "🛠 แจ้งปัญหา",
          "หากพบปัญหาฝาก ถอน หรือเข้าเล่นไม่ได้ กดปุ่มที่ต้องการแจ้งได้เลยนะคะ 💬",
          "https://i.ibb.co/SqbNcr1/image.jpg",
          [
            { label: "💰 ปัญหาฝาก/ถอน", action: { type: "message", text: "ปัญหาฝากถอน" } },
            { label: "🔑 ลืมรหัสผ่าน", action: { type: "message", text: "ลืมรหัสผ่าน" } },
            { label: "🚪 เข้าเล่นไม่ได้", action: { type: "message", text: "เข้าเล่นไม่ได้" } },
            { label: "🎁 โปรโมชั่น/กิจกรรม", action: { type: "message", text: "สอบถามโปรโมชั่น" } }
          ]
        ),
        createCard(
          "🏆 รีวิว & เกมแตก",
          "ดูรีวิวยอดถอนล่าสุด และเกมที่แตกหนักที่สุดวันนี้ 🔥 มั่นใจทุกยอดถอน 💎",
          "https://i.ibb.co/SqbNcr1/image.jpg",
          [
            { label: "💵 รีวิวยอดถอน", action: { type: "message", text: "รีวิวยอดถอน" } },
            { label: "👑 ถอนสูงสุดวันนี้", action: { type: "message", text: "ยอดถอนสูงสุด" } },
            { label: "🎲 เกมแตกบ่อย", action: { type: "message", text: "เกมแตกบ่อย" } },
            { label: "🤝 ค่าคอมแนะนำเพื่อน", action: { type: "message", text: "ค่าคอมเพื่อน" } }
          ]
        )
      ]
    }
  };
}

function createCard(title, desc, imageUrl, buttons) {
  return {
    type: "bubble",
    hero: {
      type: "image",
      url: imageUrl,
      size: "full",
      aspectRatio: "20:13",
      aspectMode: "cover"
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: title,
          weight: "bold",
          size: "lg",
          color: "#8E44AD",
          wrap: true
        },
        {
          type: "text",
          text: desc,
          size: "sm",
          color: "#4A235A",
          wrap: true,
          margin: "sm"
        }
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: buttons.map((btn) => ({
        type: "button",
        style: "primary",
        color: "#8E44AD",
        height: "sm",
        action: btn.action
      })),
      flex: 0
    },
    styles: {
      footer: { separator: true }
    }
  };
}
