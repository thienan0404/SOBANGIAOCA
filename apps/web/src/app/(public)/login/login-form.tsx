'use client';

import {useEffect,useRef,useState} from 'react';
import {createClient} from '@/lib/supabase/client';

type Step='account'|'identity'|'pin'|'change-pin'|'shift';
type Branch={id:string;name:string;code:string;address:string|null};
type Assignment={
  id:string;
  assignmentType:string;
  shift:{id:string;shiftCode:string;startsAt:string;endsAt:string;branch:Branch};
};
type BranchContext={
  account:{id:string;fullName:string;email:string};
  branch:Branch;
  activeSession:{id:string;branchId:string;profile:{fullName:string;employeeCode:string|null}}|null;
};
type EmployeeContext={
  employee:{id:string;fullName:string;employeeCode:string|null;mustChangePin:boolean};
  branch:Branch;
  assignments:Assignment[];
};
type DetectorResult={rawValue:string};
type Detector={detect(source:HTMLVideoElement):Promise<DetectorResult[]>};
type DetectorConstructor=new(options:{formats:string[]})=>Detector;


function formatShift(value:string){
  return new Intl.DateTimeFormat('vi-VN',{hour:'2-digit',minute:'2-digit'}).format(new Date(value));
}

async function rpcData<T>(name:string,args?:Record<string,unknown>):Promise<T>{
  const{data,error}=await createClient().rpc(name,args);
  if(error)throw new Error(error.message);
  return data as T;
}

export function LoginForm(){
  const[step,setStep]=useState<Step>('account');
  const[email,setEmail]=useState('');
  const[password,setPassword]=useState('');
  const[identifier,setIdentifier]=useState('');
  const[pin,setPin]=useState('');
  const[newPin,setNewPin]=useState('');
  const[confirmPin,setConfirmPin]=useState('');
  const[branchContext,setBranchContext]=useState<BranchContext|null>(null);
  const[employeeContext,setEmployeeContext]=useState<EmployeeContext|null>(null);
  const[error,setError]=useState('');
  const[loading,setLoading]=useState(false);
  const[scanning,setScanning]=useState(false);
  const videoRef=useRef<HTMLVideoElement>(null);

  async function loadBranchContext(){
    const context=await rpcData<BranchContext>('a25_branch_login_context');
    setBranchContext(context);
    if(context.activeSession){
      localStorage.setItem('a25.workSessionId',context.activeSession.id);
      localStorage.setItem('a25.branchId',context.activeSession.branchId);
      localStorage.setItem('a25.employeeName',context.activeSession.profile.fullName);
      localStorage.setItem('a25.employeeCode',context.activeSession.profile.employeeCode??'');
      window.location.replace('/dashboard');
      return;
    }
    setStep('identity');
  }

  useEffect(()=>{
    void createClient().auth.getSession().then(({data})=>{
      if(data.session)void loadBranchContext().catch(()=>undefined);
    });
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
            setIdentifier(codes[0].rawValue);
            setScanning(false);
            setStep('pin');
            stop();
            return;
          }
          frame=requestAnimationFrame(()=>void scan());
        };
        await scan();
      }catch(cause){
        setError(cause instanceof Error?cause.message:'Không thể mở camera');
        setScanning(false);
        stop();
      }
    })();
    return stop;
  },[scanning]);

  async function loginBranch(){
    if(!email||!password){setError('Vui lòng nhập tài khoản và mật khẩu chi nhánh');return}
    setLoading(true);setError('');
    try{
      const{data,error:loginError}=await createClient().auth.signInWithPassword({email,password});
      if(loginError||!data.session)throw new Error('Tài khoản hoặc mật khẩu chi nhánh chưa chính xác');
      await loadBranchContext();
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Không thể đăng nhập chi nhánh');
    }finally{setLoading(false)}
  }

  function continueIdentity(){
    if(identifier.trim().length<3){setError('Vui lòng nhập hoặc quét mã nhân viên');return}
    setError('');setStep('pin');
  }

  async function verifyEmployee(){
    if(!/^\d{6}$/.test(pin)){setError('PIN phải gồm đúng 6 chữ số');return}
    setLoading(true);setError('');
    try{
      const{data}=await createClient().auth.getSession();
      if(!data.session)throw new Error('Phiên tài khoản chi nhánh đã hết hạn');
      const context=await rpcData<EmployeeContext>('a25_verify_employee',{
        p_identifier:identifier,
        p_pin:pin
      });
      setEmployeeContext(context);
      setStep(context.employee.mustChangePin?'change-pin':'shift');
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Không thể xác thực nhân viên');
    }finally{setLoading(false)}
  }

  async function changeEmployeePin(){
    if(!/^\d{6}$/.test(newPin)){setError('PIN moi phai gom dung 6 chu so');return}
    if(newPin==='888888'){setError('PIN moi khong duoc trung PIN mac dinh 888888');return}
    if(newPin!==confirmPin){setError('Hai lan nhap PIN moi chua khop nhau');return}
    setLoading(true);setError('');
    try{
      const{data}=await createClient().auth.getSession();
      if(!data.session)throw new Error('Phien tai khoan chi nhanh da het han');
      await rpcData<boolean>('a25_change_employee_pin',{
        p_identifier:identifier,
        p_current_pin:pin,
        p_new_pin:newPin
      });
      setPin(newPin);
      setEmployeeContext(context=>context?{
        ...context,
        employee:{...context.employee,mustChangePin:false}
      }:context);
      setNewPin('');setConfirmPin('');setStep('shift');
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Khong the doi PIN');
    }finally{setLoading(false)}
  }

  async function confirmShift(assignment:Assignment){
    setLoading(true);setError('');
    try{
      const{data}=await createClient().auth.getSession();
      if(!data.session)throw new Error('Phiên tài khoản chi nhánh đã hết hạn');
      const session=await rpcData<{id:string;branchId:string}>('a25_start_work_session',{
        p_identifier:identifier,
        p_pin:pin,
        p_shift_instance_id:assignment.shift.id
      });
      localStorage.setItem('a25.workSessionId',session.id);
      localStorage.setItem('a25.branchId',session.branchId);
      localStorage.setItem('a25.employeeName',employeeContext?.employee.fullName??'');
      localStorage.setItem('a25.employeeCode',employeeContext?.employee.employeeCode??'');
      window.location.replace('/dashboard');
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Không thể tạo phiên làm việc');
    }finally{setLoading(false)}
  }

  async function changeBranchAccount(){
    await createClient().auth.signOut();
    localStorage.removeItem('a25.workSessionId');
    localStorage.removeItem('a25.branchId');
    setBranchContext(null);setEmployeeContext(null);setIdentifier('');setPin('');setStep('account');
  }

  return <section className="auth-card employee-login">
    <div className="login-progress" aria-label="Tiến trình đăng nhập">
      {['account','identity','pin','shift'].map((item,index)=><i key={item} className={item===step?'active':''}>{index+1}</i>)}
    </div>

    {step==='account'&&<>
      <div className="auth-card-header"><span>BƯỚC 1 · CHI NHÁNH</span><h2>Đăng nhập chi nhánh</h2><p>Dùng tài khoản được cấp riêng cho khách sạn đang vận hành.</p></div>
      <div className="auth-fields">
        <label>Tài khoản chi nhánh<input type="email" value={email} onChange={event=>setEmail(event.target.value)} placeholder="chinhanh@a25hotel.com" autoComplete="username"/></label>
        <label>Mật khẩu<input type="password" value={password} onChange={event=>setPassword(event.target.value)} placeholder="Nhập mật khẩu" autoComplete="current-password"/></label>
      </div>
      <button type="button" className="login-button" disabled={loading} onClick={()=>void loginBranch()}>{loading?<><i/>Đang đăng nhập...</>:'Đăng nhập chi nhánh'}</button>
    </>}

    {step==='identity'&&branchContext&&<>
      <button type="button" className="login-back" onClick={()=>void changeBranchAccount()}>← Đổi tài khoản chi nhánh</button>
      <div className="branch-badge"><span>{branchContext.branch.code}</span><div><strong>{branchContext.branch.name}</strong><small>{branchContext.branch.address}</small></div></div>
      <div className="auth-card-header"><span>BƯỚC 2 · NHÂN VIÊN</span><h2>Mã nhân viên</h2><p>Nhập mã trên thẻ hoặc quét QR thẻ nhân viên.</p></div>
      <label>Mã nhân viên<input value={identifier} onChange={event=>setIdentifier(event.target.value.toUpperCase())} placeholder="Ví dụ: A250001" autoCapitalize="characters" autoFocus/></label>
      <div className="identity-actions">
        <button type="button" className="login-button" onClick={continueIdentity}>Tiếp tục</button>
        <button type="button" className="qr-button" onClick={()=>{setError('');setScanning(true)}}><span>⌗</span> Quét QR thẻ</button>
      </div>
    </>}

    {step==='pin'&&<>
      <button type="button" className="login-back" onClick={()=>{setPin('');setStep('identity')}}>← Đổi mã nhân viên</button>
      <div className="auth-card-header"><span>BƯỚC 3 · XÁC THỰC</span><h2>Nhập PIN cá nhân</h2><p>Mã nhân viên: <strong>{identifier.replace(/^A25EMP:/i,'')}</strong></p></div>
      <label>PIN 6 số<input className="pin-input" value={pin} onChange={event=>setPin(event.target.value.replace(/\D/g,'').slice(0,6))} type="password" inputMode="numeric" placeholder="••••••" autoFocus/></label>
      <button type="button" className="login-button" disabled={loading||pin.length!==6} onClick={()=>void verifyEmployee()}>{loading?<><i/>Đang xác thực...</>:'Xác thực nhân viên'}</button>
    </>}

    {step==='change-pin'&&employeeContext&&<>
      <div className="auth-card-header">
        <span>{'\u0042\u01af\u1eda\u0043\u0020\u0034\u0020\u00b7\u0020\u0042\u1ea2\u004f\u0020\u004d\u1eac\u0054'}</span>
        <h2>{'\u0110\u1ed5\u0069\u0020\u0050\u0049\u004e\u0020\u006c\u1ea7\u006e\u0020\u0111\u1ea7\u0075'}</h2>
        <p>{'\u0050\u0049\u004e\u0020\u006d\u1eb7\u0063\u0020\u0111\u1ecb\u006e\u0068\u0020\u0038\u0038\u0038\u0038\u0038\u0038\u0020\u0063\u0068\u1ec9\u0020\u0064\u00f9\u006e\u0067\u0020\u0111\u1ec3\u0020\u006b\u0068\u1edf\u0069\u0020\u0074\u1ea1\u006f\u002e\u0020\u0048\u00e3\u0079\u0020\u0111\u1ed5\u0069\u0020\u0050\u0049\u004e\u0020\u0074\u0072\u01b0\u1edb\u0063\u0020\u006b\u0068\u0069\u0020\u0076\u00e0\u006f\u0020\u0063\u0061\u002e'}</p>
      </div>
      <label>{'\u0050\u0049\u004e\u0020\u006d\u1edb\u0069\u0020\u0036\u0020\u0073\u1ed1'}<input className="pin-input" value={newPin} onChange={event=>setNewPin(event.target.value.replace(/\D/g,'').slice(0,6))} type="password" inputMode="numeric" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022" autoFocus/></label>
      <label>{'\u004e\u0068\u1ead\u0070\u0020\u006c\u1ea1\u0069\u0020\u0050\u0049\u004e\u0020\u006d\u1edb\u0069'}<input className="pin-input" value={confirmPin} onChange={event=>setConfirmPin(event.target.value.replace(/\D/g,'').slice(0,6))} type="password" inputMode="numeric" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022"/></label>
      <button type="button" className="login-button" disabled={loading||newPin.length!==6||confirmPin.length!==6} onClick={()=>void changeEmployeePin()}>{loading?'\u0110\u0061\u006e\u0067\u0020\u0111\u1ed5\u0069\u0020\u0050\u0049\u004e\u002e\u002e\u002e':'\u0110\u1ed5\u0069\u0020\u0050\u0049\u004e\u0020\u0076\u00e0\u0020\u0074\u0069\u1ebf\u0070\u0020\u0074\u1ee5\u0063'}</button>
    </>}

    {step==='shift'&&employeeContext&&<>
      <button type="button" className="login-back" onClick={()=>{setPin('');setStep('identity')}}>← Đổi nhân viên</button>
      <div className="auth-card-header"><span>BƯỚC 4 · CA LÀM VIỆC</span><h2>Xin chào, {employeeContext.employee.fullName}</h2><p>Lịch phân ca đã được đối chiếu với giờ thực tế tại {employeeContext.branch.name}.</p></div>
      <div className="shift-options">
        {employeeContext.assignments.map(item=><article key={item.id}><div><span>{item.shift.shiftCode}</span><strong>{formatShift(item.shift.startsAt)} – {formatShift(item.shift.endsAt)}</strong><small>{item.assignmentType}</small></div><button type="button" disabled={loading} onClick={()=>void confirmShift(item)}>{loading?'Đang tạo phiên...':'Xác nhận ca'}</button></article>)}
      </div>
      {!employeeContext.assignments.length&&<div className="login-notice"><strong>Chưa có ca phù hợp</strong><span>Không tìm thấy lịch đang diễn ra hoặc bắt đầu trong vòng 60 phút tới.</span></div>}
    </>}

    {error&&<p className="auth-error" role="alert"><b>!</b>{error}</p>}
    {scanning&&<div className="qr-scanner"><video ref={videoRef} playsInline muted/><div className="qr-frame"/><p>Đưa mã QR trên thẻ vào khung</p><button type="button" onClick={()=>setScanning(false)}>Hủy quét</button></div>}
  </section>;
}
