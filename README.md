# Fruit Share

A JavaScript full-stack project to reduce fruit and vegetable waste by connecting people who have surplus produce with people who can collect it.

## What you get

- Expo app (Android, iOS, Web) in [apps/client](apps/client)
- Node.js + Express API in [services/api](services/api)
- Supabase SQL schema and policies in [supabase/schema.sql](supabase/schema.sql)
- Social-login-ready Supabase auth integration
- Moderation-ready listing lifecycle (`active`, `reserved`, `collected`, `expired`, `flagged`, `removed`)

## Product scope (v1)

- Users can create produce listings with collection window and approximate map pin.
- Users can request collection for listings.
- Listing owners can approve/reject requests.
- Admins can flag/remove listings via API moderation routes.

## Tech stack

- Client: Expo + React Native + React Native Web (JavaScript)
- Server: Node.js + Express (JavaScript)
- Database/Auth: Supabase (Postgres + Auth + RLS)
- Deployment target: Netlify (web) + Supabase

## 1. Prerequisites

- Node.js 20+
- npm 10+
- Supabase project
- Expo Go app (for mobile device testing)

## 2. Configure environment variables

Copy env files and fill values:

- Root `.env` (optional shared)
- [apps/client/.env.example](apps/client/.env.example) -> `apps/client/.env`
- [services/api/.env.example](services/api/.env.example) -> `services/api/.env`

Required values:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`

## 3. Install dependencies

```bash
npm install
```

## 4. Apply Supabase schema

Run SQL from [supabase/schema.sql](supabase/schema.sql) in the Supabase SQL editor.

Then create at least one admin profile:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

## 5. Run API

From a fresh terminal:

```bash
cd C:\git\fruit_share
npm run dev:api
```

API health check:

- `GET http://localhost:4000/health`

You can also check it from PowerShell:

```powershell
Invoke-RestMethod -Uri http://localhost:4000/health -Method Get
```

## 6. Run Expo app

Open a second fresh terminal and run the web app:

```bash
cd C:\git\fruit_share
npm run web -w @fruit-share/client
```

The web app should be available at:

- `http://localhost:8081`

For mobile development instead, run:

```bash
cd C:\git\fruit_share
npm run dev:client
```

Press:

- `a` Android emulator
- `i` iOS simulator (macOS)
- `w` web

## Fresh Local Run Checklist

Use this when starting from closed terminals after the project is already installed and configured.

Terminal 1, API server:

```powershell
cd C:\git\fruit_share
npm run dev:api
```

Terminal 2, web client:

```powershell
cd C:\git\fruit_share
npm run web -w @fruit-share/client
```

Then open:

- API health: `http://localhost:4000/health`
- Web app: `http://localhost:8081`

If dependencies are missing on a new machine, run this once first:

```powershell
cd C:\git\fruit_share
npm install
```

## 7. Social login setup

In Supabase Auth providers, enable your preferred provider (Google/Apple/etc).

Set redirect URIs:

- Expo native: your app scheme from [apps/client/app.json](apps/client/app.json)
- Web: your deployed domain callback

## 8. Deploy web to Netlify

This project includes [netlify.toml](netlify.toml) for static web export from Expo.

Build command:

```bash
npm run build:web -w @fruit-share/client
```

Publish directory:

- `apps/client/dist`

Set Netlify env vars:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_URL`

## API overview

- `GET /health`
- `GET /api/listings`
- `POST /api/listings` (auth)
- `POST /api/listings/:id/requests` (auth)
- `POST /api/requests/:id/respond` (auth owner)
- `POST /api/moderation/listings/:id/flag` (admin)
- `POST /api/moderation/listings/:id/remove` (admin)

## Notes

- Location is intentionally approximate (lat/lng rounded client-side).
- API validates Supabase JWT from `Authorization: Bearer <token>`.
- RLS is enforced for secure multi-tenant access.
