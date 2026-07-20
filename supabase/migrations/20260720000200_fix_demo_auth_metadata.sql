begin;

update auth.users
set
  confirmation_token=coalesce(confirmation_token,''),
  recovery_token=coalesce(recovery_token,''),
  email_change_token_new=coalesce(email_change_token_new,''),
  email_change=coalesce(email_change,''),
  email_change_token_current=coalesce(email_change_token_current,''),
  reauthentication_token=coalesce(reauthentication_token,''),
  phone_change=coalesce(phone_change,''),
  phone_change_token=coalesce(phone_change_token,''),
  updated_at=now()
where id::text like '10000000-0000-4000-8000-00000000000%';

commit;
