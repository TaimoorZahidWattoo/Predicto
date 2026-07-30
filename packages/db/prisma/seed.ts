import { OrderType, PositionType } from "../generated/prisma/enums";
import { randomUUID } from "crypto";

import { existsSync } from "fs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(currentDir, "..");
const workspaceRoot = path.resolve(packageRoot, "..");

for (const envPath of [
  path.resolve(packageRoot, ".env"),
  path.resolve(currentDir, ".env"),
  path.resolve(workspaceRoot, ".env"),
]) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
  }
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  console.error(`Create a .env file in ${packageRoot} or ${workspaceRoot} with a valid PostgreSQL connection string.`);
  console.error('Example: DATABASE_URL="postgresql://postgres:postgres@localhost:5432/prediction_market"');
  process.exit(1);
}

console.log("ENV:", databaseUrl.replace(/:[^:@]+@/, ":***@"));

const { prisma } = await import("../index");
type UserType = {
  id: string;
};

function generateOrderbook(users: UserType[], basePrice: number) {
  const orderbook: Record<
    string,
    {
      availableQty: number;
      orders: {
        userId: string;
        qty: number;
        filledQty: number;
        originalOrderId: string;
        reverseOrder: boolean;
      }[];
    }
  > = {};

  for (let i = -10; i <= 10; i++) {
    const price = Math.min(99, Math.max(1, basePrice + i));

    const orders = [];

    const orderCount = Math.floor(Math.random() * 4) + 2;

    for (let j = 0; j < orderCount; j++) {
      const qty = Math.floor(Math.random() * 250) + 50;
      const user = users[Math.floor(Math.random() * users.length)];

      if (!user) {
        continue;
      }

      orders.push({
        userId: user.id,
        qty,
        filledQty: Math.floor(Math.random() * (qty / 2)),
        originalOrderId: randomUUID(),
        reverseOrder: Math.random() > 0.8,
      });
    }

    orderbook[price.toString()] = {
      availableQty: orders.reduce((a, b) => a + (b.qty - b.filledQty), 0),
      orders,
    };
  }

  return JSON.stringify(orderbook);
}

async function main() {
  await prisma.$connect();

  console.log("🧹 Clearing database...");

  await prisma.orderHistory.deleteMany();
  await prisma.position.deleteMany();
  await prisma.market.deleteMany();
  await prisma.user.deleteMany();

  console.log("👤 Creating users...");

  const users = [];

  for (let i = 1; i <= 100; i++) {
    users.push(
      await prisma.user.create({
        data: {
          address: `0xUSER${i.toString().padStart(4, "0")}`,
          usdBalance: Math.floor(Math.random() * 500000) + 100000,
        },
      })
    );
  }

  console.log("📈 Creating markets...");

  const marketData = [
    {
      title: "Will Bitcoin reach $150,000 before Jan 2027?",
      description:
        "Resolves YES if BTC trades above $150,000 before January 1, 2027.",
      resolutionDescription: "CoinMarketCap closing price.",
      yes: 68,
    },
    {
      title: "Will Ethereum reach a new ATH this year?",
      description:
        "Resolves YES if ETH records a new all-time high before year end.",
      resolutionDescription: "CoinGecko data.",
      yes: 61,
    },
    {
      title: "Will Solana exceed $500 before 2027?",
      description:
        "YES if SOL reaches or exceeds $500.",
      resolutionDescription: "Binance daily candle.",
      yes: 47,
    },
    {
      title: "Will OpenAI release GPT-6 before 2028?",
      description:
        "Official public release of GPT-6.",
      resolutionDescription: "OpenAI announcement.",
      yes: 54,
    },
    {
      title: "Will SpaceX land humans on Mars before 2030?",
      description:
        "Human landing on Mars using SpaceX.",
      resolutionDescription: "Official confirmation.",
      yes: 23,
    },
    {
      title: "Will NVIDIA become the world's most valuable company?",
      description:
        "Highest market capitalization globally.",
      resolutionDescription: "NASDAQ Market Cap.",
      yes: 58,
    },
    {
      title: "Will Apple release a foldable iPhone before 2027?",
      description:
        "Commercial launch of foldable iPhone.",
      resolutionDescription: "Apple event.",
      yes: 41,
    },
    {
      title: "Will Pakistan qualify for the 2027 Cricket World Cup Final?",
      description:
        "Official ICC qualification.",
      resolutionDescription: "ICC website.",
      yes: 35,
    },
    {
      title: "Will Tesla Robotaxi launch worldwide before 2028?",
      description:
        "Worldwide commercial availability.",
      resolutionDescription: "Tesla announcement.",
      yes: 44,
    },
    {
      title: "Will AGI be publicly announced before 2030?",
      description:
        "Major AI company declares AGI publicly available.",
      resolutionDescription: "Official announcement.",
      yes: 19,
    },
  ];

  const markets = [];

  for (const m of marketData) {
    const market = await prisma.market.create({
      data: {
        title: m.title,
        description: m.description,
        resolutionDescription: m.resolutionDescription,
        totalQty: Math.floor(Math.random() * 500000) + 100000,
        yesOrderbook: generateOrderbook(users, m.yes),
        noOrderbook: generateOrderbook(users, 100 - m.yes),
      },
    });

    markets.push(market);
  }

  console.log("💼 Creating positions...");

  for (const user of users) {
    const ownedMarkets = [...markets]
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    for (const market of ownedMarkets) {
      await prisma.position.create({
        data: {
          userId: user.id,
          marketId: market.id,
          type: Math.random() > 0.5 ? PositionType.Yes : PositionType.No,
          qty: Math.floor(Math.random() * 800) + 100,
        },
      });
    }
  }

  console.log("📝 Creating order history...");

  const orderTypes = [
    OrderType.Buy,
    OrderType.Sell,
    OrderType.Split,
    OrderType.Merge,
    ];

    for (let i = 0; i < 2500; i++) {
        const user = users[Math.floor(Math.random() * users.length)];
        const market = markets[Math.floor(Math.random() * markets.length)];
        const orderType = orderTypes[Math.floor(Math.random() * orderTypes.length)];

        if (!user || !market || !orderType) {
            continue;
        }

        await prisma.orderHistory.create({
            data: {
                orderType,
                qty: Math.floor(Math.random() * 400) + 20,
                price: Math.floor(Math.random() * 99) + 1,
                userId: user.id,
                marketId: market.id,
            },
        });
    }

  console.log("✅ Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Seed failed.");
    console.error(e);
    console.error("Check that PostgreSQL is running and DATABASE_URL points to a real database.");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });