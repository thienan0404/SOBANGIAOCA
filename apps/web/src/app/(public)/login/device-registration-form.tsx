'use client';

import {useEffect,useState} from 'react';
import {EmployeeLoginForm} from './employee-login-form';
import {getCurrentBranchDevice,registerBranchDevice,type CurrentBranchDevice} from '@/lib/branch-devices';
import {createClient} from '@/lib/supabase/client';

type Step='account'|'setup'|'ready';
type Branch={id:string;code:string;name:string;address:string|null};

export function DeviceRegistrationForm(){
  const[step,setStep]=useState<Step>('account');
  const[email,setEmail]=useState('');
  const[password,setPassword]=useState('');
  const[branches,setBranches]=useState<Branch[]>([]);
  const[branchId,setBranchId]=useState('');
  const[deviceCode,setDeviceCode]=useState('');
  const[deviceName,setDeviceName]=useState('');
  const[device,setDevice]=useState<CurrentBranchDevice|null>(null);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');

  async function loadBranches(){
    const supabase=createClient();
    const{data,error:branchError}=await supabase.from('branches').select('id,code,name,address').order('name');
    if(branchError)throw new Error('Không thể tải danh sách chi nhánh được phân công');
    const available=(data??[]) as Branch[];
    if(!available.length)throw new Error('Tài khoản chưa được phân quyền quản lý chi nhánh');
    setBranches(available);
    setBranchId(current=>current||available[0]!.id);
    setStep('setup');
  }

  useEffect(()=>{
    let active=true;
    void(async()=>{
      try{
        const current=await getCurrentBranchDevice();
        if(!active)return;
        if(current){setDevice(current);setStep('ready');return}
        const{data}=await createClient().auth.getSession();
        if(data.session)await loadBranches();
      }catch(cause){
        if(active)setError(cause instanceof Error?cause.message:'Không thể kiểm tra thiết bị');
      }finally{if(active)setLoading(false)}
    })();
    return()=>{active=false};
  },[]);

  async function loginManager(){
    if(!email||!password){setError('Vui lòng nhập tài khoản và mật khẩu quản lý');return}
    setLoading(true);setError('');
    try{
      const{data,error:loginError}=await createClient().auth.signInWithPassword({email,password});
      if(loginError||!data.session)throw new Error('Tài khoản hoặc mật khẩu chưa chính xác');
      await loadBranches();
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Không thể đăng nhập');
    }finally{setLoading(false)}
  }

  async function register(){
    if(!branchId){setError('Vui lòng chọn chi nhánh');return}
    if(!/^[A-Z0-9][A-Z0-9-]{2,63}$/.test(deviceCode.trim().toUpperCase())){
      setError('Mã thiết bị phải có từ 3 ký tự, chỉ gồm chữ, số và dấu gạch ngang');return;
    }
    if(!deviceName.trim()){setError('Vui lòng nhập tên thiết bị');return}
    setLoading(true);setError('');
    try{
      const{data}=await createClient().auth.getSession();
      if(!data.session)throw new Error('Phiên đăng nhập quản lý đã hết hạn');
      const registered=await registerBranchDevice(data.session.access_token,{
        branchId,
        deviceCode:deviceCode.trim().toUpperCase(),
        deviceName:deviceName.trim()
      });
      setDevice(registered);setStep('ready');
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Không thể đăng ký thiết bị');
    }finally{setLoading(false)}
  }

  async function changeManager(){
    await createClient().auth.signOut();
    setEmail('');setPassword('');setBranches([]);setBranchId('');setStep('account');setError('');
  }

  if(step==='ready'&&device)return <EmployeeLoginForm device={device}/>;

  if(loading&&step==='account')return <section className="auth-card employee-login"><div className="login-notice"><strong>Đang kiểm tra thiết bị...</strong><span>Vui lòng chờ trong giây lát.</span></div></section>;

  return <section className="auth-card employee-login">
    <div className="login-progress" aria-label="Tiến trình đăng ký thiết bị">
      {(step==='ready'?['ready']:['account','setup']).map((item,index)=><i key={item} className={item===step?'active':''}>{index+1}</i>)}
    </div>

    {step==='account'&&<>
      <div className="auth-card-header"><span>BƯỚC 1 · QUẢN LÝ</span><h2>Đăng nhập tài khoản quản lý</h2><p>Dùng tài khoản quản lý chi nhánh hoặc tài khoản quản trị viên.</p></div>
      <div className="auth-fields">
        <label>Tài khoản quản lý<input type="email" value={email} onChange={event=>setEmail(event.target.value)} placeholder="quanly@a25hotel.com" autoComplete="username"/></label>
        <label>Mật khẩu<input type="password" value={password} onChange={event=>setPassword(event.target.value)} placeholder="Nhập mật khẩu" autoComplete="current-password"/></label>
      </div>
      <button type="button" className="login-button" disabled={loading} onClick={()=>void loginManager()}>{loading?'Đang đăng nhập...':'Đăng nhập quản lý'}</button>
    </>}

    {step==='setup'&&<>
      <button type="button" className="login-back" onClick={()=>void changeManager()}>← Đổi tài khoản quản lý</button>
      <div className="auth-card-header"><span>BƯỚC 2 · THIẾT BỊ</span><h2>Đăng ký thiết bị lễ tân</h2><p>Chọn đúng chi nhánh đang sử dụng thiết bị này.</p></div>
      <div className="shift-options">
        {branches.map(branch=><article key={branch.id}><div><span>{branch.code}</span><strong>{branch.name}</strong><small>{branch.address}</small></div><button type="button" onClick={()=>setBranchId(branch.id)}>{branchId===branch.id?'Đã chọn':'Chọn'}</button></article>)}
      </div>
      <div className="auth-fields">
        <label>Mã thiết bị<input value={deviceCode} onChange={event=>setDeviceCode(event.target.value.toUpperCase())} placeholder="45PCT-FRONTDESK-01" autoCapitalize="characters"/></label>
        <label>Tên thiết bị<input value={deviceName} onChange={event=>setDeviceName(event.target.value)} placeholder="Quầy lễ tân chính"/></label>
      </div>
      <button type="button" className="login-button" disabled={loading} onClick={()=>void register()}>{loading?'Đang đăng ký...':'Đăng ký thiết bị'}</button>
    </>}

    {step==='ready'&&device&&<>
      <div className="branch-badge"><span>{device.branch.code}</span><div><strong>{device.branch.name}</strong><small>{device.deviceName} · {device.deviceCode}</small></div></div>
      <div className="auth-card-header"><span>THIẾT BỊ ĐÃ SẴN SÀNG</span><h2>Đã gán chi nhánh</h2><p>Thiết bị sẽ ghi nhớ chi nhánh này cho những lần truy cập sau.</p></div>
      <div className="login-notice"><strong>{device.branch.name}</strong><span>Thiết bị đang hoạt động và đã được xác thực.</span></div>
    </>}

    {error&&<p className="auth-error" role="alert"><b>!</b>{error}</p>}
  </section>;
}
