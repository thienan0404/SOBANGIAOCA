"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CreateRoomTag,
  RoomAttentionTag,
  RoomTagFilters,
  RoomTagPriority,
  RoomTagType,
  roomAttentionTagsApi,
  roomTagPriorityLabels,
  roomTagStatusLabels,
  roomTagTypeLabels,
} from "@/features/room-attention-tags/api";

const types = Object.keys(roomTagTypeLabels) as RoomTagType[];
const priorities = Object.keys(roomTagPriorityLabels) as RoomTagPriority[];
const today = () => new Date().toISOString().slice(0, 10);
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
const formatTime = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export default function RoomAttentionTagsPage() {
  const [filters, setFilters] = useState<RoomTagFilters>({ active: true });
  const [tags, setTags] = useState<RoomAttentionTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const activeFilterCount = [
    filters.active === false,
    Boolean(filters.priority),
    Boolean(filters.tagType),
    Boolean(filters.expectedCheckOutDate),
  ].filter(Boolean).length;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setTags(await roomAttentionTagsApi.list(filters));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải tag phòng");
    } finally {
      setLoading(false);
    }
  }, [filters]);
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  async function createTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const branchId = localStorage.getItem("a25.branchId") ?? "";
    const input = Object.fromEntries(data.entries());
    try {
      await roomAttentionTagsApi.create({
        ...input,
        branchId,
      } as CreateRoomTag);
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo tag");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="room-tags-page">
      <header className="room-tags-hero">
        <div className="room-tags-hero-top">
          <span className="page-kicker">THEO DÕI LƯU TRÚ</span>
          <button
            type="button"
            className="room-tag-create-button"
            onClick={() => setShowCreate(true)}
          >
            <span aria-hidden="true">＋</span>
            Tạo tag
          </button>
        </div>
        <h1>Tag phòng cần lưu ý</h1>
        <p>Thông tin dùng chung giữa các ca tại chi nhánh.</p>
      </header>
      <section className="room-tag-alert-summary">
        <div>
          <strong>{tags.filter((tag) => tag.alerts.urgent).length}</strong>
          <span>Khẩn cấp</span>
        </div>
        <i />
        <div>
          <strong>
            {tags.filter((tag) => tag.alerts.nearCheckout).length}
          </strong>
          <span>Gần check-out</span>
        </div>
        <i />
        <div>
          <strong>{tags.filter((tag) => tag.alerts.stale).length}</strong>
          <span>Cần cập nhật</span>
        </div>
      </section>
      <div className="room-tag-filter-bar">
        <label className="room-tag-room-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={filters.roomNumber ?? ""}
            onChange={(e) =>
              setFilters((value) => ({
                ...value,
                roomNumber: e.target.value,
              }))
            }
            placeholder="Tìm theo số phòng"
            aria-label="Tìm theo số phòng"
          />
        </label>
        <button
          type="button"
          className={showFilters ? "is-open" : ""}
          onClick={() => setShowFilters((value) => !value)}
          aria-expanded={showFilters}
          aria-controls="room-tag-advanced-filters"
        >
          <span aria-hidden="true">☷</span>
          Bộ lọc
          {activeFilterCount > 0 && <b>{activeFilterCount}</b>}
        </button>
      </div>
      {showFilters && (
        <section
          id="room-tag-advanced-filters"
          className="room-tag-filters"
          aria-label="Bộ lọc tag phòng"
        >
          <header>
            <div>
              <strong>Lọc nâng cao</strong>
              <span>Thu hẹp danh sách tag cần theo dõi</span>
            </div>
            <button
              type="button"
              onClick={() => setFilters({ active: true })}
              disabled={activeFilterCount === 0}
            >
              Đặt lại
            </button>
          </header>
          <div>
            <label>
              Danh sách
              <select
                value={filters.active === false ? "all" : "active"}
                onChange={(e) =>
                  setFilters((value) => ({
                    ...value,
                    active: e.target.value === "active",
                    status: "",
                  }))
                }
              >
                <option value="active">Đang hoạt động</option>
                <option value="all">Tất cả lịch sử</option>
              </select>
            </label>
            <label>
              Mức độ
              <select
                value={filters.priority ?? ""}
                onChange={(e) =>
                  setFilters((value) => ({
                    ...value,
                    priority: e.target.value as RoomTagPriority | "",
                  }))
                }
              >
                <option value="">Tất cả</option>
                {priorities.map((value) => (
                  <option key={value} value={value}>
                    {roomTagPriorityLabels[value]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <label>
              Loại tag
              <select
                value={filters.tagType ?? ""}
                onChange={(e) =>
                  setFilters((value) => ({
                    ...value,
                    tagType: e.target.value as RoomTagType | "",
                  }))
                }
              >
                <option value="">Tất cả</option>
                {types.map((value) => (
                  <option key={value} value={value}>
                    {roomTagTypeLabels[value]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Check-out dự kiến
              <input
                type="date"
                value={filters.expectedCheckOutDate ?? ""}
                onChange={(e) =>
                  setFilters((value) => ({
                    ...value,
                    expectedCheckOutDate: e.target.value,
                  }))
                }
              />
            </label>
          </div>
        </section>
      )}
      <div className="room-tag-list-heading">
        <div>
          <span>TAG ĐANG THEO DÕI</span>
          <h2>Danh sách lưu ý</h2>
        </div>
        {!loading && <b>{tags.length} tag</b>}
      </div>
      {error && (
        <div className="room-tag-error" role="alert">
          ! {error}
          <button onClick={() => void load()}>Thử lại</button>
        </div>
      )}
      {loading ? (
        <div className="room-tag-skeleton">
          <i />
          <i />
          <i />
        </div>
      ) : tags.length === 0 ? (
        <div className="room-tag-empty">
          <span>✓</span>
          <strong>Không có tag phù hợp</strong>
          <p>Tag đang hoạt động hoặc lịch sử sẽ xuất hiện tại đây.</p>
        </div>
      ) : (
        <div className="room-tag-list">
          {tags.map((tag) => (
            <Link
              key={tag.id}
              href={`/room-attention-tags/detail?id=${tag.id}`}
              className={`room-tag-card priority-${tag.priority.toLowerCase()}`}
            >
              <div className="room-tag-card-top">
                <span className="room-badge">P.{tag.roomNumber}</span>
                <div>
                  <strong>{tag.guestName}</strong>
                  <small>{tag.stayReference}</small>
                </div>
                <b>{roomTagPriorityLabels[tag.priority]}</b>
              </div>
              <h2>{tag.title}</h2>
              <p>{tag.updates?.[0]?.content ?? tag.details}</p>
              <div className="room-tag-chips">
                <span>{roomTagTypeLabels[tag.tagType]}</span>
                {tag.alerts.nearCheckout && (
                  <span className="warn">Sắp check-out</span>
                )}
                {tag.alerts.stale && (
                  <span className="warn">Lâu chưa cập nhật</span>
                )}
              </div>
              <footer>
                <span>Check-out {formatDate(tag.expectedCheckOutDate)}</span>
                <span>
                  {roomTagStatusLabels[tag.status]} ·{" "}
                  {formatTime(tag.updatedAt)}
                </span>
                <b>›</b>
              </footer>
            </Link>
          ))}
        </div>
      )}
      {showCreate && (
        <div
          className="room-tag-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Tạo tag phòng"
        >
          <form onSubmit={createTag} className="room-tag-form">
            <header>
              <div>
                <span>TẠO TAG DÙNG CHUNG</span>
                <h2>Phòng cần lưu ý</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                aria-label="Đóng"
              >
                ×
              </button>
            </header>
            <div className="form-grid two">
              <label>
                Số phòng
                <input name="roomNumber" required maxLength={20} />
              </label>
              <label>
                Tên khách
                <input name="guestName" required maxLength={180} />
              </label>
            </div>
            <label>
              Mã booking / lượt lưu trú
              <input name="stayReference" required maxLength={100} />
            </label>
            <div className="form-grid two">
              <label>
                Ngày check-in
                <input
                  type="date"
                  name="checkInDate"
                  defaultValue={today()}
                  required
                />
              </label>
              <label>
                Check-out dự kiến
                <input
                  type="date"
                  name="expectedCheckOutDate"
                  defaultValue={today()}
                  required
                />
              </label>
            </div>
            <div className="form-grid two">
              <label>
                Loại tag
                <select name="tagType" required>
                  {types.map((value) => (
                    <option key={value} value={value}>
                      {roomTagTypeLabels[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Mức độ
                <select name="priority" defaultValue="NORMAL">
                  {priorities.map((value) => (
                    <option key={value} value={value}>
                      {roomTagPriorityLabels[value]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Tiêu đề cần lưu ý
              <input
                name="title"
                required
                minLength={3}
                maxLength={180}
                placeholder="Mô tả ngắn gọn, khách quan"
              />
            </label>
            <label>
              Nội dung và hành động cần xử lý
              <textarea
                name="details"
                required
                minLength={3}
                rows={4}
                placeholder="Nêu rõ tình huống thực tế và việc ca sau cần làm"
              />
            </label>
            <p className="form-guidance">
              Không dùng nhãn cảm tính. Hệ thống sẽ gợi ý cập nhật tag cũ nếu
              cùng lượt lưu trú, phòng và loại vấn đề.
            </p>
            <button className="room-tag-submit" disabled={creating}>
              {creating ? "Đang tạo..." : "Tạo tag phòng"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
