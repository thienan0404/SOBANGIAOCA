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

## Luồng bàn giao 4 chữ ký - 28/07/2026

Trạng thái: **HOÀN TẤT Ở MỨC MÃ NGUỒN**

- Giữ nguyên đăng nhập hai lớp, xác định ca, phiên làm việc, biểu mẫu bàn giao và sổ thu/chi chi tiết.
- Người giao hoàn tất kiểm kê, nhập họ tên ký và gửi phiếu.
- Người nhận đăng nhập tạm thời bằng tài khoản nhân viên, xác nhận kiểm kê hai bên và ký.
- Khi người nhận ký thành công, phiên người giao chuyển sang `TRANSFERRED` và phiên người nhận trở thành phiên đang hoạt động trên thiết bị.
- BGĐ/Phó BGĐ cơ sở ký sau người nhận; kế toán ký sau BGĐ.
- Phiếu chỉ chuyển sang `COMPLETED` và đặt `locked_at` sau khi đủ bốn chữ ký.
- Database từ chối khóa khi thiếu chữ ký hoặc thiếu kiểm kê hai bên; phiếu và dữ liệu con đã khóa không thể sửa/xóa.
- Mỗi bước tạo audit log và outbox event, kèm vai trò, thời gian, IP, user-agent và mã request khi có.
- Mật khẩu đăng nhập tạm thời không được ghi vào database; bằng chứng chữ ký lưu bằng SHA-256.

Migration cần áp dụng trước khi deploy API:

- `supabase/migrations/20260728000100_four_signature_workflow.sql`

Kết quả xác minh:

| Kiểm tra | Kết quả |
| --- | --- |
| Prisma Client generation | **PASS** |
| Supabase migration dry-run | **PASS** - 1 migration pending, không ghi production |
| `pnpm typecheck` | **PASS** - 8/8 packages |
| `pnpm lint` | **PASS** - 8/8 packages |
| API unit tests | **PASS** - 3 suites, 14 tests |
| API integration tests | **PASS** - 2/2 tests |
| Web unit tests | **PASS** - 2 files, 5 tests |
| Validation tests | **PASS** - 4/4 tests |
| Handover state tests | **PASS** - 5/5 tests |
| `pnpm --filter @a25/api build` | **PASS** |
| `pnpm --filter @a25/web build` | **PASS** - 30 static pages |

Chưa thực hiện trong lượt này:

- Chưa chạy `supabase db push` vào database production.
- Chưa deploy lại Render.

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

## Khóa vận hành, trả lại và điều chỉnh phiếu - 28/07/2026

Trạng thái: **HOÀN TẤT**

Các chức năng hiện có được giữ nguyên:

- Xác định ca theo lịch và thời gian thực, tạo phiên làm việc.
- Lập phiếu, nhập từng khoản thu/chi có nội dung, số tiền, hình thức và lý do.
- Kiểm kê hai bên, chữ ký người giao, đăng nhập tạm thời và chữ ký người nhận.
- Kết thúc phiên người giao, chuyển phiên sang người nhận, BGĐ và kế toán ký, audit log.

Các thay đổi để đúng luồng vận hành:

- Khi người nhận ký, đặt `operational_locked_at`: hoàn tất giao ca vận hành và khóa dữ liệu gốc.
- Phiếu chuyển sang **Đã bàn giao – Chờ BGĐ cơ sở**; ca của người nhận tiếp tục hoạt động bình thường.
- BGĐ/Phó BGĐ có thể ký duyệt hoặc trả lại kèm lý do.
- Kế toán có thể ký nghiệm thu hoặc trả lại kèm lý do.
- Người nhận xử lý phiếu trả lại bằng một bản điều chỉnh append-only, chọn phạm vi vận hành/tài chính và ký lại bằng tài khoản tạm thời.
- Khi kế toán trả lại, chữ ký BGĐ và kế toán trước đó bị hủy để bắt buộc duyệt lại từ BGĐ.
- Phiếu chỉ đặt `locked_at`, hoàn tất hồ sơ và trở thành bất biến hoàn toàn sau đủ bốn chữ ký.
- Database ngăn sửa dữ liệu gốc sau khóa vận hành, ngăn sửa/xóa bản điều chỉnh và ngăn mọi thay đổi sau khóa cuối.

API mới:

- `POST /api/v1/handovers/:id/management-return`
- `POST /api/v1/handovers/:id/accounting-return`
- `POST /api/v1/handovers/:id/receiver-amend`

Migration:

- `supabase/migrations/20260728000300_operational_handover_review_returns.sql`
- `supabase/migrations/20260728000400_backfill_operational_handover_lock.sql`
- `supabase/migrations/20260728000500_protect_operational_signatures.sql`
- **PASS** — đã áp dụng lên Supabase linked project; local/remote cùng phiên bản `20260728000500`.

Kết quả xác minh:

| Kiểm tra                       | Kết quả                          |
| ------------------------------ | -------------------------------- |
| Prisma Client generation       | **PASS**                         |
| `pnpm typecheck`               | **PASS** — 8/8 packages          |
| `pnpm lint`                    | **PASS** — 8/8 packages          |
| Validation tests               | **PASS** — 6/6 tests             |
| API unit tests                 | **PASS** — 3 suites, 16/16 tests |
| API integration tests hiện có  | **PASS** — 2/2 tests             |
| `pnpm --filter @a25/web build` | **PASS** — 30 static pages       |
| `pnpm --filter @a25/api build` | **PASS**                         |
| Supabase `db push --linked`    | **PASS**                         |
| Supabase migration parity      | **PASS**                         |

Ghi chú môi trường: máy kiểm tra đang chạy Node.js 24.14.0 nên pnpm hiển thị cảnh báo khác với Node.js 22.14.0 được khóa cho Render; tất cả lệnh xác minh vẫn PASS.

## Giao diện theo vai trò nhân viên - 28/07/2026

Trạng thái: **HOÀN TẤT**

- Vai trò được lấy từ `branch_memberships` của đúng nhân viên và đúng chi nhánh đang đăng nhập.
- Lễ tân thấy Tổng quan, Chi tiết, Công việc, Ký nhận và chức năng tạo/nhận bàn giao.
- BGĐ/Phó BGĐ/Quản lý chi nhánh thấy trung tâm phê duyệt, danh sách phiếu chờ BGĐ và báo cáo.
- Kế toán/Kế toán trưởng thấy danh sách nghiệm thu, Tài chính - quỹ và báo cáo.
- Danh sách bàn giao tự lọc theo trạng thái cần xử lý của từng vai trò; BGĐ và kế toán không thấy nút tạo phiếu.
- Trang Cài đặt hiển thị vai trò hiện tại; đăng xuất nhân viên xóa toàn bộ ngữ cảnh vai trò.
- Backend vẫn là lớp kiểm soát quyền bắt buộc; việc ẩn/hiện giao diện không thay thế kiểm tra quyền API.

Migration:

- `supabase/migrations/20260728000600_employee_role_context.sql`
- **PASS** - đã áp dụng thành công lên Supabase linked project.

Kết quả xác minh:

| Kiểm tra | Kết quả |
| --- | --- |
| `pnpm typecheck` | **PASS** - 8/8 packages |
| `pnpm lint` | **PASS** - 8/8 packages |
| `pnpm --filter @a25/web build` | **PASS** - 30 static pages |
| `pnpm --filter @a25/api build` | **PASS** |
| Web unit tests | **FAIL (môi trường)** - Vitest/esbuild bị sandbox Windows từ chối đọc thư mục cha trước khi tải cấu hình; không có test nào được chạy |
| Supabase `db push --linked` | **PASS** |