-- PhilTechGMA Security Baseline v2
-- Run in Supabase SQL Editor (Project → SQL Editor → New Query)
-- This is safe to re-run — all statements use IF NOT EXISTS / OR REPLACE / DROP IF EXISTS.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Admin allow-list table
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.admin_users (
    user_id uuid primary key references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "admin_users_select_self" on public.admin_users;
create policy "admin_users_select_self"
on public.admin_users
for select
to authenticated
using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Helper: is the current user an admin?
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.is_admin_user()
returns boolean
language sql
stable
as $$
    select exists (
        select 1 from public.admin_users au
        where au.user_id = auth.uid()
    );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Students table — RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.students enable row level security;

drop policy if exists "students_select_all" on public.students;
drop policy if exists "students_insert_all" on public.students;
drop policy if exists "students_update_all" on public.students;
drop policy if exists "students_delete_all" on public.students;
drop policy if exists "students_admin_select" on public.students;
drop policy if exists "students_admin_insert" on public.students;
drop policy if exists "students_admin_update" on public.students;
drop policy if exists "students_admin_delete" on public.students;
drop policy if exists "students_self_select" on public.students;
drop policy if exists "students_self_insert" on public.students;
drop policy if exists "students_self_update" on public.students;

-- Admin: full access
create policy "students_admin_select" on public.students
for select to authenticated using (public.is_admin_user());

create policy "students_admin_insert" on public.students
for insert to authenticated with check (public.is_admin_user());

create policy "students_admin_update" on public.students
for update to authenticated
using (public.is_admin_user()) with check (public.is_admin_user());

create policy "students_admin_delete" on public.students
for delete to authenticated using (public.is_admin_user());

-- Student: can read & write their own row only
create policy "students_self_select" on public.students
for select to authenticated using (id::text = auth.uid()::text);

create policy "students_self_insert" on public.students
for insert to authenticated with check (id::text = auth.uid()::text);

create policy "students_self_update" on public.students
for update to authenticated
using (id::text = auth.uid()::text) with check (id::text = auth.uid()::text);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Violations table — RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.violations enable row level security;

drop policy if exists "violations_select_all" on public.violations;
drop policy if exists "violations_insert_all" on public.violations;
drop policy if exists "violations_update_all" on public.violations;
drop policy if exists "violations_delete_all" on public.violations;
drop policy if exists "violations_admin_select" on public.violations;
drop policy if exists "violations_admin_insert" on public.violations;
drop policy if exists "violations_admin_update" on public.violations;
drop policy if exists "violations_admin_delete" on public.violations;
drop policy if exists "violations_self_select" on public.violations;

-- Admin: full access
create policy "violations_admin_select" on public.violations
for select to authenticated using (public.is_admin_user());

create policy "violations_admin_insert" on public.violations
for insert to authenticated with check (public.is_admin_user());

create policy "violations_admin_update" on public.violations
for update to authenticated
using (public.is_admin_user()) with check (public.is_admin_user());

create policy "violations_admin_delete" on public.violations
for delete to authenticated using (public.is_admin_user());

-- Student: can only read their own violations
create policy "violations_self_select" on public.violations
for select to authenticated using (student_id::text = auth.uid()::text);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Seed your admin account
--    Replace the email below with your actual admin email, then run this block.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.admin_users (user_id)
select id from auth.users where email = 'admin@philtechgma.edu.ph'
on conflict do nothing;

commit;


-- ─────────────────────────────────────────────────────────────────────────────
-- OPTIONAL: View all admin users
-- ─────────────────────────────────────────────────────────────────────────────
-- select au.user_id, u.email, au.created_at
-- from public.admin_users au
-- join auth.users u on u.id = au.user_id;