export type DeviceBranch={id:string;code:string;name:string};
export type CurrentBranchDevice={
  deviceId:string;
  deviceCode:string;
  deviceName:string;
  branch:DeviceBranch;
  lastSeenAt?:string;
};
export type RegisteredBranchDevice=CurrentBranchDevice&{deviceToken:string};

type ApiEnvelope<T>={data:T;meta:Record<string,unknown>;requestId:string};
type ApiFailure={error?:{message?:string}};

const apiUrl=(process.env.NEXT_PUBLIC_API_URL??'').replace(/\/$/,'');

async function responseData<T>(response:Response):Promise<T>{
  const payload=await response.json().catch(()=>({})) as ApiEnvelope<T>&ApiFailure;
  if(!response.ok)throw new Error(payload.error?.message??'Kh?ng th? k?t n?i m?y ch?');
  return payload.data;
}

export async function getCurrentBranchDevice():Promise<CurrentBranchDevice|null>{
  const response=await fetch(`${apiUrl}/branch-devices/current`,{
    credentials:'include',
    cache:'no-store'
  });
  if(response.status===401)return null;
  return responseData<CurrentBranchDevice>(response);
}

export async function registerBranchDevice(accessToken:string,input:{branchId:string;deviceCode:string;deviceName:string}){
  const response=await fetch(`${apiUrl}/branch-devices/register`,{
    method:'POST',
    credentials:'include',
    headers:{'content-type':'application/json',authorization:`Bearer ${accessToken}`},
    body:JSON.stringify(input)
  });
  return responseData<RegisteredBranchDevice>(response);
}
