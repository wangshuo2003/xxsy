FROM node:20-alpine

WORKDIR /app

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package*.json ./
RUN npm ci
RUN chmod +x ./node_modules/.bin/vite

COPY . .

RUN npm run build

ENV PORT=18964
EXPOSE 18964

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "18964"]
