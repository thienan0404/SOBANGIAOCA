'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {HandoverList} from '@/features/handovers';
import {roleGroup,storedEmployeeRole,type RoleGroup} from '@/lib/employee-role';

export default function Handovers(){
  const[group,setGroup]=useState<RoleGroup>('reception');
  useEffect(()=>{queueMicrotask(()=>setGroup(roleGroup(storedEmployeeRole()?.code)))},[]);
  const title=group==='management'?'Phê duyệt bàn giao':group==='accounting'?'Nghiệm thu tài chính':'Chi tiết bàn giao';
  const subtitle=group==='management'?'Kiểm tra phiếu đã hoàn tất giao ca vận hành':group==='accounting'?'Kiểm tra tài chính sau khi BGĐ cơ sở duyệt':'Danh sách phiếu theo ca làm việc';
  const listTitle=group==='management'?'Chờ BGĐ cơ sở':group==='accounting'?'Chờ kế toán nghiệm thu':'Tất cả phiếu';
  return <div className="handover-index-page">
    <header className="inner-page-title"><div><h1>{title}</h1><p>{subtitle}</p></div>{group==='reception'&&<Link className="header-create" href="/handovers/create">＋ Tạo mới</Link>}</header>
    <div className="ops-section-heading"><div><span>SỔ BÀN GIAO</span><h2>{listTitle}</h2></div></div>
    <HandoverList view={group}/>
  </div>;
}