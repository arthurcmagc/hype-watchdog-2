// src/app/api/unifi-cloud/sites/route.ts

import { NextRequest, NextResponse } from "next/server";
import { listUnifiSites, UnifiRawSite } from "@/lib/unifiSiteManager";
import { listUnifiDevices } from "@/lib/unifiClient";
import {
  computeSiteStatus,
  SiteStatusSummary,
} from "@/lib/siteStatus";
import { syncSiteStatusAndGenerateEvents } from "@/lib/events";

interface UnifiHostWithDevices {
  hostId?: string;
  host_id?: string;
  hostName?: string;
  name?: string;
  devices?: any[];
}

// --------------------------------------------------------------------------------
// Helper para pegar o ID real
// --------------------------------------------------------------------------------
function extractUnifiId(obj: any): string | null {
  if (!obj) return null;

  const keys = ["hostId", "host_id", "siteId", "site_id", "id", "_id"];

  for (const k of keys) {
    const v = obj[k];
    if (v && typeof v === "string" && v.trim() !== "") {
      return v.trim();
    }
  }

  return null;
}

// --------------------------------------------------------------------------------
// GET
// --------------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    // 1) Obter sites + devices em paralelo
    const [rawSites, devicesResponse] = await Promise.all([
      listUnifiSites(),
      listUnifiDevices(),
    ]);

    const hosts: UnifiHostWithDevices[] =
      ((devicesResponse as any)?.data as UnifiHostWithDevices[]) ?? [];

    // 2) Criar mapa hostId -> host
    const hostById = new Map<string, UnifiHostWithDevices>();

    for (const host of hosts) {
      const key = extractUnifiId(host);
      if (!key) continue;
      hostById.set(key, host);
    }

    // 3) Resolver status de cada site
    const sites: SiteStatusSummary[] = (rawSites as UnifiRawSite[]).map(
      (site) => {
        const siteKey = extractUnifiId(site);
        const deviceHost = siteKey ? hostById.get(siteKey) ?? null : null;

        const summary = computeSiteStatus({
          rawSite: site,
          deviceHost,
        });

        // ------------------------
        // DEBUG ESPECÍFICO — PRINTA NO TERMINAL
        // ------------------------
        if (summary.siteName.toLowerCase().includes("one investimentos - sao paulo")) {
          console.log("======= DEBUG ONE SAO PAULO =======");
          console.log("rawSite:", JSON.stringify(site, null, 2));
          console.log("deviceHost:", JSON.stringify(deviceHost, null, 2));
          console.log("summary:", JSON.stringify(summary, null, 2));
          console.log("===================================");
        }

        return summary;
      }
    );

    // 4) Gerar eventos / histórico
    try {
      await syncSiteStatusAndGenerateEvents(sites);
    } catch (err) {
      console.error("Erro sync events:", err);
    }

    // 5) Agregados
    const stats = sites.reduce(
      (acc, s) => {
        acc.totalSites++;
        if (s.overallStatus === "online") acc.online++;
        else if (s.overallStatus === "unstable") acc.unstable++;
        else if (s.overallStatus === "offline") acc.offline++;
        else acc.unknown++;

        if (s.overallStatus === "online" || s.overallStatus === "unstable") {
          acc.operational++;
        }

        return acc;
      },
      {
        totalSites: 0,
        online: 0,
        unstable: 0,
        offline: 0,
        unknown: 0,
        operational: 0,
      }
    );

    return NextResponse.json({ ok: true, stats, sites });
  } catch (err) {
    console.error("Erro geral:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}