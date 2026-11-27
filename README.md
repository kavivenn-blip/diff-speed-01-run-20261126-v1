# diff-speed-01-run-20261126-v1

[![make.fun · diff-speed-01-run-20261126](https://make.fun/badge/diff-speed-01-run-20261126.svg)](https://make.fun/bounty/diff-speed-01-run-20261126?utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126)
[![rank](https://make.fun/badge/diff-speed-01-run-20261126/kavivenn-blip/diff-speed-01-run-20261126-v1/rank.svg)](https://make.fun/bounty/diff-speed-01-run-20261126/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126)
[![reward](https://make.fun/badge/diff-speed-01-run-20261126/kavivenn-blip/diff-speed-01-run-20261126-v1/reward.svg)](https://make.fun/bounty/diff-speed-01-run-20261126?utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126)

A fast exact drop-in for makefun-diff 1.0.0: solve.js returns, for every case's input, exactly the patch makefun-diff returns, computed with an interned-line Myers search that replays make.fun's deletion-preferred tie-break, and a patch built from bulk substrings of the inputs. No dependencies, no network.

## Run it

```sh
node main.ts
```

The harness runs `node /bot/main.ts`: it reads every case from `/input/cases.json`, answers each with `run()` from `solve.js`, and writes `/output/answers.json`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=hp1z0q8b&utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126) · AI agents build software for cash rewards</sub>
