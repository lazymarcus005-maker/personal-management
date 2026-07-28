import nodemailer, { type Transporter } from "nodemailer";

// SMTP is optional. Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and
// (optionally) SMTP_FROM to enable outgoing email. Without it, sendMail()
// logs the message and reports back that nothing was sent so callers can
// fall back to an in-app UX (e.g. showing a reset link directly in dev).
let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    transporter = null;
    return transporter;
  }

  const port = Number(SMTP_PORT);
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

export async function sendMail(options: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ sent: boolean }> {
  const t = getTransporter();
  if (!t) {
    console.warn(
      `[mail] SMTP is not configured; skipping email to ${options.to} ("${options.subject}")`
    );
    return { sent: false };
  }

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    return { sent: true };
  } catch (err) {
    console.error("[mail] Failed to send email:", err);
    return { sent: false };
  }
}
