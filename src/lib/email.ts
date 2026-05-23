import type { Env } from "../types";

const RESEND_API_URL = "https://api.resend.com/emails";

export interface LeadNotificationData {
  lead_id: number;
  session_id: string;
  name: string;
  email: string;
  phone: string | null;
  organization: string | null;
  reason: string;
  intent: string | null;
  opt_in_email: number;
  created_at_unix?: number;
}

function buildLeadEmailHtml(d: LeadNotificationData): string {
  const rows = [
    ["Lead ID", String(d.lead_id)],
    ["Session ID", d.session_id],
    ["Name", d.name],
    ["Email", d.email],
    ["Phone", d.phone ?? "—"],
    ["Organization", d.organization ?? "—"],
    ["Reason", d.reason],
    ["Intent", d.intent ?? "—"],
    ["Opt-in email", d.opt_in_email ? "Yes" : "No"],
    [
      "Submitted",
      d.created_at_unix
        ? new Date(d.created_at_unix * 1000).toUTCString()
        : new Date().toUTCString(),
    ],
  ];

  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px;font-weight:bold;white-space:nowrap">${label}</td>` +
        `<td style="padding:6px 12px">${value}</td></tr>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="margin-bottom:4px">New lead from mihirtrivedi.tech</h2>
  <p style="color:#555;margin-top:0">A visitor submitted the contact form.</p>
  <table style="border-collapse:collapse;width:100%;background:#f9f9f9;border-radius:6px">
    <tbody>
      ${tableRows}
    </tbody>
  </table>
  <p style="color:#999;font-size:12px;margin-top:24px">
    Sent by mihir-ai-worker · do not reply to this message
  </p>
</body>
</html>`;
}

export interface SendResult {
  success: boolean;
  errorMessage?: string;
}

export async function sendLeadNotification(
  env: Env,
  data: LeadNotificationData,
): Promise<SendResult> {
  if (!env.RESEND_API_KEY || !env.LEAD_NOTIFY_TO || !env.LEAD_NOTIFY_FROM) {
    return { success: false, errorMessage: "Resend env vars not configured" };
  }

  const subject = `New lead: ${data.name} (${data.organization ?? data.email})`;

  let res: Response;
  try {
    res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.LEAD_NOTIFY_FROM,
        to: [env.LEAD_NOTIFY_TO],
        subject,
        html: buildLeadEmailHtml(data),
      }),
    });
  } catch (err) {
    return { success: false, errorMessage: `fetch error: ${String(err)}` };
  }

  if (!res.ok) {
    // Read body for logging but never surface it to the caller untrusted.
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      // ignore
    }
    return {
      success: false,
      errorMessage: `Resend HTTP ${res.status}: ${detail.slice(0, 200)}`,
    };
  }

  return { success: true };
}
