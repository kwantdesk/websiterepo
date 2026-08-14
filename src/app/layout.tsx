import type { Metadata } from "next";
import ThemeProvider from "@/components/ThemeProvider";
import { themeBootstrapScript } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kwant Desk",
  description: "Private quantitative research workspace.",
  applicationName: "Kwant Desk",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/kwantdesk-app-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/kwantdesk-app-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/kwantdesk-app-192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kwant Desk",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#303238" />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript() }} />
      </head>
      <body><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  );
}
