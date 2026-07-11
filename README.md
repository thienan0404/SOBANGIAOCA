# A25 Hotel — Sổ bàn giao ca lễ tân

Hệ thống bàn giao ca tối ưu cho điện thoại, chạy bằng Next.js trên Render và dùng Supabase cho PostgreSQL, Auth, RLS và Realtime.

## Chức năng

- Đăng ký, đăng nhập và duy trì phiên nhân viên.
- Tự động tạo ca sáng, chiều hoặc đêm theo giờ Việt Nam.
- Thêm công việc bàn giao theo phòng, nhóm việc, mức độ và hạn xử lý.
- Quy trình trạng thái: chờ xử lý → đang xử lý → chờ xác nhận → hoàn tất.
- Xác nhận nhận ca và lưu người nhận.
- Đồng bộ thay đổi thời gian thực giữa nhiều thiết bị.
- Tách dữ liệu theo khách sạn bằng Supabase Row Level Security.
- Nhật ký kiểm toán cho mọi thay đổi trên nội dung bàn giao.

## Chạy ở máy cá nhân

Yêu cầu Node.js 22 trở lên.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Điền `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY` trong `.env.local`.

## Khởi tạo Supabase

1. Tạo một project Supabase.
2. Mở SQL Editor.
3. Chạy toàn bộ file `supabase/migrations/20260711000000_init_handover_system.sql`.
4. Trong Authentication → URL Configuration, thêm URL Render vào Site URL và Redirect URLs.
5. Lấy Project URL và anon/publishable key trong Project Settings → API.

Migration tạo sẵn khách sạn `A25 Hotel`, các bảng nghiệp vụ, chỉ mục, trigger hồ sơ, audit log, Realtime và toàn bộ chính sách RLS.

## Triển khai Render

Repository đã có `render.yaml`.

1. Trên Render chọn **New → Blueprint** và kết nối repository này.
2. Nhập hai biến được yêu cầu:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Tạo service và chờ build hoàn tất.

Render dùng `npm ci && npm run build` và `npm start`. Mỗi lần đẩy lên nhánh `main`, service sẽ tự triển khai lại.

## Phân quyền

Tài khoản mới mặc định có vai trò `receptionist` và thuộc khách sạn đầu tiên. Có thể đổi `role` trong bảng `profiles` thành `manager` hoặc `admin`. RLS đảm bảo nhân viên chỉ đọc và cập nhật dữ liệu thuộc khách sạn của họ.
