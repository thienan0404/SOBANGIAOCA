begin;

insert into shift_instances(id,organization_id,branch_id,shift_code,starts_at,ends_at,status)
select
  '20000000-0000-4000-8000-000000000001'::uuid,
  organization.id,
  branch.id,
  'CA-DEMO-PCT45',
  now()-interval '4 hours',
  now()+interval '4 hours',
  'OPEN'
from organizations organization
join branches branch on branch.organization_id=organization.id and branch.code='PCT45'
where organization.code='A25'
on conflict(id) do update set
  starts_at=excluded.starts_at,
  ends_at=excluded.ends_at,
  status='OPEN';

insert into shift_assignments(shift_instance_id,profile_id,assignment_type)
select '20000000-0000-4000-8000-000000000001'::uuid,profile.id,'RECEPTIONIST'
from profiles profile
where profile.employee_code in('A25001','A25002','A25003')
on conflict(shift_instance_id,profile_id) do update set assignment_type=excluded.assignment_type;

insert into handovers(
  id,organization_id,branch_id,shift_instance_id,code,status,notes,version,created_by,created_at,updated_at
)
select
  '30000000-0000-4000-8000-000000000001'::uuid,
  organization.id,
  branch.id,
  '20000000-0000-4000-8000-000000000001'::uuid,
  'BG-DEMO-PCT45-001',
  'DRAFT',
  'Bàn giao ca lễ tân mẫu tại 45 Phan Chu Trinh',
  1,
  giver.id,
  now()-interval '15 minutes',
  now()
from organizations organization
join branches branch on branch.organization_id=organization.id and branch.code='PCT45'
join profiles giver on giver.employee_code='A25001'
where organization.code='A25'
on conflict(id) do update set
  status='DRAFT',
  notes=excluded.notes,
  version=1,
  submitted_at=null,
  confirmed_at=null,
  completed_at=null,
  updated_at=now();

insert into handover_participants(
  id,organization_id,branch_id,handover_id,user_id,participant_type,assignment_status,assigned_at,created_by
)
select data.id,organization.id,branch.id,'30000000-0000-4000-8000-000000000001'::uuid,profile.id,
       data.participant_type::participant_type,'ASSIGNED',now()-interval '15 minutes',giver.id
from (values
  ('40000000-0000-4000-8000-000000000001'::uuid,'A25001','GIVER'),
  ('40000000-0000-4000-8000-000000000002'::uuid,'A25002','RECEIVER'),
  ('40000000-0000-4000-8000-000000000003'::uuid,'A25003','SUPERVISOR')
) as data(id,employee_code,participant_type)
join profiles profile on profile.employee_code=data.employee_code
join profiles giver on giver.employee_code='A25001'
join organizations organization on organization.code='A25'
join branches branch on branch.organization_id=organization.id and branch.code='PCT45'
on conflict(id) do update set
  user_id=excluded.user_id,
  participant_type=excluded.participant_type,
  assignment_status='ASSIGNED',
  acknowledged_at=null,
  confirmed_at=null;

insert into handover_sections(id,handover_id,title,sort_order) values
('50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Tài chính - quỹ',1),
('50000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','Tình hình khách sạn',2),
('50000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000001','Công việc bàn giao',3)
on conflict(id) do update set title=excluded.title,sort_order=excluded.sort_order;

insert into handover_items(id,handover_id,title,details,category,priority,room_number,created_at) values
(
 '60000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000001',
 'Tài chính - quỹ',
 E'Quỹ cố định: 5.000.000\nTổng thu: 12.850.000\nTổng chi: 2.350.000\nChuyển khoản: 7.200.000\nDư cuối: 8.300.000',
 'FINANCE','HIGH',null,now()-interval '14 minutes'
),
(
 '60000000-0000-4000-8000-000000000002',
 '30000000-0000-4000-8000-000000000001',
 'Tình hình khách sạn',
 E'Kho minibar: Đủ\nKho ký gửi: Đủ\nSạc điện thoại/đàm: Đủ\nPhòng trống: 12\nPhòng có khách: 38\nKhách lưu trú: 64\nKhách cần lưu ý: Phòng 512 yêu cầu xe sân bay lúc 07:00\nTài sản khách: 01 túi xách đang lưu tại quầy\nPhát sinh khác: Theo dõi điều hòa phòng 502',
 'HOTEL_STATUS','NORMAL',null,now()-interval '13 minutes'
),
(
 '60000000-0000-4000-8000-000000000003',
 '30000000-0000-4000-8000-000000000001',
 'Theo dõi điều hòa phòng 502',
 'Khách báo điều hòa lạnh yếu. Kỹ thuật đã kiểm tra lần 1, ca sau tiếp tục theo dõi và phản hồi khách.',
 'TASK','HIGH','502',now()-interval '12 minutes'
),
(
 '60000000-0000-4000-8000-000000000004',
 '30000000-0000-4000-8000-000000000001',
 'Chuẩn bị xe sân bay',
 'Khách phòng 512 xuất phát lúc 07:00. Đã đặt xe, cần gọi nhắc lái xe trước 30 phút.',
 'TASK','URGENT','512',now()-interval '11 minutes'
),
(
 '60000000-0000-4000-8000-000000000005',
 '30000000-0000-4000-8000-000000000001',
 'Đối chiếu công nợ đặt phòng',
 'Kiểm tra khoản thanh toán còn thiếu của đoàn khách P309 và cập nhật trước 10:00.',
 'TASK','NORMAL','309',now()-interval '10 minutes'
)
on conflict(id) do update set
 title=excluded.title,
 details=excluded.details,
 category=excluded.category,
 priority=excluded.priority,
 room_number=excluded.room_number;

insert into checklist_results(handover_id,item_code,is_completed,completed_by,completed_at)
select '30000000-0000-4000-8000-000000000001'::uuid,item.code,true,profile.id,now()-interval '8 minutes'
from (values('GUEST_NOTES'),('CASH'),('KEYS')) as item(code)
join profiles profile on profile.employee_code='A25001'
on conflict(handover_id,item_code) do update set
 is_completed=true,
 completed_by=excluded.completed_by,
 completed_at=excluded.completed_at;

insert into audit_logs(
 id,organization_id,branch_id,actor_id,actor_role,action,entity_type,entity_id,new_values,request_id,created_at
)
select
 '70000000-0000-4000-8000-000000000001'::uuid,
 organization.id,branch.id,profile.id,'RECEPTIONIST','HANDOVER_CREATED','HANDOVER',
 '30000000-0000-4000-8000-000000000001'::uuid,
 jsonb_build_object('status','DRAFT','demo',true),
 'demo-seed-pct45',now()-interval '15 minutes'
from organizations organization
join branches branch on branch.organization_id=organization.id and branch.code='PCT45'
join profiles profile on profile.employee_code='A25001'
where organization.code='A25'
on conflict(id) do update set new_values=excluded.new_values,created_at=excluded.created_at;

insert into outbox_events(
 id,aggregate_type,aggregate_id,event_type,payload,idempotency_key,created_at
) values(
 '80000000-0000-4000-8000-000000000001','HANDOVER',
 '30000000-0000-4000-8000-000000000001','handover.created',
 jsonb_build_object('handoverId','30000000-0000-4000-8000-000000000001','branchCode','PCT45','demo',true),
 'handover.created:demo-pct45-001',now()-interval '15 minutes'
)
on conflict(idempotency_key) do update set payload=excluded.payload;

commit;
