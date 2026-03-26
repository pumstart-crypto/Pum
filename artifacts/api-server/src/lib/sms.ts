import { SolapiMessageService } from "coolsms-node-sdk";

const apiKey = process.env["COOLSMS_API_KEY"] || "";
const apiSecret = process.env["COOLSMS_API_SECRET"] || "";
const senderPhone = process.env["COOLSMS_SENDER_PHONE"] || "";

let service: SolapiMessageService | null = null;

function getService(): SolapiMessageService {
  if (!service) {
    service = new SolapiMessageService(apiKey, apiSecret);
  }
  return service;
}

export async function sendOTP(phone: string, code: string): Promise<void> {
  if (!apiKey || !apiSecret || !senderPhone) {
    console.log(`[SMS Mock] To: ${phone} | Code: ${code}`);
    return;
  }
  const svc = getService();
  await svc.sendOne({
    to: phone,
    from: senderPhone,
    text: `[캠퍼스라이프] 인증번호는 [${code}]입니다. 5분 내로 입력해주세요.`,
  });
}
