update handovers handover
set operational_locked_at=coalesce(handover.confirmed_at,handover.updated_at,now())
where handover.operational_locked_at is null
  and handover.locked_at is null
  and handover.status in (
    'PENDING_MANAGEMENT_APPROVAL',
    'PENDING_ACCOUNTING_APPROVAL',
    'MANAGEMENT_CHANGES_REQUESTED',
    'ACCOUNTING_CHANGES_REQUESTED'
  )
  and (
    select count(distinct participant.participant_type)
    from handover_participants participant
    where participant.handover_id=handover.id
      and participant.participant_type in ('GIVER','RECEIVER')
      and participant.confirmed_at is not null
      and participant.signature_hash is not null
  )=2
  and not exists (
    select 1
    from checklist_results checklist
    where checklist.handover_id=handover.id
      and (not checklist.is_completed or checklist.receiver_checked_at is null)
  );