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
    } catch {
      await fetch('/auth/signout',{method:'POST'}).catch(()=>undefined);
    } finally {
      window.location.replace('/login');
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