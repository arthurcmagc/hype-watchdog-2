// src/app/api/unifi-cloud/sites/route.ts
//
// Endpoint que consolida os dados da UniFi Cloud (sites + devices) e
// retorna um array de SiteStatusSummary + estatísticas agregadas.
//
// Também dispara a geração de eventos históricos via syncSiteStatusAndGenerateEvents.
//

import { NextRequest, NextResponse } from "next/server";
import { listUnifiSites, type UnifiRawSite } from "@/lib/unifiSiteManager";
import { listUnifiDevices } from "@/lib/unifiClient";
import {
  computeSiteStatus,
  type SiteStatusSummary,
} from "@/lib/siteStatus";
import { syncSiteStatusAndGenerateEvents } from "@/lib/events";

interface UnifiHostWithDevices {
  hostId?: string;
  host_id?: string;
  hostName?: string;
  name?: string;
  devices?: any[];
  updatedAt?: string;
  id?: string;
  _id?: string;
}

/**
 * Extrai um identificador estável (hostId/siteId/id/_id) para
 * conseguir fazer o "join" entre lista de sites e lista de hosts.
 */
function extractUnifiId(obj: any): string | null {
  if (!obj) return null;

  const keys = ["hostId", "host_id", "siteId", "site_id", "id", "_id"];
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }

  return null;
}

export async function GET(_req: NextRequest) {
  try {
    const [rawSites, devicesResponse] = await Promise.all([
      listUnifiSites(),
      listUnifiDevices(),
    ]);

    const hosts: UnifiHostWithDevices[] =
      ((devicesResponse as any)?.data as UnifiHostWithDevices[]) ?? [];

    // Índice hostId → host
    const hostById = new Map<string, UnifiHostWithDevices>();
    for (const host of hosts) {
      const key = extractUnifiId(host);
      if (key) {
        hostById.set(key, host);
      }
    }

    const sites: SiteStatusSummary[] = (rawSites as UnifiRawSite[]).map(
      (site) => {
        const siteKey = extractUnifiId(site);
        const deviceHost = siteKey ? hostById.get(siteKey) ?? null : null;

        const summary = computeSiteStatus({
          rawSite: site,
          deviceHost,
        });

        // Logs úteis para depuração (podem ser removidos depois)
        if (summary.debug?.isStale) {
          console.log(
            `[ZOMBIE] ${summary.siteName}: host stale, marcado como OFFLINE.`
          );
        }
        if (summary.debug?.forcedOnlineByCounts) {
          console.log(
            `[API FIX] ${summary.siteName}: reconciliado via counts (falso offline corrigido).`
          );
        }

        return summary;
      }
    );

    // Sincroniza eventos (UP/DOWN) com o banco.
    try {
      await syncSiteStatusAndGenerateEvents(sites);
    } catch (err) {
      console.error("[/api/unifi-cloud/sites] erro ao sincronizar eventos:", err);
    }

    // Estatísticas agregadas para o header do dashboard
    const stats = sites.reduce(
      (acc, site) => {
        acc.totalSites += 1;

        switch (site.overallStatus) {
          case "online":
            acc.online += 1;
            acc.operational += 1;
            break;
          case "unstable":
            acc.unstable += 1;
            acc.operational += 1;
            break;
          case "offline":
            acc.offline += 1;
            break;
          default:
            acc.unknown += 1;
            break;
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

    return NextResponse.json({ ok: true, stats, sites }, { status: 200 });
  } catch (err) {
    console.error("[/api/unifi-cloud/sites] erro geral:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}