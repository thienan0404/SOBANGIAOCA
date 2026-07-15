import {LoginForm} from './login-form';

export default function LoginPage(){
  return <main className="auth-screen">
    <section className="auth-hero">
      <div className="auth-brand"><span className="brand-mark">A25</span><div><strong>A25 HOTEL</strong><small>HỆ THỐNG VẬN HÀNH</small></div></div>
      <div className="auth-copy"><span>SỔ BÀN GIAO ĐIỆN TỬ</span><h1>Tiếp nối công việc.<br/>Vận hành liền mạch.</h1><p>Tập trung mọi thông tin ca trực, đảm bảo công việc được bàn giao đầy đủ và đúng người.</p></div>
      <div className="auth-trust"><i/> Hệ thống nội bộ được bảo mật</div>
    </section>
    <LoginForm/>
  </main>;
}