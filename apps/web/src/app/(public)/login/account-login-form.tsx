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
    if(branchError)throw new Error('Kh?ng th? t?i th?ng tin chi nh?nh');
    const available=(branches??[]) as Branch[];
    if(!available.length)throw new Error('T?i kho?n ch?a ???c ph?n quy?n v?o chi nh?nh');
    const branch=available[0]!;
    localStorage.setItem('a25.branchId',branch.id);
    localStorage.setItem('a25.branchName',branch.name);
    localStorage.setItem('a25.branchCode',branch.code);
    localStorage.setItem('a25.currentBranchDevice',JSON.stringify({deviceId:'account-login',deviceCode:'ACCOUNT',deviceName:'Tai khoan chi nhanh',branch}));
    localStorage.setItem('a25.employeeName',profile?.full_name||'Nh?n vi?n A25 Hotel');
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
    if(!email.trim()||!password){setError('Vui l?ng nh?p t?i kho?n v? m?t kh?u');return}
    setLoading(true);setError('');
    try{
      const{data,error:loginError}=await createClient().auth.signInWithPassword({email:email.trim(),password});
      if(loginError||!data.session)throw new Error('T?i kho?n ho?c m?t kh?u ch?a ch?nh x?c');
      await openApplication();
    }catch(cause){setError(cause instanceof Error?cause.message:'Kh?ng th? ??ng nh?p')}
    finally{setLoading(false)}
  }

  if(checking)return <section className="auth-card employee-login"><div className="login-notice"><strong>?ang ki?m tra ??ng nh?p...</strong><span>Vui l?ng ch? trong gi?y l?t.</span></div></section>;

  return <section className="auth-card employee-login">
    <div className="login-progress" aria-label="??ng nh?p"><i className="active">1</i></div>
    <div className="auth-card-header"><span>??NG NH?P H? TH?NG</span><h2>Ch?o m?ng tr? l?i</h2><p>D?ng t?i kho?n A25 Hotel ?? ???c c?p ?? v?o S? b?n giao ca.</p></div>
    <div className="auth-fields">
      <label>Email<input type="email" value={email} onChange={event=>setEmail(event.target.value)} onKeyDown={event=>{if(event.key==='Enter')void login()}} placeholder="nhanvien@a25hotel.com" autoComplete="username" autoFocus/></label>
      <label>M?t kh?u<input type="password" value={password} onChange={event=>setPassword(event.target.value)} onKeyDown={event=>{if(event.key==='Enter')void login()}} placeholder="Nh?p m?t kh?u" autoComplete="current-password"/></label>
    </div>
    <button type="button" className="login-button" disabled={loading} onClick={()=>void login()}>{loading?'?ang ??ng nh?p...':'??ng nh?p'}</button>
    {error&&<p className="auth-error" role="alert"><b>!</b>{error}</p>}
  </section>;
}
