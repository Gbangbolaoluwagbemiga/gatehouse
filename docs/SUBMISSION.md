# Submission text (paste into https://wemakedevs.org/hackathons/switch/submit; the entrant submits personally)

- **Project name:** Gatehouse
- **Track:** Track 01: Best Business Workflow.
- **Side track: Code with Wispr.** Attach the Wispr Flow Insights scorecard screenshot. Disclosure, keep it: *"The final stage was done by voice with Wispr Flow: my prompts to the coding agent, every test message to the Switch agents in Telegram, the README's 'Why I built this' section and the demo voice-over. The earlier build was typed."*
- **Optional side track: Best Blog,** once `docs/BLOG.md` is published.
- **Repo:** https://github.com/Gbangbolaoluwagbemiga/gatehouse
- **Demo video:** VIDEO_URL
- **One-liner:** A PR triage room for open-source maintainers: two Switch agents triage AI-judged pull requests and verify every verdict's signature in Telegram, and the maintainers make the calls.

**Description:**

AI made pull requests free, so maintainers drown in plausible slop. Projects are putting AI judges in front of their queues. PatchBond, my earlier project, bonds each stranger's PR, and a model in a TEE signs a verdict: refund, forfeit or needs_human. The judge was never the hard part. The team side was:
- the doubtful cases sat on a web page nobody watched until their review window ran out
- nobody could tell a genuine verdict from text on a page
- there was no record of who decided what, for money taken from a stranger

Gatehouse turns the maintainers' Telegram group into a Switch room. One template deploys two agents.

- **@gatehouse-desk** (role: triage-desk):
  - shows what's new and what's due, and @mentions whoever is on rota with each case's deadline
  - explains any verdict
  - records a maintainer's stated decision
  - keeps a Triage Board room document
  - answers contributors in a separate help room, and hands disputes to the maintainers
- **@gatehouse-auditor** (role: verifier; only the desk and its owner can address it):
  - independently re-runs six signature checks on every verdict, in the same thread, and flags a changed signing key
  - after each decision, re-walks the ledger's hash chain
  - keeps an Audit Log room document
- **The two-key rule:** the AI proposes, a named maintainer decides (a contributor can't record a decision on their own PR), and `gatehouse decide` refuses unless every signature check passes at that moment. Decisions go into a hash-chained ledger, so editing or dropping any past entry is detected (tested). The agents hold no keys: the bond moves only when the maintainer signs.

Switch is the workflow itself. It provides:
- the rooms on Telegram
- agents with their own folders and briefs
- addressing rules
- roles
- room documents
- the cross-room hand-off
- scheduled wake-ups

The same setup runs on Slack, Teams or Mattermost.

**Built during the hackathon:**
- the Switch template and both agents
- the `gatehouse` CLI (queue, watch, verdict, verify, decide, rota, report, log, check-ledger), with 16 tests and CI
- the docs

Reused and disclosed: `shared/` (signature checks) and the public verdict API of PatchBond, my earlier MIT project.
