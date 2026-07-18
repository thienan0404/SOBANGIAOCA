import {createClient} from '@/lib/supabase/client';

export type EmployeeBranch={id:string;name:string;code:string;address:string|null};
export type ShiftAssignment={
  id:string;
  assignmentType:string;
  shift:{id:string;shiftCode:string;startsAt:string;endsAt:string;branch:EmployeeBranch};
};
export type EmployeeContext={
  employee:{id:string;fullName:string;employeeCode:string|null;mustChangePin:boolean};
  branch:EmployeeBranch;
  assignments:ShiftAssignment[];
};
export type WorkSession={id:string;branchId:string};

type ApiFailure={error?:{message?:string};message?:string};
type ApiEnvelope<T>={data:T;requestId:string};
const apiUrl=(process.env.NEXT_PUBLIC_API_URL??'').replace(/\/$/,'');

async function accessToken(){
  const{data}=await createClient().auth.getSession();
  if(!data.session)throw new Error('Phiên đăng nhập quản lý đã hết hạn. Vui lòng đăng ký lại thiết bị.');
  return data.session.access_token;
}

async function request<T>(path:string,body:unknown):Promise<T>{
  const token=await accessToken();
  const response=await fetch(`${apiUrl}${path}`,{
    method:'POST',
    credentials:'include',
    headers:{'content-type':'application/json',authorization:`Bearer ${token}`},
    body:JSON.stringify(body)
  });
  const payload=await response.json().catch(()=>({})) as ApiEnvelope<T>&ApiFailure;
  if(!response.ok)throw new Error(payload.error?.message??payload.message??'Không thể kết nối máy chủ');
  return payload.data;
}

export function verifyEmployee(identifier:string,pin:string){
  return request<EmployeeContext>('/auth/employee/verify',{identifier,pin});
}

export function changeEmployeePin(identifier:string,currentPin:string,newPin:string){
  return request<{changed:boolean}>('/auth/employee/change-pin',{identifier,currentPin,newPin});
}

export function startWorkSession(identifier:string,pin:string,shiftInstanceId:string){
  return request<WorkSession>('/auth/work-sessions',{identifier,pin,shiftInstanceId});
}