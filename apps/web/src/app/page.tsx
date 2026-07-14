'use client';

import {useEffect} from 'react';
import {createClient} from '@/lib/supabase/client';

export default function Home(){
  useEffect(()=>{
    void createClient().auth.getSession().then(({data})=>{
      window.location.replace(data.session?'/dashboard':'/login');
    });
  },[]);
  return <main className="loading-screen"><div><div className="loader"/><p>Đang mở hệ thống...</p></div></main>;
}