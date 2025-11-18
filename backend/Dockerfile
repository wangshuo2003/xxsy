FROM node:20-bullseye-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 build-essential \
  && rm -rf /var/lib/apt/lists/*

ARG PRISMA_ENGINES_MIRROR
ENV PRISMA_ENGINES_MIRROR=$PRISMA_ENGINES_MIRROR

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npm run prisma:generate

COPY . .

ENV PORT=28964
EXPOSE 28964

CMD ["npm", "run", "start"]
