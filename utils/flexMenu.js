export const flexMenu = {
  type: "flex",
  altText: "เมนูหลัก",
  contents: {
    type: "carousel",
    contents: [
      {
        type: "bubble",
        header: { type: "box", layout: "vertical", contents: [{ type: "text", text: "สมัคร + Login", weight: "bold", size: "lg" }] },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "button", style: "primary", action: { type: "uri", label: "สมัครเอง", uri: "https://pgthai289.net/customer/register/LINEBOT/?openExternalBrowser=1" }},
            { type: "button", style: "primary", action: { type: "message", label: "ให้แอดมินสมัครให้", text: "ขอให้แอดมินสมัครให้ค่ะ" }},
            { type: "button", style: "secondary", action: { type: "uri", label: "ทางเข้าเล่นหลัก", uri: "https://pgthai289.net/?openExternalBrowser=1" }},
            { type: "button", style: "secondary", action: { type: "message", label: "ทางเข้าเล่นสำรอง", text: "ขอทางเข้าเล่นสำรองค่ะ" }}
          ]
        }
      },
      {
        type: "bubble",
        header: { type: "box", layout: "vertical", contents: [{ type: "text", text: "แจ้งปัญหา", weight: "bold", size: "lg" }] },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "button", style: "primary", action: { type: "message", label: "ปัญหาฝาก/ถอนยังไม่เข้า", text: "แจ้งปัญหาฝากถอน" }},
            { type: "button", style: "primary", action: { type: "message", label: "ลืมรหัสผ่าน", text: "ลืมรหัสผ่านค่ะ" }},
            { type: "button", style: "primary", action: { type: "message", label: "เข้าเล่นไม่ได้", text: "เข้าเล่นไม่ได้ค่ะ" }},
            { type: "button", style: "secondary", action: { type: "message", label: "สอบถามโปรโมชั่น+กิจกรรม", text: "สอบถามโปรค่ะ" }}
          ]
        }
      },
      {
        type: "bubble",
        header: { type: "box", layout: "vertical", contents: [{ type: "text", text: "รีวิวยอดถอน+เกมแตก", weight: "bold", size: "lg" }] },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "button", style: "primary", action: { type: "message", label: "รีวิวยอดถอน 30 นาทีที่ผ่านมา", text: "รีวิวถอน 30 นาที" }},
            { type: "button", style: "primary", action: { type: "message", label: "ยอดถอนเยอะสุดประจำวัน", text: "ยอดถอนสูงสุด" }},
            { type: "button", style: "primary", action: { type: "message", label: "เกมสล็อตที่คนได้ถอนเยอะที่สุดวันนี้", text: "เกมที่แตกเยอะ" }},
            { type: "button", style: "secondary", action: { type: "message", label: "รายชื่อคนได้ถอนค่าแนะนำเพื่อน", text: "ถอนค่าคอมเพื่อน" }}
          ]
        }
      },
      {
        type: "bubble",
        header: { type: "box", layout: "vertical", contents: [{ type: "text", text: "ลิงก์เสริม", weight: "bold", size: "lg" }] },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "button", style: "secondary", action: { type: "uri", label: "ดูบอลสด ดูหนัง ดู18+", uri: "https://t.me/+aCx3bHddwkkzMmU9" }},
            { type: "button", style: "secondary", action: { type: "uri", label: "ทีเด็ดบอลวันนี้", uri: "https://t.me/+aCx3bHddwkkzMmU9" }},
            { type: "button", style: "secondary", action: { type: "uri", label: "กลุ่มเลขเด็ดเลขดัง", uri: "https://t.me/+aCx3bHddwkkzMmU9" }},
            { type: "button", style: "secondary", action: { type: "uri", label: "กลุ่มข่าวสาร", uri: "https://t.me/+aCx3bHddwkkzMmU9" }}
          ]
        }
      }
    ]
  }
};