// src/app/api/unifi-cloud/sites/[hostId]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { listUnifiSites, UnifiRawSite } from "@/lib/unifiSiteManager";
import { listUnifiDevices } from "@/lib/unifiClient";
import { computeSiteStatus } from "@/lib/siteStatus";

interface UnifiHostWithDevices {
  hostId?: string;
  hostName?: string;
  devices?: Array<{
    status?: string | null;
    isConsole?: boolean;
    [key: string]: any;
  }>;
  [key: string]: any;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { hostId: string } }
) {
  const { hostId } = params;

  try {
    // Mesmos dados que usamos no /api/unifi-cloud/sites
    const [rawSites, devicesResponse] = await Promise.all([
      listUnifiSites(),
      listUnifiDevices(),
    ]);

    const hosts: UnifiHostWithDevices[] =
      ((devicesResponse as any)?.data as UnifiHostWithDevices[]) ?? [];

    // Tenta achar o site pelo hostId; se quiser, pode expandir para siteId/_id
    const rawSite =
      (rawSites as UnifiRawSite[]).find(
        (s: any) =>
          s.hostId === hostId ||
          s.host_id === hostId ||
          s.siteId === hostId ||
          s.site_id === hostId ||
          s._id === hostId
      ) ?? null;

    const deviceHost =
      hosts.find(
        (h) =>
          h.hostId === hostId ||
          (h as any).id === hostId ||
          (h as any).host_id === hostId
      ) ?? null;

    if (!rawSite && !deviceHost) {
      return NextResponse.json(
        { ok: false, error: "site_not_found" },
        { status: 404 }
      );
    }

    // Usa a MESMA lógica central de status do painel principal
    const summary = computeSiteStatus({
      rawSite,
      deviceHost,
    });

    return NextResponse.json({
      ok: true,
      siteId: hostId,
      summary,
      rawSite,
      deviceHost,
    });
  } catch (err) {
    console.error("[GET /api/unifi-cloud/sites/[hostId]] error:", err);

    return NextResponse.json(
      { ok: false, error: "internal_error", details: String(err) },
      { status: 500 }
    );
  }
}