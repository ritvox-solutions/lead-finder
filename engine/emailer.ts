import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import "dotenv/config";

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing ${key} in .env`);
  return v;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: env("GMAIL_USER"),
      pass: env("GMAIL_APP_PASSWORD"),
    },
  });
  return transporter;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Send a plain/text email via Gmail SMTP. */
export async function sendMail(msg: MailMessage): Promise<void> {
  const t = getTransporter();
  await t.sendMail({
    from: `"${process.env.YOUR_NAME ?? "LeadFinder"}" <${env("GMAIL_USER")}>`,
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
  });
}

/** Simple HTML table wrapper for lead digests. */
export function wrapDigest(title: string, rows: string[][]): string {
  const body = rows
    .map(
      (r) => `<tr>${r.map((c) => `<td style="padding:6px 10px;border:1px solid #ddd">${c}</td>`).join("")}</tr>`
    )
    .join("");
  return `<h2>${title}</h2><table style="border-collapse:collapse;font-family:sans-serif">${body}</table>`;
}