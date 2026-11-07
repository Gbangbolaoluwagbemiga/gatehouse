// The team's side of a verdict: who is on rota, what a maintainer decided, and an append-only,
// hash-chained log of those decisions. A decision is refused unless the verdict's signature checks
// all pass at the moment it is recorded, so nobody acts on a verdict the auditor would reject.
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyRecord } from "../shared/verify";
import type { VerdictRecord } from "../shared/types";

export const DECISIONS = ["refund", "forfeit", "uphold"] as const;
export type Decision = (typeof DECISIONS)[number];

export interface Entry {
  seq: number;
  at: string;
  verdict_id: string;
  pr: string;
  judge_verdict: string;
  decision: Decision;
  by: string;
  note: string;
  on_rota: boolean;
  checks: string;
  verdict_hash: string;
  prev: string;
  hash: string;
}

export interface Rota {
  current: string | null;
  since: string | null;
  history: { who: string; from: string; to: string }[];
}

const GENESIS = "0".repeat(64);
const handle = (s: string) => (s.startsWith("@") ? s : `@${s}`).toLowerCase();
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const body = ({ hash: _h, ...rest }: Entry) => JSON.stringify(rest);

/** Everything Gatehouse remembers lives in one folder: GATEHOUSE_DATA, or `data/` at the repo root. */
export class Store {
  constructor(readonly dir = process.env.GATEHOUSE_DATA ?? join(dirname(fileURLToPath(import.meta.url)), "..", "data")) {
    mkdirSync(dir, { recursive: true });
  }
  private path = (f: string) => join(this.dir, f);
  private read<T>(f: string, fallback: T): T {
    return existsSync(this.path(f)) ? (JSON.parse(readFileSync(this.path(f), "utf8")) as T) : fallback;
  }
  private write(f: string, v: unknown) {
    writeFileSync(this.path(f), JSON.stringify(v, null, 2));
  }

  entries(): Entry[] {
    if (!existsSync(this.path("ledger.jsonl"))) return [];
    return readFileSync(this.path("ledger.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Entry);
  }
  append(e: Omit<Entry, "seq" | "prev" | "hash">): Entry {
    const all = this.entries();
    const partial = { ...e, seq: all.length + 1, prev: all.at(-1)?.hash ?? GENESIS, hash: "" };
    const entry = { ...partial, hash: sha(body(partial)) };
    appendFileSync(this.path("ledger.jsonl"), JSON.stringify(entry) + "\n");
    return entry;
  }

  maintainers = () => this.read<string[]>("maintainers.json", []);
  setMaintainer(who: string, on = true) {
    const set = new Set(this.maintainers());
    if (on) set.add(handle(who));
    else set.delete(handle(who));
    this.write("maintainers.json", [...set].sort());
  }

  rota = () => this.read<Rota>("rota.json", { current: null, since: null, history: [] });
  /** Whoever goes on rota is a maintainer from then on. */
  setRota(who: string, now = new Date()) {
    this.setMaintainer(who);
    const r = this.rota();
    if (r.current && r.since) r.history.push({ who: r.current, from: r.since, to: now.toISOString() });
    this.write("rota.json", { current: handle(who), since: now.toISOString(), history: r.history.slice(-50) });
  }

  seen = () => new Set(this.read<string[]>("seen.json", []));
  markSeen(ids: string[]) {
    this.write("seen.json", [...new Set([...this.seen(), ...ids])]);
  }
}

/** Walks the chain: every entry's hash covers its content and the previous entry's hash. */
export function checkChain(entries: Entry[]) {
  let prev = GENESIS;
  for (const e of entries) {
    if (e.prev !== prev) return { ok: false, at: e.seq, why: "prev does not match the entry before it" };
    if (sha(body(e)) !== e.hash) return { ok: false, at: e.seq, why: "content was changed after it was written" };
    prev = e.hash;
  }
  return { ok: true, at: entries.length, why: "" };
}

export const decisionFor = (entries: Entry[], verdictId: string) => entries.filter((e) => e.verdict_id === verdictId).at(-1);

/**
 * Records a maintainer's decision, two-key style: the AI judge proposed, the signature checks must
 * pass now, and a named maintainer decides. Refuses on any failed check, an unknown decision, no name,
 * or a name that isn't on the maintainers list.
 */
export async function decide(store: Store, v: VerdictRecord, decision: string, by: string, note = "", now = new Date()) {
  if (!DECISIONS.includes(decision as Decision)) throw new Error(`decision must be one of ${DECISIONS.join(", ")}`);
  if (!by.trim()) throw new Error("say who decided: --by @handle");
  if (!store.maintainers().includes(handle(by))) {
    throw new Error(`refused: ${handle(by)} is not a maintainer. Only maintainers decide; a contributor's objection goes to the maintainers' room as a dispute.`);
  }
  const checks = await verifyRecord(v);
  const bad = checks.filter((c) => !c.ok);
  if (bad.length) throw new Error(`refused: the verdict fails "${bad[0].name}", so it can't be acted on. Ask @gatehouse-auditor.`);
  const prior = decisionFor(store.entries(), v.id);
  if (prior && !note.toLowerCase().includes("override")) {
    throw new Error(`already decided: ${prior.decision} by ${prior.by} (#${prior.seq}). Add a note containing "override" to change it.`);
  }
  const rota = store.rota().current;
  return store.append({
    at: now.toISOString(),
    verdict_id: v.id,
    pr: `${v.repo.full_name}#${v.number}`,
    judge_verdict: v.final.verdict,
    decision: decision as Decision,
    by: handle(by),
    note,
    on_rota: rota === handle(by),
    checks: `${checks.length}/${checks.length}`,
    verdict_hash: v.verdict_hash ?? "",
  });
}
