import type {CreateHandoverRequest,HandoverSummary,HandoverStatus,ParticipantType} from '@a25/contracts';
import {createClient} from '@/lib/supabase/client';
import {apiRequest} from './client';

export type HandoverParticipant={id:string;participantType:ParticipantType;confirmedAt?:string|null;user:{id:string;fullName:string;employeeCode?:string|null}};
export type HandoverDetail=HandoverSummary&{notes?:string;createdAt?:string;submittedAt?:string|null;confirmedAt?:string|null;participants?:HandoverParticipant[];items:Array<{id:string;title:string;details:string;category:string;priority:string;roomNumber?:string|null}>};
export type ParticipantHistory={id:string;participantType:ParticipantType;assignedAt:string;confirmedAt?:string|null;user:{id:string;fullName:string};handover:{id:string;code:string;status:HandoverStatus}};
export type EmployeeOption={id:string;fullName:string;employeeCode:string|null;email:string};
export type ShiftOption={id:string;shiftCode:string;startsAt:string;endsAt:string;branchId:string};
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

export const handoverApi={
  list:listHandovers,
  get:(id:string)=>apiRequest<HandoverDetail>(`/handovers/${id}`),
  create:(data:CreateHandoverRequest)=>apiRequest<HandoverSummary>('/handovers',{method:'POST',body:JSON.stringify(data)}),
  submit:(id:string)=>apiRequest<unknown>(`/handovers/${id}/submit`,{method:'POST'}),
  confirm:(id:string)=>apiRequest<unknown>(`/handovers/${id}/confirm`,{method:'POST'}),
  requestSupplement:(id:string,reason:string)=>apiRequest<unknown>(`/handovers/${id}/request-supplement`,{method:'POST',body:JSON.stringify({reason})}),
  check:(id:string,code:string)=>apiRequest<unknown>(`/handovers/${id}/checklist/${code}`,{method:'POST'}),
  participants:()=>apiRequest<ParticipantHistory[]>('/handover-participants'),
  employees:(branchId:string)=>apiRequest<EmployeeOption[]>(`/employees?branchId=${encodeURIComponent(branchId)}`),
  currentShift:(branchId:string)=>apiRequest<ShiftOption|null>(`/shifts/current?branchId=${encodeURIComponent(branchId)}`)
};
