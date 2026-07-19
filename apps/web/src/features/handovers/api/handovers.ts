import type {CreateHandoverRequest,HandoverSummary,HandoverStatus,ParticipantType} from '@a25/contracts';
import {apiRequest} from './client';

export type HandoverParticipant={id:string;participantType:ParticipantType;confirmedAt?:string|null;user:{id:string;fullName:string;employeeCode?:string|null}};
export type HandoverDetail=HandoverSummary&{notes?:string;createdAt?:string;submittedAt?:string|null;confirmedAt?:string|null;participants?:HandoverParticipant[];items:Array<{id:string;title:string;details:string;category:string;priority:string;roomNumber?:string|null}>};
export type ParticipantHistory={id:string;participantType:ParticipantType;assignedAt:string;confirmedAt?:string|null;user:{id:string;fullName:string};handover:{id:string;code:string;status:HandoverStatus}};
export type EmployeeOption={id:string;fullName:string;employeeCode:string|null;email:string};
export type ShiftOption={id:string;shiftCode:string;startsAt:string;endsAt:string;branchId:string};
type HandoverRow={id:string;code:string;status:HandoverStatus;branchId:string;createdAt:string;submittedAt?:string|null;participants:Array<{participantType:ParticipantType;user:{id:string;fullName:string}}>};

async function listHandovers(branchId?:string):Promise<HandoverSummary[]>{
  const query=branchId?`?branchId=${encodeURIComponent(branchId)}`:'';
  const rows=await apiRequest<HandoverRow[]>(`/handovers${query}`);
  return rows.map(row=>{
    const giver=row.participants.find(item=>item.participantType==='GIVER')?.user;
    const receiver=row.participants.find(item=>item.participantType==='RECEIVER')?.user;
    return{id:row.id,code:row.code,status:row.status,branchId:row.branchId,giver:{id:giver?.id??'',name:giver?.fullName??'Người giao'},receiver:{id:receiver?.id??'',name:receiver?.fullName??'Người nhận'},createdAt:row.createdAt,...(row.submittedAt?{submittedAt:row.submittedAt}:{})};
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