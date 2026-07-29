"use client";

import { FormEvent, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  RoomTagPriority,
  roomAttentionTagsApi,
  roomTagPriorityLabels,
  roomTagStatusLabels,
  roomTagTypeLabels,
} from "@/features/room-attention-tags/api";
import {
  roomTagKeys,
  useRoomAttentionTag,
} from "@/features/room-attention-tags/hooks";
import { roleGroup, storedEmployeeRole } from "@/lib/employee-role";

const subscribeLocation = () => () => undefined;
const getClientTagId = () =>
  new URLSearchParams(window.location.search).get("id") ?? "";
const getServerTagId = () => "";
const getClientReady = () => true;
const getServerReady = () => false;
const personInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(-2)
    .map((part) => part[0]?.toLocaleUpperCase("vi") ?? "")
    .join("");
};const formatDate = (value: string, withTime = false) =>
  new Intl.DateTimeFormat(
    "vi-VN",
    withTime
      ? {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      : { day: "2-digit", month: "2-digit", year: "numeric" },
  ).format(new Date(value));

export default function RoomAttentionTagDetailPage() {
  const id = useSyncExternalStore(
    subscribeLocation,
    getClientTagId,
    getServerTagId,
  );
  const searchReady = useSyncExternalStore(
    subscribeLocation,
    getClientReady,
    getServerReady,
  );
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [finishMode, setFinishMode] = useState<"close" | "cancel" | null>(null);
  const queryClient = useQueryClient();
  const {
    data: tag,
    error: queryError,
    isLoading: loading,
  } = useRoomAttentionTag(id);
  const error =
    actionError ||
    (searchReady && !id
      ? "Thiếu mã tag phòng"
      : queryError instanceof Error
        ? queryError.message
        : "");
  const canCancel = roleGroup(storedEmployeeRole()?.code) === "management";

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    const form = event.currentTarget;
    setBusy(true);
    setActionError("");
    const data = new FormData(form);
    try {
      await roomAttentionTagsApi.update(id, {
        content: String(data.get("content")),
        priority: String(data.get("priority")) as RoomTagPriority,
        status: String(data.get("status")) as
          "OPEN" | "IN_PROGRESS" | "RESOLVED",
      });
      form.reset();
      await queryClient.invalidateQueries({ queryKey: roomTagKeys.all });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Không thể cập nhật tag");
    } finally {
      setBusy(false);
    }
  }
  async function finish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id || !finishMode) return;
    const form = event.currentTarget;
    setBusy(true);
    setActionError("");
    const data = new FormData(form);
    const input = {
      closeReason: String(data.get("closeReason")),
      finalResult: String(data.get("finalResult")),
    };
    try {
      if (finishMode === "cancel") await roomAttentionTagsApi.cancel(id, input);
      else await roomAttentionTagsApi.close(id, input);
      setFinishMode(null);
      await queryClient.invalidateQueries({ queryKey: roomTagKeys.all });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Không thể hoàn tất tag");
    } finally {
      setBusy(false);
    }
  }
  if (!searchReady || loading)
    return (
      <div className="room-tag-detail-loading">
        <div className="loader" />
        <p>Đang tải chi tiết tag...</p>
      </div>
    );
  if (!tag)
    return (
      <div className="room-tags-page">
        <Link className="detail-back" href="/room-attention-tags">
          ← Danh sách tag
        </Link>
        <div className="room-tag-error">! {error}</div>
      </div>
    );
  const active = ["OPEN", "IN_PROGRESS", "RESOLVED"].includes(tag.status);
  return (
    <div className="room-tags-page room-tag-detail-page">
      <header className="detail-page-header">
        <Link className="detail-back" href="/room-attention-tags">
          ← Tag phòng
        </Link>
        <span
          className={`priority-pill priority-${tag.priority.toLowerCase()}`}
        >
          {roomTagPriorityLabels[tag.priority]}
        </span>
        <h1>{tag.title}</h1>
        <p>
          {roomTagStatusLabels[tag.status]} · cập nhật{" "}
          {formatDate(tag.updatedAt, true)}
        </p>
      </header>
      {error && (
        <div className="room-tag-error" role="alert">
          ! {error}
        </div>
      )}
      <section className="tag-guest-card">
        <div className="tag-room-number">P.{tag.roomNumber}</div>
        <div>
          <span>KHÁCH VÀ LƯỢT LƯU TRÚ</span>
          <h2>{tag.guestName}</h2>
          <p>{tag.stayReference}</p>
        </div>
      </section>
      <section className="tag-info-grid">
        <div>
          <span>Loại tag</span>
          <strong>{roomTagTypeLabels[tag.tagType]}</strong>
        </div>
        <div>
          <span>Check-in</span>
          <strong>{formatDate(tag.checkInDate)}</strong>
        </div>
        <div>
          <span>Check-out dự kiến</span>
          <strong>{formatDate(tag.expectedCheckOutDate)}</strong>
        </div>
        <div>
          <span>Người tạo · ca</span>
          <strong>
            {tag.createdBy.fullName} · {tag.createdShiftInstance.shiftCode}
          </strong>
        </div>
      </section>
      {(tag.alerts.urgent || tag.alerts.nearCheckout || tag.alerts.stale) && (
        <div className="tag-alert-strip">
          {tag.alerts.urgent && <span>Khẩn cấp</span>}
          {tag.alerts.nearCheckout && <span>Gần check-out</span>}
          {tag.alerts.stale && <span>Cần cập nhật tiến độ</span>}
        </div>
      )}
      <section className="tag-detail-section">
        <span>NỘI DUNG CẦN LƯU Ý</span>
        <p>{tag.details}</p>
      </section>
      {active && (
        <form
          className="tag-detail-section tag-update-form tag-progress-form"
          onSubmit={update}
        >
          <div className="tag-section-heading">
            <span className="tag-section-icon" aria-hidden="true">↻</span>
            <div>
              <span>TIẾN ĐỘ XỬ LÝ</span>
              <h2>Thêm cập nhật mới</h2>
              <p>Ghi lại tình hình thực tế và việc ca tiếp theo cần thực hiện.</p>
            </div>
          </div>
          <label className="tag-progress-content">
            <span>Nội dung cập nhật</span>
            <textarea
              name="content"
              required
              minLength={3}
              rows={3}
              placeholder="Ví dụ: Đã liên hệ kỹ thuật, đang chờ kiểm tra lúc 15:00..."
            />
          </label>
          <div className="form-grid two tag-progress-options">
            <label>
              <span>Mức độ ưu tiên</span>
              <select name="priority" defaultValue={tag.priority}>
                <option value="NORMAL">Bình thường</option>
                <option value="IMPORTANT">Quan trọng</option>
                <option value="URGENT">Khẩn cấp</option>
              </select>
            </label>
            <label>
              <span>Trạng thái xử lý</span>
              <select name="status" defaultValue={tag.status}>
                <option value="OPEN">Đang theo dõi</option>
                <option value="IN_PROGRESS">Đang xử lý</option>
                <option value="RESOLVED">Đã xử lý</option>
              </select>
            </label>
          </div>
          <button className="tag-progress-submit" disabled={busy}>
            <span aria-hidden="true">＋</span>
            {busy ? "Đang lưu cập nhật..." : "Lưu cập nhật"}
          </button>
        </form>
      )}
      <section className="tag-detail-section tag-history-section">
        <div className="timeline-heading">
          <div>
            <span>DÒNG THỜI GIAN</span>
            <h2>Lịch sử cập nhật</h2>
          </div>
          <b>{tag.updates?.length ?? 0} cập nhật</b>
        </div>
        <div className="tag-timeline">
          {tag.updates?.map((item) => (
            <article key={item.id}>
              <div className="tag-timeline-avatar" aria-hidden="true">
                {personInitials(item.actor.fullName)}
              </div>
              <div className="tag-timeline-card">
                <header>
                  <div>
                    <strong>{item.actor.fullName}</strong>
                    <span>{item.shiftInstance.shiftCode}</span>
                  </div>
                  <time>{formatDate(item.createdAt, true)}</time>
                </header>
                <p>{item.content}</p>
                <footer>
                  <span>
                    {item.action === "CREATED"
                      ? "Tạo tag"
                      : item.action === "CLOSED"
                        ? "Đóng tag"
                        : item.action === "CANCELLED"
                          ? "Hủy tag"
                          : "Cập nhật tiến độ"}
                  </span>
                </footer>
              </div>
            </article>
          ))}
        </div>
      </section>
      {tag.closedAt && (
        <section className="tag-detail-section tag-finish-result">
          <span>KẾT QUẢ CUỐI CÙNG</span>
          <strong>{tag.closeReason}</strong>
          <p>{tag.finalResult}</p>
          <small>
            {tag.closedBy?.fullName} · {formatDate(tag.closedAt, true)}
          </small>
        </section>
      )}
      {active && (
        <section className="tag-final-actions">
          <div className="tag-final-copy">
            <span>HOÀN TẤT THEO DÕI</span>
            <strong>Kết thúc tag phòng</strong>
            <p>Chỉ đóng tag khi nội dung đã được xử lý hoặc bàn giao đầy đủ.</p>
          </div>
          <button onClick={() => setFinishMode("close")}>
            <span aria-hidden="true">✓</span>
            Đóng tag
          </button>
          {canCancel && (
            <button className="danger" onClick={() => setFinishMode("cancel")}>
              Hủy tag tạo nhầm
            </button>
          )}
        </section>
      )}      {finishMode && (
        <div
          className="room-tag-modal room-tag-finish-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="room-tag-finish-title"
        >
          <form
            className={`room-tag-form room-tag-finish-form ${
              finishMode === "cancel" ? "is-danger" : ""
            }`}
            onSubmit={finish}
          >
            <header>
              <div>
                <span>
                  {finishMode === "cancel"
                    ? "HỦY TAG TẠO NHẦM"
                    : "HOÀN TẤT THEO DÕI"}
                </span>
                <h2 id="room-tag-finish-title">
                  {finishMode === "cancel"
                    ? "Xác nhận hủy tag"
                    : "Đóng tag phòng"}
                </h2>
                <p>
                  {finishMode === "cancel"
                    ? "Ghi rõ nguyên nhân để lịch sử thao tác luôn minh bạch."
                    : "Xác nhận kết quả cuối cùng trước khi kết thúc theo dõi."}
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng hộp thoại"
                onClick={() => setFinishMode(null)}
              >
                ×
              </button>
            </header>
            <div className="room-tag-form-content room-tag-finish-content">
              <div className="room-tag-finish-note">
                <span aria-hidden="true">✓</span>
                <p>
                  Tag sẽ biến mất khỏi danh sách đang theo dõi nhưng toàn bộ lịch
                  sử vẫn được lưu lại.
                </p>
              </div>
              <label>
                <span>
                  Lý do {finishMode === "cancel" ? "hủy" : "đóng"}
                  <b aria-hidden="true"> *</b>
                </span>
                <input
                  name="closeReason"
                  required
                  minLength={3}
                  placeholder={
                    finishMode === "cancel"
                      ? "Ví dụ: Tag được tạo nhầm"
                      : "Ví dụ: Yêu cầu đã được xử lý"
                  }
                />
              </label>
              <label>
                <span>
                  Kết quả xử lý cuối cùng<b aria-hidden="true"> *</b>
                </span>
                <textarea
                  name="finalResult"
                  required
                  minLength={3}
                  rows={4}
                  placeholder="Mô tả kết quả, nội dung đã bàn giao hoặc xác nhận với khách..."
                />
                <small>Tối thiểu 3 ký tự · Nội dung được lưu vào lịch sử tag</small>
              </label>
            </div>
            <footer className="room-tag-form-actions room-tag-finish-actions">
              <button
                type="button"
                className="room-tag-finish-secondary"
                onClick={() => setFinishMode(null)}
              >
                Quay lại
              </button>
              <button className="room-tag-submit" disabled={busy}>
                {busy
                  ? "Đang lưu..."
                  : finishMode === "cancel"
                    ? "Xác nhận hủy tag"
                    : "Xác nhận đóng tag"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
