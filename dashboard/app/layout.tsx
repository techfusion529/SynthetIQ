import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import ThemeRegistry from "./lib/ThemeRegistry";
import { SessionProvider } from "./lib/contexts/SessionContext";
import { OrganizationProvider } from "./lib/contexts/OrganizationContext";
import { NotificationProvider } from "./lib/contexts/NotificationContext";
import AppShell from "../components/AppShell";

export const metadata: Metadata = {
  title: "SynthetIQ — Autonomous EPR Compliance & Anti-Fraud Engine",
  description:
    "Zero-trust multi-agent compliance platform: BigQuery ERP audits, continuous double auctions, SCADA VFD fraud detection, and CPCB Form-1 dispatch.",
};

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plex.variable}>
      <body>
        <ThemeRegistry>
          <SessionProvider>
            <OrganizationProvider>
              <NotificationProvider>
                <AppShell>{children}</AppShell>
              </NotificationProvider>
            </OrganizationProvider>
          </SessionProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
