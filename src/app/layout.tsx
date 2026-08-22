import type { Metadata, Viewport } from "next";
import ThemeProvider from "@/components/ThemeProvider";
import ViewportLock from "@/components/ViewportLock";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The desk is an application, not a document. Left scalable, a two-finger
  // or swipe gesture on iPad leaves the whole page zoomed in with no way back
  // to a known scale, and focusing any of the dense 8-11px inputs makes Safari
  // zoom to fit it. Pinning the scale is also what stops that focus zoom.
  //
  // Safari honours this when the desk is installed to the Home Screen; in the
  // browser it ignores user-scalable and the gesture listeners in
  // ViewportLock do the work instead.
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // Let the layout resize rather than have the keyboard scroll the shell
  // out from under itself.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#303238" />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript() }} />
      </head>
      <body><ViewportLock /><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  );
}
