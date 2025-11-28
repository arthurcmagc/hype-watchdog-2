// src/lib/alerts.ts
import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_ALERT_FROM =
  process.env.RESEND_ALERT_FROM ?? "Hype Watchdog <watchdogv2@resend.dev>";
const RESEND_ALERT_TO =
  process.env.RESEND_ALERT_TO ?? "arthurhypedrive@gmail.com";

const resend =
  RESEND_API_KEY && RESEND_API_KEY.trim().length > 0
    ? new Resend(RESEND_API_KEY)
    : null;

/**
 * Envia e-mail de alerta via Resend.
 *
 * Se faltar API key ou remetente/destinatário, apenas loga um aviso e não quebra o fluxo.
 */
export async function sendAlertEmail(payload: {
  subject: string;
  html: string;
}): Promise<void> {
  if (!resend || !RESEND_ALERT_FROM || !RESEND_ALERT_TO) {
    console.warn(
      "[alerts] Resend não configurado. Verifique RESEND_API_KEY, RESEND_ALERT_FROM, RESEND_ALERT_TO."
    );
    return;
  }

  try {
    await resend.emails.send({
      from: RESEND_ALERT_FROM,
      to: [RESEND_ALERT_TO],
      subject: payload.subject,
      html: payload.html,
    });
  } catch (err) {
    console.error("[alerts] erro ao enviar e-mail via Resend:", err);
  }
}