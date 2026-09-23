import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  createBrand,
  deleteBrand,
  listBrands,
  updateBrand,
} from "@/server/functions";
import {
  ESP_LABEL,
  ESP_PROVIDERS,
  type EspProvider,
} from "@/lib/campaign-options";
import { Field, ValidatedForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Brand } from "@/db/schema";

export const Route = createFileRoute("/_authed/brands")({
  loader: () => listBrands(),
  component: BrandsPage,
});

const selectClass =
  "border-input bg-transparent dark:bg-input/30 h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs focus-visible:ring-ring/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:outline-none";

function readForm(form: HTMLFormElement) {
  const f = new FormData(form);
  return {
    name: String(f.get("name")),
    logoUrl: String(f.get("logoUrl") ?? ""),
    primaryColor: String(f.get("primaryColor")),
    accentColor: String(f.get("accentColor")),
    espProvider: String(f.get("espProvider")) as EspProvider,
  };
}

/** One form for both creating and editing — the fields are identical, so a
 *  second copy would only be a second place to forget a change. */
function BrandForm({
  brand,
  onDone,
  onCancel,
}: {
  brand?: Brand;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = readForm(e.currentTarget);
    setPending(true);
    try {
      if (brand) {
        await updateBrand({ data: { ...data, id: brand.id } });
        toast.success("Brand saved");
      } else {
        await createBrand({ data });
        toast.success("Brand added");
      }
      onDone();
    } catch {
      toast.error(
        brand
          ? "Those changes could not be saved."
          : "That brand could not be saved.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <ValidatedForm
      onSubmit={onSubmit}
      className="border-border grid gap-5 rounded-md border p-5 sm:grid-cols-2"
    >
      <Field label="Brand name" error="Give the brand a name.">
        <Input
          name="name"
          required
          maxLength={80}
          defaultValue={brand?.name}
          placeholder="MUD\WTR"
        />
      </Field>

      <Field
        label="Logo URL"
        hint="Optional."
        error="Use a full URL, or leave it empty."
      >
        <Input
          type="url"
          name="logoUrl"
          spellCheck={false}
          defaultValue={brand?.logoUrl ?? ""}
          placeholder="https://cdn.example.com/logo.svg"
        />
      </Field>

      <Field label="Primary colour" error="Pick a colour.">
        <Input
          type="color"
          name="primaryColor"
          required
          defaultValue={brand?.primaryColor ?? "#0f3b32"}
          className="h-9 w-20 p-1"
        />
      </Field>

      <Field label="Accent colour" error="Pick a colour.">
        <Input
          type="color"
          name="accentColor"
          required
          defaultValue={brand?.accentColor ?? "#f2c14e"}
          className="h-9 w-20 p-1"
        />
      </Field>

      <div className="field grid gap-1.5">
        <label className="text-sm font-medium" htmlFor="espProvider">
          Send leads to
        </label>
        <select
          id="espProvider"
          name="espProvider"
          className={selectClass}
          defaultValue={brand?.espProvider ?? "none"}
        >
          {ESP_PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {ESP_LABEL[p]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-end gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : brand ? "Save changes" : "Save brand"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </ValidatedForm>
  );
}

function BrandsPage() {
  const brands = Route.useLoaderData();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  async function refresh() {
    setAdding(false);
    setEditing(null);
    await router.invalidate();
  }

  async function onDelete(id: string, name: string) {
    if (
      !confirm(
        `Delete ${name}? Its campaigns and every lead they captured go too.`,
      )
    )
      return;
    try {
      await deleteBrand({ data: { id } });
      await router.invalidate();
      toast.success(`${name} deleted`);
    } catch {
      toast.error("That brand could not be deleted.");
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="numeral text-4xl md:text-5xl">Brands</h1>
          <p className="text-muted-foreground mt-3 max-w-[60ch] text-sm leading-relaxed">
            One per client you run games for. The art here dresses every game
            you build under it.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setAdding((v) => !v);
          }}
        >
          <Plus className="size-4" aria-hidden />
          {adding ? "Cancel" : "Add brand"}
        </Button>
      </div>

      {adding ? (
        <div className="mt-8">
          <BrandForm onDone={refresh} onCancel={() => setAdding(false)} />
        </div>
      ) : null}

      {brands.length === 0 && !adding ? (
        <div className="border-border mt-8 rounded-md border border-dashed px-6 py-12 text-center">
          <p className="text-base font-medium">No brands yet</p>
          <p className="text-muted-foreground mx-auto mt-2 max-w-[46ch] text-sm leading-relaxed">
            Add the first client you run games for. Everything else hangs off a
            brand.
          </p>
        </div>
      ) : (
        <ul className="border-border divide-border mt-8 divide-y rounded-md border">
          {brands.map(({ brand: b, campaigns }) => (
            <li key={b.id}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                <span
                  aria-hidden
                  className="size-8 shrink-0 rounded-sm border"
                  style={{
                    background: `linear-gradient(135deg, ${b.primaryColor} 50%, ${b.accentColor} 50%)`,
                  }}
                />
                <div className="min-w-0">
                  <p className="truncate font-medium">{b.name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    /{b.slug} · {ESP_LABEL[b.espProvider]}
                  </p>
                </div>
                <span className="text-muted-foreground ml-auto text-sm">
                  {campaigns} {campaigns === 1 ? "campaign" : "campaigns"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-expanded={editing === b.id}
                  onClick={() => {
                    setAdding(false);
                    setEditing((cur) => (cur === b.id ? null : b.id));
                  }}
                >
                  <Pencil className="size-4" aria-hidden />
                  <span className="sr-only">Edit {b.name}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(b.id, b.name)}
                >
                  <Trash2 className="size-4" aria-hidden />
                  <span className="sr-only">Delete {b.name}</span>
                </Button>
              </div>

              {editing === b.id ? (
                <div className="px-5 pb-5">
                  <BrandForm
                    brand={b}
                    onDone={refresh}
                    onCancel={() => setEditing(null)}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
