'use client';
import {usePathname} from 'next/navigation';
const nav:ReadonlyArray<readonly [string,string,string]>=[['⌂','Tổng quan','/dashboard'],['☑','Bàn giao','/handovers'],['⇄','Giao → nhận','/handovers/participants'],['▤','Báo cáo','/reports'],['⚙','Cài đặt','/settings']];
export function BottomNavigation(){const path=usePathname();return <nav className="bottom-nav" aria-label="Điều hướng chính">{nav.map(([icon,label,href])=><a key={href} href={href} className={path.startsWith(href)?'active':''}><span>{icon}</span><small>{label}</small></a>)}</nav>}
