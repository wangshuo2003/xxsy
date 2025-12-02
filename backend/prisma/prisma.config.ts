import "dotenv/config";
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: "./schema.prisma", // Updated relative path
  migrations: "./migrations", // Updated relative path
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