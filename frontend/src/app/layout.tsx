import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { TopBar } from "@/components/TopBar";

export const metadata: Metadata = {
  title: "PACT — Trustless Challenge Protocol",
  description: "Stake on yourself. Let the chain decide.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <TopBar />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
