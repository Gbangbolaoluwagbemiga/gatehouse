# Gatehouse

[![ci](https://github.com/Gbangbolaoluwagbemiga/gatehouse/actions/workflows/ci.yml/badge.svg)](https://github.com/Gbangbolaoluwagbemiga/gatehouse/actions/workflows/ci.yml)

**A pull-request triage room for open-source maintainers, run inside the team's own chat.**
- An AI judge has already ruled on every flagged PR.
- Two agents in the room route the doubtful cases to the maintainer on rota, prove each verdict is genuine before anyone acts, and keep a tamper-evident record of what the humans decided.

Built for **Flip the Switch** (WeMakeDevs × Switch), Track 01: Best Business Workflow.

> 🎥 **Demo video:** `VIDEO_URL`, 2–3 minutes in Telegram: triage → signature check → a maintainer decides → the decision is on the record.

## The problem

AI made sending a pull request free, so maintainers drown in plausible-looking slop. Some projects now put an AI judge in front of the queue. **PatchBond**, my earlier open-source project, does this: a stranger's PR carries a small refundable bond, and a model running in a TEE signs one of three verdicts:
- **`refund`:** good work gets its bond back.
- **`forfeit`:** clear slop loses its bond.
- **`needs_human`:** everything doubtful goes to a person.

The judge was never the hard part. **The team side was:**
1. **Nobody watched the doubtful cases.** They sat on a web page while their 72-hour review window ran out, and then refunded themselves by default.
2. **Nobody could tell whether a verdict was genuine.** Was it really signed by the model, or just text on a page?
3. **There was no record of who decided what, or when.** For money that's taken from a stranger, that's not acceptable.
4. **Contributors had nobody to ask** why their PR was forfeited.

## What Gatehouse does

Gatehouse turns the maintainers' existing channel into a **Switch room**, with two agents working alongside the maintainers.

| Who | Job | How |
|---|---|---|
| **@gatehouse-desk**, holds the `triage-desk` role, anyone can ask | Runs the queue | <ul><li>`triage` → what's new and what's due, each `needs_human` case @mentioning **whoever is on rota**, with its UTC deadline</li><li>Explains any verdict</li><li>Records a maintainer's stated decision in the ledger</li><li>Keeps the **Triage Board** room document current</li><li>In the contributors' **help room**, answers "why was my PR forfeited?" and hands disputes to the maintainers</li></ul> |
| **@gatehouse-auditor**, holds the `verifier` role, answers only the desk and its owner | Trusts nothing the desk says | <ul><li>Re-runs **six signature checks** offline on every verdict the desk posts: request and response bytes against the signed hashes, model name, recovered signer, verdict inside the signed response, published hash</li><li>Flags a **changed signer**</li><li>After each decision, re-walks the **ledger's hash chain**</li><li>Keeps the **Audit Log** room document, and posts the daily digest</li></ul> |
| **Maintainers** | Decide | <ul><li>Say "forfeit civicledger#61, it's a README period" in the room, and the desk records it</li><li>The bond only moves when **they** sign on the verdict page. **The agents hold no keys and move no money.**</li></ul> |

### The two-key rule

The AI judge proposes. A named **maintainer** decides. **And the decision is refused unless the verdict's signature checks all pass at that moment.** A contributor arguing their own case in the help room can't record anything: `decide` refuses anyone who isn't on the maintainers list, and going on rota makes you a maintainer.

`gatehouse decide` re-verifies before it writes anything, then appends to `data/ledger.jsonl`. Each entry's SHA-256 covers its content and the previous entry's hash, so editing or deleting any past decision breaks the chain at that line. Both of those are tested.

```
Telegram: "Gatehouse Help" ──(Switch room)── contributors ── @gatehouse-desk ─┐ hand-off of disputes
                                                                              ▼
Telegram: "Gatehouse Triage" ──(Switch room)──┬── maintainers (one on rota)
                                              ├── @gatehouse-desk    [role: triage-desk] ──┐
                                              ├── @gatehouse-auditor [role: verifier]   ───┤── gatehouse CLI
                                              ├── room doc: Triage Board (desk)             │   queue · watch · verdict
                                              └── room doc: Audit Log (auditor)             │   verify · decide · rota
                                                                                            │   report · log · check-ledger
                         live verdict API (read-only) ◄─────────────────────────────────────┤
                         data/ledger.jsonl (hash-chained) · data/rota.json ◄────────────────┘
```

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Real run: [docs/TRANSCRIPT.md](docs/TRANSCRIPT.md).

## Switch features used

| Switch feature | What Gatehouse does with it |
|---|---|
| **Rooms on a messaging bridge** | The maintainers' Telegram group *is* the workspace. Nobody opens a dashboard. |
| **Templates** | [`switch/gatehouse.template.yaml`](switch/gatehouse.template.yaml) creates both agents and their rooms in one run. Params: checkout, maintainers' room, optional help room. |
| **Agents with their own working directory** | Each agent's folder ([`agents/desk`](agents/desk), [`agents/auditor`](agents/auditor)) holds its brief, so it gets exactly its tools and rules. |
| **Addressing** | `anyone` for the desk. `owner-agents` for the auditor, so a stranger can't steer the checker. |
| **Agent-to-agent hand-off in a thread** | The desk asks the auditor, and the auditor answers in the same thread, in front of the humans. |
| **Roles** | `triage-desk` and `verifier`: people address the job, not a specific agent (`!roles` shows the holders). |
| **Room documents** | **Triage Board** (current state, rewritten by the desk) and **Audit Log** (append-only, by the auditor), read by anyone joining. |
| **Multiple rooms** | The contributors' help room plus the maintainers' room, with disputes handed from one to the other. |
| **Scheduled prompts** | A Telegram scheduled message, `@gatehouse-desk morning`, wakes the desk daily. Switch reads it like a typed message. |

## Run it in 15 minutes

You need: macOS, Docker running, [Bun](https://bun.sh), and Claude Code or Codex signed in.

1. **Clone and check the tools.** No key needed.
   ```bash
   git clone https://github.com/Gbangbolaoluwagbemiga/gatehouse && cd gatehouse && bun install
   bun test                                     # → 16 pass (two-key rule, non-maintainer refused, tampered ledger, watch, rota…)
   bun run gatehouse queue                      # → the live triage queue, with deadlines
   bun run gatehouse verify civicledger#61      # → ✓ 6/6 checks pass, with the signer
   ```
2. **Install Switch Console** ([macOS arm64 .dmg](https://github.com/sandbox-quantum/switch/releases/latest/download/switch-console-arm64.dmg)). Let `switch-buddy` start the local server and connect Telegram: create a bot with @BotFather, paste the token into Console, and add the bot to a group called **Gatehouse Triage**. Optionally add it to a second group, **Gatehouse Help**.
3. **Deploy:** ask `switch-buddy` to run [`switch/gatehouse.template.yaml`](switch/gatehouse.template.yaml) with **checkout** = your clone, **where** = Gatehouse Triage and **help** = Gatehouse Help. → Gatehouse Desk and Gatehouse Auditor join.
4. **Use it.** In *Gatehouse Triage*:

   | Send | Get |
   |---|---|
   | `@gatehouse-desk I'm on rota` | Rota set, Triage Board updated |
   | `@gatehouse-desk triage` | What's new and what's due, each case @mentioning you; the auditor replies in-thread with ✓ 6/6 per verdict and flags a changed signer |
   | `@gatehouse-desk why was demo-widget#5 forfeited?` | The reasons, evidence and link |
   | `@gatehouse-desk forfeit civicledger#60, the diff is empty` | Ledger entry #N, after a fresh 6/6 check; the auditor confirms `chain intact ✓` |
   | `@gatehouse-auditor report` | Decisions, time to decision, cases left to time out, ledger integrity |

   In *Gatehouse Help*, as a contributor: `@gatehouse-desk why was my PR civicledger#61 forfeited? I think it's wrong` → a factual answer there, and the dispute handed to the maintainers' room.

   **Optional:** schedule a daily Telegram message, `@gatehouse-desk morning`.

## The CLI the agents use

`bun gatehouse/cli.ts <command>`. `<ref>` is a verdict id or a PR like `civicledger#61`.

| Command | Does |
|---|---|
| `queue` | Each PR's latest verdict; `needs_human` cases with deadline or recorded decision; who's on rota |
| `watch [--peek]` | Only verdicts new since the last watch, plus open cases due within 24 h |
| `verdict <ref>` / `verify <ref>` | Explain a verdict / re-run its six signature checks offline |
| `decide <ref> <refund\|forfeit\|uphold> --by @x [--note …]` | Two-key: refuses on any ✗, an unnamed decider, or a second decision without an `override` note |
| `rota [@x]` | Who's on rota, or hand over, keeping history; the person going on rota becomes a maintainer |
| `maintainers [add\|remove @x]` | Who may record decisions |
| `report` / `log [n]` / `check-ledger` | The team's numbers / recent decisions / walk the hash chain |
| `stats` / `digest` | The judge's numbers / everything together |

Reads are against PatchBond's public API. The only writes are the team's own records in `data/`, which is git-ignored and can be moved with `GATEHOUSE_DATA`.

## Repo map

| Path | What |
|---|---|
| [`switch/`](switch) | The Switch template |
| [`agents/`](agents) | Each agent's brief: role, tools, rules, room documents, hand-off |
| [`gatehouse/`](gatehouse) | The CLI, the ledger, and 15 tests with recorded fixtures |
| [`shared/`](shared) | Verdict types and signature checks, reused from PatchBond |
| [`docs/`](docs) | Architecture, transcript, video plan, blog, submission text |

## Built for this hackathon vs. reused

- **Written during Flip the Switch (Nov 7, 2026):**
  - the Switch template and both agents
  - the `gatehouse` CLI, including the two-key ledger, rota, watch and report, plus its tests and CI
  - these docs
- **Reused:**
  - `shared/` (verdict types and signature checks) from PatchBond, my earlier MIT project
  - PatchBond's public verdict API, which the CLI reads

## Limits (honest)

- **The verdicts are real but few, and mostly from my own test repos.** No outside maintainer team has used Gatehouse yet.
- **The ledger is tamper-evident, not tamper-proof.** Someone with file access can rewrite the whole chain, but they can't quietly edit one line. Anchoring the head hash somewhere public is the next step.
- **Roles, room documents and hand-offs are done by the agents through Switch's tools.** They follow their briefs, so a model can still get one wrong. The CLI enforces the rules that matter: verification before a decision, a named decider, no silent second decision.
- **Decisions are recorded here, but money moves only by the maintainer's own signature** on the verdict page.

## License

MIT. Switch itself (Apache 2.0 + Commons Clause) is not included.
