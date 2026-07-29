import { apiRequest } from "@/features/handovers/api/client";
import { createClient } from "@/lib/supabase/client";

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

type DirectRoomAttentionTag = {
  id: string;
  branch_id: string;
  stay_reference: string;
  room_number: string;
  guest_name: string;
  check_in_date: string;
  expected_check_out_date: string;
  tag_type: RoomTagType;
  priority: RoomTagPriority;
  title: string;
  details: string;
  status: RoomTagStatus;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  close_reason: string | null;
  final_result: string | null;
};

async function listRoomAttentionTags(
  filters: RoomTagFilters,
): Promise<RoomAttentionTag[]> {
  const branchId =
    typeof window === "undefined" ? null : localStorage.getItem("a25.branchId");
  let query = createClient()
    .from("room_attention_tags")
    .select(
      "id,branch_id,stay_reference,room_number,guest_name,check_in_date,expected_check_out_date,tag_type,priority,title,details,status,created_at,updated_at,closed_at,close_reason,final_result",
    )
    .order("updated_at", { ascending: false })
    .limit(100);
  if (branchId) query = query.eq("branch_id", branchId);
  if (filters.active !== false)
    query = query.in("status", ["OPEN", "IN_PROGRESS", "RESOLVED"]);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.tagType) query = query.eq("tag_type", filters.tagType);
  if (filters.roomNumber)
    query = query.ilike("room_number", `%${filters.roomNumber}%`);
  if (filters.expectedCheckOutDate)
    query = query.eq(
      "expected_check_out_date",
      filters.expectedCheckOutDate,
    );
  const { data, error } = await query;
  if (error)
    return apiRequest<RoomAttentionTag[]>(
      `/room-attention-tags?${queryString(filters)}`,
    );
  const now = Date.now();
  const priorityRank: Record<RoomTagPriority, number> = {
    NORMAL: 0,
    IMPORTANT: 1,
    URGENT: 2,
  };
  return ((data ?? []) as DirectRoomAttentionTag[])
    .map((row) => {
      const checkout = new Date(
        `${row.expected_check_out_date}T23:59:59+07:00`,
      ).getTime();
      return {
        id: row.id,
        branchId: row.branch_id,
        stayReference: row.stay_reference,
        roomNumber: row.room_number,
        guestName: row.guest_name,
        checkInDate: row.check_in_date,
        expectedCheckOutDate: row.expected_check_out_date,
        tagType: row.tag_type,
        priority: row.priority,
        title: row.title,
        details: row.details,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: { id: "", fullName: "" },
        createdShiftInstance: { id: "", shiftCode: "" },
        closedAt: row.closed_at,
        closeReason: row.close_reason,
        finalResult: row.final_result,
        alerts: {
          urgent: row.priority === "URGENT",
          nearCheckout:
            checkout - now <= 36 * 60 * 60 * 1000 &&
            checkout >= now - 24 * 60 * 60 * 1000,
          stale:
            now - new Date(row.updated_at).getTime() >= 4 * 60 * 60 * 1000,
        },
      };
    })
    .sort(
      (a, b) =>
        priorityRank[b.priority] - priorityRank[a.priority] ||
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
}
type DirectRoomAttentionTagDetail = DirectRoomAttentionTag & {
  created_by: string;
  created_shift_instance_id: string;
  closed_by: string | null;
};
type DirectRoomAttentionTagUpdate = {
  id: string;
  content: string;
  action: string;
  actor_id: string;
  shift_instance_id: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
};
type DirectProfile = {
  id: string;
  full_name: string;
  employee_code: string | null;
};
type DirectShift = { id: string; shift_code: string };

async function getRoomAttentionTag(id: string): Promise<RoomAttentionTag> {
  const client = createClient();
  const { data: rawTag, error: tagError } = await client
    .from("room_attention_tags")
    .select(
      "id,branch_id,stay_reference,room_number,guest_name,check_in_date,expected_check_out_date,tag_type,priority,title,details,status,created_by,created_shift_instance_id,closed_by,closed_at,close_reason,final_result,created_at,updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (tagError || !rawTag)
    return apiRequest<RoomAttentionTag>(`/room-attention-tags/${id}`);

  const tag = rawTag as DirectRoomAttentionTagDetail;
  const { data: rawUpdates, error: updatesError } = await client
    .from("room_attention_tag_updates")
    .select(
      "id,content,action,actor_id,shift_instance_id,old_values,new_values,created_at",
    )
    .eq("tag_id", id)
    .order("created_at", { ascending: true });
  if (updatesError)
    return apiRequest<RoomAttentionTag>(`/room-attention-tags/${id}`);

  const updates = (rawUpdates ?? []) as DirectRoomAttentionTagUpdate[];
  const profileIds = Array.from(
    new Set(
      [tag.created_by, tag.closed_by, ...updates.map((item) => item.actor_id)].filter(
        Boolean,
      ) as string[],
    ),
  );
  const shiftIds = Array.from(
    new Set([
      tag.created_shift_instance_id,
      ...updates.map((item) => item.shift_instance_id),
    ]),
  );
  const [profilesResult, shiftsResult] = await Promise.all([
    profileIds.length
      ? client
          .from("profiles")
          .select("id,full_name,employee_code")
          .in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    shiftIds.length
      ? client.from("shift_instances").select("id,shift_code").in("id", shiftIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profilesResult.error || shiftsResult.error)
    return apiRequest<RoomAttentionTag>(`/room-attention-tags/${id}`);

  const profiles = new Map(
    ((profilesResult.data ?? []) as DirectProfile[]).map((profile) => [
      profile.id,
      profile,
    ]),
  );
  const shifts = new Map(
    ((shiftsResult.data ?? []) as DirectShift[]).map((shift) => [shift.id, shift]),
  );
  const createdBy = profiles.get(tag.created_by);
  const createdShift = shifts.get(tag.created_shift_instance_id);
  const closedBy = tag.closed_by ? profiles.get(tag.closed_by) : undefined;
  const now = Date.now();
  const checkout = new Date(
    `${tag.expected_check_out_date}T23:59:59+07:00`,
  ).getTime();

  return {
    id: tag.id,
    branchId: tag.branch_id,
    stayReference: tag.stay_reference,
    roomNumber: tag.room_number,
    guestName: tag.guest_name,
    checkInDate: tag.check_in_date,
    expectedCheckOutDate: tag.expected_check_out_date,
    tagType: tag.tag_type,
    priority: tag.priority,
    title: tag.title,
    details: tag.details,
    status: tag.status,
    createdAt: tag.created_at,
    updatedAt: tag.updated_at,
    createdBy: {
      id: createdBy?.id ?? tag.created_by,
      fullName: createdBy?.full_name ?? "Nhân viên",
      employeeCode: createdBy?.employee_code ?? null,
    },
    createdShiftInstance: {
      id: createdShift?.id ?? tag.created_shift_instance_id,
      shiftCode: createdShift?.shift_code ?? "Ca làm việc",
    },
    updates: updates.map((update) => {
      const actor = profiles.get(update.actor_id);
      const shift = shifts.get(update.shift_instance_id);
      return {
        id: update.id,
        content: update.content,
        action: update.action,
        createdAt: update.created_at,
        actor: {
          id: actor?.id ?? update.actor_id,
          fullName: actor?.full_name ?? "Nhân viên",
          employeeCode: actor?.employee_code ?? null,
        },
        shiftInstance: {
          id: shift?.id ?? update.shift_instance_id,
          shiftCode: shift?.shift_code ?? "Ca làm việc",
        },
        oldValues: update.old_values,
        newValues: update.new_values,
      };
    }),
    closedBy: closedBy
      ? { id: closedBy.id, fullName: closedBy.full_name }
      : null,
    closedAt: tag.closed_at,
    closeReason: tag.close_reason,
    finalResult: tag.final_result,
    alerts: {
      urgent: tag.priority === "URGENT",
      nearCheckout:
        checkout - now <= 36 * 60 * 60 * 1000 &&
        checkout >= now - 24 * 60 * 60 * 1000,
      stale: now - new Date(tag.updated_at).getTime() >= 4 * 60 * 60 * 1000,
    },
  };
}
export const roomAttentionTagsApi = {
  list: (filters: RoomTagFilters = { active: true }) =>
    listRoomAttentionTags(filters),
  get: (id: string) => getRoomAttentionTag(id),
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
