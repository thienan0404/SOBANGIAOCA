# Render and Supabase deployment

1. Create Supabase project and apply `supabase/migrations` in order.
2. Configure private storage buckets and Auth redirect URLs.
3. In Render, create a Blueprint from `infrastructure/render/render.yaml` at repository root.
4. Supply web public variables, API database/Supabase server variables, and worker server variables.
5. Deploy API first, set the resulting URL as `NEXT_PUBLIC_API_URL`, then deploy web.
6. Verify `/api/v1/health`, login, create/submit/confirm flow and audit rows.

Never set a Render rootDir for individual services; shared packages are outside app folders.
