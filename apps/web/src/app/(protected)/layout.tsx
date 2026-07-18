'use client';

import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {AppShell} from '@/components/layout/app-shell';

export default function ProtectedLayout({children}:{children:React.ReactNode}){
  const pathname=usePathname();
  const[ready,setReady]=useState(false);

  useEffect(()=>{
    let active=true;
    queueMicrotask(()=>{
      if(!active)return;
      if(localStorage.getItem('a25.workSessionId'))setReady(true);
      else window.location.replace(`/login?next=${encodeURIComponent(pathname)}`);
    });
    return()=>{active=false};
  },[pathname]);

  if(!ready)return <main className="loading-screen"><div><div className="loader"/><p>Đang kiểm tra phiên làm việc...</p></div></main>;
  return <AppShell>{children}</AppShell>;
}