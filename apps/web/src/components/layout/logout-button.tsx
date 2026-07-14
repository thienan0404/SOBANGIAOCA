'use client';

import {useState} from 'react';
import {createClient} from '@/lib/supabase/client';

export function LogoutButton(){
  const [pending,setPending]=useState(false);

  async function handleLogout(){
    if(pending) return;
    setPending(true);

    try {
      const {error}=await createClient().auth.signOut();
      if(error) throw error;
      window.location.replace('/login');
    } catch {
      setPending(false);
      alert('Chưa thể đăng xuất. Vui lòng thử lại.');
    }
  }

  return <button
    type="button"
    className="logout-button"
    aria-label="Đăng xuất khỏi hệ thống"
    title="Đăng xuất"
    disabled={pending}
    onClick={handleLogout}
  >
    <span>{pending?'Đang thoát…':'Đăng xuất'}</span>
    <b aria-hidden="true">↗</b>
  </button>;
}