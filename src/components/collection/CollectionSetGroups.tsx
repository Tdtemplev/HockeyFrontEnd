import type { CardCopyOut } from "@/lib/slab/types";
import { formatCurrency } from "@/lib/slab/format";
import { CardListRow } from "@/components/collection/CardListRow";
import { CardTile } from "@/components/collection/CardTile";

interface CollectionSetGroupsProps {
  items: CardCopyOut[];
  view: "grid" | "list";
}

export function CollectionSetGroups({ items, view }: CollectionSetGroupsProps) {
  const groups = new Map<string, CardCopyOut[]>();

  for (const copy of items) {
    const setName = copy.card?.set_name ?? "Unknown set";
    const bucket = groups.get(setName) ?? [];
    bucket.push(copy);
    groups.set(setName, bucket);
  }

  const sorted = [...groups.entries()].sort((a, b) => {
    const valueA = a[1].reduce(
      (sum, copy) => sum + Number(copy.market?.fair_market_value ?? 0),
      0,
    );
    const valueB = b[1].reduce(
      (sum, copy) => sum + Number(copy.market?.fair_market_value ?? 0),
      0,
    );
    return valueB - valueA;
  });

  return (
    <div className="space-y-6">
      {sorted.map(([setName, copies]) => {
        const setValue = copies.reduce(
          (sum, copy) => sum + Number(copy.market?.fair_market_value ?? 0),
          0,
        );

        return (
          <section
            key={setName}
            className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4"
          >
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-semibold text-white">{setName}</h3>
                <p className="text-sm text-slate-400">
                  {copies.length} card{copies.length === 1 ? "" : "s"}
                </p>
              </div>
              <p className="text-sm text-slate-300">
                Set value{" "}
                <span className="font-semibold text-white">
                  {formatCurrency(String(setValue))}
                </span>
              </p>
            </div>

            {view === "grid" ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {copies.map((copy) => (
                  <CardTile key={copy.uuid} copy={copy} />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {copies.map((copy) => (
                  <CardListRow key={copy.uuid} copy={copy} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
