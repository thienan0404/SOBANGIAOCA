const base=process.env.NEXT_PUBLIC_API_URL!;

export async function apiRequest<T>(path:string,init?:RequestInit):Promise<T>{
  const{createClient}=await import('@/lib/supabase/client');
  const{data}=await createClient().auth.getSession();
  const accessToken=data.session?.access_token;
  const response=await fetch(`${base}${path}`,{
    ...init,
    credentials:'include',
    headers:{
      'content-type':'application/json',
      ...(accessToken?{authorization:`Bearer ${accessToken}`}:{ }),
      ...init?.headers
    }
  });
  const payload=await response.json();
  if(!response.ok)throw new Error(payload.error?.message??'Không thể kết nối máy chủ');
  return payload.data as T;
}