// Gatehouse: read-only views of a live PatchBond service (bonded PRs, TEE-signed AI verdicts), written to fit in a chat message.
// The Switch agents in agents/ call these through cli.ts; nothing here signs, spends or writes.
import { verifyRecord } from "../shared/verify";
import type { VerdictRecord } from "../shared/types";

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

export async function queue(api: Api, now = Date.now()) {
  const latest = latestPerPr(await api.verdicts());
  const human = latest.filter((v) => v.final.verdict === "needs_human");
  const open = human.filter((v) => deadline(v, now).open);
  const out = [`**Triage queue**: ${latest.length} PRs judged, ${human.length} need a person (${open.length} still open).`];
  for (const v of human) out.push(`• ${line(v, api)} — ${deadline(v, now).text}. Top reason: ${v.final.reasons?.[0] ?? "none given"}`);
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

export async function digest(api: Api, now = Date.now()) {
  return [`**Gatehouse digest**, ${new Date(now).toISOString().slice(0, 10)}`, await stats(api), await queue(api, now)].join("\n");
}
