import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SafeCargo",
  description: "Intelligent Cargo Monitoring and Verification",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}