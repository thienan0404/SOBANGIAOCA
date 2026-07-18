'use client';

import {useState} from 'react';

const apiUrl=(process.env.NEXT_PUBLIC_API_URL??'').replace(/\/$/,'');

export function LogoutButton(){
  const[pending,setPending]=useState(false);

  async function handleLogout(){
    if(pending)return;
    setPending(true);
    const workSessionId=localStorage.getItem('a25.workSessionId')??'';
    try{
      await fetch(`${apiUrl}/auth/work-sessions/end`,{
        method:'POST',
        credentials:'include',
        headers:{'x-work-session-id':workSessionId}
      });
    }finally{
      localStorage.removeItem('a25.workSessionId');
      localStorage.removeItem('a25.branchId');
      localStorage.removeItem('a25.employeeName');
      localStorage.removeItem('a25.employeeCode');
      window.location.replace('/login');
    }
  }

  return <button type="button" className="logout-button" aria-label="Đăng xuất khỏi ca làm việc" title="Đăng xuất" disabled={pending} onClick={()=>void handleLogout()}>
    <span>{pending?'Đang thoát…':'Đăng xuất'}</span><b aria-hidden="true">↗</b>
  </button>;
}