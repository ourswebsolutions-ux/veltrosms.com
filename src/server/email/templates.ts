import "server-only";
import { siteConfig } from "@/config/site";
import type { EmailMessage } from "./mailer";

/** Escape user-controlled text before putting it in HTML. */
function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Minimal, email-client-safe layout in the product's colours. */
function layout(opts: { heading: string; paragraphs: string[]; action?: { label: string; url: string }; footnote?: string }) {
  const p = opts.paragraphs.map((t) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#22252d">${t}</p>`).join("");
  const button = opts.action
    ? `<p style="margin:22px 0"><a href="${esc(opts.action.url)}" style="display:inline-block;background:#0f3b6a;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:8px">${esc(opts.action.label)}</a></p>
       <p style="margin:0 0 14px;font-size:13px;line-height:1.5;color:#6b6f7b">If the button doesn't work, copy this link into your browser:<br><span style="word-break:break-all;color:#0f3b6a">${esc(opts.action.url)}</span></p>`
    : "";
  const foot = opts.footnote ? `<p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#6b6f7b">${opts.footnote}</p>` : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f4f4;font-family:Manrope,Segoe UI,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:28px">
<tr><td>
<p style="margin:0 0 20px;font-size:22px;font-weight:800;color:#0f3b6a">${esc(siteConfig.shortName)}<span style="color:#c19b4c">${esc(siteConfig.wordmarkAccent)}</span></p>
<h1 style="margin:0 0 14px;font-size:22px;color:#22252d">${esc(opts.heading)}</h1>
${p}${button}${foot}
</td></tr></table>
<p style="margin:14px 0 0;font-size:12px;color:#9a9da6">${esc(siteConfig.name)} · ${esc(siteConfig.supportEmail)}</p>
</td></tr></table></body></html>`;
}

function text(lines: string[]): string {
  return [...lines, "", `— ${siteConfig.name}`].join("\n");
}

export function passwordResetEmail(to: string, name: string, url: string, minutes: number): EmailMessage {
  return {
    to,
    subject: `Reset your ${siteConfig.name} password`,
    html: layout({
      heading: "Reset your password",
      paragraphs: [`Hi ${esc(name)},`, "We received a request to reset your password. Use the button below to choose a new one."],
      action: { label: "Choose a new password", url },
      footnote: `This link expires in ${minutes} minutes and can be used once. If you didn't request a reset, you can ignore this email — your password won't change.`,
    }),
    text: text([`Hi ${name},`, "", "Reset your password using this link:", url, "", `It expires in ${minutes} minutes and works once.`, "If you didn't request this, ignore this email."]),
  };
}

export function passwordChangedEmail(to: string, name: string, resetUrl: string): EmailMessage {
  return {
    to,
    subject: `Your ${siteConfig.name} password was changed`,
    html: layout({
      heading: "Your password was changed",
      paragraphs: [
        `Hi ${esc(name)},`,
        "The password for your account was just changed and other signed-in devices were logged out.",
        `If this wasn't you, <a href="${esc(resetUrl)}" style="color:#0f3b6a">reset your password</a> immediately and contact support.`,
      ],
    }),
    text: text([`Hi ${name},`, "", "Your password was just changed and other devices were logged out.", `If this wasn't you, reset it now: ${resetUrl}`]),
  };
}

/** "alice@example.com" → "al***@example.com" (for notices sent to the old address). */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

export function emailChangeConfirmEmail(to: string, name: string, url: string, hours: number): EmailMessage {
  return {
    to,
    subject: `Confirm your new email for ${siteConfig.name}`,
    html: layout({
      heading: "Confirm your new email",
      paragraphs: [`Hi ${esc(name)},`, "Confirm this address to make it the new login email for your account."],
      action: { label: "Confirm new email", url },
      footnote: `This link expires in ${hours} hours. If you didn't ask for this, ignore this email — nothing changes.`,
    }),
    text: text([`Hi ${name},`, "", "Confirm this address as your new login email:", url, "", `This link expires in ${hours} hours.`, "If you didn't ask for this, ignore this email."]),
  };
}

export function emailChangeRequestedEmail(to: string, name: string, newEmailMasked: string, resetUrl: string): EmailMessage {
  return {
    to,
    subject: `Email change requested on ${siteConfig.name}`,
    html: layout({
      heading: "Email change requested",
      paragraphs: [
        `Hi ${esc(name)},`,
        `Someone signed in to your account asked to change its email to <b>${esc(newEmailMasked)}</b>. Nothing changes until that address is confirmed.`,
        `If this wasn't you, <a href="${esc(resetUrl)}" style="color:#0f3b6a">reset your password</a> now — it also logs out every device.`,
      ],
    }),
    text: text([`Hi ${name},`, "", `A change of your account email to ${newEmailMasked} was requested. Nothing changes until it is confirmed.`, `If this wasn't you, reset your password: ${resetUrl}`]),
  };
}

export function emailChangedEmail(to: string, name: string, newEmailMasked: string): EmailMessage {
  return {
    to,
    subject: `Your ${siteConfig.name} email was changed`,
    html: layout({
      heading: "Your email was changed",
      paragraphs: [
        `Hi ${esc(name)},`,
        `Your account's login email is now <b>${esc(newEmailMasked)}</b> and all devices were logged out.`,
        `If you didn't do this, contact ${esc(siteConfig.supportEmail)} right away.`,
      ],
    }),
    text: text([`Hi ${name},`, "", `Your login email is now ${newEmailMasked} and all devices were logged out.`, `If you didn't do this, contact ${siteConfig.supportEmail}.`]),
  };
}

/** Sent to an address that already has an account when another account tries to switch to it. */
export function emailInUseEmail(to: string, name: string, resetUrl: string): EmailMessage {
  return {
    to,
    subject: `Someone tried to use your email on ${siteConfig.name}`,
    html: layout({
      heading: "Your email is already in use",
      paragraphs: [
        `Hi ${esc(name)},`,
        "Another account tried to change its email to this address. It already belongs to your account, so nothing was changed.",
        `If you've lost access, you can <a href="${esc(resetUrl)}" style="color:#0f3b6a">reset your password</a>.`,
      ],
      footnote: "No action is needed.",
    }),
    text: text([`Hi ${name},`, "", "Another account tried to switch to this email. It already belongs to you, so nothing changed.", `Reset password: ${resetUrl}`]),
  };
}

export function topUpRequestAdminEmail(
  to: string,
  r: { reference: string; customer: string; amount: string; method: string; transactionId: string; url: string },
): EmailMessage {
  return {
    to,
    subject: `New top-up request ${r.reference} — ${r.amount}`,
    html: layout({
      heading: "New manual top-up request",
      paragraphs: [
        `<b>${esc(r.customer)}</b> submitted a ${esc(r.method)} top-up of <b>${esc(r.amount)}</b>.`,
        `Transaction ID: <b>${esc(r.transactionId)}</b> · Request ${esc(r.reference)}`,
        "Check the payment in the account statement before approving.",
      ],
      action: { label: "Review request", url: r.url },
    }),
    text: text([`New ${r.method} top-up of ${r.amount} from ${r.customer}.`, `Transaction ID: ${r.transactionId} (request ${r.reference})`, `Review: ${r.url}`]),
  };
}

export function topUpApprovedEmail(to: string, name: string, amount: string, reference: string, url: string): EmailMessage {
  return {
    to,
    subject: `Your ${siteConfig.name} top-up was approved`,
    html: layout({
      heading: "Top-up approved",
      paragraphs: [`Hi ${esc(name)},`, `Your top-up ${esc(reference)} has been approved and <b>${esc(amount)}</b> was added to your balance.`],
      action: { label: "Buy a number", url },
    }),
    text: text([`Hi ${name},`, "", `Your top-up ${reference} was approved and ${amount} was added to your balance.`, url]),
  };
}

export function topUpRejectedEmail(to: string, name: string, reference: string, reason: string, url: string): EmailMessage {
  return {
    to,
    subject: `Your ${siteConfig.name} top-up request was rejected`,
    html: layout({
      heading: "Top-up request rejected",
      paragraphs: [
        `Hi ${esc(name)},`,
        `Your top-up request ${esc(reference)} was rejected: ${esc(reason)}`,
        "Please check the details you provided or contact support on WhatsApp.",
      ],
      action: { label: "View request", url },
    }),
    text: text([`Hi ${name},`, "", `Your top-up request ${reference} was rejected: ${reason}`, "Please check the details or contact support.", url]),
  };
}
