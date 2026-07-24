'use client';
import {useHandovers} from '../hooks/use-handovers';
import {HandoverStatus} from '@a25/contracts';
import Link from 'next/link';

const labels:Record<HandoverStatus,string>={DRAFT:'Bản nháp',SUBMITTED:'Đã gửi',PENDING_RECEIVER_CONFIRMATION:'Chờ người nhận',SUPPLEMENT_REQUESTED:'Cần bổ sung',RESUBMITTED:'Đã gửi lại',CONFIRMED:'Đã xác nhận',COMPLETED:'Hoàn tất',CANCELLED:'Đã hủy',OVERDUE:'Quá hạn'};

export function HandoverList(){
  const {data,isLoading,isFetching,error,refetch}=useHandovers();
  if(isLoading)return <div className="handover-skeleton" aria-label="Đang tải"><i/><i/><i/></div>;
  if(error)return <div role="alert" className="empty error-state"><div className="empty-icon">!</div><strong>Chưa thể kết nối dữ liệu</strong><p>{error.message}</p><button disabled={isFetching} onClick={()=>void refetch()}>{isFetching?'Đang thử lại...':'Thử lại'}</button></div>;
  if(!data?.length)return <div className="empty professional-empty"><div className="empty-visual"><span>✓</span><i/><b/></div><strong>Ca trực chưa có bàn giao</strong><p>Mọi công việc đã được xử lý. Tạo phiếu mới khi có nội dung cần chuyển tiếp cho ca sau.</p><a className="primary-action empty-action" href="/handovers/create"><span>＋</span> Tạo phiếu đầu tiên</a><small><i/> Dữ liệu được đồng bộ theo thời gian thực</small></div>;
  return <><div className="list-status"><span><i/> Đang đồng bộ</span><b>{data.length} phiếu</b></div><div className="card-list">{data.map(x=><Link className="handover-card amber" href={`/handovers/detail?id=${x.id}`} key={x.id}><div className="card-icon">⇄</div><div className="card-body"><div className="card-title"><h3>{x.code}</h3><span>{labels[x.status]}</span></div><p className="detail">{x.giver?.name??'Người giao'} → {x.receiver?.name??'Người nhận'}</p></div><span className="card-chevron">›</span></Link>)}</div></>;
}
