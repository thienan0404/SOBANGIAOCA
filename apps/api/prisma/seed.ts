import {PrismaClient} from '@prisma/client';const prisma=new PrismaClient();
async function main(){console.log('Run supabase/seed/seed.sql for deterministic development data. Auth users must be created through Supabase Auth; no passwords are seeded.');}
main().finally(()=>prisma.$disconnect());
