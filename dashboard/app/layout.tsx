import type { Metadata } from "next";
import "./globals.css";
import ThemeRegistry from "./lib/ThemeRegistry";
import { SessionProvider } from "./lib/contexts/SessionContext";
import { OrganizationProvider } from "./lib/contexts/OrganizationContext";
import AppShell from "../components/AppShell";

export const metadata: Metadata = {
  title: "SynthetIQ — Autonomous EPR Compliance & Anti-Fraud Engine",
  description:
    "Zero-trust multi-agent compliance platform: BigQuery ERP audits, continuous double auctions, SCADA VFD fraud detection, and CPCB Form-1 dispatch.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeRegistry>
          <SessionProvider>
            <OrganizationProvider>
              <AppShell>{children}</AppShell>
            </OrganizationProvider>
          </SessionProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
