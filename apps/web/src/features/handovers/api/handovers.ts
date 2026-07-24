import type {CreateHandoverRequest,HandoverSummary,HandoverStatus,ParticipantType} from '@a25/contracts';
import {createClient} from '@/lib/supabase/client';
import {apiRequest} from './client';

export type HandoverParticipant={id:string;participantType:ParticipantType;confirmedAt?:string|null;user:{id:string;fullName:string;employeeCode?:string|null}};
export type HandoverDetail=HandoverSummary&{notes?:string;createdAt?:string;submittedAt?:string|null;confirmedAt?:string|null;participants?:HandoverParticipant[];items:Array<{id:string;title:string;details:string;category:string;priority:string;roomNumber?:string|null}>};
export type ParticipantHistory={id:string;participantType:ParticipantType;assignedAt:string;confirmedAt?:string|null;user:{id:string;fullName:string};handover:{id:string;code:string;status:HandoverStatus}};
export type EmployeeOption={id:string;fullName:string;employeeCode:string|null;email:string};
export type ShiftOption={id:string;shiftCode:string;startsAt:string;endsAt:string;branchId:string};
export type HandoverFormContext={employees:EmployeeOption[];currentShift:ShiftOption|null};
type CachedHandoverFormContext=HandoverFormContext&{cachedAt:number};
const formContextTtlMs=2*60*1000;
const formContextKey=(branchId:string)=>`a25.handoverFormContext.${branchId}`;
const formContextRequests=new Map<string,Promise<HandoverFormContext>>();

export function readHandoverFormContext(branchId:string):HandoverFormContext|null{
  if(typeof window==='undefined')return null;
  try{
    const cached=JSON.parse(sessionStorage.getItem(formContextKey(branchId))??'null') as CachedHandoverFormContext|null;
    if(!cached||Date.now()-cached.cachedAt>formContextTtlMs)return null;
    return{employees:cached.employees,currentShift:cached.currentShift};
  }catch{return null}
}
type DirectHandoverRow={
  id:string;
  code:string;
  status:HandoverStatus;
  branch_id:string;
  created_at:string;
  submitted_at:string|null;
  participants:Array<{
    participant_type:ParticipantType;
    user:{id:string;full_name:string}|null;
  }>;
};
type DirectHandoverDetailRow={
  id:string;code:string;status:HandoverStatus;branch_id:string;notes:string|null;
  created_at:string;submitted_at:string|null;confirmed_at:string|null;
  participants:Array<{id:string;participant_type:ParticipantType;confirmed_at:string|null;user:{id:string;full_name:string;employee_code:string|null}|null}>;
  items:Array<{id:string;title:string;details:string;category:string;priority:string;room_number:string|null}>;
};

async function listHandovers(branchId?:string):Promise<HandoverSummary[]>{
  let query=createClient()
    .from('handovers')
    .select(`
      id,
      code,
      status,
      branch_id,
      created_at,
      submitted_at,
      participants:handover_participants(
        participant_type,
        user:profiles!handover_participants_user_id_fkey(id,full_name)
      )
    `)
    .order('created_at',{ascending:false})
    .limit(20);
  if(branchId)query=query.eq('branch_id',branchId);
  const{data,error}=await query;
  if(error)throw new Error('Không thể tải danh sách bàn giao');
  const rows=data as unknown as DirectHandoverRow[];
  return rows.map(row=>{
    const giver=row.participants.find(item=>item.participant_type==='GIVER')?.user;
    const receiver=row.participants.find(item=>item.participant_type==='RECEIVER')?.user;
    return{id:row.id,code:row.code,status:row.status,branchId:row.branch_id,giver:{id:giver?.id??'',name:giver?.full_name??'Người giao'},receiver:{id:receiver?.id??'',name:receiver?.full_name??'Người nhận'},createdAt:row.created_at,...(row.submitted_at?{submittedAt:row.submitted_at}:{})};
  });
}

async function getHandover(id:string):Promise<HandoverDetail>{
  const{data,error}=await createClient().from('handovers').select(`
    id,code,status,branch_id,notes,created_at,submitted_at,confirmed_at,
    participants:handover_participants(
      id,participant_type,confirmed_at,
      user:profiles!handover_participants_user_id_fkey(id,full_name,employee_code)
    ),
    items:handover_items(id,title,details,category,priority,room_number)
  `).eq('id',id).maybeSingle();
  if(error||!data)return apiRequest<HandoverDetail>(`/handovers/${id}`);
  const row=data as unknown as DirectHandoverDetailRow;
  const participants:HandoverParticipant[]=row.participants.map(item=>({id:item.id,participantType:item.participant_type,confirmedAt:item.confirmed_at,user:{id:item.user?.id??'',fullName:item.user?.full_name??'Nhân viên',employeeCode:item.user?.employee_code??null}}));
  const giver=participants.find(item=>item.participantType==='GIVER')?.user;
  const receiver=participants.find(item=>item.participantType==='RECEIVER')?.user;
  return{id:row.id,code:row.code,status:row.status,branchId:row.branch_id,giver:{id:giver?.id??'',name:giver?.fullName??'Người giao'},receiver:{id:receiver?.id??'',name:receiver?.fullName??'Người nhận'},createdAt:row.created_at,...(row.submitted_at?{submittedAt:row.submitted_at}:{}),...(row.notes?{notes:row.notes}:{}),confirmedAt:row.confirmed_at,participants,items:row.items.map(item=>({id:item.id,title:item.title,details:item.details,category:item.category,priority:item.priority,roomNumber:item.room_number}))};
}

export const handoverApi={
  list:listHandovers,
  get:getHandover,
  create:(data:CreateHandoverRequest)=>apiRequest<HandoverSummary>('/handovers',{method:'POST',body:JSON.stringify(data)}),
  submit:(id:string)=>apiRequest<unknown>(`/handovers/${id}/submit`,{method:'POST'}),
  confirm:(id:string)=>apiRequest<unknown>(`/handovers/${id}/confirm`,{method:'POST'}),
  requestSupplement:(id:string,reason:string)=>apiRequest<unknown>(`/handovers/${id}/request-supplement`,{method:'POST',body:JSON.stringify({reason})}),
  check:(id:string,code:string)=>apiRequest<unknown>(`/handovers/${id}/checklist/${code}`,{method:'POST'}),
  participants:()=>apiRequest<ParticipantHistory[]>('/handover-participants'),
  employees:(branchId:string)=>apiRequest<EmployeeOption[]>(`/employees?branchId=${encodeURIComponent(branchId)}`),
  currentShift:(branchId:string)=>apiRequest<ShiftOption|null>(`/shifts/current?branchId=${encodeURIComponent(branchId)}`),
  formContext:async(branchId:string,forceRefresh=false):Promise<HandoverFormContext>=>{
    const cached=readHandoverFormContext(branchId);
    if(cached&&!forceRefresh)return cached;
    const pending=formContextRequests.get(branchId);
    if(pending)return pending;
    const request=Promise.all([
      apiRequest<EmployeeOption[]>(`/employees?branchId=${encodeURIComponent(branchId)}`),
      apiRequest<ShiftOption|null>(`/shifts/current?branchId=${encodeURIComponent(branchId)}`)
    ]).then(([employees,currentShift])=>{
      const context={employees,currentShift};
      if(typeof window!=='undefined')sessionStorage.setItem(formContextKey(branchId),JSON.stringify({...context,cachedAt:Date.now()}));
      return context;
    }).finally(()=>formContextRequests.delete(branchId));
    formContextRequests.set(branchId,request);
    return request;
  }
};
