import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createCampaign, listBrands, listCampaigns } from "@/server/functions";
import {
  MECHANICS,
  MECHANIC_LABEL,
  TIERS,
  TIER_LABEL,
  type Mechanic,
  type Tier,
} from "@/lib/campaign-options";
import { Field, ValidatedForm } from "@/components/form";
import { StatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authed/campaigns")({
  loader: async () => ({
    campaigns: await listCampaigns(),
    brands: await listBrands(),
  }),
  component: CampaignsPage,
});

const selectClass =
  "border-input bg-transparent dark:bg-input/30 h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs focus-visible:ring-ring/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:outline-none";

function CampaignsPage() {
  const { campaigns, brands } = Route.useLoaderData();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState(false);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPending(true);
    try {
      const { id } = await createCampaign({
        data: {
          brandId: String(f.get("brandId")),
          name: String(f.get("name")),
          mechanic: String(f.get("mechanic")) as Mechanic,
          tier: String(f.get("tier")) as Tier,
          status: "draft",
          prizes: [],
        },
      });
      setAdding(false);
      await router.invalidate();
      toast.success("Campaign created");
      router.navigate({ to: "/campaigns/$id", params: { id } });
    } catch {
      toast.error("That campaign could not be created.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="numeral text-4xl md:text-5xl">Campaigns</h1>
          <p className="text-muted-foreground mt-3 max-w-[60ch] text-sm leading-relaxed">
            One game per campaign. Set the prizes, take it live, watch the list
            fill.
          </p>
        </div>
        {brands.length > 0 ? (
          <Button onClick={() => setAdding((v) => !v)}>
            <Plus className="size-4" aria-hidden />
            {adding ? "Cancel" : "New campaign"}
          </Button>
        ) : null}
      </div>

      {adding ? (
        <ValidatedForm
          onSubmit={onCreate}
          className="border-border mt-8 grid gap-5 rounded-md border p-5 sm:grid-cols-2"
        >
          <div className="field grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="brandId">
              Brand
            </label>
            <select id="brandId" name="brandId" className={selectClass} required>
              {brands.map(({ brand: b }) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <Field label="Campaign name" error="Give the campaign a name.">
            <Input name="name" required maxLength={80} placeholder="Black Friday drop" />
          </Field>

          <div className="field grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="mechanic">
              Mechanic
            </label>
            <select id="mechanic" name="mechanic" className={selectClass} defaultValue="spin">
              {MECHANICS.map((m) => (
                <option key={m} value={m}>
                  {MECHANIC_LABEL[m]}
                </option>
              ))}
            </select>
          </div>

          <div className="field grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="tier">
              Tier
            </label>
            <select id="tier" name="tier" className={selectClass} defaultValue="starter">
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {TIER_LABEL[t]}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create campaign"}
            </Button>
          </div>
        </ValidatedForm>
      ) : null}

      {brands.length === 0 ? (
        <div className="border-border mt-8 rounded-md border border-dashed px-6 py-12 text-center">
          <p className="text-base font-medium">Add a brand first</p>
          <p className="text-muted-foreground mx-auto mt-2 max-w-[46ch] text-sm leading-relaxed">
            Campaigns hang off a brand, so the game can wear its art.
          </p>
          <Button asChild className="mt-6">
            <Link to="/brands">Add a brand</Link>
          </Button>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="border-border mt-8 rounded-md border border-dashed px-6 py-12 text-center">
          <p className="text-base font-medium">No campaigns yet</p>
          <p className="text-muted-foreground mx-auto mt-2 max-w-[46ch] text-sm leading-relaxed">
            Build the first game for one of your brands.
          </p>
        </div>
      ) : (
        <ul className="border-border divide-border mt-8 divide-y rounded-md border">
          {campaigns.map(({ campaign: c, brandName, leads }) => (
            <li key={c.id}>
              <Link
                to="/campaigns/$id"
                params={{ id: c.id }}
                className="hover:bg-muted/60 grid gap-x-4 gap-y-1 px-5 py-4 transition-colors sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="truncate font-medium">{c.name}</span>
                    <StatusChip status={c.status} />
                  </div>
                  <p className="text-muted-foreground mt-1 truncate text-xs">
                    {brandName} · {MECHANIC_LABEL[c.mechanic]} ·{" "}
                    {c.playCount.toLocaleString()} plays
                  </p>
                </div>
                <div className="flex items-baseline gap-1.5 sm:justify-end">
                  <span className="numeral text-2xl">{leads}</span>
                  <span className="text-muted-foreground text-xs">leads</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
