-- Minute-resolution checks run in the database, even when the website is closed.
-- Store the existing backend trigger secret separately in Vault under the name
-- calendar_reminder_trigger. Never put its value in a migration or cron command.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;
revoke all on net.http_request_queue from public, anon, authenticated;

create or replace function public.trigger_calendar_reminders()
returns bigint language plpgsql security invoker set search_path='' as $$
declare trigger_secret text;
begin
  if not exists (select 1 from public.calendar_reminders
    where due_at <= now() and (status='pending' or
      (status='sending' and (lease_until is null or lease_until < now())))) then
    return null;
  end if;
  select decrypted_secret into trigger_secret from vault.decrypted_secrets
    where name='calendar_reminder_trigger';
  if trigger_secret is null or length(trigger_secret)<32 then return null; end if;
  return net.http_post(
    url:='https://mcnairscode.com/api/calendar-reminders',
    headers:=jsonb_build_object('Content-Type','application/json','X-Reminder-Secret',trigger_secret),
    body:='{}'::jsonb, timeout_milliseconds:=180000);
end $$;
revoke all on function public.trigger_calendar_reminders() from public, anon, authenticated, service_role;
select cron.schedule('calendar-reminders-every-minute', '* * * * *',
  'select public.trigger_calendar_reminders();');
