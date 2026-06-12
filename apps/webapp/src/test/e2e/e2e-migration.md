# E2E migration table

Tracking artifact prescribed by the Testing Transition Plan (infra-docs `redesign/Testing Transition Plan.md` §2.3).
States: `legacy-passing` | `blocked-on-nav-rewrite` | `retired` | `rewritten-V2` | `blocked-on-screen`.
No spec may sit in `retired` without a linked rewrite ticket.

`blocked-on-nav-rewrite`: the flow under test is unrebuilt and its entry URL still works (legacyRedirects),
but the spec navigates by clicking the legacy module nav (`widget-navigation`), which B4 removed. Fix is
mechanical: replace the nav click with a deep-link `goto()` that preserves the current search params
(`network=` after `switchToL2`), the pattern already used by `psm-conversion.ts:669` and `pendle.spec.ts:20`.
QA owns the rewrite pass per plan §4; renames flagged in the B4 PR description.

| Spec file                           | State                  | Notes                                                                                                                    |
| ----------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `alternate-sample.spec.ts`          | legacy-passing         | No legacy-nav usage.                                                                                                     |
| `arbitrum-psm.spec.ts`              | blocked-on-nav-rewrite | Via shared runner `psm-conversion.ts`.                                                                                   |
| `arbitrum-savings.spec.ts`          | blocked-on-nav-rewrite | Via shared runner `l2-savings.ts`.                                                                                       |
| `arbitrum-trade.spec.ts`            | blocked-on-nav-rewrite | Via shared runner `l2-trade.ts`.                                                                                         |
| `base-psm.spec.ts`                  | blocked-on-nav-rewrite | Via shared runner `psm-conversion.ts`.                                                                                   |
| `base-savings.spec.ts`              | blocked-on-nav-rewrite | Via shared runner `l2-savings.ts`.                                                                                       |
| `base-trade.spec.ts`                | blocked-on-nav-rewrite | Via shared runner `l2-trade.ts`.                                                                                         |
| `capped-osm-unstake.spec.ts`        | blocked-on-nav-rewrite | Already disabled pre-B4 (Phase-7 re-enable list).                                                                        |
| `cowswap-trade.ts` (runner)         | blocked-on-nav-rewrite | Drives `mainnet-trade.spec.ts`.                                                                                          |
| `debug-parallel.spec.ts`            | legacy-passing         | No legacy-nav usage.                                                                                                     |
| `expert-morpho.spec.ts`             | blocked-on-nav-rewrite | Already disabled pre-B4 (Phase-7 re-enable list).                                                                        |
| `expert-stusds.spec.ts`             | blocked-on-nav-rewrite |                                                                                                                          |
| `l2-savings.ts` (runner)            | blocked-on-nav-rewrite | Drives the four L2 savings specs.                                                                                        |
| `l2-trade.ts` (runner)              | blocked-on-nav-rewrite | Drives the four L2 trade specs.                                                                                          |
| `landing.spec.ts`                   | legacy-passing         | `chain-modal-trigger-header` kept (moved to TopNav in B4).                                                               |
| `mainnet-psm.spec.ts`               | blocked-on-nav-rewrite | Via shared runner `psm-conversion.ts`.                                                                                   |
| `mainnet-savings-parallel.spec.ts`  | blocked-on-nav-rewrite |                                                                                                                          |
| `mainnet-savings.spec.ts`           | blocked-on-nav-rewrite |                                                                                                                          |
| `mainnet-trade.spec.ts`             | blocked-on-nav-rewrite | Via shared runner `cowswap-trade.ts`.                                                                                    |
| `optimism-psm.spec.ts`              | blocked-on-nav-rewrite | Via shared runner `psm-conversion.ts`.                                                                                   |
| `optimism-savings.spec.ts`          | blocked-on-nav-rewrite | Via shared runner `l2-savings.ts`.                                                                                       |
| `optimism-trade.spec.ts`            | blocked-on-nav-rewrite | Via shared runner `l2-trade.ts`.                                                                                         |
| `pane-visibility.spec.ts`           | retired (B4)           | Asserted the legacy `widget-navigation` / hamburger chrome B4 deleted. Rewrite ticket: G3 (real mobile/breakpoint pass). |
| `pendle.spec.ts`                    | blocked-on-nav-rewrite | Already disabled pre-B4 (Phase-7 re-enable list). Market deep-links already use `goto()`.                                |
| `psm-conversion.ts` (runner)        | blocked-on-nav-rewrite | Drives the five PSM specs.                                                                                               |
| `reward-1.spec.ts`                  | blocked-on-nav-rewrite |                                                                                                                          |
| `reward-2.spec.ts`                  | blocked-on-nav-rewrite |                                                                                                                          |
| `sequential-tx.spec.ts`             | blocked-on-nav-rewrite |                                                                                                                          |
| `stake.spec.ts`                     | blocked-on-nav-rewrite | Already disabled pre-B4 (Phase-7 re-enable list).                                                                        |
| `stusds-provider-switching.spec.ts` | blocked-on-nav-rewrite |                                                                                                                          |
| `unichain-psm.spec.ts`              | blocked-on-nav-rewrite | Via shared runner `psm-conversion.ts`.                                                                                   |
| `unichain-savings.spec.ts`          | blocked-on-nav-rewrite | Via shared runner `l2-savings.ts`.                                                                                       |
| `unichain-trade.spec.ts`            | blocked-on-nav-rewrite | Via shared runner `l2-trade.ts`.                                                                                         |
| `unstake-repay.spec.ts`             | blocked-on-nav-rewrite | Already disabled pre-B4 (Phase-7 re-enable list).                                                                        |
| `upgrade.spec.ts`                   | blocked-on-nav-rewrite |                                                                                                                          |
| `vaults-spark.spec.ts`              | blocked-on-nav-rewrite |                                                                                                                          |
| `verify-funding.spec.ts`            | legacy-passing         | No legacy-nav usage.                                                                                                     |

Also removed in B4: `utils/rewards.ts` (navigated via `widget-navigation`; had no importers).
