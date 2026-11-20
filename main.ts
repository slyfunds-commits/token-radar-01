import { readFileSync, writeFileSync } from "node:fs";

const snapshotPath =
  "/home/hatch/workspace/makefun/token-radar-01-kit/input/snapshot.json";
const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));

const GLOBAL_MEDIAN = 0.246;
const SHRINK_STRENGTH = 5;
const AS_OF = new Date(`${snapshot.as_of}T00:00:00Z`).getTime();

function median(values: number[]): number {
  if (!values.length) return GLOBAL_MEDIAN;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

function liveComparable(protocol: any): boolean {
  return (
    Number.isFinite(protocol.mcap_usd) &&
    protocol.mcap_usd > 0 &&
    protocol.tvl_usd > 0 &&
    Boolean(protocol.gecko_id || protocol.symbol)
  );
}

const liveRatios = snapshot.protocols
  .filter(liveComparable)
  .map((protocol: any) => protocol.mcap_usd / protocol.tvl_usd);
const globalMedian = median(liveRatios);

const ratiosByCategory = new Map<string, number[]>();
for (const protocol of snapshot.protocols) {
  if (!protocol.category || !liveComparable(protocol)) continue;
  const ratios = ratiosByCategory.get(protocol.category) ?? [];
  ratios.push(protocol.mcap_usd / protocol.tvl_usd);
  ratiosByCategory.set(protocol.category, ratios);
}

function categoryMultiple(category: string | null): number {
  if (!category) return (globalMedian + SHRINK_STRENGTH * GLOBAL_MEDIAN) /
    (1 + SHRINK_STRENGTH);
  const ratios = ratiosByCategory.get(category) ?? [];
  if (!ratios.length) {
    return (globalMedian + SHRINK_STRENGTH * GLOBAL_MEDIAN) /
      (1 + SHRINK_STRENGTH);
  }
  const categoryMedian = median(ratios);
  return (
    (ratios.length * categoryMedian +
      SHRINK_STRENGTH * GLOBAL_MEDIAN) /
    (ratios.length + SHRINK_STRENGTH)
  );
}

function growthFactor(change7d: number | null): number {
  if (change7d === null || !Number.isFinite(change7d)) return 1;
  return Math.max(0.5, Math.min(1.5, 1 + change7d / 100));
}

function maturityFactor(listedAt: string | null): number {
  if (!listedAt) return 0.8;
  const listed = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(listed)) return 0.8;
  const years = Math.max(0, (AS_OF - listed) / (365.25 * 24 * 60 * 60 * 1000));
  return Math.max(0.75, Math.min(1.25, 0.75 + 0.05 * years));
}

function chainMultiplier(chains: string[]): number {
  if (!Array.isArray(chains) || !chains.length) return 1;
  const chainFactors: Record<string, number> = {
    Ethereum: 1.08,
    Solana: 1.09,
    Base: 1.06,
    Arbitrum: 1.05,
    Optimism: 1.05,
    Avalanche: 1.04,
    Polygon: 1.04,
    BSC: 1.03,
  };
  let multiplier = 1;
  for (const chain of chains) {
    multiplier *= 1 + ((chainFactors[chain] ?? 1.02) - 1) * 0.5;
  }
  return Math.min(1.30, multiplier);
}

function impliedValue(protocol: any): number {
  const value =
    protocol.tvl_usd *
    categoryMultiple(protocol.category) *
    growthFactor(protocol.change_7d) *
    maturityFactor(protocol.listed_at) *
    chainMultiplier(protocol.chains);
  return Math.max(1, Math.round(value));
}

function capitalFor(tvl: number): number {
  const floor = snapshot.floor_usd;
  if (tvl <= floor) return 50;
  const maximum = Math.max(...snapshot.protocols.map((p: any) => p.tvl_usd));
  const ratio =
    Math.log1p((tvl - floor) / floor) /
    Math.log1p((maximum - floor) / floor);
  return Math.round(Math.max(50, Math.min(250, 50 + 200 * ratio)));
}

function farmSteps(protocol: any): string[] {
  const capital = capitalFor(protocol.tvl_usd);
  const tvl = `$${(protocol.tvl_usd / 1_000_000).toFixed(1)}M`;
  const change =
    protocol.change_7d === null
      ? "growth is unreported"
      : `${protocol.change_7d >= 0 ? "+" : ""}${protocol.change_7d.toFixed(1)}% over 7d`;
  const category = protocol.category ?? "uncategorized";
  return [
    `Set a ${capital}-dollar weekly farming budget; fund only a wallet and keep at least ${capital / 2}-dollars reserved as gas and withdrawal buffer.`,
    `Verify the official ${protocol.name} app and contract addresses before connecting; bookmark the app and reject unsolicited links or approvals.`,
    `Supply no more than ${capital - 20}-dollars across 2 positions for one week, using a stable pair and spreading activity over at least 3 sessions.`,
    `Complete ${protocol.name}'s core ${category} action twice per week for 4 weeks, recording transaction hashes and its ${tvl} TVL baseline; current change is ${change}.`,
    `Use ${Math.round(capital / 5)}-dollars per session to test deposits, swaps or claims, and set a 3 percent loss limit so failed incentives do not exceed the weekly budget.`,
    `Check official Discord, X and governance channels every 7 days for incentive, snapshot or eligibility rules; preserve proof of activity and use a hardware wallet for larger sums.`,
    `After 30 days, withdraw all test positions, review the net result, and only continue with a 25-dollar cap until a real token allocation or official claim is confirmed.`,
  ];
}

const watchlist = new Set<string>(snapshot.watchlist);
const watchRows = snapshot.protocols.filter((protocol: any) =>
  watchlist.has(protocol.slug),
);
const earlyCandidates = snapshot.protocols
  .filter((protocol: any) =>
    !watchlist.has(protocol.slug) &&
    !protocol.gecko_id &&
    !protocol.symbol &&
    protocol.tvl_usd < snapshot.floor_usd,
  )
  .map((protocol: any) => ({ protocol, value: impliedValue(protocol) }))
  .sort((a: any, b: any) =>
    b.value - a.value ||
    a.protocol.slug.localeCompare(b.protocol.slug),
  )
  .slice(0, 160)
  .map((entry: any) => entry.protocol);

const selected = [...watchRows, ...earlyCandidates];
const ranked = selected
  .map((protocol: any) => ({
    protocol,
    value: impliedValue(protocol),
  }))
  .sort((a: any, b: any) =>
    b.value - a.value ||
    a.protocol.slug.localeCompare(b.protocol.slug),
  );

const rows = ranked.map((entry: any, index: number) => ({
  slug: entry.protocol.slug,
  name: entry.protocol.name,
  rank: index + 1,
  implied_value_usd: entry.value,
  farm_steps: farmSteps(entry.protocol),
  tvl_usd: entry.protocol.tvl_usd,
  capital_usd: capitalFor(entry.protocol.tvl_usd),
  category_multiple: Number(categoryMultiple(entry.protocol.category).toFixed(6)),
  growth_factor: Number(growthFactor(entry.protocol.change_7d).toFixed(6)),
  maturity_factor: Number(maturityFactor(entry.protocol.listed_at).toFixed(6)),
  chain_multiplier: Number(chainMultiplier(entry.protocol.chains).toFixed(6)),
}));

const board = {
  as_of: snapshot.as_of,
  model: {
    formula: "TVL * category_multiple * growth_factor * maturity_factor * chain_multiplier",
    global_median_mcap_to_tvl: GLOBAL_MEDIAN,
    observed_live_median_mcap_to_tvl: Number(globalMedian.toFixed(6)),
    category_shrink_strength: SHRINK_STRENGTH,
  },
  rows,
};

writeFileSync("board.json", JSON.stringify(board, null, 2) + "\n", "utf8");
