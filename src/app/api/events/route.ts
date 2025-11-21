import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const severity = searchParams.get("severity") ?? "ALL"; // ALL | CRITICAL | WARNING | INFO
    const primaryOnly = searchParams.get("primaryOnly") === "true";

    const where: any = {};

    if (severity !== "ALL") {
      where.severity = severity;
    }

    if (primaryOnly) {
      // Apenas eventos de hosts principais
      where.device = {
        isPrimaryHost: true,
      };
    }

    const events = await prisma.deviceEvent.findMany({
      where,
      include: {
        device: true,
        site: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    const result = events.map((e) => ({
      id: e.id,
      siteName: e.site?.name ?? "Unknown site",
      deviceName: e.device?.name ?? e.device?.externalDeviceId ?? "Unknown device",
      severity: e.severity,
      title: e.title,
      message: e.message,
      eventType: e.eventType,
      createdAt: e.createdAt,
      isPrimaryHost: e.device?.isPrimaryHost ?? false,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/events] error:", error);
    return NextResponse.json(
      { error: "Erro ao listar eventos." },
      { status: 500 },
    );
  }
}