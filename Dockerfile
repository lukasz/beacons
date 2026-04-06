# -- Build frontend --
FROM node:20-alpine AS frontend
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_GIPHY_API_KEY
RUN npm run build

# -- Build backend --
FROM golang:1.24-alpine AS backend
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY server/ ./server/
RUN cd server && go build -o beacons .

# -- Runtime --
FROM alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=backend /app/server/beacons ./server/beacons
COPY --from=frontend /app/web/dist ./web/dist
EXPOSE 8080
CMD ["./server/beacons"]
