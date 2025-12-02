require("dotenv/config");
const { defineConfig } = require('prisma/config');

module.exports = defineConfig({
  schema: "./prisma/schema.prisma", // Updated relative path
  migrations: "./prisma/migrations", // Updated relative path
  datasource: {
    provider: 'mysql',
    url: process.env.DATABASE_URL, // Ensure DATABASE_URL is loaded correctly
  },
  generator: {
    client: {
      provider: 'prisma-client-js',
    },
  },
});