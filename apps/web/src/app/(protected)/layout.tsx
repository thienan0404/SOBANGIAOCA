'use client';

import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {AppShell} from '@/components/layout/app-shell';
import {createClient} from '@/lib/supabase/client';

export default function ProtectedLayout({children}:{children:React.ReactNode}){
  const pathname=usePathname();
  const [ready,setReady]=useState(false);

  useEffect(()=>{
    const supabase=createClient();
    let active=true;

    void supabase.auth.getSession().then(({data})=>{
      if(!active) return;
      if(data.session) setReady(true);
      else window.location.replace(`/login?next=${encodeURIComponent(pathname)}`);
    });

    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      if(!active) return;
      if(session) setReady(true);
      else window.location.replace('/login');
    });

    return()=>{active=false;subscription.unsubscribe()};
  },[pathname]);

  if(!ready) return <main className="loading-screen"><div><div className="loader"/><p>Đang kiểm tra phiên đăng nhập...</p></div></main>;
  return <AppShell>{children}</AppShell>;
}