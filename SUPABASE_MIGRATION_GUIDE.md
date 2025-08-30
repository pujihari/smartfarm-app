# Supabase Account Migration Guide

## Step 1: Create New Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign in with your new account
3. Create a new project
4. Note down your:
   - Project URL (format: `https://your-project-ref.supabase.co`)
   - Anon key (starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

## Step 2: Update Environment Files

Replace the placeholders in these files with your actual credentials:

- `src/environments/environment.ts` (development)
- `src/environments/environment.prod.ts` (production)

## Step 3: Run Database Migrations

You have two options:

### Option A: Use Supabase CLI (Recommended)

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to your new account:
   ```bash
   supabase login
   ```

3. Link to your new project:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

4. Push all migrations:
   ```bash
   supabase db push
   ```

### Option B: Manual SQL Execution

1. Go to your Supabase dashboard → SQL Editor
2. Run the migration files in order from `supabase/migrations/` folder:
   - Start with `0001_initial_schema.sql`
   - Continue sequentially through `0022_member_removal_function.sql`

## Step 4: Test the Application

1. Update your environment files with real credentials
2. Restart your development server:
   ```bash
   npm run dev
   ```
3. Test login/registration functionality

## Migration Files Included

The following migration files need to be executed in your new Supabase project:

- 0001_initial_schema.sql - Basic tables and structure
- 0002_database_functions.sql - Database functions
- 0002_multi_tenancy_rls.sql - Row Level Security setup
- 0003_inventory_schema.sql - Inventory management
- 0004_fix_member_list_function.sql - Member functions
- 0005_auth_schema.sql - Authentication setup
- 0006_employee_schema.sql - Employee management
- 0007_employee_triggers.sql - Employee triggers
- 0008_user_role_function.sql - User role management
- 0009_base_rls_policies.sql - Basic RLS policies
- 0010_multi_tenancy_schema.sql - Multi-tenant structure
- 0011_multi_tenancy_functions_and_rls.sql - Multi-tenant functions
- 0012_production_standards_schema.sql - Production standards
- 0013_seed_hyline_standard.sql - Sample data
- 0014_storage_policies.sql - File storage policies
- 0015_unique_org_name.sql - Organization constraints
- 0016_fix_member_rls.sql - Member RLS fixes
- 0017_member_management_functions.sql - Member management
- 0018_refactor_user_creation.sql - User creation process
- 0019_respiratory_schema.sql - Respiratory tracking
- 0020_add_org_insert_policy.sql - Organization policies
- 0021_fix_org_insert_rls.sql - Organization RLS fixes
- 0022_member_removal_function.sql - Member removal

## Important Notes

1. **Backup**: Always backup your current data before migration
2. **Order**: Run migrations in numerical order
3. **Testing**: Test thoroughly after migration
4. **Environment Variables**: Double-check all environment files
5. **Deployment**: Update production environment variables