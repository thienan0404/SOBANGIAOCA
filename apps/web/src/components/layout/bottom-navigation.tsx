'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';

const nav=[
  {icon:'⌂',label:'Tổng quan',href:'/dashboard'},
  {icon:'▤',label:'Chi tiết',href:'/handovers'},
  {icon:'☑',label:'Công việc',href:'/handovers/pending-receive'},
  {icon:'✎',label:'Ký nhận',href:'/handovers/participants'},
  {icon:'⚙',label:'Cài đặt',href:'/settings'}
] as const;

export function BottomNavigation(){
  const path=usePathname();
  return <nav className="bottom-nav" aria-label="Điều hướng chính">{nav.map(({icon,label,href})=>{
    const active=href==='/dashboard'?path===href:path===href||(href==='/handovers'&&path.startsWith('/handovers/detail'));
    return <Link key={href} href={href} className={active?'active':''} aria-current={active?'page':undefined}><span className="nav-icon" aria-hidden="true">{icon}</span><small>{label}</small></Link>;
  })}</nav>;
}