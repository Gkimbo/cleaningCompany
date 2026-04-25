module.exports = {
  development: {
    username: "postgres",
    password: "password",
    database: "cleaning_company_development",
    host: "localhost",
    port: 5432,
    dialect: "postgres",
  },
  test: {
    username: "postgres",
    password: "password",
    database: "cleaning_company_test",
    host: "localhost",
    port: 5432,
    dialect: "postgres",
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "5432", 10),
    dialect: "postgres",
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000,
    },
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: true,
      },
    },
  },
};
