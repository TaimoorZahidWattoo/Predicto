import { prisma } from "db";

const markets = await prisma.market.findMany();
console.log(JSON.stringify(markets, null, 2));

await prisma.$disconnect();
