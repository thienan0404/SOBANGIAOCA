'use client';

import {useState} from 'react';
import {createClient} from '@/lib/supabase/client';

export function LogoutButton(){
  const[pending,setPending]=useState<'employee'|'branch'|null>(null);

  function clearEmployeeSession(){
    localStorage.removeItem('a25.workSessionId');
    localStorage.removeItem('a25.employeeName');
    localStorage.removeItem('a25.employeeCode');
  }

  async function handleEmployeeLogout(){
    if(pending)return;
    setPending('employee');
    try{
      await createClient().rpc('a25_end_work_session');
    }finally{
      clearEmployeeSession();
      window.location.replace('/login');
    }
  }

  async function handleBranchLogout(){
    if(pending)return;
    setPending('branch');
    const supabase=createClient();
    try{
      await supabase.rpc('a25_end_work_session');
      await supabase.auth.signOut({scope:'local'});
    }finally{
      clearEmployeeSession();
      localStorage.removeItem('a25.branchId');
      localStorage.removeItem('a25.branchName');
      localStorage.removeItem('a25.branchCode');
      localStorage.removeItem('a25.currentBranchDevice');
      window.location.replace('/login');
    }
  }

  return <div className="account-logout-actions" aria-label="Tùy chọn đăng xuất">
    <button type="button" className="account-logout-button employee-logout" disabled={Boolean(pending)} onClick={()=>void handleEmployeeLogout()}>
      <span className="account-action-icon" aria-hidden="true">NV</span>
      <span className="account-action-copy"><strong>{pending==='employee'?'Đang đăng xuất…':'Đăng xuất nhân viên'}</strong><small>Đổi người làm ca, vẫn giữ đăng nhập chi nhánh</small></span>
      <b aria-hidden="true">›</b>
    </button>
    <button type="button" className="account-logout-button branch-logout" disabled={Boolean(pending)} onClick={()=>void handleBranchLogout()}>
      <span className="account-action-icon" aria-hidden="true">CN</span>
      <span className="account-action-copy"><strong>{pending==='branch'?'Đang đăng xuất…':'Đăng xuất chi nhánh'}</strong><small>Thoát toàn bộ tài khoản trên thiết bị này</small></span>
      <b aria-hidden="true">›</b>
    </button>
  </div>;
}
