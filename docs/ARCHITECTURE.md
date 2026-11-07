# Architecture

## Pieces

| Piece | Where it runs | Talks to |
|---|---|---|
| **Switch server** | Locally, in Docker, started by Switch Console | The Telegram bridge; each agent's session host over MCP |
| **Telegram bridge** | Switch's Telegram connector, with one bot for the team | Groups *Gatehouse Triage* (maintainers) and *Gatehouse Help* (contributors) |
| **gatehouse-desk** | A Claude Code session that Switch starts in `agents/desk/` | The rooms (Switch tools); the `gatehouse` CLI |
| **gatehouse-auditor** | A Claude Code session that Switch starts in `agents/auditor/` | The maintainers' room; the `gatehouse` CLI |
| **gatehouse CLI** | `bun gatehouse/cli.ts`, run by either agent | PatchBond's public API (read-only); `data/` (the team's records) |
| **PatchBond** | Its own hosted service | Out of scope: Gatehouse only reads its verdicts |

## One case, end to end

1. **The judge rules.** A stranger's PR is judged by PatchBond, and the verdict is `needs_human`, with a 72-hour window.
2. **The desk finds it.** Wakes come from a scheduled `@gatehouse-desk morning` in Telegram, or a maintainer's `triage`. The desk runs `watch` and sees one new verdict, due in 60 h.
3. **The desk routes it.** It posts the case and @mentions whoever `rota` names, then asks `@gatehouse-auditor` to verify it in the same thread. It rewrites the **Triage Board** room document.
4. **The auditor checks it.** It runs `verify <id>` and replies `✓ 6/6, signed by 0x3b75…`. If the signing key differs from earlier verdicts, it says a human should check the provider's attestation first. It appends a line to the **Audit Log** room document.
5. **A maintainer decides.** "forfeit civicledger#61, it's a README period"
6. **The desk records it.** It runs `decide civicledger#61 forfeit --by @ada --note "…"`. The CLI re-runs all six checks; on any ✗ it refuses and writes nothing. It appends entry #N to `data/ledger.jsonl`, chained to #N-1.
7. **The auditor confirms the record.** It runs `log 1` and `check-ledger`, and replies `#N recorded, chain intact ✓`.
8. **The money moves only by the maintainer.** The maintainer signs on the verdict page, which is the only thing that moves the bond.
9. **Contributor questions go to the help room.** The contributor asks there; the desk answers from the verdict and hands a dispute to step 3 as a new case.

## Guardrails, and what enforces each

| Rule | Enforced by |
|---|---|
| No decision on a verdict whose signature doesn't check out | **Code:** `decide()` re-verifies and throws before writing (`gatehouse/ledger.ts`, tested) |
| Every decision names a person | **Code:** `--by` is required |
| No silent change of a decision | **Code:** a second decision needs an `override` note, and both stay in the log |
| Past decisions can't be quietly edited or dropped | **Code:** hash chain, `check-ledger`, tested with an edited line and a dropped line |
| Agents never move money | **Design:** the CLI has no keys and no signing; the maintainer signs on the verdict page |
| A stranger can't steer the checker | **Switch:** `addressing: owner-agents` on the auditor |
| The desk doesn't claim verification | **Brief:** only the auditor posts ✓/✗, from tool output |
| Contributors don't see maintainers' notes | **Brief:** the desk answers in the help room from the public verdict only |

## Data

`data/`, git-ignored, or `GATEHOUSE_DATA`:

| File | Holds |
|---|---|
| `ledger.jsonl` | One JSON object per decision: `seq`, `at`, `verdict_id`, `pr`, `judge_verdict`, `decision`, `by`, `note`, `on_rota`, `checks`, `verdict_hash`, `prev`, `hash`. `hash = sha256(entry without hash)` |
| `rota.json` | `{current, since, history[]}` |
| `seen.json` | Verdict ids already shown by `watch` |
