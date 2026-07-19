'use client';
import {useQuery} from '@tanstack/react-query';
import {handoverApi} from '@/features/handovers';
export default function Participants(){
  const{data,isLoading}=useQuery({queryKey:['participants'],queryFn:handoverApi.participants});
  return <div><header className="inner-page-title"><div><h1>Ký nhận bàn giao</h1><p>Lịch sử người giao và người nhận ca</p></div></header>{isLoading?<div className="ops-loading"><i/></div>:<div className="signature-history">{data?.length?data.map(item=><article key={item.id}><div className="history-icon">✎</div><div><span>{item.participantType==='GIVER'?'NGƯỜI GIAO':'NGƯỜI NHẬN'}</span><strong>{item.user.fullName}</strong><p>{item.handover.code}</p></div><div className={item.confirmedAt?'signed-state':'waiting-state'}>{item.confirmedAt?'Đã ký':'Chờ ký'}</div></article>):<div className="empty">Chưa có lịch sử ký nhận bàn giao</div>}</div>}</div>;
}