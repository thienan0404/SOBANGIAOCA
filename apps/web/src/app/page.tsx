'use client';

import {useEffect} from 'react';

export default function Home(){
  useEffect(()=>{
    window.location.replace(localStorage.getItem('a25.workSessionId')?'/dashboard':'/login');
  },[]);
  return <main className="loading-screen"><div><div className="loader"/><p>Đang mở hệ thống...</p></div></main>;
}