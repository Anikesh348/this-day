# This Day

Private journaling app with:
- `frontend/this-day`: Expo Router app (mobile-first web experience)
- `backend`: API service

## Run with Docker

Dev:
```bash
docker compose --profile dev up --build
```
- Frontend: `http://localhost:13001`
- Backend: `http://localhost:18081`

Prod:
```bash
docker compose --profile prod up --build
```
- Frontend: `http://localhost:3001`
- Backend: `http://localhost:8081`

## Local frontend (optional)
```bash
cd frontend/this-day
yarn start
```
