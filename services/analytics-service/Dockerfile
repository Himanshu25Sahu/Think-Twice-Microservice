# Build stage: compile a static binary.
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY *.go ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /analytics .

# Runtime stage: just the binary and CA certs (for Atlas/TLS Redis).
FROM alpine:3.21
RUN apk add --no-cache ca-certificates && adduser -D -u 10001 app
USER app
COPY --from=build /analytics /analytics
EXPOSE 5004
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-5004}/health || exit 1
ENTRYPOINT ["/analytics"]
