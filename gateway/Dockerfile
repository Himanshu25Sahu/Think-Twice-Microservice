FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 CMD node -e "require('http').get('http://localhost:5000/api/health', res => { if (res.statusCode !== 200) process.exit(1) })"

CMD ["node", "server.js"]
