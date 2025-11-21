// src/app/api/unifi/test-connection/route.ts
import { NextResponse } from 'next/server';
import { listUnifiDevices } from '@/lib/unifiClient';

export async function GET() {
  try {
    const data = await listUnifiDevices();
    const hosts = data.data ?? [];

    const devicesCount = hosts.reduce((acc, host) => {
      return acc + (host.devices?.length ?? 0);
    }, 0);

    return NextResponse.json({
      ok: true,
      hosts: hosts.length,
      devices: devicesCount,
    });
  } catch (error: any) {
    console.error('[GET /api/unifi/test-connection] error:', error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          'Erro ao testar conexão com a UniFi Cloud. Verifique UNIFI_API_BASE_URL e UNIFI_API_TOKEN.',
      },
      { status: 500 },
    );
  }
}