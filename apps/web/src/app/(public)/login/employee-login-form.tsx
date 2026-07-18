'use client';

import {useEffect,useRef,useState} from 'react';
import type {CurrentBranchDevice} from '@/lib/branch-devices';
import {changeEmployeePin,startWorkSession,verifyEmployee,type EmployeeContext,type ShiftAssignment} from '@/lib/employee-auth';

type Step='identity'|'pin'|'change-pin'|'shift';
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
  const[pin,setPin]=useState('');
  const[newPin,setNewPin]=useState('');
  const[confirmPin,setConfirmPin]=useState('');
  const[employeeContext,setEmployeeContext]=useState<EmployeeContext|null>(null);
  const[error,setError]=useState('');
  const[loading,setLoading]=useState(false);
  const[scanning,setScanning]=useState(false);
  const videoRef=useRef<HTMLVideoElement>(null);
  const progressSteps:Step[]=(step==='change-pin'||employeeContext?.employee.mustChangePin)
    ?['identity','pin','change-pin','shift']
    :['identity','pin','shift'];

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
          if(codes[0]?.rawValue){setIdentifier(codes[0].rawValue);setScanning(false);setStep('pin');stop();return}
          frame=requestAnimationFrame(()=>void scan());
        };
        await scan();
      }catch(cause){
        setError(cause instanceof Error?cause.message:'Không thể mở camera');setScanning(false);stop();
      }
    })();
    return stop;
  },[scanning]);

  function continueIdentity(){
    if(identifier.trim().length<3){setError('Vui lòng nhập hoặc quét mã nhân viên');return}
    setError('');setStep('pin');
  }

  async function submitPin(){
    if(!/^\d{6}$/.test(pin)){setError('PIN phải gồm đúng 6 chữ số');return}
    setLoading(true);setError('');
    try{
      const context=await verifyEmployee(identifier,pin);
      setEmployeeContext(context);
      setStep(context.employee.mustChangePin?'change-pin':'shift');
    }catch(cause){setError(cause instanceof Error?cause.message:'Không thể xác thực nhân viên')}
    finally{setLoading(false)}
  }

  async function submitNewPin(){
    if(!/^\d{6}$/.test(newPin)){setError('PIN mới phải gồm đúng 6 chữ số');return}
    if(newPin==='888888'){setError('PIN mới không được trùng với PIN mặc định 888888');return}
    if(newPin!==confirmPin){setError('Hai lần nhập PIN mới chưa trùng khớp');return}
    setLoading(true);setError('');
    try{
      await changeEmployeePin(identifier,pin,newPin);
      setPin(newPin);
      setEmployeeContext(context=>context?{...context,employee:{...context.employee,mustChangePin:false}}:context);
      setNewPin('');setConfirmPin('');setStep('shift');
    }catch(cause){setError(cause instanceof Error?cause.message:'Không thể đổi PIN')}
    finally{setLoading(false)}
  }

  async function confirmShift(assignment:ShiftAssignment){
    setLoading(true);setError('');
    try{
      const session=await startWorkSession(identifier,pin,assignment.shift.id);
      localStorage.setItem('a25.workSessionId',session.id);
      localStorage.setItem('a25.branchId',session.branchId);
      localStorage.setItem('a25.employeeName',employeeContext?.employee.fullName??'');
      localStorage.setItem('a25.employeeCode',employeeContext?.employee.employeeCode??'');
      window.location.replace('/dashboard');
    }catch(cause){setError(cause instanceof Error?cause.message:'Không thể tạo phiên làm việc')}
    finally{setLoading(false)}
  }

  function changeEmployee(){
    setEmployeeContext(null);setIdentifier('');setPin('');setNewPin('');setConfirmPin('');setError('');setStep('identity');
  }

  return <section className="auth-card employee-login">
    <div className="login-progress" aria-label="Tiến trình đăng nhập nhân viên">
      {progressSteps.map((item,index)=><i key={item} className={item===step?'active':''}>{index+1}</i>)}
    </div>
    <div className="branch-badge"><span>{device.branch.code}</span><div><strong>{device.branch.name}</strong><small>{device.deviceName} · {device.deviceCode}</small></div></div>

    {step==='identity'&&<>
      <div className="auth-card-header"><span>BƯỚC 1 · NHÂN VIÊN</span><h2>Mã nhân viên</h2><p>Nhập mã trên thẻ hoặc quét QR thẻ nhân viên.</p></div>
      <label>Mã nhân viên<input value={identifier} onChange={event=>setIdentifier(event.target.value.toUpperCase())} placeholder="Ví dụ: A250001" autoCapitalize="characters" autoFocus/></label>
      <div className="identity-actions">
        <button type="button" className="login-button" onClick={continueIdentity}>Tiếp tục</button>
        <button type="button" className="qr-button" onClick={()=>{setError('');setScanning(true)}}><span>⌗</span> Quét QR thẻ</button>
      </div>
    </>}

    {step==='pin'&&<>
      <button type="button" className="login-back" onClick={()=>{setPin('');setStep('identity')}}>← Đổi mã nhân viên</button>
      <div className="auth-card-header"><span>BƯỚC 2 · XÁC THỰC</span><h2>Nhập PIN cá nhân</h2><p>Mã nhân viên: <strong>{identifier.replace(/^A25EMP:/i,'')}</strong></p></div>
      <label>PIN 6 số<input className="pin-input" value={pin} onChange={event=>setPin(event.target.value.replace(/\D/g,'').slice(0,6))} type="password" inputMode="numeric" placeholder="••••••" autoFocus/></label>
      <button type="button" className="login-button" disabled={loading||pin.length!==6} onClick={()=>void submitPin()}>{loading?'Đang xác thực...':'Xác thực nhân viên'}</button>
    </>}

    {step==='change-pin'&&employeeContext&&<>
      <div className="auth-card-header"><span>BƯỚC 3 · BẢO MẬT</span><h2>Đổi PIN lần đầu</h2><p>PIN mặc định 888888 chỉ dùng để khởi tạo. Hãy đổi PIN trước khi xác nhận ca.</p></div>
      <label>PIN mới gồm 6 số<input className="pin-input" value={newPin} onChange={event=>setNewPin(event.target.value.replace(/\D/g,'').slice(0,6))} type="password" inputMode="numeric" placeholder="••••••" autoFocus/></label>
      <label>Nhập lại PIN mới<input className="pin-input" value={confirmPin} onChange={event=>setConfirmPin(event.target.value.replace(/\D/g,'').slice(0,6))} type="password" inputMode="numeric" placeholder="••••••"/></label>
      <button type="button" className="login-button" disabled={loading||newPin.length!==6||confirmPin.length!==6} onClick={()=>void submitNewPin()}>{loading?'Đang đổi PIN...':'Đổi PIN và tiếp tục'}</button>
    </>}

    {step==='shift'&&employeeContext&&<>
      <button type="button" className="login-back" onClick={changeEmployee}>← Đổi nhân viên</button>
      <div className="auth-card-header"><span>BƯỚC CUỐI · CA LÀM VIỆC</span><h2>Xin chào, {employeeContext.employee.fullName}</h2><p>Lịch phân ca đã được đối chiếu với giờ thực tế tại {employeeContext.branch.name}.</p></div>
      <div className="shift-options">
        {employeeContext.assignments.map(item=><article key={item.id}><div><span>{item.shift.shiftCode}</span><strong>{formatShift(item.shift.startsAt)} – {formatShift(item.shift.endsAt)}</strong><small>{assignmentLabel(item.assignmentType)}</small></div><button type="button" disabled={loading} onClick={()=>void confirmShift(item)}>{loading?'Đang tạo phiên...':'Xác nhận ca'}</button></article>)}
      </div>
      {!employeeContext.assignments.length&&<div className="login-notice"><strong>Chưa có ca phù hợp</strong><span>Không tìm thấy lịch đang diễn ra hoặc bắt đầu trong vòng 60 phút tới.</span></div>}
    </>}

    {error&&<p className="auth-error" role="alert"><b>!</b>{error}</p>}
    {scanning&&<div className="qr-scanner"><video ref={videoRef} playsInline muted/><div className="qr-frame"/><p>Đưa mã QR trên thẻ vào khung</p><button type="button" onClick={()=>setScanning(false)}>Hủy quét</button></div>}
  </section>;
}