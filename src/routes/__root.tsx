/// <reference types="vite/client" />
import type { ReactNode } from "react";
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import appCss from "@/styles/app.css?url";

// Runs before paint so a dark-mode reload never flashes light.
const themeInit = `(()=>{try{const t=localStorage.getItem("theme")||"system";const d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme:dark)").matches);document.documentElement.classList.toggle("dark",d);}catch{}})()`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Midway" },
      // Browser chrome follows the palette rather than defaulting to white.
      {
        name: "theme-color",
        media: "(prefers-color-scheme: light)",
        content: "#fbfaf7",
      },
      {
        name: "theme-color",
        media: "(prefers-color-scheme: dark)",
        content: "#0d1714",
      },
      {
        name: "description",
        content:
          "Branded lead-capture games for DTC brands. Build the campaign, host the game, hand over the list.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Anton&family=Archivo:ital,wght@0,400..700;1,400..600&display=swap",
      },
    ],
    scripts: [{ children: themeInit }],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster position="top-right" />
        <Scripts />
      </body>
    </html>
  );
}
