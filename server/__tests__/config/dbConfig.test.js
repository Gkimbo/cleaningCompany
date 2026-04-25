/**
 * Tests for server/config/config.js
 *
 * Verifies that:
 *  - development and test environments use safe hardcoded defaults
 *  - production reads every credential from environment variables
 *  - production SSL is enabled
 *  - DB_PORT defaults to 5432 when not set
 */

describe("DB config — development environment", () => {
  let config;

  beforeAll(() => {
    jest.isolateModules(() => {
      config = require("../../config/config.js");
    });
  });

  it("uses postgres as the username", () => {
    expect(config.development.username).toBe("postgres");
  });

  it("uses the hardcoded development database name", () => {
    expect(config.development.database).toBe("cleaning_company_development");
  });

  it("connects to localhost", () => {
    expect(config.development.host).toBe("localhost");
  });

  it("uses postgres dialect", () => {
    expect(config.development.dialect).toBe("postgres");
  });

  it("does NOT have SSL enabled", () => {
    expect(config.development.dialectOptions?.ssl).toBeUndefined();
  });
});

describe("DB config — test environment", () => {
  let config;

  beforeAll(() => {
    jest.isolateModules(() => {
      config = require("../../config/config.js");
    });
  });

  it("uses postgres as the username", () => {
    expect(config.test.username).toBe("postgres");
  });

  it("uses the hardcoded test database name", () => {
    expect(config.test.database).toBe("cleaning_company_test");
  });

  it("connects to localhost", () => {
    expect(config.test.host).toBe("localhost");
  });
});

describe("DB config — production environment reads from env vars", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...ORIGINAL_ENV,
      DB_USER: "prod_user",
      DB_PASSWORD: "super_secret_password",
      DB_NAME: "cleaning_company_production",
      DB_HOST: "db.example.amazonaws.com",
      DB_PORT: "5432",
    };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("reads DB_USER from the environment", () => {
    const config = require("../../config/config.js");
    expect(config.production.username).toBe("prod_user");
  });

  it("reads DB_PASSWORD from the environment", () => {
    const config = require("../../config/config.js");
    expect(config.production.password).toBe("super_secret_password");
  });

  it("reads DB_NAME from the environment", () => {
    const config = require("../../config/config.js");
    expect(config.production.database).toBe("cleaning_company_production");
  });

  it("reads DB_HOST from the environment", () => {
    const config = require("../../config/config.js");
    expect(config.production.host).toBe("db.example.amazonaws.com");
  });

  it("reads DB_PORT as an integer from the environment", () => {
    const config = require("../../config/config.js");
    expect(config.production.port).toBe(5432);
    expect(typeof config.production.port).toBe("number");
  });

  it("defaults DB_PORT to 5432 when not set", () => {
    delete process.env.DB_PORT;
    const config = require("../../config/config.js");
    expect(config.production.port).toBe(5432);
  });

  it("uses postgres dialect", () => {
    const config = require("../../config/config.js");
    expect(config.production.dialect).toBe("postgres");
  });

  it("enables SSL for production", () => {
    const config = require("../../config/config.js");
    expect(config.production.dialectOptions.ssl.require).toBe(true);
  });

  it("does NOT hardcode credentials — username is undefined when DB_USER is unset", () => {
    delete process.env.DB_USER;
    const config = require("../../config/config.js");
    expect(config.production.username).toBeUndefined();
  });

  it("does NOT hardcode credentials — password is undefined when DB_PASSWORD is unset", () => {
    delete process.env.DB_PASSWORD;
    const config = require("../../config/config.js");
    expect(config.production.password).toBeUndefined();
  });

  it("does NOT hardcode credentials — host is undefined when DB_HOST is unset", () => {
    delete process.env.DB_HOST;
    const config = require("../../config/config.js");
    expect(config.production.host).toBeUndefined();
  });
});
