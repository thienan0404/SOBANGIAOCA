# Authorization

Access is scoped by organization and active branch membership. Roles are RECEPTIONIST, SHIFT_LEADER, BRANCH_MANAGER, REGIONAL_MANAGER, INSPECTOR and ADMIN. API guards resolve membership from PostgreSQL; RLS is defense in depth. Business writes normally go through NestJS.
