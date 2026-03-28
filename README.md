# This Day

`This Day` is a private journaling app for capturing daily moments with photos, videos, and short notes. The current codebase is split into:

- `frontend/this-day`: Expo Router app used as a mobile-first web client
- `backend`: Java 21 Vert.x API backed by MongoDB
- `Immich`: external media store used for asset upload and playback
- `Clerk`: authentication provider for Google sign-in and JWT verification

## What The App Does

- Sign in with Google through Clerk
- Sync the signed-in user into the backend on login
- Create entries for today or a past date
- Upload up to 3 media items per entry from the current UI
- Support images and short videos
- Browse entries through a calendar view
- Compare the same day across previous months and years
- View all entries for a single day
- Edit captions, add media, remove media, and delete entries
- Swipe through a day’s media in a full-screen viewer
- Proxy Immich thumbnails, previews, and full assets through the backend
- Switch between three built-in themes from the profile area

## Repository Layout

```text
this-day/
├── backend/                  # Vert.x API, Mongo access, Immich integration
├── frontend/this-day/        # Expo Router app exported for web
├── docker-compose.yml        # dev/prod compose profiles
└── .github/workflows/        # manual deploy workflows for Raspberry Pi
```

## Architecture

### Frontend

The frontend is an Expo Router app with these main routes:

- `app/login.tsx`: Clerk Google OAuth entry point
- `app/(tabs)/today.tsx`: summary for the selected day and same-day history
- `app/(tabs)/calendar.tsx`: month browsing with entry thumbnails
- `app/(tabs)/add.tsx`: create and edit flow for entries
- `app/day/[date].tsx`: all entries for one day
- `app/media/[assetId].tsx`: full-screen media viewer
- `app/(tabs)/profile.tsx`: account info, sign-out, theme entry
- `app/theme.tsx`: theme and gradient settings

The app stores the Clerk JWT locally, attaches it as `Authorization: Bearer <token>`, and uses `withCredentials: true` so media requests can also reuse the auth cookie set by the backend.

### Backend

The backend is a Vert.x HTTP server started by `com.thisday.Main` and wired in `com.thisday.verticles.ThisDayVerticle`.

Current responsibilities:

- verify Clerk JWTs
- sync authenticated users into MongoDB
- create pending upload sessions for entries
- upload media into Immich
- finalize entries after all expected uploads complete
- query calendar and day-based entry views
- proxy Immich media through authenticated routes
- expose `/health` with a MongoDB ping check

### Data Flow

1. The user signs in via Clerk in the Expo app.
2. The frontend fetches a Clerk token using the `ThisDay` template and stores it locally.
3. The frontend calls `GET /api/login`.
4. The backend verifies the token, syncs the user, and sets the `thisday_auth` cookie.
5. Entry creation uses a staged upload flow:
   - `POST /api/entries/init`
   - `POST /api/entries/:entryId/media`
   - `POST /api/entries/:entryId/finalize`
6. Uploaded media is stored in Immich, while entry metadata is stored in MongoDB.

## API Surface

All application routes except `/health` require authentication.

### Auth and User

- `GET /api/login`: verify Clerk token, sync user, return current user JSON

### Entry Creation and Mutation

- `POST /api/entries/init`: create a pending entry upload session
- `POST /api/entries/:entryId/media`: upload one media file to a pending entry
- `POST /api/entries/:entryId/finalize`: mark a pending entry as ready
- `POST /api/entries`: legacy direct-create endpoint for today
- `POST /api/entries/backfill`: legacy direct-create endpoint for a past date
- `PUT /api/entries/:entryId`: update caption and media
- `POST /api/entries/:entryId/update`: multipart-compatible update mirror
- `DELETE /api/entries/:entryId`: delete an entry

### Entry Read Endpoints

- `GET /api/entries/day?year=YYYY&month=M&day=D`
- `GET /api/entries/day/summary?year=YYYY&month=M&day=D`
- `GET /api/entries/same-day/previous-months?year=YYYY&month=M&day=D`
- `GET /api/entries/same-day/previous-years?year=YYYY&month=M&day=D`
- `GET /api/entries/calendar?year=YYYY&month=M`

### Media Proxy

- `GET /api/media/immich/:assetId?type=thumbnail|preview|full`
- `HEAD /api/media/immich/:assetId?type=thumbnail|preview|full`

## Environment Variables

The repo currently keeps environment files in place for both services:

- `backend/.env.dev`
- `backend/.env.prod`
- `frontend/this-day/.env.dev`
- `frontend/this-day/.env.prod`

### Backend

Required or used by `backend/src/main/java/com/thisday/config/AppConfig.java`:

- `HTTP_PORT`
- `MONGO_URI`
- `MONGO_DB`
- `CLERK_ISSUER`
- `IMMICH_BASE_URL`
- `IMMICH_API_KEY`
- `CORS_ALLOWED_ORIGINS`

Notes:

- `MONGO_URI`, `CLERK_ISSUER`, `IMMICH_BASE_URL`, and `IMMICH_API_KEY` are required.
- `CLERK_JWKS_URL` is derived automatically from `CLERK_ISSUER`.
- The code defines `CORS_ALLOWED_ORIGINS`, but the current router implementation still allows any origin dynamically.

### Frontend

Used by the Expo app:

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_API_BASE_URL`

If `EXPO_PUBLIC_API_BASE_URL` is missing, the app falls back to `https://thisdayapi.hostingfrompurva.xyz`.

## Running The Project

### Docker

### Dev profile

```bash
docker compose --profile dev up --build
```

Services:

- frontend: `http://localhost:13001`
- backend: `http://localhost:18081`

### Prod profile

```bash
docker compose --profile prod up --build
```

Services:

- frontend: `http://localhost:3001`
- backend: `http://localhost:8081`

How it works:

- the backend Docker image builds a fat JAR with Gradle and copies `.env.dev` or `.env.prod` into the runtime image
- the frontend Docker image runs `expo export --platform web` and serves the generated `dist/` output through Nginx on port `3001`

### Local Development Without Docker

### Backend

Requirements:

- Java 21
- a reachable MongoDB instance
- a reachable Immich instance
- valid Clerk issuer configuration

Run:

```bash
cd backend
./gradlew run
```

Default local port:

- `http://localhost:8081`

### Frontend

Requirements:

- Node.js 20 or compatible
- Yarn

Run:

```bash
cd frontend/this-day
yarn install
yarn start
```

The current start script uses:

- Expo dev server on port `3001`

If you run frontend and backend locally without Docker, make sure `EXPO_PUBLIC_API_BASE_URL` points at your backend instance.

## Current Implementation Notes

- Authentication is based on Clerk JWT verification, not a custom username/password flow.
- The frontend currently targets web first, even though the project is built on Expo.
- Entry creation in the UI uses the staged upload flow, not the older one-shot multipart endpoints.
- The UI enforces a 3-item media cap per entry.
- Videos are constrained in the current add flow to short clips.
- Entry dates are handled with an `Asia/Kolkata` assumption in multiple places.
- Media rendering uses backend-proxied Immich URLs instead of exposing Immich directly to the client.
- The backend sets an auth cookie only after a successful authenticated request carrying a bearer token.
- Unit tests are effectively disabled in Gradle right now with `test { enabled = false }`.

## Deployment

The repository includes manual GitHub Actions workflows that deploy to `/srv/this-day` on a Raspberry Pi over Tailscale:

- `.github/workflows/manual-branch-deploy.yml`
- `.github/workflows/manual-tag-deploy.yml`

Both workflows build and start the selected Docker Compose profile remotely.

## Known Gaps

- The README previously described only a minimal shell of the project and was out of sync with the implemented app.
- The backend declares `CORS_ALLOWED_ORIGINS`, but current CORS handling is effectively permissive.
- There is no sanitized `.env.example` checked in yet.
- Automated tests are not active in the current Gradle setup.
