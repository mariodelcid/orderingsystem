const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  await prisma.setting.upsert({
    where: { key: "adminPin" },
    create: { key: "adminPin", value: "2026" },
    update: {}
  });
  await prisma.setting.upsert({
    where: { key: "storeName" },
    create: { key: "storeName", value: "Chilero" },
    update: {}
  });
  // Hide POS bookkeeping items from the kiosk by default
  for (const itemName of ["Discount"]) {
    await prisma.itemInfo.upsert({
      where: { itemName },
      create: { itemName, hidden: true },
      update: {}
    });
  }
  console.log("Seed OK");
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
