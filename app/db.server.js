import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

let prisma;

function getPrismaClient() {
  if (prisma) return prisma;

  if (process.env.TURSO_DATABASE_URL) {
    // Production / Vercel: use Turso via libSQL driver adapter
    const libsql = createClient({
      url: process.env.TURSO_DATABASE_URL.trim(),
      authToken: process.env.TURSO_AUTH_TOKEN?.trim(),
    });
    const adapter = new PrismaLibSQL(libsql);
    prisma = new PrismaClient({ adapter });
  } else {
    // Local development: use file-based SQLite (no adapter)
    prisma = new PrismaClient();
  }

  if (process.env.NODE_ENV !== "production") {
    global.prismaClient = prisma;
  }

  return prisma;
}

// Use cached global in dev to prevent hot-reload from creating new connections
if (process.env.NODE_ENV !== "production" && global.prismaClient) {
  prisma = global.prismaClient;
}

export default new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getPrismaClient();
      return client[prop];
    },
  }
);
