'use client';
import {useMemo,useState} from 'react';
import {useHandovers} from '../hooks/use-handovers';
import {HandoverStatus} from '@a25/contracts';
import Link from 'next/link';
import type {RoleGroup} from '@/lib/employee-role';

const labels:Record<HandoverStatus,string>={DRAFT:'Bản nháp',SUBMITTED:'Đã gửi',PENDING_RECEIVER_CONFIRMATION:'Chờ người nhận',PENDING_MANAGEMENT_APPROVAL:'Chờ BGĐ cơ sở',PENDING_ACCOUNTING_APPROVAL:'Chờ kế toán',MANAGEMENT_CHANGES_REQUESTED:'BGĐ trả lại',ACCOUNTING_CHANGES_REQUESTED:'Kế toán trả lại',SUPPLEMENT_REQUESTED:'Cần bổ sung',RESUBMITTED:'Đã gửi lại',CONFIRMED:'Đã xác nhận',COMPLETED:'Đã khóa',CANCELLED:'Đã hủy',OVERDUE:'Quá hạn'};

type Person={id:string;name:string};
function uniquePeople(people:Person[]){
  return Array.from(new Map(people.filter(person=>person.id).map(person=>[person.id,person])).values()).sort((a,b)=>a.name.localeCompare(b.name,'vi'));
}
function dateInVietnam(value:string){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
  const get=(type:string)=>parts.find(part=>part.type===type)?.value??'';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function formatDate(value:string){
  return new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(new Date(value));
}
function normalizeSearch(value:string){
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('vi').trim();
}

export function HandoverList({view='reception',showFilters=false}:{view?:RoleGroup;showFilters?:boolean}){
  const {data,isLoading,isFetching,error,refetch}=useHandovers();
  const[giverId,setGiverId]=useState('');
  const[receiverId,setReceiverId]=useState('');
  const[handoverDate,setHandoverDate]=useState('');
  const[searchQuery,setSearchQuery]=useState('');
  const roleVisible=useMemo(()=>(data??[]).filter(item=>{
    if(view==='management')return item.status==='PENDING_MANAGEMENT_APPROVAL';
    if(view==='accounting')return item.status==='PENDING_ACCOUNTING_APPROVAL';
    return true;
  }),[data,view]);
  const giverOptions=useMemo(()=>uniquePeople(roleVisible.map(item=>item.giver)),[roleVisible]);
  const receiverOptions=useMemo(()=>uniquePeople(roleVisible.map(item=>item.receiver)),[roleVisible]);
  const visible=useMemo(()=>{
    const query=normalizeSearch(searchQuery);
    return roleVisible.filter(item=>(!giverId||item.giver.id===giverId)&&(!receiverId||item.receiver.id===receiverId)&&(!handoverDate||dateInVietnam(item.createdAt)===handoverDate)&&(!query||normalizeSearch([item.code,item.giver.name,item.receiver.name,item.searchContent].join(' ')).includes(query)));
  },[giverId,handoverDate,receiverId,roleVisible,searchQuery]);
  const hasFilters=Boolean(giverId||receiverId||handoverDate||searchQuery);
  const clearFilters=()=>{setGiverId('');setReceiverId('');setHandoverDate('');setSearchQuery('')};

  if(isLoading)return <div className="handover-skeleton" aria-label="Đang tải"><i/><i/><i/></div>;
  if(error)return <div role="alert" className="empty error-state"><div className="empty-icon">!</div><strong>Chưa thể kết nối dữ liệu</strong><p>{error.message}</p><button disabled={isFetching} onClick={()=>void refetch()}>{isFetching?'Đang thử lại...':'Thử lại'}</button></div>;
  if(!roleVisible.length){
    const title=view==='management'?'Không có phiếu chờ BGĐ duyệt':view==='accounting'?'Không có phiếu chờ kế toán':'Ca trực chưa có bàn giao';
    const description=view==='management'
      ?'Các phiếu đã bàn giao sẽ xuất hiện tại đây để BGĐ cơ sở kiểm tra.'
      :view==='accounting'
        ?'Phiếu đã được BGĐ duyệt sẽ xuất hiện tại đây để nghiệm thu tài chính.'
        :'Mọi công việc đã được xử lý. Tạo phiếu mới khi có nội dung cần chuyển tiếp cho ca sau.';
    return <div className="empty professional-empty"><div className="empty-visual"><span>✓</span><i/><b/></div><strong>{title}</strong><p>{description}</p>{view==='reception'&&<a className="primary-action empty-action" href="/handovers/create"><span>＋</span> Tạo phiếu đầu tiên</a>}<small><i/> Dữ liệu được đồng bộ theo thời gian thực</small></div>;
  }
  return <>
    {showFilters&&<section className="handover-list-filters" aria-label="Lọc danh sách bàn giao">
      <label className="handover-search-field">Tìm nội dung<input type="search" value={searchQuery} onChange={event=>setSearchQuery(event.target.value)} placeholder="Mã phiếu, ghi chú, công việc..." autoComplete="off"/></label>
      <div><label>Người giao<select value={giverId} onChange={event=>setGiverId(event.target.value)}><option value="">Tất cả người giao</option>{giverOptions.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label>Người nhận<select value={receiverId} onChange={event=>setReceiverId(event.target.value)}><option value="">Tất cả người nhận</option>{receiverOptions.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select></label></div>
      <label>Ngày giao ca<input type="date" value={handoverDate} onChange={event=>setHandoverDate(event.target.value)}/></label>
      {hasFilters&&<button type="button" onClick={clearFilters}>Xóa bộ lọc</button>}
    </section>}
    <div className="list-status"><span><i/> Đang đồng bộ</span><b>{visible.length}/{roleVisible.length} phiếu</b></div>
    {!visible.length?<div className="empty filtered-empty"><strong>Không tìm thấy phiếu phù hợp</strong><p>Hãy thay đổi hoặc xóa bộ lọc để xem lại danh sách.</p><button type="button" onClick={clearFilters}>Xóa bộ lọc</button></div>:<div className="card-list">{visible.map(x=><Link className="handover-card amber" href={`/handovers/detail?id=${x.id}`} key={x.id}><div className="card-icon">⇄</div><div className="card-body"><div className="card-title"><h3>{x.code}</h3><span>{labels[x.status]}</span></div><p className="detail">{x.giver?.name??'Người giao'} → {x.receiver?.name??'Người nhận'}</p><small className="handover-card-date">{formatDate(x.createdAt)}</small></div><span className="card-chevron">›</span></Link>)}</div>}
  </>;
}