import { Hono } from "hono";
import { loadEnv, HttpErr, cleanSym, parseSymbols, snapshot, chart, headlines, decide, summarize, digest, movers, suggest, RANGES, INTERVALS } from "./svc";

loadEnv();
const app = new Hono();
const err = (e: any) => Response.json({ status: "error", message: e.message || "boom" }, { status: e instanceof HttpErr ? e.status : 500 });

app.get("/", (c) => c.json({ name: "subq-digest", endpoints: ["/stock?symbol=", "/history?symbol=&range=&interval=", "/decide?symbol=", "/news?symbol=", "/digest?symbol=|symbols="], ranges: RANGES, intervals: INTERVALS }));
app.get("/health", (c) => c.json({ ok: true }));
app.get("/stock", async (c) => {
  try { return c.json({ status: "success", symbol: cleanSym(c.req.query("symbol") || ""), data: await snapshot(cleanSym(c.req.query("symbol") || "")) }); }
  catch (e) { return err(e); }
});
app.get("/history", async (c) => {
  try {
    const sym = cleanSym(c.req.query("symbol") || "");
    const range = c.req.query("range") || "1mo";
    const { candles } = await chart(sym, range, c.req.query("interval") || undefined);
    return c.json({ status: "success", symbol: sym, count: candles.length, candles });
  } catch (e) { return err(e); }
});
app.get("/decide", async (c) => {
  try {
    const sym = cleanSym(c.req.query("symbol") || "");
    const [snap, news] = await Promise.all([snapshot(sym), headlines(sym)]);
    const answers = await decide({ [sym]: JSON.stringify({ snap, news: news.map((h: any) => h.title) }) });
    return c.json({ status: "success", symbol: sym, answers });
  } catch (e) { return err(e); }
});
app.get("/news", async (c) => {
  try {
    const sym = cleanSym(c.req.query("symbol") || "");
    const news = await headlines(sym);
    return c.json({ status: "success", symbol: sym, news, summary: await summarize(`${sym} headlines:\n` + news.map((h: any) => `- ${h.title}`).join("\n")) });
  } catch (e) { return err(e); }
});
app.get("/digest", async (c) => {
  try {
    const syms = parseSymbols(c.req.query("symbols") || c.req.query("symbol"));
    return c.json({ status: "success", count: syms.length, ...(await digest(syms, c.req.query("range") || "1mo", c.req.query("interval") || "1d")) });
  } catch (e) { return err(e); }
});
app.get("/movers", async (c) => {
  try { return c.json({ status: "success", ...(await movers()) }); }
  catch (e) { return err(e); }
});
app.get("/suggest", async (c) => {
  try { return c.json({ status: "success", results: await suggest(c.req.query("q") || "") }); }
  catch (e) { return err(e); }
});
app.notFound((c) => c.json({ status: "error", message: "not found" }, 404));

export default { port: Number(process.env.PORT) || 3000, fetch: app.fetch };
