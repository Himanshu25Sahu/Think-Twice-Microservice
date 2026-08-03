# Build context is ./services (not ./services/org-service) so the shared/
# module can be copied in. Keeping the service at /app/org-service preserves
# the '../../shared/...' import paths used in the source.
FROM node:18-alpine

WORKDIR /app/org-service

COPY org-service/package*.json ./

RUN npm ci --only=production

COPY org-service/ ./

COPY shared/ /app/shared/

EXPOSE 5003

CMD ["node", "server.js"]
