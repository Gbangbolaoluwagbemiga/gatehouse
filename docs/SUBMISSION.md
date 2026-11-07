# Submission text (paste into https://wemakedevs.org/hackathons/switch/submit; the entrant submits personally)

- **Project name:** Gatehouse
- **Track:** Track 01: Best Business Workflow. Optionally also the Best Blog side track, once `docs/BLOG.md` is published.
- **Repo:** https://github.com/Gbangbolaoluwagbemiga/gatehouse
- **Demo video:** VIDEO_URL
- **One-liner:** A PR triage room for open-source maintainers: two Switch agents triage AI-judged pull requests and verify every verdict's signature in Discord, and the maintainers make the calls.

**Description:**

AI made pull requests free, and maintainers drown in plausible slop. PatchBond bonds each stranger's PR, and an AI judge in a TEE signs a verdict: refund, forfeit or needs_human. But the doubtful cases sat on a web page nobody on the team watched.

Gatehouse puts that workflow into the team's chat with Switch. One template creates the room and two agents.

- **@gatehouse-desk** posts the triage queue. It routes each needs_human case to the maintainer on rota with its UTC deadline, and explains any verdict on request.
- **@gatehouse-auditor** independently re-checks every verdict the desk posts: the signed request and response hashes, the model, the recovered signer, the verdict inside the signed response, and the published verdict hash. It replies ✓ 6/6 in the thread before anyone acts.
- **Maintainers decide.** The agents are read-only and never hold keys, so refunds and forfeits are signed by the maintainer on the verdict page.

Switch is the workflow itself. It gives each agent an identity, a role and permission to answer, plus shared threads with the humans, on Discord, Slack, Teams or Telegram, with no code changes.

**What was built for this hackathon:** the Switch template, both agents' roles and tool wiring, and the chat-sized CLI (`queue`, `verdict`, `verify`, `stats`, `digest`) with tests. Reused and disclosed in the README: `shared/` (verdict types and signature checks) and the public verdict API of PatchBond, my earlier MIT project.
