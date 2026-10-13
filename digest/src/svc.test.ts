import { describe, test, expect } from "bun:test";
import { cleanSym, parseSymbols, qkey, sma, rsi, buildQuestions, cc, HttpErr } from "./svc";

describe("validation", () => {
  test("symbols", () => {
    expect(cleanSym(" reliance.ns ")).toBe("RELIANCE.NS");
    expect(() => cleanSym("a".repeat(21))).toThrow(HttpErr);
    expect(() => cleanSym("DROP;--")).toThrow(HttpErr);
    expect(parseSymbols("RELIANCE.NS,tcs.ns,RELIANCE.NS")).toEqual(["RELIANCE.NS", "TCS.NS"]);
    expect(() => parseSymbols("a,b,c,d,e,f")).toThrow(HttpErr);
    expect(() => parseSymbols(null)).toThrow(HttpErr);
    expect(qkey("RELIANCE.NS")).toBe("RELIANCE_NS");
  });
  test("batch packs 3N questions", () => {
    const q = buildQuestions(["A.NS", "B.NS", "C.NS", "D.NS", "E.NS"]);
    expect(Object.keys(q)).toHaveLength(15);
    expect(q.buy_A_NS.type).toBe("noul");
  });
});

describe("indicators", () => {
  test("sma/rsi", () => {
    expect(sma([1, 2, 3, 4, 5], 5)).toBe(3);
    expect(sma([1, 2], 5)).toBeNull();
    const up = Array.from({ length: 20 }, (_, i) => 100 + i);
    expect(rsi(up)).toBe(100);
    expect(rsi([100, 101])).toBeNull();
  });
});

describe("cache", () => {
  test("ttl", async () => {
    cc.set("k", 1, 0.05);
    expect(cc.get("k")).toBe(1);
    await new Promise((r) => setTimeout(r, 80));
    expect(cc.get("k")).toBeUndefined();
  });
});

describe("rss parse", () => {
  test("items", () => {
    const xml = `<item><title><![CDATA[Reliance hits high]]></title><link>http://x/1</link></item><item><title>TCS falls</title><link>http://x/2</link></item>`;
    const items = [...xml.matchAll(/<item>[\s\S]*?<title>(<!\[CDATA\[)?([\s\S]*?)(\]\]>)?<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>/g)].map((m) => ({ title: m[2].trim(), link: m[4].trim() }));
    expect(items).toEqual([{ title: "Reliance hits high", link: "http://x/1" }, { title: "TCS falls", link: "http://x/2" }]);
  });
});
