'use client';

import {useMemo} from 'react';
import Link from 'next/link';
import {useHandovers,type HandoverTask} from '@/features/handovers';

const priorityLabels:Record<HandoverTask['priority'],string>={LOW:'Thấp',NORMAL:'Bình thường',HIGH:'Ưu tiên cao',URGENT:'Khẩn cấp'};
const priorityOrder:Record<HandoverTask['priority'],number>={URGENT:0,HIGH:1,NORMAL:2,LOW:3};

export default function Pending(){
  const{data,isLoading,error,refetch,isFetching}=useHandovers();
  const tasks=useMemo(()=>(data??[])
    .filter(handover=>!['CANCELLED','COMPLETED'].includes(handover.status))
    .flatMap(handover=>handover.tasks.map(task=>({...task,handoverId:handover.id,handoverCode:handover.code,giverName:handover.giver.name,receiverName:handover.receiver.name,createdAt:handover.createdAt})))
    .sort((a,b)=>priorityOrder[a.priority]-priorityOrder[b.priority]||new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()),[data]);
  const urgentCount=tasks.filter(task=>task.priority==='URGENT'||task.priority==='HIGH').length;

  return <div className="work-page">
    <header className="inner-page-title"><div><h1>Công việc ca trực</h1><p>Nội dung cần tiếp tục theo dõi và xử lý</p></div></header>
    <section className="work-summary" aria-label="Tổng quan công việc"><div><small>TẤT CẢ</small><strong>{tasks.length}</strong><span>công việc</span></div><i/><div className="urgent"><small>CẦN ƯU TIÊN</small><strong>{urgentCount}</strong><span>công việc</span></div></section>
    <div className="work-list-heading"><div><span>DANH SÁCH XỬ LÝ</span><h2>Công việc đang theo dõi</h2></div><Link href="/handovers">Xem phiếu</Link></div>
    {isLoading&&<div className="work-skeleton"><i/><i/><i/></div>}
    {error&&<div className="empty error-state"><strong>Chưa tải được công việc</strong><p>{error.message}</p><button disabled={isFetching} onClick={()=>void refetch()}>{isFetching?'Đang thử lại...':'Thử lại'}</button></div>}
    {!isLoading&&!error&&!tasks.length&&<div className="work-empty"><span>✓</span><strong>Không có công việc tồn đọng</strong><p>Những nội dung ca sau cần xử lý sẽ xuất hiện tại đây.</p></div>}
    {!isLoading&&!error&&Boolean(tasks.length)&&<div className="operational-task-list">{tasks.map(task=><Link href={`/handovers/detail?id=${task.handoverId}`} className={`operational-task priority-${task.priority.toLowerCase()}`} key={`${task.handoverId}-${task.id}`}><div className="task-priority-row"><span>{priorityLabels[task.priority]}</span>{task.roomNumber&&<b>Phòng {task.roomNumber}</b>}</div><h3>{task.title}</h3><p>{task.details}</p><footer><span>{task.handoverCode}</span><small>{task.giverName} → {task.receiverName}</small><b>›</b></footer></Link>)}</div>}
  </div>;
}