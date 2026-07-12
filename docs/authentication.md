# Authentication

Supabase Auth owns identities. Next.js uses `@supabase/ssr` cookie sessions and protected route layouts. NestJS accepts Bearer access tokens and verifies them against the project JWKS endpoint. Secret/service-role keys are server-only.
