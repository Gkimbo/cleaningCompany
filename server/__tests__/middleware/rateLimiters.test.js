/**
 * Tests for server/middleware/rateLimiters.js
 *
 * Verifies:
 *  - All three limiters are exported as Express middleware functions
 *  - financialKeyGenerator uses user ID prefix when authenticated
 *  - financialKeyGenerator uses IP prefix for unauthenticated requests
 *  - makeStore returns undefined (in-memory) when REDIS_URL is absent
 *  - makeStore returns a RedisStore when REDIS_URL is present
 */

// Mock ioredis (hoisted) so no real Redis connection is attempted
jest.mock("ioredis", () =>
  jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    call: jest.fn().mockResolvedValue("OK"),
  }))
);

// Mock rate-limit-redis with a store that satisfies express-rate-limit's interface
jest.mock("rate-limit-redis", () => ({
  RedisStore: jest.fn().mockImplementation(({ prefix }) => ({
    _isRedisStore: true,
    prefix,
    // express-rate-limit v7 requires these methods on a custom store
    init: jest.fn(),
    increment: jest.fn().mockResolvedValue({ totalHits: 1, resetTime: new Date() }),
    decrement: jest.fn().mockResolvedValue(undefined),
    resetKey: jest.fn().mockResolvedValue(undefined),
    resetAll: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
  })),
}));

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.REDIS_URL;
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

describe("rateLimiters — exports", () => {
  it("exports financialLimiter as an Express middleware function", () => {
    const { financialLimiter } = require("../../middleware/rateLimiters");
    expect(typeof financialLimiter).toBe("function");
  });

  it("exports apiLimiter as an Express middleware function", () => {
    const { apiLimiter } = require("../../middleware/rateLimiters");
    expect(typeof apiLimiter).toBe("function");
  });

  it("exports authLimiter as an Express middleware function", () => {
    const { authLimiter } = require("../../middleware/rateLimiters");
    expect(typeof authLimiter).toBe("function");
  });

  it("exports financialKeyGenerator as a function", () => {
    const { financialKeyGenerator } = require("../../middleware/rateLimiters");
    expect(typeof financialKeyGenerator).toBe("function");
  });

  it("exports makeStore as a function", () => {
    const { makeStore } = require("../../middleware/rateLimiters");
    expect(typeof makeStore).toBe("function");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// financialKeyGenerator (exported pure function — no middleware overhead)
// ─────────────────────────────────────────────────────────────────────────────

describe("financialKeyGenerator", () => {
  let financialKeyGenerator;

  beforeEach(() => {
    ({ financialKeyGenerator } = require("../../middleware/rateLimiters"));
  });

  it("returns user:<id> when req.user.id is present", () => {
    expect(financialKeyGenerator({ user: { id: 42 }, ip: "1.2.3.4" })).toBe("user:42");
  });

  it("returns ip:<addr> when req.user is absent", () => {
    expect(financialKeyGenerator({ user: undefined, ip: "1.2.3.4" })).toBe("ip:1.2.3.4");
  });

  it("returns ip:<addr> when req.user has no id field", () => {
    expect(financialKeyGenerator({ user: {}, ip: "5.6.7.8" })).toBe("ip:5.6.7.8");
  });

  it("returns ip:unknown when neither user nor IP is available", () => {
    expect(financialKeyGenerator({ user: undefined, ip: undefined })).toBe("ip:unknown");
  });

  it("produces distinct keys for two different authenticated users", () => {
    const k1 = financialKeyGenerator({ user: { id: 1 }, ip: "1.2.3.4" });
    const k2 = financialKeyGenerator({ user: { id: 2 }, ip: "1.2.3.4" });
    expect(k1).not.toBe(k2);
  });

  it("user key and ip key are distinct even when the numbers match", () => {
    const userKey = financialKeyGenerator({ user: { id: 123 }, ip: "0.0.0.0" });
    const ipKey = financialKeyGenerator({ user: undefined, ip: "123" });
    expect(userKey).not.toBe(ipKey);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// makeStore — Redis vs in-memory fallback
// ─────────────────────────────────────────────────────────────────────────────

describe("makeStore — Redis vs in-memory", () => {
  it("returns undefined (in-memory fallback) when REDIS_URL is not set", () => {
    delete process.env.REDIS_URL;
    const { makeStore } = require("../../middleware/rateLimiters");
    expect(makeStore("rl:test:")).toBeUndefined();
  });

  it("returns a store object when REDIS_URL is configured", () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    const { makeStore } = require("../../middleware/rateLimiters");
    const store = makeStore("rl:test:");
    expect(store).toBeDefined();
    expect(store._isRedisStore).toBe(true);
  });

  it("passes the correct prefix to the RedisStore", () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    const { makeStore } = require("../../middleware/rateLimiters");
    const store = makeStore("rl:financial:");
    expect(store.prefix).toBe("rl:financial:");
  });

  it("different prefix strings produce separate stores", () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    const { makeStore } = require("../../middleware/rateLimiters");
    const s1 = makeStore("rl:api:");
    const s2 = makeStore("rl:auth:");
    expect(s1.prefix).not.toBe(s2.prefix);
  });
});
