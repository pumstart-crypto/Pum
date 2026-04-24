import nodemailer from "nodemailer";

const MAIL_USER = "pum.start@gmail.com";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: MAIL_USER,
    pass: process.env["MAIL_PASSWORD"],
  },
});

const registerHtml = (code: string) => `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F5F7FA;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:#00427D;padding:32px 40px;text-align:center;">
      <p style="color:rgba(255,255,255,0.7);font-size:11px;margin:0 0 6px;letter-spacing:2px;text-transform:uppercase;">Pusan National University</p>
      <h1 style="color:#fff;font-size:26px;margin:0;font-weight:700;letter-spacing:-0.5px;">P:um 피움</h1>
    </div>
    <div style="padding:40px;">
      <p style="font-size:16px;color:#374151;margin:0 0 8px;font-weight:600;">안녕하세요!</p>
      <p style="font-size:14px;color:#6B7280;margin:0 0 32px;line-height:1.7;">부산대학교 학생 인증을 위한 인증번호입니다.<br>아래 6자리 숫자를 앱에 입력해주세요.</p>
      <div style="background:#EEF4FF;border-radius:16px;padding:28px;text-align:center;margin:0 0 28px;border:1.5px solid #C7D7F5;">
        <p style="font-size:12px;color:#00427D;font-weight:700;margin:0 0 12px;letter-spacing:2px;text-transform:uppercase;">인증번호</p>
        <p style="font-size:42px;font-weight:700;color:#00427D;letter-spacing:14px;margin:0;font-variant-numeric:tabular-nums;">${code}</p>
      </div>
      <p style="font-size:12px;color:#9CA3AF;text-align:center;margin:0;line-height:1.8;">이 인증번호는 <strong>5분간</strong> 유효합니다.<br>본인이 요청하지 않은 경우 이 메일을 무시해주세요.</p>
    </div>
    <div style="background:#F9FAFB;padding:18px 40px;text-align:center;border-top:1px solid #F3F4F6;">
      <p style="font-size:11px;color:#9CA3AF;margin:0;">P:um · 부산대학교 학생 생활관리 플랫폼</p>
    </div>
  </div>
</body>
</html>`;

const recoveryHtml = (code: string) => `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F5F7FA;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:#00427D;padding:32px 40px;text-align:center;">
      <p style="color:rgba(255,255,255,0.7);font-size:11px;margin:0 0 6px;letter-spacing:2px;text-transform:uppercase;">Pusan National University</p>
      <h1 style="color:#fff;font-size:26px;margin:0;font-weight:700;letter-spacing:-0.5px;">P:um 피움</h1>
    </div>
    <div style="padding:40px;">
      <p style="font-size:16px;color:#374151;margin:0 0 8px;font-weight:600;">계정 복구 요청</p>
      <p style="font-size:14px;color:#6B7280;margin:0 0 32px;line-height:1.7;">아이디·비밀번호 찾기를 위한 인증번호입니다.<br>아래 6자리 숫자를 앱에 입력해주세요.</p>
      <div style="background:#FFF7ED;border-radius:16px;padding:28px;text-align:center;margin:0 0 28px;border:1.5px solid #FED7AA;">
        <p style="font-size:12px;color:#C2410C;font-weight:700;margin:0 0 12px;letter-spacing:2px;text-transform:uppercase;">인증번호</p>
        <p style="font-size:42px;font-weight:700;color:#EA580C;letter-spacing:14px;margin:0;font-variant-numeric:tabular-nums;">${code}</p>
      </div>
      <p style="font-size:12px;color:#9CA3AF;text-align:center;margin:0;line-height:1.8;">이 인증번호는 <strong>5분간</strong> 유효합니다.<br>본인이 요청하지 않은 경우 이 메일을 무시해주세요.</p>
    </div>
    <div style="background:#F9FAFB;padding:18px 40px;text-align:center;border-top:1px solid #F3F4F6;">
      <p style="font-size:11px;color:#9CA3AF;margin:0;">P:um · 부산대학교 학생 생활관리 플랫폼</p>
    </div>
  </div>
</body>
</html>`;

export async function sendVerificationEmail(to: string, code: string, isRecovery = false): Promise<void> {
  if (!process.env["MAIL_PASSWORD"]) {
    console.log(`[Email Mock] To: ${to} | Code: ${code} | type: ${isRecovery ? "recovery" : "register"}`);
    return;
  }
  await transporter.sendMail({
    from: `"P:um 피움" <${MAIL_USER}>`,
    to,
    subject: isRecovery ? "[P:um] 계정 복구 인증번호" : "[P:um] 부산대학교 학생 인증번호",
    html: isRecovery ? recoveryHtml(code) : registerHtml(code),
  });
}
