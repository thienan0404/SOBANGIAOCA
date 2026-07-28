import type {Metadata, Viewport} from 'next';
import {QueryProvider} from '@/providers/query-provider';
import './globals.css';
import './system.css';

export const metadata:Metadata={title:'A25 Hotel | Sổ bàn giao ca',description:'Hệ thống bàn giao ca lễ tân điện tử dành cho vận hành A25 Hotel.',applicationName:'A25 - Sổ bàn giao ca'};
export const viewport:Viewport={width:'device-width',initialScale:1,minimumScale:1,maximumScale:1,userScalable:false,viewportFit:'cover',interactiveWidget:'resizes-content'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="vi"><head><meta charSet="utf-8"/></head><body><QueryProvider>{children}</QueryProvider></body></html>}