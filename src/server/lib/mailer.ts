import nodemailer from "nodemailer";

/** Email is only available when SMTP credentials are set (see .env.example). */
export function isMailerConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendPasswordResetEmail(to: string, link: string): Promise<void> {
  const port = Number(process.env.SMTP_PORT);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await transport.sendMail({
    from: `XArena <${from}>`,
    to,
    subject: "Reset your XArena password",
    text: `We got a request to reset your XArena password.\n\nOpen this link within 30 minutes to choose a new password:\n${link}\n\nIf you didn't ask for this, ignore this email — your password stays the same.`,
    html: `<p>We got a request to reset your XArena password.</p><p><a href="${link}">Choose a new password</a> (valid for 30 minutes).</p><p style="color:#666">If you didn't ask for this, ignore this email — your password stays the same.</p>`,
  });
}
