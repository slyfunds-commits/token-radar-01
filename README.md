# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/slyfunds-commits/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/slyfunds-commits/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A radar for token launches that have not happened yet: it reads a sealed snapshot of 758 protocols from DefiLlama, ranks the 200 pre-token protocols by what their token would be worth if their record stood as it is, and gives every protocol a concrete plan to farm it. The protocols whose token already trades are kept apart — they are the market's own evidence, listed with their symbol and market-cap-to-TVL ratio, never mixed into the ranking.

## How the value is built

Each protocol's implied value is its TVL times four factors, all from the snapshot's own figures:

- **Category multiple** — the median market-cap-to-TVL ratio of the live-token protocols in its category, shrunk hierarchically: a category with many comparables speaks mostly for itself, one with a single comparable leans on its family of related categories, and one with none takes its family's median. Only a family with no comparable at all falls back to the global median. One comparable's ratio is clipped at 5.0 before it is used (a token worth hundreds of times the value locked is a tiny-TVL outlier, not a category's typical outcome), and no multiple exceeds 0.75.
- **Growth** — the protocol's seven-day TVL change, clamped to −60%…+120%, worth half its weight.
- **Maturity** — how long the protocol has run with no token, from 0.60 for a brand-new listing to 1.00 after three years.
- **Chain spread** — 1% per chain the protocol runs on, up to 12%: a protocol live on more chains reaches more future holders.

The board covers all 40 watchlist protocols plus the 160 strongest pre-token protocols below the watchlist floor. The dashboard shows the board (sortable, filterable, with a detail view that recomputes each row's implied value from its own figures), the full live-token set, and a model panel listing every category with its comparables, its medians and its fallback — including the categories that rest on their family instead of their own evidence.

## Run it

```sh
node main.ts --input <path/to/snapshot.json> --output out
```

In the grader the snapshot is the sealed `/input/snapshot.json` and the output directory is `/output`; locally `MAKEFUN_OUTPUT_DIR=out` stands in for it. The program needs Node 22 and nothing else: it reads the snapshot, writes `board.json` and `data.js`, copies `dashboard/` and `screenshots/` into the output, and writes `dossier.json` last. Run it twice and the two output trees are byte-identical.

## Files

- `main.ts` — the entrypoint: reads the snapshot, scores the board, writes the outputs.
- `lib/model.ts` — the model (radar-3): comparables, hierarchical shrinkage, implied values, farm plans.
- `dashboard/` — the page: `index.html`, `app.css`, `app.js`. No framework, no network.
- `screenshots/` — the board, a detail view, a filtered view and the live tab.
- `vendor/makefun-board.ts` — the kit's dossier library, untouched.

---

<sub>Entered on [make.fun](https://make.fun/?ref=t2zg4r38&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
