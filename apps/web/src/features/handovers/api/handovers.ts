import type {CreateHandoverRequest,HandoverSummary,HandoverStatus,ParticipantType} from '@a25/contracts';import {apiRequest} from './client';
import {createClient} from '@/lib/supabase/client';
export type HandoverDetail=HandoverSummary&{notes?:string;items:Array<{id:string;title:string;details:string;category:string;priority:string}>};
export type ParticipantHistory={id:string;participantType:ParticipantType;assignedAt:string;user:{id:string;fullName:string};handover:{id:string;code:string;status:HandoverStatus}};
type HandoverRow={
  id:string;
  code:string;
  status:HandoverStatus;
  branch_id:string;
  created_at:string;
  submitted_at:string|null;
  handover_participants:Array<{
    participant_type:ParticipantType;
    user:{id:string;full_name:string}|null;
  }>;
};

async function listHandovers(branchId?:string):Promise<HandoverSummary[]> {
  let query=createClient()
    .from('handovers')
    .select('id,code,status,branch_id,created_at,submitted_at,handover_participants(participant_type,user:profiles!handover_participants_user_id_fkey(id,full_name))')
    .order('created_at',{ascending:false})
    .limit(20);

  if(branchId)query=query.eq('branch_id',branchId);
  const{data,error}=await query;
  if(error)throw new Error(error.message);

  return (data as unknown as HandoverRow[]).map(row=>{
    const giver=row.handover_participants.find(item=>item.participant_type==='GIVER')?.user;
    const receiver=row.handover_participants.find(item=>item.participant_type==='RECEIVER')?.user;
    return{
      id:row.id,
      code:row.code,
      status:row.status,
      branchId:row.branch_id,
      giver:{id:giver?.id??'',name:giver?.full_name??'Ng\u01b0\u1eddi giao'},
      receiver:{id:receiver?.id??'',name:receiver?.full_name??'Ng\u01b0\u1eddi nh\u1eadn'},
      createdAt:row.created_at,
      ...(row.submitted_at?{submittedAt:row.submitted_at}:{})
    };
  });
}

export const handoverApi={list:listHandovers,get:(id:string)=>apiRequest<HandoverDetail>(`/handovers/${id}`),create:(data:CreateHandoverRequest)=>apiRequest<HandoverSummary>('/handovers',{method:'POST',body:JSON.stringify(data)}),submit:(id:string)=>apiRequest<unknown>(`/handovers/${id}/submit`,{method:'POST'}),confirm:(id:string)=>apiRequest<unknown>(`/handovers/${id}/confirm`,{method:'POST'}),requestSupplement:(id:string,reason:string)=>apiRequest<unknown>(`/handovers/${id}/request-supplement`,{method:'POST',body:JSON.stringify({reason})}),check:(id:string,code:string)=>apiRequest<unknown>(`/handovers/${id}/checklist/${code}`,{method:'POST'}),participants:()=>apiRequest<ParticipantHistory[]>('/handover-participants')};
