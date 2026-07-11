export type ItemStatus = "open" | "in_progress" | "pending_confirmation" | "completed";
export type Priority = "urgent" | "high" | "normal" | "low";

export type Profile = {
  id: string;
  full_name: string;
  role: "admin" | "manager" | "receptionist";
  hotel_id: string;
};

export type Hotel = { id: string; name: string };

export type Shift = {
  id: string;
  hotel_id: string;
  shift_type: "morning" | "afternoon" | "night";
  handover_to: "morning" | "afternoon" | "night";
  business_date: string;
  starts_at: string;
  status: "open" | "handed_over" | "acknowledged";
  opened_by: string;
  received_by: string | null;
};

export type HandoverItem = {
  id: string;
  shift_id: string;
  hotel_id: string;
  title: string;
  details: string;
  room_number: string | null;
  category: string;
  priority: Priority;
  status: ItemStatus;
  due_at: string | null;
  created_at: string;
  created_by: string;
};
