"use client";

import { FormEvent, useState } from "react";
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

const formatDate = (value: string, withTime = false) =>
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
  const [id] = useState(() =>
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.search).get("id") ?? ""),
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
    (!id
      ? "Thiếu mã tag phòng"
      : queryError instanceof Error
        ? queryError.message
        : "");
  const canCancel = roleGroup(storedEmployeeRole()?.code) === "management";

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    setBusy(true);
    setActionError("");
    const data = new FormData(event.currentTarget);
    try {
      await roomAttentionTagsApi.update(id, {
        content: String(data.get("content")),
        priority: String(data.get("priority")) as RoomTagPriority,
        status: String(data.get("status")) as
          "OPEN" | "IN_PROGRESS" | "RESOLVED",
      });
      event.currentTarget.reset();
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
    setBusy(true);
    setActionError("");
    const data = new FormData(event.currentTarget);
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
  if (loading)
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
        <form className="tag-detail-section tag-update-form" onSubmit={update}>
          <span>THÊM CẬP NHẬT</span>
          <label>
            Nội dung
            <textarea
              name="content"
              required
              minLength={3}
              rows={3}
              placeholder="Tình hình thực tế và hành động tiếp theo"
            />
          </label>
          <div className="form-grid two">
            <label>
              Mức độ
              <select name="priority" defaultValue={tag.priority}>
                <option value="NORMAL">Bình thường</option>
                <option value="IMPORTANT">Quan trọng</option>
                <option value="URGENT">Khẩn cấp</option>
              </select>
            </label>
            <label>
              Trạng thái
              <select name="status" defaultValue={tag.status}>
                <option value="OPEN">Đang theo dõi</option>
                <option value="IN_PROGRESS">Đang xử lý</option>
                <option value="RESOLVED">Đã xử lý</option>
              </select>
            </label>
          </div>
          <button disabled={busy}>
            {busy ? "Đang lưu..." : "Lưu cập nhật"}
          </button>
        </form>
      )}
      <section className="tag-detail-section">
        <div className="timeline-heading">
          <span>DÒNG THỜI GIAN</span>
          <b>{tag.updates?.length ?? 0} cập nhật</b>
        </div>
        <div className="tag-timeline">
          {tag.updates?.map((item) => (
            <article key={item.id}>
              <i />
              <div>
                <header>
                  <strong>{item.actor.fullName}</strong>
                  <span>{item.shiftInstance.shiftCode}</span>
                </header>
                <p>{item.content}</p>
                <small>
                  {formatDate(item.createdAt, true)} ·{" "}
                  {item.action === "CREATED"
                    ? "Tạo tag"
                    : item.action === "CLOSED"
                      ? "Đóng tag"
                      : item.action === "CANCELLED"
                        ? "Hủy tag"
                        : "Cập nhật"}
                </small>
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
        <div className="tag-final-actions">
          <button onClick={() => setFinishMode("close")}>Đóng tag</button>
          {canCancel && (
            <button className="danger" onClick={() => setFinishMode("cancel")}>
              Hủy tag tạo nhầm
            </button>
          )}
        </div>
      )}
      {finishMode && (
        <div className="room-tag-modal">
          <form className="room-tag-form compact" onSubmit={finish}>
            <header>
              <div>
                <span>
                  {finishMode === "cancel"
                    ? "HỦY TAG TẠO NHẦM"
                    : "HOÀN TẤT THEO DÕI"}
                </span>
                <h2>
                  {finishMode === "cancel"
                    ? "Xác nhận hủy tag"
                    : "Đóng tag phòng"}
                </h2>
              </div>
              <button type="button" onClick={() => setFinishMode(null)}>
                ×
              </button>
            </header>
            <label>
              Lý do {finishMode === "cancel" ? "hủy" : "đóng"}
              <input name="closeReason" required minLength={3} />
            </label>
            <label>
              Kết quả xử lý cuối cùng
              <textarea name="finalResult" required minLength={3} rows={4} />
            </label>
            <button className="room-tag-submit" disabled={busy}>
              {busy
                ? "Đang lưu..."
                : finishMode === "cancel"
                  ? "Hủy tag"
                  : "Đóng tag"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
