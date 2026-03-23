/**
 * Health check endpoint for load balancers and deployment monitoring.
 * GET /api/health
 */
export const loader = async () => {
  let dbStatus = "ok";

  try {
    const { default: prisma } = await import("../db.server");
    // Lightweight connectivity check
    await prisma.session.count();
  } catch (e) {
    dbStatus = "error";
  }

  const status = dbStatus === "ok" ? "ok" : "degraded";
  const statusCode = dbStatus === "ok" ? 200 : 503;

  return new Response(
    JSON.stringify({
      status,
      version: "1.0.0",
      database: dbStatus,
      timestamp: new Date().toISOString(),
    }),
    {
      status: statusCode,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store",
      },
    }
  );
};
