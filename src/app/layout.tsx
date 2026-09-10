import type { Metadata } from "next";
import { DemoAuthProvider } from "@/components/auth/demo-auth-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AWR Operations Control",
    template: "%s | AWR Operations",
  },
  description: "Internal real-time vehicle trip operations",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <DemoAuthProvider>{children}</DemoAuthProvider>
      </body>
    </html>
  );
}
