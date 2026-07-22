import Image from 'next/image';
import {BottomNavigation} from './bottom-navigation';

export function AppShell({children}:{children:React.ReactNode}){
  return <main className="app-shell handover-app">
    <header className="topbar handover-topbar">
      <div className="topline">
        <span className="avatar" aria-hidden="true"><Image src="/a25-logo.png" alt="" width={32} height={32} priority/></span>
        <div className="hotel"><span>A25 · SỔ GIAO CA</span><small>Vận hành lễ tân điện tử</small></div>
        <span className="live-status" aria-label="Thiết bị đang trực tuyến"><i/> Trực tuyến</span>
      </div>
    </header>
    <section className="content handover-content">{children}</section>
    <BottomNavigation/>
  </main>;
}