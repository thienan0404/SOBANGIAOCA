'use client';

import {useState} from 'react';
import {createClient} from '@/lib/supabase/client';

export function LogoutButton(){
  const[pending,setPending]=useState(false);

  async function handleLogout(){
    if(pending)return;
    setPending(true);
    const supabase=createClient();
    try{
      await supabase.rpc('a25_end_work_session');
      await supabase.auth.signOut();
    }finally{
      localStorage.removeItem('a25.workSessionId');
      localStorage.removeItem('a25.branchId');
      localStorage.removeItem('a25.employeeName');
      localStorage.removeItem('a25.employeeCode');
      localStorage.removeItem('a25.branchName');
      localStorage.removeItem('a25.branchCode');
      localStorage.removeItem('a25.currentBranchDevice');
      window.location.replace('/login');
    }
  }

  return <button type="button" className="logout-button" aria-label="Đăng xuất khỏi ca làm việc" title="Đăng xuất" disabled={pending} onClick={()=>void handleLogout()}>
    <span>{pending?'Đang thoát…':'Đăng xuất'}</span><b aria-hidden="true">↗</b>
  </button>;
}