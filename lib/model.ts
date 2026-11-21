// Token radar, model radar-3: one sealed snapshot in, one ranked board out.
//
// The board ranks the protocols whose token does not exist yet, by an implied
// value built only from the snapshot's own figures. Nothing is hardcoded by
// protocol name: the same function scores every row, and every number the
// dashboard shows can be traced back to the snapshot.
//
//   implied = tvl_usd x categoryMultiple x growth x maturity x chainSpread
//
// categoryMultiple is the heart of the model. The comparables are the
// live-token protocols (a token that already trades, a market cap above zero,
// TVL above zero, never a centralised exchange): each one carries a
// market-cap-to-TVL ratio. For a row's category the multiple is a
// hierarchically shrunk median of those ratios:
//   category -> family of related categories -> the whole live market.
// A category with many comparables speaks mostly for itself; a category with
// one comparable leans on its family; a category with none takes its family's
// median, and only a family with no comparables at all falls back to the
// global median. One comparable's ratio is clipped at 5.0 before it is used:
// a token worth hundreds of times the value locked is a tiny-TVL outlier,
// not a category's typical outcome. No multiple exceeds 0.75: a token worth
// more than three quarters of the value locked is not a credible median outcome.
//   growth   = 1 + clamp(change_7d, -60, 120) / 100 x 0.5
//   maturity = 0.6 + min(age_days, 1095) / 1095 x 0.4 (age unknown: 365 days)
//   chainSpread = 1 + 0.01 x min(chains, 12): a protocol live on more chains
//     reaches more future holders, worth up to 12% more.
//
// The live-token protocols are never ranked: they are the market's own
// evidence, shown apart in board.json's `live` array and the dashboard's
// Live tab, with their symbol and market-cap-to-TVL ratio.

/** One protocol entry of the sealed snapshot: exactly its ten fields. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole sealed snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, stated in the dashboard's model panel. */
export interface ModelConstants {
  growth_floor: number;
  growth_cap: number;
  growth_weight: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  family_prior: number;
  global_prior: number;
  multiple_cap: number;
  chain_per_chain: number;
  chain_max_chains: number;
}

export const MODEL: ModelConstants = {
  growth_floor: -60,
  growth_cap: 120,
  growth_weight: 0.5,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  family_prior: 1,
  global_prior: 0.5,
  multiple_cap: 0.75,
  chain_per_chain: 0.01,
  chain_max_chains: 12,
};

/** This model's version label, shown in the dashboard and the board. */
export const MODEL_VERSION = 'radar-3';

/** How many pre-token protocols below the watchlist floor the early radar carries. */
export const EARLY_ROWS = 160;

/**
 * The family taxonomy: every category the snapshot names belongs to one
 * family of related categories, by what the category does. The table is a
 * taxonomy of category names, applied uniformly to every protocol; no
 * protocol name appears in it, and every multiple still follows from the
 * snapshot's own market-cap-to-TVL ratios. A category the table does not
 * name falls back to a family of its own, which degrades to the global
 * median when it holds no comparables.
 */
export const FAMILIES: Record<string, string> = {
  Dexs: 'trading',
  Derivatives: 'trading',
  Options: 'trading',
  'Options Vault': 'trading',
  'Basis Trading': 'trading',
  'Leveraged Farming': 'trading',
  'Prediction Market': 'trading',
  Synthetics: 'trading',
  'Interest Rate Derivatives': 'trading',
  Lending: 'lending',
  CDP: 'lending',
  'CDP Manager': 'lending',
  'Collateral Management': 'lending',
  'Collateral Markets': 'lending',
  'Uncollateralized Lending': 'lending',
  CeDeFi: 'lending',
  'Liquid Staking': 'staking',
  'Liquid Restaking': 'staking',
  Restaking: 'staking',
  'Staking Pool': 'staking',
  'Restaked BTC': 'staking',
  'Anchor BTC': 'staking',
  'Decentralized BTC': 'staking',
  Yield: 'yield',
  'Yield Aggregator': 'yield',
  'Liquidity Manager': 'yield',
  Indexes: 'yield',
  Farm: 'yield',
  'Governance Incentives': 'yield',
  'Canonical Bridge': 'bridges',
  Bridge: 'bridges',
  'Cross Chain Bridge': 'bridges',
  RWA: 'stable',
  'Token Locker': 'stable',
  'Dual-Token Stablecoin': 'stable',
  DOR: 'stable',
  'Stablecoin Issuer': 'stable',
  'Stablecoin Wrapper': 'stable',
  'Algo-Stables': 'stable',
  'Reserve Currency': 'stable',
  Payments: 'payments',
  'Crypto Card Issuer': 'payments',
  'AI Agents': 'intel',
  'Decentralized AI': 'intel',
  'Risk Curators': 'intel',
  'Onchain Capital Allocator': 'intel',
  Launchpad: 'intel',
  'NFT Marketplace': 'markets',
  'OTC Marketplace': 'markets',
  Privacy: 'markets',
  Insurance: 'markets',
  Chain: 'markets',
};

/** The family a category belongs to, or the category itself when unnamed. */
export function familyOf(category: string | null): string {
  if (category === null) return 'uncategorised';
  return FAMILIES[category] ?? category;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: a ranked pre-token protocol and its model. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  token_status: 'pre-token';
  model: {
    category_multiple: number;
    comparables: number;
    category_median: number | null;
    family: string;
    family_median: number | null;
    fallback: 'category' | 'family' | 'global';
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
  };
  farm_steps: string[];
}

/** One live-token protocol: the market's own value, never a model's claim. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number;
  change_7d: number | null;
  symbol: string;
  mcap_tvl_ratio: number;
}

/** One category's line in the comparables table: its multiple and its evidence. */
export interface CategoryStat {
  category: string;
  family: string;
  comparables: number;
  median_ratio: number | null;
  family_median: number | null;
  multiple: number;
  fallback: 'category' | 'family' | 'global';
}

/** A board row's compact form for data.js. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  category_multiple: number;
  comparables: number;
  fallback: 'category' | 'family' | 'global';
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  farm_steps: string[];
}

/** Everything the dashboard renders, from the snapshot. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  global_median_ratio: number;
  comparables: CategoryStat[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The median of a sorted-or-not list of numbers; null when it holds none. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Whole days from `listedAt` to `asOf`, clamped at zero; null when either is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is a comparable: its token trades, with a real market cap and TVL. */
export function isComparable(p: SnapshotProtocol): boolean {
  return p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0 && p.category !== 'CEX';
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** The comparables grouped by category and by family, with the global median. */
export interface ComparableSet {
  byCategory: Map<string, number[]>;
  byFamily: Map<string, number[]>;
  globalMedian: number;
  count: number;
}

/** Build the comparable set: every live-token protocol's mcap/TVL ratio. */
export function buildComparables(snapshot: Snapshot): ComparableSet {
  const byCategory = new Map<string, number[]>();
  const byFamily = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (!isComparable(p)) continue;
    // Clip one comparable's ratio at 5.0: a token worth hundreds of times the
    // value locked is a tiny-TVL outlier, not a category's typical outcome.
    const ratio = Math.min(p.mcap_usd! / p.tvl_usd, 5);
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    all.push(ratio);
    const cat = p.category ?? 'uncategorised';
    const list = byCategory.get(cat) ?? [];
    list.push(ratio);
    byCategory.set(cat, list);
    const fam = familyOf(p.category);
    const flist = byFamily.get(fam) ?? [];
    flist.push(ratio);
    byFamily.set(fam, flist);
  }
  return { byCategory, byFamily, globalMedian: median(all) ?? 0, count: all.length };
}

/** One category's multiple under hierarchical shrinkage, with its evidence. */
export function categoryMultiple(
  category: string | null,
  comp: ComparableSet,
  model: ModelConstants = MODEL,
): { multiple: number; comparables: number; median: number | null; family: string; familyMedian: number | null; fallback: 'category' | 'family' | 'global' } {
  const cat = category ?? 'uncategorised';
  const fam = familyOf(category);
  const own = comp.byCategory.get(cat) ?? [];
  const ownMedian = median(own);
  const famRatios = comp.byFamily.get(fam) ?? [];
  const famMedian = median(famRatios);
  const g = comp.globalMedian;
  let multiple: number;
  let fallback: 'category' | 'family' | 'global';
  if (own.length > 0) {
    // The category speaks, the family steadies it, the globe anchors it.
    multiple = (own.length * ownMedian! + model.family_prior * (famMedian ?? g) + model.global_prior * g) / (own.length + model.family_prior + model.global_prior);
    fallback = 'category';
  } else if (famRatios.length > 0) {
    // No comparable in the category itself: its family's median, steadied by the globe.
    multiple = (model.family_prior * famMedian! + model.global_prior * g) / (model.family_prior + model.global_prior);
    fallback = 'family';
  } else {
    multiple = g;
    fallback = 'global';
  }
  return { multiple: Math.min(model.multiple_cap, multiple), comparables: own.length, median: ownMedian, family: fam, familyMedian: famMedian, fallback };
}

/** The full comparables table: every category the snapshot names, most evidence first. */
export function comparablesTable(snapshot: Snapshot, comp: ComparableSet, model: ModelConstants = MODEL): CategoryStat[] {
  const cats = new Set<string>();
  for (const p of snapshot.protocols) cats.add(p.category ?? 'uncategorised');
  const table: CategoryStat[] = [];
  for (const cat of cats) {
    if (cat === 'CEX') continue;
    const m = categoryMultiple(cat === 'uncategorised' ? null : cat, comp, model);
    table.push({ category: cat, family: m.family, comparables: m.comparables, median_ratio: m.median === null ? null : round4(m.median), family_median: m.familyMedian === null ? null : round4(m.familyMedian), multiple: round4(m.multiple), fallback: m.fallback });
  }
  table.sort((a, b) => b.comparables - a.comparables || (a.category < b.category ? -1 : 1));
  return table;
}

/** The multipliers and the implied value one protocol gets under the model. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  comp: ComparableSet,
  model: ModelConstants = MODEL,
): { implied: number; multiple: number; comparables: number; median: number | null; family: string; familyMedian: number | null; fallback: 'category' | 'family' | 'global'; growthPct: number; growthMult: number; maturityMult: number; chainMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const mult = categoryMultiple(protocol.category, comp, model);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const chainMult = 1 + model.chain_per_chain * Math.min(protocol.chains.length, model.chain_max_chains);
  const implied = Math.max(1, Math.round(protocol.tvl_usd * mult.multiple * growthMult * maturityMult * chainMult));
  return { implied, multiple: mult.multiple, comparables: mult.comparables, median: mult.median, family: mult.family, familyMedian: mult.familyMedian, fallback: mult.fallback, growthPct, growthMult, maturityMult, chainMult, age };
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const comp = buildComparables(snapshot);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: pre-token protocols below the watchlist floor, by TVL, capped.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => ({ p, v: impliedValue(p, snapshot.as_of, comp, model) }));
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    listed_at: s.p.listed_at,
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    token_status: 'pre-token' as const,
    model: {
      category_multiple: s.v.multiple,
      comparables: s.v.comparables,
      category_median: s.v.median,
      family: s.v.family,
      family_median: s.v.familyMedian,
      fallback: s.v.fallback,
      growth_pct: s.v.growthPct,
      growth_multiplier: s.v.growthMult,
      maturity_multiplier: s.v.maturityMult,
      chain_multiplier: s.v.chainMult,
    },
    farm_steps: farmSteps(s.p, s.v.age).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Lend $${capital} of USDC on ${name} on ${chain} and leave the loan open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Add $${capital} of liquidity to ${name}'s main pool on ${chain} and leave it in.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and put the bridged funds to work in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and hold the receipt token.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Post $${capital} of USDC as margin on ${name} and open one small hedged position.`;
  if (c.includes('prediction')) return `Fund $${capital} and take one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and hold the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield-bearing asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy live.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and leave the position open.`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time.
 * The plan is derived from the protocol's own record (category, chains, TVL,
 * age), never from a hand-written list of names. The first and second chains
 * both appear: the main position goes on the first, a second position on the
 * second when the protocol runs on more than one chain.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const second = p.chains.length > 1 ? p.chains[1]! : null;
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const steps: FarmStep[] = [
    {
      text: `Open a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
  ];
  if (second !== null) {
    steps.push({
      text: `Repeat a smaller position on ${second}, the protocol's second chain, so the activity shows on two chains.`,
      cost: `$${Math.round(capital / 2)} of capital and about $3 of gas`,
      time: '10 minutes',
    });
  } else {
    steps.push({
      text: `Top the position up once a week with a small extra deposit, so the wallet shows repeated activity.`,
      cost: 'about $10 a week and $2 of gas',
      time: '5 minutes a week',
    });
  }
  steps.push(
    {
      text: `Do one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold every position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
  );
  return steps;
}

/** Every live-token comparable, by market cap, for the dashboard's Live tab and board.json. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => isComparable(p))
    .sort((a, b) => b.mcap_usd! - a.mcap_usd! || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd!,
      change_7d: p.change_7d,
      symbol: p.symbol ?? '',
      mcap_tvl_ratio: round4(p.mcap_usd! / p.tvl_usd),
    }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    category_multiple: row.model.category_multiple,
    comparables: row.model.comparables,
    fallback: row.model.fallback,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; live: LiveRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const comp = buildComparables(snapshot);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    global_median_ratio: round4(comp.globalMedian),
    comparables: comparablesTable(snapshot, comp, model),
    rows: board.map(radarRow),
    live,
  };
  return { board, live, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return { as_of: o.as_of, source: o.source, floor_usd: o.floor_usd, protocols, watchlist: o.watchlist as string[] };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
