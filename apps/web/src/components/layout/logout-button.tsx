'use client';

import {useState} from 'react';
import {createClient} from '@/lib/supabase/client';

export function LogoutButton(){
  const [pending,setPending]=useState(false);

  async function handleLogout(){
    if(pending) return;
    setPending(true);

    try {
      const supabase=createClient();
      const{data}=await supabase.auth.getSession();
      if(data.session)void fetch(process.env.NEXT_PUBLIC_API_URL!+'/auth/work-sessions/end',{
        method:'POST',headers:{authorization:`Bearer ${data.session.access_token}`},keepalive:true
      }).catch(()=>undefined);
      const{error}=await supabase.auth.signOut();
      if(error) throw error;
      localStorage.removeItem('a25.workSessionId');
      localStorage.removeItem('a25.branchId');
      localStorage.removeItem('a25.employeeName');
      localStorage.removeItem('a25.employeeCode');
      window.location.replace('/login');
    } catch {
      setPending(false);
      alert('Chưa thể đăng xuất. Vui lòng thử lại.');
    }
  }

  return <button
    type="button"
    className="logout-button"
    aria-label="Đăng xuất khỏi hệ thống"
    title="Đăng xuất"
    disabled={pending}
    onClick={handleLogout}
  >
    <span>{pending?'Đang thoát…':'Đăng xuất'}</span>
    <b aria-hidden="true">↗</b>
  </button>;
}