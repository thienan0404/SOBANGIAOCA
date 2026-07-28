'use client';

import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {AppShell} from '@/components/layout/app-shell';
import {createClient} from '@/lib/supabase/client';

export default function ProtectedLayout({children}:{children:React.ReactNode}){
  const pathname=usePathname();
  const[ready,setReady]=useState(false);

  useEffect(()=>{
    let active=true;
    void (async()=>{
      const supabase=createClient();
      const{data}=await supabase.auth.getSession();
      if(!active)return;
      if(!data.session){window.location.replace(`/login?next=${encodeURIComponent(pathname)}`);return}
      const workSessionId=localStorage.getItem('a25.workSessionId');
      if(workSessionId){
        const{data:context}=await supabase.rpc('a25_work_session_role',{p_work_session_id:workSessionId});
        const session=context as {role?:{code:string;name:string}}|null;
        if(session?.role){localStorage.setItem('a25.employeeRole',session.role.code);localStorage.setItem('a25.employeeRoleName',session.role.name)}
      }
      if(active)setReady(true);
    })();
    return()=>{active=false};
  },[pathname]);
  if(!ready)return <main className="loading-screen"><div><div className="loader"/><p>Đang kiểm tra phiên làm việc...</p></div></main>;
  return <AppShell>{children}</AppShell>;
}