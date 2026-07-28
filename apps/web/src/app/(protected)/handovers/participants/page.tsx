'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {useQuery} from '@tanstack/react-query';
import {ParticipantType} from '@a25/contracts';
import {handoverApi,type ParticipantHistory} from '@/features/handovers';
import {roleGroup,storedEmployeeRole,type RoleGroup} from '@/lib/employee-role';

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

const roleCopy:Record<RoleGroup,{eyebrow:string;title:string;description:string;pendingLabel:string;pendingTitle:string;completeLabel:string;completeTitle:string}>={
  reception:{eyebrow:'VẬN HÀNH CA TRỰC',title:'Ký nhận bàn giao',description:'Theo dõi người giao, người nhận và tiến độ phê duyệt phiếu.',pendingLabel:'CHỜ KÝ',pendingTitle:'Phiếu đang trong quy trình ký',completeLabel:'ĐỦ CHỮ KÝ',completeTitle:'Hồ sơ đủ 4 chữ ký'},
  management:{eyebrow:'BAN GIÁM ĐỐC CƠ SỞ',title:'Phê duyệt vận hành',description:'Kiểm tra nội dung bàn giao trước khi chuyển Kế toán nghiệm thu.',pendingLabel:'CHỜ BGĐ DUYỆT',pendingTitle:'Phiếu cần BGĐ xử lý',completeLabel:'ĐÃ BGĐ DUYỆT',completeTitle:'Phiếu đã chuyển Kế toán'},
  accounting:{eyebrow:'KIỂM SOÁT TÀI CHÍNH',title:'Nghiệm thu bàn giao',description:'Đối soát thu, chi và hoàn tất hồ sơ tài chính của ca.',pendingLabel:'CHỜ NGHIỆM THU',pendingTitle:'Phiếu cần Kế toán xử lý',completeLabel:'ĐÃ NGHIỆM THU',completeTitle:'Hồ sơ Kế toán đã ký'}
};

type SignatureGroup={handover:ParticipantHistory['handover'];assignedAt:string;participants:Partial<Record<ParticipantType,ParticipantHistory>>};

export default function Participants(){
  const[group,setGroup]=useState<RoleGroup>('reception');
  const{data,isLoading,error,refetch,isFetching}=useQuery({queryKey:['participants'],queryFn:handoverApi.participants});
  useEffect(()=>{queueMicrotask(()=>setGroup(roleGroup(storedEmployeeRole()?.code)))},[]);
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
  const actionableGroups=useMemo(()=>groups.filter(item=>{
    if(group==='management')return item.handover.status==='PENDING_MANAGEMENT_APPROVAL';
    if(group==='accounting')return item.handover.status==='PENDING_ACCOUNTING_APPROVAL';
    return signatureSteps.some(step=>!item.participants[step.type]?.confirmedAt)&&item.handover.status!=='CANCELLED';
  }),[group,groups]);
  const processedGroups=useMemo(()=>groups.filter(item=>{
    if(group==='management')return Boolean(item.participants[ParticipantType.SUPERVISOR]?.confirmedAt);
    if(group==='accounting')return Boolean(item.participants[ParticipantType.APPROVER]?.confirmedAt);
    return signatureSteps.every(step=>Boolean(item.participants[step.type]?.confirmedAt));
  }),[group,groups]);
  const copy=roleCopy[group];

  return <div className={`signature-center signature-role-${group}`}>
    <header className="signature-role-heading"><span>{copy.eyebrow}</span><h1>{copy.title}</h1><p>{copy.description}</p></header>
    <section className="signature-overview" aria-label="Tổng quan ký duyệt"><div><span>{copy.pendingLabel}</span><strong>{actionableGroups.length}</strong><small>phiếu</small></div><i/><div className="completed"><span>{copy.completeLabel}</span><strong>{processedGroups.length}</strong><small>phiếu</small></div></section>
    {group!=='reception'&&<section className="approval-guidance"><b>{group==='management'?'BGĐ':'KT'}</b><div><strong>{group==='management'?'Kiểm tra vận hành trước khi ký':'Đối soát tài chính trước khi nghiệm thu'}</strong><p>{group==='management'?'Có thể ký duyệt hoặc trả lại cho Người nhận điều chỉnh.':'Có thể ký nghiệm thu hoặc trả lại khi số liệu chưa khớp.'}</p></div></section>}
    {isLoading&&<div className="signature-loading"><i/><i/><i/></div>}
    {error&&<div className="empty error-state"><strong>Chưa tải được thông tin ký duyệt</strong><p>{error.message}</p><button disabled={isFetching} onClick={()=>void refetch()}>{isFetching?'Đang thử lại...':'Thử lại'}</button></div>}
    {!isLoading&&!error&&<>
      <div className="signature-section-heading"><span>CẦN XỬ LÝ</span><h2>{copy.pendingTitle}</h2></div>
      {!actionableGroups.length?<div className="signature-empty-state"><span>✓</span><div><strong>Không có phiếu chờ xử lý</strong><p>Phiếu đúng bước phê duyệt của bạn sẽ xuất hiện tại đây.</p></div></div>:<div className="approval-card-list">{actionableGroups.map(item=><SignatureProgressCard group={item} role={group} key={item.handover.id}/>)}</div>}
      {processedGroups.length>0&&<><div className="signature-section-heading completed-heading"><span>ĐÃ XỬ LÝ</span><h2>{copy.completeTitle}</h2></div><div className="approval-card-list completed-list">{processedGroups.slice(0,5).map(item=><SignatureProgressCard group={item} role={group} key={item.handover.id}/>)}</div></>}
    </>}
  </div>;
}

function SignatureProgressCard({group,role}:{group:SignatureGroup;role:RoleGroup}){
  const signedCount=signatureSteps.filter(step=>group.participants[step.type]?.confirmedAt).length;
  const nextStep=signatureSteps.find(step=>!group.participants[step.type]?.confirmedAt);
  const actionLabel=role==='management'?'Kiểm tra và duyệt':role==='accounting'?'Đối soát và ký':'Mở phiếu ký nhận';
  return <Link className="approval-card" href={`/handovers/detail?id=${group.handover.id}`}>
    <div className="approval-card-head"><div><span>PHIẾU BÀN GIAO</span><strong>{group.handover.code}</strong></div><b className={signedCount===4?'complete':'pending'}>{statusLabels[group.handover.status]??group.handover.status}</b></div>
    <div className="signature-progress" aria-label={`${signedCount} trên 4 chữ ký đã hoàn tất`}>{signatureSteps.map((step,index)=>{const participant=group.participants[step.type];const signed=Boolean(participant?.confirmedAt);return <div className={signed?'signed':''} key={step.type}><i>{signed?'✓':index+1}</i><span>{step.shortLabel}</span><small>{participant?.user.fullName??'Chưa phân công'}</small></div>})}</div>
    <footer><div><span>TIẾN ĐỘ</span><strong>{signedCount}/4 chữ ký</strong></div><div><span>{signedCount===4?'TRẠNG THÁI':'BƯỚC TIẾP THEO'}</span><strong>{signedCount===4?'Hoàn tất hồ sơ':nextStep?.label}</strong></div><b>›</b></footer>
    <div className="approval-card-action">{actionLabel}<span>→</span></div>
  </Link>;
}
