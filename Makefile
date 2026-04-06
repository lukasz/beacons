.PHONY: dev dev-backend dev-frontend build

dev:
	@echo "Starting backend and frontend..."
	@make dev-backend & make dev-frontend

dev-backend:
	cd server && go run .

dev-frontend:
	cd web && npm run dev

build:
	cd web && npm run build
	cd server && go build -o ../temtro .

install:
	cd web && npm install
