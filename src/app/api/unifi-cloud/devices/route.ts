import { NextResponse } from 'next/server';
import { listUnifiDevices } from '@/lib/unifiClient';

export async function GET() {
  try {
    const devices = await listUnifiDevices();
    return NextResponse.json({ ok: true, data: devices });
  } catch (error: any) {
    console.error('Erro ao listar devices UniFi Cloud:', error);
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'Erro ao falar com a UniFi Cloud' },
      { status: 500 }
    );
  }
}