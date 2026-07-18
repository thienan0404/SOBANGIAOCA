'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import type {CurrentBranchDevice} from '@/lib/branch-devices';
import {startWorkSession,verifyEmployee,type EmployeeContext,type ShiftAssignment} from '@/lib/employee-auth';

type Step='identity'|'shift';
type DetectorResult={rawValue:string};
type Detector={detect(source:HTMLVideoElement):Promise<DetectorResult[]>};
type DetectorConstructor=new(options:{formats:string[]})=>Detector;

function formatShift(value:string){
  return new Intl.DateTimeFormat('vi-VN',{hour:'2-digit',minute:'2-digit'}).format(new Date(value));
}
function assignmentLabel(value:string){
  return({RECEPTIONIST:'Lễ tân',SHIFT_LEADER:'Trưởng ca',SUPERVISOR:'Giám sát'} as Record<string,string>)[value]??value;
}

export function EmployeeLoginForm({device}:{device:CurrentBranchDevice}){
  const[step,setStep]=useState<Step>('identity');
  const[identifier,setIdentifier]=useState('');
  const[employeeContext,setEmployeeContext]=useState<EmployeeContext|null>(null);
  const[error,setError]=useState('');
  const[loading,setLoading]=useState(false);
  const[scanning,setScanning]=useState(false);
  const videoRef=useRef<HTMLVideoElement>(null);

  const loadEmployee=useCallback(async(value:string)=>{
    const code=value.trim();
    if(code.length<3){setError('Vui lòng nhập hoặc quét mã nhân viên');return}
    setLoading(true);setError('');
    try{
      const context=await verifyEmployee(code);
      setIdentifier(code);
      setEmployeeContext(context);
      setStep('shift');
    }catch(cause){setError(cause instanceof Error?cause.message:'Không thể xác thực nhân viên')}
    finally{setLoading(false)}
  },[]);

  useEffect(()=>{
    if(!scanning)return;
    let stopped=false;
    let stream:MediaStream|undefined;
    let frame=0;
    const stop=()=>{stopped=true;cancelAnimationFrame(frame);stream?.getTracks().forEach(track=>track.stop())};
    void(async()=>{
      try{
        const DetectorClass=(window as unknown as {BarcodeDetector?:DetectorConstructor}).BarcodeDetector;
        if(!DetectorClass)throw new Error('Trình duyệt chưa hỗ trợ quét QR. Vui lòng nhập mã nhân viên.');
        stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});
        if(!videoRef.current)return;
        videoRef.current.srcObject=stream;
        await videoRef.current.play();
        const detector=new DetectorClass({formats:['qr_code']});
        const scan=async()=>{
          if(stopped||!videoRef.current)return;
          const codes=await detector.detect(videoRef.current);
          if(codes[0]?.rawValue){
            const code=codes[0].rawValue;
            setIdentifier(code);setScanning(false);stop();
            await loadEmployee(code);
            return;
          }
          frame=requestAnimationFrame(()=>void scan());
        };
        await scan();
      }catch(cause){
        setError(cause instanceof Error?cause.message:'Không thể mở camera');setScanning(false);stop();
      }
    })();
    return stop;
  },[scanning,loadEmployee]);

  async function confirmShift(assignment:ShiftAssignment){
    setLoading(true);setError('');
    try{
      const session=await startWorkSession(identifier,assignment.shift.id);
      localStorage.setItem('a25.workSessionId',session.id);
      localStorage.setItem('a25.branchId',session.branchId);
      localStorage.setItem('a25.employeeName',employeeContext?.employee.fullName??'');
      localStorage.setItem('a25.employeeCode',employeeContext?.employee.employeeCode??'');
      window.location.replace('/dashboard');
    }catch(cause){setError(cause instanceof Error?cause.message:'Không thể tạo phiên làm việc')}
    finally{setLoading(false)}
  }

  function changeEmployee(){
    setEmployeeContext(null);setIdentifier('');setError('');setStep('identity');
  }

  return <section className="auth-card employee-login">
    <div className="login-progress" aria-label="Tiến trình đăng nhập nhân viên">
      {(['identity','shift'] as Step[]).map((item,index)=><i key={item} className={item===step?'active':''}>{index+1}</i>)}
    </div>
    <div className="branch-badge"><span>{device.branch.code}</span><div><strong>{device.branch.name}</strong><small>{device.deviceName} · {device.deviceCode}</small></div></div>

    {step==='identity'&&<>
      <div className="auth-card-header"><span>BƯỚC 1 · NHÂN VIÊN</span><h2>Nhập mã nhân viên</h2><p>Nhập mã trên thẻ hoặc quét QR để tiếp tục.</p></div>
      <label>Mã nhân viên<input value={identifier} onChange={event=>setIdentifier(event.target.value.toUpperCase())} onKeyDown={event=>{if(event.key==='Enter')void loadEmployee(identifier)}} placeholder="Ví dụ: A250001" autoCapitalize="characters" autoFocus/></label>
      <div className="identity-actions">
        <button type="button" className="login-button" disabled={loading} onClick={()=>void loadEmployee(identifier)}>{loading?'Đang kiểm tra...':'Tiếp tục'}</button>
        <button type="button" className="qr-button" disabled={loading} onClick={()=>{setError('');setScanning(true)}}><span>⌗</span> Quét QR thẻ</button>
      </div>
    </>}

    {step==='shift'&&employeeContext&&<>
      <button type="button" className="login-back" onClick={changeEmployee}>← Đổi nhân viên</button>
      <div className="auth-card-header"><span>BƯỚC 2 · CA LÀM VIỆC</span><h2>Xin chào, {employeeContext.employee.fullName}</h2><p>Lịch phân ca đã được đối chiếu với giờ thực tế tại {employeeContext.branch.name}.</p></div>
      <div className="shift-options">
        {employeeContext.assignments.map(item=><article key={item.id}><div><span>{item.shift.shiftCode}</span><strong>{formatShift(item.shift.startsAt)} – {formatShift(item.shift.endsAt)}</strong><small>{assignmentLabel(item.assignmentType)}</small></div><button type="button" disabled={loading} onClick={()=>void confirmShift(item)}>{loading?'Đang tạo phiên...':'Xác nhận ca'}</button></article>)}
      </div>
      {!employeeContext.assignments.length&&<div className="login-notice"><strong>Chưa có ca phù hợp</strong><span>Không tìm thấy lịch đang diễn ra hoặc bắt đầu trong vòng 60 phút tới.</span></div>}
    </>}

    {error&&<p className="auth-error" role="alert"><b>!</b>{error}</p>}
    {scanning&&<div className="qr-scanner"><video ref={videoRef} playsInline muted/><div className="qr-frame"/><p>Đưa mã QR trên thẻ vào khung</p><button type="button" onClick={()=>setScanning(false)}>Hủy quét</button></div>}
  </section>;
}