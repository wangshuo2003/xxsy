import "dotenv/config";
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: "./backend/prisma/schema.prisma",
  migrations: "./backend/prisma/migrations",
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