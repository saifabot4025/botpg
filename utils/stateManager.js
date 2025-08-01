// stateManager.js
let userStates = {};

/**
 * กำหนดสถานะให้ user
 * @param {string} userId - ไอดีลูกค้าจาก LINE
 * @param {string} status - normal | waiting | collectingData
 * @param {object} extraData - เก็บข้อมูลเพิ่มเติม เช่น ปัญหาที่แจ้ง, step ปัจจุบัน
 */
export function setUserState(userId, status, extraData = {}) {
  userStates[userId] = {
    status,
    ...extraData,
  };
}

/**
 * ดึงสถานะปัจจุบันของ user
 */
export function getUserState(userId) {
  return userStates[userId] || { status: "normal" };
}

/**
 * รีเซ็ตสถานะ user กลับเป็นปกติ
 */
export function resetUserState(userId) {
  userStates[userId] = { status: "normal" };
}

/**
 * เช็กว่าลูกค้ากำลังรอแอดมินหรือไม่
 */
export function isUserWaiting(userId) {
  return userStates[userId]?.status === "waiting";
}

/**
 * ใช้ตอนแอดมินตอบใน LINE ว่า "ดำเนินการให้เรียบร้อยแล้วนะคะพี่"
 */
export function handleAdminDoneMessage(event) {
  const userId = event.source.userId;
  const message = event.message.text?.trim();

  if (message.includes("ดำเนินการให้เรียบร้อยแล้วนะคะพี่")) {
    resetUserState(userId);
    return true;
  }
  return false;
}
