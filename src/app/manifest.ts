import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/charts",
    name: "Kwant Desk",
    short_name: "Kwant Desk",
    description: "Private quantitative research workspace.",
    start_url: "/charts",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#000000",
    theme_color: "#303238",
    icons: [
      {
        src: "/icons/kwantdesk-app-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/kwantdesk-app-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/kwantdesk-app-1024.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Charts",
        short_name: "Charts",
        url: "/charts",
        icons: [{ src: "/icons/kwantdesk-app-192.png", sizes: "192x192" }],
      },
      {
        name: "GEX Vue",
        short_name: "GEX Vue",
        url: "/gamvue",
        icons: [{ src: "/icons/kwantdesk-app-192.png", sizes: "192x192" }],
      },
      {
        name: "Liquidity Map",
        short_name: "Liq Map",
        url: "/liqmap",
        icons: [{ src: "/icons/kwantdesk-app-192.png", sizes: "192x192" }],
      },
    ],
  };
}
