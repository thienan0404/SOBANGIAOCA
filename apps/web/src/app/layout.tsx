import type {Metadata} from 'next';import {Geist} from 'next/font/google';import {QueryProvider} from '@/providers/query-provider';import './globals.css';import './system.css';
const geist=Geist({variable:'--font-geist',subsets:['latin','latin-ext']});
export const metadata:Metadata={title:'A25 Electronic Handover',description:'Sổ bàn giao ca lễ tân điện tử',applicationName:'A25 Electronic Handover'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="vi"><body className={geist.variable}><QueryProvider>{children}</QueryProvider></body></html>}
