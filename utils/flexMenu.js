export function createFlexMenu() {
  return {
    type: "flex",
    altText: "เมนูหลัก",
    contents: {
      type: "carousel",
      contents: [
        {
          type: "bubble",
          header: { type: "box", layout: "vertical", contents: [{ type: "text", text: "สมัคร + Login", weight: "bold" }] },
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              { type: "button", style: "primary", action: { type: "uri", label: "สมัครเอง", uri: "https://pgthai289.net/customer/register/LINEBOT/?openExternalBrowser=1" }},
              { type: "button", style: "primary", action: { type: "message", label: "ให้แอดมินสมัครให้", text: "สมัครให้" }},
              { type: "button", style: "secondary", action: { type: "uri", label: "ทางเข้าเล่นหลัก", uri: "https://pgthai289.net/?openExternalBrowser=1" }},
              { type: "button", style: "secondary", action: { type: "message", label: "ทางเข้าสำรอง", text: "ทางเข้าสำรอง" }},
            ]
          }
        },
        {
          type: "bubble",
          header: { type: "box", layout: "vertical", contents: [{ type: "text", text: "แจ้งปัญหา", weight: "bold" }] },
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              { type: "button", style: "primary", action: { type: "message", label: "ปัญหาฝาก/ถอนไม่เข้า", text: "ฝากถอนไม่เข้า" }},
              { type: "button", style: "primary", action: { type: "message", label: "ลืมรหัสผ่าน", text: "ลืมรหัสผ่าน" }},
              { type: "button", style: "primary", action: { type: "message", label: "เข้าเล่นไม่ได้", text: "เข้าเล่นไม่ได้" }},
              { type: "button", style: "primary", action: { type: "message", label: "สอบถามโปร", text: "สอบถามโปรโมชั่น" }},
            ]
          }
        },
        {
          type: "bubble",
          header: { type: "box", layout: "vertical", contents: [{ type: "text", text: "รีวิวยอดถอน + เกมแตก", weight: "bold" }] },
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              { type: "button", style: "primary", action: { type: "message", label: "รีวิวยอดถอน 30 นาที", text: "รีวิวยอดถอน 30 นาที" }},
              { type: "button", style: "primary", action: { type: "message", label: "ยอดถอนสูงสุดวันนี้", text: "ยอดถอนสูงสุด" }},
              { type: "button", style: "primary", action: { type: "message", label: "เกมสล็อตที่แตกเยอะ", text: "เกมสล็อตแตกเยอะ" }},
              { type: "button", style: "primary", action: { type: "message", label: "ค่าแนะนำเพื่อน", text: "ค่าแนะนำเพื่อน" }},
            ]
          }
        }
      ]
    }
  };
}
