'use client';

import {useEffect,useState} from 'react';
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
    if(branchError)throw new Error('Kh?ng th? t?i danh s?ch chi nh?nh ???c ph?n c?ng');
    const available=(data??[]) as Branch[];
    if(!available.length)throw new Error('T?i kho?n ch?a ???c ph?n quy?n qu?n l? chi nh?nh');
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
        if(active)setError(cause instanceof Error?cause.message:'Kh?ng th? ki?m tra thi?t b?');
      }finally{if(active)setLoading(false)}
    })();
    return()=>{active=false};
  },[]);

  async function loginManager(){
    if(!email||!password){setError('Vui l?ng nh?p t?i kho?n v? m?t kh?u qu?n l?');return}
    setLoading(true);setError('');
    try{
      const{data,error:loginError}=await createClient().auth.signInWithPassword({email,password});
      if(loginError||!data.session)throw new Error('T?i kho?n ho?c m?t kh?u ch?a ch?nh x?c');
      await loadBranches();
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Kh?ng th? ??ng nh?p');
    }finally{setLoading(false)}
  }

  async function register(){
    if(!branchId){setError('Vui l?ng ch?n chi nh?nh');return}
    if(!/^[A-Z0-9][A-Z0-9-]{2,63}$/.test(deviceCode.trim().toUpperCase())){
      setError('M? thi?t b? ph?i c? t? 3 k? t?, ch? g?m ch?, s? v? d?u g?ch ngang');return;
    }
    if(!deviceName.trim()){setError('Vui l?ng nh?p t?n thi?t b?');return}
    setLoading(true);setError('');
    try{
      const{data}=await createClient().auth.getSession();
      if(!data.session)throw new Error('Phi?n ??ng nh?p qu?n l? ?? h?t h?n');
      const registered=await registerBranchDevice(data.session.access_token,{
        branchId,
        deviceCode:deviceCode.trim().toUpperCase(),
        deviceName:deviceName.trim()
      });
      setDevice(registered);setStep('ready');
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Kh?ng th? ??ng k? thi?t b?');
    }finally{setLoading(false)}
  }

  async function changeManager(){
    await createClient().auth.signOut();
    setEmail('');setPassword('');setBranches([]);setBranchId('');setStep('account');setError('');
  }

  if(loading&&step==='account')return <section className="auth-card employee-login"><div className="login-notice"><strong>?ang ki?m tra thi?t b?...</strong><span>Vui l?ng ch? trong gi?y l?t.</span></div></section>;

  return <section className="auth-card employee-login">
    <div className="login-progress" aria-label="Ti?n tr?nh ??ng k? thi?t b?">
      {(step==='ready'?['ready']:['account','setup']).map((item,index)=><i key={item} className={item===step?'active':''}>{index+1}</i>)}
    </div>

    {step==='account'&&<>
      <div className="auth-card-header"><span>B??C 1 ? QU?N L?</span><h2>??ng nh?p t?i kho?n qu?n l?</h2><p>D?ng t?i kho?n qu?n l? chi nh?nh ho?c t?i kho?n qu?n tr? vi?n.</p></div>
      <div className="auth-fields">
        <label>T?i kho?n qu?n l?<input type="email" value={email} onChange={event=>setEmail(event.target.value)} placeholder="quanly@a25hotel.com" autoComplete="username"/></label>
        <label>M?t kh?u<input type="password" value={password} onChange={event=>setPassword(event.target.value)} placeholder="Nh?p m?t kh?u" autoComplete="current-password"/></label>
      </div>
      <button type="button" className="login-button" disabled={loading} onClick={()=>void loginManager()}>{loading?'?ang ??ng nh?p...':'??ng nh?p qu?n l?'}</button>
    </>}

    {step==='setup'&&<>
      <button type="button" className="login-back" onClick={()=>void changeManager()}>? ??i t?i kho?n qu?n l?</button>
      <div className="auth-card-header"><span>B??C 2 ? THI?T B?</span><h2>??ng k? thi?t b? l? t?n</h2><p>Ch?n ??ng chi nh?nh ?ang s? d?ng thi?t b? n?y.</p></div>
      <div className="shift-options">
        {branches.map(branch=><article key={branch.id}><div><span>{branch.code}</span><strong>{branch.name}</strong><small>{branch.address}</small></div><button type="button" onClick={()=>setBranchId(branch.id)}>{branchId===branch.id?'?? ch?n':'Ch?n'}</button></article>)}
      </div>
      <div className="auth-fields">
        <label>M? thi?t b?<input value={deviceCode} onChange={event=>setDeviceCode(event.target.value.toUpperCase())} placeholder="45PCT-FRONTDESK-01" autoCapitalize="characters"/></label>
        <label>T?n thi?t b?<input value={deviceName} onChange={event=>setDeviceName(event.target.value)} placeholder="Qu?y l? t?n ch?nh"/></label>
      </div>
      <button type="button" className="login-button" disabled={loading} onClick={()=>void register()}>{loading?'?ang ??ng k?...':'??ng k? thi?t b?'}</button>
    </>}

    {step==='ready'&&device&&<>
      <div className="branch-badge"><span>{device.branch.code}</span><div><strong>{device.branch.name}</strong><small>{device.deviceName} ? {device.deviceCode}</small></div></div>
      <div className="auth-card-header"><span>THI?T B? ?? S?N S?NG</span><h2>?? g?n chi nh?nh</h2><p>Thi?t b? s? ghi nh? chi nh?nh n?y cho nh?ng l?n truy c?p sau.</p></div>
      <div className="login-notice"><strong>{device.branch.name}</strong><span>Thi?t b? ?ang ho?t ??ng v? ?? ???c x?c th?c.</span></div>
    </>}

    {error&&<p className="auth-error" role="alert"><b>!</b>{error}</p>}
  </section>;
}
