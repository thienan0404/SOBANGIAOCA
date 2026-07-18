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
const DEVICE_CACHE_KEY='a25.currentBranchDevice';

export function getCachedBranchDevice():CurrentBranchDevice|null{
  if(typeof window==='undefined')return null;
  try{
    const value=JSON.parse(localStorage.getItem(DEVICE_CACHE_KEY)??'null') as CurrentBranchDevice|null;
    return value?.deviceId&&value.deviceCode&&value.branch?.id?value:null;
  }catch{return null}
}

export function cacheBranchDevice(device:CurrentBranchDevice){
  if(typeof window!=='undefined')localStorage.setItem(DEVICE_CACHE_KEY,JSON.stringify(device));
}

export function clearCachedBranchDevice(){
  if(typeof window!=='undefined')localStorage.removeItem(DEVICE_CACHE_KEY);
}

async function responseData<T>(response:Response):Promise<T>{
  const payload=await response.json().catch(()=>({})) as ApiEnvelope<T>&ApiFailure;
  if(!response.ok)throw new Error(payload.error?.message??'Không thể kết nối máy chủ');
  return payload.data;
}

export async function getCurrentBranchDevice():Promise<CurrentBranchDevice|null>{
  const response=await fetch(`${apiUrl}/branch-devices/current`,{
    credentials:'include',
    cache:'no-store'
  });
  if(response.status===401){clearCachedBranchDevice();return null}
  const device=await responseData<CurrentBranchDevice>(response);
  cacheBranchDevice(device);
  return device;
}

export async function registerBranchDevice(accessToken:string,input:{branchId:string;deviceCode:string;deviceName:string}){
  const response=await fetch(`${apiUrl}/branch-devices/register`,{
    method:'POST',
    credentials:'include',
    headers:{'content-type':'application/json',authorization:`Bearer ${accessToken}`},
    body:JSON.stringify(input)
  });
  const device=await responseData<RegisteredBranchDevice>(response);
  cacheBranchDevice(device);
  return device;
}
