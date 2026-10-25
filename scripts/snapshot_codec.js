// Compact the public snapshot without changing candle values.
// Prices stay exact: a token uses one decimal scale when every bar round-trips,
// otherwise the original bars are kept (wide or tiny ranges).
(function (factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.SnapshotCodec = api;
})(function () {
  function uniformScale(candles) {
    for (let k = 0; k <= 15; k++) {
      const mul = 10 ** k;
      let ok = true;
      for (let i = 0; i < candles.length && ok; i++) {
        const bar = candles[i];
        for (let p = 1; p <= 3; p++) {
          const n = Math.round(bar[p] * mul);
          if (!Number.isSafeInteger(n) || n / mul !== bar[p]) { ok = false; break; }
        }
      }
      if (ok) return k;
    }
    return null;
  }

  function packCandles(candles) {
    const k = uniformScale(candles);
    if (k == null) return { raw: candles };
    const mul = 10 ** k;
    const d = [];
    const o = [];
    const h = [];
    const c = [];
    let prev = null;
    for (const bar of candles) {
      d.push(prev == null ? bar[0] : bar[0] - prev);
      prev = bar[0];
      o.push(Math.round(bar[1] * mul));
      h.push(Math.round(bar[2] * mul));
      c.push(Math.round(bar[3] * mul));
    }
    return { k, d, o, h, c };
  }

  function unpackCandles(tok) {
    if (tok.raw) return tok.raw;
    if (!tok.d || tok.k == null || !tok.o || !tok.h || !tok.c) throw new Error('snapshot token ' + (tok.s || '') + ' has no candles');
    const n = tok.d.length;
    if (tok.o.length !== n || tok.h.length !== n || tok.c.length !== n) throw new Error('snapshot token ' + tok.s + ' candle length mismatch');
    const mul = 10 ** tok.k;
    const out = new Array(n);
    let day = 0;
    for (let i = 0; i < n; i++) {
      day = i === 0 ? tok.d[i] : day + tok.d[i];
      out[i] = [day, tok.o[i] / mul, tok.h[i] / mul, tok.c[i] / mul];
    }
    return out;
  }

  function encodeSnapshot(data) {
    return {
      v: 1,
      generatedAt: data.generatedAt,
      snapshotDate: data.snapshotDate,
      sources: data.sources,
      stats: data.stats,
      tokens: data.tokens.map(t => {
        const packed = packCandles(t.c);
        const out = {
          s: t.s, n: t.n, ch: t.ch, a: t.a, t: t.t,
          x: t.cex ? 1 : 0,
          pn: t.pn,
          f: t.fetchedAt,
          p: (t.drops || []).map(d => [d.d, d.pts, d.amt])
        };
        if (t.cexn) out.xn = t.cexn;
        if (packed.raw) out.raw = packed.raw;
        else { out.k = packed.k; out.d = packed.d; out.o = packed.o; out.h = packed.h; out.c = packed.c; }
        return out;
      })
    };
  }

  function decodeSnapshot(raw) {
    if (!raw || raw.v !== 1 || !Array.isArray(raw.tokens)) throw new Error('unsupported snapshot');
    return {
      generatedAt: raw.generatedAt,
      snapshotDate: raw.snapshotDate,
      sources: raw.sources,
      stats: raw.stats,
      tokens: raw.tokens.map(tok => ({
        s: tok.s,
        n: tok.n,
        ch: tok.ch,
        a: tok.a,
        t: tok.t,
        cex: !!tok.x,
        cexn: tok.xn || '',
        pn: tok.pn,
        fetchedAt: tok.f || null,
        drops: (tok.p || []).map(row => ({ d: row[0], pts: row[1], amt: row[2] })),
        c: unpackCandles(tok)
      }))
    };
  }

  return { encodeSnapshot, decodeSnapshot, packCandles, unpackCandles };
});
