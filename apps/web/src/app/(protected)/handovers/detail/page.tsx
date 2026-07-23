'use client';

import {Suspense} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {useHandover,handoverApi} from '@/features/handovers';
import {useQueryClient} from '@tanstack/react-query';
import {financeTotals,formatMoney,parseFinance,type FinanceEntry} from '@/features/handovers/lib/finance';

const statusLabels:Record<string,string>={DRAFT:'Bản nháp',SUBMITTED:'Đã gửi',PENDING_RECEIVER_CONFIRMATION:'Chờ người nhận xác nhận',SUPPLEMENT_REQUESTED:'Cần bổ sung',RESUBMITTED:'Đã gửi lại',CONFIRMED:'Đã xác nhận',COMPLETED:'Hoàn tất',CANCELLED:'Đã hủy',OVERDUE:'Quá hạn'};

function DetailContent(){
  const router=useRouter();
  const id=useSearchParams().get('id')??'';
  const queryClient=useQueryClient();
  const{data,isLoading,error}=useHandover(id);
  if(!id)return <div className="empty">Thiếu mã phiếu bàn giao</div>;
  if(isLoading)return <div className="ops-loading"><i/><p>Đang tải phiếu bàn giao...</p></div>;
  if(error||!data)return <div className="empty">Không tìm thấy phiếu bàn giao</div>;

  const finance=data.items?.find(item=>item.category==='FINANCE');
  const financeData=finance?parseFinance(finance.details):null;
  const financeEntries:FinanceEntry[]=financeData?.entries.map((item,index)=>({...item,id:String(index),amount:String(item.amount)}))??[];
  const financeSummary=financeData?financeTotals(String(financeData.fixedFund),financeEntries):null;
  const hotel=data.items?.find(item=>item.category==='HOTEL_STATUS');
  const tasks=data.items?.filter(item=>item.category==='TASK')??[];
  const giver=data.participants?.find(item=>item.participantType==='GIVER');
  const receiver=data.participants?.find(item=>item.participantType==='RECEIVER');

  async function act(action:'submit'|'confirm'|'supplement'){
    try{
      if(action==='submit')await handoverApi.submit(id);
      if(action==='confirm')await handoverApi.confirm(id);
      if(action==='supplement'){
        const reason=prompt('Nội dung cần bổ sung');
        if(reason)await handoverApi.requestSupplement(id,reason);
      }
      await queryClient.invalidateQueries({queryKey:['handovers']});
      await queryClient.invalidateQueries({queryKey:['handovers',id]});
    }catch(cause){alert(cause instanceof Error?cause.message:'Không thể cập nhật bàn giao')}
  }

  return <div className="handover-detail-page">
    <header className="inner-page-title"><button type="button" onClick={()=>router.back()}>‹</button><div><h1>Tóm tắt bàn giao</h1><p>{data.code}</p></div><span className={`status-pill status-${data.status.toLowerCase()}`}>{statusLabels[data.status]??data.status}</span></header>

    <section className="summary-panel"><span>TỔNG QUAN CA</span><h2>{data.notes||'Bàn giao ca lễ tân'}</h2><div><small>Ngày giao ca</small><strong>{data.createdAt?new Intl.DateTimeFormat('vi-VN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(data.createdAt)):'Chưa cập nhật'}</strong></div></section>

    <section className="handover-section summary-people"><h2>Người giao → Người nhận</h2><div className="people-flow"><div><span className="person-avatar">A25</span><strong>{giver?.user.fullName||'Người giao'}</strong><small>Người giao</small></div><b>→</b><div><span className="person-avatar blue-avatar">A25</span><strong>{receiver?.user.fullName||'Người nhận'}</strong><small>Người nhận</small></div></div></section>

    {finance&&<section className="handover-section detail-block"><div className="section-number">I</div><h2>Tài chính – quỹ</h2>{financeData&&financeSummary?<><div className="fixed-fund-summary"><span>Quỹ cố định đầu ca</span><strong>{formatMoney(financeData.fixedFund)} ₫</strong></div><div className="finance-detail-list">{financeData.entries.length?financeData.entries.map((entry,index)=><article key={index}><div><span className={entry.type==='INCOME'?'income-badge':'expense-badge'}>{entry.type==='INCOME'?'Thu':'Chi'}</span><strong>{entry.content||'Khoản phát sinh'}</strong><small>{entry.paymentMethod==='CASH'?'Tiền mặt':'Chuyển khoản'}</small></div><b className={entry.type==='INCOME'?'income-text':'expense-text'}>{entry.type==='INCOME'?'+':'−'}{formatMoney(entry.amount)} ₫</b>{entry.reason&&<p><span>Lý do:</span> {entry.reason}</p>}</article>):<p className="section-note">Không có khoản thu hoặc chi phát sinh.</p>}</div><div className="detail-finance-totals"><div><span>Tổng thu</span><strong className="income-text">{formatMoney(financeSummary.totalIncome)} ₫</strong></div><div><span>Tổng chi</span><strong className="expense-text">{formatMoney(financeSummary.totalExpense)} ₫</strong></div><div><span>Tiền mặt phát sinh</span><strong>{formatMoney(financeSummary.cashTotal)} ₫</strong></div><div><span>Chuyển khoản phát sinh</span><strong>{formatMoney(financeSummary.transferTotal)} ₫</strong></div><div><span>Dư cuối</span><strong>{formatMoney(financeSummary.endingBalance)} ₫</strong></div></div></>:<div className="detail-lines">{finance.details.split('\n').map((line,index)=>{const[label,...rest]=line.split(':');return <div key={index}><span>{label}</span><strong>{rest.join(':').trim()} ₫</strong></div>})}</div>}</section>}

    {hotel&&<section className="handover-section detail-block"><div className="section-number">II</div><h2>Tình hình khách sạn</h2><div className="detail-lines hotel-lines">{hotel.details.split('\n').map((line,index)=>{const[label,...rest]=line.split(':');return <div key={index}><span>{label}</span><strong>{rest.join(':').trim()}</strong></div>})}</div></section>}

    <section className="handover-section detail-block"><div className="section-number">III</div><h2>Công việc bàn giao</h2>{tasks.length?<div className="task-summary-list">{tasks.map(task=><article key={task.id}><div><span>{task.priority==='URGENT'?'Khẩn cấp':task.priority==='HIGH'?'Ưu tiên cao':'Trung bình'}</span><strong>{task.title}</strong>{task.roomNumber&&<small>Phòng {task.roomNumber}</small>}</div><p>{task.details}</p><i>✓</i></article>)}</div>:<p className="section-note">Không có công việc phát sinh cần chuyển tiếp.</p>}</section>

    <section className="handover-section signature-section"><div className="section-number">IV</div><h2>Ký nhận bàn giao</h2><div className="signature-grid"><article><small>NGƯỜI GIAO</small><strong>{giver?.user.fullName||'Người giao'}</strong><div className="signature-mark">{giver?.user.fullName?.split(' ').slice(-1)[0]||'A25'}</div><span>Đã lập phiếu</span></article><article><small>NGƯỜI NHẬN</small><strong>{receiver?.user.fullName||'Người nhận'}</strong>{receiver?.confirmedAt||data.status==='CONFIRMED'?<><div className="signature-mark">{receiver?.user.fullName?.split(' ').slice(-1)[0]||'A25'}</div><span>Đã xác nhận</span></>:<div className="signature-empty">Chờ ký nhận</div>}</article></div></section>

    <div className="handover-detail-actions">{data.status==='DRAFT'&&<button onClick={()=>void act('submit')}>Gửi bàn giao</button>}{['PENDING_RECEIVER_CONFIRMATION','OVERDUE'].includes(data.status)&&<><button onClick={()=>void act('confirm')}>Xác nhận đã nhận ca</button><button className="secondary" onClick={()=>void act('supplement')}>Yêu cầu bổ sung</button></>}{data.status==='SUPPLEMENT_REQUESTED'&&<button onClick={()=>void act('submit')}>Gửi lại bàn giao</button>}</div>
  </div>;
}

export default function Detail(){return <Suspense fallback={<div className="ops-loading"><i/></div>}><DetailContent/></Suspense>}
