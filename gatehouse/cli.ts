// bun gatehouse/cli.ts <command>. Prints chat-sized text for the Switch agents in agents/.
// GATEHOUSE_API points it at another PatchBond service; GATEHOUSE_DATA moves the team's records.
import { Api, DEFAULT_API, digest, log, queue, record, report, resolve, stats, verdict, verify, watch } from "./lib";
import { checkChain, Store } from "./ledger";

const USAGE = `usage: bun gatehouse/cli.ts <command>
  queue                         every PR's latest verdict; the needs_human cases with deadlines and decisions
  verdict <id|repo#n>           one verdict: reasons, evidence, CI, author
  verify <id|repo#n>            re-run the six signature checks offline
  watch [--peek]                new verdicts since the last watch, and cases due within 24 h
  decide <id|repo#n> <refund|forfeit|uphold> --by @handle [--note "..."]
                                record a maintainer's decision (refused unless every check passes)
  rota [@handle]                who is on rota; with a handle, hand over (that person becomes a maintainer)
  maintainers [add|remove @handle]  who may record decisions
  report                        decisions, time to decision, cases left to time out, ledger integrity
  log [n]                       the last n ledger entries
  stats | digest`;

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args.splice(i, 2)[1] ?? "" : undefined;
};
const peek = args.includes("--peek");
const by = flag("by");
const note = flag("note") ?? "";
const [cmd, a, b] = args.filter((x) => x !== "--peek");

const api = new Api(process.env.GATEHOUSE_API ?? DEFAULT_API);
const store = () => new Store();
const need = (v: string | undefined, what: string) => {
  if (!v) throw new Error(`missing ${what}\n${USAGE}`);
  return v;
};

const run: Record<string, () => Promise<string> | string> = {
  queue: () => queue(api, Date.now(), store()),
  verdict: async () => verdict(api, await resolve(api, need(a, "verdict id or repo#n"))),
  verify: async () => verify(api, await resolve(api, need(a, "verdict id or repo#n"))),
  watch: () => watch(api, store(), Date.now(), peek),
  decide: async () => record(api, store(), await resolve(api, need(a, "verdict id or repo#n")), need(b, "decision"), need(by, "--by @handle"), note),
  rota: () => {
    const s = store();
    if (a) {
      s.setRota(a);
      return `On rota now: ${s.rota().current}. @gatehouse-desk will route needs_human cases to them.`;
    }
    const r = s.rota();
    return r.current ? `On rota: ${r.current} since ${r.since!.slice(0, 16).replace("T", " ")} UTC.` : "Nobody is on rota. Set one: rota @handle";
  },
  maintainers: () => {
    const s = store();
    if (a === "add" || a === "remove") s.setMaintainer(need(b, "@handle"), a === "add");
    const m = s.maintainers();
    return m.length ? `Maintainers who may record decisions: ${m.join(", ")}.` : "No maintainers yet. Going on rota makes you one, or: maintainers add @handle";
  },
  report: () => report(api, store()),
  log: () => log(store(), Number(a ?? 5)),
  "check-ledger": () => {
    const c = checkChain(store().entries());
    if (!c.ok) process.exitCode = 1;
    return c.ok ? `Ledger chain intact ✓ (${c.at} entr${c.at === 1 ? "y" : "ies"}).` : `Ledger chain BROKEN ✗ at #${c.at}: ${c.why}.`;
  },
  stats: () => stats(api),
  digest: () => digest(api, Date.now(), store()),
};

if (!cmd || !run[cmd]) {
  console.error(USAGE);
  process.exit(2);
}
try {
  const out = await run[cmd]();
  console.log(out);
  if (cmd === "verify" && out.startsWith("✗")) process.exitCode = 1;
} catch (e) {
  console.error(`gatehouse ${cmd}: ${(e as Error).message}`);
  process.exit(1);
}
