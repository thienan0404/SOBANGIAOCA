begin;
insert into organizations(id,name,code) values('00000000-0000-4000-8000-000000000001','A25 Hotel','A25');
insert into branches(id,organization_id,name,code,address) values
('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000001','45 Phan Chu Trinh','PCT45','45 Phan Chu Trinh'),
('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000001','14 Hồ Huấn Nghiệp','HHN14','14 Hồ Huấn Nghiệp'),
('00000000-0000-4000-8000-000000000103','00000000-0000-4000-8000-000000000001','18 Nguyễn Hy Quang','NHQ18','18 Nguyễn Hy Quang');
insert into roles(code,name) values('RECEPTIONIST','Lễ tân'),('SHIFT_LEADER','Trưởng ca'),('BRANCH_MANAGER','Quản lý chi nhánh'),('REGIONAL_MANAGER','Quản lý vùng'),('INSPECTOR','Kiểm soát'),('ADMIN','Quản trị viên');
insert into permissions(code,name) values('handover.read','Xem bàn giao'),('handover.create','Tạo bàn giao'),('handover.submit','Gửi bàn giao'),('handover.confirm','Xác nhận bàn giao'),('finance.read','Xem tài chính'),('finance.confirm','Xác nhận tài chính'),('report.export','Xuất báo cáo'),('audit.read','Xem nhật ký'),('settings.manage','Quản lý cài đặt');
insert into shift_definitions(organization_id,name,code,start_time,end_time) values('00000000-0000-4000-8000-000000000001','Ca 1','CA1','06:00','14:00'),('00000000-0000-4000-8000-000000000001','Ca 2','CA2','14:00','22:00'),('00000000-0000-4000-8000-000000000001','Ca 3','CA3','22:00','06:00');
commit;
