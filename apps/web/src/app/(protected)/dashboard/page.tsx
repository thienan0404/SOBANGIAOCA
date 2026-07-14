'use client';

import Link from 'next/link';
import {HandoverList} from '@/features/handovers';

export default function Dashboard() {
  const today = new Intl.DateTimeFormat('vi-VN', {weekday:'long',day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date());
  return <>
    <section className="dashboard-heading">
      <div>
        <span className="dashboard-kicker">BẢNG ĐIỀU HÀNH</span>
        <h1>Tổng quan ca trực</h1>
        <p className="dashboard-date">{today}</p>
      </div>
      <Link className="primary-action" href="/handovers/create"><span>＋</span> Tạo bàn giao</Link>
    </section>
    <section className="shift-overview" aria-label="Thông tin ca trực">
      <div className="shift-main"><span>CA HIỆN TẠI</span><strong>Ca lễ tân đang hoạt động</strong><small>Sẵn sàng ghi nhận và tiếp nhận công việc</small></div>
      <div className="shift-indicator"><i/><span>Đang trực</span></div>
    </section>
    <div className="list-heading"><div><h2>Bàn giao gần đây</h2><p>Các nội dung cần theo dõi trong ca</p></div><Link href="/handovers">Xem tất cả</Link></div>
    <HandoverList/>
  </>;
}