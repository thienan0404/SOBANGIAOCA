'use client';

import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {handoverApi,type EmployeeOption,type ShiftOption} from '../api/handovers';
import {useCreateHandover} from '../hooks/use-handovers';
import {emptyFinanceEntry,financeTotals,formatMoney,formatMoneyInput,serializeFinance,type FinanceEntry} from '../lib/finance';

type Task={title:string;details:string;priority:'LOW'|'NORMAL'|'HIGH'|'URGENT';roomNumber:string};
type Hotel={minibar:string;keys:string;phone:string;vacantRooms:string;occupiedRooms:string;stayingGuests:string;guestNotes:string;lostFound:string;incidents:string};
const emptyTask:Task={title:'',details:'',priority:'NORMAL',roomNumber:''};

export function CreateHandoverForm(){
  const router=useRouter();
  const mutation=useCreateHandover();
  const[branchId,setBranchId]=useState('');
  const[branchName,setBranchName]=useState('Chi nhánh');
  const[shift,setShift]=useState<ShiftOption|null>(null);
  const[employees,setEmployees]=useState<EmployeeOption[]>([]);
  const[receiverId,setReceiverId]=useState('');
  const[giverName,setGiverName]=useState('Nhân viên lễ tân');
  const[tasks,setTasks]=useState<Task[]>([{...emptyTask}]);
  const[fixedFund,setFixedFund]=useState('');
  const[financeEntries,setFinanceEntries]=useState<FinanceEntry[]>([emptyFinanceEntry()]);
  const[hotel,setHotel]=useState<Hotel>({minibar:'Đủ',keys:'Đủ',phone:'Đủ',vacantRooms:'',occupiedRooms:'',stayingGuests:'',guestNotes:'Không',lostFound:'Không',incidents:''});
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');

  useEffect(()=>{
    let active=true;
    void(async()=>{
      try{
        const device=JSON.parse(localStorage.getItem('a25.currentBranchDevice')??'null');
        const id=localStorage.getItem('a25.branchId')||device?.branch?.id||'';
        if(!id)throw new Error('Thiết bị chưa có thông tin chi nhánh');
        setBranchId(id);setBranchName(device?.branch?.name||'Chi nhánh đang làm việc');setGiverName(localStorage.getItem('a25.employeeName')||'Nhân viên lễ tân');
        const[staff,currentShift]=await Promise.all([handoverApi.employees(id),handoverApi.currentShift(id)]);
        if(!active)return;
        const currentCode=localStorage.getItem('a25.employeeCode');
        const receivers=staff.filter(item=>!currentCode||item.employeeCode!==currentCode);
        setEmployees(receivers);setReceiverId(receivers[0]?.id??'');setShift(currentShift);
      }catch(cause){if(active)setError(cause instanceof Error?cause.message:'Không thể tải dữ liệu ca')}
      finally{if(active)setLoading(false)}
    })();
    return()=>{active=false};
  },[]);

  const totals=useMemo(()=>financeTotals(fixedFund,financeEntries),[fixedFund,financeEntries]);

  async function submit(){
    if(!branchId||!shift?.id){setError('Không tìm thấy ca làm việc đang hoạt động');return}
    if(!receiverId){setError('Vui lòng chọn nhân viên nhận bàn giao');return}
    const incompleteFinanceEntry=financeEntries.find(item=>(item.content.trim()||item.amount.trim()||item.reason.trim())&&(!item.content.trim()||!item.amount.trim()||!item.reason.trim()));
    if(incompleteFinanceEntry){setError('Vui lòng nhập đủ nội dung, số tiền và lý do cho từng khoản thu hoặc chi');return}
    const workItems=tasks.filter(item=>item.title.trim()&&item.details.trim());
    setError('');
    try{
      const result=await mutation.mutateAsync({
        branchId,shiftInstanceId:shift.id,receiverId,
        notes:`Bàn giao ${shift.shiftCode} tại ${branchName}`,
        items:[
          {title:'Tài chính - quỹ',details:serializeFinance(fixedFund,financeEntries),category:'FINANCE',priority:'HIGH'},
          {title:'Tình hình khách sạn',details:[`Kho minibar: ${hotel.minibar}`,`Kho ký gửi: ${hotel.keys}`,`Sạc điện thoại/đàm: ${hotel.phone}`,`Phòng trống: ${hotel.vacantRooms||'0'}`,`Phòng có khách: ${hotel.occupiedRooms||'0'}`,`Khách lưu trú: ${hotel.stayingGuests||'0'}`,`Khách cần lưu ý: ${hotel.guestNotes||'Không'}`,`Tài sản khách: ${hotel.lostFound||'Không'}`,`Phát sinh khác: ${hotel.incidents||'Không'}`].join('\n'),category:'HOTEL_STATUS',priority:'NORMAL'},
          ...workItems.map(item=>({title:item.title,details:item.details,category:'TASK',priority:item.priority,roomNumber:item.roomNumber||undefined}))
        ]
      });
      await Promise.all(['GUEST_NOTES','CASH','KEYS'].map(code=>handoverApi.check(result.id,code)));
      router.push(`/handovers/detail?id=${result.id}`);
    }catch(cause){setError(cause instanceof Error?cause.message:'Không thể tạo phiếu bàn giao')}
  }

  if(loading)return <div className="ops-loading"><i/><p>Đang chuẩn bị biểu mẫu ca...</p></div>;
  return <div className="handover-form-page">
    <header className="inner-page-title"><button type="button" onClick={()=>router.back()}>‹</button><div><h1>Giao ca lễ tân</h1><p>{shift?.shiftCode??'Ca hiện tại'} · {branchName}</p></div></header>

    <section className="handover-meta-card"><div><span>⌂</span><small>CHI NHÁNH</small><strong>{branchName}</strong></div><div><span>▣</span><small>CA LÀM VIỆC</small><strong>{shift?`${new Date(shift.startsAt).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})} – ${new Date(shift.endsAt).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}`:'Chưa có ca phù hợp'}</strong></div></section>

    <section className="handover-section participants-section"><h2>Người giao và người nhận</h2><div className="person-row"><span className="person-avatar">A25</span><div><small>NGƯỜI GIAO</small><strong>{giverName}</strong><p>Lễ tân đang trực</p></div><i className="online-dot"/></div><label>Người nhận bàn giao<select value={receiverId} onChange={event=>setReceiverId(event.target.value)}><option value="">Chọn nhân viên ca sau</option>{employees.map(item=><option value={item.id} key={item.id}>{item.employeeCode?`${item.employeeCode} · `:''}{item.fullName}</option>)}</select></label></section>

    <section className="handover-section finance-section">
      <div className="section-number">I</div><h2>Tài chính – quỹ</h2>
      <p className="section-note">Ghi rõ từng khoản thu, chi, số tiền và lý do phát sinh.</p>
      <label className="fixed-fund-field">Quỹ cố định đầu ca<div className="money-input"><input inputMode="numeric" value={fixedFund} onChange={event=>setFixedFund(formatMoneyInput(event.target.value))} placeholder="0"/><span>₫</span></div></label>
      <div className="finance-entry-list">{financeEntries.map((entry,index)=><article className={`finance-entry ${entry.type==='INCOME'?'income':'expense'}`} key={entry.id}>
        <div className="finance-entry-head"><strong>Khoản phát sinh {index+1}</strong>{financeEntries.length>1&&<button type="button" aria-label={`Xóa khoản ${index+1}`} onClick={()=>setFinanceEntries(items=>items.filter(item=>item.id!==entry.id))}>×</button>}</div>
        <div className="finance-entry-grid"><label>Loại<select value={entry.type} onChange={event=>setFinanceEntries(items=>items.map(item=>item.id===entry.id?{...item,type:event.target.value as FinanceEntry['type']}:item))}><option value="INCOME">Thu</option><option value="EXPENSE">Chi</option></select></label><label>Hình thức<select value={entry.paymentMethod} onChange={event=>setFinanceEntries(items=>items.map(item=>item.id===entry.id?{...item,paymentMethod:event.target.value as FinanceEntry['paymentMethod']}:item))}><option value="CASH">Tiền mặt</option><option value="TRANSFER">Chuyển khoản</option></select></label></div>
        <label>Nội dung<input value={entry.content} onChange={event=>setFinanceEntries(items=>items.map(item=>item.id===entry.id?{...item,content:event.target.value}:item))} placeholder={entry.type==='INCOME'?'Ví dụ: Thu tiền phòng':'Ví dụ: Mua văn phòng phẩm'}/></label>
        <label>Số tiền<div className="money-input"><input inputMode="numeric" value={entry.amount} onChange={event=>setFinanceEntries(items=>items.map(item=>item.id===entry.id?{...item,amount:formatMoneyInput(event.target.value)}:item))} placeholder="0"/><span>₫</span></div></label>
        <label>Lý do<textarea value={entry.reason} onChange={event=>setFinanceEntries(items=>items.map(item=>item.id===entry.id?{...item,reason:event.target.value}:item))} placeholder="Nêu rõ lý do thu hoặc chi"/></label>
      </article>)}</div>
      <button type="button" className="outline-add finance-add" disabled={financeEntries.length>=12} onClick={()=>setFinanceEntries(items=>[...items,emptyFinanceEntry()])}>＋ Thêm khoản thu / chi</button>
      <div className="finance-totals"><div><span>Tổng thu</span><strong className="income-text">{formatMoney(totals.totalIncome)} ₫</strong></div><div><span>Tổng chi</span><strong className="expense-text">{formatMoney(totals.totalExpense)} ₫</strong></div><div><span>Tiền mặt phát sinh</span><strong>{formatMoney(totals.cashTotal)} ₫</strong></div><div><span>Chuyển khoản phát sinh</span><strong>{formatMoney(totals.transferTotal)} ₫</strong></div><div className="ending-balance"><span>Dư cuối dự kiến</span><strong>{formatMoney(totals.endingBalance)} ₫</strong></div></div>
    </section>

    <section className="handover-section"><div className="section-number">II</div><h2>Kho lễ tân</h2><div className="compact-fields">{([['minibar','Kho minibar'],['keys','Kho ký gửi'],['phone','Sạc điện thoại, đàm']] as Array<[keyof Hotel,string]>).map(([key,label])=><label key={key}>{label}<select value={hotel[key]} onChange={event=>setHotel(value=>({...value,[key]:event.target.value}))}><option>Đủ</option><option>Thiếu</option><option>Thừa</option><option>Cần kiểm tra</option></select></label>)}</div></section>

    <section className="handover-section"><div className="section-number">III</div><h2>Tình hình khách sạn</h2><div className="hotel-stats"><label>Phòng có khách<input inputMode="numeric" value={hotel.occupiedRooms} onChange={event=>setHotel(value=>({...value,occupiedRooms:event.target.value}))} placeholder="0"/></label><label>Phòng trống<input inputMode="numeric" value={hotel.vacantRooms} onChange={event=>setHotel(value=>({...value,vacantRooms:event.target.value}))} placeholder="0"/></label><label>Khách lưu trú<input inputMode="numeric" value={hotel.stayingGuests} onChange={event=>setHotel(value=>({...value,stayingGuests:event.target.value}))} placeholder="0"/></label></div><label>Khách cần lưu ý<textarea value={hotel.guestNotes} onChange={event=>setHotel(value=>({...value,guestNotes:event.target.value}))}/></label><label>Tài sản khách để quên / ký gửi<textarea value={hotel.lostFound} onChange={event=>setHotel(value=>({...value,lostFound:event.target.value}))}/></label><label>Phát sinh khác<textarea value={hotel.incidents} onChange={event=>setHotel(value=>({...value,incidents:event.target.value}))} placeholder="Yêu cầu khách, báo thức, sự cố kỹ thuật..."/></label></section>

    <section className="handover-section"><div className="section-number">IV</div><h2>Công việc bàn giao khác</h2><div className="task-editor">{tasks.map((task,index)=><article key={index}><div className="task-head"><strong>Công việc {index+1}</strong>{tasks.length>1&&<button type="button" onClick={()=>setTasks(items=>items.filter((_,i)=>i!==index))}>×</button>}</div><input value={task.title} onChange={event=>setTasks(items=>items.map((item,i)=>i===index?{...item,title:event.target.value}:item))} placeholder="Tên công việc"/><textarea value={task.details} onChange={event=>setTasks(items=>items.map((item,i)=>i===index?{...item,details:event.target.value}:item))} placeholder="Nội dung cần ca sau tiếp tục..."/><div className="task-options"><input value={task.roomNumber} onChange={event=>setTasks(items=>items.map((item,i)=>i===index?{...item,roomNumber:event.target.value}:item))} placeholder="Phòng (nếu có)"/><select value={task.priority} onChange={event=>setTasks(items=>items.map((item,i)=>i===index?{...item,priority:event.target.value as Task['priority']}:item))}><option value="LOW">Thấp</option><option value="NORMAL">Trung bình</option><option value="HIGH">Cao</option><option value="URGENT">Khẩn cấp</option></select></div></article>)}</div><button type="button" className="outline-add" onClick={()=>setTasks(items=>[...items,{...emptyTask}])}>＋ Thêm công việc</button></section>

    {error&&<p className="handover-form-error" role="alert">! {error}</p>}
    <button type="button" className="handover-submit" disabled={mutation.isPending} onClick={()=>void submit()}>{mutation.isPending?'Đang lưu bàn giao...':'Tiếp tục xem tóm tắt'}</button>
  </div>;
}
