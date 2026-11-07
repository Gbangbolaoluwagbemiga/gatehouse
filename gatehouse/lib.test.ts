import { describe, expect, test } from "bun:test";
import verdicts from "./fixtures/verdicts.json";
import statsFixture from "./fixtures/stats.json";
import fullRecord from "./fixtures/verdict-2ea3fd344e767358.json";
import { Api, deadline, digest, latestPerPr, queue, stats, verdict, verify, type Fetch } from "./lib";
import type { VerdictRecord } from "../shared/types";

const all = verdicts as unknown as VerdictRecord[];
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const fake: Fetch = async (url) => {
  const path = new URL(url).pathname;
  if (path === "/api/verdicts") return ok(all);
  if (path === "/api/stats") return ok(statsFixture);
  const m = path.match(/^\/api\/verdicts\/(.+)$/);
  const v = m && (m[1] === fullRecord.id ? fullRecord : all.find((x) => x.id === m[1]));
  return v ? ok({ record: v }) : { ok: false, status: 404, json: async () => ({}) };
};
const api = new Api("https://pb.test", fake);
// The list endpoint omits the signed bytes; /api/verdicts/:id has the full record.
const forfeit = fullRecord as unknown as VerdictRecord;
const human = all.find((v) => v.final.verdict === "needs_human")!;

describe("queue", () => {
  test("keeps the latest verdict per PR and lists every needs_human case with its window", async () => {
    const latest = latestPerPr(all);
    expect(new Set(latest.map((v) => `${v.repo.full_name}#${v.number}`)).size).toBe(latest.length);
    const out = await queue(api, Date.parse("2026-11-07T10:00:00Z"));
    const people = latest.filter((v) => v.final.verdict === "needs_human");
    expect(out.split("\n").filter((l) => l.startsWith("•"))).toHaveLength(people.length);
    expect(out).toContain("https://pb.test/v/");
  });

  test("an open case shows the UTC deadline and hours left; a closed one says it was refunded", () => {
    const made = Date.parse(human.created_at);
    expect(deadline(human, made + 3_600_000)).toMatchObject({ open: true });
    expect(deadline(human, made + 3_600_000).text).toMatch(/decide by .* UTC \(71 h left\)/);
    expect(deadline(human, made + 73 * 3_600_000).text).toContain("refunded unless decided");
  });
});

describe("verdict and verify", () => {
  test("verdict summarises reasons and evidence with the page link", async () => {
    const out = await verdict(api, forfeit.id);
    expect(out).toContain(`**forfeit**`);
    expect(out).toContain(`https://pb.test/v/${forfeit.id}`);
    expect(out).toContain("Evidence:");
  });

  test("a published record verifies offline: six checks, all ✓", async () => {
    const out = await verify(api, forfeit.id);
    expect(out.startsWith("✓")).toBe(true);
    expect(out).toContain("6/6 checks pass");
  });

  test("a tampered record fails the check that covers it", async () => {
    const bad = { ...forfeit, final: { ...forfeit.final, verdict: "refund" } } as VerdictRecord;
    const tampered = new Api("https://pb.test", async () => ok({ record: bad }));
    const out = await verify(tampered, forfeit.id);
    expect(out.startsWith("✗")).toBe(true);
  });

  test("an unknown id is an error, not an empty answer", async () => {
    expect(verdict(api, "nope")).rejects.toThrow("HTTP 404");
  });
});

test("stats and digest read from /api/stats", async () => {
  expect(await stats(api)).toContain("per verdict");
  const d = await digest(api, Date.parse("2026-11-07T10:00:00Z"));
  expect(d).toContain("Gatehouse digest");
  expect(d).toContain("Triage queue");
});
