import { createRequire } from "module";

const require = createRequire(import.meta.url);

const apiKey = process.env["COOLSMS_API_KEY"] || "";
const apiSecret = process.env["COOLSMS_API_SECRET"] || "";
const senderPhone = process.env["COOLSMS_SENDER_PHONE"] || "";

let service: any = null;

function getService(): any {
  if (!service) {
    const sdk = require("coolsms-node-sdk");
    const Ctor = sdk.SolapiMessageService ?? sdk.default?.SolapiMessageService ?? sdk.default;
    service = new Ctor(apiKey, apiSecret);
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
    text: `[P:um] 인증번호는 [${code}]입니다. 5분 내로 입력해주세요.`,
  });
}
