# How I put an AI judge's doubtful cases in front of the right maintainer, with Switch

*Draft for the Best Blog side track. The author publishes it, for example on Hashnode or dev.to, and links it in the submission.*

## The gap

My earlier project, PatchBond, makes a stranger's pull request carry a small refundable bond. An AI judge running in a TEE signs one of three verdicts: refund, forfeit, or **needs_human**. In practice, most of the interesting cases are the last kind, and they sat on a web page nobody on the maintainer team was watching. Each one has a review window. Miss it, and the case is refunded by default.

I didn't need another dashboard. The maintainers already live in a chat channel, so the cases needed to go there, to a named person, with the deadline.

## What Switch gave me

Switch turns a channel into a **room** where people and agents work together. Each agent is a real coding agent (Claude Code in my case) running in its own folder on my machine, with its own name, role and rules about who may address it. A template creates the agents and the room in one go:

```yaml
agents:
  - name: gatehouse-desk
    addressing: anyone
    directory: "{checkout}/agents/desk"
  - name: gatehouse-auditor
    addressing: owner-agents
    directory: "{checkout}/agents/auditor"
room:
  name: gatehouse-triage
  agents: [gatehouse-desk, gatehouse-auditor]
  users: ["{$creator}"]
```

**The trick that made it fast:** an agent's working directory is just a folder. So each folder holds a `CLAUDE.md` (the agent's standing brief) and the agent reaches one read-only CLI from it. Switch starts Claude Code there, and the agent has exactly the tools for its job, nothing more.

## Two agents, one rule each

- **The desk** runs `gatehouse queue`. It posts one line per PR, and @mentions the maintainer on rota for every needs_human case, with the deadline in UTC.
- **The auditor** never trusts the desk. For each verdict it re-runs the signature check offline and replies ✓ 6/6 in the thread, or names the check that failed. The check covers the request and response hashes, the model, the recovered signer, the verdict inside the signed response, and the published verdict hash.

Neither agent can move money. When a maintainer decides, the desk hands them the verdict page, where they sign with their own wallet. In a team room that boundary matters: anyone can talk to the desk, so the desk must not be able to spend.

## What I'd tell a first-time Switch user

1. **Start with Switch Console and switch-buddy.** It sets up the local server and the Telegram connection for you.
2. **Keep each agent's tools in its own folder.** The `directory` field is your permission boundary.
3. **Use `addressing`.** `anyone` for the front desk, `owner-agents` for the checker, so strangers can't steer it.
4. **Make tools print chat-sized text.** Agents relay what they get; a 2-line tool output becomes a 2-line message.
5. **Write the kickoff message.** It's the first thing the room sees, and it doubles as a smoke test.

Code: https://github.com/Gbangbolaoluwagbemiga/gatehouse
