import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [totalHosts, online, offline, unstable, unknown] =
      await Promise.all([
        prisma.device.count({ where: { isPrimaryHost: true } }),
        prisma.device.count({
          where: { isPrimaryHost: true, normalizedStatus: "ONLINE" },
        }),
        prisma.device.count({
          where: { isPrimaryHost: true, normalizedStatus: "OFFLINE" },
        }),
        prisma.device.count({
          where: { isPrimaryHost: true, normalizedStatus: "UNSTABLE" },
        }),
        prisma.device.count({
          where: { isPrimaryHost: true, normalizedStatus: "UNKNOWN" },
        }),
      ]);

    return NextResponse.json({
      totalHosts,
      online,
      offline,
      unstable,
      unknown,
    });
  } catch (error) {
    console.error("[GET /api/dashboard/stats] error:", error);
    return NextResponse.json(
      { error: "Erro ao calcular estatísticas do dashboard." },
      { status: 500 },
    );
  }
}