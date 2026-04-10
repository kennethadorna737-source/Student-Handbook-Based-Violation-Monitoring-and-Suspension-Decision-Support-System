-- The Resilient Shield: Supabase database security baseline
-- Run this in Supabase SQL Editor.
-- Purpose: enforce admin-only access to sensitive tables.

begin;

-- 1) Admin allow-list table (maps authenticated users to admin role)
create table if not exists public.admin_users (
    user_id uuid primary key references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);

-- Ensure RLS is on for admin list too.
alter table public.admin_users enable row level security;

-- Optional: prevent non-service users from reading admin list
drop policy if exists "admin_users_select_self" on public.admin_users;
create policy "admin_users_select_self"
on public.admin_users
for select
to authenticated
using (user_id = auth.uid());

-- 2) Helper function: check if current user is an admin
create or replace function public.is_admin_user()
returns boolean
language sql
stable
as $$
    select exists (
        select 1
        from public.admin_users au
        where au.user_id = auth.uid()
    );
$$;

-- 3) Lock down core app tables
alter table public.students enable row level security;
alter table public.violations enable row level security;

-- Remove old broad/open policies if they exist
drop policy if exists "students_select_all" on public.students;
drop policy if exists "students_insert_all" on public.students;
drop policy if exists "students_update_all" on public.students;
drop policy if exists "students_delete_all" on public.students;
drop policy if exists "violations_select_all" on public.violations;
drop policy if exists "violations_insert_all" on public.violations;
drop policy if exists "violations_update_all" on public.violations;
drop policy if exists "violations_delete_all" on public.violations;

-- Admin-only policies for students
drop policy if exists "students_admin_select" on public.students;
create policy "students_admin_select"
on public.students
for select
to authenticated
using (public.is_admin_user());

drop policy if exists "students_admin_insert" on public.students;
create policy "students_admin_insert"
on public.students
for insert
to authenticated
with check (public.is_admin_user());

drop policy if exists "students_admin_update" on public.students;
create policy "students_admin_update"
on public.students
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "students_admin_delete" on public.students;
create policy "students_admin_delete"
on public.students
for delete
to authenticated
using (public.is_admin_user());

-- Student self-service (restricted to own profile row only)
drop policy if exists "students_self_select" on public.students;
create policy "students_self_select"
on public.students
for select
to authenticated
using (id::text = auth.uid()::text);

drop policy if exists "students_self_insert" on public.students;
create policy "students_self_insert"
on public.students
for insert
to authenticated
with check (id::text = auth.uid()::text);

drop policy if exists "students_self_update" on public.students;
create policy "students_self_update"
on public.students
for update
to authenticated
using (id::text = auth.uid()::text)
with check (id::text = auth.uid()::text);

-- Admin-only policies for violations
drop policy if exists "violations_admin_select" on public.violations;
create policy "violations_admin_select"
on public.violations
for select
to authenticated
using (public.is_admin_user());

drop policy if exists "violations_admin_insert" on public.violations;
create policy "violations_admin_insert"
on public.violations
for insert
to authenticated
with check (public.is_admin_user());

drop policy if exists "violations_admin_update" on public.violations;
create policy "violations_admin_update"
on public.violations
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "violations_admin_delete" on public.violations;
create policy "violations_admin_delete"
on public.violations
for delete
to authenticated
using (public.is_admin_user());

commit;

