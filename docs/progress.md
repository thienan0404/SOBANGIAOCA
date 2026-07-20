# Tiến độ triển khai

## Nền tảng đăng ký thiết bị chi nhánh

Trạng thái: **HOÀN TẤT**

Phạm vi đã triển khai:

- Thêm bảng `branch_devices` và Prisma model tương ứng.
- Mỗi thiết bị bắt buộc gắn với đúng một chi nhánh; `device_code` là duy nhất.
- Token thiết bị được tạo bằng 32 byte ngẫu nhiên và database chỉ lưu SHA-256; token thô chỉ xuất hiện trong phản hồi đăng ký một lần.
- Trình duyệt ghi nhớ token bằng cookie `HttpOnly`, không lưu token trong `localStorage` hoặc `sessionStorage`.
- Chỉ thành viên có vai trò `BRANCH_MANAGER` hoặc `ADMIN` hợp lệ mới được đăng ký thiết bị.
- Thiết bị bị vô hiệu hóa hoặc thu hồi bị từ chối; lần xác thực hợp lệ cập nhật `last_seen_at`.
- Kết nối màn hình đăng nhập hiện có với luồng đăng ký thiết bị, không thay đổi CSS hoặc thiết kế giao diện.
- Không nối luồng mới với danh sách nhân viên, PIN nhân viên, phiên vận hành, ca làm việc hoặc nghiệp vụ bàn giao.

API đã triển khai:

- `POST /api/v1/branch-devices/register`
- `GET /api/v1/branch-devices/current`

Migration:

- `supabase/migrations/20260715000400_branch_devices.sql`

## Kết quả xác minh ngày 18/07/2026

| Lệnh/kiểm tra | Kết quả |
| --- | --- |
| Prisma schema validation | **PASS** |
| `pnpm typecheck` | **PASS** — 8/8 packages |
| `pnpm lint` | **PASS** — 0 lỗi, 1 cảnh báo có sẵn về thẻ `<img>` |
| Unit tests `branch-devices.service.spec.ts` | **PASS** — 7/7 tests |
| API integration tests `branch-devices.integration.spec.ts` | **PASS** — 2/2 tests |
| `pnpm --filter @a25/web build` | **PASS** |
| `pnpm --filter @a25/api build` | **PASS** |

Kết quả tổng thể: **PASS**.

## Normal account login - 20/07/2026

Status: **COMPLETE**

- The web login no longer checks or registers a branch device.
- Users sign in with their Supabase email and password and enter the application directly.
- The assigned branch is resolved from the signed-in account membership.
- Protected web routes and business APIs now validate the Supabase access token.
- Existing branch device tables and endpoints remain in place for backward compatibility, but they no longer block the web login flow.

Verification:

| Check | Result |
| --- | --- |
| `pnpm typecheck` | **PASS** - 8/8 packages |
| `pnpm lint` | **PASS** - 8/8 packages |
| API unit tests | **PASS** - 3 suites, 11 tests |
| `pnpm --filter @a25/web build` | **PASS** |
| `pnpm --filter @a25/api build` | **PASS** |
