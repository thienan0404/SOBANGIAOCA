begin;

alter table work_sessions
  drop constraint if exists work_sessions_status_check;

alter table work_sessions
  add constraint work_sessions_status_check
  check (status in ('ACTIVE', 'COMPLETED', 'CANCELLED', 'TRANSFERRED'));

comment on column work_sessions.status is
  'ACTIVE while working; TRANSFERRED after handing the shift to the receiver; COMPLETED for a normal sign-out; CANCELLED for an invalidated session.';

commit;
