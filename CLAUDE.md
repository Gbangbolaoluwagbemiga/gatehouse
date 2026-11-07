# Gatehouse: Flip the Switch hackathon entry

**Gatehouse is an open-source maintainer team's PR triage room, run by people and AI agents together inside Discord via Switch.**
It reads PatchBond's public verdict API. PatchBond is the author's earlier MIT project: a stranger's PR carries a refundable bond, and a model in a TEE signs a verdict. Only `shared/` (verdict types and signature checks) is reused code; everything else here was written on Nov 7.
Gatehouse puts that system into the team's chat. Agents post each bonded PR with its signed verdict and verify the signature in the room.
They route every `needs_human` case to a named maintainer with the 48 h deadline. People decide in the thread.

## Deadline: 2026-11-07 23:59 IST = 18:29 UTC = 19:29 WAT (Lagos). No extensions.

Work backwards from that. **Aim to have the repo public and the video uploaded by 17:30 WAT**, leaving 2 h of buffer.

## The hackathon (read before building anything)

- **Page:** https://wemakedevs.org/hackathons/switch
- **Submit:** https://wemakedevs.org/hackathons/switch/submit
- **Rules:** https://wemakedevs.org/hackathons/switch/rules
- **Organiser:** WeMakeDevs, with sponsor Switch AI (SandboxAQ's Agent Switch). The theme is AI agents collaborating with your teammates in Slack, Teams, Discord, Telegram or Mattermost.
- **Window:** 2026-11-04 00:01 IST to 2026-11-07 23:59 IST. Solo or up to 4 people. Free.

### Tracks
**We enter Track 01.**

| Track | Prize | Notes |
|---|---|---|
| **01 Best Business Workflow (OUR TRACK)** | $2,000 | A practical workflow where people and AI agents get work done together |
| 02 Best Personal or Creative Workflow | $2,000 | |
| 03 Best Core Contribution | $100 × top 20 PRs | PRs to Switch core, on issues labelled `hackathon`, with assignment required |

Side tracks:

| Side track | Prize | Notes |
|---|---|---|
| Code with Wispr | $500 | Built by voice with Wispr Flow; needs an Insights screenshot. Skip unless the user uses Wispr. |
| **Best Blog** | AirPods 5 | A blog post about building with Switch, judged on clarity, accuracy and help to first-time users. **Draft one** (`docs/BLOG.md`); the user publishes it. |
| #HowISwitch social post | Keyboard, top 5 | **Optional, not required to enter.** |

### Judging
All four criteria count; their weights aren't published.

1. **Use of Switch:** is Switch central, so the project would stop working without it?
2. **Technical execution:** does it run, and can someone clone the repo and reproduce it?
3. **Creativity and impact:** a fresh idea that solves a real team's problem.
4. **Presentation:** do the demo video and README make Switch's use clear?

**Process:** WeMakeDevs reviews every entry and makes a shortlist, then Switch, DevTools Academy and WeMakeDevs judge the finalists.

### Rules that bind us
- **Allowed:** existing agents, libraries and templates. **Required:** the Switch setup and the workflow the agents run must be built during the window, i.e. today. The README must say plainly what was reused (`shared/` and PatchBond's public API) and what was built today (the template, agents, CLI, tests and docs).
- **AI tools are allowed**, but the entrant must understand and be able to explain the submission.
- **Rule 3(b): no submitting via bots, scripts or automated agents.** Never fill in or send the submission form, and never register on the user's behalf. Prepare the text; **the user submits it personally.**
- **Identity:** a single real identity (legal name and email). Prizes may need ID verification.
- **License grant:** organisers get a non-exclusive licence. The repo keeps MIT, and Switch's own code is Apache 2.0 + Commons Clause. **Do not copy Switch source or docs into the repo.** `.switch-ref/` is git-ignored reference material only.
- **Submission fields** aren't visible without signing in. Expect: repo URL, demo video URL, description, track, and team members.

## Switch: what it is and how we use it

- **Repo:** https://github.com/sandbox-quantum/switch. **Docs:** https://docs.switchagents.ai/switch-rooms/getting-started
- **Local reference copies** (git-ignored) in `.switch-ref/`:
  - `official/`: the docs
  - `TEMPLATES.md`: the template language, the most important file
  - `examples/`: agent templates and room templates
- **Model:**
  - Each chat channel becomes a **room**.
  - **Agents** join rooms with their own name and avatar. Each agent is a coding agent (Claude Code, Codex, OpenCode, Cursor, Antigravity) running in its **own working directory** on the user's machine. Switch Console's controller runs it.
  - Switch talks to the agent through MCP tools on loopback.
  - Switch brings no model; you bring your own agent and subscription. This Mac has `claude`, `codex`, `bun` and Docker 29.5.2 installed.
- **Switch Console** is the macOS desktop app. Download `switch-console-arm64.dmg` from https://github.com/sandbox-quantum/switch/releases/latest. It starts a local Docker server. Its built-in assistant, `switch-buddy`, can create agents, rooms and the chat-app connection. Messaging setup guides are in `.switch-ref/official/deploy/messaging-apps/discord.md` and `telegram.md`.
- **Templates (our main deliverable)** are YAML files that create agents plus a room in one run. See `.switch-ref/examples/agent-templates/triage-pair.template.yaml` and `.switch-ref/TEMPLATES.md`.
  - Agent fields: `name`, `display_name`, `icon_url`, `description`, `instructions`, `provider`, `location` or `machine`, `directory`, `model`, `addressing` (`owner | owner-agents | anyone`), `connections`, `repo`, `sources`, `join`, `auto_mode`, `auto_approve`.
  - **`provider`, `location` and `directory` are required.**
  - The room block takes: `name`, `description`, `bridge`, `agents`, `users: ["{$creator}"]`, and `kickoff`.
  - **Validate templates against `.switch-ref/TEMPLATES.md` → "Validation".**
- **How Gatehouse gets its tools:** each agent's `directory` is a folder in this repo (`agents/desk`, `agents/auditor`) holding its own `CLAUDE.md`. From there it runs the read-only `gatehouse` CLI (`bun ../../gatehouse/cli.ts …`). Switch starts Claude Code in that folder.

## What to build today (in order; ship each step before the next)

1. **`gatehouse` CLI** (`gatehouse/cli.ts`, run with `bun gatehouse/cli.ts <cmd>`). It is **read-only** against the live PatchBond API, `https://patchbond-production.up.railway.app`. Routes that exist:
   - `/api/stats`
   - `/api/verdicts`
   - `/api/verdicts/:id`
   - `/api/activity`
   - `/api/submissions/:repo/:number`
   - `/api/appeals/:verdict`

   Commands:
   - `queue`: open PRs and the `needs_human` verdicts, oldest first, with the deadline.
   - `verdict <id>`: one verdict, summarised.
   - `verify <id>`: re-runs the six signature checks in `shared/verify.ts` offline and prints ✓/✗ per check.
   - `stats`
   - `digest`: a daily summary covering the queue, costs, median time to verdict and disputes.

   Output should be plain text that fits a chat message. Add unit tests with mocked fetch. **No write actions, no keys.**
2. **Agents** (`agents/gatehouse-desk/`, `agents/gatehouse-auditor/`). Each folder has a `CLAUDE.md` with the agent's role, rules and CLI commands.
   - **gatehouse-desk** (addressing: anyone):
     - When asked, or when a maintainer says "triage", it runs `queue` and posts each item in one or two lines.
     - For `needs_human` items it @mentions the maintainer on rota, with the evidence and the UTC deadline.
     - It answers "why was #5 refunded?" from the verdict.
     - It never claims to move money. For refund, forfeit or dispute it links the PatchBond verdict page, where the maintainer signs with their own wallet.
   - **gatehouse-auditor** (addressing: owner-agents):
     - On every verdict the desk posts, it independently runs `verify <id>` and replies in the thread with ✓/✗ and the signer.
     - It posts the `digest` when asked.
     - This is the two-agents-plus-humans loop the judges want to see.
3. **Templates:**
   - `switch/gatehouse.template.yaml`: both agents plus the room `gatehouse-triage`, with a kickoff message. Params: team prefix, provider (default `[claude, codex]`), `directory` pointing at `agents/{agent}`, and bridge.
   - Optionally `switch/rooms/` for room instructions: reply in threads, two lines max, @mention the maintainer on rota, never paste secrets.
4. **README** (rewrite for Gatehouse, top to bottom). Structure:
   1. One-line pitch, then the problem: AI-generated PRs flood maintainers.
   2. The demo video.
   3. "How Switch is used", with a diagram: Discord channel → Switch room → two agents plus maintainers → the gatehouse CLI (live verdict API + offline signature checks).
   4. **Run it in 10 minutes**, as "do X → see Y" steps: install Switch Console, connect Telegram, deploy the template, type `@gatehouse-desk triage`.
   5. What was built today vs. what pre-existed.
   6. Limits.
   7. License.

   Keep PatchBond's deep docs under `docs/`, linked rather than inlined.
5. **`docs/VIDEO.md`:** a 2–3 minute shot list. Discord on screen: a maintainer types `@gatehouse-desk triage` → the desk lists the queue → the auditor verifies a signature (✓) in the thread → a needs_human case is routed to a named maintainer with its deadline → the maintainer replies → close on the Switch Console view of the two agents. The user records it.
6. **`docs/BLOG.md`** draft for the Best Blog side track, plus `docs/SUBMISSION.md` with ready-to-paste text: name, one-liner, description, track, repo URL, video URL placeholder.

## Hard rules

- **Never touch the PatchBond repo or its GitHub org.** Gatehouse has its own history and will get its own repo, `Gbangbolaoluwagbemiga/gatehouse`. **Create it and make it public only after the user says so.**
- **Never push, publish, post on X, register, or submit without the user's explicit OK at the time.** Never send the submission form (rule 3(b)).
- **Git identity is repo-local** (already set): Gbangbolaoluwagbemiga <oluwagbemigagbangbola@gmail.com>. No Claude or Anthropic co-author, author or trailer. Check `git log` before any push. Several Claude sessions share one gh account; check `gh auth status` before pushing.
- **No secrets in the repo.** The CLI is read-only and needs no key. Discord bot tokens and Switch keys live in Switch Console, never in files here.
- **Read-only, always.** Gatehouse never deploys, signs or spends anything.
- **Don't break the README's honesty.** No outside users yet, the judge's slop recall is low (see `docs/` eval), and money actions need the maintainer's own wallet. Say so.
- **The user does by hand** (tell them early, step by step):
  - install Switch Console
  - create a Discord server and connect it via `switch-buddy`
  - deploy the template from Console
  - record the video
  - create the GitHub repo
  - submit the form
