# Gatehouse

**A pull-request triage room for open-source maintainers, run inside the team's own chat. Two AI agents triage every flagged PR and check that each AI verdict is genuine. The maintainers make the calls.**

Built for **Flip the Switch** (WeMakeDevs × Switch), Track 01: Best Business Workflow.

> 🎥 **Demo video:** `VIDEO_URL`, 2–3 minutes in Discord: triage → signature check → a maintainer decides.

## The problem

AI made sending a pull request free, so maintainers drown in plausible-looking slop. Some projects now put an AI judge in front of the queue. **PatchBond**, my earlier open-source project, does this: a stranger's PR carries a small refundable bond, and a model running in a TEE signs one of three verdicts:
- **`refund`:** good work gets its bond back.
- **`forfeit`:** clear slop loses its bond.
- **`needs_human`:** everything doubtful goes to a person.

The judge was never the hard part. The **team side** was:
- **The doubtful cases sat on a web page nobody on the team watched,** while their review window ran out.
- **Nobody could tell at a glance whether a verdict was genuinely signed by the model,** or just text on a page.

## What Gatehouse does

Gatehouse turns the maintainers' existing channel into a **Switch room**. Two agents work alongside the maintainers there:

| Who | Does |
|---|---|
| **@gatehouse-desk** (anyone can ask) | `triage`: lists every PR's latest verdict, posts the `needs_human` cases with their **UTC deadline**, and @mentions the maintainer on rota. Explains any verdict (reasons, evidence, CI) on request. |
| **@gatehouse-auditor** (desk and owner) | Re-checks **every verdict the desk posts, independently**, in the same thread. It checks the request and response bytes against the hashes the model signed, the model name, the recovered signer, the verdict inside the signed response, and the published verdict hash. It posts ✓ 6/6 or names the failed check, and posts a daily digest. |
| **Maintainers** | Decide. Refunds and forfeits are signed by the maintainer on the verdict page the desk links. **The agents are read-only: they never hold keys or move money.** |

```
Discord #gatehouse-triage ──(Switch room)──┬── maintainers
                                           ├── @gatehouse-desk ───┐
                                           └── @gatehouse-auditor ┘── gatehouse CLI (read-only)
                                                                        │
                                              live verdict API + offline signature checks
```

**Why Switch is central:**
- The whole workflow is a conversation between people and two agents, in the place the team already works. Without Switch, the desk has nobody to route to, and the auditor has nothing to check in front of the people deciding.
- Switch gives each agent its own identity and role, and its own permission to answer: anyone can address the desk, while the auditor answers only the desk and its owner.
- It gives the threads shared context, and the same setup works on Discord, Slack, Teams or Telegram without code changes.

## Run it in 10 minutes

You need: macOS, Docker running, [Bun](https://bun.sh), and Claude Code or Codex signed in.

1. **Clone and check the tools**, which are read-only and need no key:
   ```bash
   git clone https://github.com/Gbangbolaoluwagbemiga/gatehouse && cd gatehouse && bun install
   bun run gatehouse queue                      # → the live triage queue, with deadlines and links
   bun run gatehouse verify 2ea3fd344e767358    # → ✓ 6/6 checks pass, with the signer
   bun test                                     # → 7 pass
   ```
2. **Install Switch Console** ([macOS arm64 .dmg](https://github.com/sandbox-quantum/switch/releases/latest/download/switch-console-arm64.dmg)). Open it, and let `switch-buddy` start the local server and connect Discord ([getting started](https://docs.switchagents.ai/switch-rooms/getting-started)).
3. **Deploy the room:** in Switch Console, import [`switch/gatehouse.template.yaml`](switch/gatehouse.template.yaml) and set **Gatehouse checkout** to your clone's folder. → `#gatehouse-triage` appears with both agents and you in it. The desk says hello and posts the queue.
4. **Use it:**
   - `@gatehouse-desk triage` → the queue, one line per PR, with deadlines. The auditor answers in the thread with ✓ per verdict.
   - `@gatehouse-desk why was demo-widget#5 forfeited?` → the reasons, evidence and link.
   - `@gatehouse-auditor digest` → the day's numbers: verdicts, cost per verdict, time to verdict, disputes.

Each agent runs in its own folder, [`agents/desk`](agents/desk) and [`agents/auditor`](agents/auditor). Its `CLAUDE.md` is its standing brief and limits what it may do.

## Repo map

| Path | What |
|---|---|
| [`switch/gatehouse.template.yaml`](switch/gatehouse.template.yaml) | One Switch template: the room plus both agents |
| [`agents/`](agents) | Each agent's role, rules and tools |
| [`gatehouse/`](gatehouse) | Chat-sized CLI (`queue`, `verdict`, `verify`, `stats`, `digest`) and tests |
| [`shared/`](shared) | The verdict types and signature checks, reused from PatchBond |
| [`docs/`](docs) | Video shot list, blog post, submission text |

## Built for this hackathon vs. reused

- **Written during Flip the Switch (Nov 7, 2026):** the Switch template, both agents, the `gatehouse` CLI and its tests, and these docs.
- **Reused:** `shared/` (verdict types and signature checks) from PatchBond, my earlier MIT project, plus PatchBond's public verdict API, which the CLI reads.

## Limits (honest)

- **The live verdicts are real but few, and mostly from my own test repos.** No outside maintainer team has used Gatehouse yet.
- **The judge sends many cases to a person,** by design. Gatehouse exists to make that human step fast, not to hide it.
- **The agents are read-only.** Decisions still need a maintainer's click and signature on the verdict page.

## License

MIT. Switch itself (Apache 2.0 + Commons Clause) is not included.
