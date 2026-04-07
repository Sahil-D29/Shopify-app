import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client/web";

let prisma;

function getPrismaClient() {
  if (prisma) return prisma;

  if (process.env.TURSO_DATABASE_URL) {
    // Production / Vercel: use Turso via libSQL driver adapter
    // The web client requires an https:// URL. Convert libsql:// → https://.
    const tursoUrl = process.env.TURSO_DATABASE_URL.trim().replace(
      /^libsql:\/\//,
      "https://"
    );
    const libsql = createClient({
      url: tursoUrl,
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
