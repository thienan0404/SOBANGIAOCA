'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {roleGroup,storedEmployeeRole,type RoleGroup} from '@/lib/employee-role';

const navigation:Record<RoleGroup,Array<{icon:string;label:string;href:string}>>={
  reception:[
    {icon:'⌂',label:'Tổng quan',href:'/dashboard'},
    {icon:'▤',label:'Chi tiết',href:'/handovers'},
    {icon:'☑',label:'Công việc',href:'/handovers/pending-receive'},
    {icon:'✎',label:'Ký nhận',href:'/handovers/participants'},
    {icon:'!',label:'Lưu ý phòng',href:'/room-attention-tags'},
    {icon:'⚙',label:'Cài đặt',href:'/settings'}
  ],
  management:[
    {icon:'⌂',label:'Điều hành',href:'/dashboard'},
    {icon:'✓',label:'Chờ duyệt',href:'/handovers'},
    {icon:'▥',label:'Báo cáo',href:'/reports'},
    {icon:'✎',label:'Chữ ký',href:'/handovers/participants'},
    {icon:'!',label:'Lưu ý phòng',href:'/room-attention-tags'},
    {icon:'⚙',label:'Cài đặt',href:'/settings'}
  ],
  accounting:[
    {icon:'⌂',label:'Tổng quan',href:'/dashboard'},
    {icon:'✓',label:'Nghiệm thu',href:'/handovers'},
    {icon:'₫',label:'Tài chính',href:'/finance'},
    {icon:'✎',label:'Chữ ký',href:'/handovers/participants'},
    {icon:'⚙',label:'Cài đặt',href:'/settings'}
  ]
};

export function BottomNavigation(){
  const path=usePathname();
  const[group,setGroup]=useState<RoleGroup>('reception');
  useEffect(()=>{queueMicrotask(()=>setGroup(roleGroup(storedEmployeeRole()?.code)))},[]);
  return <nav className="bottom-nav" aria-label="Điều hướng chính">{navigation[group].map(({icon,label,href})=>{
    const active=href==='/dashboard'?path===href:path===href||(href==='/handovers'&&path.startsWith('/handovers/detail'));
    return <Link key={href} href={href} className={active?'active':''} aria-current={active?'page':undefined}><span className="nav-icon" aria-hidden="true">{icon}</span><small>{label}</small></Link>;
  })}</nav>;
}