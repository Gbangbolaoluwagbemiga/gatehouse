// bun gatehouse/cli.ts <queue | verdict <id> | verify <id> | stats | digest>
// Read-only. GATEHOUSE_API points it at another PatchBond service.
import { Api, DEFAULT_API, digest, queue, stats, verdict, verify } from "./lib";

const api = new Api(process.env.GATEHOUSE_API ?? DEFAULT_API);
const [cmd, arg] = process.argv.slice(2);
const usage = "usage: bun gatehouse/cli.ts queue | verdict <id> | verify <id> | stats | digest";

const run: Record<string, () => Promise<string>> = {
  queue: () => queue(api),
  stats: () => stats(api),
  digest: () => digest(api),
  verdict: () => (arg ? verdict(api, arg) : Promise.reject(new Error(usage))),
  verify: () => (arg ? verify(api, arg) : Promise.reject(new Error(usage))),
};

if (!cmd || !run[cmd]) {
  console.error(usage);
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
