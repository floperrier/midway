import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  live: "bg-ticket text-[#14211e] border-transparent",
  draft: "border-border text-muted-foreground",
  ended: "bg-muted text-muted-foreground border-transparent",
};

/** Painted enamel plate. Shape and weight carry the state as well as colour,
 *  so it doesn't read as colour-only. */
export function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-semibold",
        STYLES[status] ?? STYLES.draft,
      )}
    >
      {status}
    </span>
  );
}
