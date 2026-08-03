# Build context is ./services (not ./services/entry-service) so the shared/
# module can be copied in. Keeping the service at /app/entry-service preserves
# the '../../shared/...' import paths used in the source.
FROM node:18-alpine

WORKDIR /app/entry-service

COPY entry-service/package*.json ./

RUN npm ci --only=production

COPY entry-service/ ./

COPY shared/ /app/shared/

EXPOSE 5002

CMD ["node", "server.js"]
