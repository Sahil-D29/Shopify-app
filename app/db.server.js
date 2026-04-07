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
    // Remix's node adapter patches global fetch; libsql passes a Request
    // object to it which the patched fetch then re-stringifies, producing
    // "[object Request]" and a URL parse error. Force libsql to use the
    // unpatched undici fetch.
    const libsql = createClient({
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN?.trim(),
      fetch: (input, init) => {
        if (input && typeof input === "object" && input.url) {
          // input is a Request — unwrap to (url, init) which works on every fetch impl
          const headers = {};
          input.headers.forEach((v, k) => (headers[k] = v));
          return fetch(input.url, {
            method: input.method,
            headers,
            body: input.body,
            duplex: input.body ? "half" : undefined,
            ...init,
          });
        }
        return fetch(input, init);
      },
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
