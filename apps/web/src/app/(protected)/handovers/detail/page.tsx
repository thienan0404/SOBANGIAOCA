'use client';

import {Suspense} from 'react';
import {useSearchParams} from 'next/navigation';
import {useHandover,handoverApi} from '@/features/handovers';
import {useQueryClient} from '@tanstack/react-query';

const statusLabels:Record<string,string>={DRAFT:'Bản nháp',SUBMITTED:'Đã gửi',PENDING_RECEIVER_CONFIRMATION:'Chờ người nhận xác nhận',SUPPLEMENT_REQUESTED:'Cần bổ sung',RESUBMITTED:'Đã gửi lại',CONFIRMED:'Đã xác nhận',COMPLETED:'Hoàn tất',CANCELLED:'Đã hủy',OVERDUE:'Quá hạn'};

function DetailContent(){
  const id=useSearchParams().get('id')??'';
  const queryClient=useQueryClient();
  const {data,isLoading}=useHandover(id);

  if(!id) return <div className="empty">Thiếu mã phiếu bàn giao</div>;
  if(isLoading) return <p>Đang tải...</p>;
  if(!data) return <div className="empty">Không tìm thấy phiếu</div>;

  async function act(action:'submit'|'confirm'|'supplement'){
    if(action==='submit') await handoverApi.submit(id);
    if(action==='confirm') await handoverApi.confirm(id);
    if(action==='supplement'){
      const reason=prompt('Nội dung cần bổ sung');
      if(reason) await handoverApi.requestSupplement(id,reason);
    }
    await queryClient.invalidateQueries({queryKey:['handovers']});
    await queryClient.invalidateQueries({queryKey:['handovers',id]});
  }

  return <><h1>{data.code}</h1><p>Trạng thái: {statusLabels[data.status]??data.status}</p><div className="card-list">{data.items?.map((item:{id:string;title:string;details:string})=><article className="handover-card amber" key={item.id}><div className="card-body"><h3>{item.title}</h3><p>{item.details}</p></div></article>)}</div><div className="detail-actions"><button onClick={()=>act('submit')}>Gửi bàn giao</button><button onClick={()=>act('confirm')}>Xác nhận đã nhận</button><button onClick={()=>act('supplement')}>Yêu cầu bổ sung</button></div></>;
}

export default function Detail(){return <Suspense fallback={<p>Đang tải...</p>}><DetailContent/></Suspense>}