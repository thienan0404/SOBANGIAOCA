import {BottomNavigation} from './bottom-navigation';

export function AppShell({children}:{children:React.ReactNode}) {
  return <main className="app-shell">
    <header className="topbar">
      <div className="topline">
        <span className="avatar" aria-hidden="true">A25</span>
        <div className="hotel">
          <span>A25 Hotel</span>
          <small>Sổ bàn giao ca lễ tân</small>
        </div>
        <span className="live-status"><i/> Trực tuyến</span>
        <form action="/auth/signout" method="post">
          <button className="header-action" aria-label="Đăng xuất" title="Đăng xuất">↗</button>
        </form>
      </div>
    </header>
    <section className="content">{children}</section>
    <BottomNavigation/>
  </main>;
}