import { apiRequest } from "@/features/handovers/api/client";

export type RoomTagType =
  | "SPECIAL_REQUEST"
  | "EXTRA_CARE"
  | "ROOM_ISSUE"
  | "GUEST_DEBT"
  | "WAKE_UP"
  | "TRANSPORT"
  | "GUEST_ASSET"
  | "OTHER";
export type RoomTagPriority = "NORMAL" | "IMPORTANT" | "URGENT";
export type RoomTagStatus =
  "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "CANCELLED";
export type RoomTagUpdate = {
  id: string;
  content: string;
  action: string;
  createdAt: string;
  actor: { id: string; fullName: string; employeeCode?: string | null };
  shiftInstance: { id: string; shiftCode: string };
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
};
export type RoomAttentionTag = {
  id: string;
  branchId: string;
  stayReference: string;
  roomNumber: string;
  guestName: string;
  checkInDate: string;
  expectedCheckOutDate: string;
  tagType: RoomTagType;
  priority: RoomTagPriority;
  title: string;
  details: string;
  status: RoomTagStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; fullName: string; employeeCode?: string | null };
  createdShiftInstance: { id: string; shiftCode: string };
  updates?: RoomTagUpdate[];
  closedBy?: { id: string; fullName: string } | null;
  closedAt?: string | null;
  closeReason?: string | null;
  finalResult?: string | null;
  alerts: { urgent: boolean; nearCheckout: boolean; stale: boolean };
};
export type CreateRoomTag = {
  branchId: string;
  stayReference: string;
  roomNumber: string;
  guestName: string;
  checkInDate: string;
  expectedCheckOutDate: string;
  tagType: RoomTagType;
  priority: RoomTagPriority;
  title: string;
  details: string;
};
export type RoomTagFilters = {
  active?: boolean;
  status?: RoomTagStatus | "";
  priority?: RoomTagPriority | "";
  tagType?: RoomTagType | "";
  roomNumber?: string;
  expectedCheckOutDate?: string;
};

function queryString(filters: RoomTagFilters) {
  const query = new URLSearchParams();
  if (filters.active !== undefined) query.set("active", String(filters.active));
  for (const key of [
    "status",
    "priority",
    "tagType",
    "roomNumber",
    "expectedCheckOutDate",
  ] as const) {
    const value = filters[key];
    if (value) query.set(key, value);
  }
  return query.toString();
}

export const roomAttentionTagsApi = {
  list: (filters: RoomTagFilters = { active: true }) =>
    apiRequest<RoomAttentionTag[]>(
      `/room-attention-tags?${queryString(filters)}`,
    ),
  get: (id: string) =>
    apiRequest<RoomAttentionTag>(`/room-attention-tags/${id}`),
  create: (input: CreateRoomTag) =>
    apiRequest<RoomAttentionTag>("/room-attention-tags", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (
    id: string,
    input: {
      content: string;
      priority?: RoomTagPriority;
      status?: "OPEN" | "IN_PROGRESS" | "RESOLVED";
    },
  ) =>
    apiRequest<RoomAttentionTag>(`/room-attention-tags/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  close: (id: string, input: { closeReason: string; finalResult: string }) =>
    apiRequest<RoomAttentionTag>(`/room-attention-tags/${id}/close`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  cancel: (id: string, input: { closeReason: string; finalResult: string }) =>
    apiRequest<RoomAttentionTag>(`/room-attention-tags/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

export const roomTagTypeLabels: Record<RoomTagType, string> = {
  SPECIAL_REQUEST: "Yêu cầu đặc biệt",
  EXTRA_CARE: "Cần chăm sóc thêm",
  ROOM_ISSUE: "Sự cố phòng",
  GUEST_DEBT: "Công nợ khách",
  WAKE_UP: "Báo thức",
  TRANSPORT: "Yêu cầu đặt xe",
  GUEST_ASSET: "Tài sản khách gửi",
  OTHER: "Khác",
};
export const roomTagPriorityLabels: Record<RoomTagPriority, string> = {
  NORMAL: "Bình thường",
  IMPORTANT: "Quan trọng",
  URGENT: "Khẩn cấp",
};
export const roomTagStatusLabels: Record<RoomTagStatus, string> = {
  OPEN: "Đang theo dõi",
  IN_PROGRESS: "Đang xử lý",
  RESOLVED: "Đã xử lý",
  CLOSED: "Đã đóng",
  CANCELLED: "Tạo nhầm",
};
