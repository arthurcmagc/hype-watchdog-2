// src/app/api/unifi/test-alert/route.ts
import { NextResponse } from 'next/server';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ALERT_TEST_EMAIL_TO = process.env.ALERT_TEST_EMAIL_TO; // opcional, ver .env

type AlertType = 'host_offline' | 'wan1_down' | 'wan2_down';

const ALERT_TITLES: Record<AlertType, string> = {
  host_offline: 'Host Offline',
  wan1_down: 'WAN 1 Down',
  wan2_down: 'WAN 2 Down',
};

const ALERT_SEVERITY: Record<AlertType, 'CRITICAL' | 'WARNING'> = {
  host_offline: 'CRITICAL',
  wan1_down: 'WARNING',
  wan2_down: 'WARNING',
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const siteName: string | null = body.siteName ?? null;
    const alertType: AlertType = body.alertType ?? 'host_offline';

    // Se não quiser enviar de verdade, só simula aqui:
    if (!RESEND_API_KEY || !ALERT_TEST_EMAIL_TO) {
      console.warn(
        '[POST /api/unifi/test-alert] RESEND_API_KEY ou ALERT_TEST_EMAIL_TO não configurados. Simulando envio.',
      );

      return NextResponse.json({
        ok: true,
        simulated: true,
        message:
          'Simulação de alerta de teste concluída (configure RESEND_API_KEY e ALERT_TEST_EMAIL_TO para enviar e-mail real).',
      });
    }

    const title = ALERT_TITLES[alertType] ?? 'Alerta de Teste';
    const severity = ALERT_SEVERITY[alertType] ?? 'WARNING';

    const html = `
      <h1>[TESTE] Hype WatchDog – ${title}</h1>
      <p>Este é um alerta de <strong>teste</strong> enviado pelo Hype WatchDog.</p>
      <p><strong>Site:</strong> ${siteName || 'N/A'}</p>
      <p><strong>Tipo de alerta:</strong> ${title}</p>
      <p><strong>Severidade:</strong> ${severity}</p>
      <hr/>
      <p>Se você recebeu este e-mail, a integração com o Resend está funcionando.</p>
    `;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Hype WatchDog <alerts@hype-watchdog.local>',
        to: [ALERT_TEST_EMAIL_TO],
        subject: `[TESTE] ${title} – ${siteName ?? 'Hype WatchDog'}`,
        html,
      }),
    });

    if (!resendRes.ok) {
      const text = await resendRes.text();
      console.error('Falha ao chamar Resend:', resendRes.status, text);
      return NextResponse.json(
        {
          ok: false,
          error: 'Falha ao enviar e-mail via Resend. Veja logs do servidor.',
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'Alerta de teste enviado com sucesso via Resend.',
    });
  } catch (error: any) {
    console.error('[POST /api/unifi/test-alert] error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Erro inesperado ao enviar alerta de teste.',
      },
      { status: 500 },
    );
  }
}