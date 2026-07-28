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
  const heading=group==='management'?'TRUNG TÂM PHÊ DUYỆT':group==='accounting'?'KIỂM SOÁT TÀI CHÍNH':'CA LÀM VIỆC HIỆN TẠI';
  const listTitle=group==='management'?'Phiếu chờ BGĐ xử lý':group==='accounting'?'Phiếu chờ kế toán nghiệm thu':'Bàn giao gần đây';
  return <>
    <section className="ops-welcome"><span className="ops-eyebrow">{heading}</span><h1>Xin chào, {employee}</h1><p>{today} · {roleName}</p><div className="ops-shift-card"><div className="ops-shift-icon">◷</div><div><small>Chi nhánh làm việc</small><strong>{branch}</strong><span><i/> Phiên ca đang hoạt động</span></div></div></section>
    {group==='reception'&&<section className="ops-actions"><Link href="/handovers/create"><span>＋</span><strong>Tạo bàn giao</strong><small>Ghi nhận nội dung ca</small></Link><Link href="/handovers/pending-receive"><span>✓</span><strong>Nhận bàn giao</strong><small>Phiếu đang chờ bạn</small></Link></section>}
    {group==='management'&&<section className="ops-actions"><Link href="/handovers"><span>✓</span><strong>Duyệt bàn giao</strong><small>Phiếu chờ BGĐ cơ sở</small></Link><Link href="/reports"><span>▥</span><strong>Báo cáo vận hành</strong><small>Theo dõi toàn chi nhánh</small></Link></section>}
    {group==='accounting'&&<section className="ops-actions"><Link href="/handovers"><span>✓</span><strong>Nghiệm thu phiếu</strong><small>Kiểm tra tài chính bàn giao</small></Link><Link href="/finance"><span>₫</span><strong>Tài chính – quỹ</strong><small>Đối soát thu và chi</small></Link></section>}
    <div className="ops-section-heading"><div><span>{group==='reception'?'NHẬT KÝ CA TRỰC':'CÔNG VIỆC CẦN XỬ LÝ'}</span><h2>{listTitle}</h2></div><Link href="/handovers">Xem tất cả</Link></div><HandoverList view={group}/>
  </>;
}