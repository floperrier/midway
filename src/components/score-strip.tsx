import type { ReactNode } from "react";

export type Score = {
  label: string;
  value: ReactNode;
  note?: string;
};

/** The booth scoreboard: one painted panel split by hairlines, rather than a
 *  row of identical floating cards. */
export function ScoreStrip({ scores }: { scores: Array<Score> }) {
  return (
    <dl className="border-border divide-border grid divide-y rounded-md border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 [&>div+div]:sm:border-l">
      {scores.map((s) => (
        <div key={s.label} className="border-border px-5 py-6">
          <dt className="text-muted-foreground text-xs tracking-wide">
            {s.label}
          </dt>
          <dd className="numeral mt-2 text-4xl md:text-5xl">{s.value}</dd>
          {s.note ? (
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
              {s.note}
            </p>
          ) : null}
        </div>
      ))}
    </dl>
  );
}
