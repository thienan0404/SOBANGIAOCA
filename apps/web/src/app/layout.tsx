import type {Metadata} from 'next';
import {QueryProvider} from '@/providers/query-provider';
import './globals.css';
import './system.css';

export const metadata:Metadata={title:'A25 Hotel | Sổ bàn giao ca',description:'Hệ thống bàn giao ca lễ tân điện tử dành cho vận hành A25 Hotel.',applicationName:'A25 Electronic Handover'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="vi"><body><QueryProvider>{children}</QueryProvider></body></html>}