// src/lib/events.ts
import { prisma } from "@/lib/prisma";
import type { SiteStatusSummary } from "@/lib/siteStatus";
import { sendAlertEmail } from "@/lib/alerts";

export type EventSeverity = "CRITICAL" | "WARNING" | "INFO";

export interface EventLike {
  id: string;
  siteId: string | null;
  hostId: string | null;
  siteName: string;
  deviceName: string | null;
  severity: EventSeverity | string;
  type: string;
  title: string;
  message: string | null;
  isPrimaryHost: boolean;
  createdAt: string;
}

/**
 * Sincroniza o status dos sites com a tabela SiteStatusSnapshot
 * e gera eventos agregados na tabela Event (UP/DOWN e parque de devices).
 *
 * OBS: uso (prisma as any) para não esquentar com d.ts do Prisma.
 */
export async function syncSiteStatusAndGenerateEvents(
  sites: SiteStatusSummary[]
) {
  const prismaAny = prisma as any;

  for (const site of sites) {
    const key = site.hostId ?? site.siteId;
    if (!key) continue;

    const totalDevices = site.deviceStats.total ?? 0;
    const offlineDevices = site.deviceStats.offline ?? 0;

    // snapshot anterior, se existir
    const prev = await prismaAny.siteStatusSnapshot.findUnique({
      where: { key },
    });

    const baseSnapshot = {
      key,
      siteId: site.siteId ?? null,
      hostId: site.hostId ?? null,
      siteName: site.siteName,
      overallStatus: site.overallStatus,
      totalDevices,
      offlineDevices,
    };

    // se nunca vimos esse site antes: cria snapshot e NÃO gera evento
    if (!prev) {
      await prismaAny.siteStatusSnapshot.create({
        data: baseSnapshot,
      });
      continue;
    }

    const eventsToCreate: {
      severity: EventSeverity;
      type: string;
      title: string;
      message?: string;
    }[] = [];

    // --------- 1) Mudança de overallStatus (UP/DOWN de site) --------- //

    const prevStatus =
      (prev.overallStatus as SiteStatusSummary["overallStatus"]) ?? "unknown";
    const currStatus = site.overallStatus;

    if (prevStatus !== currStatus) {
      // caiu para OFFLINE
      if (currStatus === "offline") {
        eventsToCreate.push({
          severity: "CRITICAL",
          type: "SITE_OFFLINE",
          title: `Site offline: ${site.siteName}`,
          message: `O site "${site.siteName}" passou de ${prevStatus.toUpperCase()} para OFFLINE.`,
        });

        await sendAlertEmail({
          subject: `🔥 [Hype Watchdog] SITE OFFLINE – ${site.siteName}`,
          html: `<p>O site <strong>${site.siteName}</strong> ficou <strong>OFFLINE</strong>.</p>
<p>Status anterior: <strong>${prevStatus}</strong><br/>
Status atual: <strong>${currStatus}</strong></p>`,
        });
      }

      // saiu de OFFLINE para ONLINE / UNSTABLE
      if (prevStatus === "offline" && currStatus !== "offline") {
        eventsToCreate.push({
          severity: "INFO",
          type: "SITE_ONLINE",
          title: `Site voltou: ${site.siteName}`,
          message: `O site "${site.siteName}" saiu de OFFLINE para ${currStatus.toUpperCase()}.`,
        });

        await sendAlertEmail({
          subject: `✅ [Hype Watchdog] SITE OK – ${site.siteName}`,
          html: `<p>O site <strong>${site.siteName}</strong> saiu de OFFLINE.</p>
<p>Status atual: <strong>${currStatus}</strong></p>`,
        });
      }
    }

    // --------- 2) Mudança no total de devices offline --------- //

    const prevOffline: number = prev.offlineDevices ?? 0;
    const currOffline: number = offlineDevices;

    // antes 0, agora >0 → WARNING
    if (prevOffline === 0 && currOffline > 0) {
      eventsToCreate.push({
        severity: "WARNING",
        type: "DEVICES_PARTIAL_DOWN",
        title: `Devices offline em ${site.siteName}`,
        message: `Agora existem ${currOffline} devices offline (de ${totalDevices}). Antes não havia nenhum offline.`,
      });
    }

    // antes >0, agora 0 → INFO
    if (prevOffline > 0 && currOffline === 0) {
      eventsToCreate.push({
        severity: "INFO",
        type: "DEVICES_RECOVERED",
        title: `Devices normalizados em ${site.siteName}`,
        message: `Todos os devices voltaram. Antes havia ${prevOffline} offline (de ${totalDevices}).`,
      });
    }

    // --------- 3) Persistência: snapshot + eventos --------- //

    if (eventsToCreate.length > 0) {
      const now = new Date();

      await prismaAny.siteStatusSnapshot.update({
        where: { key },
        data: {
          ...baseSnapshot,
          lastChangeAt: now,
        },
      });

      await prismaAny.event.createMany({
        data: eventsToCreate.map((e) => ({
          siteId: site.siteId ?? null,
          hostId: site.hostId ?? null,
          siteName: site.siteName,
          deviceName: null,
          severity: e.severity,
          type: e.type,
          title: e.title,
          message: e.message ?? null,
          isPrimaryHost: true,
          createdAt: now,
        })),
      });
    } else {
      // nenhuma mudança relevante -> só mantém snapshot atualizado
      await prismaAny.siteStatusSnapshot.update({
        where: { key },
        data: baseSnapshot,
      });
    }
  }
}