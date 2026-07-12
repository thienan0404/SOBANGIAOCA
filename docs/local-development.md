# Local development

Run `corepack enable`, `pnpm install`, copy each `.env.example`, start Supabase with `pnpm supabase:start`, reset migrations with `pnpm supabase:reset`, generate Prisma with `pnpm db:generate`, then `pnpm dev`. Redis is available through `infrastructure/docker/docker-compose.yml`.
