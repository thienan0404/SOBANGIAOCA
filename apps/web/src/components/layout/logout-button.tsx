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

  return <div className="logout-actions" aria-label="Tùy chọn đăng xuất">
    <button type="button" className="logout-button employee-logout" aria-label="Đăng xuất nhân viên, giữ nguyên tài khoản chi nhánh" title="Đăng xuất nhân viên, giữ nguyên chi nhánh" disabled={Boolean(pending)} onClick={()=>void handleEmployeeLogout()}>
      <span>{pending==='employee'?'Đang thoát…':'Thoát NV'}</span><b aria-hidden="true">NV</b>
    </button>
    <button type="button" className="logout-button branch-logout" aria-label="Đăng xuất tài khoản chi nhánh và nhân viên" title="Đăng xuất cả tài khoản chi nhánh" disabled={Boolean(pending)} onClick={()=>void handleBranchLogout()}>
      <span>{pending==='branch'?'Đang thoát…':'Thoát CN'}</span><b aria-hidden="true">CN</b>
    </button>
  </div>;
}
