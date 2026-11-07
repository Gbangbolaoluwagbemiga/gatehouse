// Gatehouse: read-only views of a live PatchBond service (bonded PRs, TEE-signed AI verdicts), written to fit in a chat message.
// The Switch agents in agents/ call these through cli.ts. Nothing here signs or spends; the only
// writes are the team's own records in ledger.ts (rota, decisions, what `watch` has already shown).
import { verifyRecord } from "../shared/verify";
import type { VerdictRecord } from "../shared/types";
import { checkChain, decide, decisionFor, type Entry, type Store } from "./ledger";

export const DEFAULT_API = "https://patchbond-production.up.railway.app";
// A needs_human case nobody decides is refunded when the repo's review window ends (PatchBond's default policy: 72 h).
export const REVIEW_WINDOW_HOURS = 72;

export type Fetch = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface Stats {
  verdicts_live: number;
  verdicts: Record<string, number>;
  cost_per_verdict_usd: number;
  median_minutes_to_verdict: number;
  disputes: number;
  network: string;
  contract: string;
  judge: string;
}

export class Api {
  constructor(readonly base = DEFAULT_API, private readonly get: Fetch = fetch as unknown as Fetch) {}

  private async json<T>(path: string): Promise<T> {
    const r = await this.get(`${this.base}${path}`);
    if (!r.ok) throw new Error(`${path} answered HTTP ${r.status}`);
    return (await r.json()) as T;
  }

  verdicts = () => this.json<VerdictRecord[]>("/api/verdicts");
  verdict = async (id: string) => {
    const j = await this.json<VerdictRecord | { record: VerdictRecord }>(`/api/verdicts/${encodeURIComponent(id)}`);
    return "record" in j ? j.record : j;
  };
  stats = () => this.json<Stats>("/api/stats");
  pageUrl = (id: string) => `${this.base}/v/${id}`;
}

const pr = (v: VerdictRecord) => `${v.repo.full_name}#${v.number}`;
const hours = (ms: number) => Math.round(ms / 3_600_000);

/** When the review window for a needs_human case closes, and how it reads from `now`. */
export function deadline(v: VerdictRecord, now = Date.now()) {
  const at = new Date(Date.parse(v.created_at) + REVIEW_WINDOW_HOURS * 3_600_000);
  const left = at.getTime() - now;
  const utc = at.toISOString().slice(0, 16).replace("T", " ") + " UTC";
  return { at, open: left > 0, text: left > 0 ? `decide by ${utc} (${hours(left)} h left)` : `window closed ${utc}, refunded unless decided` };
}

/** Keep the latest verdict per PR: a re-judged PR has several records. */
export function latestPerPr(vs: VerdictRecord[]) {
  const m = new Map<string, VerdictRecord>();
  for (const v of vs) {
    const k = pr(v);
    const cur = m.get(k);
    if (!cur || Date.parse(v.created_at) > Date.parse(cur.created_at)) m.set(k, v);
  }
  return [...m.values()].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
}

export function line(v: VerdictRecord, api: Api) {
  const conf = v.final.confidence != null ? ` ${Math.round(v.final.confidence * 100)}%` : "";
  return `${pr(v)}: **${v.final.verdict}**${conf}, ${v.final.category ?? "no category"}. ${api.pageUrl(v.id)}`;
}

function caseLine(v: VerdictRecord, api: Api, now: number, entries: Entry[]) {
  const d = decisionFor(entries, v.id);
  const state = d ? `decided **${d.decision}** by ${d.by} (#${d.seq})` : deadline(v, now).text;
  return `• ${line(v, api)} — ${state}. Top reason: ${v.final.reasons?.[0] ?? "none given"}`;
}

export async function queue(api: Api, now = Date.now(), store?: Store) {
  const latest = latestPerPr(await api.verdicts());
  const entries = store?.entries() ?? [];
  const human = latest.filter((v) => v.final.verdict === "needs_human");
  const waiting = human.filter((v) => !decisionFor(entries, v.id) && deadline(v, now).open);
  const rota = store?.rota().current;
  const out = [
    `**Triage queue**: ${latest.length} PRs judged, ${human.length} need a person, ${waiting.length} still waiting on a decision.${rota ? ` On rota: ${rota}.` : " Nobody is on rota."}`,
  ];
  for (const v of human) out.push(caseLine(v, api, now, entries));
  const auto = latest.filter((v) => v.final.verdict !== "needs_human");
  if (auto.length) out.push(`Decided by the judge: ${auto.map((v) => `${pr(v)} ${v.final.verdict}`).join(", ")}.`);
  return out.join("\n");
}

export async function verdict(api: Api, id: string) {
  const v = await api.verdict(id);
  const f = v.facts as Record<string, unknown> | undefined;
  const ev = (v.final.evidence ?? []).slice(0, 3).map((e) => `  – ${e.file}${e.line ? `:${e.line}` : ""} ${e.note}`);
  return [
    line(v, api),
    `Author ${v.author ?? "unknown"}; CI ${f?.ci ?? "unknown"}; model ${v.model}; judged ${v.created_at.slice(0, 16).replace("T", " ")} UTC.`,
    ...(v.final.reasons ?? []).slice(0, 3).map((r) => `• ${r}`),
    ...(ev.length ? ["Evidence:", ...ev] : []),
  ].join("\n");
}

export async function verify(api: Api, id: string) {
  const v = await api.verdict(id);
  const checks = await verifyRecord(v);
  const bad = checks.filter((c) => !c.ok);
  return [
    `${bad.length ? "✗" : "✓"} ${pr(v)} ${v.final.verdict}: ${checks.length - bad.length}/${checks.length} checks pass, signed by ${v.signature.signing_address} (${v.signature.signature_kind ?? v.signature.signing_algo}).`,
    ...checks.map((c) => `  ${c.ok ? "✓" : "✗"} ${c.name}`),
  ].join("\n");
}

export async function stats(api: Api) {
  const s = await api.stats();
  const by = Object.entries(s.verdicts).map(([k, n]) => `${k} ${n}`).join(", ");
  return `${s.verdicts_live} verdicts (${by}); median ${s.median_minutes_to_verdict.toFixed(1)} min to verdict; $${s.cost_per_verdict_usd.toFixed(4)} per verdict; ${s.disputes} disputes. Judge model ${s.judge}.`;
}

export async function digest(api: Api, now = Date.now(), store?: Store) {
  const parts = [`**Gatehouse digest**, ${new Date(now).toISOString().slice(0, 10)}`, await stats(api), await queue(api, now, store)];
  if (store) parts.push(await report(api, store, now));
  return parts.join("\n");
}

/** What changed since the last `watch`: new verdicts, and open cases due within 24 h. Marks them seen. */
export async function watch(api: Api, store: Store, now = Date.now(), peek = false) {
  const all = await api.verdicts();
  const seen = store.seen();
  const entries = store.entries();
  const fresh = all.filter((v) => !seen.has(v.id)).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const dueSoon = latestPerPr(all).filter((v) => {
    if (v.final.verdict !== "needs_human" || decisionFor(entries, v.id)) return false;
    const left = deadline(v, now).at.getTime() - now;
    return left > 0 && left <= 24 * 3_600_000;
  });
  if (!peek) store.markSeen(all.map((v) => v.id));
  const rota = store.rota().current ?? "the maintainer on rota (nobody set: `gatehouse rota @handle`)";
  if (!fresh.length && !dueSoon.length) return "Nothing new since the last check, and nothing due in the next 24 h.";
  const out: string[] = [];
  if (fresh.length) {
    out.push(`**${fresh.length} new verdict${fresh.length > 1 ? "s" : ""}** since the last check:`);
    for (const v of fresh) out.push(`• ${line(v, api)}${v.final.verdict === "needs_human" ? ` — ${deadline(v, now).text}` : ""}`);
  }
  if (dueSoon.length) {
    out.push(`**Due within 24 h**, for ${rota}:`);
    for (const v of dueSoon) out.push(`• ${pr(v)} — ${deadline(v, now).text}. ${api.pageUrl(v.id)}`);
  }
  return out.join("\n");
}

/** Records a maintainer's decision after re-checking the signature. */
export async function record(api: Api, store: Store, id: string, decision: string, by: string, note = "") {
  const v = await api.verdict(id);
  const e = await decide(store, v, decision, by, note);
  return `Recorded #${e.seq}: ${e.pr} **${e.decision}** by ${e.by}${e.on_rota ? " (on rota)" : " (not on rota)"}; signature ${e.checks} at the time; ledger hash ${e.hash.slice(0, 12)}…\nThe money moves only when ${e.by} signs it on ${api.pageUrl(e.verdict_id)}.`;
}

/** The team's own numbers: who decided what, how fast, and what was left to time out. */
export async function report(api: Api, store: Store, now = Date.now()) {
  const entries = store.entries();
  const chain = checkChain(entries);
  const human = latestPerPr(await api.verdicts()).filter((v) => v.final.verdict === "needs_human");
  const byId = new Map(human.map((v) => [v.id, v]));
  const latest = new Map(entries.map((e) => [e.verdict_id, e]));
  const mins = [...latest.values()]
    .filter((e) => byId.has(e.verdict_id))
    .map((e) => (Date.parse(e.at) - Date.parse(byId.get(e.verdict_id)!.created_at)) / 60_000)
    .sort((a, b) => a - b);
  const inWindow = mins.filter((m) => m <= 72 * 60).length;
  const lapsed = human.filter((v) => !latest.has(v.id) && !deadline(v, now).open).length;
  const people = new Map<string, number>();
  for (const e of latest.values()) people.set(e.by, (people.get(e.by) ?? 0) + 1);
  const median = mins.length ? mins[Math.floor(mins.length / 2)] : null;
  return [
    `**Team report**: ${latest.size} decision${latest.size === 1 ? "" : "s"} on record, ${inWindow} inside the review window, ${lapsed} case${lapsed === 1 ? "" : "s"} left to time out.`,
    median !== null ? `Median time from verdict to decision: ${median < 120 ? `${Math.round(median)} min` : `${(median / 60).toFixed(1)} h`}.` : "No decisions yet.",
    people.size ? `Decided by: ${[...people].map(([who, n]) => `${who} ${n}`).join(", ")}.` : "",
    `Ledger: ${entries.length} entr${entries.length === 1 ? "y" : "ies"}, chain ${chain.ok ? "intact ✓" : `BROKEN ✗ at #${chain.at} (${chain.why})`}.`,
  ].filter(Boolean).join("\n");
}

/** The last few ledger entries, newest first. */
export function log(store: Store, n = 5) {
  const entries = store.entries();
  const chain = checkChain(entries);
  if (!entries.length) return "The decision ledger is empty.";
  return [
    `**Decision ledger**: ${entries.length} entr${entries.length === 1 ? "y" : "ies"}, chain ${chain.ok ? "intact ✓" : `BROKEN ✗ at #${chain.at}`}.`,
    ...entries.slice(-n).reverse().map((e) => `#${e.seq} ${e.at.slice(0, 16).replace("T", " ")} UTC — ${e.pr}: judge said ${e.judge_verdict}, ${e.by} decided **${e.decision}**${e.note ? ` ("${e.note}")` : ""}. ${e.hash.slice(0, 12)}…`),
  ].join("\n");
}

/** Accepts a verdict id or a PR reference (`owner/repo#12`, `repo#12`) and returns the latest verdict id. */
export async function resolve(api: Api, ref: string) {
  const m = ref.trim().match(/^(?:(.+)\/)?([^/#\s]+)#(\d+)$/);
  if (!m) return ref.trim();
  const [, owner, repo, n] = m;
  const hits = latestPerPr(await api.verdicts()).filter(
    (v) => v.number === Number(n) && (owner ? v.repo.full_name.toLowerCase() === `${owner}/${repo}`.toLowerCase() : v.repo.full_name.toLowerCase().endsWith(`/${repo.toLowerCase()}`)),
  );
  if (!hits.length) throw new Error(`no verdict for ${ref}`);
  if (hits.length > 1) throw new Error(`${ref} is ambiguous: ${hits.map((v) => v.repo.full_name).join(", ")}. Use owner/repo#n.`);
  return hits[0].id;
}
