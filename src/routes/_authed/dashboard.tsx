import { createFileRoute, Link } from "@tanstack/react-router";
import { getDashboard, listCampaigns } from "@/server/functions";
import { ScoreStrip } from "@/components/score-strip";
import { StatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authed/dashboard")({
  loader: async () => ({
    stats: await getDashboard(),
    campaigns: (await listCampaigns()).slice(0, 5),
  }),
  component: DashboardPage,
});

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function DashboardPage() {
  const { stats, campaigns } = Route.useLoaderData();

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="numeral text-4xl md:text-5xl">Dashboard</h1>
      <p className="text-muted-foreground mt-3 max-w-[60ch] text-sm leading-relaxed">
        Every booth you have running, and what it has collected.
      </p>

      <div className="mt-8">
        <ScoreStrip
          scores={[
            {
              label: "Leads captured",
              value: stats.leads.toLocaleString(),
            },
            {
              label: "Signup rate",
              value: stats.signupRate === null ? "—" : pct(stats.signupRate),
              note:
                stats.signupRate === null
                  ? "No plays recorded yet."
                  : "Merchants running stock spin wheels report 5–14%.",
            },
            { label: "Live campaigns", value: stats.liveCampaigns },
            { label: "Brands", value: stats.brands },
          ]}
        />
      </div>

      <section className="mt-12">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold">Recent campaigns</h2>
          <Link to="/campaigns" className="text-sm underline">
            All campaigns
          </Link>
        </div>

        {campaigns.length === 0 ? (
          <div className="border-border mt-4 rounded-md border border-dashed px-6 py-12 text-center">
            <p className="text-base font-medium">No campaigns yet</p>
            <p className="text-muted-foreground mx-auto mt-2 max-w-[46ch] text-sm leading-relaxed">
              Add a brand first, then build its first game. The game collects
              the email, Midway keeps the list.
            </p>
            <Button asChild className="mt-6">
              <Link to="/brands">Add a brand</Link>
            </Button>
          </div>
        ) : (
          <ul className="border-border divide-border mt-4 divide-y rounded-md border">
            {campaigns.map(({ campaign, brandName, leads }) => (
              <li key={campaign.id}>
                <Link
                  to="/campaigns/$id"
                  params={{ id: campaign.id }}
                  className="hover:bg-muted/60 flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 transition-colors"
                >
                  <span className="font-medium">{campaign.name}</span>
                  <span className="text-muted-foreground text-sm">
                    {brandName}
                  </span>
                  <StatusChip status={campaign.status} />
                  <span className="numeral ml-auto text-xl">{leads}</span>
                  <span className="text-muted-foreground text-xs">leads</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
