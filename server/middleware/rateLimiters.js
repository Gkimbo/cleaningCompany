const rateLimit = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const Redis = require("ioredis");

// Redis client for distributed rate limiting — falls back to in-memory if REDIS_URL not set
let redisClient = null;
if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL, { lazyConnect: true });
  redisClient.on("error", (err) => {
    console.error("[RateLimit] Redis connection error, falling back to in-memory store:", err.message);
    redisClient = null;
  });
} else {
  console.warn("[RateLimit] REDIS_URL not set — using in-memory rate limit store. Set REDIS_URL for distributed deployments.");
}

function makeStore(prefix) {
  if (!redisClient) return undefined; // express-rate-limit defaults to in-memory
  return new RedisStore({ prefix, sendCommand: (...args) => redisClient.call(...args) });
}

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000,
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  store: makeStore("rl:api:"),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per 15 minutes
  message: { error: "Too many login attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  store: makeStore("rl:auth:"),
});

// Exported separately so it can be unit-tested without loading the full limiter
function financialKeyGenerator(req) {
  return req.user?.id ? `user:${req.user.id}` : `ip:${req.ip || "unknown"}`;
}

// Stricter rate limiter for financial/sensitive endpoints (withdrawals, payouts, etc.)
const financialLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 financial operations per hour per user
  message: { error: "Too many financial requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false, // Disable strict IP validation for IPv6 compatibility
  store: makeStore("rl:financial:"),
  keyGenerator: financialKeyGenerator,
});

module.exports = { apiLimiter, authLimiter, financialLimiter, financialKeyGenerator, makeStore };
