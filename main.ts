import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-board.ts";

const here = fileURLToPath(new URL(".", import.meta.url));

function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((value) => value.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

const inputArg = arg(
  "input",
  process.env.MAKEFUN_INPUT_DIR ?? "/input",
);
const snapshotPath = inputArg.endsWith(".json")
  ? inputArg
  : join(inputArg, "snapshot.json");
if (!existsSync(snapshotPath)) {
  process.stderr.write(
    `token radar: no snapshot at ${snapshotPath}: pass --input <snapshot.json|directory> or mount the sealed /input\n`,
  );
  process.exit(2);
}
const outputPath = arg(
  "output",
  process.env.MAKEFUN_OUTPUT_DIR ?? "/output",
);
const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));

const GLOBAL_MEDIAN = 0.246;
const SHRINK_STRENGTH = 5;
const AS_OF = new Date(`${snapshot.as_of}T00:00:00Z`).getTime();
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

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

function categoryComparableMedian(category: string | null): number | null {
  if (!category) return null;
  const ratios = ratiosByCategory.get(category) ?? [];
  return ratios.length ? median(ratios) : null;
}

function categoryComparableCount(category: string | null): number {
  return category ? (ratiosByCategory.get(category)?.length ?? 0) : 0;
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
  category: entry.protocol.category,
  chains: entry.protocol.chains,
  rank: index + 1,
  implied_value_usd: entry.value,
  farm_steps: farmSteps(entry.protocol),
  tvl_usd: entry.protocol.tvl_usd,
  change_7d: entry.protocol.change_7d,
  listed_at: entry.protocol.listed_at,
  capital_usd: capitalFor(entry.protocol.tvl_usd),
  category_multiple: categoryMultiple(entry.protocol.category),
  category_comparable_count: categoryComparableCount(entry.protocol.category),
  category_comparable_median: categoryComparableMedian(entry.protocol.category),
  growth_factor: growthFactor(entry.protocol.change_7d),
  maturity_factor: maturityFactor(entry.protocol.listed_at),
  chain_multiplier: chainMultiplier(entry.protocol.chains),
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

const liveTokens = snapshot.protocols
  .filter(liveComparable)
  .map((protocol: any) => ({
    slug: protocol.slug,
    name: protocol.name,
    category: protocol.category,
    chains: protocol.chains,
    tvl_usd: protocol.tvl_usd,
    mcap_usd: protocol.mcap_usd,
    mcap_to_tvl: protocol.mcap_usd / protocol.tvl_usd,
  }))
  .sort((a: any, b: any) =>
    b.mcap_to_tvl - a.mcap_to_tvl ||
    a.slug.localeCompare(b.slug),
  );

const categories = [
  ...new Set(
    snapshot.protocols.map((protocol: any) => protocol.category ?? "Uncategorized"),
  ),
].sort((a, b) => a.localeCompare(b));
const categoryComparables = categories
  .map((category) => {
    const ratios = ratiosByCategory.get(category) ?? [];
    return {
    category,
    live_token_comparable_count: ratios.length,
    median_mcap_to_tvl: ratios.length ? median(ratios) : null,
    shrunk_category_multiple: categoryMultiple(category),
    };
  });

const boardJson = `${JSON.stringify(board, null, 2)}\n`;
const dataScript = `window.TOKEN_RADAR_BOARD = ${JSON.stringify(board)};\nwindow.TOKEN_RADAR_LIVE = ${JSON.stringify(liveTokens)};\nwindow.TOKEN_RADAR_COMPARABLES = ${JSON.stringify(categoryComparables)};\n`;
const outputDashboard = join(outputPath, "dashboard");
mkdirSync(outputDashboard, { recursive: true });
writeFileSync(join(here, "board.json"), boardJson, "utf8");
writeFileSync(join(outputPath, "board.json"), boardJson, "utf8");
writeFileSync(join(here, "dashboard", "data.js"), dataScript, "utf8");
writeFileSync(join(outputPath, "data.js"), dataScript, "utf8");
cpSync(join(here, "dashboard"), outputDashboard, { recursive: true });

const screenshotSource = join(here, "screenshots");
const screenshotOutput = join(outputPath, "screenshots");
mkdirSync(screenshotOutput, { recursive: true });
const shots = readdirSync(screenshotSource).filter((name) => {
  const path = join(screenshotSource, name);
  return !name.startsWith(".") && statSync(path).isFile();
});
if (shots.length < 3) {
  process.stderr.write(
    `token radar: screenshots/ holds ${shots.length} image${shots.length === 1 ? "" : "s"}: hand in 3, the board, a detail view and a filtered view\n`,
  );
  process.exit(1);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) {
    process.stderr.write(
      `token radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`,
    );
    process.exit(1);
  }
  copyFileSync(join(screenshotSource, name), join(screenshotOutput, name));
}

writeFileSync(
  join(outputPath, "dossier.json"),
  buildDossier(outputPath, {
    text_max_bytes: TEXT_MAX_BYTES,
    screenshots: SCREENSHOT_CAPS,
    dashboard: { max_files: 400, max_bytes: 4_194_304 },
  }),
);
process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${rows.length} board rows and ${liveTokens.length} live-token comparables\n` +
    `token radar: wrote ${join(outputPath, "board.json")}, ${join(outputPath, "data.js")}, ${join(outputPath, "dashboard")}, ${join(outputPath, "screenshots")} (${shots.length} images) and ${join(outputPath, "dossier.json")}\n`,
);
