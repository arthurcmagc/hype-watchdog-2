import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Limpando dados anteriores...");
  await prisma.deviceEvent.deleteMany();
  await prisma.apiLog.deleteMany();
  await prisma.device.deleteMany();
  await prisma.site.deleteMany();

  console.log("Criando sites e hosts principais de teste...");

  const sites = await prisma.site.createMany({
    data: [
      {
        name: "ABGI BH",
        externalSiteId: "site-abgi-bh",
        isActive: true,
        normalizedStatus: "ONLINE",
      },
      {
        name: "CLINICA DUO",
        externalSiteId: "site-clinica-duo",
        isActive: true,
        normalizedStatus: "OFFLINE",
      },
      {
        name: "HYPE TECNOLOGIA",
        externalSiteId: "site-hype-tecno",
        isActive: true,
        normalizedStatus: "UNSTABLE",
      },
      {
        name: "GRUPO MINERAR",
        externalSiteId: "site-grupo-minerar",
        isActive: true,
        normalizedStatus: "UNKNOWN",
      },
    ],
  });

  console.log(`Sites criados: ${sites.count}`);

  const abgi = await prisma.site.findUnique({
    where: { externalSiteId: "site-abgi-bh" },
  });
  const duo = await prisma.site.findUnique({
    where: { externalSiteId: "site-clinica-duo" },
  });
  const hype = await prisma.site.findUnique({
    where: { externalSiteId: "site-hype-tecno" },
  });
  const minerar = await prisma.site.findUnique({
    where: { externalSiteId: "site-grupo-minerar" },
  });

  if (!abgi || !duo || !hype || !minerar) {
    throw new Error("Falha ao buscar sites recém-criados.");
  }

  const devices = await prisma.device.createMany({
    data: [
      {
        siteId: abgi.id,
        externalDeviceId: "abgi-bh-console",
        name: "ABGI BH - UCK G2 Plus",
        modelType: "UniFi Console",
        ipAddress: "192.168.0.16",
        rawStatus: "ONLINE",
        normalizedStatus: "ONLINE",
        vendor: "unifi",
        isPrimaryHost: true,
        wan1Status: "ONLINE",
        wan2Status: "ONLINE",
      },
      {
        siteId: duo.id,
        externalDeviceId: "clinica-duo-udm-pro",
        name: "CLINICA DUO - UDM Pro",
        modelType: "UniFi Console",
        ipAddress: "192.168.15.2",
        rawStatus: "OFFLINE",
        normalizedStatus: "OFFLINE",
        vendor: "unifi",
        isPrimaryHost: true,
        wan1Status: "OFFLINE",
        wan2Status: "ONLINE",
      },
      {
        siteId: hype.id,
        externalDeviceId: "hype-tec-main",
        name: "HYPE TECNOLOGIA - Main Host",
        modelType: "UniFi Console",
        ipAddress: "10.0.0.10",
        rawStatus: "UNSTABLE",
        normalizedStatus: "UNSTABLE",
        vendor: "unifi",
        isPrimaryHost: true,
        wan1Status: "ONLINE",
        wan2Status: "OFFLINE",
      },
      {
        siteId: minerar.id,
        externalDeviceId: "miner-main",
        name: "GRUPO MINERAR - Main Host",
        modelType: "UniFi Console",
        ipAddress: "10.0.1.5",
        rawStatus: "UNKNOWN",
        normalizedStatus: "UNKNOWN",
        vendor: "unifi",
        isPrimaryHost: true,
        wan1Status: "UNKNOWN",
        wan2Status: "UNKNOWN",
      },
    ],
  });

  console.log(`Hosts principais criados: ${devices.count}`);

  // Buscar devices para relacionar eventos
  const abgiDevice = await prisma.device.findFirst({
    where: { externalDeviceId: "abgi-bh-console" },
  });
  const duoDevice = await prisma.device.findFirst({
    where: { externalDeviceId: "clinica-duo-udm-pro" },
  });
  const hypeDevice = await prisma.device.findFirst({
    where: { externalDeviceId: "hype-tec-main" },
  });
  const minerarDevice = await prisma.device.findFirst({
    where: { externalDeviceId: "miner-main" },
  });

  if (!abgiDevice || !duoDevice || !hypeDevice || !minerarDevice) {
    throw new Error("Falha ao buscar devices principais.");
  }

  console.log("Criando eventos de teste...");

  await prisma.deviceEvent.createMany({
    data: [
      // Test alerts (CRITICAL)
      {
        deviceId: abgiDevice.id,
        siteId: abgi.id,
        eventType: "test_alert",
        severity: "CRITICAL",
        title: "Test Alert: HOST_OFFLINE_TEST",
        message: "Manual test alert triggered for ABGI BH - ABGI BH",
        rawPayload: null,
      },
      {
        deviceId: hypeDevice.id,
        siteId: hype.id,
        eventType: "test_alert",
        severity: "CRITICAL",
        title: "Test Alert: HOST_OFFLINE_TEST",
        message: "Manual test alert triggered for HYPE TECNOLOGIA - HYPE TECNOLOGIA",
        rawPayload: null,
      },

      // Status change - OFFLINE (CRITICAL)
      {
        deviceId: duoDevice.id,
        siteId: duo.id,
        eventType: "status_change",
        severity: "CRITICAL",
        title: "Device status changed to OFFLINE",
        message:
          "Device CLINICA DUO - UDM Pro at CLINICA DUO changed from ONLINE to OFFLINE",
        rawPayload: null,
      },

      // Status change - WAN warning (WARNING)
      {
        deviceId: hypeDevice.id,
        siteId: hype.id,
        eventType: "wan_status_change",
        severity: "WARNING",
        title: "WAN 2 link down",
        message:
          "Secondary WAN link is DOWN for HYPE TECNOLOGIA - Main Host. Primary WAN remains ONLINE.",
        rawPayload: null,
      },

      // Info (INFO)
      {
        deviceId: abgiDevice.id,
        siteId: abgi.id,
        eventType: "sync",
        severity: "INFO",
        title: "Host synchronized successfully",
        message: "Status and health metrics updated from UniFi API.",
        rawPayload: null,
      },
    ],
  });

  console.log("Eventos de teste criados com sucesso.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });