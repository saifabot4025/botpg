
export const flexMenu = {
  type: "flex",
  altText: "เมนูหลัก",
  contents: {
    type: "carousel",
    contents: [
      {
        type: "bubble",
        hero: {
          type: "image",
          url: "https://i.ibb.co/SqbNcr1/image.jpg",
          size: "full",
          aspectRatio: "20:13",
          aspectMode: "cover"
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "text", text: "สมัคร + Login", weight: "bold", size: "xl" }
          ]
        },
        footer: {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "button", style: "primary", action: { type: "uri", label: "สมัครเอง", uri: "https://pgthai289.net/customer/register/LINEBOT/?openExternalBrowser=1" }},
            { type: "button", style: "primary", action: { type: "message", label: "ให้แอดมินสมัครให้", text: "สมัครให้" }},
            { type: "button", style: "primary", action: { type: "uri", label: "ทางเข้าเล่นหลัก", uri: "https://pgthai289.net/?openExternalBrowser=1" }},
            { type: "button", style: "primary", action: { type: "message", label: "ทางเข้าเล่นสำรอง", text: "ขอทางเข้าเล่นสำรอง" }}
          ]
        }
      }
    ]
  }
};
