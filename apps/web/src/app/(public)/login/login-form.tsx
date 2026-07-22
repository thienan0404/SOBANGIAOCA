'use client';

import {useEffect,useState} from 'react';
import {createClient} from '@/lib/supabase/client';

type Step='branch'|'employee'|'shift';
type Branch={id:string;name:string;code:string;address:string|null};
type Assignment={
  id:string;
  canConfirm:boolean;
  availability:'AVAILABLE'|'UPCOMING'|'ENDED';
  handover:{toShift:string;startsAt:string;endsAt:string};
  shift:{id:string;shiftCode:string;startsAt:string;endsAt:string;branch:Branch};
};
type BranchContext={
  account:{id:string;fullName:string;email:string};
  branch:Branch;
  activeSession:{id:string;branchId:string;profile:{fullName:string;employeeCode:string|null}}|null;
};
type EmployeeContext={
  employee:{id:string;fullName:string;employeeCode:string|null;username:string};
  branch:Branch;
  assignments:Assignment[];
};

function formatShift(value:string){
  return new Intl.DateTimeFormat('vi-VN',{hour:'2-digit',minute:'2-digit'}).format(new Date(value));
}

const rpcMessages:Record<string,string>={
  'Phien dang nhap chi nhanh khong hop le':'Phiên đăng nhập chi nhánh không hợp lệ',
  'Tai khoan phai duoc gan voi dung mot chi nhanh':'Tài khoản phải được gán với đúng một chi nhánh',
  'Tai khoan nhan vien hoac mat khau chua chinh xac':'Tài khoản nhân viên hoặc mật khẩu chưa chính xác',
  'Nhan vien dang co mot phien lam viec khac':'Nhân viên đang có một phiên làm việc khác',
  'Khong tim thay lich phan ca phu hop voi gio thuc te':'Không tìm thấy lịch phân ca phù hợp với giờ thực tế',
  'Ca lam viec chua den gio hoac da ket thuc':'Ca làm việc chưa đến giờ hoặc đã kết thúc'
};

async function rpcData<T>(name:string,args?:Record<string,unknown>):Promise<T>{
  const{data,error}=await createClient().rpc(name,args);
  if(error){
    const translated=Object.entries(rpcMessages).find(([source])=>error.message.includes(source))?.[1];
    throw new Error(translated??error.message);
  }
  return data as T;
}

function warmApi(){
  const apiUrl=process.env.NEXT_PUBLIC_API_URL;
  if(apiUrl)void fetch(`${apiUrl}/health`,{cache:'no-store'}).catch(()=>undefined);
}

export function LoginForm(){
  const[step,setStep]=useState<Step>('branch');
  const[branchEmail,setBranchEmail]=useState('');
  const[branchPassword,setBranchPassword]=useState('');
  const[employeeUsername,setEmployeeUsername]=useState('');
  const[employeePassword,setEmployeePassword]=useState('');
  const[branchContext,setBranchContext]=useState<BranchContext|null>(null);
  const[employeeContext,setEmployeeContext]=useState<EmployeeContext|null>(null);
  const[error,setError]=useState('');
  const[loading,setLoading]=useState(false);
  const progressSteps:Step[]=['branch','employee','shift'];

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
    setStep('employee');
  }

  useEffect(()=>{
    warmApi();
    void createClient().auth.getSession().then(({data})=>{
      if(data.session)void loadBranchContext().catch(()=>undefined);
    });
  },[]);

  async function loginBranch(){
    if(!branchEmail.trim()||!branchPassword){
      setError('Vui lòng nhập tài khoản và mật khẩu chi nhánh');
      return;
    }
    setLoading(true);setError('');
    try{
      const{data,error:loginError}=await createClient().auth.signInWithPassword({
        email:branchEmail.trim(),
        password:branchPassword
      });
      if(loginError||!data.session)throw new Error('Tài khoản hoặc mật khẩu chi nhánh chưa chính xác');
      await loadBranchContext();
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Không thể đăng nhập chi nhánh');
    }finally{setLoading(false)}
  }

  async function loginEmployee(){
    if(!employeeUsername.trim()||!employeePassword){
      setError('Vui lòng nhập tài khoản và mật khẩu nhân viên');
      return;
    }
    setLoading(true);setError('');
    try{
      const{data}=await createClient().auth.getSession();
      if(!data.session)throw new Error('Phiên tài khoản chi nhánh đã hết hạn');
      const context=await rpcData<EmployeeContext>('a25_verify_employee_account',{
        p_username:employeeUsername.trim(),
        p_password:employeePassword
      });
      setEmployeeContext(context);
      setStep('shift');
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Không thể đăng nhập nhân viên');
    }finally{setLoading(false)}
  }

  async function confirmShift(assignment:Assignment){
    setLoading(true);setError('');
    try{
      const{data}=await createClient().auth.getSession();
      if(!data.session)throw new Error('Phiên tài khoản chi nhánh đã hết hạn');
      const session=await rpcData<{id:string;branchId:string}>('a25_start_work_session_account',{
        p_username:employeeUsername.trim(),
        p_password:employeePassword,
        p_shift_instance_id:assignment.shift.id
      });
      localStorage.setItem('a25.workSessionId',session.id);
      localStorage.setItem('a25.branchId',session.branchId);
      localStorage.setItem('a25.branchName',employeeContext?.branch.name??'');
      localStorage.setItem('a25.branchCode',employeeContext?.branch.code??'');
      localStorage.setItem('a25.employeeName',employeeContext?.employee.fullName??'');
      localStorage.setItem('a25.employeeCode',employeeContext?.employee.employeeCode??'');
      setEmployeePassword('');
      window.location.replace('/dashboard');
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Không thể tạo phiên làm việc');
    }finally{setLoading(false)}
  }

  async function changeBranchAccount(){
    await createClient().auth.signOut();
    localStorage.removeItem('a25.workSessionId');
    localStorage.removeItem('a25.branchId');
    setBranchContext(null);
    setEmployeeContext(null);
    setEmployeeUsername('');
    setEmployeePassword('');
    setStep('branch');
  }

  function changeEmployee(){
    setEmployeeContext(null);
    setEmployeeUsername('');
    setEmployeePassword('');
    setError('');
    setStep('employee');
  }

  return <section className="auth-card employee-login">
    <div className="login-progress" aria-label="Tiến trình đăng nhập">
      {progressSteps.map((item,index)=><i key={item} className={item===step?'active':''}>{index+1}</i>)}
    </div>

    {step==='branch'&&<>
      <div className="auth-card-header"><span>LỚP 1 · CHI NHÁNH</span><h2>Đăng nhập chi nhánh</h2><p>Tài khoản này xác định khách sạn đang vận hành.</p></div>
      <div className="auth-fields">
        <label>Tài khoản chi nhánh<input type="email" value={branchEmail} onChange={event=>setBranchEmail(event.target.value)} onKeyDown={event=>{if(event.key==='Enter')void loginBranch()}} placeholder="chinhanh@a25hotel.com" autoComplete="username" autoFocus/></label>
        <label>Mật khẩu<input type="password" value={branchPassword} onChange={event=>setBranchPassword(event.target.value)} onKeyDown={event=>{if(event.key==='Enter')void loginBranch()}} placeholder="Nhập mật khẩu chi nhánh" autoComplete="current-password"/></label>
      </div>
      <button type="button" className="login-button" disabled={loading} onClick={()=>void loginBranch()}>{loading?<><i/>Đang đăng nhập...</>:'Đăng nhập chi nhánh'}</button>
    </>}

    {step==='employee'&&branchContext&&<>
      <button type="button" className="login-back" onClick={()=>void changeBranchAccount()}>← Đổi tài khoản chi nhánh</button>
      <div className="branch-badge"><span>{branchContext.branch.code}</span><div><strong>{branchContext.branch.name}</strong><small>{branchContext.branch.address}</small></div></div>
      <div className="auth-card-header"><span>LỚP 2 · NHÂN VIÊN</span><h2>Đăng nhập nhân viên</h2><p>Dùng tài khoản cá nhân đã được cấp tại chi nhánh này.</p></div>
      <div className="auth-fields">
        <label>Tài khoản nhân viên<input value={employeeUsername} onChange={event=>setEmployeeUsername(event.target.value)} onKeyDown={event=>{if(event.key==='Enter')void loginEmployee()}} placeholder="Ví dụ: nv01" autoComplete="username" autoFocus/></label>
        <label>Mật khẩu<input type="password" value={employeePassword} onChange={event=>setEmployeePassword(event.target.value)} onKeyDown={event=>{if(event.key==='Enter')void loginEmployee()}} placeholder="Nhập mật khẩu nhân viên" autoComplete="current-password"/></label>
      </div>
      <button type="button" className="login-button" disabled={loading} onClick={()=>void loginEmployee()}>{loading?'Đang xác thực...':'Đăng nhập nhân viên'}</button>
    </>}

    {step==='shift'&&employeeContext&&<>
      <button type="button" className="login-back" onClick={changeEmployee}>← Đổi nhân viên</button>
      <div className="auth-card-header"><span>XÁC NHẬN CA LÀM VIỆC</span><h2>Xin chào, {employeeContext.employee.fullName}</h2><p>Chọn ca làm việc tại {employeeContext.branch.name}.</p></div>
      <div className="shift-options">
        {employeeContext.assignments.map(item=><article className={item.canConfirm?'':'unavailable'} key={item.id}><div><span>{item.shift.shiftCode}</span><strong>{formatShift(item.shift.startsAt)} – {formatShift(item.shift.endsAt)}</strong><small>Giao {item.handover.toShift}: {formatShift(item.handover.startsAt)} – {formatShift(item.handover.endsAt)}</small></div><button type="button" disabled={loading||!item.canConfirm} onClick={()=>void confirmShift(item)}>{loading?'Đang tạo phiên...':item.canConfirm?'Xác nhận ca':item.availability==='UPCOMING'?'Chưa đến giờ':'Ca đã kết thúc'}</button></article>)}
      </div>
      {!employeeContext.assignments.length&&<div className="login-notice"><strong>Chưa tải được danh sách ca</strong><span>Vui lòng tải lại trang sau khi dữ liệu ca được đồng bộ.</span></div>}
    </>}

    {error&&<p className="auth-error" role="alert"><b>!</b>{error}</p>}
  </section>;
}
