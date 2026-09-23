import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { getPublicCampaign } from "@/server/public";
import { ValidatedForm } from "@/components/form";

/* The hosted booth. A bespoke build replaces this page per campaign; the
   contract it has to honour is the one exercised here — record the play, then
   POST the email and render whatever prize the server hands back. */

export const Route = createFileRoute("/play/$brandSlug/$campaignSlug")({
  loader: ({ params }) => getPublicCampaign({ data: params }),
  component: PlayPage,
});

type Won = { prizeLabel: string | null; discountCode: string | null; repeat: boolean };

function PlayPage() {
  const game = Route.useLoaderData();
  const { brandSlug, campaignSlug } = Route.useParams();
  const [stage, setStage] = useState<"idle" | "form">("idle");
  const [won, setWon] = useState<Won | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!game) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <h1 className="numeral text-4xl">This booth is closed</h1>
          <p className="text-muted-foreground mt-3 text-sm">
            The game you're looking for isn't running right now.
          </p>
        </div>
      </main>
    );
  }

  const endpoint = `/api/play/${brandSlug}/${campaignSlug}`;

  async function onPlay() {
    setStage("form");
    // Fire and forget: a failed counter must never block the capture.
    void fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ action: "play" }),
    }).catch(() => {});
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({
        action: "capture",
        email: String(f.get("email")),
        phone: String(f.get("phone") ?? "") || undefined,
      }),
    })
      .then((r) => r.json() as Promise<Won & { ok?: boolean }>)
      .catch(() => null);

    setPending(false);
    if (!res?.ok) {
      setError("This game has closed. Nothing was saved.");
      return;
    }
    setWon(res);
  }

  return (
    <main
      className="grid min-h-dvh place-items-center px-6 py-12"
      style={{ background: game.primaryColor, color: game.accentColor }}
    >
      <div className="w-full max-w-md text-center">
        {game.logoUrl ? (
          <img
            src={game.logoUrl}
            alt={game.brandName}
            width={160}
            height={40}
            // Reserved box keeps the headline from jumping when the logo lands.
            className="mx-auto mb-8 h-10 w-auto object-contain"
          />
        ) : (
          <p className="mb-8 text-sm tracking-wide opacity-80">
            {game.brandName}
          </p>
        )}

        {won ? (
          <>
            <h1 className="numeral text-5xl">
              {won.prizeLabel ?? "Thanks for playing"}
            </h1>
            {won.discountCode ? (
              <>
                <p className="mt-4 text-sm opacity-80">
                  {won.repeat
                    ? "You already played — here's your code again."
                    : "Use this at checkout."}
                </p>
                <p
                  className="mt-6 inline-block rounded-sm px-5 py-3 text-2xl font-bold tracking-widest"
                  style={{ background: game.accentColor, color: game.primaryColor }}
                >
                  {won.discountCode}
                </p>
              </>
            ) : (
              <p className="mt-4 text-sm opacity-80">
                You're on the list. We'll be in touch.
              </p>
            )}
          </>
        ) : stage === "idle" ? (
          <>
            <h1 className="numeral text-5xl leading-none">{game.name}</h1>
            {game.prizeLabels.length > 0 ? (
              <p className="mt-4 text-sm opacity-80">
                Up for grabs: {game.prizeLabels.join(" · ")}
              </p>
            ) : null}
            <button
              type="button"
              onClick={onPlay}
              className="mt-10 rounded-sm px-8 py-4 text-lg font-bold focus-visible:outline-2 focus-visible:outline-offset-4"
              style={{ background: game.accentColor, color: game.primaryColor }}
            >
              Play
            </button>
          </>
        ) : (
          <ValidatedForm onSubmit={onSubmit} className="field grid gap-4 text-left">
            <h1 className="numeral text-center text-3xl">Where do we send it?</h1>

            <div className="grid gap-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                name="email"
                required
                autoComplete="email"
                spellCheck={false}
                autoCapitalize="none"
                className="rounded-sm border-2 border-current/30 bg-white/95 px-3 py-2.5 text-base text-neutral-900 focus-visible:border-current focus-visible:outline-none"
              />
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="phone" className="text-sm font-medium">
                Phone <span className="opacity-70">(optional)</span>
              </label>
              <input
                id="phone"
                type="tel"
                name="phone"
                autoComplete="tel"
                className="rounded-sm border-2 border-current/30 bg-white/95 px-3 py-2.5 text-base text-neutral-900 focus-visible:border-current focus-visible:outline-none"
              />
            </div>

            {error ? (
              <p role="alert" className="text-sm font-medium">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="mt-2 rounded-sm px-8 py-4 text-lg font-bold disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4"
              style={{ background: game.accentColor, color: game.primaryColor }}
            >
              {pending ? "Checking…" : "Reveal my code"}
            </button>
          </ValidatedForm>
        )}
      </div>
    </main>
  );
}
