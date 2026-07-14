import {BottomNavigation} from './bottom-navigation';
import {LogoutButton} from './logout-button';

export function AppShell({children}:{children:React.ReactNode}) {
  return <main className="app-shell">
    <header className="topbar">
      <div className="topline">
        <span className="avatar" aria-hidden="true">
          <img src="/a25-logo.png" alt="" />
        </span>
        <div className="hotel">
          <span>A25 Hotel</span>
          <small>Quản lý bàn giao ca</small>
        </div>
        <span className="live-status" aria-label="Hệ thống đang trực tuyến"><i/> Trực tuyến</span>
        <LogoutButton/>
      </div>
    </header>
    <section className="content">{children}</section>
    <BottomNavigation/>
  </main>;
}