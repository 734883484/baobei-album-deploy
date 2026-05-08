-- 宝贝相册数据库 Schema
create extension if not exists "uuid-ossp";

-- 用户档案
create table if not exists public.profiles (
    id uuid references auth.users(id) on delete cascade primary key,
    nickname text not null unique,
    email text not null unique,
    baby_nickname text not null default '',
    baby_birth_date date,
    created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

-- 新用户自动同步到 profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, nickname, email)
    values (
        new.id,
        coalesce(trim(new.raw_user_meta_data ->> 'nickname'), ''),
        new.email
    );
    return new;
exception
    when unique_violation then
        raise exception '昵称或邮箱已存在';
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();

-- 登录前通过昵称查询邮箱
create or replace function public.get_login_email(nickname_input text)
returns table(email text)
language sql
security definer
set search_path = public
as $$
    select p.email
    from public.profiles p
    where lower(p.nickname) = lower(trim(nickname_input))
    limit 1;
$$;

grant execute on function public.get_login_email(text) to anon, authenticated;

create or replace function public.check_profile_conflict(nickname_input text, email_input text)
returns table(nickname_exists boolean, email_exists boolean)
language sql
security definer
set search_path = public
as $$
    select
        exists(
            select 1
            from public.profiles
            where lower(nickname) = lower(trim(nickname_input))
        ) as nickname_exists,
        exists(
            select 1
            from public.profiles
            where lower(email) = lower(trim(email_input))
        ) as email_exists;
$$;

grant execute on function public.check_profile_conflict(text, text) to anon, authenticated;

-- 相册
create table if not exists public.albums (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    created_at timestamptz not null default now()
);

alter table public.albums enable row level security;

drop policy if exists "albums_select_own" on public.albums;
create policy "albums_select_own"
on public.albums
for select
using (auth.uid() = user_id);

drop policy if exists "albums_insert_own" on public.albums;
create policy "albums_insert_own"
on public.albums
for insert
with check (auth.uid() = user_id);

drop policy if exists "albums_update_own" on public.albums;
create policy "albums_update_own"
on public.albums
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "albums_delete_own" on public.albums;
create policy "albums_delete_own"
on public.albums
for delete
using (auth.uid() = user_id);

-- 媒体
create table if not exists public.photos (
    id uuid default uuid_generate_v4() primary key,
    album_id uuid references public.albums(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    storage_path text not null,
    ratio text check (ratio in ('3:4', '4:3')),
    media_type text not null default 'photo' check (media_type in ('photo', 'video')),
    remark text not null default '',
    created_at timestamptz not null default now()
);

alter table public.photos enable row level security;

drop policy if exists "photos_select_own" on public.photos;
create policy "photos_select_own"
on public.photos
for select
using (auth.uid() = user_id);

drop policy if exists "photos_insert_own" on public.photos;
create policy "photos_insert_own"
on public.photos
for insert
with check (auth.uid() = user_id);

drop policy if exists "photos_update_own" on public.photos;
create policy "photos_update_own"
on public.photos
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "photos_delete_own" on public.photos;
create policy "photos_delete_own"
on public.photos
for delete
using (auth.uid() = user_id);

-- Storage: 可以直接在 SQL Editor 创建 bucket 和策略
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "photos_bucket_public_read" on storage.objects;
create policy "photos_bucket_public_read"
on storage.objects
for select
using (bucket_id = 'photos');

drop policy if exists "photos_bucket_insert_own" on storage.objects;
create policy "photos_bucket_insert_own"
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "photos_bucket_update_own" on storage.objects;
create policy "photos_bucket_update_own"
on storage.objects
for update
to authenticated
using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "photos_bucket_delete_own" on storage.objects;
create policy "photos_bucket_delete_own"
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
);
