import { prisma } from "../../packages/db/index.ts";

try {
  const markets = await prisma.market.findMany();
  console.log(JSON.stringify(markets.slice(0, 3), null, 2));
} catch (err) {
  console.error(err);
} finally {
  await prisma.$disconnect();
}
