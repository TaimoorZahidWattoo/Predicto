import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(currentDir);
const workspaceRoot = path.resolve(packageRoot, "..", "..");

for (const envPath of [
  path.resolve(packageRoot, ".env"),
  path.resolve(workspaceRoot, ".env"),
]) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
  }
}

const databaseUrl = process.env.DATABASE_URL;
console.log("Prisma DB URL loaded:", databaseUrl ? databaseUrl.replace(/:[^:@]+@/, ":***@") : "<missing>");

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Add it to packages/db/.env or the workspace root .env.");
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

export const prisma = new PrismaClient({
  adapter,
});