import type { Metadata } from "next";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
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
