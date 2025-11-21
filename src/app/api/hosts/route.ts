import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // ONLINE | OFFLINE | UNSTABLE | UNKNOWN | ALL | null

    const where: any = {
      isPrimaryHost: true,
    };

    if (status && status !== "ALL") {
      where.normalizedStatus = status;
    }

    const devices = await prisma.device.findMany({
      where,
      include: {
        site: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    const result = devices.map((d) => ({
      id: d.id,
      siteName: d.site?.name ?? "Unknown site",
      hostName: d.name ?? d.externalDeviceId,
      ipAddress: d.ipAddress,
      status: d.normalizedStatus,
      wan1Status: d.wan1Status,
      wan2Status: d.wan2Status,
      lastSeenAt: d.lastSeenAt,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/hosts] error:", error);
    return NextResponse.json(
      { error: "Erro ao listar hosts principais." },
      { status: 500 },
    );
  }
}