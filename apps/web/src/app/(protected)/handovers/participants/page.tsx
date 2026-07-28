'use client';

import {useMemo} from 'react';
import Link from 'next/link';
import {useQuery} from '@tanstack/react-query';
import {ParticipantType} from '@a25/contracts';
import {handoverApi,type ParticipantHistory} from '@/features/handovers';

const signatureSteps:Array<{type:ParticipantType;label:string;shortLabel:string}>=[
  {type:ParticipantType.GIVER,label:'Người giao',shortLabel:'Giao'},
  {type:ParticipantType.RECEIVER,label:'Người nhận',shortLabel:'Nhận'},
  {type:ParticipantType.SUPERVISOR,label:'BGĐ cơ sở',shortLabel:'BGĐ'},
  {type:ParticipantType.APPROVER,label:'Kế toán',shortLabel:'KT'}
];

const statusLabels:Record<string,string>={
  DRAFT:'Đang lập phiếu',SUBMITTED:'Chờ người nhận',PENDING_RECEIVER_CONFIRMATION:'Chờ người nhận',
  PENDING_MANAGEMENT_APPROVAL:'Chờ BGĐ cơ sở',PENDING_ACCOUNTING_APPROVAL:'Chờ kế toán',
  MANAGEMENT_CHANGES_REQUESTED:'BGĐ yêu cầu điều chỉnh',ACCOUNTING_CHANGES_REQUESTED:'Kế toán yêu cầu điều chỉnh',
  SUPPLEMENT_REQUESTED:'Chờ bổ sung',RESUBMITTED:'Đã gửi lại',CONFIRMED:'Đã xác nhận',
  COMPLETED:'Hoàn tất hồ sơ',CANCELLED:'Đã hủy',OVERDUE:'Quá hạn'
};

type SignatureGroup={
  handover:ParticipantHistory['handover'];
  assignedAt:string;
  participants:Partial<Record<ParticipantType,ParticipantHistory>>;
};

export default function Participants(){
  const{data,isLoading,error,refetch,isFetching}=useQuery({queryKey:['participants'],queryFn:handoverApi.participants});
  const groups=useMemo(()=>{
    const byHandover=new Map<string,SignatureGroup>();
    for(const item of data??[]){
      const current=byHandover.get(item.handover.id)??{handover:item.handover,assignedAt:item.assignedAt,participants:{}};
      current.participants[item.participantType]=item;
      if(new Date(item.assignedAt)>new Date(current.assignedAt))current.assignedAt=item.assignedAt;
      byHandover.set(item.handover.id,current);
    }
    return [...byHandover.values()].sort((a,b)=>new Date(b.assignedAt).getTime()-new Date(a.assignedAt).getTime());
  },[data]);
  const pendingGroups=groups.filter(group=>signatureSteps.some(step=>!group.participants[step.type]?.confirmedAt)&&group.handover.status!=='CANCELLED');
  const completedGroups=groups.filter(group=>signatureSteps.every(step=>Boolean(group.participants[step.type]?.confirmedAt)));

  return <div className="signature-center">
    <header className="inner-page-title"><div><h1>Trung tâm ký duyệt</h1><p>Theo dõi chữ ký và trạng thái phê duyệt từng phiếu</p></div></header>
    <section className="signature-overview" aria-label="Tổng quan ký duyệt"><div><span>CHỜ XỬ LÝ</span><strong>{pendingGroups.length}</strong><small>phiếu</small></div><i/><div className="completed"><span>ĐỦ CHỮ KÝ</span><strong>{completedGroups.length}</strong><small>phiếu</small></div></section>
    {isLoading&&<div className="signature-loading"><i/><i/><i/></div>}
    {error&&<div className="empty error-state"><strong>Chưa tải được thông tin ký duyệt</strong><p>{error.message}</p><button disabled={isFetching} onClick={()=>void refetch()}>{isFetching?'Đang thử lại...':'Thử lại'}</button></div>}
    {!isLoading&&!error&&<>
      <div className="signature-section-heading"><span>CẦN THEO DÕI</span><h2>Phiếu đang trong quy trình ký</h2></div>
      {!pendingGroups.length?<div className="signature-empty-state"><span>✓</span><div><strong>Không có phiếu chờ ký</strong><p>Các phiếu mới cần xác nhận sẽ xuất hiện tại đây.</p></div></div>:<div className="approval-card-list">{pendingGroups.map(group=><SignatureProgressCard group={group} key={group.handover.id}/>)}</div>}
      {completedGroups.length>0&&<><div className="signature-section-heading completed-heading"><span>ĐÃ HOÀN TẤT</span><h2>Hồ sơ đủ 4 chữ ký</h2></div><div className="approval-card-list completed-list">{completedGroups.slice(0,5).map(group=><SignatureProgressCard group={group} key={group.handover.id}/>)}</div></>}
    </>}
  </div>;
}

function SignatureProgressCard({group}:{group:SignatureGroup}){
  const signedCount=signatureSteps.filter(step=>group.participants[step.type]?.confirmedAt).length;
  const nextStep=signatureSteps.find(step=>!group.participants[step.type]?.confirmedAt);
  return <Link className="approval-card" href={`/handovers/detail?id=${group.handover.id}`}>
    <div className="approval-card-head"><div><span>PHIẾU BÀN GIAO</span><strong>{group.handover.code}</strong></div><b className={signedCount===4?'complete':'pending'}>{statusLabels[group.handover.status]??group.handover.status}</b></div>
    <div className="signature-progress" aria-label={`${signedCount} trên 4 chữ ký đã hoàn tất`}>{signatureSteps.map((step,index)=>{const participant=group.participants[step.type];const signed=Boolean(participant?.confirmedAt);return <div className={signed?'signed':''} key={step.type}><i>{signed?'✓':index+1}</i><span>{step.shortLabel}</span><small>{participant?.user.fullName??'Chưa phân công'}</small></div>})}</div>
    <footer><div><span>TIẾN ĐỘ</span><strong>{signedCount}/4 chữ ký</strong></div><div><span>BƯỚC TIẾP THEO</span><strong>{nextStep?nextStep.label:'Hoàn tất hồ sơ'}</strong></div><b>›</b></footer>
  </Link>;
}
