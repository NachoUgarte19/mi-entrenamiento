-- Run once in the Supabase SQL editor. No service-role key belongs in the web app.
create table if not exists public.training_records (
 owner_id uuid not null references auth.users(id) on delete cascade,
 id text not null,
 kind text not null check (kind in ('exercise','routine','plan','session')),
 data jsonb not null,
 revision bigint not null default 0,
 deleted boolean not null default false,
 mutation_id uuid,
 updated_at timestamptz not null default now(),
 primary key (owner_id,id)
);
alter table public.training_records enable row level security;
drop policy if exists own_records on public.training_records;
create policy own_records on public.training_records for all to authenticated
 using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
revoke all on public.training_records from anon;
grant select,insert,update on public.training_records to authenticated;

create or replace function public.apply_training_record(
 record_id text, record_kind text, record_data jsonb, is_deleted boolean,
 expected_revision bigint, mutation_id uuid
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare r public.training_records; current_user_id uuid := auth.uid();
begin
 if current_user_id is null then raise exception 'Authentication required'; end if;
 if record_data->>'id' is distinct from record_id then raise exception 'Record id mismatch'; end if;
 if expected_revision < 0 then raise exception 'Invalid revision'; end if;
 insert into public.training_records(owner_id,id,kind,data,revision,deleted)
 values(current_user_id,record_id,record_kind,record_data,0,is_deleted)
 on conflict(owner_id,id) do nothing;
 select * into r from public.training_records where owner_id=current_user_id and id=record_id for update;
 if r.mutation_id = apply_training_record.mutation_id then
  return jsonb_build_object('ok',true,'record',to_jsonb(r));
 end if;
 if r.revision <> expected_revision then
  return jsonb_build_object('ok',false,'record',to_jsonb(r));
 end if;
 update public.training_records set kind=record_kind,data=record_data,deleted=is_deleted,
 revision=r.revision+1,mutation_id=apply_training_record.mutation_id,updated_at=now()
 where owner_id=current_user_id and id=record_id returning * into r;
 return jsonb_build_object('ok',true,'record',to_jsonb(r));
end;
$$;
revoke all on function public.apply_training_record(text,text,jsonb,boolean,bigint,uuid) from public,anon;
grant execute on function public.apply_training_record(text,text,jsonb,boolean,bigint,uuid) to authenticated;
