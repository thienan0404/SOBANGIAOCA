'use client';

import {Suspense,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {useQueryClient} from '@tanstack/react-query';
import {handoverApi,useHandover,type HandoverParticipant} from '@/features/handovers';
import {financeTotals,formatMoney,parseFinance,type FinanceEntry} from '@/features/handovers/lib/finance';

type SignMode='giver'|'receiver'|'supplement'|'management'|'accounting';
const statusLabels:Record<string,string>={
  DRAFT:'Bản nháp',
  SUBMITTED:'Đã gửi',
  PENDING_RECEIVER_CONFIRMATION:'Chờ người nhận kiểm kê và ký',
  PENDING_MANAGEMENT_APPROVAL:'Chờ BGĐ cơ sở ký',
  PENDING_ACCOUNTING_APPROVAL:'Chờ kế toán ký',
  SUPPLEMENT_REQUESTED:'Cần bổ sung',
  RESUBMITTED:'Đã gửi lại',
  CONFIRMED:'Người nhận đã ký',
  COMPLETED:'Đã khóa và lưu trữ',
  CANCELLED:'Đã hủy',
  OVERDUE:'Quá hạn'
};
const roleLabels:Record<string,string>={
  GIVER:'Người giao',
  RECEIVER:'Người nhận',
  SUPERVISOR:'BGĐ / Phó BGĐ cơ sở',
  APPROVER:'Kế toán'
};
const checklistLabels:Record<string,string>={
  GUEST_NOTES:'Thông tin khách và công việc',
  CASH:'Tiền mặt, thu và chi',
  KEYS:'Chìa khóa và tài sản quầy'
};

function SignatureCard({type,participant}:{
  type:'GIVER'|'RECEIVER'|'SUPERVISOR'|'APPROVER';
  participant:HandoverParticipant|undefined;
}){
  return <article className={participant?.confirmedAt?'signed':'waiting'}>
    <small>{roleLabels[type]}</small>
    <strong>{participant?.user.fullName||'Chưa phân công'}</strong>
    {participant?.confirmedAt?<><div className="signature-mark">{participant.signatureText||participant.user.fullName}</div><span>Đã ký · {new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short'}).format(new Date(participant.confirmedAt))}</span></>:<div className="signature-empty">Chờ ký xác nhận</div>}
  </article>;
}

function DetailContent(){
  const router=useRouter();
  const id=useSearchParams().get('id')??'';
  const queryClient=useQueryClient();
  const{data,isLoading,error,refetch,isFetching}=useHandover(id);
  const[signMode,setSignMode]=useState<SignMode|null>(null);
  const[signatureText,setSignatureText]=useState('');
  const[username,setUsername]=useState('');
  const[password,setPassword]=useState('');
  const[supplementReason,setSupplementReason]=useState('');
  const[inventoryConfirmed,setInventoryConfirmed]=useState(false);
  const[actionError,setActionError]=useState('');
  const[actionPending,setActionPending]=useState(false);

  if(!id)return <div className="empty">Thiếu mã phiếu bàn giao</div>;
  if(isLoading)return <div className="ops-loading"><i/><p>Đang tải phiếu bàn giao...</p></div>;
  if(error||!data)return <div className="empty error-state"><div className="empty-icon">!</div><strong>Chưa tải được báo cáo bàn giao</strong><p>{error instanceof Error?error.message:'Vui lòng kiểm tra kết nối và thử lại.'}</p><button disabled={isFetching} onClick={()=>void refetch()}>{isFetching?'Đang tải lại...':'Thử lại'}</button></div>;

  const finance=data.items?.find(item=>item.category==='FINANCE');
  const financeData=finance?parseFinance(finance.details):null;
  const financeEntries:FinanceEntry[]=financeData?.entries.map((item,index)=>({...item,id:String(index),amount:String(item.amount)}))??[];
  const financeSummary=financeData?financeTotals(String(financeData.fixedFund),financeEntries):null;
  const hotel=data.items?.find(item=>item.category==='HOTEL_STATUS');
  const tasks=data.items?.filter(item=>item.category==='TASK')??[];
  const participant=(type:string)=>data.participants?.find(item=>item.participantType===type);
  const giver=participant('GIVER');
  const receiver=participant('RECEIVER');
  const supervisor=participant('SUPERVISOR');
  const approver=participant('APPROVER');
  const inventory=data.checklistResults??[];

  function openSign(mode:SignMode){
    setActionError('');
    setSignMode(mode);
    setSignatureText(mode==='receiver'?'':localStorage.getItem('a25.employeeName')||'');
    setUsername('');
    setPassword('');
    setSupplementReason('');
    setInventoryConfirmed(false);
  }

  async function refresh(){
    await queryClient.invalidateQueries({queryKey:['handovers']});
    await queryClient.invalidateQueries({queryKey:['handovers',id]});
  }

  async function sign(){
    if(!signMode)return;
    if(signMode!=='supplement'&&!signatureText.trim())return setActionError('Vui lòng nhập đầy đủ họ tên để ký xác nhận');
    if(signMode==='receiver'&&(!username.trim()||!password||!inventoryConfirmed))
      return setActionError('Người nhận phải đăng nhập và xác nhận đã cùng kiểm kê');
    if(signMode==='supplement'&&(!username.trim()||!password||supplementReason.trim().length<3))
      return setActionError('Vui lòng đăng nhập người nhận và nhập nội dung cần bổ sung');
    setActionPending(true);
    setActionError('');
    try{
      if(signMode==='giver')await handoverApi.submit(id,signatureText);
      if(signMode==='receiver'){
        const result=await handoverApi.receiverSign(id,{username:username.trim(),password,signatureText,inventoryConfirmed:true});
        localStorage.setItem('a25.workSessionId',result.workSession.id);
        localStorage.setItem('a25.branchId',result.workSession.branchId);
        localStorage.setItem('a25.employeeName',result.employee.fullName);
        localStorage.setItem('a25.employeeCode',result.employee.employeeCode??'');
      }
      if(signMode==='supplement')await handoverApi.receiverRequestSupplement(id,{username:username.trim(),password,reason:supplementReason.trim()});
      if(signMode==='management')await handoverApi.managementSign(id,signatureText);
      if(signMode==='accounting')await handoverApi.accountingSign(id,signatureText);
      setSignMode(null);
      await refresh();
    }catch(cause){setActionError(cause instanceof Error?cause.message:'Không thể ký xác nhận')}
    finally{setActionPending(false)}
  }

  return <div className="handover-detail-page">
    <header className="inner-page-title"><button type="button" onClick={()=>router.back()}>‹</button><div><h1>Tóm tắt bàn giao</h1><p>{data.code}</p></div><span className={`status-pill status-${data.status.toLowerCase()}`}>{statusLabels[data.status]??data.status}</span></header>

    <section className="handover-workflow" aria-label="Tiến độ phê duyệt">
      {[
        ['Người giao',Boolean(giver?.confirmedAt)],
        ['Người nhận',Boolean(receiver?.confirmedAt)],
        ['BGĐ cơ sở',Boolean(supervisor?.confirmedAt)],
        ['Kế toán',Boolean(approver?.confirmedAt)]
      ].map(([label,done],index)=><div className={done?'done':''} key={String(label)}><i>{done?'✓':index+1}</i><span>{label}</span></div>)}
    </section>

    {data.lockedAt&&<section className="locked-notice"><b>✓</b><div><strong>Phiếu đã đủ 4 chữ ký và được khóa</strong><span>Dữ liệu được lưu trữ bất biến; mọi hành động đã ghi vào nhật ký kiểm toán.</span></div></section>}

    <section className="summary-panel"><span>TỔNG QUAN CA</span><h2>{data.notes||'Bàn giao ca lễ tân'}</h2><div><small>Ngày giao ca</small><strong>{data.createdAt?new Intl.DateTimeFormat('vi-VN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(data.createdAt)):'Chưa cập nhật'}</strong></div></section>

    <section className="handover-section summary-people"><h2>Người giao → Người nhận</h2><div className="people-flow"><div><span className="person-avatar">A25</span><strong>{giver?.user.fullName||'Người giao'}</strong><small>Người giao</small></div><b>→</b><div><span className="person-avatar blue-avatar">A25</span><strong>{receiver?.user.fullName||'Người nhận'}</strong><small>Người nhận</small></div></div></section>

    {finance&&<section className="handover-section detail-block"><div className="section-number">I</div><h2>Tài chính – quỹ</h2>{financeData&&financeSummary?<><div className="fixed-fund-summary"><span>Quỹ cố định đầu ca</span><strong>{formatMoney(financeData.fixedFund)} ₫</strong></div><div className="finance-detail-list">{financeData.entries.length?financeData.entries.map((entry,index)=><article key={index}><div><span className={entry.type==='INCOME'?'income-badge':'expense-badge'}>{entry.type==='INCOME'?'Thu':'Chi'}</span><strong>{entry.content||'Khoản phát sinh'}</strong><small>{entry.paymentMethod==='CASH'?'Tiền mặt':'Chuyển khoản'}</small></div><b className={entry.type==='INCOME'?'income-text':'expense-text'}>{entry.type==='INCOME'?'+':'−'}{formatMoney(entry.amount)} ₫</b>{entry.reason&&<p><span>Lý do:</span> {entry.reason}</p>}</article>):<p className="section-note">Không có khoản thu hoặc chi phát sinh.</p>}</div><div className="detail-finance-totals"><div><span>Tổng thu</span><strong className="income-text">{formatMoney(financeSummary.totalIncome)} ₫</strong></div><div><span>Tổng chi</span><strong className="expense-text">{formatMoney(financeSummary.totalExpense)} ₫</strong></div><div><span>Tiền mặt phát sinh</span><strong>{formatMoney(financeSummary.cashTotal)} ₫</strong></div><div><span>Chuyển khoản phát sinh</span><strong>{formatMoney(financeSummary.transferTotal)} ₫</strong></div><div><span>Dư cuối</span><strong>{formatMoney(financeSummary.endingBalance)} ₫</strong></div></div></>:<div className="detail-lines">{finance.details.split('\n').map((line,index)=>{const[label,...rest]=line.split(':');return <div key={index}><span>{label}</span><strong>{rest.join(':').trim()} ₫</strong></div>})}</div>}</section>}

    {hotel&&<section className="handover-section detail-block"><div className="section-number">II</div><h2>Tình hình khách sạn</h2><div className="detail-lines hotel-lines">{hotel.details.split('\n').map((line,index)=>{const[label,...rest]=line.split(':');return <div key={index}><span>{label}</span><strong>{rest.join(':').trim()}</strong></div>})}</div></section>}

    <section className="handover-section detail-block"><div className="section-number">III</div><h2>Công việc bàn giao</h2>{tasks.length?<div className="task-summary-list">{tasks.map(task=><article key={task.id}><div><span>{task.priority==='URGENT'?'Khẩn cấp':task.priority==='HIGH'?'Ưu tiên cao':'Trung bình'}</span><strong>{task.title}</strong>{task.roomNumber&&<small>Phòng {task.roomNumber}</small>}</div><p>{task.details}</p><i>✓</i></article>)}</div>:<p className="section-note">Không có công việc phát sinh cần chuyển tiếp.</p>}</section>

    <section className="handover-section inventory-section"><div className="section-number">IV</div><h2>Kiểm kê hai bên</h2><p className="section-note">Người giao kiểm kê khi lập phiếu; người nhận đối chiếu lại trước khi ký.</p><div>{inventory.map(item=><article key={item.itemCode}><span>{checklistLabels[item.itemCode]||item.itemCode}</span><b>{item.isCompleted?'Người giao ✓':'Chưa kiểm'}</b><b>{item.receiverCheckedAt?'Người nhận ✓':'Chờ người nhận'}</b></article>)}</div></section>

    <section className="handover-section signature-section"><div className="section-number">V</div><h2>Chữ ký phê duyệt</h2><div className="signature-grid four-signatures"><SignatureCard type="GIVER" participant={giver}/><SignatureCard type="RECEIVER" participant={receiver}/><SignatureCard type="SUPERVISOR" participant={supervisor}/><SignatureCard type="APPROVER" participant={approver}/></div></section>

    <div className="handover-detail-actions">
      {['DRAFT','SUPPLEMENT_REQUESTED','RESUBMITTED'].includes(data.status)&&<button onClick={()=>openSign('giver')}>Người giao ký và gửi phiếu</button>}
      {['PENDING_RECEIVER_CONFIRMATION','OVERDUE'].includes(data.status)&&<><button onClick={()=>openSign('receiver')}>Người nhận đăng nhập, kiểm kê và ký</button><button className="secondary" onClick={()=>openSign('supplement')}>Yêu cầu bổ sung</button></>}
      {data.status==='PENDING_MANAGEMENT_APPROVAL'&&<button onClick={()=>openSign('management')}>BGĐ / Phó BGĐ cơ sở ký duyệt</button>}
      {data.status==='PENDING_ACCOUNTING_APPROVAL'&&<button onClick={()=>openSign('accounting')}>Kế toán kiểm tra và ký khóa phiếu</button>}
    </div>

    {signMode&&<div className="sign-dialog-backdrop" role="presentation" onMouseDown={event=>{if(event.currentTarget===event.target&&!actionPending)setSignMode(null)}}>
      <section className="sign-dialog" role="dialog" aria-modal="true" aria-labelledby="sign-title">
        <button className="dialog-close" disabled={actionPending} onClick={()=>setSignMode(null)}>×</button>
        <span className="dialog-eyebrow">XÁC THỰC CHỮ KÝ</span>
        <h2 id="sign-title">{signMode==='giver'?'Người giao ký phiếu':signMode==='receiver'?'Người nhận kiểm kê và ký':signMode==='supplement'?'Người nhận yêu cầu bổ sung':signMode==='management'?'BGĐ cơ sở ký duyệt':'Kế toán ký và khóa phiếu'}</h2>
        <p>Chữ ký được gắn với tài khoản, thời gian và nhật ký kiểm toán.</p>
        {(signMode==='receiver'||signMode==='supplement')&&<><label>Tài khoản người nhận<input value={username} autoComplete="username" onChange={event=>setUsername(event.target.value)} placeholder="Nhập tài khoản nhân viên"/></label><label>Mật khẩu<input type="password" value={password} autoComplete="current-password" onChange={event=>setPassword(event.target.value)} placeholder="Nhập mật khẩu"/></label></>}
        {signMode==='receiver'&&<label className="inventory-confirm"><input type="checkbox" checked={inventoryConfirmed} onChange={event=>setInventoryConfirmed(event.target.checked)}/><span>Tôi và người giao đã cùng đối chiếu tiền/quỹ, tài sản quầy và toàn bộ nội dung bàn giao.</span></label>}
        {signMode==='supplement'?<label>Nội dung cần bổ sung<input value={supplementReason} onChange={event=>setSupplementReason(event.target.value)} placeholder="Nêu rõ nội dung người giao cần cập nhật"/></label>:<label>Họ và tên người ký<input value={signatureText} onChange={event=>setSignatureText(event.target.value)} placeholder="Nhập đúng họ tên trên tài khoản"/></label>}
        {actionError&&<div className="dialog-error">! {actionError}</div>}
        <button className="dialog-submit" disabled={actionPending} onClick={()=>void sign()}>{actionPending?'Đang xác thực...':signMode==='receiver'?'Ký và chuyển phiên làm việc':signMode==='supplement'?'Gửi yêu cầu bổ sung':'Xác nhận chữ ký'}</button>
      </section>
    </div>}
  </div>;
}

export default function Detail(){return <Suspense fallback={<div className="ops-loading"><i/></div>}><DetailContent/></Suspense>}
