# Thiết lập đăng nhập tài khoản chi nhánh và PIN nhân viên

Luồng vận hành:

1. Tài khoản chi nhánh đăng nhập bằng email và mật khẩu.
2. Nhân viên nhập mã nhân viên hoặc quét QR trên thẻ.
3. Nhân viên nhập PIN 6 số.
4. API kiểm tra nhân viên thuộc đúng chi nhánh và có lịch phân ca phù hợp.
5. Nhân viên xác nhận ca; hệ thống tạo một `work_session` riêng.
6. Mọi thao tác nghiệp vụ qua API phải gửi `x-work-session-id`.

PIN chỉ được lưu dưới dạng bcrypt hash trong `profiles.pin_hash`, không dùng làm mật khẩu Supabase.

## 1. Chạy migration Supabase

```powershell
pnpm exec supabase link --project-ref PROJECT_REF
pnpm exec supabase db push
```

Migration cần chạy: `20260715000100_employee_login_work_sessions.sql`.

## 2. Tạo tài khoản chi nhánh

Trong Supabase Dashboard, vào **Authentication → Users → Add user**:

- Email: ví dụ `pct45@a25hotel.com`.
- Password: mật khẩu riêng của tài khoản chi nhánh.
- Auto confirm user: bật.

Lấy UUID của user vừa tạo, sau đó chạy:

```sql
insert into profiles(id, organization_id, full_name, email)
values(
  'UUID_TAI_KHOAN_CHI_NHANH',
  '00000000-0000-4000-8000-000000000001',
  'Tài khoản 45 Phan Chu Trinh',
  'pct45@a25hotel.com'
);

insert into branch_memberships(profile_id, branch_id, role_id)
select
  'UUID_TAI_KHOAN_CHI_NHANH',
  '00000000-0000-4000-8000-000000000101',
  id
from roles
where code='BRANCH_ACCOUNT';
```

Một tài khoản chi nhánh chỉ được gắn với đúng một chi nhánh.

## 3. Cấp mã và PIN cho nhân viên

Nhân viên cần có bản ghi `profiles` và membership tại chi nhánh. Tạo hash PIN 6 số bằng pgcrypto:

```sql
update profiles
set
  employee_code='A250001',
  pin_hash=extensions.crypt('482731',extensions.gen_salt('bf',12))
where id='UUID_NHAN_VIEN';

insert into branch_memberships(profile_id, branch_id, role_id)
select
  'UUID_NHAN_VIEN',
  '00000000-0000-4000-8000-000000000101',
  id
from roles
where code='RECEPTIONIST'
on conflict(profile_id,branch_id) do nothing;
```

Không dùng PIN ví dụ `482731` ở môi trường thật. Mỗi nhân viên phải có một PIN ngẫu nhiên riêng.

QR trên thẻ dùng một trong hai nội dung:

```text
A25EMP:A250001
```

hoặc:

```text
a25://employee/A250001
```

## 4. Phân ca

Nhân viên chỉ xác nhận được ca đang diễn ra hoặc bắt đầu trong vòng 60 phút:

```sql
insert into shift_instances(
  organization_id, branch_id, shift_code, starts_at, ends_at
)
values(
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000101',
  'CA1',
  '2026-07-15 06:00:00+07',
  '2026-07-15 14:00:00+07'
)
returning id;

insert into shift_assignments(shift_instance_id, profile_id, assignment_type)
values('UUID_CA_VUA_TAO','UUID_NHAN_VIEN','RECEPTIONIST');
```
