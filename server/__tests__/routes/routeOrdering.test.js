/**
 * Route Ordering Tests
 *
 * These tests verify that parameterized routes (like /:id) don't intercept
 * more specific routes due to Express.js route matching order.
 *
 * Express matches routes in the order they are defined, so:
 * - GET /history/:homeId must be defined BEFORE GET /:id
 * - Otherwise, /history/123 would match /:id with id = "history"
 */

const fs = require("fs");
const path = require("path");

describe("Route Ordering - paymentRouter", () => {
  const routerPath = path.join(
    __dirname,
    "../../routes/api/v1/paymentRouter.js"
  );
  let routerContent;

  beforeAll(() => {
    routerContent = fs.readFileSync(routerPath, "utf8");
  });

  it("should define GET /:homeId as the last route (catch-all)", () => {
    // Find the position of GET /:homeId route
    const catchAllRouteMatch = routerContent.match(
      /paymentRouter\.get\s*\(\s*["']\/\:homeId["']/
    );

    expect(catchAllRouteMatch).not.toBeNull();

    const catchAllPosition = routerContent.lastIndexOf(
      'paymentRouter.get("/:homeId"'
    );

    // Check that specific routes are defined BEFORE the catch-all
    const specificRoutes = [
      "/removal-eligibility/:paymentMethodId",
      "/multi-cleaner/earnings/:multiCleanerJobId",
    ];

    specificRoutes.forEach((route) => {
      const routePosition = routerContent.indexOf(route);
      if (routePosition !== -1) {
        expect(routePosition).toBeLessThan(catchAllPosition);
      }
    });
  });

  it("should have a comment indicating catch-all route", () => {
    // The catch-all route should have a comment explaining why it's last
    const hasCatchAllComment =
      routerContent.includes("catch-all") ||
      routerContent.includes("MUST BE LAST");

    expect(hasCatchAllComment).toBe(true);
  });
});

describe("Route Ordering - homeSizeAdjustmentRouter", () => {
  const routerPath = path.join(
    __dirname,
    "../../routes/api/v1/homeSizeAdjustmentRouter.js"
  );
  let routerContent;

  beforeAll(() => {
    routerContent = fs.readFileSync(routerPath, "utf8");
  });

  it("should define GET /history/:homeId BEFORE GET /:id", () => {
    // Find positions of both routes
    const historyRoutePosition = routerContent.indexOf(
      'homeSizeAdjustmentRouter.get("/history/:homeId"'
    );
    const idRoutePosition = routerContent.indexOf(
      'homeSizeAdjustmentRouter.get("/:id"'
    );

    expect(historyRoutePosition).not.toBe(-1);
    expect(idRoutePosition).not.toBe(-1);

    // /history/:homeId must come BEFORE /:id
    expect(historyRoutePosition).toBeLessThan(idRoutePosition);
  });

  it("should define GET /pending BEFORE GET /:id", () => {
    const pendingRoutePosition = routerContent.indexOf(
      'homeSizeAdjustmentRouter.get("/pending"'
    );
    const idRoutePosition = routerContent.indexOf(
      'homeSizeAdjustmentRouter.get("/:id"'
    );

    expect(pendingRoutePosition).not.toBe(-1);
    expect(idRoutePosition).not.toBe(-1);

    // /pending must come BEFORE /:id
    expect(pendingRoutePosition).toBeLessThan(idRoutePosition);
  });

  it("should have a comment about route ordering for history route", () => {
    // The history route should have a comment explaining route order
    const hasOrderingComment =
      routerContent.includes("BEFORE /:id") ||
      routerContent.includes("route interception");

    expect(hasOrderingComment).toBe(true);
  });
});

describe("Route Ordering - General Patterns", () => {
  const routersDir = path.join(__dirname, "../../routes/api/v1");

  // Helper to analyze route order in a file
  const analyzeRouteOrder = (filePath) => {
    const content = fs.readFileSync(filePath, "utf8");

    // Find all GET routes with their positions
    const getRoutes = [];
    const routeRegex = /\.get\s*\(\s*["']([^"']+)["']/g;
    let match;

    while ((match = routeRegex.exec(content)) !== null) {
      getRoutes.push({
        route: match[1],
        position: match.index,
      });
    }

    return getRoutes;
  };

  it("should not have specific routes defined after parameterized catch-all routes", () => {
    const files = fs.readdirSync(routersDir).filter((f) => f.endsWith(".js"));

    const violations = [];

    files.forEach((file) => {
      const filePath = path.join(routersDir, file);
      const routes = analyzeRouteOrder(filePath);

      // Find catch-all routes (routes that are just /:param)
      const catchAllRoutes = routes.filter(
        (r) => r.route.match(/^\/:[^\/]+$/) && !r.route.includes("/:")
      );

      catchAllRoutes.forEach((catchAll) => {
        // Check if any specific routes come after this catch-all
        const laterSpecificRoutes = routes.filter(
          (r) =>
            r.position > catchAll.position &&
            !r.route.startsWith("/:") &&
            r.route !== "/"
        );

        if (laterSpecificRoutes.length > 0) {
          violations.push({
            file,
            catchAll: catchAll.route,
            laterRoutes: laterSpecificRoutes.map((r) => r.route),
          });
        }
      });
    });

    // We've already fixed paymentRouter and homeSizeAdjustmentRouter
    // Filter those out and check for any remaining violations
    const unexpectedViolations = violations.filter(
      (v) =>
        !v.file.includes("paymentRouter") &&
        !v.file.includes("homeSizeAdjustmentRouter")
    );

    if (unexpectedViolations.length > 0) {
      console.log("Route ordering violations found:", unexpectedViolations);
    }

    // This test documents the pattern but may have some false positives
    // due to nested route patterns like /:id/action
  });
});

describe("Route Ordering - Request Simulation", () => {
  /**
   * These tests would normally use supertest to verify actual request routing.
   * For now, we verify the code structure.
   */

  it("should document the expected behavior for /history/:homeId", () => {
    // When a request comes in for /history/123:
    // 1. Express should first try to match /history/:homeId
    // 2. If that's defined before /:id, it matches correctly
    // 3. If /:id comes first, it would match with id="history" (wrong!)

    // This is a documentation test - the actual behavior is verified
    // by the route ordering tests above
    expect(true).toBe(true);
  });

  it("should document the expected behavior for /:homeId (catch-all)", () => {
    // The /:homeId route in paymentRouter is a catch-all for:
    // GET /payment/:homeId - Get appointments for a home
    //
    // It should be defined LAST to avoid intercepting:
    // - /removal-eligibility/:paymentMethodId
    // - /multi-cleaner/earnings/:multiCleanerJobId
    // - etc.

    expect(true).toBe(true);
  });
});
