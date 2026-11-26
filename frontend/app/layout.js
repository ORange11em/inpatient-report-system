import "./globals.css";
import "@/styles/foundation.css";
import "@/styles/text-size.css";
import { Sarabun } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { MaintenanceNotice } from "@/components/MaintenanceNotice";
import { TextSizeControl } from "@/components/TextSizeControl";
import { isMaintenanceModeEnabled } from "@/lib/maintenance.mjs";

const sarabun = Sarabun({ subsets: ["thai", "latin"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-thai" });

export const metadata = {
  title: "ระบบบันทึกข้อมูลผู้ป่วยใน",
  description: "ระบบบันทึกและทบทวนข้อมูลรายหอผู้ป่วย"
};

export default function RootLayout({ children }) {
  const maintenance = isMaintenanceModeEnabled(process.env.NEXT_PUBLIC_MAINTENANCE_MODE);
  return (
    <html lang="th" className={sarabun.variable}>
      {/* ส่วนขยายเบราว์เซอร์อาจเติมแอตทริบิวต์บน body ก่อน React เริ่มทำงาน */}
      <body suppressHydrationWarning>
        <TextSizeControl />
        {maintenance ? <MaintenanceNotice /> : <AuthProvider>{children}</AuthProvider>}
      </body>
    </html>
  );
}
