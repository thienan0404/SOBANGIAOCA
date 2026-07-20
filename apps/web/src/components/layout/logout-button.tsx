'use client';

import {useState} from 'react';
import {createClient} from '@/lib/supabase/client';

export function LogoutButton(){
  const[pending,setPending]=useState(false);

  async function handleLogout(){
    if(pending)return;
    setPending(true);
    try{
      await createClient().auth.signOut();
    }finally{
      localStorage.removeItem('a25.workSessionId');
      localStorage.removeItem('a25.branchId');
      localStorage.removeItem('a25.employeeName');
      localStorage.removeItem('a25.employeeCode');
      window.location.replace('/login');
    }
      localStorage.removeItem('a25.branchName');
      localStorage.removeItem('a25.branchCode');
      localStorage.removeItem('a25.currentBranchDevice');
  }

  return <button type="button" className="logout-button" aria-label="Đăng xuất khỏi ca làm việc" title="Đăng xuất" disabled={pending} onClick={()=>void handleLogout()}>
    <span>{pending?'Đang thoát…':'Đăng xuất'}</span><b aria-hidden="true">↗</b>
  </button>;
}