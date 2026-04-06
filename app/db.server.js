import { PrismaClient } from "@prisma/client";

let prisma;

function getPrismaClient() {
  if (prisma) return prisma;

  if (process.env.TURSO_DATABASE_URL) {
    // Production / Vercel: use Turso via libSQL driver adapter
    // Use require() to avoid top-level await issues with esbuild
    const { PrismaLibSQL } = require("@prisma/adapter-libsql");
    const { createClient } = require("@libsql/client");

    const libsql = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
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
