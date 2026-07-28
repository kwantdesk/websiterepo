import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kwant Desk",
  description: "Private quantitative research workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
