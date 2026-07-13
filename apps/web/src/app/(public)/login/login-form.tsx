'use client';

import {zodResolver} from '@hookform/resolvers/zod';
import {useForm} from 'react-hook-form';
import {z} from 'zod';
import {createClient} from '@/lib/supabase/client';
import {useRouter} from 'next/navigation';
import {useState} from 'react';

const schema=z.object({email:z.string().email('Email không hợp lệ'),password:z.string().min(6,'Mật khẩu tối thiểu 6 ký tự')});
type FormData=z.infer<typeof schema>;

export function LoginForm(){
  const router=useRouter();
  const [error,setError]=useState('');
  const {register,handleSubmit,formState:{errors,isSubmitting}}=useForm<FormData>({resolver:zodResolver(schema)});
  async function submit(values:FormData){
    setError('');
    const {error}=await createClient().auth.signInWithPassword(values);
    if(error){setError(error.code==='invalid_credentials'?'Email hoặc mật khẩu chưa chính xác.':`Không thể đăng nhập (${error.code??'AUTH_ERROR'}).`);return}
    router.replace('/dashboard');router.refresh();
  }
  return <form className="auth-card" onSubmit={handleSubmit(submit)}>
    <div className="auth-card-header"><span>ĐĂNG NHẬP NHÂN VIÊN</span><h2>Chào mừng trở lại</h2><p>Sử dụng tài khoản A25 để tiếp tục.</p></div>
    <div className="auth-fields">
      <label>Email nhân viên<input {...register('email')} type="email" placeholder="tenban@a25hotel.com" autoComplete="email"/>{errors.email&&<small>{errors.email.message}</small>}</label>
      <label>Mật khẩu<input {...register('password')} type="password" placeholder="Nhập mật khẩu" autoComplete="current-password"/>{errors.password&&<small>{errors.password.message}</small>}</label>
    </div>
    {error&&<p className="auth-error" role="alert"><b>!</b>{error}</p>}
    <button className="login-button" disabled={isSubmitting}>{isSubmitting?<><i/>Đang xác thực...</>:'Đăng nhập hệ thống'}</button>
    <div className="auth-help"><a href="/forgot-password">Quên mật khẩu?</a><span>Liên hệ quản trị viên nếu cần hỗ trợ</span></div>
  </form>;
}