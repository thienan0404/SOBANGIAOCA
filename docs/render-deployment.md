# Render and Supabase deployment

This project is deployed manually and does not use a Render Blueprint. The target architecture matches A25 Hub:

- one global Render Static Site for the frontend;
- one Render Node Web Service in Singapore for the API;
- Supabase for PostgreSQL, Auth and Storage.

Do not create a separate Node frontend, background worker, cron job or Render Key Value service.

## 1. Create the Singapore API

In Render, choose **New > Web Service** and connect this repository.

| Setting | Value |
| --- | --- |
| Name | `a25-handover-api-singapore` |
| Language | `Node` |
| Branch | `main` |
| Region | `Singapore (Southeast Asia)` |
| Root Directory | leave empty |
| Build Command | `pnpm install --frozen-lockfile --ignore-scripts && pnpm --filter @a25/api db:generate && pnpm --filter @a25/api build` |
| Start Command | `pnpm --filter @a25/api start:prod` |
| Health Check Path | `/api/v1/health` |
| Instance Type | `Free` |

Add these environment variables:

| Key | Value |
| --- | --- |
| `NODE_VERSION` | `22.14.0` |
| `DATABASE_URL` | Supabase pooler connection string |
| `DIRECT_URL` | Supabase direct database connection string |
| `SUPABASE_URL` | Supabase project URL, without `/rest/v1/` |
| `SUPABASE_SECRET_KEY` | Supabase secret server key |
| `SUPABASE_JWT_ISSUER` | `<SUPABASE_URL>/auth/v1` |
| `WEB_URL` | `https://a25-handover-static.onrender.com` |

Never place `SUPABASE_SECRET_KEY` in the Static Site. After deployment, verify:

`https://a25-handover-api-singapore.onrender.com/api/v1/health`

## 2. Configure the global Static Site

Use the existing `a25-handover-static` service, or choose **New > Static Site** if it does not exist.

| Setting | Value |
| --- | --- |
| Name | `a25-handover-static` |
| Branch | `main` |
| Root Directory | leave empty |
| Build Command | `pnpm install --frozen-lockfile --ignore-scripts && pnpm --filter @a25/web build` |
| Publish Directory | `apps/web/out` |

Add these environment variables:

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | `https://a25-handover-static.onrender.com` |
| `NEXT_PUBLIC_API_URL` | `https://a25-handover-api-singapore.onrender.com/api/v1` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL, without `/rest/v1/` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |

Save the variables and run **Manual Deploy > Deploy latest commit** because `NEXT_PUBLIC_*` values are embedded during the frontend build.

## 3. Verify before removing old services

1. Open the API health URL and confirm it returns `status: ok`.
2. Open the Static Site and sign in.
3. Create, submit and confirm a demo handover.
4. Confirm data is present in Supabase.
5. Check the browser Network tab and confirm API requests use `a25-handover-api-singapore.onrender.com`.

Only after all checks pass, delete the old Render services:

- `a25-handover-web`;
- `a25-handover-api` in Oregon;
- `a25-handover-worker`;
- `a25-handover-scheduler`;
- `a25-handover-redis`.

Do not delete the global Static Site, the new Singapore API or the Supabase project.
