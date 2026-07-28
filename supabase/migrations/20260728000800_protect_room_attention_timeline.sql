begin;

create trigger prevent_room_attention_update_edit
before update on room_attention_tag_updates
for each row execute function prevent_room_attention_record_delete();

commit;