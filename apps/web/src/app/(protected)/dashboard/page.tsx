'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {HandoverList,handoverApi} from '@/features/handovers';
import {roleGroup,storedEmployeeRole,type RoleGroup} from '@/lib/employee-role';

export default function Dashboard(){
  const[employee,setEmployee]=useState('Nhân viên lễ tân');
  const[branch,setBranch]=useState('Chi nhánh đang làm việc');
  const[group,setGroup]=useState<RoleGroup>('reception');
  const[roleName,setRoleName]=useState('Lễ tân');
  const today=new Intl.DateTimeFormat('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date());
  useEffect(()=>{queueMicrotask(()=>{
    setEmployee(localStorage.getItem('a25.employeeName')||'Nhân viên lễ tân');
    setBranch(localStorage.getItem('a25.branchName')||'Chi nhánh đang làm việc');
    const role=storedEmployeeRole();setGroup(roleGroup(role?.code));setRoleName(role?.name||'Lễ tân');
    const branchId=localStorage.getItem('a25.branchId');if(branchId)void handoverApi.formContext(branchId).catch(()=>undefined);
  })},[]);
  const heading=group==='management'?'PHÊ DUYỆT VẬN HÀNH':group==='accounting'?'KIỂM SOÁT TÀI CHÍNH':'CA LÀM VIỆC HÔM NAY';
  const listTitle=group==='management'?'Chờ BGĐ xử lý':group==='accounting'?'Chờ kế toán nghiệm thu':'Bàn giao gần đây';
  return <div className="dashboard-clean">
    <section className="dashboard-overview">
      <div className="dashboard-intro"><div><span className="ops-eyebrow">{heading}</span><h1>Xin chào, {employee}</h1><p>{today}</p></div><span className="dashboard-role">{roleName}</span></div>
      <div className="dashboard-shift"><div className="dashboard-shift-icon">◷</div><div><small>CHI NHÁNH ĐANG LÀM VIỆC</small><strong>{branch}</strong></div><span><i/> Đang hoạt động</span></div>
    </section>

    <section className="dashboard-primary-actions" aria-label="Thao tác chính">
      {group==='reception'&&<><Link href="/handovers/create"><span>＋</span><div><strong>Tạo bàn giao</strong><small>Ghi nhận nội dung ca</small></div></Link><Link href="/handovers/pending-receive"><span>✓</span><div><strong>Nhận bàn giao</strong><small>Phiếu đang chờ bạn</small></div></Link></>}
      {group==='management'&&<><Link href="/handovers"><span>✓</span><div><strong>Duyệt bàn giao</strong><small>Phiếu chờ BGĐ cơ sở</small></div></Link><Link href="/reports"><span>▥</span><div><strong>Xem báo cáo</strong><small>Tình hình toàn chi nhánh</small></div></Link></>}
      {group==='accounting'&&<><Link href="/handovers"><span>✓</span><div><strong>Nghiệm thu phiếu</strong><small>Kiểm tra tài chính</small></div></Link><Link href="/finance"><span>₫</span><div><strong>Tài chính – quỹ</strong><small>Đối soát thu và chi</small></div></Link></>}
    </section>

    <section className="dashboard-recent">
      <div className="ops-section-heading"><div><span>{group==='reception'?'NHẬT KÝ CA TRỰC':'CẦN XỬ LÝ'}</span><h2>{listTitle}</h2></div><Link href="/handovers">Xem tất cả</Link></div>
      <HandoverList view={group} limit={3} compact/>
    </section>
  </div>;
}