import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Copy, Download, Plus, Trash2 } from "lucide-react";
import {
  deleteCampaign,
  exportLeadsCsv,
  getCampaign,
  updateCampaign,
} from "@/server/functions";
import {
  CAMPAIGN_STATUSES,
  MECHANICS,
  MECHANIC_LABEL,
  TIERS,
  TIER_LABEL,
  type CampaignStatus,
  type Mechanic,
  type Prize,
  type Tier,
} from "@/lib/campaign-options";
import { Field, ValidatedForm } from "@/components/form";
import { ScoreStrip } from "@/components/score-strip";
import { StatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authed/campaigns/$id")({
  loader: ({ params }) => getCampaign({ data: { id: params.id } }),
  component: CampaignPage,
});

const selectClass =
  "border-input bg-transparent dark:bg-input/30 h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs focus-visible:ring-ring/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:outline-none";

function CampaignPage() {
  const { campaign: c, brand: b, leads } = Route.useLoaderData();
  const router = useRouter();
  const [prizes, setPrizes] = useState<Array<Prize>>(c.prizes);
  const [pending, setPending] = useState(false);

  const playUrl = `/play/${b.slug}/${c.slug}`;
  const rate = c.playCount > 0 ? leads.length / c.playCount : null;

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPending(true);
    try {
      await updateCampaign({
        data: {
          id: c.id,
          name: String(f.get("name")),
          mechanic: String(f.get("mechanic")) as Mechanic,
          tier: String(f.get("tier")) as Tier,
          status: String(f.get("status")) as CampaignStatus,
          prizes: prizes.filter((p) => p.label && p.code),
        },
      });
      await router.invalidate();
      toast.success("Campaign saved");
    } catch {
      toast.error("Those changes could not be saved.");
    } finally {
      setPending(false);
    }
  }

  async function onExport() {
    try {
      const { filename, csv } = await exportLeadsCsv({
        data: { campaignId: c.id },
      });
      const url = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("The list could not be exported.");
    }
  }

  async function onDelete() {
    if (!confirm(`Delete ${c.name}? Every lead it captured goes too.`)) return;
    await deleteCampaign({ data: { id: c.id } });
    await router.invalidate();
    toast.success("Campaign deleted");
    router.navigate({ to: "/campaigns" });
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(
        new URL(playUrl, window.location.origin).toString(),
      );
      toast.success("Link copied");
    } catch {
      toast.error("Copy the link from the address bar instead.");
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/campaigns" className="text-muted-foreground text-sm underline">
        Campaigns
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="numeral text-4xl md:text-5xl">{c.name}</h1>
        <StatusChip status={c.status} />
      </div>
      <p className="text-muted-foreground mt-3 text-sm">
        {b.name} · {MECHANIC_LABEL[c.mechanic]} · {TIER_LABEL[c.tier]}
      </p>

      <div className="mt-8">
        <ScoreStrip
          scores={[
            { label: "Leads captured", value: leads.length.toLocaleString() },
            { label: "Plays", value: c.playCount.toLocaleString() },
            {
              label: "Signup rate",
              value: rate === null ? "—" : `${(rate * 100).toFixed(1)}%`,
            },
            { label: "Prizes", value: prizes.length },
          ]}
        />
      </div>

      {/* The link the agency drops into the brand's popup */}
      <section className="border-border mt-8 flex flex-wrap items-center gap-3 rounded-md border px-5 py-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">Game link</p>
          <code className="text-muted-foreground block truncate text-xs">
            {playUrl}
          </code>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={copyUrl}>
            <Copy className="size-4" aria-hidden />
            Copy
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={playUrl} target="_blank" rel="noreferrer">
              Open
            </a>
          </Button>
        </div>
      </section>

      <ValidatedForm onSubmit={onSave} className="mt-12 grid gap-8">
        <section className="grid gap-5 sm:grid-cols-2">
          <h2 className="text-lg font-semibold sm:col-span-2">Setup</h2>

          <Field label="Campaign name" error="Give the campaign a name.">
            <Input name="name" defaultValue={c.name} required maxLength={80} />
          </Field>

          <div className="field grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              name="status"
              className={selectClass}
              defaultValue={c.status}
            >
              {CAMPAIGN_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="field grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="mechanic">
              Mechanic
            </label>
            <select
              id="mechanic"
              name="mechanic"
              className={selectClass}
              defaultValue={c.mechanic}
            >
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
            <select
              id="tier"
              name="tier"
              className={selectClass}
              defaultValue={c.tier}
            >
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {TIER_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="grid gap-4">
          <div>
            <h2 className="text-lg font-semibold">Prizes</h2>
            <p className="text-muted-foreground mt-1 max-w-[60ch] text-sm leading-relaxed">
              The discount ladder the game draws from. Weight decides how often
              each one lands — a weight of 60 against 20 shows up three times as
              often.
            </p>
          </div>

          {prizes.length === 0 ? (
            <p className="text-muted-foreground border-border rounded-md border border-dashed px-5 py-8 text-center text-sm">
              No prizes yet. A game with nothing to win captures nothing.
            </p>
          ) : (
            <ul className="grid gap-3">
              {prizes.map((p, i) => (
                <li key={i} className="grid gap-3 sm:grid-cols-[1fr_1fr_6rem_auto]">
                  <Input
                    aria-label={`Prize ${i + 1} label`}
                    placeholder="10% off"
                    value={p.label}
                    onChange={(e) =>
                      setPrizes((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, label: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <Input
                    aria-label={`Prize ${i + 1} discount code`}
                    placeholder="MIDWAY10"
                    value={p.code}
                    onChange={(e) =>
                      setPrizes((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, code: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    aria-label={`Prize ${i + 1} weight`}
                    value={p.weight}
                    onChange={(e) =>
                      setPrizes((prev) =>
                        prev.map((x, j) =>
                          j === i
                            ? { ...x, weight: Number(e.target.value) || 1 }
                            : x,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setPrizes((prev) => prev.filter((_, j) => j !== i))
                    }
                  >
                    <Trash2 className="size-4" aria-hidden />
                    <span className="sr-only">Remove prize {i + 1}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={prizes.length >= 12}
              onClick={() =>
                setPrizes((prev) => [
                  ...prev,
                  { label: "", code: "", weight: 20 },
                ])
              }
            >
              <Plus className="size-4" aria-hidden />
              Add prize
            </Button>
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
          <Button type="button" variant="outline" onClick={onDelete}>
            Delete campaign
          </Button>
        </div>
      </ValidatedForm>

      <section className="mt-16">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold">
            Leads{" "}
            <span className="text-muted-foreground font-normal">
              ({leads.length})
            </span>
          </h2>
          {leads.length > 0 ? (
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="size-4" aria-hidden />
              Export CSV
            </Button>
          ) : null}
        </div>

        {leads.length === 0 ? (
          <p className="text-muted-foreground border-border mt-4 rounded-md border border-dashed px-5 py-10 text-center text-sm">
            Nothing captured yet. Take the campaign live and share the game
            link.
          </p>
        ) : (
          <div className="border-border mt-4 overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">Email</th>
                  <th scope="col" className="px-4 py-2 font-medium">Phone</th>
                  <th scope="col" className="px-4 py-2 font-medium">Prize</th>
                  <th scope="col" className="px-4 py-2 font-medium">Code</th>
                  <th scope="col" className="px-4 py-2 font-medium">Captured</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {leads.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-2">{l.email}</td>
                    <td className="text-muted-foreground px-4 py-2">
                      {l.phone ?? "—"}
                    </td>
                    <td className="px-4 py-2">{l.prizeLabel ?? "—"}</td>
                    <td className="px-4 py-2">
                      <code className="text-xs">{l.discountCode ?? "—"}</code>
                    </td>
                    <td className="text-muted-foreground px-4 py-2 whitespace-nowrap">
                      {new Date(l.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
