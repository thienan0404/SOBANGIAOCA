import type {CreateHandoverRequest,HandoverSummary,HandoverStatus,ParticipantType} from '@a25/contracts';
import {createClient} from '@/lib/supabase/client';
import {apiRequest} from './client';

export type HandoverParticipant={id:string;participantType:ParticipantType;confirmedAt?:string|null;signatureText?:string|null;signatureMethod?:string|null;user:{id:string;fullName:string;employeeCode?:string|null}};
export type InventoryCheck={itemCode:string;isCompleted:boolean;receiverCheckedAt?:string|null};
export type HandoverAmendment={id:string;reason:string;content:Record<string,unknown>;createdAt:string};
export type HandoverDetail=HandoverSummary&{notes?:string;createdAt?:string;submittedAt?:string|null;confirmedAt?:string|null;operationalLockedAt?:string|null;lockedAt?:string|null;amendments?:HandoverAmendment[];participants?:HandoverParticipant[];checklistResults?:InventoryCheck[];items:Array<{id:string;title:string;details:string;category:string;priority:string;roomNumber?:string|null}>};
export type ParticipantHistory={id:string;participantType:ParticipantType;assignedAt:string;confirmedAt?:string|null;user:{id:string;fullName:string};handover:{id:string;code:string;status:HandoverStatus}};
export type EmployeeOption={id:string;fullName:string;employeeCode:string|null;email:string;memberships?:Array<{branchId:string;role:{code:string;name:string}}>} ;
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
  operational_locked_at:string|null;locked_at:string|null;
  participants:Array<{id:string;participant_type:ParticipantType;confirmed_at:string|null;signature_text:string|null;signature_method:string|null;user:{id:string;full_name:string;employee_code:string|null}|null}>;
  checklist_results:Array<{item_code:string;is_completed:boolean;receiver_checked_at:string|null}>;
  items:Array<{id:string;title:string;details:string;category:string;priority:string;room_number:string|null}>;
  amendments:Array<{id:string;reason:string;content:Record<string,unknown>;created_at:string}>;
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
    id,code,status,branch_id,notes,created_at,submitted_at,confirmed_at,operational_locked_at,locked_at,
    participants:handover_participants(
      id,participant_type,confirmed_at,signature_text,signature_method,
      user:profiles!handover_participants_user_id_fkey(id,full_name,employee_code)
    ),
    checklist_results(item_code,is_completed,receiver_checked_at),
    items:handover_items(id,title,details,category,priority,room_number),
    amendments:handover_amendments(id,reason,content,created_at)
  `).eq('id',id).maybeSingle();
  if(error||!data)return apiRequest<HandoverDetail>(`/handovers/${id}`);
  const row=data as unknown as DirectHandoverDetailRow;
  const participants:HandoverParticipant[]=row.participants.map(item=>({id:item.id,participantType:item.participant_type,confirmedAt:item.confirmed_at,signatureText:item.signature_text,signatureMethod:item.signature_method,user:{id:item.user?.id??'',fullName:item.user?.full_name??'Nhân viên',employeeCode:item.user?.employee_code??null}}));
  const giver=participants.find(item=>item.participantType==='GIVER')?.user;
  const receiver=participants.find(item=>item.participantType==='RECEIVER')?.user;
  return{id:row.id,code:row.code,status:row.status,branchId:row.branch_id,giver:{id:giver?.id??'',name:giver?.fullName??'Người giao'},receiver:{id:receiver?.id??'',name:receiver?.fullName??'Người nhận'},createdAt:row.created_at,...(row.submitted_at?{submittedAt:row.submitted_at}:{}),...(row.notes?{notes:row.notes}:{}),confirmedAt:row.confirmed_at,operationalLockedAt:row.operational_locked_at,lockedAt:row.locked_at,amendments:row.amendments.map(item=>({id:item.id,reason:item.reason,content:item.content,createdAt:item.created_at})),participants,checklistResults:row.checklist_results.map(item=>({itemCode:item.item_code,isCompleted:item.is_completed,receiverCheckedAt:item.receiver_checked_at})),items:row.items.map(item=>({id:item.id,title:item.title,details:item.details,category:item.category,priority:item.priority,roomNumber:item.room_number}))};
}

export type ReceiverSignResponse={workSession:{id:string;branchId:string};employee:{id:string;fullName:string;employeeCode:string|null};status:HandoverStatus};
export const handoverApi={
  list:listHandovers,
  get:getHandover,
  create:(data:CreateHandoverRequest)=>apiRequest<HandoverSummary>('/handovers',{method:'POST',body:JSON.stringify(data)}),
  submit:(id:string,signatureText:string)=>apiRequest<unknown>(`/handovers/${id}/submit`,{method:'POST',body:JSON.stringify({signatureText})}),
  receiverSign:(id:string,input:{username:string;password:string;signatureText:string;inventoryConfirmed:true})=>apiRequest<ReceiverSignResponse>(`/handovers/${id}/receiver-sign`,{method:'POST',body:JSON.stringify(input)}),
  receiverRequestSupplement:(id:string,input:{username:string;password:string;reason:string})=>apiRequest<unknown>(`/handovers/${id}/receiver-request-supplement`,{method:'POST',body:JSON.stringify(input)}),
  managementSign:(id:string,signatureText:string)=>apiRequest<unknown>(`/handovers/${id}/management-sign`,{method:'POST',body:JSON.stringify({signatureText})}),
  accountingSign:(id:string,signatureText:string)=>apiRequest<unknown>(`/handovers/${id}/accounting-sign`,{method:'POST',body:JSON.stringify({signatureText})}),  managementReturn:(id:string,reason:string)=>apiRequest<unknown>(`/handovers/${id}/management-return`,{method:'POST',body:JSON.stringify({reason})}),
  accountingReturn:(id:string,reason:string)=>apiRequest<unknown>(`/handovers/${id}/accounting-return`,{method:'POST',body:JSON.stringify({reason})}),
  receiverAmend:(id:string,input:{username:string;password:string;signatureText:string;reason:string;correction:string;scope:'OPERATIONS'|'FINANCE'|'BOTH'})=>apiRequest<unknown>(`/handovers/${id}/receiver-amend`,{method:'POST',body:JSON.stringify(input)}),
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
