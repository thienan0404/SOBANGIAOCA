import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
const geist=Geist({variable:"--font-geist",subsets:["latin","latin-ext"]});
export const metadata:Metadata={title:"Sổ bàn giao ca lễ tân | A25 Hotel",description:"Theo dõi, tiếp nhận và xác nhận các nội dung bàn giao giữa các ca lễ tân."};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="vi"><body className={geist.variable}>{children}</body></html>}

