'use client';

import {useEffect,useState} from 'react';
import {createClient} from '@/lib/supabase/client';

type Branch={id:string;code:string;name:string;address:string|null};

export function AccountLoginForm(){
  const[email,setEmail]=useState('');
  const[password,setPassword]=useState('');
  const[loading,setLoading]=useState(false);
  const[checking,setChecking]=useState(true);
  const[error,setError]=useState('');

  async function openApplication(){
    const supabase=createClient();
    const[{data:profile},{data:branches,error:branchError}]=await Promise.all([
      supabase.from('profiles').select('full_name').maybeSingle(),
      supabase.from('branches').select('id,code,name,address').order('name').limit(2)
    ]);
    if(branchError)throw new Error('Không thể tải thông tin chi nhánh');
    const available=(branches??[]) as Branch[];
    if(!available.length)throw new Error('Tài khoản chưa được phân quyền vào chi nhánh');
    const branch=available[0]!;
    localStorage.setItem('a25.branchId',branch.id);
    localStorage.setItem('a25.branchName',branch.name);
    localStorage.setItem('a25.branchCode',branch.code);
    localStorage.setItem('a25.currentBranchDevice',JSON.stringify({deviceId:'account-login',deviceCode:'ACCOUNT',deviceName:'Tai khoan chi nhanh',branch}));
    localStorage.setItem('a25.employeeName',profile?.full_name||'Nhân viên A25 Hotel');
    localStorage.removeItem('a25.workSessionId');
    window.location.replace('/dashboard');
  }

  useEffect(()=>{
    let active=true;
    void createClient().auth.getSession().then(async({data})=>{
      if(data.session)await openApplication();
    }).catch(()=>undefined).finally(()=>{if(active)setChecking(false)});
    return()=>{active=false};
  },[]);

  async function login(){
    if(!email.trim()||!password){setError('Vui lòng nhập tài khoản và mật khẩu');return}
    setLoading(true);setError('');
    try{
      const{data,error:loginError}=await createClient().auth.signInWithPassword({email:email.trim(),password});
      if(loginError||!data.session)throw new Error('Tài khoản hoặc mật khẩu chưa chính xác');
      await openApplication();
    }catch(cause){setError(cause instanceof Error?cause.message:'Không thể đăng nhập')}
    finally{setLoading(false)}
  }

  if(checking)return <section className="auth-card employee-login"><div className="login-notice"><strong>Đang kiểm tra đăng nhập...</strong><span>Vui lòng chờ trong giây lát.</span></div></section>;

  return <section className="auth-card employee-login">
    <div className="login-progress" aria-label="Đăng nhập"><i className="active">1</i></div>
    <div className="auth-card-header"><span>ĐĂNG NHẬP HỆ THỐNG</span><h2>Chào mừng trở lại</h2><p>Dùng tài khoản A25 Hotel đã được cấp để vào Sổ bàn giao ca.</p></div>
    <div className="auth-fields">
      <label>Email<input type="email" value={email} onChange={event=>setEmail(event.target.value)} onKeyDown={event=>{if(event.key==='Enter')void login()}} placeholder="nhanvien@a25hotel.com" autoComplete="username" autoFocus/></label>
      <label>Mật khẩu<input type="password" value={password} onChange={event=>setPassword(event.target.value)} onKeyDown={event=>{if(event.key==='Enter')void login()}} placeholder="Nhập mật khẩu" autoComplete="current-password"/></label>
    </div>
    <button type="button" className="login-button" disabled={loading} onClick={()=>void login()}>{loading?'Đang đăng nhập...':'Đăng nhập'}</button>
    {error&&<p className="auth-error" role="alert"><b>!</b>{error}</p>}
  </section>;
}
