# Business rules

The state machine is DRAFT → SUBMITTED → PENDING_RECEIVER_CONFIRMATION → CONFIRMED → COMPLETED. A receiver may request supplementation, producing SUPPLEMENT_REQUESTED → RESUBMITTED → PENDING_RECEIVER_CONFIRMATION. Only drafts are normally editable. Required checklist items block submission. A giver cannot confirm their own handover. Completed records use append-only amendments. Every transition writes audit and outbox records transactionally.
