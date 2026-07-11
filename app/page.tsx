"use client";

import type { User } from "@supabase/supabase-js";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import type { HandoverItem, Hotel, ItemStatus, Priority, Profile, Shift } from "@/lib/types";

const statusLabel: Record<ItemStatus, string> = {
  open: "Chờ xử lý",
  in_progress: "Đang xử lý",
  pending_confirmation: "Chờ xác nhận",
  completed: "Hoàn tất",
};
const priorityLabel: Record<Priority, string> = { urgent: "Khẩn cấp", high: "Ưu tiên cao", normal: "Bình thường", low: "Có thể chờ" };
const shiftLabel = { morning: "CA SÁNG", afternoon: "CA CHIỀU", night: "CA ĐÊM" };
const filters = ["Tất cả", "Khẩn cấp", "Đang xử lý", "Chờ xác nhận", "Hoàn tất"];

function getShiftType(): Shift["shift_type"] {
  const hour = new Date().getHours();
  return hour < 6 || hour >= 22 ? "night" : hour < 14 ? "morning" : "afternoon";
}

function getNextShift(type: Shift["shift_type"]): Shift["handover_to"] {
  return type === "night" ? "morning" : type === "morning" ? "afternoon" : "night";
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [shift, setShift] = useState<Shift | null>(null);
  const [items, setItems] = useState<HandoverItem[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [activeFilter, setActiveFilter] = useState("Tất cả");
  const [activeNav, setActiveNav] = useState("Bàn giao");
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState("");

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }, []);

  const loadWorkspace = useCallback(async (activeUser: User) => {
    if (!supabase) return;
    setLoading(true);
    const { data: profileData, error: profileError } = await supabase.from("profiles").select("id, full_name, role, hotel_id").eq("id", activeUser.id).single();
    if (profileError) { notify("Không thể tải hồ sơ nhân viên"); setLoading(false); return; }
    const typedProfile = profileData as Profile;
    setProfile(typedProfile);

    const { data: hotelData } = await supabase.from("hotels").select("id, name").eq("id", typedProfile.hotel_id).single();
    setHotel(hotelData as Hotel);

    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
    let { data: shiftData } = await supabase.from("shifts").select("*").eq("hotel_id", typedProfile.hotel_id).in("status", ["open", "handed_over"]).order("starts_at", { ascending: false }).limit(1).maybeSingle();
    if (!shiftData) {
      const shiftType = getShiftType();
      const created = await supabase.from("shifts").insert({ hotel_id: typedProfile.hotel_id, shift_type: shiftType, handover_to: getNextShift(shiftType), business_date: today, opened_by: activeUser.id }).select("*").single();
      shiftData = created.data;
    }
    const typedShift = shiftData as Shift | null;
    setShift(typedShift);
    if (typedShift) {
      const { data: itemData, error } = await supabase.from("handover_items").select("*").eq("shift_id", typedShift.id).order("created_at", { ascending: false });
      if (error) notify("Không thể tải sổ bàn giao");
      setItems((itemData || []) as HandoverItem[]);
    }
    setLoading(false);
  }, [notify]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      const currentUser = data.session?.user ?? null;
      setUser(currentUser);
      if (currentUser) loadWorkspace(currentUser); else setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadWorkspace(session.user); else { setProfile(null); setHotel(null); setShift(null); setItems([]); }
    });
    return () => listener.subscription.unsubscribe();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!supabase || !shift) return;
    const client = supabase;
    const channel = client.channel(`handover-${shift.id}`).on("postgres_changes", { event: "*", schema: "public", table: "handover_items", filter: `shift_id=eq.${shift.id}` }, () => user && loadWorkspace(user)).subscribe();
    return () => { client.removeChannel(channel); };
  }, [shift, user, loadWorkspace]);

  const visibleItems = useMemo(() => items.filter((item) => {
    if (activeFilter === "Tất cả") return true;
    if (activeFilter === "Khẩn cấp") return item.priority === "urgent";
    return statusLabel[item.status] === activeFilter;
  }), [activeFilter, items]);
  const openCount = items.filter((item) => item.status !== "completed").length;

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    setLoading(true);
    if (authMode === "register") {
      const { error, data } = await supabase.auth.signUp({ email, password, options: { data: { full_name: String(form.get("fullName") || "Nhân viên lễ tân") } } });
      setLoading(false);
      if (error) return notify(error.message);
      if (!data.session) notify("Kiểm tra email để xác nhận tài khoản");
      else notify("Tạo tài khoản thành công");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) notify("Email hoặc mật khẩu chưa đúng");
    }
  }

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !shift || !profile || !user) return;
    const form = new FormData(event.currentTarget);
    const { error } = await supabase.from("handover_items").insert({
      shift_id: shift.id, hotel_id: profile.hotel_id, created_by: user.id,
      title: String(form.get("title")), details: String(form.get("details")), room_number: String(form.get("room") || "") || null,
      priority: String(form.get("priority")) as Priority, status: "open", category: String(form.get("category")),
      due_at: form.get("dueAt") ? new Date(String(form.get("dueAt"))).toISOString() : null,
    });
    if (error) return notify("Chưa thể lưu nội dung bàn giao");
    setShowForm(false); notify("Đã thêm vào sổ bàn giao"); await loadWorkspace(user);
  }

  async function updateItem(item: HandoverItem) {
    if (!supabase || !user) return;
    const next: ItemStatus = item.status === "open" ? "in_progress" : item.status === "in_progress" ? "pending_confirmation" : "completed";
    const values: Record<string, unknown> = { status: next };
    if (next === "completed") Object.assign(values, { completed_by: user.id, completed_at: new Date().toISOString() });
    const { error } = await supabase.from("handover_items").update(values).eq("id", item.id);
    if (error) return notify("Không thể cập nhật trạng thái");
    notify(`Đã chuyển sang: ${statusLabel[next]}`); await loadWorkspace(user);
  }

  async function acknowledgeShift() {
    if (!supabase || !shift || !user) return;
    const { error } = await supabase.from("shift_acknowledgements").upsert({ shift_id: shift.id, user_id: user.id }, { onConflict: "shift_id,user_id" });
    if (!error) await supabase.from("shifts").update({ status: "acknowledged", received_by: user.id, acknowledged_at: new Date().toISOString() }).eq("id", shift.id);
    if (error) return notify("Chưa thể xác nhận nhận ca");
    notify("Đã xác nhận nhận bàn giao"); await loadWorkspace(user);
  }

  if (!isSupabaseConfigured) return <main className="setup-screen"><div className="setup-card"><span className="brand-mark">A25</span><h1>Kết nối Supabase</h1><p>Ứng dụng đã sẵn sàng. Hãy thêm hai biến môi trường Supabase vào Render để kích hoạt đăng nhập và dữ liệu thật.</p><code>NEXT_PUBLIC_SUPABASE_URL</code><code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code></div></main>;
  if (!user) return <main className="auth-screen"><section className="auth-hero"><span className="brand-mark">A25</span><div><small>HỆ THỐNG NỘI BỘ</small><h1>Sổ bàn giao ca<br/>lễ tân</h1><p>Mọi công việc được tiếp nối, không điều gì bị bỏ quên.</p></div></section><form className="auth-card" onSubmit={handleAuth}><div className="auth-tabs"><button type="button" className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>Đăng nhập</button><button type="button" className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>Tạo tài khoản</button></div>{authMode === "register" && <label>Họ và tên<input name="fullName" required placeholder="Nguyễn Thu Hà"/></label>}<label>Email nhân viên<input name="email" type="email" required placeholder="nhanvien@a25hotel.com"/></label><label>Mật khẩu<input name="password" type="password" minLength={6} required placeholder="Tối thiểu 6 ký tự"/></label><button className="login-button" disabled={loading}>{loading ? "Đang xử lý..." : authMode === "login" ? "Đăng nhập hệ thống" : "Tạo tài khoản"}</button><p className="security-note">Dữ liệu được bảo vệ theo khách sạn và vai trò nhân viên.</p></form>{toast && <div className="toast"><span>✓</span>{toast}</div>}</main>;
  if (loading || !profile || !shift) return <main className="loading-screen"><div className="loader"/><p>Đang mở sổ bàn giao...</p></main>;

  return <main className="app-shell">
    <header className="topbar"><div className="topline"><button className="avatar" aria-label="Hồ sơ">{profile.full_name.split(" ").map((x) => x[0]).slice(-2).join("")}</button><div className="hotel"><span>{hotel?.name || "A25 Hotel"}</span><small>{new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date())}</small></div><button className="bell" aria-label="Thông báo">♢<b>{openCount}</b></button></div><div className="shift-title"><div><span className="live-dot"/> {shiftLabel[shift.shift_type]} → {shiftLabel[shift.handover_to]}</div><h1>Sổ bàn giao ca</h1><p>{new Date(shift.starts_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} · Người giao: {profile.full_name}</p></div><div className="summary"><div><strong>{openCount}</strong><span>Cần tiếp nhận</span></div><i/><div><strong>{items.filter(i => i.priority === "urgent" && i.status !== "completed").length}</strong><span>Khẩn cấp</span></div><i/><div><strong>{items.filter(i => i.status === "completed").length}</strong><span>Hoàn tất</span></div></div></header>
    <section className="content"><div className="section-heading"><div><h2>Nội dung bàn giao</h2><p>{openCount} việc cần ca sau tiếp nhận</p></div><button className="add-button" onClick={() => setShowForm(true)}><span>＋</span> Thêm mới</button></div><div className="filters">{filters.map(f => <button key={f} className={activeFilter === f ? "active" : ""} onClick={() => setActiveFilter(f)}>{f}{f === "Tất cả" && <em>{items.length}</em>}</button>)}</div><div className="card-list">{visibleItems.map(item => { const tone = item.priority === "urgent" ? "red" : item.status === "completed" ? "green" : item.status === "in_progress" ? "blue" : "amber"; return <article className={`handover-card ${tone}`} key={item.id}><div className="card-icon">{item.priority === "urgent" ? "!" : item.status === "completed" ? "✓" : item.room_number || "↗"}</div><div className="card-body"><div className="card-title"><h3>{item.title}</h3><span>{item.priority === "urgent" ? priorityLabel[item.priority] : statusLabel[item.status]}</span></div><p className="detail">{item.details}</p><div className="meta"><span>◷ {item.due_at ? new Date(item.due_at).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "Không giới hạn"}</span><span>● {item.category}</span></div>{item.status !== "completed" && <button className="action-link" onClick={() => updateItem(item)}>{item.status === "open" ? "Bắt đầu xử lý" : item.status === "in_progress" ? "Chuyển chờ xác nhận" : "Xác nhận hoàn tất"} <b>→</b></button>}</div></article>})}{!visibleItems.length && <div className="empty">Không có nội dung ở trạng thái này.</div>}</div><button className="confirm-button" onClick={acknowledgeShift}><span>✓</span><div><strong>Xác nhận nhận bàn giao</strong><small>{profile.full_name} · {shiftLabel[shift.handover_to]}</small></div></button><p className="sync-note">● Đồng bộ thời gian thực đang hoạt động</p></section>
    <nav className="bottom-nav">{[["⌂","Bàn giao"],["☑","Việc tồn đọng"],["▤","Báo cáo"],["♢","Thông báo"],["⚙","Đăng xuất"]].map(([icon,label]) => <button key={label} className={activeNav === label ? "active" : ""} onClick={() => { setActiveNav(label); if (label === "Việc tồn đọng") setActiveFilter("Đang xử lý"); else if (label === "Thông báo") setActiveFilter("Khẩn cấp"); else if (label === "Đăng xuất") supabase?.auth.signOut(); else if (label !== "Bàn giao") notify("Báo cáo đang được tổng hợp"); }}><span>{icon}</span><small>{label}</small>{label === "Thông báo" && openCount > 0 && <b>{openCount}</b>}</button>)}</nav>
    {showForm && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setShowForm(false)}><form className="sheet" onSubmit={addItem}><div className="sheet-handle"/><div className="sheet-title"><div><small>BÀN GIAO CA</small><h2>Thêm nội dung mới</h2></div><button type="button" onClick={() => setShowForm(false)}>×</button></div><div className="form-row"><label>Số phòng<input name="room" placeholder="P.512"/></label><label>Nhóm việc<select name="category"><option value="guest_request">Yêu cầu khách</option><option value="maintenance">Kỹ thuật</option><option value="cash">Tài chính</option><option value="general">Khác</option></select></label></div><label>Tiêu đề<input name="title" required placeholder="Khách cần xe sân bay" autoFocus/></label><label>Chi tiết<textarea name="details" required placeholder="Thông tin ca sau cần tiếp tục xử lý..." rows={3}/></label><div className="form-row"><label>Mức độ<select name="priority"><option value="normal">Bình thường</option><option value="high">Ưu tiên cao</option><option value="urgent">Khẩn cấp</option><option value="low">Có thể chờ</option></select></label><label>Hạn xử lý<input name="dueAt" type="datetime-local"/></label></div><button className="save-button" type="submit">Lưu vào sổ bàn giao</button></form></div>}
    {toast && <div className="toast"><span>✓</span>{toast}</div>}
  </main>;
}
