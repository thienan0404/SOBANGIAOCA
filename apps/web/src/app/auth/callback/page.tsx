'use client';

import {useEffect,useState} from 'react';
import {createClient} from '@/lib/supabase/client';

export default function AuthCallback(){
  const [message,setMessage]=useState('Đang xác thực tài khoản...');

  useEffect(()=>{
    const code=new URLSearchParams(window.location.search).get('code');
    if(!code){window.location.replace('/login');return}
    void createClient().auth.exchangeCodeForSession(code).then(({error})=>{
      if(error){setMessage('Liên kết xác thực không hợp lệ hoặc đã hết hạn.');setTimeout(()=>window.location.replace('/login'),1800);return}
      window.location.replace('/dashboard');
    });
  },[]);

  return <main className="loading-screen"><div><div className="loader"/><p>{message}</p></div></main>;
}