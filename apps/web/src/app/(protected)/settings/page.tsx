'use client';

import {useEffect,useState} from 'react';
import {LogoutButton} from '@/components/layout/logout-button';

type SessionSummary={employeeName:string;employeeCode:string;branchName:string;branchCode:string};

export default function SettingsPage(){
  const[session,setSession]=useState<SessionSummary>({employeeName:'Nhân viên đang làm ca',employeeCode:'',branchName:'Chi nhánh đang hoạt động',branchCode:''});

  useEffect(()=>{
    const timer=window.setTimeout(()=>setSession({
      employeeName:localStorage.getItem('a25.employeeName')||'Nhân viên đang làm ca',
      employeeCode:localStorage.getItem('a25.employeeCode')||'',
      branchName:localStorage.getItem('a25.branchName')||'Chi nhánh đang hoạt động',
      branchCode:localStorage.getItem('a25.branchCode')||''
    }),0);
    return()=>window.clearTimeout(timer);
  },[]);

  return <div className="settings-page">
    <header className="settings-heading"><span>CÁ NHÂN & PHIÊN LÀM VIỆC</span><h1>Cài đặt</h1><p>Quản lý người đang trực và tài khoản chi nhánh trên thiết bị này.</p></header>
    <section className="session-account-card" aria-label="Phiên làm việc hiện tại">
      <div className="session-person"><i aria-hidden="true">NV</i><div><small>NHÂN VIÊN ĐANG TRỰC</small><strong>{session.employeeName}</strong>{session.employeeCode&&<span>{session.employeeCode}</span>}</div></div>
      <div className="session-divider"/>
      <div className="session-person"><i aria-hidden="true">CN</i><div><small>TÀI KHOẢN CHI NHÁNH</small><strong>{session.branchName}</strong>{session.branchCode&&<span>{session.branchCode}</span>}</div></div>
    </section>
    <section className="settings-actions-section"><h2>Đăng xuất</h2><p>Chọn đúng cấp tài khoản bạn muốn kết thúc.</p><LogoutButton/></section>
  </div>;
}
