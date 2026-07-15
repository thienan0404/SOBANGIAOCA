import {createClient} from '@/lib/supabase/client';

const base=process.env.NEXT_PUBLIC_API_URL!;

export async function apiRequest<T>(path:string,init?:RequestInit):Promise<T>{
  const{data}=await createClient().auth.getSession();
  const workSessionId=typeof window==='undefined'?'':localStorage.getItem('a25.workSessionId')??'';
  const response=await fetch(`${base}${path}`,{
    ...init,
    headers:{
      'content-type':'application/json',
      authorization:`Bearer ${data.session?.access_token??''}`,
      'x-work-session-id':workSessionId,
      ...init?.headers
    }
  });
  const payload=await response.json();
  if(!response.ok)throw new Error(payload.error?.message??'Không thể kết nối máy chủ');
  return payload.data as T;
}
