import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/server/env";

export type EmailMessage = { to: string; subject: string; html: string; text: string };

/**
 * Email delivery, configured entirely through environment variables:
 *  - SMTP_HOST set          → SMTP via nodemailer (any provider: SES, Postmark, Mailgun…)
 *  - development, no SMTP   → written to .data/outbox/*.json for local testing
 *  - MAIL_OUTBOX=true       → same outbox in any environment (never on a real server)
 *  - test                   → kept in memory (see testOutbox)
 *  - production, no SMTP    → refused with a configuration error
 */

export const testOutbox: EmailMessage[] = [];
const OUTBOX_DIR = path.join(process.cwd(), ".data", "outbox");

type Transport = { sendMail(m: EmailMessage & { from: string }): Promise<unknown> };
let transport: Promise<Transport> | undefined;

async function createTransport(): Promise<Transport> {
  const e = env();
  // MAIL_OUTBOX forces the local outbox even when SMTP is configured (local end-to-end testing).
  if (e.SMTP_HOST && !e.MAIL_OUTBOX) {
    const nodemailer = await import("nodemailer");
    return nodemailer.createTransport({
      host: e.SMTP_HOST,
      port: e.SMTP_PORT,
      secure: e.SMTP_SECURE,
      auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASSWORD } : undefined,
    });
  }
  if (e.NODE_ENV === "test") {
    return { sendMail: async (m) => void testOutbox.push(m) };
  }
  if (e.NODE_ENV === "development" || e.MAIL_OUTBOX) {
    return {
      sendMail: async (m) => {
        await mkdir(OUTBOX_DIR, { recursive: true });
        const file = path.join(OUTBOX_DIR, `${Date.now()}-${m.to.replace(/[^a-z0-9@.]/gi, "_")}.json`);
        await writeFile(file, JSON.stringify({ ...m, sentAt: new Date().toISOString() }, null, 2));
        // Only the file location is logged — never the message body or links.
        console.info(`[mail] development outbox: ${path.relative(process.cwd(), file)}`);
      },
    };
  }
  throw new Error("Email is not configured: set SMTP_HOST (and related SMTP_* variables).");
}

/** Sends an email. Throws on failure; callers decide how to surface it. */
export async function sendEmail(message: EmailMessage): Promise<void> {
  transport ??= createTransport().catch((error) => {
    transport = undefined;
    throw error;
  });
  await (await transport).sendMail({ ...message, from: env().MAIL_FROM });
}
