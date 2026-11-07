import { beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import full from "./fixtures/verdict-2ea3fd344e767358.json";
import verdicts from "./fixtures/verdicts.json";
import { checkChain, decide, Store } from "./ledger";
import { Api, queue, report, watch, type Fetch } from "./lib";
import type { VerdictRecord } from "../shared/types";

const good = full as unknown as VerdictRecord;
const all = verdicts as unknown as VerdictRecord[];
let store: Store;
beforeEach(() => {
  store = new Store(mkdtempSync(join(tmpdir(), "gatehouse-")));
});

describe("decide: the two-key rule", () => {
  test("records a decision on a verdict whose six checks pass, with who and whether they were on rota", async () => {
    store.setRota("@ada");
    const e = await decide(store, good, "forfeit", "ada", "agree with the judge");
    expect(e).toMatchObject({ seq: 1, decision: "forfeit", by: "@ada", on_rota: true, checks: "6/6" });
  });

  test("refuses a verdict whose signed bytes were changed, and records nothing", async () => {
    const tampered = { ...good, final: { ...good.final, verdict: "refund" } } as VerdictRecord;
    const forged = { ...good, response_body: good.response_body.replace("forfeit", "refund") } as VerdictRecord;
    for (const v of [tampered, forged]) await expect(decide(store, v, "refund", "@ada")).rejects.toThrow("refused");
    expect(store.entries()).toHaveLength(0);
  });

  test("refuses an unknown decision, an unnamed decider, and a second decision without an override", async () => {
    await expect(decide(store, good, "ban", "@ada")).rejects.toThrow("decision must be");
    await expect(decide(store, good, "forfeit", " ")).rejects.toThrow("--by");
    await decide(store, good, "forfeit", "@ada");
    await expect(decide(store, good, "refund", "@bo")).rejects.toThrow("already decided");
    const o = await decide(store, good, "refund", "@bo", "override: author fixed CI");
    expect(o).toMatchObject({ seq: 2, on_rota: false });
  });
});

describe("the ledger is tamper-evident", () => {
  test("each entry chains to the one before; editing any line breaks the chain at that line", async () => {
    await decide(store, good, "forfeit", "@ada");
    await decide(store, good, "uphold", "@bo", "override");
    await decide(store, good, "refund", "@cy", "override");
    expect(checkChain(store.entries())).toMatchObject({ ok: true, at: 3 });
    const file = join(store.dir, "ledger.jsonl");
    const lines = readFileSync(file, "utf8").trim().split("\n");
    lines[1] = lines[1].replace('"@bo"', '"@mallory"');
    writeFileSync(file, lines.join("\n") + "\n");
    expect(checkChain(store.entries())).toMatchObject({ ok: false, at: 2 });
  });

  test("dropping an entry is caught too", async () => {
    for (const who of ["@ada", "@bo", "@cy"]) await decide(store, good, "uphold", who, "override");
    const file = join(store.dir, "ledger.jsonl");
    const lines = readFileSync(file, "utf8").trim().split("\n");
    writeFileSync(file, [lines[0], lines[2]].join("\n") + "\n");
    expect(checkChain(store.entries()).ok).toBe(false);
  });
});

describe("rota, watch and report", () => {
  const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
  const fresh = { ...all.find((v) => v.final.verdict === "needs_human")!, id: "fresh0000000001", created_at: "2026-11-07T00:00:00.000Z" };
  const api = new Api("https://pb.test", (async () => ok([...all, fresh])) as Fetch);
  const now = Date.parse("2026-11-09T12:00:00Z"); // 60 h after `fresh`: 12 h left

  test("rota hands over and keeps history", () => {
    store.setRota("@ada", new Date("2026-11-07T08:00:00Z"));
    store.setRota("bo", new Date("2026-11-07T20:00:00Z"));
    expect(store.rota()).toMatchObject({ current: "@bo", history: [{ who: "@ada", to: "2026-11-07T20:00:00.000Z" }] });
  });

  test("watch shows each verdict once, and flags open cases due within 24 h for whoever is on rota", async () => {
    store.setRota("@ada");
    const first = await watch(api, store, now);
    expect(first).toContain(`${all.length + 1} new verdicts`);
    expect(first).toContain("Due within 24 h**, for @ada");
    expect(first).toContain("12 h left");
    const second = await watch(api, store, now);
    expect(second).not.toContain("new verdict");
    expect(second).toContain("Due within 24 h");
    expect(await watch(api, store, now, true)).toBe(second);
  });

  test("queue and report reflect decisions", async () => {
    expect(await queue(api, now, store)).toContain("Nobody is on rota");
    expect(await report(api, store, now)).toContain("0 decisions on record");
  });
});
