// src/app/api/events/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { EventLike } from "@/lib/events";

export async function GET(req: Request) {
  try {
    const searchParams = new URL(req.url).searchParams;

    const severityParam = searchParams.get("severity"); // CRITICAL / WARNING / INFO / ALL
    const primaryOnly = searchParams.get("primaryOnly") === "true";

    const where: { [key: string]: any } = {};

    if (severityParam && severityParam !== "ALL") {
      where.severity = severityParam.toUpperCase();
    }

    if (primaryOnly) {
      where.isPrimaryHost = true;
    }

    const prismaAny = prisma as any;

    const eventsDb = await prismaAny.event.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const payload: EventLike[] = (eventsDb as any[]).map(
      (ev: any): EventLike => ({
        id: String(ev.id),
        siteId: ev.siteId ?? null,
        hostId: ev.hostId ?? null,
        siteName: ev.siteName ?? "Unknown",
        deviceName: ev.deviceName ?? null,
        severity: ev.severity ?? "INFO",
        type: ev.type ?? "GENERIC",
        title: ev.title ?? "",
        message: ev.message ?? null,
        isPrimaryHost: !!ev.isPrimaryHost,
        createdAt:
          ev.createdAt instanceof Date
            ? ev.createdAt.toISOString()
            : String(ev.createdAt),
      })
    );

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error("[API /events] erro:", err);
    return NextResponse.json(
      { error: "Erro ao carregar eventos." },
      { status: 500 }
    );
  }
}