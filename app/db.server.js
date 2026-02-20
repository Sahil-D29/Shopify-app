import { PrismaClient } from "@prisma/client";

let prisma;

if (process.env.TURSO_DATABASE_URL) {
  // Production / Vercel: use Turso via libSQL driver adapter
  const { PrismaLibSQL } = await import("@prisma/adapter-libsql");
  const { createClient } = await import("@libsql/client");

  const libsql = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const adapter = new PrismaLibSQL(libsql);
  prisma = global.prismaClient ?? new PrismaClient({ adapter });
} else {
  // Local development: use file-based SQLite (no adapter)
  prisma = global.prismaClient ?? new PrismaClient();
}

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaClient) {
    global.prismaClient = prisma;
  }
}

export default prisma;
