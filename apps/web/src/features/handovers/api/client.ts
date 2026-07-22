const base=process.env.NEXT_PUBLIC_API_URL!;
const requestTimeoutMs=12000;

export async function apiRequest<T>(path:string,init?:RequestInit):Promise<T>{
  const{createClient}=await import('@/lib/supabase/client');
  const{data}=await createClient().auth.getSession();
  const accessToken=data.session?.access_token;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),requestTimeoutMs);
  const abort=()=>controller.abort();
  init?.signal?.addEventListener('abort',abort,{once:true});
  try{
    const response=await fetch(`${base}${path}`,{
      ...init,
      signal:controller.signal,
      credentials:'include',
      headers:{
        'content-type':'application/json',
        ...(accessToken?{authorization:`Bearer ${accessToken}`}:{ }),
        ...init?.headers
      }
    });
    const payload=await response.json().catch(()=>({})) as {data?:T;error?:{message?:string}};
    if(!response.ok)throw new Error(payload.error?.message??'Không thể kết nối máy chủ');
    return payload.data as T;
  }catch(error){
    if(error instanceof Error&&error.name==='AbortError'){
      throw new Error('Máy chủ phản hồi quá chậm. Vui lòng thử lại.');
    }
    throw error;
  }finally{
    clearTimeout(timeout);
    init?.signal?.removeEventListener('abort',abort);
  }
}
