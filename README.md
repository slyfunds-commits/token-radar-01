# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/slyfunds-commits/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/slyfunds-commits/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks protocols whose DefiLlama records show no token, estimates an implied token value, and gives each a seven-step farming plan. It also exposes live-token peers used to estimate category multiples.

## Run it

```sh
node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=t2zg4r38&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>

**Repository:** `slyfunds-commits/token-radar-01`
**Competition:** `token-radar-01`
**Referral code:** `t2zg4r38`

## Run

Requires Node.js 22.18 or later. The program reads `/input/snapshot.json` and writes the board, dashboard assets, screenshots, and dossier to `/output`:

```sh
node main.ts
```

For a local run with explicit paths:

```sh
node main.ts --input /path/to/snapshot.json --output ./output
```

The board value model is:

```text
TVL × category multiple × seven-day growth × maturity × chain multiplier
```

Category multiples use the median market-cap / TVL of live-token peers in the same category, shrunk toward the 0.246 global prior. The estimate is a model claim, not a token-price forecast or financial advice. “No token recorded” describes the snapshot record and does not prove that no token exists.

## Output

- `output/board.json` contains the ranked protocols and farm plans.
- `output/dashboard/` contains the static, offline dashboard and its data.
- `output/screenshots/` contains the board, detail, and filtered views.
- `output/dossier.json` is built from the dashboard and screenshots for the competition gate.

## License

MIT. See [LICENSE](LICENSE).
