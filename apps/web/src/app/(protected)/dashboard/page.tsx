'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {HandoverList} from '@/features/handovers';

export default function Dashboard(){
  const[employee,setEmployee]=useState('Nhân viên lễ tân');
  const[branch,setBranch]=useState('Chi nhánh đang làm việc');
  const today=new Intl.DateTimeFormat('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date());
  useEffect(()=>{queueMicrotask(()=>{setEmployee(localStorage.getItem('a25.employeeName')||'Nhân viên lễ tân');try{setBranch(JSON.parse(localStorage.getItem('a25.currentBranchDevice')??'null')?.branch?.name||'Chi nhánh đang làm việc')}catch{}})},[]);
  return <>
    <section className="ops-welcome"><span className="ops-eyebrow">CA LÀM VIỆC HIỆN TẠI</span><h1>Xin chào, {employee}</h1><p>{today}</p><div className="ops-shift-card"><div className="ops-shift-icon">◷</div><div><small>Chi nhánh làm việc</small><strong>{branch}</strong><span><i/> Phiên ca đang hoạt động</span></div></div></section>
    <section className="ops-actions"><Link href="/handovers/create"><span>＋</span><strong>Tạo bàn giao</strong><small>Ghi nhận nội dung ca</small></Link><Link href="/handovers/pending-receive"><span>✓</span><strong>Nhận bàn giao</strong><small>Phiếu đang chờ bạn</small></Link></section>
    <div className="ops-section-heading"><div><span>NHẬT KÝ CA TRỰC</span><h2>Bàn giao gần đây</h2></div><Link href="/handovers">Xem tất cả</Link></div><HandoverList/>
  </>;
}