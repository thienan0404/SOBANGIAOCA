import {BottomNavigation} from './bottom-navigation';

export function AppShell({children}:{children:React.ReactNode}) {
  return <main className="app-shell">
    <header className="topbar">
      <div className="topline">
        <span className="avatar" aria-hidden="true">A25</span>
        <div className="hotel">
          <span>A25 Hotel</span>
          <small>Quản lý bàn giao ca</small>
        </div>
        <span className="live-status" aria-label="Hệ thống đang trực tuyến"><i/> Trực tuyến</span>
        <form action="/auth/signout" method="post">
          <button className="logout-button" aria-label="Đăng xuất khỏi hệ thống" title="Đăng xuất"><span>Đăng xuất</span><b aria-hidden="true">↗</b></button>
        </form>
      </div>
    </header>
    <section className="content">{children}</section>
    <BottomNavigation/>
  </main>;
}