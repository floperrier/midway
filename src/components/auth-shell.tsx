import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

/** The booth front: deep enamel panel with the wordmark, form on the canvas.
 *  Collapses to a banner above the form on small screens. */
export function AuthShell({
  title,
  intro,
  children,
  footer,
}: {
  title: string;
  intro: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[minmax(0,26rem)_1fr]">
      <aside className="bg-booth text-sidebar-foreground flex flex-col justify-between gap-10 px-6 py-8 md:px-10 md:py-12">
        <Link to="/" className="inline-flex items-baseline gap-2 w-fit">
          <span className="numeral text-3xl text-ticket">MIDWAY</span>
        </Link>
        <p className="max-w-[34ch] text-balance text-lg leading-snug md:text-2xl">
          Branded games that trade a discount for an email address.
        </p>
        <p className="text-sidebar-foreground/70 max-w-[46ch] text-sm leading-relaxed">
          Build the campaign, host the game, hand the list to Klaviyo. One booth
          per brand, no two alike.
        </p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12 md:px-10">
        <div className="w-full max-w-sm">
          <h1 className="numeral text-4xl md:text-5xl">{title}</h1>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            {intro}
          </p>
          <div className="mt-8">{children}</div>
          <div className="text-muted-foreground mt-8 text-sm">{footer}</div>
        </div>
      </main>
    </div>
  );
}
