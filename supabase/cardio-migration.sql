-- Habilita registros de cardio sin modificar los datos ni las políticas de cada cuenta.
begin;
alter table public.training_records drop constraint if exists training_records_kind_check;
alter table public.training_records add constraint training_records_kind_check
check (kind in ('exercise','routine','plan','session','cardio'));
commit;
