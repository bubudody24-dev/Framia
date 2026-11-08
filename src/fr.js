(function () {
  const d = document.createElement("link").relList;
  if (d && d.supports && d.supports("modulepreload")) return;
  for (const g of document.querySelectorAll('link[rel="modulepreload"]')) f(g);
  new MutationObserver((g) => {
    for (const b of g)
      if (b.type === "childList")
        for (const N of b.addedNodes)
          N.tagName === "LINK" && N.rel === "modulepreload" && f(N);
  }).observe(document, { childList: !0, subtree: !0 });
  function v(g) {
    const b = {};
    return (
      g.integrity && (b.integrity = g.integrity),
      g.referrerPolicy && (b.referrerPolicy = g.referrerPolicy),
      g.crossOrigin === "use-credentials"
        ? (b.credentials = "include")
        : g.crossOrigin === "anonymous"
          ? (b.credentials = "omit")
          : (b.credentials = "same-origin"),
      b
    );
  }
  function f(g) {
    if (g.ep) return;
    g.ep = !0;
    const b = v(g);
    fetch(g.href, b);
  }
})();
const Uv = "framia-media",
  vm = "files";
function Hv() {
  return new Promise((o, d) => {
    const v = indexedDB.open(Uv, 1);
    ((v.onupgradeneeded = () => v.result.createObjectStore(vm)),
      (v.onsuccess = () => o(v.result)),
      (v.onerror = () => d(v.error)));
  });
}
async function R1(o, d) {
  const v = await Hv();
  return new Promise((f, g) => {
    const b = v.transaction(vm, o),
      N = d(b.objectStore(vm));
    ((N.onsuccess = () => f(N.result)),
      (N.onerror = () => g(N.error)),
      (b.oncomplete = () => v.close()),
      (b.onerror = () => g(b.error)));
  });
}
const xo = (o, d) => R1("readwrite", (v) => v.put(d, o)),
  pm = (o) => R1("readonly", (d) => d.get(o)),
  a1 = (o) =>
    new Promise((d, v) => {
      const f = new FileReader();
      ((f.onload = () => d(f.result)), (f.onerror = v), f.readAsDataURL(o));
    });
async function Bv(o) {
  const d = new Map();
  for (const f of o.clips || []) {
    if (!f.mediaId || d.has(f.mediaId)) continue;
    const g = await pm(f.mediaId);
    if (!g) throw Error(`Mídia indisponível: ${f.name || f.mediaId}`);
    d.set(f.mediaId, g);
  }
  return {
    format: "framia",
    version: 2,
    project: { ...o, clips: (o.clips || []).map(({ url: f, ...g }) => g) },
    media: d,
  };
}
const FRAMIA_FILE_MAGIC = "FRAMIA2\n";
async function framiaGzip(o) {
  if (typeof CompressionStream !== "function") return null;
  try {
    return new Uint8Array(
      await new Response(
        new Blob([o]).stream().pipeThrough(new CompressionStream("gzip")),
      ).arrayBuffer(),
    );
  } catch {
    return null;
  }
}
async function framiaGunzip(o) {
  if (typeof DecompressionStream !== "function")
    throw Error("Compressão não suportada neste navegador");
  return new Uint8Array(
    await new Response(
      new Blob([o]).stream().pipeThrough(new DecompressionStream("gzip")),
    ).arrayBuffer(),
  );
}
async function framiaPackProject(o) {
  const d = new TextEncoder(),
    v = [],
    f = [];
  let g = 0;
  for (const [b, N] of o.media) {
    const M = new Uint8Array(await N.arrayBuffer());
    (v.push({
      id: b,
      type: N.type || "application/octet-stream",
      offset: g,
      length: M.length,
    }),
      f.push(M),
      (g += M.length));
  }
  const b = d.encode(
      JSON.stringify({
        format: "framia",
        version: 2,
        project: o.project,
        media: v,
      }),
    ),
    N = await framiaGzip(b),
    M = d.encode(FRAMIA_FILE_MAGIC),
    B = new Uint8Array(5);
  (B.set([N ? 1 : 0], 0), new DataView(B.buffer).setUint32(1, (N || b).length, !0));
  return new Blob([M, B, N || b, ...f], { type: "application/x-framia" });
}
async function framiaUnpackProject(o) {
  const d = await o.arrayBuffer();
  if (d.byteLength < 13) return null;
  if (new TextDecoder().decode(new Uint8Array(d, 0, 8)) !== FRAMIA_FILE_MAGIC)
    return null;
  const v = new DataView(d),
    f = new Uint8Array(d, 8, 1)[0],
    g = v.getUint32(9, !0),
    b = new Uint8Array(d, 13, g),
    N = JSON.parse(new TextDecoder().decode(f ? await framiaGunzip(b) : b));
  if (!N || N.format !== "framia" || !N.project)
    throw Error("Formato Framia inválido");
  const M = {};
  for (const B of N.media || []) {
    const q = new Uint8Array(d, 13 + g + B.offset, B.length);
    M[B.id] = await a1(new Blob([q], { type: B.type }));
  }
  return { format: "framia", version: 1, project: N.project, media: M };
}
async function jv(o) {
  var f, g, b, N, M, B;
  if (o.format !== "framia") return o;
  if (
    o.version !== 1 ||
    !((g = (f = o.project) == null ? void 0 : f.frames) != null && g.length) ||
    !((N = (b = o.project) == null ? void 0 : b.layers) != null && N.length) ||
    !((M = o.project) != null && M.content)
  )
    throw Error("Formato Framia inválido ou versão incompatível");
  const d = structuredClone(o.project),
    v = new Map();
  for (const q of d.clips || []) {
    if (!q.mediaId) continue;
    const w = q.mediaId;
    if (!v.has(w)) {
      const p = (B = o.media) == null ? void 0 : B[w];
      if (typeof p != "string" || !/^data:[^,]*;base64,/.test(p))
        throw Error("Mídia ausente no arquivo");
      const j = crypto.randomUUID();
      (await xo(j, await (await fetch(p)).blob()), v.set(w, j));
    }
    ((q.mediaId = v.get(w)), delete q.url);
  }
  return d;
}
var qv = { trailer: 59 };
function _1(o = 256) {
  let d = 0,
    v = new Uint8Array(o);
  return {
    get buffer() {
      return v.buffer;
    },
    reset() {
      d = 0;
    },
    bytesView() {
      return v.subarray(0, d);
    },
    bytes() {
      return v.slice(0, d);
    },
    writeByte(g) {
      (f(d + 1), (v[d] = g), d++);
    },
    writeBytes(g, b = 0, N = g.length) {
      f(d + N);
      for (let M = 0; M < N; M++) v[d++] = g[M + b];
    },
    writeBytesView(g, b = 0, N = g.byteLength) {
      (f(d + N), v.set(g.subarray(b, b + N), d), (d += N));
    },
  };
  function f(g) {
    var b = v.length;
    if (b >= g) return;
    var N = 1024 * 1024;
    ((g = Math.max(g, (b * (b < N ? 2 : 1.125)) >>> 0)),
      b != 0 && (g = Math.max(g, 256)));
    let M = v;
    ((v = new Uint8Array(g)), d > 0 && v.set(M.subarray(0, d), 0));
  }
}
var Wf = 12,
  l1 = 5003,
  Yv = [
    0, 1, 3, 7, 15, 31, 63, 127, 255, 511, 1023, 2047, 4095, 8191, 16383, 32767,
    65535,
  ];
function Lv(
  o,
  d,
  v,
  f,
  g = _1(512),
  b = new Uint8Array(256),
  N = new Int32Array(l1),
  M = new Int32Array(l1),
) {
  let B = N.length,
    q = Math.max(2, f);
  (b.fill(0), M.fill(0), N.fill(-1));
  let w = 0,
    p = 0,
    j = q + 1,
    Z = j,
    k = !1,
    W = Z,
    V = (1 << W) - 1,
    oe = 1 << (j - 1),
    ne = oe + 1,
    z = oe + 2,
    te = 0,
    P = v[0],
    le = 0;
  for (let ee = B; ee < 65536; ee *= 2) ++le;
  ((le = 8 - le), g.writeByte(q), F(oe));
  let K = v.length;
  for (let ee = 1; ee < K; ee++)
    e: {
      let Ee = v[ee],
        pe = (Ee << Wf) + P,
        he = (Ee << le) ^ P;
      if (N[he] === pe) {
        P = M[he];
        break e;
      }
      let ct = he === 0 ? 1 : B - he;
      for (; N[he] >= 0; )
        if (((he -= ct), he < 0 && (he += B), N[he] === pe)) {
          P = M[he];
          break e;
        }
      (F(P),
        (P = Ee),
        z < 1 << Wf
          ? ((M[he] = z++), (N[he] = pe))
          : (N.fill(-1), (z = oe + 2), (k = !0), F(oe)));
    }
  return (F(P), F(ne), g.writeByte(0), g.bytesView());
  function F(ee) {
    for (w &= Yv[p], p > 0 ? (w |= ee << p) : (w = ee), p += W; p >= 8; )
      ((b[te++] = w & 255),
        te >= 254 && (g.writeByte(te), g.writeBytesView(b, 0, te), (te = 0)),
        (w >>= 8),
        (p -= 8));
    if (
      ((z > V || k) &&
        (k
          ? ((W = Z), (V = (1 << W) - 1), (k = !1))
          : (++W, (V = W === Wf ? 1 << W : (1 << W) - 1))),
      ee == ne)
    ) {
      for (; p > 0; )
        ((b[te++] = w & 255),
          te >= 254 && (g.writeByte(te), g.writeBytesView(b, 0, te), (te = 0)),
          (w >>= 8),
          (p -= 8));
      te > 0 && (g.writeByte(te), g.writeBytesView(b, 0, te), (te = 0));
    }
  }
}
var Gv = Lv;
function U1(o, d, v) {
  return ((o << 8) & 63488) | ((d << 2) & 992) | (v >> 3);
}
function H1(o, d, v, f) {
  return (o >> 4) | (d & 240) | ((v & 240) << 4) | ((f & 240) << 8);
}
function B1(o, d, v) {
  return ((o >> 4) << 8) | (d & 240) | (v >> 4);
}
function So(o, d, v) {
  return o < d ? d : o > v ? v : o;
}
function Ao(o) {
  return o * o;
}
function n1(o, d, v) {
  var f = 0,
    g = 1e100;
  let b = o[d],
    N = b.cnt;
  b.ac;
  let M = b.rc,
    B = b.gc,
    q = b.bc;
  for (var w = b.fw; w != 0; w = o[w].fw) {
    let j = o[w],
      Z = j.cnt,
      k = (N * Z) / (N + Z);
    if (!(k >= g)) {
      var p = 0;
      ((p += k * Ao(j.rc - M)),
        !(p >= g) &&
          ((p += k * Ao(j.gc - B)),
          !(p >= g) &&
            ((p += k * Ao(j.bc - q)), !(p >= g) && ((g = p), (f = w)))));
    }
  }
  ((b.err = g), (b.nn = f));
}
function Pf() {
  return {
    ac: 0,
    rc: 0,
    gc: 0,
    bc: 0,
    cnt: 0,
    nn: 0,
    fw: 0,
    bk: 0,
    tm: 0,
    mtm: 0,
    err: 0,
  };
}
function Xv(o, d) {
  let v = d === "rgb444" ? 4096 : 65536,
    f = new Array(v),
    g = o.length;
  if (d === "rgba4444")
    for (let b = 0; b < g; ++b) {
      let N = o[b],
        M = (N >> 24) & 255,
        B = (N >> 16) & 255,
        q = (N >> 8) & 255,
        w = N & 255,
        p = H1(w, q, B, M),
        j = p in f ? f[p] : (f[p] = Pf());
      ((j.rc += w), (j.gc += q), (j.bc += B), (j.ac += M), j.cnt++);
    }
  else if (d === "rgb444")
    for (let b = 0; b < g; ++b) {
      let N = o[b],
        M = (N >> 16) & 255,
        B = (N >> 8) & 255,
        q = N & 255,
        w = B1(q, B, M),
        p = w in f ? f[w] : (f[w] = Pf());
      ((p.rc += q), (p.gc += B), (p.bc += M), p.cnt++);
    }
  else
    for (let b = 0; b < g; ++b) {
      let N = o[b],
        M = (N >> 16) & 255,
        B = (N >> 8) & 255,
        q = N & 255,
        w = U1(q, B, M),
        p = w in f ? f[w] : (f[w] = Pf());
      ((p.rc += q), (p.gc += B), (p.bc += M), p.cnt++);
    }
  return f;
}
function kv(o, d, v = {}) {
  let {
    format: f = "rgb565",
    clearAlpha: g = !0,
    clearAlphaColor: b = 0,
    clearAlphaThreshold: N = 0,
    oneBitAlpha: M = !1,
  } = v;
  if (!o || !o.buffer)
    throw new Error("quantize() expected RGBA Uint8Array data");
  if (!(o instanceof Uint8Array) && !(o instanceof Uint8ClampedArray))
    throw new Error("quantize() expected RGBA Uint8Array data");
  let B = new Uint32Array(o.buffer),
    q = v.useSqrt !== !1,
    w = f === "rgba4444",
    p = Xv(B, f),
    j = p.length,
    Z = j - 1,
    k = new Uint32Array(j + 1);
  for (var W = 0, V = 0; V < j; ++V) {
    let Fe = p[V];
    if (Fe != null) {
      var oe = 1 / Fe.cnt;
      (w && (Fe.ac *= oe),
        (Fe.rc *= oe),
        (Fe.gc *= oe),
        (Fe.bc *= oe),
        (p[W++] = Fe));
    }
  }
  Ao(d) / W < 0.022 && (q = !1);
  for (var V = 0; V < W - 1; ++V)
    ((p[V].fw = V + 1),
      (p[V + 1].bk = V),
      q && (p[V].cnt = Math.sqrt(p[V].cnt)));
  q && (p[V].cnt = Math.sqrt(p[V].cnt));
  var ne, z, te;
  for (V = 0; V < W; ++V) {
    n1(p, V);
    var P = p[V].err;
    for (
      z = ++k[0];
      z > 1 && ((te = z >> 1), !(p[(ne = k[te])].err <= P));
      z = te
    )
      k[z] = ne;
    k[z] = V;
  }
  var le = W - d;
  for (V = 0; V < le; ) {
    for (var K; ; ) {
      var F = k[1];
      if (((K = p[F]), K.tm >= K.mtm && p[K.nn].mtm <= K.tm)) break;
      K.mtm == Z ? (F = k[1] = k[k[0]--]) : (n1(p, F), (K.tm = V));
      var P = p[F].err;
      for (
        z = 1;
        (te = z + z) <= k[0] &&
        (te < k[0] && p[k[te]].err > p[k[te + 1]].err && te++,
        !(P <= p[(ne = k[te])].err));
        z = te
      )
        k[z] = ne;
      k[z] = F;
    }
    var ee = p[K.nn],
      Ee = K.cnt,
      pe = ee.cnt,
      oe = 1 / (Ee + pe);
    (w && (K.ac = oe * (Ee * K.ac + pe * ee.ac)),
      (K.rc = oe * (Ee * K.rc + pe * ee.rc)),
      (K.gc = oe * (Ee * K.gc + pe * ee.gc)),
      (K.bc = oe * (Ee * K.bc + pe * ee.bc)),
      (K.cnt += ee.cnt),
      (K.mtm = ++V),
      (p[ee.bk].fw = ee.fw),
      (p[ee.fw].bk = ee.bk),
      (ee.mtm = Z));
  }
  let he = [];
  var ct = 0;
  for (V = 0; ; ++ct) {
    let Fe = So(Math.round(p[V].rc), 0, 255),
      Ae = So(Math.round(p[V].gc), 0, 255),
      J = So(Math.round(p[V].bc), 0, 255),
      re = 255;
    w &&
      ((re = So(Math.round(p[V].ac), 0, 255)),
      M && (re = re <= (typeof M == "number" ? M : 127) ? 0 : 255),
      g && re <= N && ((Fe = Ae = J = b), (re = 0)));
    let ye = w ? [Fe, Ae, J, re] : [Fe, Ae, J];
    if ((Vv(he, ye) || he.push(ye), (V = p[V].fw) == 0)) break;
  }
  return he;
}
function Vv(o, d) {
  for (let v = 0; v < o.length; v++) {
    let f = o[v],
      g = f[0] === d[0] && f[1] === d[1] && f[2] === d[2],
      b = f.length >= 4 && d.length >= 4 ? f[3] === d[3] : !0;
    if (g && b) return !0;
  }
  return !1;
}
function Qv(o, d, v = "rgb565") {
  if (!o || !o.buffer)
    throw new Error("quantize() expected RGBA Uint8Array data");
  if (!(o instanceof Uint8Array) && !(o instanceof Uint8ClampedArray))
    throw new Error("quantize() expected RGBA Uint8Array data");
  if (d.length > 256)
    throw new Error("applyPalette() only works with 256 colors or less");
  let f = new Uint32Array(o.buffer),
    g = f.length,
    b = v === "rgb444" ? 4096 : 65536,
    N = new Uint8Array(g),
    M = new Array(b);
  if (v === "rgba4444")
    for (let B = 0; B < g; B++) {
      let q = f[B],
        w = (q >> 24) & 255,
        p = (q >> 16) & 255,
        j = (q >> 8) & 255,
        Z = q & 255,
        k = H1(Z, j, p, w),
        W = k in M ? M[k] : (M[k] = Zv(Z, j, p, w, d));
      N[B] = W;
    }
  else {
    let B = v === "rgb444" ? B1 : U1;
    for (let q = 0; q < g; q++) {
      let w = f[q],
        p = (w >> 16) & 255,
        j = (w >> 8) & 255,
        Z = w & 255,
        k = B(Z, j, p),
        W = k in M ? M[k] : (M[k] = Kv(Z, j, p, d));
      N[q] = W;
    }
  }
  return N;
}
function Zv(o, d, v, f, g) {
  let b = 0,
    N = 1e100;
  for (let M = 0; M < g.length; M++) {
    let B = g[M],
      q = B[3],
      w = Su(q - f);
    if (w > N) continue;
    let p = B[0];
    if (((w += Su(p - o)), w > N)) continue;
    let j = B[1];
    if (((w += Su(j - d)), w > N)) continue;
    let Z = B[2];
    ((w += Su(Z - v)), !(w > N) && ((N = w), (b = M)));
  }
  return b;
}
function Kv(o, d, v, f) {
  let g = 0,
    b = 1e100;
  for (let N = 0; N < f.length; N++) {
    let M = f[N],
      B = M[0],
      q = Su(B - o);
    if (q > b) continue;
    let w = M[1];
    if (((q += Su(w - d)), q > b)) continue;
    let p = M[2];
    ((q += Su(p - v)), !(q > b) && ((b = q), (g = N)));
  }
  return g;
}
function Su(o) {
  return o * o;
}
function Jv(o = {}) {
  let { initialCapacity: d = 4096, auto: v = !0 } = o,
    f = _1(d),
    g = 5003,
    b = new Uint8Array(256),
    N = new Int32Array(g),
    M = new Int32Array(g),
    B = !1;
  return {
    reset() {
      (f.reset(), (B = !1));
    },
    finish() {
      f.writeByte(qv.trailer);
    },
    bytes() {
      return f.bytes();
    },
    bytesView() {
      return f.bytesView();
    },
    get buffer() {
      return f.buffer;
    },
    get stream() {
      return f;
    },
    writeHeader: q,
    writeFrame(w, p, j, Z = {}) {
      let {
          transparent: k = !1,
          transparentIndex: W = 0,
          delay: V = 0,
          palette: oe = null,
          repeat: ne = 0,
          colorDepth: z = 8,
          dispose: te = -1,
        } = Z,
        P = !1;
      if (
        (v ? B || ((P = !0), q(), (B = !0)) : (P = !!Z.first),
        (p = Math.max(0, Math.floor(p))),
        (j = Math.max(0, Math.floor(j))),
        P)
      ) {
        if (!oe)
          throw new Error("First frame must include a { palette } option");
        ($v(f, p, j, oe, z), u1(f, oe), ne >= 0 && Iv(f, ne));
      }
      let le = Math.round(V / 10);
      Fv(f, te, le, k, W);
      let K = !!oe && !P;
      (Wv(f, p, j, K ? oe : null), K && u1(f, oe), Pv(f, w, p, j, z, b, N, M));
    },
  };
  function q() {
    j1(f, "GIF89a");
  }
}
function Fv(o, d, v, f, g) {
  (o.writeByte(33),
    o.writeByte(249),
    o.writeByte(4),
    g < 0 && ((g = 0), (f = !1)));
  var b, N;
  (f ? ((b = 1), (N = 2)) : ((b = 0), (N = 0)),
    d >= 0 && (N = d & 7),
    (N <<= 2),
    o.writeByte(0 | N | 0 | b),
    Bn(o, v),
    o.writeByte(g || 0),
    o.writeByte(0));
}
function $v(o, d, v, f, g = 8) {
  let b = 1,
    N = 0,
    M = Nm(f.length) - 1,
    B = (b << 7) | ((g - 1) << 4) | (N << 3) | M;
  (Bn(o, d), Bn(o, v), o.writeBytes([B, 0, 0]));
}
function Iv(o, d) {
  (o.writeByte(33),
    o.writeByte(255),
    o.writeByte(11),
    j1(o, "NETSCAPE2.0"),
    o.writeByte(3),
    o.writeByte(1),
    Bn(o, d),
    o.writeByte(0));
}
function u1(o, d) {
  let v = 1 << Nm(d.length);
  for (let f = 0; f < v; f++) {
    let g = [0, 0, 0];
    (f < d.length && (g = d[f]),
      o.writeByte(g[0]),
      o.writeByte(g[1]),
      o.writeByte(g[2]));
  }
}
function Wv(o, d, v, f) {
  if ((o.writeByte(44), Bn(o, 0), Bn(o, 0), Bn(o, d), Bn(o, v), f)) {
    let g = 0,
      b = 0,
      N = Nm(f.length) - 1;
    o.writeByte(128 | g | b | 0 | N);
  } else o.writeByte(0);
}
function Pv(o, d, v, f, g = 8, b, N, M) {
  Gv(v, f, d, g, o, b, N, M);
}
function Bn(o, d) {
  (o.writeByte(d & 255), o.writeByte((d >> 8) & 255));
}
function j1(o, d) {
  for (var v = 0; v < d.length; v++) o.writeByte(d.charCodeAt(v));
}
function Nm(o) {
  return Math.max(Math.ceil(Math.log2(o)), 1);
}
const FR_MIN_FRAME = 0.02,
  fv = (o) => (Number.isInteger(o) ? String(o) : String(Math.round(o * 100) / 100)),
  Jt = (o) => {
    const v = Number(o == null ? void 0 : o.duration);
    return Number.isFinite(v) && v > 0
      ? Math.max(FR_MIN_FRAME, Math.round(v * 1e4) / 1e4)
      : 1;
  };
function Ti(o, d) {
  if (d < 0 || d >= o.length) return 0;
  if (Number.isFinite(o[d].start)) return Math.max(0, o[d].start);
  let v = 0;
  for (let f = 0; f <= d; f++) {
    const g = o[f],
      b = Number.isFinite(g.start) ? Math.max(0, g.start) : v;
    if (f === d) return b;
    v = b + Jt(g);
  }
  return 0;
}
function qc(o) {
  let d = 0;
  return o.map((v) => {
    const f = Number.isFinite(v.start) ? Math.max(0, v.start) : d;
    return ((d = f + Jt(v)), { ...v, start: f, duration: Jt(v) });
  });
}
function Hn(o) {
  let d = 0,
    v = 0;
  for (const f of o)
    ((d = (Number.isFinite(f.start) ? Math.max(0, f.start) : d) + Jt(f)),
      (v = Math.max(v, d)));
  return v;
}
function gm(o, d, v) {
  const f = Math.max(0, Math.floor(d * v + 1e-7));
  let g = 0;
  for (let b = 0; b < o.length; b++) {
    const N = Number.isFinite(o[b].start) ? Math.max(0, o[b].start) : g;
    if (((g = N + Jt(o[b])), f >= N && f < N + Jt(o[b]))) return b;
  }
  return -1;
}
function Oo(o, d, v) {
  const f = qc(o),
    g = f.find((w) => w.id === d);
  if (!g) return f;
  const b = f.filter((w) => w.id !== d);
  let N = Math.max(0, Math.round(v * 1e4) / 1e4);
  const M = b.find((w) => N > w.start && N < w.start + Jt(w));
  (M && (N = M.start), (g.start = N));
  const B = [...b, g].sort(
    (w, p) => w.start - p.start || (w.id === d ? -1 : p.id === d ? 1 : 0),
  );
  let q = 0;
  for (const w of B) (w.start < q && (w.start = q), (q = w.start + Jt(w)));
  return B;
}
const ep = () => new Promise((o) => setTimeout(o, 0));
async function loadExportVideo(clip) {
  const blob = clip.mediaId ? await pm(clip.mediaId) : null;
  const source = blob ? URL.createObjectURL(blob) : clip.url;
  if (!source) throw Error(`Vídeo indisponível: ${clip.name || clip.id}`);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = source;
  try {
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () =>
        reject(Error(`Não foi possível abrir ${clip.name || "vídeo"}`));
      video.load();
    });
    await seekExportVideo(
      video,
      Math.min(
        Math.max(0, clip.offset || 0),
        Math.max(0, video.duration - 0.001),
      ),
    );
    return { clip, video, objectUrl: blob ? source : null };
  } catch (error) {
    if (blob) URL.revokeObjectURL(source);
    throw error;
  }
}
async function seekExportVideo(video, time) {
  if (Math.abs(video.currentTime - time) < 0.001 && video.readyState >= 2)
    return;
  if (Math.abs(video.currentTime - time) < 0.001) {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(Error("Tempo esgotado ao carregar vídeo"));
      }, 10000);
      const cleanup = () => {
        clearTimeout(timeout);
        video.removeEventListener("loadeddata", onLoaded);
        video.removeEventListener("error", onError);
      };
      const onLoaded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(Error("Falha ao carregar vídeo"));
      };
      video.addEventListener("loadeddata", onLoaded, { once: true });
      video.addEventListener("error", onError, { once: true });
    });
    return;
  }
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(Error("Tempo esgotado ao ler um quadro de vídeo"));
    }, 10000);
    const cleanup = () => {
      clearTimeout(timeout);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(Error("Falha ao ler um quadro de vídeo"));
    };
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    video.currentTime = time;
  });
}
async function tp(o, d, v, f, g, b, options = {}) {
  const N = document.createElement("canvas");
  ((N.width = o.width), (N.height = o.height));
  const M = N.getContext("2d"),
    B = document.createElement("canvas");
  ((B.width = N.width), (B.height = N.height));
  const q = B.getContext("2d"),
    w = new Set();
  for (const te of Object.values(o.content))
    for (const P of Object.values(te))
      for (const le of P)
        (le.src || le.brushImage) && w.add(le.src || le.brushImage);
  await Promise.all([...w].map(b));
  const videoClips = (o.clips || []).filter((clip) => clip.type === "video");
  const loadedVideos = await Promise.allSettled(
    videoClips.map(loadExportVideo),
  );
  const videos = loadedVideos
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
  const releaseVideos = () => {
    for (const { video, objectUrl } of videos) {
      video.pause();
      video.removeAttribute("src");
      video.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  };
  const failedVideo = loadedVideos.find(
    (result) => result.status === "rejected",
  );
  if (failedVideo) {
    releaseVideos();
    throw failedVideo.reason;
  }
  const p = Math.max(
      Hn(o.frames),
      Math.ceil(
        Math.max(
          0,
          ...(o.clips || []).map((clip) => clip.start + clip.duration),
        ) * o.fps,
      ),
    ),
    j = o.fps,
    Z = (te) => {
      var le;
      ((M.fillStyle = o.background || "#ffffff"),
        M.fillRect(0, 0, N.width, N.height));
      const activeVideo = videos.find(
        ({ clip }) =>
          te / j >= clip.start && te / j < clip.start + clip.duration,
      );
      if (activeVideo?.video.readyState >= 2) {
        const video = activeVideo.video;
        const scale = Math.min(
          N.width / video.videoWidth,
          N.height / video.videoHeight,
        );
        const width = video.videoWidth * scale;
        const height = video.videoHeight * scale;
        M.drawImage(
          video,
          (N.width - width) / 2,
          (N.height - height) / 2,
          width,
          height,
        );
      }
      const P = o.frames[gm(o.frames, te / j, j)];
      if (P) {
        for (const K of o.layers)
          if (K.visible) {
            q.clearRect(0, 0, N.width, N.height);
            for (const F of ((le = o.content[P.id]) == null
              ? void 0
              : le[K.id]) || [])
              v(q, F);
            (M.save(),
              (M.globalAlpha = K.opacity ?? 1),
              (M.globalCompositeOperation = f[K.blend] || "source-over"),
              M.drawImage(B, 0, 0),
              M.restore());
          }
      }
    };
  if (d === "gif") {
    try {
      const te = Jv();
      for (let P = 0; P < p; P++) {
        const seconds = P / j;
        const activeVideo = videos.find(
          ({ clip }) =>
            seconds >= clip.start && seconds < clip.start + clip.duration,
        );
        if (activeVideo) {
          const { clip, video } = activeVideo;
          await seekExportVideo(
            video,
            Math.min(
              video.duration - 0.001,
              (clip.offset || 0) + seconds - clip.start,
            ),
          );
        }
        Z(P);
        const le = M.getImageData(0, 0, N.width, N.height).data,
          K = kv(le, 256);
        (te.writeFrame(Qv(le, K), N.width, N.height, {
          palette: K,
          delay:
            (Math.round(((P + 1) * 100) / j) - Math.round((P * 100) / j)) * 10,
          repeat: 0,
        }),
          await ep());
      }
      return (te.finish(), new Blob([te.bytes()], { type: "image/gif" }));
    } finally {
      releaseVideos();
    }
  }
  const audioClips = options.includeAudio
      ? (o.clips || []).filter((clip) => clip.type === "audio")
      : [],
    mediaTypes = [
      ...(audioClips.length ? ["video/mp4;codecs=avc1.42E01E,mp4a.40.2"] : []),
      "video/mp4;codecs=avc1.42E01E",
      "video/mp4",
    ].filter((te) => {
      var P;
      return (P = globalThis.MediaRecorder) == null
        ? void 0
        : P.isTypeSupported(te);
    });
  if (!mediaTypes.length) {
    releaseVideos();
    throw Error(
      "Este navegador não suporta exportação MP4. Use um navegador com gravação MP4 ou exporte GIF.",
    );
  }
  const W = N.captureStream(j);
  let audioContext;
  try {
    audioContext = audioClips.length ? new AudioContext() : null;
  } catch (error) {
    W.getTracks().forEach((track) => track.stop());
    releaseVideos();
    throw error;
  }
  const audioDestination = audioContext?.createMediaStreamDestination(),
    audioSources = [],
    audioBuffers = new Map();
  try {
    if (audioContext) {
      for (const clip of audioClips) {
        const mediaKey = clip.mediaId || clip.url;
        if (!mediaKey)
          throw Error(`Áudio indisponível: ${clip.name || clip.id}`);
        let buffer = audioBuffers.get(mediaKey);
        if (!buffer) {
          const blob = clip.mediaId
            ? await pm(clip.mediaId)
            : await (await fetch(clip.url)).blob();
          if (!blob) throw Error(`Áudio indisponível: ${clip.name || clip.id}`);
          buffer = await audioContext.decodeAudioData(await blob.arrayBuffer());
          audioBuffers.set(mediaKey, buffer);
        }
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioDestination);
        audioSources.push({ source, clip, buffer });
      }
    }
    const outputStream = audioDestination
      ? new MediaStream([
          ...W.getVideoTracks(),
          ...audioDestination.stream.getAudioTracks(),
        ])
      : W;
    let V;
    for (const mimeType of mediaTypes) {
      try {
        V = new MediaRecorder(outputStream, { mimeType });
        break;
      } catch {
        // A browser may report a type as supported but reject this stream.
      }
    }
    if (!V) {
      throw Error(
        "Este navegador não conseguiu iniciar a gravação MP4 com estas faixas.",
      );
    }
    const oe = [],
      ne = new Promise((te, P) => {
        ((V.ondataavailable = (le) => {
          le.data.size && oe.push(le.data);
        }),
          (V.onstop = () => te(new Blob(oe, { type: "video/mp4" }))),
          (V.onerror = (le) => P(le.error || Error("Falha ao gravar MP4"))));
      });
    const videoTimers = [];
    try {
      (Z(0), V.start());
      for (const { clip, video } of videos) {
        videoTimers.push(
          setTimeout(
            () => {
              video.play().catch(() => {});
              videoTimers.push(
                setTimeout(() => video.pause(), clip.duration * 1000),
              );
            },
            Math.max(0, clip.start) * 1000,
          ),
        );
      }
      if (audioContext) {
        await audioContext.resume();
        const startTime = audioContext.currentTime + 0.02;
        for (const { source, clip, buffer } of audioSources) {
          const offset = Math.max(0, clip.offset || 0);
          const duration = Math.min(clip.duration, buffer.duration - offset);
          if (duration > 0)
            source.start(startTime + Math.max(0, clip.start), offset, duration);
        }
      }
      const te = performance.now();
      for (let P = 0; P < p; P++)
        (Z(P),
          await new Promise((le) =>
            setTimeout(
              le,
              Math.max(0, te + ((P + 1) * 1e3) / j - performance.now()),
            ),
          ));
      return (V.stop(), await ne);
    } finally {
      (videoTimers.forEach(clearTimeout), V.state !== "inactive" && V.stop());
    }
  } finally {
    W.getTracks().forEach((track) => track.stop());
    audioDestination?.stream.getTracks().forEach((track) => track.stop());
    await audioContext?.close();
    releaseVideos();
  }
}
function ap(o) {
  return o && o.__esModule && Object.prototype.hasOwnProperty.call(o, "default")
    ? o.default
    : o;
}
var em = { exports: {} },
  Se = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */ var i1;
function lp() {
  if (i1) return Se;
  i1 = 1;
  var o = Symbol.for("react.transitional.element"),
    d = Symbol.for("react.portal"),
    v = Symbol.for("react.fragment"),
    f = Symbol.for("react.strict_mode"),
    g = Symbol.for("react.profiler"),
    b = Symbol.for("react.consumer"),
    N = Symbol.for("react.context"),
    M = Symbol.for("react.forward_ref"),
    B = Symbol.for("react.suspense"),
    q = Symbol.for("react.memo"),
    w = Symbol.for("react.lazy"),
    p = Symbol.for("react.activity"),
    j = Symbol.for("react.view_transition"),
    Z = Symbol.iterator;
  function k(T) {
    return T === null || typeof T != "object"
      ? null
      : ((T = (Z && T[Z]) || T["@@iterator"]),
        typeof T == "function" ? T : null);
  }
  var W = {
      isMounted: function () {
        return !1;
      },
      enqueueForceUpdate: function () {},
      enqueueReplaceState: function () {},
      enqueueSetState: function () {},
    },
    V = Object.assign,
    oe = {};
  function ne(T, Q, fe) {
    ((this.props = T),
      (this.context = Q),
      (this.refs = oe),
      (this.updater = fe || W));
  }
  ((ne.prototype.isReactComponent = {}),
    (ne.prototype.setState = function (T, Q) {
      if (typeof T != "object" && typeof T != "function" && T != null)
        throw Error(
          "takes an object of state variables to update or a function which returns an object of state variables.",
        );
      this.updater.enqueueSetState(this, T, Q, "setState");
    }),
    (ne.prototype.forceUpdate = function (T) {
      this.updater.enqueueForceUpdate(this, T, "forceUpdate");
    }));
  function z() {}
  z.prototype = ne.prototype;
  function te(T, Q, fe) {
    ((this.props = T),
      (this.context = Q),
      (this.refs = oe),
      (this.updater = fe || W));
  }
  var P = (te.prototype = new z());
  ((P.constructor = te), V(P, ne.prototype), (P.isPureReactComponent = !0));
  var le = Array.isArray;
  function K() {}
  var F = { H: null, A: null, T: null, S: null },
    ee = Object.prototype.hasOwnProperty;
  function Ee(T, Q, fe) {
    var ce = fe.ref;
    return {
      $$typeof: o,
      type: T,
      key: Q,
      ref: ce !== void 0 ? ce : null,
      props: fe,
    };
  }
  function pe(T, Q) {
    return Ee(T.type, Q, T.props);
  }
  function he(T) {
    return typeof T == "object" && T !== null && T.$$typeof === o;
  }
  function ct(T) {
    var Q = { "=": "=0", ":": "=2" };
    return (
      "$" +
      T.replace(/[=:]/g, function (fe) {
        return Q[fe];
      })
    );
  }
  var Fe = /\/+/g;
  function Ae(T, Q) {
    return typeof T == "object" && T !== null && T.key != null
      ? ct("" + T.key)
      : Q.toString(36);
  }
  function J(T) {
    switch (T.status) {
      case "fulfilled":
        return T.value;
      case "rejected":
        throw T.reason;
      default:
        switch (
          (typeof T.status == "string"
            ? T.then(K, K)
            : ((T.status = "pending"),
              T.then(
                function (Q) {
                  T.status === "pending" &&
                    ((T.status = "fulfilled"), (T.value = Q));
                },
                function (Q) {
                  T.status === "pending" &&
                    ((T.status = "rejected"), (T.reason = Q));
                },
              )),
          T.status)
        ) {
          case "fulfilled":
            return T.value;
          case "rejected":
            throw T.reason;
        }
    }
    throw T;
  }
  function re(T, Q, fe, ce, Ye) {
    var we = typeof T;
    (we === "undefined" || we === "boolean") && (T = null);
    var Ge = !1;
    if (T === null) Ge = !0;
    else
      switch (we) {
        case "bigint":
        case "string":
        case "number":
          Ge = !0;
          break;
        case "object":
          switch (T.$$typeof) {
            case o:
            case d:
              Ge = !0;
              break;
            case w:
              return ((Ge = T._init), re(Ge(T._payload), Q, fe, ce, Ye));
          }
      }
    if (Ge)
      return (
        (Ye = Ye(T)),
        (Ge = ce === "" ? "." + Ae(T, 0) : ce),
        le(Ye)
          ? ((fe = ""),
            Ge != null && (fe = Ge.replace(Fe, "$&/") + "/"),
            re(Ye, Q, fe, "", function (Oe) {
              return Oe;
            }))
          : Ye != null &&
            (he(Ye) &&
              (Ye = pe(
                Ye,
                fe +
                  (Ye.key == null || (T && T.key === Ye.key)
                    ? ""
                    : ("" + Ye.key).replace(Fe, "$&/") + "/") +
                  Ge,
              )),
            Q.push(Ye)),
        1
      );
    Ge = 0;
    var ie = ce === "" ? "." : ce + ":";
    if (le(T))
      for (var ve = 0; ve < T.length; ve++)
        ((ce = T[ve]), (we = ie + Ae(ce, ve)), (Ge += re(ce, Q, fe, we, Ye)));
    else if (((ve = k(T)), typeof ve == "function"))
      for (T = ve.call(T), ve = 0; !(ce = T.next()).done; )
        ((ce = ce.value),
          (we = ie + Ae(ce, ve++)),
          (Ge += re(ce, Q, fe, we, Ye)));
    else if (we === "object") {
      if (typeof T.then == "function") return re(J(T), Q, fe, ce, Ye);
      throw (
        (Q = String(T)),
        Error(
          "Objects are not valid as a React child (found: " +
            (Q === "[object Object]"
              ? "object with keys {" + Object.keys(T).join(", ") + "}"
              : Q) +
            "). If you meant to render a collection of children, use an array instead.",
        )
      );
    }
    return Ge;
  }
  function ye(T, Q, fe) {
    if (T == null) return T;
    var ce = [],
      Ye = 0;
    return (
      re(T, ce, "", "", function (we) {
        return Q.call(fe, we, Ye++);
      }),
      ce
    );
  }
  function xe(T) {
    if (T._status === -1) {
      var Q = T._result,
        fe = Q();
      (fe.then(
        function (ce) {
          (T._status === 0 || T._status === -1) &&
            ((T._status = 1),
            (T._result = ce),
            fe.status === void 0 &&
              ((fe.status = "fulfilled"), (fe.value = ce)));
        },
        function (ce) {
          (T._status === 0 || T._status === -1) &&
            ((T._status = 2),
            (T._result = ce),
            fe.status === void 0 &&
              ((fe.status = "rejected"), (fe.reason = ce)));
        },
      ),
        T._status === -1 && ((T._status = 0), (T._result = fe)));
    }
    if (T._status === 1) return T._result.default;
    throw T._result;
  }
  var ke =
    typeof reportError == "function"
      ? reportError
      : function (T) {
          if (
            typeof window == "object" &&
            typeof window.ErrorEvent == "function"
          ) {
            var Q = new window.ErrorEvent("error", {
              bubbles: !0,
              cancelable: !0,
              message:
                typeof T == "object" &&
                T !== null &&
                typeof T.message == "string"
                  ? String(T.message)
                  : String(T),
              error: T,
            });
            if (!window.dispatchEvent(Q)) return;
          } else if (
            typeof process == "object" &&
            typeof process.emit == "function"
          ) {
            process.emit("uncaughtException", T);
            return;
          }
          console.error(T);
        };
  function Yt(T) {
    var Q = F.T,
      fe = {};
    ((fe.types = Q !== null ? Q.types : null), (F.T = fe));
    try {
      var ce = T(),
        Ye = F.S;
      (Ye !== null && Ye(fe, ce),
        typeof ce == "object" &&
          ce !== null &&
          typeof ce.then == "function" &&
          ce.then(K, ke));
    } catch (we) {
      ke(we);
    } finally {
      (Q !== null && fe.types !== null && (Q.types = fe.types), (F.T = Q));
    }
  }
  function ga(T) {
    var Q = F.T;
    if (Q !== null) {
      var fe = Q.types;
      fe === null ? (Q.types = [T]) : fe.indexOf(T) === -1 && fe.push(T);
    } else Yt(ga.bind(null, T));
  }
  var xa = {
    map: ye,
    forEach: function (T, Q, fe) {
      ye(
        T,
        function () {
          Q.apply(this, arguments);
        },
        fe,
      );
    },
    count: function (T) {
      var Q = 0;
      return (
        ye(T, function () {
          Q++;
        }),
        Q
      );
    },
    toArray: function (T) {
      return (
        ye(T, function (Q) {
          return Q;
        }) || []
      );
    },
    only: function (T) {
      if (!he(T))
        throw Error(
          "React.Children.only expected to receive a single React element child.",
        );
      return T;
    },
  };
  return (
    (Se.Activity = p),
    (Se.Children = xa),
    (Se.Component = ne),
    (Se.Fragment = v),
    (Se.Profiler = g),
    (Se.PureComponent = te),
    (Se.StrictMode = f),
    (Se.Suspense = B),
    (Se.ViewTransition = j),
    (Se.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = F),
    (Se.__COMPILER_RUNTIME = {
      __proto__: null,
      c: function (T) {
        return F.H.useMemoCache(T);
      },
    }),
    (Se.addTransitionType = ga),
    (Se.cache = function (T) {
      return function () {
        return T.apply(null, arguments);
      };
    }),
    (Se.cacheSignal = function () {
      return null;
    }),
    (Se.cloneElement = function (T, Q, fe) {
      if (T == null)
        throw Error(
          "The argument must be a React element, but you passed " + T + ".",
        );
      var ce = V({}, T.props),
        Ye = T.key;
      if (Q != null)
        for (we in (Q.key !== void 0 && (Ye = "" + Q.key), Q))
          !ee.call(Q, we) ||
            we === "key" ||
            we === "__self" ||
            we === "__source" ||
            (we === "ref" && Q.ref === void 0) ||
            (ce[we] = Q[we]);
      var we = arguments.length - 2;
      if (we === 1) ce.children = fe;
      else if (1 < we) {
        for (var Ge = Array(we), ie = 0; ie < we; ie++)
          Ge[ie] = arguments[ie + 2];
        ce.children = Ge;
      }
      return Ee(T.type, Ye, ce);
    }),
    (Se.createContext = function (T) {
      return (
        (T = {
          $$typeof: N,
          _currentValue: T,
          _currentValue2: T,
          _threadCount: 0,
          Provider: null,
          Consumer: null,
        }),
        (T.Provider = T),
        (T.Consumer = { $$typeof: b, _context: T }),
        T
      );
    }),
    (Se.createElement = function (T, Q, fe) {
      var ce,
        Ye = {},
        we = null;
      if (Q != null)
        for (ce in (Q.key !== void 0 && (we = "" + Q.key), Q))
          ee.call(Q, ce) &&
            ce !== "key" &&
            ce !== "__self" &&
            ce !== "__source" &&
            (Ye[ce] = Q[ce]);
      var Ge = arguments.length - 2;
      if (Ge === 1) Ye.children = fe;
      else if (1 < Ge) {
        for (var ie = Array(Ge), ve = 0; ve < Ge; ve++)
          ie[ve] = arguments[ve + 2];
        Ye.children = ie;
      }
      if (T && T.defaultProps)
        for (ce in ((Ge = T.defaultProps), Ge))
          Ye[ce] === void 0 && (Ye[ce] = Ge[ce]);
      return Ee(T, we, Ye);
    }),
    (Se.createRef = function () {
      return { current: null };
    }),
    (Se.forwardRef = function (T) {
      return { $$typeof: M, render: T };
    }),
    (Se.isValidElement = he),
    (Se.lazy = function (T) {
      return { $$typeof: w, _payload: { _status: -1, _result: T }, _init: xe };
    }),
    (Se.memo = function (T, Q) {
      return { $$typeof: q, type: T, compare: Q === void 0 ? null : Q };
    }),
    (Se.startTransition = Yt),
    (Se.unstable_useCacheRefresh = function () {
      return F.H.useCacheRefresh();
    }),
    (Se.use = function (T) {
      return F.H.use(T);
    }),
    (Se.useActionState = function (T, Q, fe) {
      return F.H.useActionState(T, Q, fe);
    }),
    (Se.useCallback = function (T, Q) {
      return F.H.useCallback(T, Q);
    }),
    (Se.useContext = function (T) {
      return F.H.useContext(T);
    }),
    (Se.useDebugValue = function () {}),
    (Se.useDeferredValue = function (T, Q) {
      return F.H.useDeferredValue(T, Q);
    }),
    (Se.useEffect = function (T, Q) {
      return F.H.useEffect(T, Q);
    }),
    (Se.useEffectEvent = function (T) {
      return F.H.useEffectEvent(T);
    }),
    (Se.useId = function () {
      return F.H.useId();
    }),
    (Se.useImperativeHandle = function (T, Q, fe) {
      return F.H.useImperativeHandle(T, Q, fe);
    }),
    (Se.useInsertionEffect = function (T, Q) {
      return F.H.useInsertionEffect(T, Q);
    }),
    (Se.useLayoutEffect = function (T, Q) {
      return F.H.useLayoutEffect(T, Q);
    }),
    (Se.useMemo = function (T, Q) {
      return F.H.useMemo(T, Q);
    }),
    (Se.useOptimistic = function (T, Q) {
      return F.H.useOptimistic(T, Q);
    }),
    (Se.useReducer = function (T, Q, fe) {
      return F.H.useReducer(T, Q, fe);
    }),
    (Se.useRef = function (T) {
      return F.H.useRef(T);
    }),
    (Se.useState = function (T) {
      return F.H.useState(T);
    }),
    (Se.useSyncExternalStore = function (T, Q, fe) {
      return F.H.useSyncExternalStore(T, Q, fe);
    }),
    (Se.useTransition = function () {
      return F.H.useTransition();
    }),
    (Se.version = "19.3.1"),
    Se
  );
}
var c1;
function Mm() {
  return (c1 || ((c1 = 1), (em.exports = lp())), em.exports);
}
var Y = Mm();
const r = ap(Y);
var tm = { exports: {} },
  Rc = {},
  am = { exports: {} },
  lm = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */ var r1;
function np() {
  return (
    r1 ||
      ((r1 = 1),
      (function (o) {
        function d(J, re) {
          var ye = J.length;
          J.push(re);
          e: for (; 0 < ye; ) {
            var xe = (ye - 1) >>> 1,
              ke = J[xe];
            if (0 < g(ke, re)) ((J[xe] = re), (J[ye] = ke), (ye = xe));
            else break e;
          }
        }
        function v(J) {
          return J.length === 0 ? null : J[0];
        }
        function f(J) {
          if (J.length === 0) return null;
          var re = J[0],
            ye = J.pop();
          if (ye !== re) {
            J[0] = ye;
            e: for (var xe = 0, ke = J.length, Yt = ke >>> 1; xe < Yt; ) {
              var ga = 2 * (xe + 1) - 1,
                xa = J[ga],
                T = ga + 1,
                Q = J[T];
              if (0 > g(xa, ye))
                T < ke && 0 > g(Q, xa)
                  ? ((J[xe] = Q), (J[T] = ye), (xe = T))
                  : ((J[xe] = xa), (J[ga] = ye), (xe = ga));
              else if (T < ke && 0 > g(Q, ye))
                ((J[xe] = Q), (J[T] = ye), (xe = T));
              else break e;
            }
          }
          return re;
        }
        function g(J, re) {
          var ye = J.sortIndex - re.sortIndex;
          return ye !== 0 ? ye : J.id - re.id;
        }
        if (
          ((o.unstable_now = void 0),
          typeof performance == "object" &&
            typeof performance.now == "function")
        ) {
          var b = performance;
          o.unstable_now = function () {
            return b.now();
          };
        } else {
          var N = Date,
            M = N.now();
          o.unstable_now = function () {
            return N.now() - M;
          };
        }
        var B = [],
          q = [],
          w = 1,
          p = null,
          j = 3,
          Z = !1,
          k = !1,
          W = !1,
          V = !1,
          oe = typeof setTimeout == "function" ? setTimeout : null,
          ne = typeof clearTimeout == "function" ? clearTimeout : null,
          z = typeof setImmediate < "u" ? setImmediate : null;
        function te(J) {
          for (var re = v(q); re !== null; ) {
            if (re.callback === null) f(q);
            else if (re.startTime <= J)
              (f(q), (re.sortIndex = re.expirationTime), d(B, re));
            else break;
            re = v(q);
          }
        }
        function P(J) {
          if (((W = !1), te(J), !k))
            if (v(B) !== null) ((k = !0), le || ((le = !0), he()));
            else {
              var re = v(q);
              re !== null && Ae(P, re.startTime - J);
            }
        }
        var le = !1,
          K = -1,
          F = 5,
          ee = -1;
        function Ee() {
          return V ? !0 : !(o.unstable_now() - ee < F);
        }
        function pe() {
          if (((V = !1), le)) {
            var J = o.unstable_now();
            ee = J;
            var re = !0;
            try {
              e: {
                ((k = !1), W && ((W = !1), ne(K), (K = -1)), (Z = !0));
                var ye = j;
                try {
                  t: {
                    for (
                      te(J), p = v(B);
                      p !== null && !(p.expirationTime > J && Ee());

                    ) {
                      var xe = p.callback;
                      if (typeof xe == "function") {
                        ((p.callback = null), (j = p.priorityLevel));
                        var ke = xe(p.expirationTime <= J);
                        if (((J = o.unstable_now()), typeof ke == "function")) {
                          ((p.callback = ke), te(J), (re = !0));
                          break t;
                        }
                        (p === v(B) && f(B), te(J));
                      } else f(B);
                      p = v(B);
                    }
                    if (p !== null) re = !0;
                    else {
                      var Yt = v(q);
                      (Yt !== null && Ae(P, Yt.startTime - J), (re = !1));
                    }
                  }
                  break e;
                } finally {
                  ((p = null), (j = ye), (Z = !1));
                }
                re = void 0;
              }
            } finally {
              re ? he() : (le = !1);
            }
          }
        }
        var he;
        if (typeof z == "function")
          he = function () {
            z(pe);
          };
        else if (typeof MessageChannel < "u") {
          var ct = new MessageChannel(),
            Fe = ct.port2;
          ((ct.port1.onmessage = pe),
            (he = function () {
              Fe.postMessage(null);
            }));
        } else
          he = function () {
            oe(pe, 0);
          };
        function Ae(J, re) {
          K = oe(function () {
            J(o.unstable_now());
          }, re);
        }
        ((o.unstable_IdlePriority = 5),
          (o.unstable_ImmediatePriority = 1),
          (o.unstable_LowPriority = 4),
          (o.unstable_NormalPriority = 3),
          (o.unstable_Profiling = null),
          (o.unstable_UserBlockingPriority = 2),
          (o.unstable_cancelCallback = function (J) {
            J.callback = null;
          }),
          (o.unstable_forceFrameRate = function (J) {
            0 > J || 125 < J
              ? console.error(
                  "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported",
                )
              : (F = 0 < J ? Math.floor(1e3 / J) : 5);
          }),
          (o.unstable_getCurrentPriorityLevel = function () {
            return j;
          }),
          (o.unstable_next = function (J) {
            switch (j) {
              case 1:
              case 2:
              case 3:
                var re = 3;
                break;
              default:
                re = j;
            }
            var ye = j;
            j = re;
            try {
              return J();
            } finally {
              j = ye;
            }
          }),
          (o.unstable_requestPaint = function () {
            V = !0;
          }),
          (o.unstable_runWithPriority = function (J, re) {
            switch (J) {
              case 1:
              case 2:
              case 3:
              case 4:
              case 5:
                break;
              default:
                J = 3;
            }
            var ye = j;
            j = J;
            try {
              return re();
            } finally {
              j = ye;
            }
          }),
          (o.unstable_scheduleCallback = function (J, re, ye) {
            var xe = o.unstable_now();
            switch (
              (typeof ye == "object" && ye !== null
                ? ((ye = ye.delay),
                  (ye = typeof ye == "number" && 0 < ye ? xe + ye : xe))
                : (ye = xe),
              J)
            ) {
              case 1:
                var ke = -1;
                break;
              case 2:
                ke = 250;
                break;
              case 5:
                ke = 1073741823;
                break;
              case 4:
                ke = 1e4;
                break;
              default:
                ke = 5e3;
            }
            return (
              (ke = ye + ke),
              (J = {
                id: w++,
                callback: re,
                priorityLevel: J,
                startTime: ye,
                expirationTime: ke,
                sortIndex: -1,
              }),
              ye > xe
                ? ((J.sortIndex = ye),
                  d(q, J),
                  v(B) === null &&
                    J === v(q) &&
                    (W ? (ne(K), (K = -1)) : (W = !0), Ae(P, ye - xe)))
                : ((J.sortIndex = ke),
                  d(B, J),
                  k || Z || ((k = !0), le || ((le = !0), he()))),
              J
            );
          }),
          (o.unstable_shouldYield = Ee),
          (o.unstable_wrapCallback = function (J) {
            var re = j;
            return function () {
              var ye = j;
              j = re;
              try {
                return J.apply(this, arguments);
              } finally {
                j = ye;
              }
            };
          }));
      })(lm)),
    lm
  );
}
var o1;
function up() {
  return (o1 || ((o1 = 1), (am.exports = np())), am.exports);
}
var nm = { exports: {} },
  Kt = {};
/**
 * @license React
 * react-dom.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */ var s1;
function ip() {
  if (s1) return Kt;
  s1 = 1;
  var o = Mm();
  function d(w) {
    var p = "https://react.dev/errors/" + w;
    if (1 < arguments.length) {
      p += "?args[]=" + encodeURIComponent(arguments[1]);
      for (var j = 2; j < arguments.length; j++)
        p += "&args[]=" + encodeURIComponent(arguments[j]);
    }
    return (
      "Minified React error #" +
      w +
      "; visit " +
      p +
      " for the full message or use the non-minified dev environment for full errors and additional helpful warnings."
    );
  }
  function v() {}
  var f = {
      d: {
        f: v,
        r: function () {
          throw Error(d(522));
        },
        D: v,
        C: v,
        L: v,
        m: v,
        X: v,
        S: v,
        M: v,
      },
      p: 0,
      findDOMNode: null,
    },
    g = Symbol.for("react.portal"),
    b = Symbol.for("react.recoverable"),
    N = Symbol.for("react.optimistic_key");
  function M(w, p, j) {
    var Z =
      3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
    return {
      $$typeof: g,
      key: Z == null ? null : Z === N ? N : "" + Z,
      children: w,
      containerInfo: p,
      implementation: j,
    };
  }
  var B = o.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  function q(w, p) {
    if (w === "font") return "";
    if (typeof p == "string") return p === "use-credentials" ? p : "";
  }
  return (
    (Kt.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = f),
    (Kt.browser = function (w) {
      return { $$typeof: b, _reason: w };
    }),
    (Kt.createPortal = function (w, p) {
      var j =
        2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
      if (!p || (p.nodeType !== 1 && p.nodeType !== 9 && p.nodeType !== 11))
        throw Error(d(299));
      return M(w, p, null, j);
    }),
    (Kt.flushSync = function (w) {
      var p = B.T,
        j = f.p;
      try {
        if (((B.T = null), (f.p = 2), w)) return w();
      } finally {
        ((B.T = p), (f.p = j), f.d.f());
      }
    }),
    (Kt.preconnect = function (w, p) {
      typeof w == "string" &&
        (p
          ? ((p = p.crossOrigin),
            (p =
              typeof p == "string"
                ? p === "use-credentials"
                  ? p
                  : ""
                : void 0))
          : (p = null),
        f.d.C(w, p));
    }),
    (Kt.prefetchDNS = function (w) {
      typeof w == "string" && f.d.D(w);
    }),
    (Kt.preinit = function (w, p) {
      if (typeof w == "string" && p && typeof p.as == "string") {
        var j = p.as,
          Z = q(j, p.crossOrigin),
          k = typeof p.integrity == "string" ? p.integrity : void 0,
          W = typeof p.fetchPriority == "string" ? p.fetchPriority : void 0;
        j === "style"
          ? f.d.S(w, typeof p.precedence == "string" ? p.precedence : void 0, {
              crossOrigin: Z,
              integrity: k,
              fetchPriority: W,
            })
          : j === "script" &&
            f.d.X(w, {
              crossOrigin: Z,
              integrity: k,
              fetchPriority: W,
              nonce: typeof p.nonce == "string" ? p.nonce : void 0,
            });
      }
    }),
    (Kt.preinitModule = function (w, p) {
      if (typeof w == "string")
        if (typeof p == "object" && p !== null) {
          if (p.as == null || p.as === "script") {
            var j = q(p.as, p.crossOrigin);
            f.d.M(w, {
              crossOrigin: j,
              integrity: typeof p.integrity == "string" ? p.integrity : void 0,
              nonce: typeof p.nonce == "string" ? p.nonce : void 0,
              fetchPriority:
                typeof p.fetchPriority == "string" ? p.fetchPriority : void 0,
            });
          }
        } else p == null && f.d.M(w);
    }),
    (Kt.preload = function (w, p) {
      if (
        typeof w == "string" &&
        typeof p == "object" &&
        p !== null &&
        typeof p.as == "string"
      ) {
        var j = p.as,
          Z = q(j, p.crossOrigin);
        f.d.L(w, j, {
          crossOrigin: Z,
          integrity: typeof p.integrity == "string" ? p.integrity : void 0,
          nonce: typeof p.nonce == "string" ? p.nonce : void 0,
          type: typeof p.type == "string" ? p.type : void 0,
          fetchPriority:
            typeof p.fetchPriority == "string" ? p.fetchPriority : void 0,
          referrerPolicy:
            typeof p.referrerPolicy == "string" ? p.referrerPolicy : void 0,
          imageSrcSet:
            typeof p.imageSrcSet == "string" ? p.imageSrcSet : void 0,
          imageSizes: typeof p.imageSizes == "string" ? p.imageSizes : void 0,
          media: typeof p.media == "string" ? p.media : void 0,
        });
      }
    }),
    (Kt.preloadModule = function (w, p) {
      if (typeof w == "string")
        if (p) {
          var j = q(p.as, p.crossOrigin);
          f.d.m(w, {
            as: typeof p.as == "string" && p.as !== "script" ? p.as : void 0,
            crossOrigin: j,
            integrity: typeof p.integrity == "string" ? p.integrity : void 0,
            nonce: typeof p.nonce == "string" ? p.nonce : void 0,
            fetchPriority:
              typeof p.fetchPriority == "string" ? p.fetchPriority : void 0,
          });
        } else f.d.m(w);
    }),
    (Kt.requestFormReset = function (w) {
      f.d.r(w);
    }),
    (Kt.unstable_batchedUpdates = function (w, p) {
      return w(p);
    }),
    (Kt.useFormState = function (w, p, j) {
      return B.H.useFormState(w, p, j);
    }),
    (Kt.useFormStatus = function () {
      return B.H.useHostTransitionStatus();
    }),
    (Kt.version = "19.3.1"),
    Kt
  );
}
var f1;
function cp() {
  if (f1) return nm.exports;
  f1 = 1;
  function o() {
    if (
      !(
        typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" ||
        typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function"
      )
    )
      try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(o);
      } catch (d) {
        console.error(d);
      }
  }
  return (o(), (nm.exports = ip()), nm.exports);
}
/**
 * @license React
 * react-dom-client.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */ var m1;
function rp() {
  if (m1) return Rc;
  m1 = 1;
  var o = up(),
    d = Mm(),
    v = cp();
  function f(e) {
    var t = "https://react.dev/errors/" + e;
    if (1 < arguments.length) {
      t += "?args[]=" + encodeURIComponent(arguments[1]);
      for (var a = 2; a < arguments.length; a++)
        t += "&args[]=" + encodeURIComponent(arguments[a]);
    }
    return (
      "Minified React error #" +
      e +
      "; visit " +
      t +
      " for the full message or use the non-minified dev environment for full errors and additional helpful warnings."
    );
  }
  function g(e) {
    return !(!e || (e.nodeType !== 1 && e.nodeType !== 9 && e.nodeType !== 11));
  }
  function b(e) {
    for (var t = e, a = t; a && !a.alternate; )
      ((t = a), (t.flags & 4098) !== 0 && (e = t.return), (a = t.return));
    for (; t.return; ) t = t.return;
    return t.tag === 3 ? e : null;
  }
  function N(e) {
    if (e.tag === 13) {
      var t = e.memoizedState;
      if (
        (t === null && ((e = e.alternate), e !== null && (t = e.memoizedState)),
        t !== null)
      )
        return t.dehydrated;
    }
    return null;
  }
  function M(e) {
    if (e.tag === 31) {
      var t = e.memoizedState;
      if (
        (t === null && ((e = e.alternate), e !== null && (t = e.memoizedState)),
        t !== null)
      )
        return t.dehydrated;
    }
    return null;
  }
  function B(e) {
    if (b(e) !== e) throw Error(f(188));
  }
  function q(e) {
    var t = e.alternate;
    if (!t) {
      if (((t = b(e)), t === null)) throw Error(f(188));
      return t !== e ? null : e;
    }
    for (var a = e, l = t; ; ) {
      var n = a.return;
      if (n === null) break;
      var u = n.alternate;
      if (u === null) {
        if (((l = n.return), l !== null)) {
          a = l;
          continue;
        }
        break;
      }
      if (n.child === u.child) {
        for (u = n.child; u; ) {
          if (u === a) return (B(n), e);
          if (u === l) return (B(n), t);
          u = u.sibling;
        }
        throw Error(f(188));
      }
      if (a.return !== l.return) ((a = n), (l = u));
      else {
        for (var c = !1, m = n.child; m; ) {
          if (m === a) {
            ((c = !0), (a = n), (l = u));
            break;
          }
          if (m === l) {
            ((c = !0), (l = n), (a = u));
            break;
          }
          m = m.sibling;
        }
        if (!c) {
          for (m = u.child; m; ) {
            if (m === a) {
              ((c = !0), (a = u), (l = n));
              break;
            }
            if (m === l) {
              ((c = !0), (l = u), (a = n));
              break;
            }
            m = m.sibling;
          }
          if (!c) throw Error(f(189));
        }
      }
      if (a.alternate !== l) throw Error(f(190));
    }
    if (a.tag !== 3) throw Error(f(188));
    return a.stateNode.current === a ? e : t;
  }
  function w(e) {
    var t = e.tag;
    if (t === 5 || t === 26 || t === 27 || t === 6) return e;
    for (e = e.child; e !== null; ) {
      if (((t = w(e)), t !== null)) return t;
      e = e.sibling;
    }
    return null;
  }
  function p(e, t, a, l, n, u) {
    for (; e !== null; ) {
      if (
        ((e.tag === 5 || e.tag === 27 || e.tag === 6) && a(e, l, n, u)) ||
        ((e.tag !== 22 || e.memoizedState === null) &&
          (t || (e.tag !== 5 && e.tag !== 27)) &&
          p(e.child, t, a, l, n, u))
      )
        return !0;
      e = e.sibling;
    }
    return !1;
  }
  function j(e) {
    for (e = e.return; e !== null; ) {
      if (e.tag === 3 || e.tag === 5 || e.tag === 27) return e;
      e = e.return;
    }
    return null;
  }
  function Z(e) {
    var t = !1;
    for (
      e = e.return;
      e !== null &&
      (e.tag === 4 && (t = !0), !(e.tag === 3 || e.tag === 5 || e.tag === 27));

    )
      e = e.return;
    return t;
  }
  function k(e) {
    var t = [null, null],
      a = j(e);
    return (a === null || W(t, e, a.child, { foundSelf: !1 }), t);
  }
  function W(e, t, a, l) {
    for (; a !== null; ) {
      if (a === t) l.foundSelf = !0;
      else if (a.tag === 5 || a.tag === 27 || a.tag === 6) {
        if (l.foundSelf) return ((e[1] = a), !0);
        e[0] = a;
      } else if (
        (a.tag !== 22 || a.memoizedState === null) &&
        W(e, t, a.child, l)
      )
        return !0;
      a = a.sibling;
    }
    return !1;
  }
  function V(e) {
    switch (e.tag) {
      case 5:
      case 27:
      case 6:
        return e.stateNode;
      case 3:
        return e.stateNode.containerInfo;
      default:
        throw Error(f(559));
    }
  }
  var oe = null,
    ne = null;
  function z(e, t, a) {
    return e === a ? !0 : e === t ? ((oe = e), !0) : !1;
  }
  function te(e, t, a) {
    return e === a
      ? ((ne = e), !1)
      : e === t
        ? (ne !== null && (oe = e), !0)
        : !1;
  }
  function P(e) {
    if (e === null) return null;
    do e = e === null ? null : e.return;
    while (e && e.tag !== 5 && e.tag !== 27 && e.tag !== 3);
    return e || null;
  }
  function le(e, t, a) {
    for (var l = 0, n = e; n; n = a(n)) l++;
    n = 0;
    for (var u = t; u; u = a(u)) n++;
    for (; 0 < l - n; ) ((e = a(e)), l--);
    for (; 0 < n - l; ) ((t = a(t)), n--);
    for (; l--; ) {
      if (e === t || (t !== null && e === t.alternate)) return e;
      ((e = a(e)), (t = a(t)));
    }
    return null;
  }
  var K = Object.assign,
    F = Symbol.for("react.element"),
    ee = Symbol.for("react.transitional.element"),
    Ee = Symbol.for("react.portal"),
    pe = Symbol.for("react.fragment"),
    he = Symbol.for("react.strict_mode"),
    ct = Symbol.for("react.profiler"),
    Fe = Symbol.for("react.consumer"),
    Ae = Symbol.for("react.context"),
    J = Symbol.for("react.forward_ref"),
    re = Symbol.for("react.suspense"),
    ye = Symbol.for("react.suspense_list"),
    xe = Symbol.for("react.memo"),
    ke = Symbol.for("react.lazy"),
    Yt = Symbol.for("react.activity"),
    ga = Symbol.for("react.legacy_hidden"),
    xa = Symbol.for("react.memo_cache_sentinel"),
    T = Symbol.for("react.view_transition"),
    Q = Symbol.for("react.recoverable"),
    fe = Symbol.iterator;
  function ce(e) {
    return e === null || typeof e != "object"
      ? null
      : ((e = (fe && e[fe]) || e["@@iterator"]),
        typeof e == "function" ? e : null);
  }
  var Ye = Symbol.for("react.client.reference");
  function we(e) {
    if (e == null) return null;
    if (typeof e == "function")
      return e.$$typeof === Ye ? null : e.displayName || e.name || null;
    if (typeof e == "string") return e;
    switch (e) {
      case pe:
        return "Fragment";
      case ct:
        return "Profiler";
      case he:
        return "StrictMode";
      case re:
        return "Suspense";
      case ye:
        return "SuspenseList";
      case Yt:
        return "Activity";
      case T:
        return "ViewTransition";
    }
    if (typeof e == "object")
      switch (e.$$typeof) {
        case Ee:
          return "Portal";
        case Ae:
          return e.displayName || "Context";
        case Fe:
          return (e._context.displayName || "Context") + ".Consumer";
        case J:
          var t = e.render;
          return (
            (e = e.displayName),
            e ||
              ((e = t.displayName || t.name || ""),
              (e = e !== "" ? "ForwardRef(" + e + ")" : "ForwardRef")),
            e
          );
        case xe:
          return (
            (t = e.displayName || null),
            t !== null ? t : we(e.type) || "Memo"
          );
        case ke:
          ((t = e._payload), (e = e._init));
          try {
            return we(e(t));
          } catch {}
      }
    return null;
  }
  var Ge = Array.isArray,
    ie = d.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,
    ve = v.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,
    Oe = { pending: !1, data: null, method: null, action: null },
    Ve = [],
    ka = -1;
  function Ft(e) {
    return { current: e };
  }
  function gt(e) {
    0 > ka || ((e.current = Ve[ka]), (Ve[ka] = null), ka--);
  }
  function Qe(e, t) {
    (ka++, (Ve[ka] = e.current), (e.current = t));
  }
  var $t = Ft(null),
    Aa = Ft(null),
    Va = Ft(null),
    ia = Ft(null);
  function $e(e, t) {
    switch ((Qe(Va, t), Qe(Aa, e), Qe($t, null), t.nodeType)) {
      case 9:
      case 11:
        e = (e = t.documentElement) && (e = e.namespaceURI) ? fh(e) : 0;
        break;
      default:
        if (((e = t.tagName), (t = t.namespaceURI)))
          ((t = fh(t)), (e = mh(t, e)));
        else
          switch (e) {
            case "svg":
              e = 1;
              break;
            case "math":
              e = 2;
              break;
            default:
              e = 0;
          }
    }
    (gt($t), Qe($t, e));
  }
  function rt() {
    (gt($t), gt(Aa), gt(Va));
  }
  function jn(e) {
    var t = e.memoizedState;
    (t !== null && ((bi._currentValue = t.memoizedState), Qe(ia, e)),
      (t = $t.current));
    var a = mh(t, e.type);
    t !== a && (Qe(Aa, e), Qe($t, a));
  }
  function Vl(e) {
    (Aa.current === e && (gt($t), gt(Aa)),
      ia.current === e && (gt(ia), (bi._currentValue = Oe)));
  }
  var Me, Ai;
  function ft(e) {
    if (Me === void 0)
      try {
        throw Error();
      } catch (a) {
        var t = a.stack.trim().match(/\n( *(at )?)/);
        ((Me = (t && t[1]) || ""),
          (Ai =
            -1 <
            a.stack.indexOf(`
    at`)
              ? " (<anonymous>)"
              : -1 < a.stack.indexOf("@")
                ? "@unknown:0:0"
                : ""));
      }
    return (
      `
` +
      Me +
      e +
      Ai
    );
  }
  var Qa = !1;
  function ll(e, t) {
    if (!e || Qa) return "";
    Qa = !0;
    var a = Error.prepareStackTrace;
    Error.prepareStackTrace = void 0;
    try {
      var l = {
        DetermineComponentFrameRoot: function () {
          try {
            if (t) {
              var G = function () {
                throw Error();
              };
              if (
                (Object.defineProperty(G.prototype, "props", {
                  set: function () {
                    throw Error();
                  },
                }),
                typeof Reflect == "object" && Reflect.construct)
              ) {
                try {
                  Reflect.construct(G, []);
                } catch (I) {
                  var C = I;
                }
                Reflect.construct(e, [], G);
              } else {
                try {
                  G.call();
                } catch (I) {
                  C = I;
                }
                G = !1;
                try {
                  var D = Object.getOwnPropertyDescriptor(e.prototype, "props");
                  (Object.defineProperty(e.prototype, "props", {
                    configurable: !0,
                    set: function () {
                      throw Error();
                    },
                  }),
                    (G = !0),
                    new e());
                } finally {
                  G &&
                    (D !== void 0
                      ? Object.defineProperty(e.prototype, "props", D)
                      : delete e.prototype.props);
                }
              }
            } else {
              try {
                throw Error();
              } catch (I) {
                C = I;
              }
              (G = e()) &&
                typeof G.catch == "function" &&
                G.catch(function () {});
            }
          } catch (I) {
            if (I && C && typeof I.stack == "string") return [I.stack, C.stack];
          }
          return [null, null];
        },
      };
      l.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
      var n = Object.getOwnPropertyDescriptor(
        l.DetermineComponentFrameRoot,
        "name",
      );
      n &&
        n.configurable &&
        Object.defineProperty(l.DetermineComponentFrameRoot, "name", {
          value: "DetermineComponentFrameRoot",
        });
      var u = l.DetermineComponentFrameRoot(),
        c = u[0],
        m = u[1];
      if (c && m) {
        var E = c.split(`
`),
          A = m.split(`
`);
        for (
          n = l = 0;
          l < E.length && !E[l].includes("DetermineComponentFrameRoot");

        )
          l++;
        for (; n < A.length && !A[n].includes("DetermineComponentFrameRoot"); )
          n++;
        if (l === E.length || n === A.length)
          for (
            l = E.length - 1, n = A.length - 1;
            1 <= l && 0 <= n && E[l] !== A[n];

          )
            n--;
        for (; 1 <= l && 0 <= n; l--, n--)
          if (E[l] !== A[n]) {
            if (l !== 1 || n !== 1)
              do
                if ((l--, n--, 0 > n || E[l] !== A[n])) {
                  var _ =
                    `
` + E[l].replace(" at new ", " at ");
                  return (
                    e.displayName &&
                      _.includes("<anonymous>") &&
                      (_ = _.replace("<anonymous>", e.displayName)),
                    _
                  );
                }
              while (1 <= l && 0 <= n);
            break;
          }
      }
    } finally {
      ((Qa = !1), (Error.prepareStackTrace = a));
    }
    return (a = e ? e.displayName || e.name : "") ? ft(a) : "";
  }
  function qn(e, t) {
    switch (e.tag) {
      case 26:
      case 27:
      case 5:
        return ft(e.type);
      case 16:
        return ft("Lazy");
      case 13:
        return e.child !== t && t !== null
          ? ft("Suspense Fallback")
          : ft("Suspense");
      case 19:
        return ft("SuspenseList");
      case 0:
      case 15:
        return ll(e.type, !1);
      case 11:
        return ll(e.type.render, !1);
      case 1:
        return ll(e.type, !0);
      case 31:
        return ft("Activity");
      case 30:
        return ft("ViewTransition");
      default:
        return "";
    }
  }
  function lt(e) {
    try {
      var t = "",
        a = null;
      do ((t += qn(e, a)), (a = e), (e = e.return));
      while (e);
      return t;
    } catch (l) {
      return (
        `
Error generating stack: ` +
        l.message +
        `
` +
        l.stack
      );
    }
  }
  var Sl = Object.prototype.hasOwnProperty,
    Yn = o.unstable_scheduleCallback,
    zu = o.unstable_cancelCallback,
    wi = o.unstable_shouldYield,
    Ro = o.unstable_requestPaint,
    ea = o.unstable_now,
    Tu = o.unstable_getCurrentPriorityLevel,
    Nu = o.unstable_ImmediatePriority,
    Mu = o.unstable_UserBlockingPriority,
    Ql = o.unstable_NormalPriority,
    Lc = o.unstable_LowPriority,
    ca = o.unstable_IdlePriority,
    Cu = o.log,
    _o = o.unstable_setDisableYieldValue,
    Za = null,
    Tt = null;
  function ta(e) {
    if (
      (typeof Cu == "function" && _o(e),
      Tt && typeof Tt.setStrictMode == "function")
    )
      try {
        Tt.setStrictMode(Za, e);
      } catch {}
  }
  var It = Math.clz32 ? Math.clz32 : Uo,
    Oi = Math.log,
    Gc = Math.LN2;
  function Uo(e) {
    return ((e >>>= 0), e === 0 ? 32 : (31 - ((Oi(e) / Gc) | 0)) | 0);
  }
  var Zl = 256,
    xu = 262144,
    Kl = 4194304;
  function Ka(e) {
    var t = e & 42;
    if (t !== 0) return t;
    switch (e & -e) {
      case 1:
        return 1;
      case 2:
        return 2;
      case 4:
        return 4;
      case 8:
        return 8;
      case 16:
        return 16;
      case 32:
        return 32;
      case 64:
        return 64;
      case 128:
        return 128;
      case 256:
      case 512:
      case 1024:
      case 2048:
      case 4096:
      case 8192:
      case 16384:
      case 32768:
      case 65536:
      case 131072:
        return e & -e;
      case 262144:
      case 524288:
      case 1048576:
      case 2097152:
        return e & 3932160;
      case 4194304:
      case 8388608:
      case 16777216:
      case 33554432:
        return e & 62914560;
      case 67108864:
        return 67108864;
      case 134217728:
        return 134217728;
      case 268435456:
        return 268435456;
      case 536870912:
        return 536870912;
      case 1073741824:
        return 0;
      default:
        return e;
    }
  }
  function Nt(e, t, a) {
    var l = e.pendingLanes;
    if (l === 0) return 0;
    var n = 0,
      u = e.suspendedLanes,
      c = e.pingedLanes;
    e = e.warmLanes;
    var m = l & 134217727;
    return (
      m !== 0
        ? ((l = m & ~u),
          l !== 0
            ? (n = Ka(l))
            : ((c &= m),
              c !== 0
                ? (n = Ka(c))
                : a || ((a = m & ~e), a !== 0 && (n = Ka(a)))))
        : ((m = l & ~u),
          m !== 0
            ? (n = Ka(m))
            : c !== 0
              ? (n = Ka(c))
              : a || ((a = l & ~e), a !== 0 && (n = Ka(a)))),
      n === 0
        ? 0
        : t !== 0 &&
            t !== n &&
            (t & u) === 0 &&
            ((u = n & -n),
            (a = t & -t),
            u >= a || (u === 32 && (a & 4194048) !== 0))
          ? t
          : n
    );
  }
  function Lt(e, t) {
    return (e.pendingLanes & ~(e.suspendedLanes & ~e.pingedLanes) & t) === 0;
  }
  function Di(e, t) {
    (t & 8) !== 0 && (t |= t & 32);
    var a = e.entangledLanes;
    if (a !== 0)
      for (e = e.entanglements, a &= t; 0 < a; ) {
        var l = 31 - It(a),
          n = 1 << l;
        ((t |= e[l]), (a &= ~n));
      }
    return t;
  }
  function Xc(e, t) {
    switch (e) {
      case 1:
      case 2:
      case 4:
      case 8:
      case 64:
        return t + 250;
      case 16:
      case 32:
      case 128:
      case 256:
      case 512:
      case 1024:
      case 2048:
      case 4096:
      case 8192:
      case 16384:
      case 32768:
      case 65536:
      case 131072:
      case 262144:
      case 524288:
      case 1048576:
      case 2097152:
        return t + 5e3;
      case 4194304:
      case 8388608:
      case 16777216:
      case 33554432:
        return -1;
      case 67108864:
      case 134217728:
      case 268435456:
      case 536870912:
      case 1073741824:
        return -1;
      default:
        return -1;
    }
  }
  function zl() {
    var e = Kl;
    return ((Kl <<= 1), (Kl & 62914560) === 0 && (Kl = 4194304), e);
  }
  function Ln(e) {
    for (var t = [], a = 0; 31 > a; a++) t.push(e);
    return t;
  }
  function nl(e, t) {
    ((e.pendingLanes |= t),
      t !== 268435456 &&
        ((e.suspendedLanes = 0), (e.pingedLanes = 0), (e.warmLanes = 0)));
  }
  function kc(e, t, a, l, n, u) {
    var c = e.pendingLanes;
    ((e.pendingLanes = a),
      (e.suspendedLanes = 0),
      (e.pingedLanes = 0),
      (e.warmLanes = 0),
      (e.expiredLanes &= a),
      (e.entangledLanes &= a),
      (e.errorRecoveryDisabledLanes &= a),
      (e.shellSuspendCounter = 0));
    var m = e.entanglements,
      E = e.expirationTimes,
      A = e.hiddenUpdates;
    for (a = c & ~a; 0 < a; ) {
      var _ = 31 - It(a),
        G = 1 << _;
      ((m[_] = 0), (E[_] = -1));
      var C = A[_];
      if (C !== null)
        for (A[_] = null, _ = 0; _ < C.length; _++) {
          var D = C[_];
          D !== null && (D.lane &= -536870913);
        }
      a &= ~G;
    }
    (l !== 0 && Ri(e, l, 0),
      u !== 0 && n === 0 && e.tag !== 0 && (e.suspendedLanes |= u & ~(c & ~t)));
  }
  function Ri(e, t, a) {
    ((e.pendingLanes |= t), (e.suspendedLanes &= ~t));
    var l = 31 - It(t);
    ((e.entangledLanes |= t),
      (e.entanglements[l] = e.entanglements[l] | 1073741824 | (a & 261930)));
  }
  function _i(e, t) {
    var a = (e.entangledLanes |= t);
    for (e = e.entanglements; a; ) {
      var l = 31 - It(a),
        n = 1 << l;
      ((n & t) | (e[l] & t) && (e[l] |= t), (a &= ~n));
    }
  }
  function Mt(e, t) {
    var a = t & -t;
    return (
      (a = (a & 42) !== 0 ? 1 : Ui(a)),
      (a & (e.suspendedLanes | t)) !== 0 ? 0 : a
    );
  }
  function Ui(e) {
    switch (e) {
      case 2:
        e = 1;
        break;
      case 8:
        e = 4;
        break;
      case 32:
        e = 16;
        break;
      case 256:
      case 512:
      case 1024:
      case 2048:
      case 4096:
      case 8192:
      case 16384:
      case 32768:
      case 65536:
      case 131072:
      case 262144:
      case 524288:
      case 1048576:
      case 2097152:
      case 4194304:
      case 8388608:
      case 16777216:
      case 33554432:
        e = 128;
        break;
      case 268435456:
        e = 134217728;
        break;
      default:
        e = 0;
    }
    return e;
  }
  function Au(e) {
    return (
      (e &= -e),
      2 < e ? (8 < e ? ((e & 134217727) !== 0 ? 32 : 268435456) : 8) : 2
    );
  }
  function Hi() {
    var e = ve.p;
    return e !== 0 ? e : ((e = window.event), e === void 0 ? 32 : Fh(e.type));
  }
  function Vc(e, t) {
    var a = ve.p;
    try {
      return ((ve.p = e), t());
    } finally {
      ve.p = a;
    }
  }
  var wa = Math.random().toString(36).slice(2),
    Et = "__reactFiber$" + wa,
    Ut = "__reactProps$" + wa,
    Tl = "__reactContainer$" + wa,
    wu = "__reactEvents$" + wa,
    Bi = "__reactListeners$" + wa,
    Ho = "__reactHandles$" + wa,
    Oa = "__reactResources$" + wa,
    ul = "__reactMarker$" + wa,
    Jl = "__reactLoad$" + wa;
  function Nl(e) {
    (delete e[Et], delete e[Ut], delete e[Bi], delete e[Ho]);
  }
  function ra(e) {
    var t;
    if ((t = e[Et])) return t;
    for (var a = e.parentNode; a; ) {
      if ((t = a[Tl] || a[Et])) {
        if (
          ((a = t.alternate),
          t.child !== null || (a !== null && a.child !== null))
        )
          for (e = wh(e); e !== null; ) {
            if ((a = e[Et])) return a;
            e = wh(e);
          }
        return t;
      }
      ((e = a), (a = e.parentNode));
    }
    return null;
  }
  function il(e) {
    if ((e = e[Et] || e[Tl])) {
      var t = e.tag;
      if (
        t === 5 ||
        t === 6 ||
        t === 13 ||
        t === 31 ||
        t === 26 ||
        t === 27 ||
        t === 3
      )
        return e;
    }
    return null;
  }
  function Fl(e) {
    var t = e.tag;
    if (t === 5 || t === 26 || t === 27 || t === 6) return e.stateNode;
    throw Error(f(33));
  }
  function $l(e) {
    var t = e[Oa];
    return (
      t ||
        (t = e[Oa] =
          { hoistableStyles: new Map(), hoistableScripts: new Map() }),
      t
    );
  }
  function yt(e) {
    e[ul] = !0;
  }
  function Ou(e) {
    e[Jl] = void 0;
  }
  var Ct = new Set(),
    Du = {};
  function cl(e, t) {
    (bt(e, t), bt(e + "Capture", t));
  }
  function bt(e, t) {
    for (Du[e] = t, e = 0; e < t.length; e++) Ct.add(t[e]);
  }
  var Gn = RegExp(
      "^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$",
    ),
    Ml = {},
    Xn = {};
  function ji(e) {
    return Sl.call(Xn, e)
      ? !0
      : Sl.call(Ml, e)
        ? !1
        : Gn.test(e)
          ? (Xn[e] = !0)
          : ((Ml[e] = !0), !1);
  }
  var Le = !1;
  function Qc() {
    var e = Le;
    return ((Le = !1), e);
  }
  function kn(e, t, a) {
    if (ji(t))
      if (a === null) e.removeAttribute(t);
      else {
        switch (typeof a) {
          case "undefined":
          case "function":
          case "symbol":
            e.removeAttribute(t);
            return;
          case "boolean":
            var l = t.toLowerCase().slice(0, 5);
            if (l !== "data-" && l !== "aria-") {
              e.removeAttribute(t);
              return;
            }
        }
        e.setAttribute(t, a);
      }
  }
  function Ja(e, t, a) {
    if (a === null) e.removeAttribute(t);
    else {
      switch (typeof a) {
        case "undefined":
        case "function":
        case "symbol":
        case "boolean":
          e.removeAttribute(t);
          return;
      }
      e.setAttribute(t, a);
    }
  }
  function oa(e, t, a, l) {
    if (l === null) e.removeAttribute(a);
    else {
      switch (typeof l) {
        case "undefined":
        case "function":
        case "symbol":
        case "boolean":
          e.removeAttribute(a);
          return;
      }
      e.setAttributeNS(t, a, l);
    }
  }
  function H(e) {
    switch (typeof e) {
      case "bigint":
      case "boolean":
      case "number":
      case "string":
      case "undefined":
        return e;
      case "object":
        return e;
      default:
        return "";
    }
  }
  function xt(e) {
    var t = e.type;
    return (
      (e = e.nodeName) &&
      e.toLowerCase() === "input" &&
      (t === "checkbox" || t === "radio")
    );
  }
  function Cl(e, t, a) {
    var l = Object.getOwnPropertyDescriptor(e.constructor.prototype, t);
    if (
      !e.hasOwnProperty(t) &&
      typeof l < "u" &&
      typeof l.get == "function" &&
      typeof l.set == "function"
    ) {
      var n = l.get,
        u = l.set;
      return (
        Object.defineProperty(e, t, {
          configurable: !0,
          get: function () {
            return n.call(this);
          },
          set: function (c) {
            ((a = "" + c), u.call(this, c));
          },
        }),
        Object.defineProperty(e, t, { enumerable: l.enumerable }),
        {
          getValue: function () {
            return a;
          },
          setValue: function (c) {
            a = "" + c;
          },
          stopTracking: function () {
            ((e._valueTracker = null), delete e[t]);
          },
        }
      );
    }
  }
  function sa(e) {
    if (!e._valueTracker) {
      var t = xt(e) ? "checked" : "value";
      e._valueTracker = Cl(e, t, "" + e[t]);
    }
  }
  function Wt(e) {
    if (!e) return !1;
    var t = e._valueTracker;
    if (!t) return !0;
    var a = t.getValue(),
      l = "";
    return (
      e && (l = xt(e) ? (e.checked ? "true" : "false") : e.value),
      (e = l),
      e !== a ? (t.setValue(e), !0) : !1
    );
  }
  var fa = /[\n"\\]/g;
  function Ht(e) {
    return e.replace(fa, function (t) {
      return "\\" + t.charCodeAt(0).toString(16) + " ";
    });
  }
  function Il(e, t, a, l, n, u, c, m) {
    ((e.name = ""),
      c != null &&
      typeof c != "function" &&
      typeof c != "symbol" &&
      typeof c != "boolean"
        ? (e.type = c)
        : e.removeAttribute("type"),
      t != null
        ? c === "number"
          ? ((t === 0 && e.value === "") || e.value != t) &&
            (e.value = "" + H(t))
          : e.value !== "" + H(t) && (e.value = "" + H(t))
        : (c !== "submit" && c !== "reset") || e.removeAttribute("value"),
      t != null
        ? c === "number" && e.value == t
          ? xl(e, H(e.value))
          : xl(e, H(t))
        : a != null
          ? xl(e, H(a))
          : l != null && e.removeAttribute("value"),
      n == null && u != null && (e.defaultChecked = !!u),
      n != null &&
        (e.checked = n && typeof n != "function" && typeof n != "symbol"),
      m != null &&
      typeof m != "function" &&
      typeof m != "symbol" &&
      typeof m != "boolean"
        ? (e.name = "" + H(m))
        : e.removeAttribute("name"));
  }
  function Vn(e, t, a, l, n, u, c, m) {
    if (
      (u != null &&
        typeof u != "function" &&
        typeof u != "symbol" &&
        typeof u != "boolean" &&
        (e.type = u),
      t != null || a != null)
    ) {
      if (!((u !== "submit" && u !== "reset") || t != null)) {
        sa(e);
        return;
      }
      ((a = a != null ? "" + H(a) : ""),
        (t = t != null ? "" + H(t) : a),
        m || t === e.value || (e.value = t),
        (e.defaultValue = t));
    }
    ((l = l ?? n),
      (l = typeof l != "function" && typeof l != "symbol" && !!l),
      (e.checked = m ? e.checked : !!l),
      (e.defaultChecked = !!l),
      c != null &&
        typeof c != "function" &&
        typeof c != "symbol" &&
        typeof c != "boolean" &&
        (e.name = c),
      sa(e));
  }
  function xl(e, t) {
    e.defaultValue !== "" + t && (e.defaultValue = "" + t);
  }
  function Fa(e, t, a, l) {
    if (((e = e.options), t)) {
      t = {};
      for (var n = 0; n < a.length; n++) t["$" + a[n]] = !0;
      for (a = 0; a < e.length; a++)
        ((n = t.hasOwnProperty("$" + e[a].value)),
          e[a].selected !== n && (e[a].selected = n),
          n && l && (e[a].defaultSelected = !0));
    } else {
      for (a = "" + H(a), t = null, n = 0; n < e.length; n++) {
        if (e[n].value === a) {
          ((e[n].selected = !0), l && (e[n].defaultSelected = !0));
          return;
        }
        t !== null || e[n].disabled || (t = e[n]);
      }
      t !== null && (t.selected = !0);
    }
  }
  function qi(e, t, a) {
    if (
      t != null &&
      ((t = "" + H(t)), t !== e.value && (e.value = t), a == null)
    ) {
      e.defaultValue !== t && (e.defaultValue = t);
      return;
    }
    e.defaultValue = a != null ? "" + H(a) : "";
  }
  function Yi(e, t, a, l) {
    if (t == null) {
      if (l != null) {
        if (a != null) throw Error(f(92));
        if (Ge(l)) {
          if (1 < l.length) throw Error(f(93));
          l = l[0];
        }
        a = l;
      }
      (a == null && (a = ""), (t = a));
    }
    ((a = H(t)),
      (e.defaultValue = a),
      (l = e.textContent),
      l === a && l !== "" && l !== null && (e.value = l),
      sa(e));
  }
  function Al(e, t) {
    if (t) {
      var a = e.firstChild;
      if (a && a === e.lastChild && a.nodeType === 3) {
        a.nodeValue = t;
        return;
      }
    }
    e.textContent = t;
  }
  var Zc = new Set(
    "animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(
      " ",
    ),
  );
  function Wl(e, t, a) {
    var l = t.indexOf("--") === 0;
    a == null || typeof a == "boolean" || a === ""
      ? l
        ? e.setProperty(t, "")
        : t === "float"
          ? (e.cssFloat = "")
          : (e[t] = "")
      : l
        ? e.setProperty(t, a)
        : typeof a != "number" || a === 0 || Zc.has(t)
          ? t === "float"
            ? (e.cssFloat = a)
            : (e[t] = ("" + a).trim())
          : (e[t] = a + "px");
  }
  function Ru(e, t, a) {
    if (t != null && typeof t != "object") throw Error(f(62));
    if (((e = e.style), a != null)) {
      for (var l in a)
        !a.hasOwnProperty(l) ||
          (t != null && t.hasOwnProperty(l)) ||
          (l.indexOf("--") === 0
            ? e.setProperty(l, "")
            : l === "float"
              ? (e.cssFloat = "")
              : (e[l] = ""),
          (Le = !0));
      for (var n in t)
        ((l = t[n]),
          t.hasOwnProperty(n) && a[n] !== l && (Wl(e, n, l), (Le = !0)));
    } else for (var u in t) t.hasOwnProperty(u) && Wl(e, u, t[u]);
  }
  function Ea(e) {
    if (e.indexOf("-") === -1) return !1;
    switch (e) {
      case "annotation-xml":
      case "color-profile":
      case "font-face":
      case "font-face-src":
      case "font-face-uri":
      case "font-face-format":
      case "font-face-name":
      case "missing-glyph":
        return !1;
      default:
        return !0;
    }
  }
  var Bo = new Map([
      ["acceptCharset", "accept-charset"],
      ["htmlFor", "for"],
      ["httpEquiv", "http-equiv"],
      ["crossOrigin", "crossorigin"],
      ["accentHeight", "accent-height"],
      ["alignmentBaseline", "alignment-baseline"],
      ["arabicForm", "arabic-form"],
      ["baselineShift", "baseline-shift"],
      ["capHeight", "cap-height"],
      ["clipPath", "clip-path"],
      ["clipRule", "clip-rule"],
      ["colorInterpolation", "color-interpolation"],
      ["colorInterpolationFilters", "color-interpolation-filters"],
      ["colorProfile", "color-profile"],
      ["colorRendering", "color-rendering"],
      ["dominantBaseline", "dominant-baseline"],
      ["enableBackground", "enable-background"],
      ["fillOpacity", "fill-opacity"],
      ["fillRule", "fill-rule"],
      ["floodColor", "flood-color"],
      ["floodOpacity", "flood-opacity"],
      ["fontFamily", "font-family"],
      ["fontSize", "font-size"],
      ["fontSizeAdjust", "font-size-adjust"],
      ["fontStretch", "font-stretch"],
      ["fontStyle", "font-style"],
      ["fontVariant", "font-variant"],
      ["fontWeight", "font-weight"],
      ["glyphName", "glyph-name"],
      ["glyphOrientationHorizontal", "glyph-orientation-horizontal"],
      ["glyphOrientationVertical", "glyph-orientation-vertical"],
      ["horizAdvX", "horiz-adv-x"],
      ["horizOriginX", "horiz-origin-x"],
      ["imageRendering", "image-rendering"],
      ["letterSpacing", "letter-spacing"],
      ["lightingColor", "lighting-color"],
      ["markerEnd", "marker-end"],
      ["markerMid", "marker-mid"],
      ["markerStart", "marker-start"],
      ["maskType", "mask-type"],
      ["overlinePosition", "overline-position"],
      ["overlineThickness", "overline-thickness"],
      ["paintOrder", "paint-order"],
      ["panose-1", "panose-1"],
      ["pointerEvents", "pointer-events"],
      ["renderingIntent", "rendering-intent"],
      ["shapeRendering", "shape-rendering"],
      ["stopColor", "stop-color"],
      ["stopOpacity", "stop-opacity"],
      ["strikethroughPosition", "strikethrough-position"],
      ["strikethroughThickness", "strikethrough-thickness"],
      ["strokeDasharray", "stroke-dasharray"],
      ["strokeDashoffset", "stroke-dashoffset"],
      ["strokeLinecap", "stroke-linecap"],
      ["strokeLinejoin", "stroke-linejoin"],
      ["strokeMiterlimit", "stroke-miterlimit"],
      ["strokeOpacity", "stroke-opacity"],
      ["strokeWidth", "stroke-width"],
      ["textAnchor", "text-anchor"],
      ["textDecoration", "text-decoration"],
      ["textRendering", "text-rendering"],
      ["transformOrigin", "transform-origin"],
      ["underlinePosition", "underline-position"],
      ["underlineThickness", "underline-thickness"],
      ["unicodeBidi", "unicode-bidi"],
      ["unicodeRange", "unicode-range"],
      ["unitsPerEm", "units-per-em"],
      ["vAlphabetic", "v-alphabetic"],
      ["vHanging", "v-hanging"],
      ["vIdeographic", "v-ideographic"],
      ["vMathematical", "v-mathematical"],
      ["vectorEffect", "vector-effect"],
      ["vertAdvY", "vert-adv-y"],
      ["vertOriginX", "vert-origin-x"],
      ["vertOriginY", "vert-origin-y"],
      ["wordSpacing", "word-spacing"],
      ["writingMode", "writing-mode"],
      ["xmlnsXlink", "xmlns:xlink"],
      ["xHeight", "x-height"],
    ]),
    ze =
      /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
  function Ue(e) {
    return ze.test("" + e)
      ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')"
      : e;
  }
  function mt() {}
  var He = null;
  function Pl(e) {
    return (
      (e = e.target || e.srcElement || window),
      e.correspondingUseElement && (e = e.correspondingUseElement),
      e.nodeType === 3 ? e.parentNode : e
    );
  }
  var De = null,
    rl = null;
  function Li(e) {
    var t = il(e);
    if (t && (e = t.stateNode)) {
      var a = e[Ut] || null;
      e: switch (((e = t.stateNode), t.type)) {
        case "input":
          if (
            (Il(
              e,
              a.value,
              a.defaultValue,
              a.defaultValue,
              a.checked,
              a.defaultChecked,
              a.type,
              a.name,
            ),
            (t = a.name),
            a.type === "radio" && t != null)
          ) {
            for (a = e; a.parentNode; ) a = a.parentNode;
            for (
              a = a.querySelectorAll(
                'input[name="' + Ht("" + t) + '"][type="radio"]',
              ),
                t = 0;
              t < a.length;
              t++
            ) {
              var l = a[t];
              if (l !== e && l.form === e.form) {
                var n = l[Ut] || null;
                if (!n) throw Error(f(90));
                Il(
                  l,
                  n.value,
                  n.defaultValue,
                  n.defaultValue,
                  n.checked,
                  n.defaultChecked,
                  n.type,
                  n.name,
                );
              }
            }
            for (t = 0; t < a.length; t++)
              ((l = a[t]), l.form === e.form && Wt(l));
          }
          break e;
        case "textarea":
          qi(e, a.value, a.defaultValue);
          break e;
        case "select":
          ((t = a.value), t != null && Fa(e, !!a.multiple, t, !1));
      }
    }
  }
  var _u = !1;
  function Uu(e, t, a) {
    if (_u) return e(t, a);
    _u = !0;
    try {
      var l = e(t);
      return l;
    } finally {
      if (
        ((_u = !1),
        (De !== null || rl !== null) &&
          (ao(), De && ((t = De), (e = rl), (rl = De = null), Li(t), e)))
      )
        for (t = 0; t < e.length; t++) Li(e[t]);
    }
  }
  function ol(e, t) {
    var a = e.stateNode;
    if (a === null) return null;
    var l = a[Ut] || null;
    if (l === null) return null;
    a = l[t];
    e: switch (t) {
      case "onClick":
      case "onClickCapture":
      case "onDoubleClick":
      case "onDoubleClickCapture":
      case "onMouseDown":
      case "onMouseDownCapture":
      case "onMouseMove":
      case "onMouseMoveCapture":
      case "onMouseUp":
      case "onMouseUpCapture":
      case "onMouseEnter":
        ((l = !l.disabled) ||
          ((e = e.type),
          (l = !(
            e === "button" ||
            e === "input" ||
            e === "select" ||
            e === "textarea"
          ))),
          (e = !l));
        break e;
      default:
        e = !1;
    }
    if (e) return null;
    if (a && typeof a != "function") throw Error(f(231, t, typeof a));
    return a;
  }
  var ba = !(
      typeof window > "u" ||
      typeof window.document > "u" ||
      typeof window.document.createElement > "u"
    ),
    Qn = !1;
  if (ba)
    try {
      var wl = {};
      (Object.defineProperty(wl, "passive", {
        get: function () {
          Qn = !0;
        },
      }),
        window.addEventListener("test", wl, wl),
        window.removeEventListener("test", wl, wl));
    } catch {
      Qn = !1;
    }
  var Da = null,
    Ol = null,
    en = null;
  function tn() {
    if (en) return en;
    var e,
      t = Ol,
      a = t.length,
      l,
      n = "value" in Da ? Da.value : Da.textContent,
      u = n.length;
    for (e = 0; e < a && t[e] === n[e]; e++);
    var c = a - e;
    for (l = 1; l <= c && t[a - l] === n[u - l]; l++);
    return (en = n.slice(e, 1 < l ? 1 - l : void 0));
  }
  function Zn(e) {
    var t = e.keyCode;
    return (
      "charCode" in e
        ? ((e = e.charCode), e === 0 && t === 13 && (e = 13))
        : (e = t),
      e === 10 && (e = 13),
      32 <= e || e === 13 ? e : 0
    );
  }
  function Hu() {
    return !0;
  }
  function Bu() {
    return !1;
  }
  function Gt(e) {
    function t(a, l, n, u, c) {
      ((this._reactName = a),
        (this._targetInst = n),
        (this.type = l),
        (this.nativeEvent = u),
        (this.target = c),
        (this.currentTarget = null));
      for (var m in e)
        e.hasOwnProperty(m) && ((a = e[m]), (this[m] = a ? a(u) : u[m]));
      return (
        (this.isDefaultPrevented = (
          u.defaultPrevented != null ? u.defaultPrevented : u.returnValue === !1
        )
          ? Hu
          : Bu),
        (this.isPropagationStopped = Bu),
        this
      );
    }
    return (
      K(t.prototype, {
        preventDefault: function () {
          this.defaultPrevented = !0;
          var a = this.nativeEvent;
          a &&
            (a.preventDefault
              ? a.preventDefault()
              : typeof a.returnValue != "unknown" && (a.returnValue = !1),
            (this.isDefaultPrevented = Hu));
        },
        stopPropagation: function () {
          var a = this.nativeEvent;
          a &&
            (a.stopPropagation
              ? a.stopPropagation()
              : typeof a.cancelBubble != "unknown" && (a.cancelBubble = !0),
            (this.isPropagationStopped = Hu));
        },
        persist: function () {},
        isPersistent: Hu,
      }),
      t
    );
  }
  var $a = {
      eventPhase: 0,
      bubbles: 0,
      cancelable: 0,
      timeStamp: function (e) {
        return e.timeStamp || Date.now();
      },
      defaultPrevented: 0,
      isTrusted: 0,
    },
    an = Gt($a),
    Ra = K({}, $a, { view: 0, detail: 0 }),
    Gi = Gt(Ra),
    Kn,
    Jn,
    ln,
    ju = K({}, Ra, {
      screenX: 0,
      screenY: 0,
      clientX: 0,
      clientY: 0,
      pageX: 0,
      pageY: 0,
      ctrlKey: 0,
      shiftKey: 0,
      altKey: 0,
      metaKey: 0,
      getModifierState: Vi,
      button: 0,
      buttons: 0,
      relatedTarget: function (e) {
        return e.relatedTarget === void 0
          ? e.fromElement === e.srcElement
            ? e.toElement
            : e.fromElement
          : e.relatedTarget;
      },
      movementX: function (e) {
        return "movementX" in e
          ? e.movementX
          : (e !== ln &&
              (ln && e.type === "mousemove"
                ? ((Kn = e.screenX - ln.screenX), (Jn = e.screenY - ln.screenY))
                : (Jn = Kn = 0),
              (ln = e)),
            Kn);
      },
      movementY: function (e) {
        return "movementY" in e ? e.movementY : Jn;
      },
    }),
    Kc = Gt(ju),
    Jc = K({}, ju, { dataTransfer: 0 }),
    Fc = Gt(Jc),
    $c = K({}, Ra, { relatedTarget: 0 }),
    qu = Gt($c),
    jo = K({}, $a, { animationName: 0, elapsedTime: 0, pseudoElement: 0 }),
    qo = Gt(jo),
    Yo = K({}, $a, {
      clipboardData: function (e) {
        return "clipboardData" in e ? e.clipboardData : window.clipboardData;
      },
    }),
    Ic = Gt(Yo),
    Wc = K({}, $a, { data: 0 }),
    Fn = Gt(Wc),
    Xi = {
      Esc: "Escape",
      Spacebar: " ",
      Left: "ArrowLeft",
      Up: "ArrowUp",
      Right: "ArrowRight",
      Down: "ArrowDown",
      Del: "Delete",
      Win: "OS",
      Menu: "ContextMenu",
      Apps: "ContextMenu",
      Scroll: "ScrollLock",
      MozPrintableKey: "Unidentified",
    },
    Pc = {
      8: "Backspace",
      9: "Tab",
      12: "Clear",
      13: "Enter",
      16: "Shift",
      17: "Control",
      18: "Alt",
      19: "Pause",
      20: "CapsLock",
      27: "Escape",
      32: " ",
      33: "PageUp",
      34: "PageDown",
      35: "End",
      36: "Home",
      37: "ArrowLeft",
      38: "ArrowUp",
      39: "ArrowRight",
      40: "ArrowDown",
      45: "Insert",
      46: "Delete",
      112: "F1",
      113: "F2",
      114: "F3",
      115: "F4",
      116: "F5",
      117: "F6",
      118: "F7",
      119: "F8",
      120: "F9",
      121: "F10",
      122: "F11",
      123: "F12",
      144: "NumLock",
      145: "ScrollLock",
      224: "Meta",
    },
    Lo = {
      Alt: "altKey",
      Control: "ctrlKey",
      Meta: "metaKey",
      Shift: "shiftKey",
    };
  function ki(e) {
    var t = this.nativeEvent;
    return t.getModifierState
      ? t.getModifierState(e)
      : (e = Lo[e])
        ? !!t[e]
        : !1;
  }
  function Vi() {
    return ki;
  }
  var Go = K({}, Ra, {
      key: function (e) {
        if (e.key) {
          var t = Xi[e.key] || e.key;
          if (t !== "Unidentified") return t;
        }
        return e.type === "keypress"
          ? ((e = Zn(e)), e === 13 ? "Enter" : String.fromCharCode(e))
          : e.type === "keydown" || e.type === "keyup"
            ? Pc[e.keyCode] || "Unidentified"
            : "";
      },
      code: 0,
      location: 0,
      ctrlKey: 0,
      shiftKey: 0,
      altKey: 0,
      metaKey: 0,
      repeat: 0,
      locale: 0,
      getModifierState: Vi,
      charCode: function (e) {
        return e.type === "keypress" ? Zn(e) : 0;
      },
      keyCode: function (e) {
        return e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
      },
      which: function (e) {
        return e.type === "keypress"
          ? Zn(e)
          : e.type === "keydown" || e.type === "keyup"
            ? e.keyCode
            : 0;
      },
    }),
    Xo = Gt(Go),
    er = K({}, ju, {
      pointerId: 0,
      width: 0,
      height: 0,
      pressure: 0,
      tangentialPressure: 0,
      tiltX: 0,
      tiltY: 0,
      twist: 0,
      pointerType: 0,
      isPrimary: 0,
    }),
    Yu = Gt(er),
    ko = K({}, $a, { submitter: 0 }),
    tr = Gt(ko),
    Vo = K({}, Ra, {
      touches: 0,
      targetTouches: 0,
      changedTouches: 0,
      altKey: 0,
      metaKey: 0,
      ctrlKey: 0,
      shiftKey: 0,
      getModifierState: Vi,
    }),
    ar = Gt(Vo),
    Qo = K({}, $a, { propertyName: 0, elapsedTime: 0, pseudoElement: 0 }),
    lr = Gt(Qo),
    Qi = K({}, ju, {
      deltaX: function (e) {
        return "deltaX" in e
          ? e.deltaX
          : "wheelDeltaX" in e
            ? -e.wheelDeltaX
            : 0;
      },
      deltaY: function (e) {
        return "deltaY" in e
          ? e.deltaY
          : "wheelDeltaY" in e
            ? -e.wheelDeltaY
            : "wheelDelta" in e
              ? -e.wheelDelta
              : 0;
      },
      deltaZ: 0,
      deltaMode: 0,
    }),
    Zo = Gt(Qi),
    Lu = K({}, $a, { newState: 0, oldState: 0, source: 0 }),
    ma = Gt(Lu),
    _a = [9, 13, 27, 32],
    nn = ba && "CompositionEvent" in window,
    $n = null;
  ba && "documentMode" in document && ($n = document.documentMode);
  var Zi = ba && "TextEvent" in window && !$n,
    nr = ba && (!nn || ($n && 8 < $n && 11 >= $n)),
    Ki = " ",
    Ji = !1;
  function Gu(e, t) {
    switch (e) {
      case "keyup":
        return _a.indexOf(t.keyCode) !== -1;
      case "keydown":
        return t.keyCode !== 229;
      case "keypress":
      case "mousedown":
      case "focusout":
        return !0;
      default:
        return !1;
    }
  }
  function Fi(e) {
    return (
      (e = e.detail),
      typeof e == "object" && "data" in e ? e.data : null
    );
  }
  var Dl = !1;
  function ur(e, t) {
    switch (e) {
      case "compositionend":
        return Fi(t);
      case "keypress":
        return t.which !== 32 ? null : ((Ji = !0), Ki);
      case "textInput":
        return ((e = t.data), e === Ki && Ji ? null : e);
      default:
        return null;
    }
  }
  function ir(e, t) {
    if (Dl)
      return e === "compositionend" || (!nn && Gu(e, t))
        ? ((e = tn()), (en = Ol = Da = null), (Dl = !1), e)
        : null;
    switch (e) {
      case "paste":
        return null;
      case "keypress":
        if (!(t.ctrlKey || t.altKey || t.metaKey) || (t.ctrlKey && t.altKey)) {
          if (t.char && 1 < t.char.length) return t.char;
          if (t.which) return String.fromCharCode(t.which);
        }
        return null;
      case "compositionend":
        return nr && t.locale !== "ko" ? null : t.data;
      default:
        return null;
    }
  }
  var cr = {
    color: !0,
    date: !0,
    datetime: !0,
    "datetime-local": !0,
    email: !0,
    month: !0,
    number: !0,
    password: !0,
    range: !0,
    search: !0,
    tel: !0,
    text: !0,
    time: !0,
    url: !0,
    week: !0,
  };
  function $i(e) {
    var t = e && e.nodeName && e.nodeName.toLowerCase();
    return t === "input" ? !!cr[e.type] : t === "textarea";
  }
  function Ii(e, t, a, l) {
    (De ? (rl ? rl.push(l) : (rl = [l])) : (De = l),
      (t = ro(t, "onChange")),
      0 < t.length &&
        ((a = new an("onChange", "change", null, a, l)),
        e.push({ event: a, listeners: t })));
  }
  var un = null,
    cn = null;
  function i(e) {
    uh(e, 0);
  }
  function s(e) {
    var t = Fl(e);
    if (Wt(t)) return e;
  }
  function h(e, t) {
    if (e === "change") return t;
  }
  var y = !1;
  if (ba) {
    var R;
    if (ba) {
      var U = "oninput" in document;
      if (!U) {
        var X = document.createElement("div");
        (X.setAttribute("oninput", "return;"),
          (U = typeof X.oninput == "function"));
      }
      R = U;
    } else R = !1;
    y = R && (!document.documentMode || 9 < document.documentMode);
  }
  function $() {
    un && (un.detachEvent("onpropertychange", se), (cn = un = null));
  }
  function se(e) {
    if (e.propertyName === "value" && s(cn)) {
      var t = [];
      (Ii(t, cn, e, Pl(e)), Uu(i, t));
    }
  }
  function be(e, t, a) {
    e === "focusin"
      ? ($(), (un = t), (cn = a), un.attachEvent("onpropertychange", se))
      : e === "focusout" && $();
  }
  function et(e) {
    if (e === "selectionchange" || e === "keyup" || e === "keydown")
      return s(cn);
  }
  function dt(e, t) {
    if (e === "click") return s(t);
  }
  function nt(e, t) {
    if (e === "input" || e === "change") return s(t);
  }
  function Be(e, t) {
    return (e === t && (e !== 0 || 1 / e === 1 / t)) || (e !== e && t !== t);
  }
  var ot = typeof Object.is == "function" ? Object.is : Be;
  function Ua(e, t) {
    if (ot(e, t)) return !0;
    if (
      typeof e != "object" ||
      e === null ||
      typeof t != "object" ||
      t === null
    )
      return !1;
    var a = Object.keys(e),
      l = Object.keys(t);
    if (a.length !== l.length) return !1;
    for (l = 0; l < a.length; l++) {
      var n = a[l];
      if (!Sl.call(t, n) || !ot(e[n], t[n])) return !1;
    }
    return !0;
  }
  function Xu(e) {
    if (
      ((e = e || (typeof document < "u" ? document : void 0)), typeof e > "u")
    )
      return null;
    try {
      return e.activeElement || e.body;
    } catch {
      return e.body;
    }
  }
  function aa(e) {
    for (; e && e.firstChild; ) e = e.firstChild;
    return e;
  }
  function ku(e, t) {
    var a = aa(e);
    e = 0;
    for (var l; a; ) {
      if (a.nodeType === 3) {
        if (((l = e + a.textContent.length), e <= t && l >= t))
          return { node: a, offset: t - e };
        e = l;
      }
      e: {
        for (; a; ) {
          if (a.nextSibling) {
            a = a.nextSibling;
            break e;
          }
          a = a.parentNode;
        }
        a = void 0;
      }
      a = aa(a);
    }
  }
  function Wi(e, t) {
    return e && t
      ? e === t
        ? !0
        : e && e.nodeType === 3
          ? !1
          : t && t.nodeType === 3
            ? Wi(e, t.parentNode)
            : "contains" in e
              ? e.contains(t)
              : e.compareDocumentPosition
                ? !!(e.compareDocumentPosition(t) & 16)
                : !1
      : !1;
  }
  function sl(e) {
    e =
      e != null &&
      e.ownerDocument != null &&
      e.ownerDocument.defaultView != null
        ? e.ownerDocument.defaultView
        : window;
    for (var t = Xu(e.document); t instanceof e.HTMLIFrameElement; ) {
      try {
        var a = typeof t.contentWindow.location.href == "string";
      } catch {
        a = !1;
      }
      if (a) e = t.contentWindow;
      else break;
      t = Xu(e.document);
    }
    return t;
  }
  function In(e) {
    var t = e && e.nodeName && e.nodeName.toLowerCase();
    return (
      t &&
      ((t === "input" &&
        (e.type === "text" ||
          e.type === "search" ||
          e.type === "tel" ||
          e.type === "url" ||
          e.type === "password")) ||
        t === "textarea" ||
        e.contentEditable === "true")
    );
  }
  var rr = ba && "documentMode" in document && 11 >= document.documentMode,
    St = null,
    rn = null,
    on = null,
    sn = !1;
  function Am(e, t, a) {
    var l =
      a.window === a ? a.document : a.nodeType === 9 ? a : a.ownerDocument;
    sn ||
      St == null ||
      St !== Xu(l) ||
      ((l = St),
      "selectionStart" in l && In(l)
        ? (l = { start: l.selectionStart, end: l.selectionEnd })
        : ((l = (
            (l.ownerDocument && l.ownerDocument.defaultView) ||
            window
          ).getSelection()),
          (l = {
            anchorNode: l.anchorNode,
            anchorOffset: l.anchorOffset,
            focusNode: l.focusNode,
            focusOffset: l.focusOffset,
          })),
      (on && Ua(on, l)) ||
        ((on = l),
        (l = ro(rn, "onSelect")),
        0 < l.length &&
          ((t = new an("onSelect", "select", null, t, a)),
          e.push({ event: t, listeners: l }),
          (t.target = St))));
  }
  function Wn(e, t) {
    var a = {};
    return (
      (a[e.toLowerCase()] = t.toLowerCase()),
      (a["Webkit" + e] = "webkit" + t),
      (a["Moz" + e] = "moz" + t),
      a
    );
  }
  var Vu = {
      animationend: Wn("Animation", "AnimationEnd"),
      animationiteration: Wn("Animation", "AnimationIteration"),
      animationstart: Wn("Animation", "AnimationStart"),
      transitionrun: Wn("Transition", "TransitionRun"),
      transitionstart: Wn("Transition", "TransitionStart"),
      transitioncancel: Wn("Transition", "TransitionCancel"),
      transitionend: Wn("Transition", "TransitionEnd"),
    },
    Ko = {},
    wm = {};
  ba &&
    ((wm = document.createElement("div").style),
    "AnimationEvent" in window ||
      (delete Vu.animationend.animation,
      delete Vu.animationiteration.animation,
      delete Vu.animationstart.animation),
    "TransitionEvent" in window || delete Vu.transitionend.transition);
  function Pn(e) {
    if (Ko[e]) return Ko[e];
    if (!Vu[e]) return e;
    var t = Vu[e],
      a;
    for (a in t) if (t.hasOwnProperty(a) && a in wm) return (Ko[e] = t[a]);
    return e;
  }
  var Om = Pn("animationend"),
    Dm = Pn("animationiteration"),
    Rm = Pn("animationstart"),
    k1 = Pn("transitionrun"),
    V1 = Pn("transitionstart"),
    Q1 = Pn("transitioncancel"),
    _m = Pn("transitionend"),
    Um = new Map(),
    Jo =
      "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error fullscreenChange fullscreenError gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(
        " ",
      );
  Jo.push("scrollEnd");
  function Ia(e, t) {
    (Um.set(e, t), cl(t, [e]));
  }
  var Z1 = 0;
  function Rl(e, t) {
    if (e.name != null && e.name !== "auto") return e.name;
    if (t.autoName !== null) return t.autoName;
    e = tl.identifierPrefix;
    var a = Z1++;
    return ((e = "_" + e + "t_" + a.toString(32) + "_"), (t.autoName = e));
  }
  function Hm(e) {
    if (e == null || typeof e == "string") return e;
    var t = null,
      a = si;
    if (a !== null)
      for (var l = 0; l < a.length; l++) {
        var n = e[a[l]];
        if (n != null) {
          if (n === "none") return "none";
          t = t == null ? n : t + (" " + n);
        }
      }
    return t ?? e.default;
  }
  function _l(e, t) {
    return (
      (e = Hm(e)),
      (t = Hm(t)),
      t == null ? (e === "auto" ? null : e) : t === "auto" ? null : t
    );
  }
  var or =
      typeof reportError == "function"
        ? reportError
        : function (e) {
            if (
              typeof window == "object" &&
              typeof window.ErrorEvent == "function"
            ) {
              var t = new window.ErrorEvent("error", {
                bubbles: !0,
                cancelable: !0,
                message:
                  typeof e == "object" &&
                  e !== null &&
                  typeof e.message == "string"
                    ? String(e.message)
                    : String(e),
                error: e,
              });
              if (!window.dispatchEvent(t)) return;
            } else if (
              typeof process == "object" &&
              typeof process.emit == "function"
            ) {
              process.emit("uncaughtException", e);
              return;
            }
            console.error(e);
          },
    Ha = [],
    Qu = 0,
    Fo = 0;
  function sr() {
    for (var e = Qu, t = (Fo = Qu = 0); t < e; ) {
      var a = Ha[t];
      Ha[t++] = null;
      var l = Ha[t];
      Ha[t++] = null;
      var n = Ha[t];
      Ha[t++] = null;
      var u = Ha[t];
      if (((Ha[t++] = null), l !== null && n !== null)) {
        var c = l.pending;
        (c === null ? (n.next = n) : ((n.next = c.next), (c.next = n)),
          (l.pending = n));
      }
      u !== 0 && Bm(a, n, u);
    }
  }
  function fr(e, t, a, l) {
    ((Ha[Qu++] = e),
      (Ha[Qu++] = t),
      (Ha[Qu++] = a),
      (Ha[Qu++] = l),
      (Fo |= l),
      (e.lanes |= l),
      (e = e.alternate),
      e !== null && (e.lanes |= l));
  }
  function $o(e, t, a, l) {
    return (fr(e, t, a, l), mr(e));
  }
  function eu(e, t) {
    return (fr(e, null, null, t), mr(e));
  }
  function Bm(e, t, a) {
    e.lanes |= a;
    var l = e.alternate;
    l !== null && (l.lanes |= a);
    for (var n = !1, u = e.return; u !== null; )
      ((u.childLanes |= a),
        (l = u.alternate),
        l !== null && (l.childLanes |= a),
        u.tag === 22 &&
          ((e = u.stateNode), e === null || e._visibility & 1 || (n = !0)),
        (e = u),
        (u = u.return));
    return e.tag === 3
      ? ((u = e.stateNode),
        n &&
          t !== null &&
          ((n = 31 - It(a)),
          (e = u.hiddenUpdates),
          (l = e[n]),
          l === null ? (e[n] = [t]) : l.push(t),
          (t.lane = a | 536870912)),
        u)
      : null;
  }
  function mr(e) {
    if (50 < bc) throw ((bc = 0), (to = null), Error(f(185)));
    for (var t = e.return; t !== null; ) ((e = t), (t = e.return));
    return e.tag === 3 ? e.stateNode : null;
  }
  var Zu = {};
  function K1(e, t, a, l) {
    ((this.tag = e),
      (this.key = a),
      (this.sibling =
        this.child =
        this.return =
        this.stateNode =
        this.type =
        this.elementType =
          null),
      (this.index = 0),
      (this.refCleanup = this.ref = null),
      (this.pendingProps = t),
      (this.dependencies =
        this.memoizedState =
        this.updateQueue =
        this.memoizedProps =
          null),
      (this.mode = l),
      (this.subtreeFlags = this.flags = 0),
      (this.deletions = null),
      (this.childLanes = this.lanes = 0),
      (this.alternate = null));
  }
  function da(e, t, a, l) {
    return new K1(e, t, a, l);
  }
  function Io(e) {
    return ((e = e.prototype), !(!e || !e.isReactComponent));
  }
  function Ul(e, t) {
    var a = e.alternate;
    return (
      a === null
        ? ((a = da(e.tag, t, e.key, e.mode)),
          (a.elementType = e.elementType),
          (a.type = e.type),
          (a.stateNode = e.stateNode),
          (a.alternate = e),
          (e.alternate = a))
        : ((a.pendingProps = t),
          (a.type = e.type),
          (a.flags = 0),
          (a.subtreeFlags = 0),
          (a.deletions = null)),
      (a.flags = e.flags & 1206910976),
      (a.childLanes = e.childLanes),
      (a.lanes = e.lanes),
      (a.child = e.child),
      (a.memoizedProps = e.memoizedProps),
      (a.memoizedState = e.memoizedState),
      (a.updateQueue = e.updateQueue),
      (t = e.dependencies),
      (a.dependencies =
        t === null ? null : { lanes: t.lanes, firstContext: t.firstContext }),
      (a.sibling = e.sibling),
      (a.index = e.index),
      (a.ref = e.ref),
      (a.refCleanup = e.refCleanup),
      a
    );
  }
  function jm(e, t) {
    e.flags &= 1206910978;
    var a = e.alternate;
    return (
      a === null
        ? ((e.childLanes = 0),
          (e.lanes = t),
          (e.child = null),
          (e.subtreeFlags = 0),
          (e.memoizedProps = null),
          (e.memoizedState = null),
          (e.updateQueue = null),
          (e.dependencies = null),
          (e.stateNode = null))
        : ((e.childLanes = a.childLanes),
          (e.lanes = a.lanes),
          (e.child = a.child),
          (e.subtreeFlags = 0),
          (e.deletions = null),
          (e.memoizedProps = a.memoizedProps),
          (e.memoizedState = a.memoizedState),
          (e.updateQueue = a.updateQueue),
          (e.type = a.type),
          (t = a.dependencies),
          (e.dependencies =
            t === null
              ? null
              : { lanes: t.lanes, firstContext: t.firstContext })),
      e
    );
  }
  function dr(e, t, a, l, n, u) {
    var c = 0;
    if (((l = e), typeof l == "function")) Io(l) && (c = 1);
    else if (typeof l == "string")
      c = Sv(e, a, $t.current)
        ? 26
        : e === "html" || e === "head" || e === "body"
          ? 27
          : 5;
    else
      e: switch (l) {
        case Yt:
          return (
            (e = da(31, a, t, n)),
            (e.elementType = Yt),
            (e.lanes = u),
            e
          );
        case pe:
          return tu(a.children, n, u, t);
        case he:
          ((c = 8), (n |= 24));
          break;
        case ct:
          return (
            (e = da(12, a, t, n | 2)),
            (e.elementType = ct),
            (e.lanes = u),
            e
          );
        case re:
          return (
            (e = da(13, a, t, n)),
            (e.elementType = re),
            (e.lanes = u),
            e
          );
        case ye:
          return (
            (e = da(19, a, t, n)),
            (e.elementType = ye),
            (e.lanes = u),
            e
          );
        case ga:
        case T:
          return (
            (e = n | 32),
            (e = da(30, a, t, e)),
            (e.elementType = T),
            (e.lanes = u),
            (e.stateNode = {
              autoName: null,
              paired: null,
              clones: null,
              ref: null,
            }),
            e
          );
        default:
          if (typeof l == "object" && l !== null)
            switch (l.$$typeof) {
              case Ae:
                c = 10;
                break e;
              case Fe:
                c = 9;
                break e;
              case J:
                c = 11;
                break e;
              case xe:
                c = 14;
                break e;
              case ke:
                ((c = 16), (l = null));
                break e;
            }
          ((c = 29),
            (a = Error(f(130, e === null ? "null" : typeof e, ""))),
            (l = null));
      }
    return (
      (t = da(c, a, t, n)),
      (t.elementType = e),
      (t.type = l),
      (t.lanes = u),
      t
    );
  }
  function tu(e, t, a, l) {
    return ((e = da(7, e, l, t)), (e.lanes = a), e);
  }
  function Wo(e, t, a) {
    return ((e = da(6, e, null, t)), (e.lanes = a), e);
  }
  function qm(e) {
    var t = da(18, null, null, 0);
    return ((t.stateNode = e), t);
  }
  function Po(e, t, a) {
    return (
      (t = da(4, e.children !== null ? e.children : [], e.key, t)),
      (t.lanes = a),
      (t.stateNode = {
        containerInfo: e.containerInfo,
        pendingChildren: null,
        implementation: e.implementation,
      }),
      t
    );
  }
  var Ym = new WeakMap();
  function Ba(e, t) {
    if (typeof e == "object" && e !== null) {
      var a = Ym.get(e);
      return a !== void 0
        ? a
        : ((t = { value: e, source: t, stack: lt(t) }), Ym.set(e, t), t);
    }
    return { value: e, source: t, stack: lt(t) };
  }
  var Ku = [],
    Ju = 0,
    hr = null,
    Pi = 0,
    ja = [],
    qa = 0,
    fn = null,
    fl = 1,
    ml = "";
  function Hl(e, t) {
    ((Ku[Ju++] = Pi), (Ku[Ju++] = hr), (hr = e), (Pi = t));
  }
  function Lm(e, t, a) {
    ((ja[qa++] = fl), (ja[qa++] = ml), (ja[qa++] = fn), (fn = e));
    var l = fl;
    e = ml;
    var n = 32 - It(l) - 1;
    ((l &= ~(1 << n)), (a += 1));
    var u = 32 - It(t) + n;
    if (30 < u) {
      var c = n - (n % 5);
      ((u = (l & ((1 << c) - 1)).toString(32)),
        (l >>= c),
        (n -= c),
        (fl = (1 << (32 - It(t) + n)) | (a << n) | l),
        (ml = u + e));
    } else ((fl = (1 << u) | (a << n) | l), (ml = e));
  }
  function yr(e) {
    e.return !== null && (Hl(e, 1), Lm(e, 1, 0));
  }
  function es(e) {
    for (; e === hr; )
      ((hr = Ku[--Ju]), (Ku[Ju] = null), (Pi = Ku[--Ju]), (Ku[Ju] = null));
    for (; e === fn; )
      ((fn = ja[--qa]),
        (ja[qa] = null),
        (ml = ja[--qa]),
        (ja[qa] = null),
        (fl = ja[--qa]),
        (ja[qa] = null));
  }
  function Gm(e, t) {
    ((ja[qa++] = fl),
      (ja[qa++] = ml),
      (ja[qa++] = fn),
      (fl = t.id),
      (ml = t.overflow),
      (fn = e));
  }
  var Bt = null,
    ut = null,
    Ce = !1,
    mn = null,
    Ya = !1,
    ts = Error(f(519));
  function dn(e) {
    var t = Error(
      f(
        418,
        1 < arguments.length && arguments[1] !== void 0 && arguments[1]
          ? "text"
          : "HTML",
        "",
      ),
    );
    throw (ec(Ba(t, e)), ts);
  }
  function Xm(e) {
    var t = e.stateNode,
      a = e.type,
      l = e.memoizedProps;
    switch (((t[Et] = e), (t[Ut] = l), a)) {
      case "dialog":
        (_e("cancel", t), _e("close", t));
        break;
      case "iframe":
      case "object":
      case "embed":
        _e("load", t);
        break;
      case "video":
      case "audio":
        for (a = 0; a < zc.length; a++) _e(zc[a], t);
        break;
      case "source":
        _e("error", t);
        break;
      case "img":
      case "image":
      case "link":
        (_e("error", t), _e("load", t));
        break;
      case "details":
        _e("toggle", t);
        break;
      case "input":
        (_e("invalid", t),
          Vn(
            t,
            l.value,
            l.defaultValue,
            l.checked,
            l.defaultChecked,
            l.type,
            l.name,
            !0,
          ));
        break;
      case "select":
        _e("invalid", t);
        break;
      case "textarea":
        (_e("invalid", t), Yi(t, l.value, l.defaultValue, l.children));
    }
    ((a = l.children),
      (typeof a != "string" && typeof a != "number" && typeof a != "bigint") ||
      t.textContent === "" + a ||
      l.suppressHydrationWarning === !0 ||
      oh(t.textContent, a)
        ? (l.popover != null && (_e("beforetoggle", t), _e("toggle", t)),
          l.onScroll != null && _e("scroll", t),
          l.onScrollEnd != null && _e("scrollend", t),
          l.onClick != null && (t.onclick = mt),
          (t = !0))
        : (t = !1),
      t || dn(e, !0));
  }
  function vr(e) {
    for (Bt = e.return; Bt; )
      switch (Bt.tag) {
        case 5:
        case 31:
        case 13:
          Ya = !1;
          return;
        case 27:
        case 3:
          Ya = !0;
          return;
        default:
          Bt = Bt.return;
      }
  }
  function Fu(e) {
    if (e !== Bt) return !1;
    if (!Ce) return (vr(e), (Ce = !0), !1);
    var t = e.tag,
      a;
    if (
      ((a = t !== 3 && t !== 27) &&
        ((a = t === 5) &&
          ((a = e.type),
          (a =
            !(a !== "form" && a !== "button") || Rf(e.type, e.memoizedProps))),
        (a = !a)),
      a && ut && dn(e),
      vr(e),
      t === 13)
    ) {
      if (((e = e.memoizedState), (e = e !== null ? e.dehydrated : null), !e))
        throw Error(f(317));
      ut = Ah(e);
    } else if (t === 31) {
      if (((e = e.memoizedState), (e = e !== null ? e.dehydrated : null), !e))
        throw Error(f(317));
      ut = Ah(e);
    } else
      t === 27
        ? ((t = ut), wn(e.type) ? ((e = Gf), (Gf = null), (ut = e)) : (ut = t))
        : (ut = Bt ? Ga(e.stateNode.nextSibling) : null);
    return !0;
  }
  function au() {
    ((ut = Bt = null), (Ce = !1));
  }
  function as() {
    var e = mn;
    return (
      e !== null &&
        (va === null ? (va = e) : va.push.apply(va, e), (mn = null)),
      e
    );
  }
  function ec(e) {
    mn === null ? (mn = [e]) : mn.push(e);
  }
  var ls = Ft(null),
    lu = null,
    Bl = null;
  function hn(e, t, a) {
    (Qe(ls, t._currentValue), (t._currentValue = a));
  }
  function jl(e) {
    ((e._currentValue = ls.current), gt(ls));
  }
  function pr(e, t, a) {
    for (; e !== null; ) {
      var l = e.alternate;
      if (
        ((e.childLanes & t) !== t
          ? ((e.childLanes |= t), l !== null && (l.childLanes |= t))
          : l !== null && (l.childLanes & t) !== t && (l.childLanes |= t),
        e === a)
      )
        break;
      e = e.return;
    }
  }
  function ns(e, t, a, l) {
    var n = e.child;
    for (n !== null && (n.return = e); n !== null; ) {
      var u = n.dependencies;
      if (u !== null) {
        var c = n.child;
        u = u.firstContext;
        e: for (; u !== null; ) {
          var m = u;
          u = n;
          for (var E = 0; E < t.length; E++)
            if (m.context === t[E]) {
              ((u.lanes |= a),
                (m = u.alternate),
                m !== null && (m.lanes |= a),
                pr(u.return, a, e),
                l || (c = null));
              break e;
            }
          u = m.next;
        }
      } else if (n.tag === 18) {
        if (((c = n.return), c === null)) throw Error(f(341));
        ((c.lanes |= a),
          (u = c.alternate),
          u !== null && (u.lanes |= a),
          pr(c, a, e),
          (c = null));
      } else
        n.tag === 13 &&
        n.memoizedState !== null &&
        n.memoizedState.dehydrated === null
          ? ((n.lanes |= a),
            (c = n.alternate),
            c !== null && (c.lanes |= a),
            pr(n.return, a, e),
            (c = n.child),
            (c = c !== null ? c.sibling : null))
          : (c = n.child);
      if (c !== null) c.return = n;
      else
        for (c = n; c !== null; ) {
          if (c === e) {
            c = null;
            break;
          }
          if (((n = c.sibling), n !== null)) {
            ((n.return = c.return), (c = n));
            break;
          }
          c = c.return;
        }
      n = c;
    }
  }
  function nu(e, t, a, l) {
    e = null;
    for (var n = t, u = !1; n !== null; ) {
      if (!u) {
        if ((n.flags & 524288) !== 0) u = !0;
        else if ((n.flags & 262144) !== 0) break;
      }
      if (n.tag === 10) {
        var c = n.alternate;
        if (c === null) throw Error(f(387));
        if (((c = c.memoizedProps), c !== null)) {
          var m = n.type;
          ot(n.pendingProps.value, c.value) ||
            (e !== null ? e.push(m) : (e = [m]));
        }
      } else if (n === ia.current) {
        if (((c = n.alternate), c === null)) throw Error(f(387));
        c.memoizedState.memoizedState !== n.memoizedState.memoizedState &&
          (e !== null ? e.push(bi) : (e = [bi]));
      }
      n = n.return;
    }
    return (e !== null && ns(t, e, a, l), (t.flags |= 262144), e !== null);
  }
  function gr(e) {
    for (e = e.firstContext; e !== null; ) {
      if (!ot(e.context._currentValue, e.memoizedValue)) return !0;
      e = e.next;
    }
    return !1;
  }
  function uu(e) {
    ((lu = e),
      (Bl = null),
      (e = e.dependencies),
      e !== null && (e.firstContext = null));
  }
  function Xt(e) {
    return km(lu, e);
  }
  function Er(e, t) {
    return (lu === null && uu(e), km(e, t));
  }
  function km(e, t) {
    var a = t._currentValue;
    if (((t = { context: t, memoizedValue: a, next: null }), Bl === null)) {
      if (e === null) throw Error(f(308));
      ((Bl = t),
        (e.dependencies = { lanes: 0, firstContext: t }),
        (e.flags |= 524288));
    } else Bl = Bl.next = t;
    return a;
  }
  var J1 =
      typeof AbortController < "u"
        ? AbortController
        : function () {
            var e = [],
              t = (this.signal = {
                aborted: !1,
                addEventListener: function (a, l) {
                  e.push(l);
                },
              });
            this.abort = function () {
              ((t.aborted = !0),
                e.forEach(function (a) {
                  return a();
                }));
            };
          },
    F1 = o.unstable_scheduleCallback,
    $1 = o.unstable_NormalPriority,
    At = {
      $$typeof: Ae,
      Consumer: null,
      Provider: null,
      _currentValue: null,
      _currentValue2: null,
      _threadCount: 0,
    };
  function us() {
    return { controller: new J1(), data: new Map(), refCount: 0 };
  }
  function tc(e) {
    (e.refCount--,
      e.refCount === 0 &&
        F1($1, function () {
          e.controller.abort();
        }));
  }
  function Vm(e, t) {
    if ((e.pendingLanes & 4194048) !== 0) {
      var a = e.transitionTypes;
      for (
        a === null && (a = e.transitionTypes = []), e = 0;
        e < t.length;
        e++
      ) {
        var l = t[e];
        a.indexOf(l) === -1 && a.push(l);
      }
    }
  }
  var ac = null;
  function I1(e) {
    var t = e.transitionTypes;
    return ((e.transitionTypes = null), t);
  }
  var lc = null,
    is = 0,
    iu = 0,
    $u = null;
  function W1(e, t) {
    if (lc === null) {
      var a = (lc = []);
      ((is = 0),
        (iu = Tf()),
        ($u = {
          status: "pending",
          value: void 0,
          then: function (l) {
            a.push(l);
          },
        }));
    }
    return (is++, t.then(Qm, Qm), t);
  }
  function Qm() {
    if (--is === 0 && ((ac = null), lc !== null)) {
      $u !== null && ($u.status = "fulfilled");
      var e = lc;
      ((lc = null), (iu = 0), ($u = null));
      for (var t = 0; t < e.length; t++) (0, e[t])();
    }
  }
  function P1(e, t) {
    var a = [],
      l = {
        status: "pending",
        value: null,
        reason: null,
        then: function (n) {
          a.push(n);
        },
      };
    return (
      e.then(
        function () {
          ((l.status = "fulfilled"), (l.value = t));
          for (var n = 0; n < a.length; n++) (0, a[n])(t);
        },
        function (n) {
          for (l.status = "rejected", l.reason = n, n = 0; n < a.length; n++)
            (0, a[n])(void 0);
        },
      ),
      l
    );
  }
  var Zm = ie.S;
  ie.S = function (e, t) {
    if (
      ((q0 = ea()),
      typeof t == "object" &&
        t !== null &&
        typeof t.then == "function" &&
        W1(e, t),
      ac !== null)
    )
      for (var a = hi; a !== null; ) (Vm(a, ac), (a = a.next));
    if (((a = e.types), a !== null)) {
      for (var l = hi; l !== null; ) (Vm(l, a), (l = l.next));
      if (iu !== 0) {
        ((l = ac), l === null && (l = ac = []));
        for (var n = 0; n < a.length; n++) {
          var u = a[n];
          l.indexOf(u) === -1 && l.push(u);
        }
      }
    }
    Zm !== null && Zm(e, t);
  };
  var cu = Ft(null);
  function cs() {
    var e = cu.current;
    return e !== null ? e : at.pooledCache;
  }
  function br(e, t) {
    t === null ? Qe(cu, cu.current) : Qe(cu, t.pool);
  }
  function Km() {
    var e = cs();
    return e === null ? null : { parent: At._currentValue, pool: e };
  }
  var Iu = Error(f(460)),
    rs = Error(f(474)),
    Sr = Error(f(542)),
    zr = { then: function () {} };
  function Jm(e) {
    return ((e = e.status), e === "fulfilled" || e === "rejected");
  }
  function Fm(e, t, a) {
    switch (
      ((a = e[a]),
      a === void 0 ? e.push(t) : a !== t && (t.then(mt, mt), (t = a)),
      t.status)
    ) {
      case "fulfilled":
        return t.value;
      case "rejected":
        throw (
          (e = t.reason),
          Im(e),
          e === void 0 && !("reason" in t) ? Error(f(600)) : e
        );
      default:
        if (typeof t.status == "string") t.then(mt, mt);
        else {
          if (((e = at), e !== null && 100 < e.shellSuspendCounter))
            throw Error(f(482));
          ((e = t),
            (e.status = "pending"),
            e.then(
              function (l) {
                if (t.status === "pending") {
                  var n = t;
                  ((n.status = "fulfilled"), (n.value = l));
                }
              },
              function (l) {
                if (t.status === "pending") {
                  var n = t;
                  ((n.status = "rejected"), (n.reason = l));
                }
              },
            ));
        }
        switch (t.status) {
          case "fulfilled":
            return t.value;
          case "rejected":
            throw ((e = t.reason), Im(e), e);
        }
        throw ((ou = t), Iu);
    }
  }
  function ru(e) {
    try {
      var t = e._init;
      return t(e._payload);
    } catch (a) {
      throw a !== null && typeof a == "object" && typeof a.then == "function"
        ? ((ou = a), Iu)
        : a;
    }
  }
  var ou = null;
  function $m() {
    if (ou === null) throw Error(f(459));
    var e = ou;
    return ((ou = null), e);
  }
  function Im(e) {
    if (e === Iu || e === Sr) throw Error(f(483));
  }
  var Wu = null,
    nc = 0;
  function Tr(e) {
    var t = nc;
    return ((nc += 1), Wu === null && (Wu = []), Fm(Wu, e, t));
  }
  function yn(e, t) {
    ((t = t.props.ref), (e.ref = t !== void 0 ? t : null));
  }
  function Nr(e, t) {
    throw t.$$typeof === F
      ? Error(f(525))
      : ((e = Object.prototype.toString.call(t)),
        Error(
          f(
            31,
            e === "[object Object]"
              ? "object with keys {" + Object.keys(t).join(", ") + "}"
              : e,
          ),
        ));
  }
  function Wm(e) {
    function t(x, S) {
      if (e) {
        var O = x.deletions;
        O === null ? ((x.deletions = [S]), (x.flags |= 16)) : O.push(S);
      }
    }
    function a(x, S) {
      if (!e) return null;
      for (; S !== null; ) (t(x, S), (S = S.sibling));
      return null;
    }
    function l(x) {
      for (var S = new Map(); x !== null; )
        (x.key === null ? S.set(x.index, x) : S.set(x.key, x), (x = x.sibling));
      return S;
    }
    function n(x, S) {
      return ((x = Ul(x, S)), (x.index = 0), (x.sibling = null), x);
    }
    function u(x, S, O) {
      return (
        (x.index = O),
        e
          ? ((O = x.alternate),
            O !== null
              ? ((O = O.index), O < S ? ((x.flags |= 2), S) : O)
              : ((x.flags |= 134217730), S))
          : ((x.flags |= 1048576), S)
      );
    }
    function c(x) {
      return (e && x.alternate === null && (x.flags |= 134217730), x);
    }
    function m(x, S, O, L) {
      return S === null || S.tag !== 6
        ? ((S = Wo(O, x.mode, L)), (S.return = x), S)
        : ((S = n(S, O)), (S.return = x), S);
    }
    function E(x, S, O, L) {
      var ae = O.type;
      return ae === pe
        ? ((x = _(x, S, O.props.children, L, O.key)), yn(x, O), x)
        : S !== null &&
            (S.elementType === ae ||
              (typeof ae == "object" &&
                ae !== null &&
                ae.$$typeof === ke &&
                ru(ae) === S.type))
          ? ((S = n(S, O.props)), yn(S, O), (S.return = x), S)
          : ((S = dr(O.type, O.key, O.props, null, x.mode, L)),
            yn(S, O),
            (S.return = x),
            S);
    }
    function A(x, S, O, L) {
      return S === null ||
        S.tag !== 4 ||
        S.stateNode.containerInfo !== O.containerInfo ||
        S.stateNode.implementation !== O.implementation
        ? ((S = Po(O, x.mode, L)), (S.return = x), S)
        : ((S = n(S, O.children || [])), (S.return = x), S);
    }
    function _(x, S, O, L, ae) {
      return S === null || S.tag !== 7
        ? ((S = tu(O, x.mode, L, ae)), (S.return = x), S)
        : ((S = n(S, O)), (S.return = x), S);
    }
    function G(x, S, O) {
      if (
        (typeof S == "string" && S !== "") ||
        typeof S == "number" ||
        typeof S == "bigint"
      )
        return ((S = Wo("" + S, x.mode, O)), (S.return = x), S);
      if (typeof S == "object" && S !== null) {
        switch (S.$$typeof) {
          case ee:
            return (
              (O = dr(S.type, S.key, S.props, null, x.mode, O)),
              yn(O, S),
              (O.return = x),
              O
            );
          case Ee:
            return ((S = Po(S, x.mode, O)), (S.return = x), S);
          case ke:
            return ((S = ru(S)), G(x, S, O));
        }
        if (Ge(S) || ce(S))
          return ((S = tu(S, x.mode, O, null)), (S.return = x), S);
        if (typeof S.then == "function") return G(x, Tr(S), O);
        if (S.$$typeof === Ae) return G(x, Er(x, S), O);
        Nr(x, S);
      }
      return null;
    }
    function C(x, S, O, L) {
      var ae = S !== null ? S.key : null;
      if (
        (typeof O == "string" && O !== "") ||
        typeof O == "number" ||
        typeof O == "bigint"
      )
        return ae !== null ? null : m(x, S, "" + O, L);
      if (typeof O == "object" && O !== null) {
        switch (O.$$typeof) {
          case ee:
            return O.key === ae ? E(x, S, O, L) : null;
          case Ee:
            return O.key === ae ? A(x, S, O, L) : null;
          case ke:
            return ((O = ru(O)), C(x, S, O, L));
        }
        if (Ge(O) || ce(O)) return ae !== null ? null : _(x, S, O, L, null);
        if (typeof O.then == "function") return C(x, S, Tr(O), L);
        if (O.$$typeof === Ae) return C(x, S, Er(x, O), L);
        Nr(x, O);
      }
      return null;
    }
    function D(x, S, O, L, ae) {
      if (
        (typeof L == "string" && L !== "") ||
        typeof L == "number" ||
        typeof L == "bigint"
      )
        return ((x = x.get(O) || null), m(S, x, "" + L, ae));
      if (typeof L == "object" && L !== null) {
        switch (L.$$typeof) {
          case ee:
            return (
              (x = x.get(L.key === null ? O : L.key) || null),
              E(S, x, L, ae)
            );
          case Ee:
            return (
              (x = x.get(L.key === null ? O : L.key) || null),
              A(S, x, L, ae)
            );
          case ke:
            return ((L = ru(L)), D(x, S, O, L, ae));
        }
        if (Ge(L) || ce(L))
          return ((x = x.get(O) || null), _(S, x, L, ae, null));
        if (typeof L.then == "function") return D(x, S, O, Tr(L), ae);
        if (L.$$typeof === Ae) return D(x, S, O, Er(S, L), ae);
        Nr(S, L);
      }
      return null;
    }
    function I(x, S, O, L) {
      for (
        var ae = null, qe = null, me = S, ge = (S = 0), Dt = null;
        me !== null && ge < O.length;
        ge++
      ) {
        me.index > ge ? ((Dt = me), (me = null)) : (Dt = me.sibling);
        var Xe = C(x, me, O[ge], L);
        if (Xe === null) {
          me === null && (me = Dt);
          break;
        }
        (e && me && Xe.alternate === null && t(x, me),
          (S = u(Xe, S, ge)),
          qe === null ? (ae = Xe) : (qe.sibling = Xe),
          (qe = Xe),
          (me = Dt));
      }
      if (ge === O.length) return (a(x, me), Ce && Hl(x, ge), ae);
      if (me === null) {
        for (; ge < O.length; ge++)
          ((me = G(x, O[ge], L)),
            me !== null &&
              ((S = u(me, S, ge)),
              qe === null ? (ae = me) : (qe.sibling = me),
              (qe = me)));
        return (Ce && Hl(x, ge), ae);
      }
      for (me = l(me); ge < O.length; ge++)
        ((Dt = D(me, x, ge, O[ge], L)),
          Dt !== null &&
            (e &&
              ((Xe = Dt.alternate),
              Xe !== null && me.delete(Xe.key === null ? ge : Xe.key)),
            (S = u(Dt, S, ge)),
            qe === null ? (ae = Dt) : (qe.sibling = Dt),
            (qe = Dt)));
      return (
        e &&
          me.forEach(function (Un) {
            return t(x, Un);
          }),
        Ce && Hl(x, ge),
        ae
      );
    }
    function ue(x, S, O, L) {
      if (O == null) throw Error(f(151));
      for (
        var ae = null,
          qe = null,
          me = S,
          ge = (S = 0),
          Dt = null,
          Xe = O.next();
        me !== null && !Xe.done;
        ge++, Xe = O.next()
      ) {
        me.index > ge ? ((Dt = me), (me = null)) : (Dt = me.sibling);
        var Un = C(x, me, Xe.value, L);
        if (Un === null) {
          me === null && (me = Dt);
          break;
        }
        (e && me && Un.alternate === null && t(x, me),
          (S = u(Un, S, ge)),
          qe === null ? (ae = Un) : (qe.sibling = Un),
          (qe = Un),
          (me = Dt));
      }
      if (Xe.done) return (a(x, me), Ce && Hl(x, ge), ae);
      if (me === null) {
        for (; !Xe.done; ge++, Xe = O.next())
          ((Xe = G(x, Xe.value, L)),
            Xe !== null &&
              ((S = u(Xe, S, ge)),
              qe === null ? (ae = Xe) : (qe.sibling = Xe),
              (qe = Xe)));
        return (Ce && Hl(x, ge), ae);
      }
      for (me = l(me); !Xe.done; ge++, Xe = O.next())
        ((Xe = D(me, x, ge, Xe.value, L)),
          Xe !== null &&
            (e &&
              ((Dt = Xe.alternate),
              Dt !== null && me.delete(Dt.key === null ? ge : Dt.key)),
            (S = u(Xe, S, ge)),
            qe === null ? (ae = Xe) : (qe.sibling = Xe),
            (qe = Xe)));
      return (
        e &&
          me.forEach(function (_v) {
            return t(x, _v);
          }),
        Ce && Hl(x, ge),
        ae
      );
    }
    function Ne(x, S, O, L) {
      if (
        (typeof O == "object" &&
          O !== null &&
          O.type === pe &&
          O.key === null &&
          O.props.ref === void 0 &&
          (O = O.props.children),
        typeof O == "object" && O !== null)
      ) {
        switch (O.$$typeof) {
          case ee:
            e: {
              for (var ae = O.key; S !== null; ) {
                if (S.key === ae) {
                  if (((ae = O.type), ae === pe)) {
                    if (S.tag === 7) {
                      (a(x, S.sibling),
                        (L = n(S, O.props.children)),
                        yn(L, O),
                        (L.return = x),
                        (x = L));
                      break e;
                    }
                  } else if (
                    S.elementType === ae ||
                    (typeof ae == "object" &&
                      ae !== null &&
                      ae.$$typeof === ke &&
                      ru(ae) === S.type)
                  ) {
                    (a(x, S.sibling),
                      (L = n(S, O.props)),
                      yn(L, O),
                      (L.return = x),
                      (x = L));
                    break e;
                  }
                  a(x, S);
                  break;
                } else t(x, S);
                S = S.sibling;
              }
              O.type === pe
                ? ((L = tu(O.props.children, x.mode, L, O.key)),
                  yn(L, O),
                  (L.return = x),
                  (x = L))
                : ((L = dr(O.type, O.key, O.props, null, x.mode, L)),
                  yn(L, O),
                  (L.return = x),
                  (x = L));
            }
            return c(x);
          case Ee:
            e: {
              for (ae = O.key; S !== null; ) {
                if (S.key === ae)
                  if (
                    S.tag === 4 &&
                    S.stateNode.containerInfo === O.containerInfo &&
                    S.stateNode.implementation === O.implementation
                  ) {
                    (a(x, S.sibling),
                      (L = n(S, O.children || [])),
                      (L.return = x),
                      (x = L));
                    break e;
                  } else {
                    a(x, S);
                    break;
                  }
                else t(x, S);
                S = S.sibling;
              }
              ((L = Po(O, x.mode, L)), (L.return = x), (x = L));
            }
            return c(x);
          case ke:
            return ((O = ru(O)), Ne(x, S, O, L));
        }
        if (Ge(O)) return I(x, S, O, L);
        if (ce(O)) {
          if (((ae = ce(O)), typeof ae != "function")) throw Error(f(150));
          return ((O = ae.call(O)), ue(x, S, O, L));
        }
        if (typeof O.then == "function") return Ne(x, S, Tr(O), L);
        if (O.$$typeof === Ae) return Ne(x, S, Er(x, O), L);
        Nr(x, O);
      }
      return (typeof O == "string" && O !== "") ||
        typeof O == "number" ||
        typeof O == "bigint"
        ? ((O = "" + O),
          S !== null && S.tag === 6
            ? (a(x, S.sibling), (L = n(S, O)), (L.return = x), (x = L))
            : (a(x, S), (L = Wo(O, x.mode, L)), (L.return = x), (x = L)),
          c(x))
        : a(x, S);
    }
    return function (x, S, O, L) {
      try {
        nc = 0;
        var ae = Ne(x, S, O, L);
        return ((Wu = null), ae);
      } catch (me) {
        if (me === Iu || me === Sr) throw me;
        var qe = da(29, me, null, x.mode);
        return ((qe.lanes = L), (qe.return = x), qe);
      } finally {
      }
    };
  }
  var su = Wm(!0),
    Pm = Wm(!1),
    vn = !1;
  function os(e) {
    e.updateQueue = {
      baseState: e.memoizedState,
      firstBaseUpdate: null,
      lastBaseUpdate: null,
      shared: { pending: null, lanes: 0, hiddenCallbacks: null },
      callbacks: null,
    };
  }
  function ss(e, t) {
    ((e = e.updateQueue),
      t.updateQueue === e &&
        (t.updateQueue = {
          baseState: e.baseState,
          firstBaseUpdate: e.firstBaseUpdate,
          lastBaseUpdate: e.lastBaseUpdate,
          shared: e.shared,
          callbacks: null,
        }));
  }
  function pn(e) {
    return { lane: e, tag: 0, payload: null, callback: null, next: null };
  }
  function gn(e, t, a) {
    var l = e.updateQueue;
    if (l === null) return null;
    if (((l = l.shared), (Ze & 2) !== 0)) {
      var n = l.pending;
      return (
        n === null ? (t.next = t) : ((t.next = n.next), (n.next = t)),
        (l.pending = t),
        (t = mr(e)),
        Bm(e, null, a),
        t
      );
    }
    return (fr(e, l, t, a), mr(e));
  }
  function uc(e, t, a) {
    if (
      ((t = t.updateQueue), t !== null && ((t = t.shared), (a & 4194048) !== 0))
    ) {
      var l = t.lanes;
      ((l &= e.pendingLanes), (a |= l), (t.lanes = a), _i(e, a));
    }
  }
  function fs(e, t) {
    var a = e.updateQueue,
      l = e.alternate;
    if (l !== null && ((l = l.updateQueue), a === l)) {
      var n = null,
        u = null;
      if (((a = a.firstBaseUpdate), a !== null)) {
        do {
          var c = {
            lane: a.lane,
            tag: a.tag,
            payload: a.payload,
            callback: null,
            next: null,
          };
          (u === null ? (n = u = c) : (u = u.next = c), (a = a.next));
        } while (a !== null);
        u === null ? (n = u = t) : (u = u.next = t);
      } else n = u = t;
      ((a = {
        baseState: l.baseState,
        firstBaseUpdate: n,
        lastBaseUpdate: u,
        shared: l.shared,
        callbacks: l.callbacks,
      }),
        (e.updateQueue = a));
      return;
    }
    ((e = a.lastBaseUpdate),
      e === null ? (a.firstBaseUpdate = t) : (e.next = t),
      (a.lastBaseUpdate = t));
  }
  var ms = !1;
  function ic() {
    if (ms) {
      var e = $u;
      if (e !== null) throw e;
    }
  }
  function cc(e, t, a, l) {
    ms = !1;
    var n = e.updateQueue;
    vn = !1;
    var u = n.firstBaseUpdate,
      c = n.lastBaseUpdate,
      m = n.shared.pending;
    if (m !== null) {
      n.shared.pending = null;
      var E = m,
        A = E.next;
      ((E.next = null), c === null ? (u = A) : (c.next = A), (c = E));
      var _ = e.alternate;
      _ !== null &&
        ((_ = _.updateQueue),
        (m = _.lastBaseUpdate),
        m !== c &&
          (m === null ? (_.firstBaseUpdate = A) : (m.next = A),
          (_.lastBaseUpdate = E)));
    }
    if (u !== null) {
      var G = n.baseState;
      ((c = 0), (_ = A = E = null), (m = u));
      do {
        var C = m.lane & -536870913,
          D = C !== m.lane;
        if (D ? (je & C) === C : (l & C) === C) {
          (C !== 0 && C === iu && (ms = !0),
            _ !== null &&
              (_ = _.next =
                {
                  lane: 0,
                  tag: m.tag,
                  payload: m.payload,
                  callback: null,
                  next: null,
                }));
          e: {
            var I = e,
              ue = m;
            C = t;
            var Ne = a;
            switch (ue.tag) {
              case 1:
                if (((I = ue.payload), typeof I == "function")) {
                  G = I.call(Ne, G, C);
                  break e;
                }
                G = I;
                break e;
              case 3:
                I.flags = (I.flags & -65537) | 128;
              case 0:
                if (
                  ((I = ue.payload),
                  (C = typeof I == "function" ? I.call(Ne, G, C) : I),
                  C == null)
                )
                  break e;
                G = K({}, G, C);
                break e;
              case 2:
                vn = !0;
            }
          }
          ((C = m.callback),
            C !== null &&
              ((e.flags |= 64),
              D && (e.flags |= 8192),
              (D = n.callbacks),
              D === null ? (n.callbacks = [C]) : D.push(C)));
        } else
          ((D = {
            lane: C,
            tag: m.tag,
            payload: m.payload,
            callback: m.callback,
            next: null,
          }),
            _ === null ? ((A = _ = D), (E = G)) : (_ = _.next = D),
            (c |= C));
        if (((m = m.next), m === null)) {
          if (((m = n.shared.pending), m === null)) break;
          ((D = m),
            (m = D.next),
            (D.next = null),
            (n.lastBaseUpdate = D),
            (n.shared.pending = null));
        }
      } while (!0);
      (_ === null && (E = G),
        (n.baseState = E),
        (n.firstBaseUpdate = A),
        (n.lastBaseUpdate = _),
        u === null && (n.shared.lanes = 0),
        (Mn |= c),
        (e.lanes = c),
        (e.memoizedState = G));
    }
  }
  function ed(e, t) {
    if (typeof e != "function") throw Error(f(191, e));
    e.call(t);
  }
  function td(e, t) {
    var a = e.callbacks;
    if (a !== null)
      for (e.callbacks = null, e = 0; e < a.length; e++) ed(a[e], t);
  }
  var En = Ft(null),
    Mr = Ft(0);
  function ad(e, t) {
    ((e = Xl), Qe(Mr, e), Qe(En, t), (Xl = e | t.baseLanes));
  }
  function ds() {
    (Qe(Mr, Xl), Qe(En, En.current));
  }
  function hs() {
    ((Xl = Mr.current), gt(En), gt(Mr));
  }
  var kt = Ft(null),
    Pt = null;
  function bn(e) {
    var t = e.alternate;
    (Qe(Vt, Vt.current & 1),
      Qe(kt, e),
      Pt === null &&
        (t === null || En.current !== null || t.memoizedState !== null) &&
        (Pt = e));
  }
  function ys(e) {
    (Qe(Vt, Vt.current), Qe(kt, e), Pt === null && (Pt = e));
  }
  function ld(e) {
    e.tag === 22
      ? (Qe(Vt, Vt.current), Qe(kt, e), Pt === null && (Pt = e))
      : Sn();
  }
  function Sn() {
    (Qe(Vt, Vt.current), Qe(kt, kt.current));
  }
  function Sa(e) {
    (gt(kt), Pt === e && (Pt = null), gt(Vt));
  }
  var Vt = Ft(0);
  function rc(e, t) {
    (Qe(kt, kt.current), Qe(Vt, t));
  }
  function vs(e) {
    (gt(Vt), gt(kt), Pt === e && (Pt = null));
  }
  function Cr(e) {
    for (var t = e; t !== null; ) {
      if (t.tag === 13) {
        var a = t.memoizedState;
        if (a !== null && ((a = a.dehydrated), a === null || Yf(a) || Lf(a)))
          return t;
      } else if (
        t.tag === 19 &&
        t.memoizedProps.revealOrder !== "independent"
      ) {
        if ((t.flags & 128) !== 0) return t;
      } else if (t.child !== null) {
        ((t.child.return = t), (t = t.child));
        continue;
      }
      if (t === e) break;
      for (; t.sibling === null; ) {
        if (t.return === null || t.return === e) return null;
        t = t.return;
      }
      ((t.sibling.return = t.return), (t = t.sibling));
    }
    return null;
  }
  var ql = 0,
    Te = null,
    tt = null,
    wt = null,
    xr = !1,
    Pu = !1,
    fu = !1,
    Ar = 0,
    oc = 0,
    ei = null,
    ey = 0;
  function vt() {
    throw Error(f(321));
  }
  function ps(e, t) {
    if (t === null) return !1;
    for (var a = 0; a < t.length && a < e.length; a++)
      if (!ot(e[a], t[a])) return !1;
    return !0;
  }
  function gs(e, t, a, l, n, u) {
    return (
      (ql = u),
      (Te = t),
      (t.memoizedState = null),
      (t.updateQueue = null),
      (t.lanes = 0),
      (ie.H = e === null || e.memoizedState === null ? Ld : Gd),
      (fu = !1),
      (u = a(l, n)),
      (fu = !1),
      Pu && (u = ud(t, a, l, n)),
      nd(e),
      u
    );
  }
  function nd(e) {
    ie.H = Hr;
    var t = tt !== null && tt.next !== null;
    if (((ql = 0), (wt = tt = Te = null), (xr = !1), (oc = 0), (ei = null), t))
      throw Error(f(300));
    e === null ||
      Ot ||
      ((e = e.dependencies), e !== null && gr(e) && (Ot = !0));
  }
  function ud(e, t, a, l) {
    Te = e;
    var n = 0;
    do {
      if ((Pu && (ei = null), (oc = 0), (Pu = !1), 25 <= n))
        throw Error(f(301));
      if (((n += 1), (wt = tt = null), e.updateQueue != null)) {
        var u = e.updateQueue;
        ((u.lastEffect = null),
          (u.events = null),
          (u.stores = null),
          u.memoCache != null && (u.memoCache.index = 0));
      }
      ((ie.H = ry), (u = t(a, l)));
    } while (Pu);
    return u;
  }
  function ty() {
    var e = ie.H,
      t = e.useState()[0];
    return (
      (t = typeof t.then == "function" ? sc(t) : t),
      (e = e.useState()[0]),
      (tt !== null ? tt.memoizedState : null) !== e && (Te.flags |= 1024),
      t
    );
  }
  function Es() {
    var e = Ar !== 0;
    return ((Ar = 0), e);
  }
  function bs(e, t, a) {
    ((t.updateQueue = e.updateQueue), (t.flags &= -2053), (e.lanes &= ~a));
  }
  function Ss(e) {
    if (xr) {
      for (e = e.memoizedState; e !== null; ) {
        var t = e.queue;
        (t !== null && (t.pending = null), (e = e.next));
      }
      xr = !1;
    }
    ((ql = 0), (wt = tt = Te = null), (Pu = !1), (oc = Ar = 0), (ei = null));
  }
  function la() {
    var e = {
      memoizedState: null,
      baseState: null,
      baseQueue: null,
      queue: null,
      next: null,
    };
    return (wt === null ? (Te.memoizedState = wt = e) : (wt = wt.next = e), wt);
  }
  function zt() {
    if (tt === null) {
      var e = Te.alternate;
      e = e !== null ? e.memoizedState : null;
    } else e = tt.next;
    var t = wt === null ? Te.memoizedState : wt.next;
    if (t !== null) ((wt = t), (tt = e));
    else {
      if (e === null)
        throw Te.alternate === null ? Error(f(467)) : Error(f(310));
      ((tt = e),
        (e = {
          memoizedState: tt.memoizedState,
          baseState: tt.baseState,
          baseQueue: tt.baseQueue,
          queue: tt.queue,
          next: null,
        }),
        wt === null ? (Te.memoizedState = wt = e) : (wt = wt.next = e));
    }
    return wt;
  }
  function wr() {
    return { lastEffect: null, events: null, stores: null, memoCache: null };
  }
  function sc(e) {
    var t = oc;
    return (
      (oc += 1),
      ei === null && (ei = []),
      (e = Fm(ei, e, t)),
      (t = Te),
      (wt === null ? t.memoizedState : wt.next) === null &&
        ((t = t.alternate),
        (ie.H = t === null || t.memoizedState === null ? Ld : Gd)),
      e
    );
  }
  function Or(e) {
    if (e !== null && typeof e == "object") {
      if (typeof e.then == "function") return sc(e);
      if (e.$$typeof === Q) return;
      if (e.$$typeof === Ae) return Xt(e);
    }
    throw Error(f(438, String(e)));
  }
  function zs(e) {
    var t = null,
      a = Te.updateQueue;
    if ((a !== null && (t = a.memoCache), t == null)) {
      var l = Te.alternate;
      l !== null &&
        ((l = l.updateQueue),
        l !== null &&
          ((l = l.memoCache),
          l != null &&
            (t = {
              data: l.data.map(function (n) {
                return n.slice();
              }),
              index: 0,
            })));
    }
    if (
      (t == null && (t = { data: [], index: 0 }),
      a === null && ((a = wr()), (Te.updateQueue = a)),
      (a.memoCache = t),
      (a = t.data[t.index]),
      a === void 0)
    )
      for (a = t.data[t.index] = Array(e), l = 0; l < e; l++) a[l] = xa;
    return (t.index++, a);
  }
  function Yl(e, t) {
    return typeof t == "function" ? t(e) : t;
  }
  function Dr(e) {
    var t = zt();
    return Ts(t, tt, e);
  }
  function Ts(e, t, a) {
    var l = e.queue;
    if (l === null) throw Error(f(311));
    l.lastRenderedReducer = a;
    var n = e.baseQueue,
      u = l.pending;
    if (u !== null) {
      if (n !== null) {
        var c = n.next;
        ((n.next = u.next), (u.next = c));
      }
      ((t.baseQueue = n = u), (l.pending = null));
    }
    if (((u = e.baseState), n === null)) e.memoizedState = u;
    else {
      t = n.next;
      var m = (c = null),
        E = null,
        A = t,
        _ = !1;
      do {
        var G = A.lane & -536870913;
        if (G !== A.lane ? (je & G) === G : (ql & G) === G) {
          var C = A.revertLane;
          if (C === 0)
            (E !== null &&
              (E = E.next =
                {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: A.action,
                  hasEagerState: A.hasEagerState,
                  eagerState: A.eagerState,
                  next: null,
                }),
              G === iu && (_ = !0));
          else if ((ql & C) === C) {
            ((A = A.next), C === iu && (_ = !0));
            continue;
          } else
            ((G = {
              lane: 0,
              revertLane: A.revertLane,
              gesture: null,
              action: A.action,
              hasEagerState: A.hasEagerState,
              eagerState: A.eagerState,
              next: null,
            }),
              E === null ? ((m = E = G), (c = u)) : (E = E.next = G),
              (Te.lanes |= C),
              (Mn |= C));
          ((G = A.action),
            fu && a(u, G),
            (u = A.hasEagerState ? A.eagerState : a(u, G)));
        } else
          ((C = {
            lane: G,
            revertLane: A.revertLane,
            gesture: A.gesture,
            action: A.action,
            hasEagerState: A.hasEagerState,
            eagerState: A.eagerState,
            next: null,
          }),
            E === null ? ((m = E = C), (c = u)) : (E = E.next = C),
            (Te.lanes |= G),
            (Mn |= G));
        A = A.next;
      } while (A !== null && A !== t);
      if (
        (E === null ? (c = u) : (E.next = m),
        !ot(u, e.memoizedState) && ((Ot = !0), _ && ((a = $u), a !== null)))
      )
        throw a;
      ((e.memoizedState = u),
        (e.baseState = c),
        (e.baseQueue = E),
        (l.lastRenderedState = u));
    }
    return (n === null && (l.lanes = 0), [e.memoizedState, l.dispatch]);
  }
  function Ns(e) {
    var t = zt(),
      a = t.queue;
    if (a === null) throw Error(f(311));
    a.lastRenderedReducer = e;
    var l = a.dispatch,
      n = a.pending,
      u = t.memoizedState;
    if (n !== null) {
      a.pending = null;
      var c = (n = n.next);
      do ((u = e(u, c.action)), (c = c.next));
      while (c !== n);
      (ot(u, t.memoizedState) || (Ot = !0),
        (t.memoizedState = u),
        t.baseQueue === null && (t.baseState = u),
        (a.lastRenderedState = u));
    }
    return [u, l];
  }
  function id(e, t, a) {
    var l = Te,
      n = zt(),
      u = Ce;
    if (u) {
      if (a === void 0) throw Error(f(407));
      a = a();
    } else a = t();
    var c = !ot((tt || n).memoizedState, a);
    if (
      (c && ((n.memoizedState = a), (Ot = !0)),
      (n = n.queue),
      xs(od.bind(null, l, n, e), [e]),
      (e =
        n.getSnapshot !== t ||
        c ||
        (wt !== null && (wt.memoizedState.tag & 1) !== 0)),
      ti(e ? 9 : 8, { destroy: void 0 }, rd.bind(null, l, n, a, t), null),
      e)
    ) {
      if (((l.flags |= 2048), at === null)) throw Error(f(349));
      u || (ql & 127) !== 0 || cd(l, t, a);
    }
    return a;
  }
  function cd(e, t, a) {
    ((e.flags |= 16384),
      (e = { getSnapshot: t, value: a }),
      (t = Te.updateQueue),
      t === null
        ? ((t = wr()), (Te.updateQueue = t), (t.stores = [e]))
        : ((a = t.stores), a === null ? (t.stores = [e]) : a.push(e)));
  }
  function rd(e, t, a, l) {
    ((t.value = a), (t.getSnapshot = l), sd(t) && fd(e));
  }
  function od(e, t, a) {
    return a(function () {
      sd(t) && fd(e);
    });
  }
  function sd(e) {
    var t = e.getSnapshot;
    e = e.value;
    try {
      var a = t();
      return !ot(e, a);
    } catch {
      return !0;
    }
  }
  function fd(e) {
    var t = eu(e, 2);
    t !== null && pa(t, e, 2);
  }
  function Ms(e) {
    var t = la();
    if (typeof e == "function") {
      var a = e;
      if (((e = a()), fu)) {
        ta(!0);
        try {
          a();
        } finally {
          ta(!1);
        }
      }
    }
    return (
      (t.memoizedState = t.baseState = e),
      (t.queue = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: Yl,
        lastRenderedState: e,
      }),
      t
    );
  }
  function md(e, t, a, l) {
    return ((e.baseState = a), Ts(e, tt, typeof l == "function" ? l : Yl));
  }
  function ay(e, t, a, l, n) {
    if (Ur(e)) throw Error(f(485));
    if (((e = t.action), e !== null)) {
      var u = {
        payload: n,
        action: e,
        next: null,
        isTransition: !0,
        status: "pending",
        value: null,
        reason: null,
        listeners: [],
        then: function (c) {
          u.listeners.push(c);
        },
      };
      (ie.T !== null ? a(!0) : (u.isTransition = !1),
        l(u),
        (a = t.pending),
        a === null
          ? ((u.next = t.pending = u), dd(t, u))
          : ((u.next = a.next), (t.pending = a.next = u)));
    }
  }
  function dd(e, t) {
    var a = t.action,
      l = t.payload,
      n = e.state;
    if (t.isTransition) {
      var u = ie.T,
        c = {};
      ((c.types = u !== null ? u.types : null), (ie.T = c));
      try {
        var m = a(n, l),
          E = ie.S;
        (E !== null && E(c, m), hd(e, t, m));
      } catch (A) {
        Cs(e, t, A);
      } finally {
        (u !== null && c.types !== null && (u.types = c.types), (ie.T = u));
      }
    } else
      try {
        ((u = a(n, l)), hd(e, t, u));
      } catch (A) {
        Cs(e, t, A);
      }
  }
  function hd(e, t, a) {
    a !== null && typeof a == "object" && typeof a.then == "function"
      ? a.then(
          function (l) {
            yd(e, t, l);
          },
          function (l) {
            return Cs(e, t, l);
          },
        )
      : yd(e, t, a);
  }
  function yd(e, t, a) {
    ((t.status = "fulfilled"),
      (t.value = a),
      vd(t),
      (e.state = a),
      (t = e.pending),
      t !== null &&
        ((a = t.next),
        a === t ? (e.pending = null) : ((a = a.next), (t.next = a), dd(e, a))));
  }
  function Cs(e, t, a) {
    var l = e.pending;
    if (((e.pending = null), l !== null)) {
      l = l.next;
      do ((t.status = "rejected"), (t.reason = a), vd(t), (t = t.next));
      while (t !== l);
    }
    e.action = null;
  }
  function vd(e) {
    e = e.listeners;
    for (var t = 0; t < e.length; t++) (0, e[t])();
  }
  function pd(e, t) {
    return t;
  }
  function gd(e, t) {
    if (Ce) {
      var a = at.formState;
      if (a !== null) {
        e: {
          var l = Te;
          if (Ce) {
            if (ut) {
              t: {
                for (var n = ut, u = Ya; n.nodeType !== 8; ) {
                  if (!u) {
                    n = null;
                    break t;
                  }
                  if (((n = Ga(n.nextSibling)), n === null)) {
                    n = null;
                    break t;
                  }
                }
                ((u = n.data), (n = u === "F!" || u === "F" ? n : null));
              }
              if (n) {
                ((ut = Ga(n.nextSibling)), (l = n.data === "F!"));
                break e;
              }
            }
            dn(l);
          }
          l = !1;
        }
        l && (t = a[0]);
      }
    }
    return (
      (a = la()),
      (a.memoizedState = a.baseState = t),
      (l = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: pd,
        lastRenderedState: t,
      }),
      (a.queue = l),
      (a = jd.bind(null, Te, l)),
      (l.dispatch = a),
      (l = Ms(!1)),
      (u = Rs.bind(null, Te, !1, l.queue)),
      (l = la()),
      (n = { state: t, dispatch: null, action: e, pending: null }),
      (l.queue = n),
      (a = ay.bind(null, Te, n, u, a)),
      (n.dispatch = a),
      (l.memoizedState = e),
      [t, a, !1]
    );
  }
  function Ed(e) {
    var t = zt();
    return bd(t, tt, e);
  }
  function bd(e, t, a) {
    if (
      ((t = Ts(e, t, pd)[0]),
      (e = Dr(Yl)[0]),
      typeof t == "object" && t !== null && typeof t.then == "function")
    )
      try {
        var l = sc(t);
      } catch (c) {
        throw c === Iu ? Sr : c;
      }
    else l = t;
    t = zt();
    var n = t.queue,
      u = n.dispatch;
    return (
      a !== t.memoizedState &&
        ((Te.flags |= 2048),
        ti(9, { destroy: void 0 }, ly.bind(null, n, a), null)),
      [l, u, e]
    );
  }
  function ly(e, t) {
    e.action = t;
  }
  function Sd(e) {
    var t = zt(),
      a = tt;
    if (a !== null) return bd(t, a, e);
    (zt(), (t = t.memoizedState), (a = zt()));
    var l = a.queue.dispatch;
    return ((a.memoizedState = e), [t, l, !1]);
  }
  function ti(e, t, a, l) {
    return (
      (e = { tag: e, create: a, deps: l, inst: t, next: null }),
      (t = Te.updateQueue),
      t === null && ((t = wr()), (Te.updateQueue = t)),
      (a = t.lastEffect),
      a === null
        ? (t.lastEffect = e.next = e)
        : ((l = a.next), (a.next = e), (e.next = l), (t.lastEffect = e)),
      e
    );
  }
  function zd() {
    return zt().memoizedState;
  }
  function Rr(e, t, a, l) {
    var n = la();
    ((Te.flags |= e),
      (n.memoizedState = ti(
        1 | t,
        { destroy: void 0 },
        a,
        l === void 0 ? null : l,
      )));
  }
  function _r(e, t, a, l) {
    var n = zt();
    l = l === void 0 ? null : l;
    var u = n.memoizedState.inst;
    tt !== null && l !== null && ps(l, tt.memoizedState.deps)
      ? (n.memoizedState = ti(t, u, a, l))
      : ((Te.flags |= e), (n.memoizedState = ti(1 | t, u, a, l)));
  }
  function Td(e, t) {
    Rr(8390656, 8, e, t);
  }
  function xs(e, t) {
    _r(2048, 8, e, t);
  }
  function ny(e) {
    Te.flags |= 4;
    var t = Te.updateQueue;
    if (t === null) ((t = wr()), (Te.updateQueue = t), (t.events = [e]));
    else {
      var a = t.events;
      a === null ? (t.events = [e]) : a.push(e);
    }
  }
  function Nd(e) {
    var t = zt().memoizedState;
    return (
      ny({ ref: t, nextImpl: e }),
      function () {
        if ((Ze & 2) !== 0) throw Error(f(440));
        return t.impl.apply(void 0, arguments);
      }
    );
  }
  function Md(e, t) {
    return _r(4, 2, e, t);
  }
  function Cd(e, t) {
    return _r(4, 4, e, t);
  }
  function xd(e, t) {
    if (typeof t == "function") {
      e = e();
      var a = t(e);
      return function () {
        typeof a == "function" ? a() : t(null);
      };
    }
    if (t != null)
      return (
        (e = e()),
        (t.current = e),
        function () {
          t.current = null;
        }
      );
  }
  function Ad(e, t, a) {
    ((a = a != null ? a.concat([e]) : null), _r(4, 4, xd.bind(null, t, e), a));
  }
  function As() {}
  function wd(e, t) {
    var a = zt();
    t = t === void 0 ? null : t;
    var l = a.memoizedState;
    return t !== null && ps(t, l[1]) ? l[0] : ((a.memoizedState = [e, t]), e);
  }
  function Od(e, t) {
    var a = zt();
    t = t === void 0 ? null : t;
    var l = a.memoizedState;
    if (t !== null && ps(t, l[1])) return l[0];
    if (((l = e()), fu)) {
      ta(!0);
      try {
        e();
      } finally {
        ta(!1);
      }
    }
    return ((a.memoizedState = [l, t]), l);
  }
  function ws(e, t, a) {
    return a === void 0 || ((ql & 1073741824) !== 0 && (je & 261930) === 0)
      ? (e.memoizedState = t)
      : ((e.memoizedState = a), (e = L0()), (Te.lanes |= e), (Mn |= e), a);
  }
  function Dd(e, t, a, l) {
    return ot(a, t)
      ? a
      : En.current !== null
        ? ((e = ws(e, a, l)), ot(e, t) || (Ot = !0), e)
        : (ql & 106) === 0 || ((ql & 1073741824) !== 0 && (je & 261930) === 0)
          ? ((Ot = !0), (e.memoizedState = a))
          : ((e = L0()), (Te.lanes |= e), (Mn |= e), t);
  }
  function Rd(e, t, a, l, n) {
    var u = ve.p;
    ve.p = u !== 0 && 8 > u ? u : 8;
    var c = ie.T,
      m = {};
    ((m.types = c !== null ? c.types : null), (ie.T = m), Rs(e, !1, t, a));
    try {
      var E = n(),
        A = ie.S;
      if (
        (A !== null && A(m, E),
        E !== null && typeof E == "object" && typeof E.then == "function")
      ) {
        var _ = P1(E, l);
        fc(e, t, _, Ma(e));
      } else fc(e, t, l, Ma(e));
    } catch (G) {
      fc(e, t, { then: function () {}, status: "rejected", reason: G }, Ma());
    } finally {
      ((ve.p = u),
        c !== null && m.types !== null && (c.types = m.types),
        (ie.T = c));
    }
  }
  function uy() {}
  function Os(e, t, a, l) {
    if (e.tag !== 5) throw Error(f(476));
    var n = _d(e).queue;
    Rd(
      e,
      n,
      t,
      Oe,
      a === null
        ? uy
        : function () {
            return (Ud(e), a(l));
          },
    );
  }
  function _d(e) {
    var t = e.memoizedState;
    if (t !== null) return t;
    t = {
      memoizedState: Oe,
      baseState: Oe,
      baseQueue: null,
      queue: {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: Yl,
        lastRenderedState: Oe,
      },
      next: null,
    };
    var a = {};
    return (
      (t.next = {
        memoizedState: a,
        baseState: a,
        baseQueue: null,
        queue: {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: Yl,
          lastRenderedState: a,
        },
        next: null,
      }),
      (e.memoizedState = t),
      (e = e.alternate),
      e !== null && (e.memoizedState = t),
      t
    );
  }
  function Ud(e) {
    var t = _d(e);
    (t.next === null && (t = e.alternate.memoizedState),
      fc(e, t.next.queue, {}, Ma()));
  }
  function Ds() {
    return Xt(bi);
  }
  function Hd() {
    return zt().memoizedState;
  }
  function Bd() {
    return zt().memoizedState;
  }
  function iy(e) {
    for (var t = e.return; t !== null; ) {
      switch (t.tag) {
        case 24:
        case 3:
          var a = Ma();
          e = pn(a);
          var l = gn(t, e, a);
          (l !== null && (pa(l, t, a), uc(l, t, a)),
            (t = { cache: us() }),
            (e.payload = t));
          return;
      }
      t = t.return;
    }
  }
  function cy(e, t, a) {
    var l = Ma();
    ((a = {
      lane: l,
      revertLane: 0,
      gesture: null,
      action: a,
      hasEagerState: !1,
      eagerState: null,
      next: null,
    }),
      Ur(e)
        ? qd(t, a)
        : ((a = $o(e, t, a, l)), a !== null && (pa(a, e, l), Yd(a, t, l))));
  }
  function jd(e, t, a) {
    var l = Ma();
    fc(e, t, a, l);
  }
  function fc(e, t, a, l) {
    var n = {
      lane: l,
      revertLane: 0,
      gesture: null,
      action: a,
      hasEagerState: !1,
      eagerState: null,
      next: null,
    };
    if (Ur(e)) qd(t, n);
    else {
      var u = e.alternate;
      if (
        e.lanes === 0 &&
        (u === null || u.lanes === 0) &&
        ((u = t.lastRenderedReducer), u !== null)
      )
        try {
          var c = t.lastRenderedState,
            m = u(c, a);
          if (((n.hasEagerState = !0), (n.eagerState = m), ot(m, c)))
            return (fr(e, t, n, 0), at === null && sr(), !1);
        } catch {
        } finally {
        }
      if (((a = $o(e, t, n, l)), a !== null))
        return (pa(a, e, l), Yd(a, t, l), !0);
    }
    return !1;
  }
  function Rs(e, t, a, l) {
    if (
      ((l = {
        lane: 2,
        revertLane: Tf(),
        gesture: null,
        action: l,
        hasEagerState: !1,
        eagerState: null,
        next: null,
      }),
      Ur(e))
    ) {
      if (t) throw Error(f(479));
    } else ((t = $o(e, a, l, 2)), t !== null && pa(t, e, 2));
  }
  function Ur(e) {
    var t = e.alternate;
    return e === Te || (t !== null && t === Te);
  }
  function qd(e, t) {
    Pu = xr = !0;
    var a = e.pending;
    (a === null ? (t.next = t) : ((t.next = a.next), (a.next = t)),
      (e.pending = t));
  }
  function Yd(e, t, a) {
    if ((a & 4194048) !== 0) {
      var l = t.lanes;
      ((l &= e.pendingLanes), (a |= l), (t.lanes = a), _i(e, a));
    }
  }
  var Hr = {
      readContext: Xt,
      use: Or,
      useCallback: vt,
      useContext: vt,
      useEffect: vt,
      useImperativeHandle: vt,
      useLayoutEffect: vt,
      useInsertionEffect: vt,
      useMemo: vt,
      useReducer: vt,
      useRef: vt,
      useState: vt,
      useDebugValue: vt,
      useDeferredValue: vt,
      useTransition: vt,
      useSyncExternalStore: vt,
      useId: vt,
      useHostTransitionStatus: vt,
      useFormState: vt,
      useActionState: vt,
      useOptimistic: vt,
      useMemoCache: vt,
      useCacheRefresh: vt,
      useEffectEvent: vt,
    },
    Ld = {
      readContext: Xt,
      use: Or,
      useCallback: function (e, t) {
        return ((la().memoizedState = [e, t === void 0 ? null : t]), e);
      },
      useContext: Xt,
      useEffect: Td,
      useImperativeHandle: function (e, t, a) {
        ((a = a != null ? a.concat([e]) : null),
          Rr(4194308, 4, xd.bind(null, t, e), a));
      },
      useLayoutEffect: function (e, t) {
        return Rr(4194308, 4, e, t);
      },
      useInsertionEffect: function (e, t) {
        Rr(4, 2, e, t);
      },
      useMemo: function (e, t) {
        var a = la();
        t = t === void 0 ? null : t;
        var l = e();
        if (fu) {
          ta(!0);
          try {
            e();
          } finally {
            ta(!1);
          }
        }
        return ((a.memoizedState = [l, t]), l);
      },
      useReducer: function (e, t, a) {
        var l = la();
        if (a !== void 0) {
          var n = a(t);
          if (fu) {
            ta(!0);
            try {
              a(t);
            } finally {
              ta(!1);
            }
          }
        } else n = t;
        return (
          (l.memoizedState = l.baseState = n),
          (e = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: e,
            lastRenderedState: n,
          }),
          (l.queue = e),
          (e = e.dispatch = cy.bind(null, Te, e)),
          [l.memoizedState, e]
        );
      },
      useRef: function (e) {
        var t = la();
        return ((e = { current: e }), (t.memoizedState = e));
      },
      useState: function (e) {
        e = Ms(e);
        var t = e.queue,
          a = jd.bind(null, Te, t);
        return ((t.dispatch = a), [e.memoizedState, a]);
      },
      useDebugValue: As,
      useDeferredValue: function (e, t) {
        var a = la();
        return ws(a, e, t);
      },
      useTransition: function () {
        var e = Ms(!1);
        return (
          (e = Rd.bind(null, Te, e.queue, !0, !1)),
          (la().memoizedState = e),
          [!1, e]
        );
      },
      useSyncExternalStore: function (e, t, a) {
        var l = Te,
          n = la();
        if (Ce) {
          if (a === void 0) throw Error(f(407));
          a = a();
        } else {
          if (((a = t()), at === null)) throw Error(f(349));
          (je & 127) !== 0 || cd(l, t, a);
        }
        n.memoizedState = a;
        var u = { value: a, getSnapshot: t };
        return (
          (n.queue = u),
          Td(od.bind(null, l, u, e), [e]),
          (l.flags |= 2048),
          ti(9, { destroy: void 0 }, rd.bind(null, l, u, a, t), null),
          a
        );
      },
      useId: function () {
        var e = la(),
          t = at.identifierPrefix;
        if (Ce) {
          var a = ml,
            l = fl;
          ((a = (l & ~(1 << (32 - It(l) - 1))).toString(32) + a),
            (t = "_" + t + "R_" + a),
            (a = Ar++),
            0 < a && (t += "H" + a.toString(32)),
            (t += "_"));
        } else ((a = ey++), (t = "_" + t + "r_" + a.toString(32) + "_"));
        return (e.memoizedState = t);
      },
      useHostTransitionStatus: Ds,
      useFormState: gd,
      useActionState: gd,
      useOptimistic: function (e) {
        var t = la();
        t.memoizedState = t.baseState = e;
        var a = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: null,
          lastRenderedState: null,
        };
        return (
          (t.queue = a),
          (t = Rs.bind(null, Te, !0, a)),
          (a.dispatch = t),
          [e, t]
        );
      },
      useMemoCache: zs,
      useCacheRefresh: function () {
        return (la().memoizedState = iy.bind(null, Te));
      },
      useEffectEvent: function (e) {
        var t = la(),
          a = { impl: e };
        return (
          (t.memoizedState = a),
          function () {
            if ((Ze & 2) !== 0) throw Error(f(440));
            return a.impl.apply(void 0, arguments);
          }
        );
      },
    },
    Gd = {
      readContext: Xt,
      use: Or,
      useCallback: wd,
      useContext: Xt,
      useEffect: xs,
      useImperativeHandle: Ad,
      useInsertionEffect: Md,
      useLayoutEffect: Cd,
      useMemo: Od,
      useReducer: Dr,
      useRef: zd,
      useState: function () {
        return Dr(Yl);
      },
      useDebugValue: As,
      useDeferredValue: function (e, t) {
        var a = zt();
        return Dd(a, tt.memoizedState, e, t);
      },
      useTransition: function () {
        var e = Dr(Yl)[0],
          t = zt().memoizedState;
        return [typeof e == "boolean" ? e : sc(e), t];
      },
      useSyncExternalStore: id,
      useId: Hd,
      useHostTransitionStatus: Ds,
      useFormState: Ed,
      useActionState: Ed,
      useOptimistic: function (e, t) {
        var a = zt();
        return md(a, tt, e, t);
      },
      useMemoCache: zs,
      useCacheRefresh: Bd,
      useEffectEvent: Nd,
    },
    ry = {
      readContext: Xt,
      use: Or,
      useCallback: wd,
      useContext: Xt,
      useEffect: xs,
      useImperativeHandle: Ad,
      useInsertionEffect: Md,
      useLayoutEffect: Cd,
      useMemo: Od,
      useReducer: Ns,
      useRef: zd,
      useState: function () {
        return Ns(Yl);
      },
      useDebugValue: As,
      useDeferredValue: function (e, t) {
        var a = zt();
        return tt === null ? ws(a, e, t) : Dd(a, tt.memoizedState, e, t);
      },
      useTransition: function () {
        var e = Ns(Yl)[0],
          t = zt().memoizedState;
        return [typeof e == "boolean" ? e : sc(e), t];
      },
      useSyncExternalStore: id,
      useId: Hd,
      useHostTransitionStatus: Ds,
      useFormState: Sd,
      useActionState: Sd,
      useOptimistic: function (e, t) {
        var a = zt();
        return tt !== null
          ? md(a, tt, e, t)
          : ((a.baseState = e), [e, a.queue.dispatch]);
      },
      useMemoCache: zs,
      useCacheRefresh: Bd,
      useEffectEvent: Nd,
    };
  function _s(e, t, a, l) {
    ((t = e.memoizedState),
      (a = a(l, t)),
      (a = a == null ? t : K({}, t, a)),
      (e.memoizedState = a),
      e.lanes === 0 && (e.updateQueue.baseState = a));
  }
  var Us = {
    enqueueSetState: function (e, t, a) {
      e = e._reactInternals;
      var l = Ma(),
        n = pn(l);
      ((n.payload = t),
        a != null && (n.callback = a),
        (t = gn(e, n, l)),
        t !== null && (pa(t, e, l), uc(t, e, l)));
    },
    enqueueReplaceState: function (e, t, a) {
      e = e._reactInternals;
      var l = Ma(),
        n = pn(l);
      ((n.tag = 1),
        (n.payload = t),
        a != null && (n.callback = a),
        (t = gn(e, n, l)),
        t !== null && (pa(t, e, l), uc(t, e, l)));
    },
    enqueueForceUpdate: function (e, t) {
      e = e._reactInternals;
      var a = Ma(),
        l = pn(a);
      ((l.tag = 2),
        t != null && (l.callback = t),
        (t = gn(e, l, a)),
        t !== null && (pa(t, e, a), uc(t, e, a)));
    },
  };
  function Xd(e, t, a, l, n, u, c) {
    return (
      (e = e.stateNode),
      typeof e.shouldComponentUpdate == "function"
        ? e.shouldComponentUpdate(l, u, c)
        : t.prototype && t.prototype.isPureReactComponent
          ? !Ua(a, l) || !Ua(n, u)
          : !0
    );
  }
  function kd(e, t, a, l) {
    ((e = t.state),
      typeof t.componentWillReceiveProps == "function" &&
        t.componentWillReceiveProps(a, l),
      typeof t.UNSAFE_componentWillReceiveProps == "function" &&
        t.UNSAFE_componentWillReceiveProps(a, l),
      t.state !== e && Us.enqueueReplaceState(t, t.state, null));
  }
  function mu(e, t) {
    var a = t;
    if ("ref" in t) {
      a = {};
      for (var l in t) l !== "ref" && (a[l] = t[l]);
    }
    if ((e = e.defaultProps)) {
      a === t && (a = K({}, a));
      for (var n in e) a[n] === void 0 && (a[n] = e[n]);
    }
    return a;
  }
  function Vd(e) {
    or(e);
  }
  function Qd(e) {
    console.error(e);
  }
  function Zd(e) {
    or(e);
  }
  function Br(e, t) {
    try {
      var a = e.onUncaughtError;
      a(t.value, { componentStack: t.stack });
    } catch (l) {
      setTimeout(function () {
        throw l;
      });
    }
  }
  function Kd(e, t, a) {
    try {
      var l = e.onCaughtError;
      l(a.value, {
        componentStack: a.stack,
        errorBoundary: t.tag === 1 ? t.stateNode : null,
      });
    } catch (n) {
      setTimeout(function () {
        throw n;
      });
    }
  }
  function Hs(e, t, a) {
    return (
      (a = pn(a)),
      (a.tag = 3),
      (a.payload = { element: null }),
      (a.callback = function () {
        Br(e, t);
      }),
      a
    );
  }
  function Jd(e) {
    return ((e = pn(e)), (e.tag = 3), e);
  }
  function Fd(e, t, a, l) {
    var n = a.type.getDerivedStateFromError;
    if (typeof n == "function") {
      var u = l.value;
      ((e.payload = function () {
        return n(u);
      }),
        (e.callback = function () {
          Kd(t, a, l);
        }));
    }
    var c = a.stateNode;
    c !== null &&
      typeof c.componentDidCatch == "function" &&
      (e.callback = function () {
        (Kd(t, a, l),
          typeof n != "function" &&
            (Cn === null ? (Cn = new Set([this])) : Cn.add(this)));
        var m = l.stack;
        this.componentDidCatch(l.value, {
          componentStack: m !== null ? m : "",
        });
      });
  }
  function oy(e, t, a, l, n) {
    if (
      ((a.flags |= 32768),
      l !== null && typeof l == "object" && typeof l.then == "function")
    ) {
      if (
        ((t = a.alternate),
        t !== null && nu(t, a, n, !0),
        (a = kt.current),
        a !== null)
      ) {
        switch (a.tag) {
          case 31:
          case 13:
          case 19:
            return (
              Pt === null ? lo() : a.alternate === null && pt === 0 && (pt = 3),
              (a.flags &= -257),
              (a.flags |= 65536),
              (a.lanes = n),
              l === zr
                ? (a.flags |= 16384)
                : ((t = a.updateQueue),
                  t === null ? (a.updateQueue = new Set([l])) : t.add(l),
                  bf(e, l, n)),
              !1
            );
          case 22:
            return (
              (a.flags |= 65536),
              l === zr
                ? (a.flags |= 16384)
                : ((t = a.updateQueue),
                  t === null
                    ? ((t = {
                        transitions: null,
                        markerInstances: null,
                        retryQueue: new Set([l]),
                      }),
                      (a.updateQueue = t))
                    : ((a = t.retryQueue),
                      a === null ? (t.retryQueue = new Set([l])) : a.add(l)),
                  bf(e, l, n)),
              !1
            );
        }
        throw Error(f(435, a.tag));
      }
      return (bf(e, l, n), lo(), !1);
    }
    if (Ce)
      return (
        (t = kt.current),
        t !== null
          ? ((t.flags & 65536) === 0 && (t.flags |= 256),
            (t.flags |= 65536),
            (t.lanes = n),
            l !== ts && ((e = Error(f(422), { cause: l })), ec(Ba(e, a))))
          : (l !== ts && ((t = Error(f(423), { cause: l })), ec(Ba(t, a))),
            (e = e.current.alternate),
            (e.flags |= 65536),
            (n &= -n),
            (e.lanes |= n),
            (l = Ba(l, a)),
            (n = Hs(e.stateNode, l, n)),
            fs(e, n),
            pt !== 4 && (pt = 2)),
        !1
      );
    var u = Error(f(520), { cause: l });
    if (
      ((u = Ba(u, a)),
      Ec === null ? (Ec = [u]) : Ec.push(u),
      pt !== 4 && (pt = 2),
      t === null)
    )
      return !0;
    ((l = Ba(l, a)), (a = t));
    do {
      switch (a.tag) {
        case 3:
          return (
            (a.flags |= 65536),
            (e = n & -n),
            (a.lanes |= e),
            (e = Hs(a.stateNode, l, e)),
            fs(a, e),
            !1
          );
        case 1:
          if (
            ((t = a.type),
            (u = a.stateNode),
            (a.flags & 128) === 0 &&
              (typeof t.getDerivedStateFromError == "function" ||
                (u !== null &&
                  typeof u.componentDidCatch == "function" &&
                  (Cn === null || !Cn.has(u)))))
          )
            return (
              (a.flags |= 65536),
              (n &= -n),
              (a.lanes |= n),
              (n = Jd(n)),
              Fd(n, e, a, l),
              fs(a, n),
              !1
            );
          break;
        case 22:
          if (a.memoizedState !== null) return ((a.flags |= 65536), !1);
      }
      a = a.return;
    } while (a !== null);
    return !1;
  }
  var Bs = Error(f(461)),
    Ot = !1;
  function _t(e, t, a, l) {
    t.child = e === null ? Pm(t, null, a, l) : su(t, e.child, a, l);
  }
  function $d(e, t, a, l, n) {
    a = a.render;
    var u = t.ref;
    if ("ref" in l) {
      var c = {};
      for (var m in l) m !== "ref" && (c[m] = l[m]);
    } else c = l;
    return (
      uu(t),
      (l = gs(e, t, a, c, u, n)),
      (m = Es()),
      e !== null && !Ot
        ? (bs(e, t, n), Ll(e, t, n))
        : (Ce && m && yr(t), (t.flags |= 1), _t(e, t, l, n), t.child)
    );
  }
  function Id(e, t, a, l, n) {
    if (e === null) {
      var u = a.type;
      return typeof u == "function" &&
        !Io(u) &&
        u.defaultProps === void 0 &&
        a.compare === null
        ? ((t.tag = 15), (t.type = u), Wd(e, t, u, l, n))
        : ((e = dr(a.type, null, l, t, t.mode, n)),
          (e.ref = t.ref),
          (e.return = t),
          (t.child = e));
    }
    if (((u = e.child), !Vs(e, n))) {
      var c = u.memoizedProps;
      if (
        ((a = a.compare), (a = a !== null ? a : Ua), a(c, l) && e.ref === t.ref)
      )
        return Ll(e, t, n);
    }
    return (
      (t.flags |= 1),
      (e = Ul(u, l)),
      (e.ref = t.ref),
      (e.return = t),
      (t.child = e)
    );
  }
  function Wd(e, t, a, l, n) {
    if (e !== null) {
      var u = e.memoizedProps;
      if (Ua(u, l) && e.ref === t.ref)
        if (((Ot = !1), (t.pendingProps = l = u), Vs(e, n)))
          (e.flags & 131072) !== 0 && (Ot = !0);
        else return ((t.lanes = e.lanes), Ll(e, t, n));
    }
    return js(e, t, a, l, n);
  }
  function Pd(e, t, a, l) {
    var n = l.children,
      u = e !== null ? e.memoizedState : null;
    if (
      (e === null &&
        t.stateNode === null &&
        (t.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null,
        }),
      l.mode === "hidden")
    ) {
      if ((t.flags & 128) !== 0) {
        if (((u = u !== null ? u.baseLanes | a : a), e !== null)) {
          for (l = t.child = e.child, n = 0; l !== null; )
            ((n = n | l.lanes | l.childLanes), (l = l.sibling));
          l = n & ~u;
        } else ((l = 0), (t.child = null));
        return e0(e, t, u, a, l);
      }
      if ((a & 536870912) !== 0)
        ((t.memoizedState = { baseLanes: 0, cachePool: null }),
          e !== null && br(t, u !== null ? u.cachePool : null),
          u !== null ? ad(t, u) : ds(),
          ld(t));
      else
        return (
          (l = t.lanes = 536870912),
          e0(e, t, u !== null ? u.baseLanes | a : a, a, l)
        );
    } else
      u !== null
        ? (br(t, u.cachePool), ad(t, u), Sn(), (t.memoizedState = null))
        : (e !== null && br(t, null), ds(), Sn());
    return (_t(e, t, n, a), t.child);
  }
  function mc(e, t) {
    return (
      (e !== null && e.tag === 22) ||
        t.stateNode !== null ||
        (t.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null,
        }),
      t.sibling
    );
  }
  function e0(e, t, a, l, n) {
    var u = cs();
    return (
      (u = u === null ? null : { parent: At._currentValue, pool: u }),
      (t.memoizedState = { baseLanes: a, cachePool: u }),
      e !== null && br(t, null),
      ds(),
      ld(t),
      e !== null && nu(e, t, l, !0),
      (t.childLanes = n),
      null
    );
  }
  function jr(e, t) {
    return (
      (t = qr({ mode: t.mode, children: t.children }, e.mode)),
      (t.ref = e.ref),
      (e.child = t),
      (t.return = e),
      t
    );
  }
  function t0(e, t, a) {
    return (
      su(t, e.child, null, a),
      (e = jr(t, t.pendingProps)),
      (e.flags |= 2),
      Sa(t),
      (t.memoizedState = null),
      e
    );
  }
  function sy(e, t, a) {
    var l = t.pendingProps,
      n = (t.flags & 128) !== 0;
    if (((t.flags &= -129), e === null)) {
      if (Ce) {
        if (l.mode === "hidden")
          return (
            (e = jr(t, l)),
            (t.lanes = 536870912),
            (e.memoizedState = { baseLanes: 0, cachePool: null }),
            mc(null, e)
          );
        if (
          (ys(t),
          (e = ut)
            ? ((e = xh(e, Ya)),
              (e = e !== null && e.data === "&" ? e : null),
              e !== null &&
                ((t.memoizedState = {
                  dehydrated: e,
                  treeContext: fn !== null ? { id: fl, overflow: ml } : null,
                  retryLane: 536870912,
                  hydrationErrors: null,
                }),
                (a = qm(e)),
                (a.return = t),
                (t.child = a),
                (Bt = t),
                (ut = null)))
            : (e = null),
          e === null)
        )
          throw dn(t);
        return ((t.lanes = 536870912), null);
      }
      return jr(t, l);
    }
    var u = e.memoizedState;
    if (u !== null) {
      var c = u.dehydrated;
      if ((ys(t), n))
        if (t.flags & 256) ((t.flags &= -257), (t = t0(e, t, a)));
        else if (t.memoizedState !== null)
          ((t.child = e.child), (t.flags |= 128), (t = null));
        else throw Error(f(558));
      else if (
        (Ot || nu(e, t, a, !1), (n = (a & e.childLanes) !== 0), Ot || n)
      ) {
        if (En.current === null) {
          if (
            ((l = at),
            l !== null && ((c = Mt(l, a)), c !== 0 && c !== u.retryLane))
          )
            throw ((u.retryLane = c), eu(e, c), pa(l, e, c), Bs);
          lo();
        }
        t = t0(e, t, a);
      } else
        ((e = u.treeContext),
          (ut = Ga(c.nextSibling)),
          (Bt = t),
          (Ce = !0),
          (mn = null),
          (Ya = !1),
          e !== null && Gm(t, e),
          (t = jr(t, l)),
          (t.flags |= 134221824));
      return t;
    }
    return (
      (e = Ul(e.child, { mode: l.mode, children: l.children })),
      (e.ref = t.ref),
      (t.child = e),
      (e.return = t),
      e
    );
  }
  function ai(e, t) {
    var a = t.ref;
    if (a === null) e !== null && e.ref !== null && (t.flags |= 4194816);
    else {
      if (typeof a != "function" && typeof a != "object") throw Error(f(284));
      (e === null || e.ref !== a) && (t.flags |= 4194816);
    }
  }
  function js(e, t, a, l, n) {
    return (
      uu(t),
      (a = gs(e, t, a, l, void 0, n)),
      (l = Es()),
      e !== null && !Ot
        ? (bs(e, t, n), Ll(e, t, n))
        : (Ce && l && yr(t), (t.flags |= 1), _t(e, t, a, n), t.child)
    );
  }
  function a0(e, t, a, l, n, u) {
    return (
      uu(t),
      (t.updateQueue = null),
      (a = ud(t, l, a, n)),
      nd(e),
      (l = Es()),
      e !== null && !Ot
        ? (bs(e, t, u), Ll(e, t, u))
        : (Ce && l && yr(t), (t.flags |= 1), _t(e, t, a, u), t.child)
    );
  }
  function l0(e, t, a, l, n) {
    if ((uu(t), t.stateNode === null)) {
      var u = Zu,
        c = a.contextType;
      (typeof c == "object" && c !== null && (u = Xt(c)),
        (u = new a(l, u)),
        (t.memoizedState =
          u.state !== null && u.state !== void 0 ? u.state : null),
        (u.updater = Us),
        (t.stateNode = u),
        (u._reactInternals = t),
        (u = t.stateNode),
        (u.props = l),
        (u.state = t.memoizedState),
        (u.refs = {}),
        os(t),
        (c = a.contextType),
        (u.context = typeof c == "object" && c !== null ? Xt(c) : Zu),
        (u.state = t.memoizedState),
        (c = a.getDerivedStateFromProps),
        typeof c == "function" && (_s(t, a, c, l), (u.state = t.memoizedState)),
        typeof a.getDerivedStateFromProps == "function" ||
          typeof u.getSnapshotBeforeUpdate == "function" ||
          (typeof u.UNSAFE_componentWillMount != "function" &&
            typeof u.componentWillMount != "function") ||
          ((c = u.state),
          typeof u.componentWillMount == "function" && u.componentWillMount(),
          typeof u.UNSAFE_componentWillMount == "function" &&
            u.UNSAFE_componentWillMount(),
          c !== u.state && Us.enqueueReplaceState(u, u.state, null),
          cc(t, l, u, n),
          ic(),
          (u.state = t.memoizedState)),
        typeof u.componentDidMount == "function" && (t.flags |= 4194308),
        (l = !0));
    } else if (e === null) {
      u = t.stateNode;
      var m = t.memoizedProps,
        E = mu(a, m);
      u.props = E;
      var A = u.context,
        _ = a.contextType;
      ((c = Zu), typeof _ == "object" && _ !== null && (c = Xt(_)));
      var G = a.getDerivedStateFromProps;
      ((_ =
        typeof G == "function" ||
        typeof u.getSnapshotBeforeUpdate == "function"),
        (m = t.pendingProps !== m),
        _ ||
          (typeof u.UNSAFE_componentWillReceiveProps != "function" &&
            typeof u.componentWillReceiveProps != "function") ||
          ((m || A !== c) && kd(t, u, l, c)),
        (vn = !1));
      var C = t.memoizedState;
      ((u.state = C),
        cc(t, l, u, n),
        ic(),
        (A = t.memoizedState),
        m || C !== A || vn
          ? (typeof G == "function" && (_s(t, a, G, l), (A = t.memoizedState)),
            (E = vn || Xd(t, a, E, l, C, A, c))
              ? (_ ||
                  (typeof u.UNSAFE_componentWillMount != "function" &&
                    typeof u.componentWillMount != "function") ||
                  (typeof u.componentWillMount == "function" &&
                    u.componentWillMount(),
                  typeof u.UNSAFE_componentWillMount == "function" &&
                    u.UNSAFE_componentWillMount()),
                typeof u.componentDidMount == "function" &&
                  (t.flags |= 4194308))
              : (typeof u.componentDidMount == "function" &&
                  (t.flags |= 4194308),
                (t.memoizedProps = l),
                (t.memoizedState = A)),
            (u.props = l),
            (u.state = A),
            (u.context = c),
            (l = E))
          : (typeof u.componentDidMount == "function" && (t.flags |= 4194308),
            (l = !1)));
    } else {
      ((u = t.stateNode),
        ss(e, t),
        (c = t.memoizedProps),
        (_ = mu(a, c)),
        (u.props = _),
        (G = t.pendingProps),
        (C = u.context),
        (A = a.contextType),
        (E = Zu),
        typeof A == "object" && A !== null && (E = Xt(A)),
        (m = a.getDerivedStateFromProps),
        (A =
          typeof m == "function" ||
          typeof u.getSnapshotBeforeUpdate == "function") ||
          (typeof u.UNSAFE_componentWillReceiveProps != "function" &&
            typeof u.componentWillReceiveProps != "function") ||
          ((c !== G || C !== E) && kd(t, u, l, E)),
        (vn = !1),
        (C = t.memoizedState),
        (u.state = C),
        cc(t, l, u, n),
        ic());
      var D = t.memoizedState;
      c !== G ||
      C !== D ||
      vn ||
      (e !== null && e.dependencies !== null && gr(e.dependencies))
        ? (typeof m == "function" && (_s(t, a, m, l), (D = t.memoizedState)),
          (_ =
            vn ||
            Xd(t, a, _, l, C, D, E) ||
            (e !== null && e.dependencies !== null && gr(e.dependencies)))
            ? (A ||
                (typeof u.UNSAFE_componentWillUpdate != "function" &&
                  typeof u.componentWillUpdate != "function") ||
                (typeof u.componentWillUpdate == "function" &&
                  u.componentWillUpdate(l, D, E),
                typeof u.UNSAFE_componentWillUpdate == "function" &&
                  u.UNSAFE_componentWillUpdate(l, D, E)),
              typeof u.componentDidUpdate == "function" && (t.flags |= 4),
              typeof u.getSnapshotBeforeUpdate == "function" &&
                (t.flags |= 1024))
            : (typeof u.componentDidUpdate != "function" ||
                (c === e.memoizedProps && C === e.memoizedState) ||
                (t.flags |= 4),
              typeof u.getSnapshotBeforeUpdate != "function" ||
                (c === e.memoizedProps && C === e.memoizedState) ||
                (t.flags |= 1024),
              (t.memoizedProps = l),
              (t.memoizedState = D)),
          (u.props = l),
          (u.state = D),
          (u.context = E),
          (l = _))
        : (typeof u.componentDidUpdate != "function" ||
            (c === e.memoizedProps && C === e.memoizedState) ||
            (t.flags |= 4),
          typeof u.getSnapshotBeforeUpdate != "function" ||
            (c === e.memoizedProps && C === e.memoizedState) ||
            (t.flags |= 1024),
          (l = !1));
    }
    return (
      (u = l),
      ai(e, t),
      (l = (t.flags & 128) !== 0),
      u || l
        ? ((u = t.stateNode),
          (a =
            l && typeof a.getDerivedStateFromError != "function"
              ? null
              : u.render()),
          (t.flags |= 1),
          e !== null && l
            ? ((t.child = su(t, e.child, null, n)),
              (t.child = su(t, null, a, n)))
            : _t(e, t, a, n),
          (t.memoizedState = u.state),
          (e = t.child))
        : (e = Ll(e, t, n)),
      e
    );
  }
  function n0(e, t, a, l) {
    return (au(), (t.flags |= 256), _t(e, t, a, l), t.child);
  }
  var qs = {
    dehydrated: null,
    treeContext: null,
    retryLane: 0,
    hydrationErrors: null,
  };
  function Ys(e) {
    return { baseLanes: e, cachePool: Km() };
  }
  function Ls(e, t, a) {
    return ((e = e !== null ? e.childLanes & ~a : 0), t && (e |= Na), e);
  }
  function u0(e, t, a) {
    var l = t.pendingProps,
      n = !1,
      u = (t.flags & 128) !== 0,
      c;
    if (
      ((c = u) ||
        (c =
          e !== null && e.memoizedState === null ? !1 : (Vt.current & 2) !== 0),
      c && ((n = !0), (t.flags &= -129)),
      (c = (t.flags & 32) !== 0),
      (t.flags &= -33),
      e === null)
    ) {
      if (Ce) {
        if (
          (n ? bn(t) : Sn(),
          (e = ut)
            ? ((e = xh(e, Ya)),
              (e = e !== null && e.data !== "&" ? e : null),
              e !== null &&
                ((t.memoizedState = {
                  dehydrated: e,
                  treeContext: fn !== null ? { id: fl, overflow: ml } : null,
                  retryLane: 536870912,
                  hydrationErrors: null,
                }),
                (a = qm(e)),
                (a.return = t),
                (t.child = a),
                (Bt = t),
                (ut = null)))
            : (e = null),
          e === null)
        )
          throw dn(t);
        return (Lf(e) ? (t.lanes = 32) : (t.lanes = 536870912), null);
      }
      return (
        (u = l.children),
        (l = l.fallback),
        n
          ? (Sn(),
            (n = t.mode),
            (u = qr({ mode: "hidden", children: u }, n)),
            (l = tu(l, n, a, null)),
            (u.return = t),
            (l.return = t),
            (u.sibling = l),
            (t.child = u),
            (l = t.child),
            (l.memoizedState = Ys(a)),
            (l.childLanes = Ls(e, c, a)),
            (t.memoizedState = qs),
            mc(null, l))
          : (bn(t), Gs(t, u))
      );
    }
    var m = e.memoizedState;
    if (m !== null) {
      var E = m.dehydrated;
      if (E !== null) return fy(e, t, u, c, l, E, m, a);
    }
    return n
      ? (Sn(),
        (n = l.fallback),
        (u = t.mode),
        (m = e.child),
        (E = m.sibling),
        (l = Ul(m, { mode: "hidden", children: l.children })),
        (l.subtreeFlags = m.subtreeFlags & 1206910976),
        E !== null ? (n = Ul(E, n)) : ((n = tu(n, u, a, null)), (n.flags |= 2)),
        (n.return = t),
        (l.return = t),
        (l.sibling = n),
        (t.child = l),
        mc(null, l),
        (l = t.child),
        (n = e.child.memoizedState),
        n === null
          ? (n = Ys(a))
          : ((u = n.cachePool),
            u !== null
              ? ((m = At._currentValue),
                (u = u.parent !== m ? { parent: m, pool: m } : u))
              : (u = Km()),
            (n = { baseLanes: n.baseLanes | a, cachePool: u })),
        (l.memoizedState = n),
        (l.childLanes = Ls(e, c, a)),
        (t.memoizedState = qs),
        mc(e.child, l))
      : (bn(t),
        (a = e.child),
        (e = a.sibling),
        (a = Ul(a, { mode: "visible", children: l.children })),
        (a.return = t),
        (a.sibling = null),
        e !== null &&
          ((c = t.deletions),
          c === null ? ((t.deletions = [e]), (t.flags |= 16)) : c.push(e)),
        (t.child = a),
        (t.memoizedState = null),
        a);
  }
  function Gs(e, t) {
    return (
      (t = qr({ mode: "visible", children: t }, e.mode)),
      (t.return = e),
      (e.child = t)
    );
  }
  function qr(e, t) {
    return ((e = da(22, e, null, t)), (e.lanes = 0), e);
  }
  function Yr(e, t, a) {
    return (
      su(t, e.child, null, a),
      (e = Gs(t, t.pendingProps.children)),
      (e.flags |= 2),
      (t.memoizedState = null),
      e
    );
  }
  function fy(e, t, a, l, n, u, c, m) {
    if (a)
      return t.flags & 256
        ? (bn(t), (t.flags &= -257), Yr(e, t, m))
        : t.memoizedState !== null
          ? (Sn(), (t.child = e.child), (t.flags |= 128), null)
          : (Sn(),
            (u = n.fallback),
            (c = t.mode),
            (n = qr({ mode: "visible", children: n.children }, c)),
            (u = tu(u, c, m, null)),
            (u.flags |= 2),
            (n.return = t),
            (u.return = t),
            (n.sibling = u),
            (t.child = n),
            su(t, e.child, null, m),
            (n = t.child),
            (n.memoizedState = Ys(m)),
            (n.childLanes = Ls(e, l, m)),
            (t.memoizedState = qs),
            mc(null, n));
    if ((bn(t), Lf(u))) {
      if (((l = u.nextSibling && u.nextSibling.dataset), l)) var E = l.dgst;
      return (
        (l = E),
        l !== "" &&
          ((n = Error(f(419))),
          (n.stack = ""),
          (n.digest = l),
          ec({ value: n, source: null, stack: null })),
        Yr(e, t, m)
      );
    }
    if ((Ot || nu(e, t, m, !1), (l = (m & e.childLanes) !== 0), Ot || l)) {
      if (En.current !== null) return Yr(e, t, m);
      if (
        ((l = at), l !== null && ((n = Mt(l, m)), n !== 0 && n !== c.retryLane))
      )
        throw ((c.retryLane = n), eu(e, n), pa(l, e, n), Bs);
      return (Yf(u) || lo(), Yr(e, t, m));
    }
    return Yf(u)
      ? ((t.flags |= 192), (t.child = e.child), null)
      : ((e = c.treeContext),
        (ut = Ga(u.nextSibling)),
        (Bt = t),
        (Ce = !0),
        (mn = null),
        (Ya = !1),
        e !== null && Gm(t, e),
        (t = Gs(t, n.children)),
        (t.flags |= 134221824),
        t);
  }
  function i0(e, t, a) {
    e.lanes |= t;
    var l = e.alternate;
    (l !== null && (l.lanes |= t), pr(e.return, t, a));
  }
  function c0(e) {
    for (var t = null; e !== null; ) {
      var a = e.alternate;
      (a !== null && Cr(a) === null && (t = e), (e = e.sibling));
    }
    return t;
  }
  function Lr(e, t, a, l, n, u) {
    var c = e.memoizedState;
    c === null
      ? (e.memoizedState = {
          isBackwards: t,
          rendering: null,
          renderingStartTime: 0,
          last: l,
          tail: a,
          tailMode: n,
          treeForkCount: u,
        })
      : ((c.isBackwards = t),
        (c.rendering = null),
        (c.renderingStartTime = 0),
        (c.last = l),
        (c.tail = a),
        (c.tailMode = n),
        (c.treeForkCount = u));
  }
  function Xs(e) {
    var t = e.child;
    for (e.child = null; t !== null; ) {
      var a = t.sibling;
      ((t.sibling = e.child), (e.child = t), (t = a));
    }
  }
  function ks(e, t, a) {
    var l = t.pendingProps,
      n = l.revealOrder,
      u = l.tail;
    l = l.children;
    var c = Vt.current;
    if (t.flags & 128) return (rc(t, c), null);
    var m = (c & 2) !== 0;
    if (
      (m ? ((c = (c & 1) | 2), (t.flags |= 128)) : (c &= 1),
      rc(t, c),
      n === "backwards" && e !== null
        ? (Xs(e), _t(e, t, l, a), Xs(e))
        : _t(e, t, l, a),
      (l = Ce ? Pi : 0),
      !m && e !== null && (e.flags & 128) !== 0)
    )
      e: for (e = t.child; e !== null; ) {
        if (e.tag === 13) e.memoizedState !== null && i0(e, a, t);
        else if (e.tag === 19) i0(e, a, t);
        else if (e.child !== null) {
          ((e.child.return = e), (e = e.child));
          continue;
        }
        if (e === t) break e;
        for (; e.sibling === null; ) {
          if (e.return === null || e.return === t) break e;
          e = e.return;
        }
        ((e.sibling.return = e.return), (e = e.sibling));
      }
    switch (n) {
      case "backwards":
        ((a = c0(t.child)),
          a === null
            ? ((n = t.child), (t.child = null))
            : ((n = a.sibling), (a.sibling = null), Xs(t)),
          Lr(t, !0, n, null, u, l));
        break;
      case "unstable_legacy-backwards":
        for (a = null, n = t.child, t.child = null; n !== null; ) {
          if (((e = n.alternate), e !== null && Cr(e) === null)) {
            t.child = n;
            break;
          }
          ((e = n.sibling), (n.sibling = a), (a = n), (n = e));
        }
        Lr(t, !0, a, null, u, l);
        break;
      case "together":
        Lr(t, !1, null, null, void 0, l);
        break;
      case "independent":
        t.memoizedState = null;
        break;
      default:
        ((a = c0(t.child)),
          a === null
            ? ((n = t.child), (t.child = null))
            : ((n = a.sibling), (a.sibling = null)),
          Lr(t, !1, n, a, u, l));
    }
    return t.child;
  }
  function r0(e, t, a) {
    var l = t.pendingProps;
    return (hn(t, t.type, l.value), _t(e, t, l.children, a), t.child);
  }
  function Ll(e, t, a) {
    if (
      (e !== null && (t.dependencies = e.dependencies),
      (Mn |= t.lanes),
      (a & t.childLanes) === 0)
    )
      if (e !== null) {
        if ((nu(e, t, a, !1), (a & t.childLanes) === 0)) return null;
      } else return null;
    if (e !== null && t.child !== e.child) throw Error(f(153));
    if (t.child !== null) {
      for (
        e = t.child, a = Ul(e, e.pendingProps), t.child = a, a.return = t;
        e.sibling !== null;

      )
        ((e = e.sibling),
          (a = a.sibling = Ul(e, e.pendingProps)),
          (a.return = t));
      a.sibling = null;
    }
    return t.child;
  }
  function Vs(e, t) {
    return (e.lanes & t) !== 0
      ? !0
      : ((e = e.dependencies), !!(e !== null && gr(e)));
  }
  function my(e, t, a) {
    switch (t.tag) {
      case 3:
        ($e(t, t.stateNode.containerInfo),
          hn(t, At, e.memoizedState.cache),
          au());
        break;
      case 27:
      case 5:
        jn(t);
        break;
      case 4:
        $e(t, t.stateNode.containerInfo);
        break;
      case 10:
        hn(t, t.type, t.memoizedProps.value);
        break;
      case 31:
        if (t.memoizedState !== null) return ((t.flags |= 128), ys(t), null);
        break;
      case 13:
        var l = t.memoizedState;
        if (l !== null) {
          if (l.dehydrated !== null) return (bn(t), (t.flags |= 128), null);
          l = nu(e, t, a, !1);
          var n = t.child.childLanes;
          return l || (a & n) !== 0
            ? u0(e, t, a)
            : (bn(t), (e = Ll(e, t, a)), e !== null ? e.sibling : null);
        }
        bn(t);
        break;
      case 19:
        if (t.flags & 128) return ks(e, t, a);
        if (
          ((n = (e.flags & 128) !== 0),
          (l = (a & t.childLanes) !== 0),
          l || (nu(e, t, a, !1), (l = (a & t.childLanes) !== 0)),
          n)
        ) {
          if (l) return ks(e, t, a);
          t.flags |= 128;
        }
        if (
          ((n = t.memoizedState),
          n !== null &&
            ((n.rendering = null), (n.tail = null), (n.lastEffect = null)),
          rc(t, Vt.current),
          l)
        )
          break;
        return null;
      case 22:
        return ((t.lanes = 0), Pd(e, t, a, t.pendingProps));
      case 24:
        hn(t, At, e.memoizedState.cache);
    }
    return Ll(e, t, a);
  }
  function o0(e, t, a) {
    if (e !== null)
      if (e.memoizedProps !== t.pendingProps) Ot = !0;
      else {
        if (!Vs(e, a) && (t.flags & 128) === 0) return ((Ot = !1), my(e, t, a));
        Ot = (e.flags & 131072) !== 0;
      }
    else ((Ot = !1), Ce && (t.flags & 1048576) !== 0 && Lm(t, Pi, t.index));
    switch (((t.lanes = 0), t.tag)) {
      case 16:
        e: {
          var l = t.pendingProps;
          if (((e = ru(t.elementType)), (t.type = e), typeof e == "function"))
            Io(e)
              ? ((l = mu(e, l)), (t.tag = 1), (t = l0(null, t, e, l, a)))
              : ((t.tag = 0), (t = js(null, t, e, l, a)));
          else {
            if (e != null) {
              var n = e.$$typeof;
              if (n === J) {
                ((t.tag = 11), (t = $d(null, t, e, l, a)));
                break e;
              } else if (n === xe) {
                ((t.tag = 14), (t = Id(null, t, e, l, a)));
                break e;
              } else if (n === Ae) {
                ((t.tag = 10), (t.type = e), (t = r0(null, t, a)));
                break e;
              }
            }
            throw ((t = we(e) || e), Error(f(306, t, "")));
          }
        }
        return t;
      case 0:
        return js(e, t, t.type, t.pendingProps, a);
      case 1:
        return ((l = t.type), (n = mu(l, t.pendingProps)), l0(e, t, l, n, a));
      case 3:
        e: {
          if (($e(t, t.stateNode.containerInfo), e === null))
            throw Error(f(387));
          l = t.pendingProps;
          var u = t.memoizedState;
          ((n = u.element), ss(e, t), cc(t, l, null, a));
          var c = t.memoizedState;
          if (
            ((l = c.cache),
            hn(t, At, l),
            l !== u.cache && ns(t, [At], a, !0),
            ic(),
            (l = c.element),
            u.isDehydrated)
          )
            if (
              ((u = { element: l, isDehydrated: !1, cache: c.cache }),
              (t.updateQueue.baseState = u),
              (t.memoizedState = u),
              t.flags & 256)
            ) {
              t = n0(e, t, l, a);
              break e;
            } else if (l !== n) {
              ((n = Ba(Error(f(424)), t)), ec(n), (t = n0(e, t, l, a)));
              break e;
            } else {
              switch (((e = t.stateNode.containerInfo), e.nodeType)) {
                case 9:
                  e = e.body;
                  break;
                default:
                  e = e.nodeName === "HTML" ? e.ownerDocument.body : e;
              }
              for (
                ut = Ga(e.firstChild),
                  Bt = t,
                  Ce = !0,
                  mn = null,
                  Ya = !0,
                  a = Pm(t, null, l, a),
                  t.child = a;
                a;

              )
                ((a.flags = (a.flags & -3) | 134221824), (a = a.sibling));
            }
          else {
            if ((au(), l === n)) {
              t = Ll(e, t, a);
              break e;
            }
            _t(e, t, l, a);
          }
          t = t.child;
        }
        return t;
      case 26:
        return (
          ai(e, t),
          e === null
            ? (a = Uh(t.type, null, t.pendingProps, null))
              ? (t.memoizedState = a)
              : Ce || (t.stateNode = dh(t.type, t.pendingProps, Va.current, t))
            : (t.memoizedState = Uh(
                t.type,
                e.memoizedProps,
                t.pendingProps,
                e.memoizedState,
              )),
          null
        );
      case 27:
        return (
          jn(t),
          e === null &&
            Ce &&
            ((l = t.stateNode = Oh(t.type, t.pendingProps, Va.current)),
            (Bt = t),
            (Ya = !0),
            (n = ut),
            wn(t.type) ? ((Gf = n), (ut = Ga(l.firstChild))) : (ut = n)),
          _t(e, t, t.pendingProps.children, a),
          ai(e, t),
          e === null && (t.flags |= 4194304),
          t.child
        );
      case 5:
        return (
          e === null &&
            Ce &&
            ((n = l = ut) &&
              ((l = iv(l, t.type, t.pendingProps, Ya)),
              l !== null
                ? ((t.stateNode = l),
                  (Bt = t),
                  (ut = Ga(l.firstChild)),
                  (Ya = !1),
                  (n = !0))
                : (n = !1)),
            n || dn(t)),
          jn(t),
          (n = t.type),
          (u = t.pendingProps),
          (c = e !== null ? e.memoizedProps : null),
          (l = u.children),
          Rf(n, u) ? (l = null) : c !== null && Rf(n, c) && (t.flags |= 32),
          t.memoizedState !== null &&
            ((n = gs(e, t, ty, null, null, a)), (bi._currentValue = n)),
          ai(e, t),
          _t(e, t, l, a),
          t.child
        );
      case 6:
        return (
          e === null &&
            Ce &&
            ((e = a = ut) &&
              ((a = cv(a, t.pendingProps, Ya)),
              a !== null
                ? ((t.stateNode = a), (Bt = t), (ut = null), (e = !0))
                : (e = !1)),
            e || dn(t)),
          null
        );
      case 13:
        return u0(e, t, a);
      case 4:
        return (
          $e(t, t.stateNode.containerInfo),
          (l = t.pendingProps),
          e === null ? (t.child = su(t, null, l, a)) : _t(e, t, l, a),
          t.child
        );
      case 11:
        return $d(e, t, t.type, t.pendingProps, a);
      case 7:
        return ((l = t.pendingProps), ai(e, t), _t(e, t, l, a), t.child);
      case 8:
        return (_t(e, t, t.pendingProps.children, a), t.child);
      case 12:
        return (_t(e, t, t.pendingProps.children, a), t.child);
      case 10:
        return r0(e, t, a);
      case 9:
        return (
          (n = t.type._context),
          (l = t.pendingProps.children),
          uu(t),
          (n = Xt(n)),
          (l = l(n)),
          (t.flags |= 1),
          _t(e, t, l, a),
          t.child
        );
      case 14:
        return Id(e, t, t.type, t.pendingProps, a);
      case 15:
        return Wd(e, t, t.type, t.pendingProps, a);
      case 19:
        return ks(e, t, a);
      case 31:
        return sy(e, t, a);
      case 22:
        return Pd(e, t, a, t.pendingProps);
      case 24:
        return (
          uu(t),
          (l = Xt(At)),
          e === null
            ? ((n = cs()),
              n === null &&
                ((n = at),
                (u = us()),
                (n.pooledCache = u),
                u.refCount++,
                u !== null && (n.pooledCacheLanes |= a),
                (n = u)),
              (t.memoizedState = { parent: l, cache: n }),
              os(t),
              hn(t, At, n))
            : ((e.lanes & a) !== 0 && (ss(e, t), cc(t, null, null, a), ic()),
              (n = e.memoizedState),
              (u = t.memoizedState),
              n.parent !== l
                ? ((n = { parent: l, cache: l }),
                  (t.memoizedState = n),
                  t.lanes === 0 &&
                    (t.memoizedState = t.updateQueue.baseState = n),
                  hn(t, At, l))
                : ((l = u.cache),
                  hn(t, At, l),
                  l !== n.cache && ns(t, [At], a, !0))),
          _t(e, t, t.pendingProps.children, a),
          t.child
        );
      case 30:
        return (
          t.stateNode === null &&
            (t.stateNode = {
              autoName: null,
              paired: null,
              clones: null,
              ref: null,
            }),
          (l = t.pendingProps),
          l.name != null && l.name !== "auto"
            ? (t.flags |= e === null ? 18882560 : 18874368)
            : Ce && yr(t),
          e !== null && e.memoizedProps.name !== l.name
            ? (t.flags |= 4194816)
            : ai(e, t),
          _t(e, t, l.children, a),
          t.child
        );
      case 29:
        throw t.pendingProps;
    }
    throw Error(f(156, t.tag));
  }
  function Gl(e) {
    e.flags |= 4;
  }
  function Qs(e, t, a, l, n) {
    var u;
    if (
      ((u = (e.mode & 32) !== 0) &&
        (u =
          a === null
            ? qh(t, l)
            : qh(t, l) && (l.src !== a.src || l.srcSet !== a.srcSet)),
      u)
    ) {
      if (((e.flags |= 16777216), (n & 335544128) === n))
        if (e.stateNode.complete) e.flags |= 8192;
        else if (V0()) e.flags |= 8192;
        else throw ((ou = zr), rs);
    } else e.flags &= -16777217;
  }
  function s0(e, t) {
    if (t.type !== "stylesheet" || (t.state.loading & 4) !== 0)
      e.flags &= -16777217;
    else if (((e.flags |= 16777216), !Yh(t)))
      if (V0()) e.flags |= 8192;
      else throw ((ou = zr), rs);
  }
  function Gr(e, t) {
    (t !== null && (e.flags |= 4),
      e.flags & 16384 &&
        ((t = e.tag !== 22 ? zl() : 536870912), (e.lanes |= t), (ci |= t)));
  }
  function dc(e, t) {
    if (!Ce)
      switch (e.tailMode) {
        case "visible":
          break;
        case "collapsed":
          for (var a = e.tail, l = null; a !== null; )
            (a.alternate !== null && (l = a), (a = a.sibling));
          l === null
            ? t || e.tail === null
              ? (e.tail = null)
              : (e.tail.sibling = null)
            : (l.sibling = null);
          break;
        default:
          for (t = e.tail, a = null; t !== null; )
            (t.alternate !== null && (a = t), (t = t.sibling));
          a === null ? (e.tail = null) : (a.sibling = null);
      }
  }
  function it(e) {
    var t = e.alternate !== null && e.alternate.child === e.child,
      a = 0,
      l = 0;
    if (t)
      for (var n = e.child; n !== null; )
        ((a |= n.lanes | n.childLanes),
          (l |= n.subtreeFlags & 1206910976),
          (l |= n.flags & 1206910976),
          (n.return = e),
          (n = n.sibling));
    else
      for (n = e.child; n !== null; )
        ((a |= n.lanes | n.childLanes),
          (l |= n.subtreeFlags),
          (l |= n.flags),
          (n.return = e),
          (n = n.sibling));
    return ((e.subtreeFlags |= l), (e.childLanes = a), t);
  }
  function dy(e, t, a) {
    var l = t.pendingProps;
    switch ((es(t), t.tag)) {
      case 16:
      case 15:
      case 0:
      case 11:
      case 7:
      case 8:
      case 12:
      case 9:
      case 14:
        return (it(t), null);
      case 1:
        return (it(t), null);
      case 3:
        return (
          (a = t.stateNode),
          (l = null),
          e !== null && (l = e.memoizedState.cache),
          t.memoizedState.cache !== l && (t.flags |= 2048),
          jl(At),
          rt(),
          a.pendingContext &&
            ((a.context = a.pendingContext), (a.pendingContext = null)),
          (e === null || e.child === null) &&
            (Fu(t)
              ? Gl(t)
              : e === null ||
                (e.memoizedState.isDehydrated && (t.flags & 256) === 0) ||
                ((t.flags |= 1024), as())),
          it(t),
          null
        );
      case 26:
        var n = t.type,
          u = t.memoizedState;
        return (
          e === null
            ? (Gl(t),
              u !== null ? (it(t), s0(t, u)) : (it(t), Qs(t, n, null, l, a)))
            : u
              ? u !== e.memoizedState
                ? (Gl(t), it(t), s0(t, u))
                : (it(t), (t.flags &= -16777217))
              : ((e = e.memoizedProps),
                e !== l && Gl(t),
                it(t),
                Qs(t, n, e, l, a)),
          null
        );
      case 27:
        if (
          (Vl(t),
          (a = Va.current),
          (n = t.type),
          e !== null && t.stateNode != null)
        )
          e.memoizedProps !== l && Gl(t);
        else {
          if (!l) {
            if (t.stateNode === null) throw Error(f(166));
            return (it(t), (t.subtreeFlags &= -33554433), null);
          }
          ((e = $t.current),
            Fu(t) ? Xm(t) : ((e = Oh(n, l, a)), (t.stateNode = e), Gl(t)));
        }
        return (it(t), (t.subtreeFlags &= -33554433), null);
      case 5:
        if ((Vl(t), (n = t.type), e !== null && t.stateNode != null))
          e.memoizedProps !== l && Gl(t);
        else {
          if (!l) {
            if (t.stateNode === null) throw Error(f(166));
            return (it(t), (t.subtreeFlags &= -33554433), null);
          }
          if (((u = $t.current), Fu(t))) Xm(t);
          else {
            var c = Nc(Va.current);
            switch (u) {
              case 1:
                u = c.createElementNS("http://www.w3.org/2000/svg", n);
                break;
              case 2:
                u = c.createElementNS("http://www.w3.org/1998/Math/MathML", n);
                break;
              default:
                switch (n) {
                  case "svg":
                    u = c.createElementNS("http://www.w3.org/2000/svg", n);
                    break;
                  case "math":
                    u = c.createElementNS(
                      "http://www.w3.org/1998/Math/MathML",
                      n,
                    );
                    break;
                  case "script":
                    ((u = c.createElement("div")),
                      (u.innerHTML = "<script><\/script>"),
                      (u = u.removeChild(u.firstChild)));
                    break;
                  case "select":
                    ((u =
                      typeof l.is == "string"
                        ? c.createElement("select", { is: l.is })
                        : c.createElement("select")),
                      l.multiple
                        ? (u.multiple = !0)
                        : l.size && (u.size = l.size));
                    break;
                  default:
                    u =
                      typeof l.is == "string"
                        ? c.createElement(n, { is: l.is })
                        : c.createElement(n);
                }
            }
            ((u[Et] = t), (u[Ut] = l));
            e: for (c = t.child; c !== null; ) {
              if (c.tag === 5 || c.tag === 6) u.appendChild(c.stateNode);
              else if (c.tag !== 4 && c.tag !== 27 && c.child !== null) {
                ((c.child.return = c), (c = c.child));
                continue;
              }
              if (c === t) break e;
              for (; c.sibling === null; ) {
                if (c.return === null || c.return === t) break e;
                c = c.return;
              }
              ((c.sibling.return = c.return), (c = c.sibling));
            }
            t.stateNode = u;
            e: switch ((Zt(u, n, l), n)) {
              case "button":
              case "input":
              case "select":
              case "textarea":
                l = !!l.autoFocus;
                break e;
              case "img":
                l = !0;
                break e;
              default:
                l = !1;
            }
            l && Gl(t);
          }
        }
        return (
          it(t),
          (t.subtreeFlags &= -33554433),
          Qs(t, t.type, e === null ? null : e.memoizedProps, t.pendingProps, a),
          null
        );
      case 6:
        if (e && t.stateNode != null) e.memoizedProps !== l && Gl(t);
        else {
          if (typeof l != "string" && t.stateNode === null) throw Error(f(166));
          if (((e = Va.current), Fu(t))) {
            if (
              ((e = t.stateNode),
              (a = t.memoizedProps),
              (l = null),
              (n = Bt),
              n !== null)
            )
              switch (n.tag) {
                case 27:
                case 5:
                  l = n.memoizedProps;
              }
            ((e[Et] = t),
              (e = !!(
                e.nodeValue === a ||
                (l !== null && l.suppressHydrationWarning === !0) ||
                oh(e.nodeValue, a)
              )),
              e || dn(t, !0));
          } else
            ((e = Nc(e).createTextNode(l)), (e[Et] = t), (t.stateNode = e));
        }
        return (it(t), null);
      case 31:
        if (((a = t.memoizedState), e === null || e.memoizedState !== null)) {
          if (((l = Fu(t)), a !== null)) {
            if (e === null) {
              if (!l) throw Error(f(318));
              if (
                ((e = t.memoizedState),
                (e = e !== null ? e.dehydrated : null),
                !e)
              )
                throw Error(f(557));
              e[Et] = t;
            } else
              (au(),
                (t.flags & 128) === 0 && (t.memoizedState = null),
                (t.flags |= 4));
            (it(t), (e = !1));
          } else
            ((a = as()),
              e !== null &&
                e.memoizedState !== null &&
                (e.memoizedState.hydrationErrors = a),
              (e = !0));
          if (!e) return t.flags & 256 ? (Sa(t), t) : (Sa(t), null);
          if ((t.flags & 128) !== 0) throw Error(f(558));
        }
        return (it(t), null);
      case 13:
        if (
          ((l = t.memoizedState),
          e === null ||
            (e.memoizedState !== null && e.memoizedState.dehydrated !== null))
        ) {
          if (((n = Fu(t)), l !== null && l.dehydrated !== null)) {
            if (e === null) {
              if (!n) throw Error(f(318));
              if (
                ((n = t.memoizedState),
                (n = n !== null ? n.dehydrated : null),
                !n)
              )
                throw Error(f(317));
              n[Et] = t;
            } else
              (au(),
                (t.flags & 128) === 0 && (t.memoizedState = null),
                (t.flags |= 4));
            (it(t), (n = !1));
          } else
            ((n = as()),
              e !== null &&
                e.memoizedState !== null &&
                (e.memoizedState.hydrationErrors = n),
              (n = !0));
          if (!n) return t.flags & 256 ? (Sa(t), t) : (Sa(t), null);
        }
        return (
          Sa(t),
          (t.flags & 128) !== 0
            ? ((t.lanes = a), t)
            : ((a = l !== null),
              (e = e !== null && e.memoizedState !== null),
              a &&
                ((l = t.child),
                (n = null),
                l.alternate !== null &&
                  l.alternate.memoizedState !== null &&
                  l.alternate.memoizedState.cachePool !== null &&
                  (n = l.alternate.memoizedState.cachePool.pool),
                (u = null),
                l.memoizedState !== null &&
                  l.memoizedState.cachePool !== null &&
                  (u = l.memoizedState.cachePool.pool),
                u !== n && (l.flags |= 2048)),
              a !== e && a && (t.child.flags |= 8192),
              Gr(t, t.updateQueue),
              it(t),
              null)
        );
      case 4:
        return (
          rt(),
          e === null && xf(t.stateNode.containerInfo),
          (t.flags |= 67108864),
          it(t),
          null
        );
      case 10:
        return (jl(t.type), it(t), null);
      case 19:
        if ((vs(t), (l = t.memoizedState), l === null)) return (it(t), null);
        if (((n = (t.flags & 128) !== 0), (u = l.rendering), u === null))
          if (n) dc(l, !1);
          else {
            if (pt !== 0 || (e !== null && (e.flags & 128) !== 0))
              for (e = t.child; e !== null; ) {
                if (((u = Cr(e)), u !== null)) {
                  for (
                    t.flags |= 128,
                      dc(l, !1),
                      e = u.updateQueue,
                      t.updateQueue = e,
                      Gr(t, e),
                      t.subtreeFlags = 0,
                      e = a,
                      a = t.child;
                    a !== null;

                  )
                    (jm(a, e), (a = a.sibling));
                  return (
                    rc(t, (Vt.current & 1) | 2),
                    Ce && Hl(t, l.treeForkCount),
                    t.child
                  );
                }
                e = e.sibling;
              }
            l.tail !== null &&
              ea() > Pr &&
              ((t.flags |= 128), (n = !0), dc(l, !1), (t.lanes = 4194304));
          }
        else {
          if (!n)
            if (((e = Cr(u)), e !== null)) {
              if (
                ((t.flags |= 128),
                (n = !0),
                (e = e.updateQueue),
                (t.updateQueue = e),
                Gr(t, e),
                dc(l, !0),
                l.tail === null &&
                  l.tailMode !== "collapsed" &&
                  l.tailMode !== "visible" &&
                  !u.alternate &&
                  !Ce)
              )
                return (it(t), null);
            } else
              2 * ea() - l.renderingStartTime > Pr &&
                a !== 536870912 &&
                ((t.flags |= 128), (n = !0), dc(l, !1), (t.lanes = 4194304));
          l.isBackwards
            ? ((u.sibling = t.child), (t.child = u))
            : ((e = l.last),
              e !== null ? (e.sibling = u) : (t.child = u),
              (l.last = u));
        }
        if (l.tail !== null) {
          e = l.tail;
          e: {
            for (a = e; a !== null; ) {
              if (a.alternate !== null) {
                a = !1;
                break e;
              }
              a = a.sibling;
            }
            a = !0;
          }
          return (
            (l.rendering = e),
            (l.tail = e.sibling),
            (l.renderingStartTime = ea()),
            (e.sibling = null),
            (u = Vt.current),
            (u = n ? (u & 1) | 2 : u & 1),
            l.tailMode === "visible" || l.tailMode === "collapsed" || !a || Ce
              ? rc(t, u)
              : ((a = u), Qe(kt, t), Qe(Vt, a), Pt === null && (Pt = t)),
            Ce && Hl(t, l.treeForkCount),
            e
          );
        }
        return (it(t), null);
      case 22:
      case 23:
        return (
          Sa(t),
          hs(),
          (l = t.memoizedState !== null),
          e !== null
            ? (e.memoizedState !== null) !== l && (t.flags |= 8192)
            : l && (t.flags |= 8192),
          l
            ? (a & 536870912) !== 0 &&
              (t.flags & 128) === 0 &&
              (it(t), t.subtreeFlags & 6 && (t.flags |= 8192))
            : it(t),
          (a = t.updateQueue),
          a !== null && Gr(t, a.retryQueue),
          (a = null),
          e !== null &&
            e.memoizedState !== null &&
            e.memoizedState.cachePool !== null &&
            (a = e.memoizedState.cachePool.pool),
          (l = null),
          t.memoizedState !== null &&
            t.memoizedState.cachePool !== null &&
            (l = t.memoizedState.cachePool.pool),
          l !== a && (t.flags |= 2048),
          e !== null && gt(cu),
          null
        );
      case 24:
        return (
          (a = null),
          e !== null && (a = e.memoizedState.cache),
          t.memoizedState.cache !== a && (t.flags |= 2048),
          jl(At),
          it(t),
          null
        );
      case 25:
        return null;
      case 30:
        return ((t.flags |= 33554432), it(t), null);
    }
    throw Error(f(156, t.tag));
  }
  function hy(e, t) {
    switch ((es(t), t.tag)) {
      case 1:
        return (
          (e = t.flags),
          e & 65536 ? ((t.flags = (e & -65537) | 128), t) : null
        );
      case 3:
        return (
          jl(At),
          rt(),
          (e = t.flags),
          (e & 65536) !== 0 && (e & 128) === 0
            ? ((t.flags = (e & -65537) | 128), t)
            : null
        );
      case 26:
      case 27:
      case 5:
        return (Vl(t), null);
      case 31:
        if (t.memoizedState !== null) {
          if ((Sa(t), t.alternate === null)) throw Error(f(340));
          au();
        }
        return (
          (e = t.flags),
          e & 65536 ? ((t.flags = (e & -65537) | 128), t) : null
        );
      case 13:
        if (
          (Sa(t), (e = t.memoizedState), e !== null && e.dehydrated !== null)
        ) {
          if (t.alternate === null) throw Error(f(340));
          au();
        }
        return (
          (e = t.flags),
          e & 65536 ? ((t.flags = (e & -65537) | 128), t) : null
        );
      case 19:
        return (
          vs(t),
          (e = t.flags),
          e & 65536
            ? ((t.flags = (e & -65537) | 128),
              (e = t.memoizedState),
              e !== null && ((e.rendering = null), (e.tail = null)),
              (t.flags |= 4),
              t)
            : null
        );
      case 4:
        return (rt(), null);
      case 10:
        return (jl(t.type), null);
      case 22:
      case 23:
        return (
          Sa(t),
          hs(),
          e !== null && gt(cu),
          (e = t.flags),
          e & 65536 ? ((t.flags = (e & -65537) | 128), t) : null
        );
      case 24:
        return (jl(At), null);
      case 25:
        return null;
      default:
        return null;
    }
  }
  function f0(e, t) {
    switch ((es(t), t.tag)) {
      case 3:
        (jl(At), rt());
        break;
      case 26:
      case 27:
      case 5:
        Vl(t);
        break;
      case 4:
        rt();
        break;
      case 31:
        t.memoizedState !== null && Sa(t);
        break;
      case 13:
        Sa(t);
        break;
      case 19:
        vs(t);
        break;
      case 10:
        jl(t.type);
        break;
      case 22:
      case 23:
        (Sa(t), hs(), e !== null && gt(cu));
        break;
      case 24:
        jl(At);
    }
  }
  function hc(e, t) {
    try {
      var a = t.updateQueue,
        l = a !== null ? a.lastEffect : null;
      if (l !== null) {
        var n = l.next;
        a = n;
        do {
          if ((a.tag & e) === e) {
            l = void 0;
            var u = a.create,
              c = a.inst;
            ((l = u()), (c.destroy = l));
          }
          a = a.next;
        } while (a !== n);
      }
    } catch (m) {
      We(t, t.return, m);
    }
  }
  function zn(e, t, a) {
    try {
      var l = t.updateQueue,
        n = l !== null ? l.lastEffect : null;
      if (n !== null) {
        var u = n.next;
        l = u;
        do {
          if ((l.tag & e) === e) {
            var c = l.inst,
              m = c.destroy;
            if (m !== void 0) {
              ((c.destroy = void 0), (n = t));
              var E = a,
                A = m;
              try {
                A();
              } catch (_) {
                We(n, E, _);
              }
            }
          }
          l = l.next;
        } while (l !== u);
      }
    } catch (_) {
      We(t, t.return, _);
    }
  }
  function m0(e) {
    var t = e.updateQueue;
    if (t !== null) {
      var a = e.stateNode;
      try {
        td(t, a);
      } catch (l) {
        We(e, e.return, l);
      }
    }
  }
  function d0(e, t, a) {
    ((a.props = mu(e.type, e.memoizedProps)), (a.state = e.memoizedState));
    try {
      a.componentWillUnmount();
    } catch (l) {
      We(e, t, l);
    }
  }
  function dl(e, t) {
    try {
      var a = e.ref;
      if (a !== null) {
        switch (e.tag) {
          case 26:
          case 27:
          case 5:
            var l = e.stateNode;
            break;
          case 30:
            var n = e.stateNode,
              u = Rl(e.memoizedProps, n);
            ((n.ref === null || n.ref.name !== u) && (n.ref = bh(u)),
              (l = n.ref));
            break;
          case 7:
            if (e.stateNode === null) {
              var c = new Ca(e);
              (p(e.child, !1, nv, c, void 0, void 0), (e.stateNode = c));
            }
            l = e.stateNode;
            break;
          default:
            l = e.stateNode;
        }
        typeof a == "function" ? (e.refCleanup = a(l)) : (a.current = l);
      }
    } catch (m) {
      We(e, t, m);
    }
  }
  function Qt(e, t) {
    var a = e.ref,
      l = e.refCleanup;
    if (a !== null)
      if (typeof l == "function")
        try {
          l();
        } catch (n) {
          We(e, t, n);
        } finally {
          ((e.refCleanup = null),
            (e = e.alternate),
            e != null && (e.refCleanup = null));
        }
      else if (typeof a == "function")
        try {
          a(null);
        } catch (n) {
          We(e, t, n);
        }
      else a.current = null;
  }
  function Xr(e, t) {
    if (
      (e.tag === 5 || e.tag === 27 || e.tag === 6) &&
      e.alternate === null &&
      t !== null
    )
      for (var a = 0; a < t.length; a++) Ch(e.stateNode, t[a]);
  }
  function h0(e) {
    for (
      var t = e.return;
      t !== null && (Ks(t) && Ch(e.stateNode, t.stateNode), !Zs(t));

    )
      t = t.return;
  }
  function yc(e) {
    for (
      var t = e.return;
      t !== null && (Ks(t) && uv(e.stateNode, t.stateNode), !Zs(t));

    )
      t = t.return;
  }
  function Zs(e) {
    return e.tag === 5 || e.tag === 3 || e.tag === 27;
  }
  function Ks(e) {
    return e && e.tag === 7 && e.stateNode !== null;
  }
  function Js(e) {
    var t = e.type,
      a = e.memoizedProps,
      l = e.stateNode;
    try {
      e: switch (t) {
        case "button":
        case "input":
        case "select":
        case "textarea":
          a.autoFocus && l.focus();
          break e;
        case "img":
          a.src ? (l.src = a.src) : a.srcSet && (l.srcset = a.srcSet);
      }
    } catch (n) {
      We(e, e.return, n);
    }
  }
  function Fs(e, t, a) {
    try {
      var l = e.stateNode;
      (Ly(l, e.type, a, t), (l[Ut] = t));
    } catch (n) {
      We(e, e.return, n);
    }
  }
  function y0(e) {
    return (
      e.tag === 5 ||
      e.tag === 3 ||
      e.tag === 26 ||
      (e.tag === 27 && wn(e.type)) ||
      e.tag === 4
    );
  }
  function $s(e) {
    e: for (;;) {
      for (; e.sibling === null; ) {
        if (e.return === null || y0(e.return)) return null;
        e = e.return;
      }
      for (
        e.sibling.return = e.return, e = e.sibling;
        e.tag !== 5 && e.tag !== 6 && e.tag !== 18;

      ) {
        if (
          (e.tag === 27 && wn(e.type)) ||
          e.flags & 2 ||
          e.child === null ||
          e.tag === 4
        )
          continue e;
        ((e.child.return = e), (e = e.child));
      }
      if (!(e.flags & 2)) return e.stateNode;
    }
  }
  function Is(e, t, a, l) {
    var n = e.tag;
    if (n === 5 || n === 6)
      ((n = e.stateNode),
        t
          ? (a.nodeType === 9
              ? a.body
              : a.nodeName === "HTML"
                ? a.ownerDocument.body
                : a
            ).insertBefore(n, t)
          : ((t =
              a.nodeType === 9
                ? a.body
                : a.nodeName === "HTML"
                  ? a.ownerDocument.body
                  : a),
            t.appendChild(n),
            (a = a._reactRootContainer),
            a != null || t.onclick !== null || (t.onclick = mt)),
        Xr(e, l),
        (Le = !0));
    else if (
      n !== 4 &&
      (n === 27 &&
        (Xr(e, l), (l = null), wn(e.type) && ((a = e.stateNode), (t = null))),
      (e = e.child),
      e !== null)
    )
      for (Is(e, t, a, l), e = e.sibling; e !== null; )
        (Is(e, t, a, l), (e = e.sibling));
  }
  function kr(e, t, a, l) {
    var n = e.tag;
    if (n === 5 || n === 6)
      ((n = e.stateNode),
        t ? a.insertBefore(n, t) : a.appendChild(n),
        Xr(e, l),
        (Le = !0));
    else if (
      n !== 4 &&
      (n === 27 && (Xr(e, l), (l = null), wn(e.type) && (a = e.stateNode)),
      (e = e.child),
      e !== null)
    )
      for (kr(e, t, a, l), e = e.sibling; e !== null; )
        (kr(e, t, a, l), (e = e.sibling));
  }
  function v0(e) {
    var t = e.stateNode,
      a = e.memoizedProps;
    try {
      for (var l = e.type, n = t.attributes; n.length; )
        t.removeAttributeNode(n[0]);
      (Zt(t, l, a), (t[Et] = e), (t[Ut] = a));
    } catch (u) {
      We(e, e.return, u);
    }
  }
  var Vr = !1,
    za = null;
  function p0(e) {
    (e.tag === 30 || (e.subtreeFlags & 33554432) !== 0) && (Vr = !0);
  }
  var hl = null;
  function g0() {
    var e = hl;
    return ((hl = null), e);
  }
  var ha = 0;
  function li(e, t, a, l, n) {
    return ((ha = 0), E0(e.child, t, a, l, n));
  }
  function E0(e, t, a, l, n) {
    for (var u = !1; e !== null; ) {
      if (e.tag === 5) {
        var c = e.stateNode;
        if (l !== null) {
          var m = Hf(c);
          (l.push(m), m.view && (u = !0));
        } else u || (Hf(c).view && (u = !0));
        ((Vr = !0), gh(c, ha === 0 ? t : t + "_" + ha, a), ha++);
      } else
        (e.tag !== 22 || e.memoizedState === null) &&
          ((e.tag === 30 && n) || (E0(e.child, t, a, l, n) && (u = !0)));
      e = e.sibling;
    }
    return u;
  }
  function yl(e, t) {
    for (; e !== null; )
      (e.tag === 5
        ? Eh(e.stateNode, e.memoizedProps)
        : (e.tag !== 22 || e.memoizedState === null) &&
          ((e.tag === 30 && t) || yl(e.child, t)),
        (e = e.sibling));
  }
  function Qr(e) {
    if ((e.subtreeFlags & 18874368) !== 0)
      for (e = e.child; e !== null; ) {
        if (
          (e.tag !== 22 || e.memoizedState === null) &&
          (Qr(e),
          e.tag === 30 && (e.flags & 18874368) !== 0 && e.stateNode.paired)
        ) {
          var t = e.memoizedProps;
          if (t.name == null || t.name === "auto") throw Error(f(544));
          var a = t.name;
          ((t = _l(t.default, t.share)),
            t !== "none" && (li(e, a, t, null, !1) || yl(e.child, !1)));
        }
        e = e.sibling;
      }
  }
  function Ws(e, t) {
    if (e.tag === 30) {
      var a = e.stateNode,
        l = e.memoizedProps,
        n = Rl(l, a),
        u = _l(l.default, a.paired ? l.share : l.enter);
      u !== "none"
        ? li(e, n, u, null, !1)
          ? (Qr(e), a.paired || t || fi(e, l.onEnter))
          : yl(e.child, !1)
        : Qr(e);
    } else if ((e.subtreeFlags & 33554432) !== 0)
      for (e = e.child; e !== null; ) (Ws(e, t), (e = e.sibling));
    else Qr(e);
  }
  function Ps(e) {
    if (za !== null && za.size !== 0) {
      var t = za;
      if ((e.subtreeFlags & 18874368) !== 0)
        for (e = e.child; e !== null; ) {
          if (e.tag !== 22 || e.memoizedState === null) {
            if (e.tag === 30 && (e.flags & 18874368) !== 0) {
              var a = e.memoizedProps,
                l = a.name;
              if (l != null && l !== "auto") {
                var n = t.get(l);
                if (n !== void 0) {
                  var u = _l(a.default, a.share);
                  if (
                    (u !== "none" &&
                      (li(e, l, u, null, !1)
                        ? ((u = e.stateNode),
                          (n.paired = u),
                          (u.paired = n),
                          fi(e, a.onShare))
                        : yl(e.child, !1)),
                    t.delete(l),
                    t.size === 0)
                  )
                    break;
                }
              }
            }
            Ps(e);
          }
          e = e.sibling;
        }
    }
  }
  function ef(e) {
    if (e.tag === 30) {
      var t = e.memoizedProps,
        a = Rl(t, e.stateNode),
        l = za !== null ? za.get(a) : void 0,
        n = _l(t.default, l !== void 0 ? t.share : t.exit);
      (n !== "none" &&
        (li(e, a, n, null, !1)
          ? l !== void 0
            ? ((n = e.stateNode),
              (l.paired = n),
              (n.paired = l),
              za.delete(a),
              fi(e, t.onShare))
            : fi(e, t.onExit)
          : yl(e.child, !1)),
        za !== null && Ps(e));
    } else if ((e.subtreeFlags & 33554432) !== 0)
      for (e = e.child; e !== null; ) (ef(e), (e = e.sibling));
    else za !== null && Ps(e);
  }
  function b0(e) {
    for (e = e.child; e !== null; ) {
      if (e.tag === 30) {
        var t = e.memoizedProps,
          a = Rl(t, e.stateNode);
        ((t = _l(t.default, t.update)),
          (e.flags &= -5),
          t !== "none" && li(e, a, t, (e.memoizedState = []), !1));
      } else (e.subtreeFlags & 33554432) !== 0 && b0(e);
      e = e.sibling;
    }
  }
  function tf(e) {
    if ((e.subtreeFlags & 18874368) !== 0)
      for (e = e.child; e !== null; ) {
        if (e.tag !== 22 || e.memoizedState === null) {
          if (e.tag === 30 && (e.flags & 18874368) !== 0) {
            var t = e.stateNode;
            t.paired !== null && ((t.paired = null), yl(e.child, !1));
          }
          tf(e);
        }
        e = e.sibling;
      }
  }
  function Zr(e) {
    if (e.tag === 30) ((e.stateNode.paired = null), yl(e.child, !1), tf(e));
    else if ((e.subtreeFlags & 33554432) !== 0)
      for (e = e.child; e !== null; ) (Zr(e), (e = e.sibling));
    else tf(e);
  }
  function S0(e) {
    for (e = e.child; e !== null; )
      (e.tag === 30
        ? yl(e.child, !1)
        : (e.subtreeFlags & 33554432) !== 0 && S0(e),
        (e = e.sibling));
  }
  function af(e, t, a, l, n, u, c) {
    for (var m = !1; t !== null; ) {
      if (t.tag === 5) {
        var E = t.stateNode;
        if (u !== null && ha < u.length) {
          var A = u[ha],
            _ = Hf(E);
          (A.view || _.view) && (m = !0);
          var G;
          if ((G = (e.flags & 4) === 0))
            if (_.clip) G = !0;
            else {
              G = A.rect;
              var C = _.rect;
              G =
                G.y !== C.y ||
                G.x !== C.x ||
                G.height !== C.height ||
                G.width !== C.width;
            }
          (G && (e.flags |= 4),
            _.abs
              ? (_ = !A.abs)
              : ((A = A.rect),
                (_ = _.rect),
                (_ = A.height !== _.height || A.width !== _.width)),
            _ && (e.flags |= 32));
        } else e.flags |= 32;
        ((e.flags & 4) !== 0 && gh(E, ha === 0 ? a : a + "_" + ha, n),
          (m && (e.flags & 4) !== 0) ||
            (hl === null && (hl = []),
            hl.push(E, ha === 0 ? l : l + "_" + ha, t.memoizedProps)),
          ha++);
      } else
        (t.tag !== 22 || t.memoizedState === null) &&
          (t.tag === 30 && c
            ? (e.flags |= t.flags & 32)
            : af(e, t.child, a, l, n, u, c) && (m = !0));
      t = t.sibling;
    }
    return m;
  }
  function z0(e, t) {
    for (e = e.child; e !== null; ) {
      if (e.tag === 30) {
        var a = e.memoizedProps,
          l = e.stateNode,
          n = Rl(a, l),
          u = _l(a.default, a.update),
          c;
        ((c = e.memoizedState), (e.memoizedState = null), (l = e));
        var m = e.child;
        ((ha = 0),
          (n = af(l, m, n, n, u, c, !1)),
          (e.flags & 4) !== 0 && n && fi(e, a.onUpdate));
      } else (e.subtreeFlags & 33554432) !== 0 && z0(e);
      e = e.sibling;
    }
  }
  var jt = !1,
    Je = !1,
    vl = !1,
    lf = !1,
    T0 = typeof WeakSet == "function" ? WeakSet : Set,
    qt = null,
    pl = !1,
    vc = !1,
    Kr = !1,
    nf = !1;
  function yy(e, t, a) {
    if (((e = e.containerInfo), (Of = Si), (e = sl(e)), In(e))) {
      if ("selectionStart" in e)
        var l = { start: e.selectionStart, end: e.selectionEnd };
      else
        e: {
          l = ((l = e.ownerDocument) && l.defaultView) || window;
          var n = l.getSelection && l.getSelection();
          if (n && n.rangeCount !== 0) {
            l = n.anchorNode;
            var u = n.anchorOffset,
              c = n.focusNode;
            n = n.focusOffset;
            try {
              (l.nodeType, c.nodeType);
            } catch {
              l = null;
              break e;
            }
            var m = 0,
              E = -1,
              A = -1,
              _ = 0,
              G = 0,
              C = e,
              D = null;
            t: for (;;) {
              for (
                var I;
                C !== l || (u !== 0 && C.nodeType !== 3) || (E = m + u),
                  C !== c || (n !== 0 && C.nodeType !== 3) || (A = m + n),
                  C.nodeType === 3 && (m += C.nodeValue.length),
                  (I = C.firstChild) !== null;

              )
                ((D = C), (C = I));
              for (;;) {
                if (C === e) break t;
                if (
                  (D === l && ++_ === u && (E = m),
                  D === c && ++G === n && (A = m),
                  (I = C.nextSibling) !== null)
                )
                  break;
                ((C = D), (D = C.parentNode));
              }
              C = I;
            }
            l = E === -1 || A === -1 ? null : { start: E, end: A };
          } else l = null;
        }
      l = l || { start: 0, end: 0 };
    } else l = null;
    for (
      Df = { focusedElem: e, selectionRange: l },
        Si = !1,
        a = (a & 335544064) === a,
        qt = t,
        t = a ? 9270 : 1024;
      qt !== null;

    ) {
      if (((e = qt), a && ((l = e.deletions), l !== null)))
        for (u = 0; u < l.length; u++) a && ef(l[u]);
      if (e.alternate === null && (e.flags & 2) !== 0) (a && p0(e), Jr(a));
      else {
        if (e.tag === 22) {
          if (((l = e.alternate), e.memoizedState !== null)) {
            (l !== null && l.memoizedState === null && a && ef(l), Jr(a));
            continue;
          } else if (l !== null && l.memoizedState !== null) {
            (a && p0(e), Jr(a));
            continue;
          }
        }
        ((l = e.child),
          (e.subtreeFlags & t) !== 0 && l !== null
            ? ((l.return = e), (qt = l))
            : (a && b0(e), Jr(a)));
      }
    }
    za = null;
  }
  function Jr(e) {
    for (; qt !== null; ) {
      var t = qt,
        a = e,
        l = t.alternate,
        n = t.flags;
      switch (t.tag) {
        case 0:
        case 11:
        case 15:
          break;
        case 1:
          if ((n & 1024) !== 0 && l !== null) {
            ((a = void 0), (n = l.memoizedProps), (l = l.memoizedState));
            var u = t.stateNode;
            try {
              var c = mu(t.type, n);
              ((a = u.getSnapshotBeforeUpdate(c, l)),
                (u.__reactInternalSnapshotBeforeUpdate = a));
            } catch (m) {
              We(t, t.return, m);
            }
          }
          break;
        case 3:
          if ((n & 1024) !== 0) {
            if (((l = t.stateNode.containerInfo), (a = l.nodeType), a === 9))
              qf(l);
            else if (a === 1)
              switch (l.nodeName) {
                case "HEAD":
                case "HTML":
                case "BODY":
                  qf(l);
                  break;
                default:
                  l.textContent = "";
              }
          }
          break;
        case 5:
        case 26:
        case 27:
        case 6:
        case 4:
        case 17:
          break;
        case 30:
          a &&
            l !== null &&
            ((a = Rl(l.memoizedProps, l.stateNode)),
            (n = t.memoizedProps),
            (n = _l(n.default, n.update)),
            n !== "none" && li(l, a, n, (l.memoizedState = []), !0));
          break;
        default:
          if ((n & 1024) !== 0) throw Error(f(163));
      }
      if (((l = t.sibling), l !== null)) {
        ((l.return = t.return), (qt = l));
        break;
      }
      qt = t.return;
    }
  }
  function N0(e, t, a) {
    var l = a.flags;
    switch (a.tag) {
      case 0:
      case 11:
      case 15:
        (gl(e, a), l & 4 && hc(5, a));
        break;
      case 1:
        if ((gl(e, a), l & 4))
          if (((e = a.stateNode), t === null))
            try {
              e.componentDidMount();
            } catch (c) {
              We(a, a.return, c);
            }
          else {
            var n = mu(a.type, t.memoizedProps);
            t = t.memoizedState;
            try {
              e.componentDidUpdate(n, t, e.__reactInternalSnapshotBeforeUpdate);
            } catch (c) {
              We(a, a.return, c);
            }
          }
        (l & 64 && m0(a), l & 512 && dl(a, a.return));
        break;
      case 3:
        if ((gl(e, a), l & 64 && ((e = a.updateQueue), e !== null))) {
          if (((t = null), a.child !== null))
            switch (a.child.tag) {
              case 27:
              case 5:
                t = a.child.stateNode;
                break;
              case 1:
                t = a.child.stateNode;
            }
          try {
            td(e, t);
          } catch (c) {
            We(a, a.return, c);
          }
        }
        break;
      case 27:
        t === null && l & 4 && v0(a);
      case 26:
      case 5:
        (gl(e, a), t === null && l & 4 && Js(a), l & 512 && dl(a, a.return));
        break;
      case 12:
        gl(e, a);
        break;
      case 31:
        (gl(e, a), l & 4 && A0(e, a));
        break;
      case 13:
        (gl(e, a),
          l & 4 && w0(e, a),
          l & 64 &&
            ((e = a.memoizedState),
            e !== null &&
              ((e = e.dehydrated),
              e !== null && ((a = xy.bind(null, a)), rv(e, a)))));
        break;
      case 22:
        if (((l = a.memoizedState !== null || jt), !l)) {
          var u = (t !== null && t.memoizedState !== null) || Je;
          ((t = jt),
            (n = Je),
            (jt = l),
            (Je = u) && !n
              ? ((l = 2),
                (a.subtreeFlags & 8772) !== 0 && (l |= 1),
                el(e, a, l))
              : gl(e, a),
            (jt = t),
            (Je = n));
        }
        break;
      case 30:
        (gl(e, a), l & 512 && dl(a, a.return));
        break;
      case 7:
        l & 512 && dl(a, a.return);
      default:
        gl(e, a);
    }
  }
  function uf(e, t) {
    for (e = e.child; e !== null; ) (M0(e, t), (e = e.sibling));
  }
  function M0(e, t) {
    switch (e.tag) {
      case 5:
      case 26:
        try {
          var a = e.stateNode;
          if (t) {
            var l = a.style;
            typeof l.setProperty == "function"
              ? l.setProperty("display", "none", "important")
              : (l.display = "none");
          } else {
            var n = e.stateNode,
              u = e.memoizedProps.style,
              c = u != null && u.hasOwnProperty("display") ? u.display : null;
            n.style.display =
              c == null || typeof c == "boolean" ? "" : ("" + c).trim();
          }
        } catch (E) {
          We(e, e.return, E);
        }
        cf(e, t);
        break;
      case 6:
        try {
          ((e.stateNode.nodeValue = t ? "" : e.memoizedProps), (Le = !0));
        } catch (E) {
          We(e, e.return, E);
        }
        break;
      case 18:
        try {
          var m = e.stateNode;
          t ? ph(m, !0) : ph(e.stateNode, !1);
        } catch (E) {
          We(e, e.return, E);
        }
        break;
      case 22:
      case 23:
        e.memoizedState === null && uf(e, t);
        break;
      default:
        uf(e, t);
    }
  }
  function cf(e, t) {
    if (e.subtreeFlags & 67108864)
      for (e = e.child; e !== null; ) {
        e: {
          var a = e,
            l = t;
          switch (a.tag) {
            case 4:
              M0(a, l);
              break e;
            case 22:
              a.memoizedState === null && cf(a, l);
              break e;
            default:
              cf(a, l);
          }
        }
        e = e.sibling;
      }
  }
  function C0(e) {
    var t = e.alternate;
    (t !== null && ((e.alternate = null), C0(t)),
      (e.child = null),
      (e.deletions = null),
      (e.sibling = null),
      e.tag === 5 && ((t = e.stateNode), t !== null && Nl(t)),
      (e.stateNode = null),
      (e.return = null),
      (e.dependencies = null),
      (e.memoizedProps = null),
      (e.memoizedState = null),
      (e.pendingProps = null),
      (e.stateNode = null),
      (e.updateQueue = null));
  }
  var st = null,
    ya = !1;
  function Wa(e, t, a) {
    for (a = a.child; a !== null; ) (x0(e, t, a), (a = a.sibling));
  }
  function x0(e, t, a) {
    if (Tt && typeof Tt.onCommitFiberUnmount == "function")
      try {
        Tt.onCommitFiberUnmount(Za, a);
      } catch {}
    switch (a.tag) {
      case 26:
        (Je || Qt(a, t),
          Wa(e, t, a),
          a.memoizedState
            ? a.memoizedState.count--
            : a.stateNode &&
              !Je &&
              ((a = a.stateNode), a.parentNode.removeChild(a)));
        break;
      case 27:
        (Je || Qt(a, t), yc(a));
        var l = st,
          n = ya;
        (wn(a.type) && ((st = a.stateNode), (ya = !1)),
          Wa(e, t, a),
          Dh(a.stateNode, a.type, a.memoizedProps),
          (st = l),
          (ya = n));
        break;
      case 5:
        (Je || Qt(a, t), yc(a));
      case 6:
        if (
          (a.tag === 6 && yc(a),
          (l = st),
          (n = ya),
          (st = null),
          Wa(e, t, a),
          (st = l),
          (ya = n),
          st !== null)
        )
          if (ya)
            try {
              ((st.nodeType === 9
                ? st.body
                : st.nodeName === "HTML"
                  ? st.ownerDocument.body
                  : st
              ).removeChild(a.stateNode),
                (Le = !0));
            } catch (u) {
              We(a, t, u);
            }
          else
            try {
              (st.removeChild(a.stateNode), (Le = !0));
            } catch (u) {
              We(a, t, u);
            }
        break;
      case 18:
        st !== null &&
          (ya
            ? ((e = st),
              vh(
                e.nodeType === 9
                  ? e.body
                  : e.nodeName === "HTML"
                    ? e.ownerDocument.body
                    : e,
                a.stateNode,
              ),
              zi(e))
            : vh(st, a.stateNode));
        break;
      case 4:
        ((l = st),
          (n = ya),
          (st = a.stateNode.containerInfo),
          (ya = !0),
          Wa(e, t, a),
          (st = l),
          (ya = n));
        break;
      case 0:
      case 11:
      case 14:
      case 15:
        (zn(2, a, t), Je || zn(4, a, t), Wa(e, t, a));
        break;
      case 1:
        (Je ||
          (Qt(a, t),
          (l = a.stateNode),
          typeof l.componentWillUnmount == "function" && d0(a, t, l)),
          Wa(e, t, a));
        break;
      case 21:
        Wa(e, t, a);
        break;
      case 22:
        ((Je = (l = Je) || a.memoizedState !== null), Wa(e, t, a), (Je = l));
        break;
      case 30:
        (Qt(a, t), Wa(e, t, a));
        break;
      case 7:
        (Je || Qt(a, t), Wa(e, t, a));
        break;
      default:
        Wa(e, t, a);
    }
  }
  function A0(e, t) {
    if (
      t.memoizedState === null &&
      ((e = t.alternate), e !== null && ((e = e.memoizedState), e !== null))
    ) {
      e = e.dehydrated;
      try {
        zi(e);
      } catch (a) {
        We(t, t.return, a);
      }
    }
  }
  function w0(e, t) {
    if (
      t.memoizedState === null &&
      ((e = t.alternate),
      e !== null &&
        ((e = e.memoizedState), e !== null && ((e = e.dehydrated), e !== null)))
    )
      try {
        zi(e);
      } catch (a) {
        We(t, t.return, a);
      }
  }
  function vy(e) {
    switch (e.tag) {
      case 31:
      case 13:
      case 19:
        var t = e.stateNode;
        return (t === null && (t = e.stateNode = new T0()), t);
      case 22:
        return (
          (e = e.stateNode),
          (t = e._retryCache),
          t === null && (t = e._retryCache = new T0()),
          t
        );
      default:
        throw Error(f(435, e.tag));
    }
  }
  function Fr(e, t) {
    var a = vy(e);
    t.forEach(function (l) {
      if (!a.has(l)) {
        a.add(l);
        var n = Ay.bind(null, e, l);
        l.then(n, n);
      }
    });
  }
  function na(e, t, a) {
    var l = t.deletions;
    if (l !== null)
      for (var n = 0; n < l.length; n++) {
        var u = l[n],
          c = e,
          m = t,
          E = m;
        e: for (; E !== null; ) {
          switch (E.tag) {
            case 27:
              if (wn(E.type)) {
                ((st = E.stateNode), (ya = !1));
                break e;
              }
              break;
            case 5:
              ((st = E.stateNode), (ya = !1));
              break e;
            case 3:
            case 4:
              ((st = E.stateNode.containerInfo), (ya = !0));
              break e;
          }
          E = E.return;
        }
        if (st === null) throw Error(f(160));
        (x0(c, m, u),
          (st = null),
          (ya = !1),
          (c = u.alternate),
          c !== null && (c.return = null),
          (u.return = null));
      }
    if (t.subtreeFlags & 13886)
      for (t = t.child; t !== null; ) (O0(t, e, a), (t = t.sibling));
  }
  var Pa = null;
  function O0(e, t, a) {
    var l = e.alternate,
      n = e.flags;
    switch (e.tag) {
      case 0:
      case 11:
      case 14:
      case 15:
        if (
          n & 4 &&
          ((l = e.updateQueue), (l = l !== null ? l.events : null), l !== null)
        )
          for (var u = 0; u < l.length; u++) {
            var c = l[u];
            c.ref.impl = c.nextImpl;
          }
        (na(t, e, a),
          ua(e),
          n & 4 && (zn(3, e, e.return), hc(3, e), zn(5, e, e.return)));
        break;
      case 1:
        (na(t, e, a),
          ua(e),
          n & 512 && (Je || l === null || Qt(l, l.return)),
          n & 64 &&
            jt &&
            ((e = e.updateQueue),
            e !== null &&
              ((t = e.callbacks),
              t !== null &&
                ((a = e.shared.hiddenCallbacks),
                (e.shared.hiddenCallbacks = a === null ? t : a.concat(t))))));
        break;
      case 26:
        if (
          ((u = Pa),
          na(t, e, a),
          ua(e),
          n & 512 && (Je || l === null || Qt(l, l.return)),
          n & 4)
        )
          if (
            ((n = l !== null ? l.memoizedState : null),
            (a = e.memoizedState),
            l === null)
          )
            if (a === null)
              if (e.stateNode === null)
                if (jt)
                  e.stateNode = dh(e.type, e.memoizedProps, t.containerInfo, e);
                else {
                  e: {
                    ((t = e.type),
                      (a = e.memoizedProps),
                      (n = u.ownerDocument || u));
                    t: switch (t) {
                      case "title":
                        ((l = n.getElementsByTagName("title")[0]),
                          (!l ||
                            l[ul] ||
                            l[Et] ||
                            l.namespaceURI === "http://www.w3.org/2000/svg" ||
                            l.hasAttribute("itemprop")) &&
                            ((l = n.createElement(t)),
                            n.head.insertBefore(
                              l,
                              n.querySelector("head > title"),
                            )),
                          Zt(l, t, a),
                          (l[Et] = e),
                          yt(l),
                          (t = l));
                        break e;
                      case "link":
                        if (
                          (u = jh("link", "href", n).get(t + (a.href || "")))
                        ) {
                          for (c = 0; c < u.length; c++)
                            if (
                              ((l = u[c]),
                              l.getAttribute("href") ===
                                (a.href == null || a.href === ""
                                  ? null
                                  : a.href) &&
                                l.getAttribute("rel") ===
                                  (a.rel == null ? null : a.rel) &&
                                l.getAttribute("title") ===
                                  (a.title == null ? null : a.title) &&
                                l.getAttribute("crossorigin") ===
                                  (a.crossOrigin == null
                                    ? null
                                    : a.crossOrigin))
                            ) {
                              u.splice(c, 1);
                              break t;
                            }
                        }
                        ((l = n.createElement(t)),
                          Zt(l, t, a),
                          n.head.appendChild(l));
                        break;
                      case "meta":
                        if (
                          (u = jh("meta", "content", n).get(
                            t + (a.content || ""),
                          ))
                        ) {
                          for (c = 0; c < u.length; c++)
                            if (
                              ((l = u[c]),
                              l.getAttribute("content") ===
                                (a.content == null ? null : "" + a.content) &&
                                l.getAttribute("name") ===
                                  (a.name == null ? null : a.name) &&
                                l.getAttribute("property") ===
                                  (a.property == null ? null : a.property) &&
                                l.getAttribute("http-equiv") ===
                                  (a.httpEquiv == null ? null : a.httpEquiv) &&
                                l.getAttribute("charset") ===
                                  (a.charSet == null ? null : a.charSet))
                            ) {
                              u.splice(c, 1);
                              break t;
                            }
                        }
                        ((l = n.createElement(t)),
                          Zt(l, t, a),
                          n.head.appendChild(l));
                        break;
                      default:
                        throw Error(f(468, t));
                    }
                    ((l[Et] = e), yt(l), (t = l));
                  }
                  e.stateNode = t;
                }
              else jt || Qf(u, e.type, e.stateNode);
            else e.stateNode = Bh(u, a, e.memoizedProps);
          else
            n !== a
              ? (n === null
                  ? ((t = l.stateNode),
                    t === null || Je || t.parentNode.removeChild(t))
                  : n.count--,
                a === null
                  ? jt || Qf(u, e.type, e.stateNode)
                  : Bh(u, a, e.memoizedProps))
              : a === null &&
                e.stateNode !== null &&
                Fs(e, e.memoizedProps, l.memoizedProps);
        break;
      case 27:
        (na(t, e, a),
          ua(e),
          n & 512 && (Je || l === null || Qt(l, l.return)),
          l !== null && n & 4 && Fs(e, e.memoizedProps, l.memoizedProps));
        break;
      case 5:
        if (
          ((u = vl),
          (vl = !1),
          na(t, e, a),
          (vl = u),
          ua(e),
          n & 512 && (Je || l === null || Qt(l, l.return)),
          e.flags & 32)
        ) {
          t = e.stateNode;
          try {
            (Al(t, ""), (Le = !0));
          } catch (_) {
            We(e, e.return, _);
          }
        }
        (n & 4 &&
          e.stateNode != null &&
          ((t = e.memoizedProps), Fs(e, t, l !== null ? l.memoizedProps : t)),
          n & 1024 && (lf = !0));
        break;
      case 6:
        if ((na(t, e, a), ua(e), n & 4)) {
          if (e.stateNode === null) throw Error(f(162));
          ((t = e.memoizedProps), (a = e.stateNode));
          try {
            ((a.nodeValue = t), (Le = !0));
          } catch (_) {
            We(e, e.return, _);
          }
        }
        break;
      case 3:
        if (
          ((Le = !1),
          (so = null),
          (u = Pa),
          (Pa = Mc(t.containerInfo)),
          na(t, e, a),
          (Pa = u),
          ua(e),
          n & 4 && l !== null && l.memoizedState.isDehydrated)
        )
          try {
            zi(t.containerInfo);
          } catch (_) {
            We(e, e.return, _);
          }
        (lf && ((lf = !1), D0(e)), (Le = !1));
        break;
      case 4:
        ((n = vl),
          (vl = jt),
          (l = Qc()),
          (u = Pa),
          (Pa = Mc(e.stateNode.containerInfo)),
          na(t, e, a),
          ua(e),
          (Pa = u),
          Le && vc && (Kr = !0),
          (Le = l),
          (vl = n));
        break;
      case 12:
        (na(t, e, a), ua(e));
        break;
      case 31:
        (na(t, e, a),
          ua(e),
          n & 4 &&
            ((t = e.updateQueue),
            t !== null && ((e.updateQueue = null), Fr(e, t))));
        break;
      case 13:
        (na(t, e, a),
          ua(e),
          e.child.flags & 8192 &&
            (e.memoizedState !== null) !=
              (l !== null && l.memoizedState !== null) &&
            (Wr = ea()),
          n & 4 &&
            ((t = e.updateQueue),
            t !== null && ((e.updateQueue = null), Fr(e, t))));
        break;
      case 22:
        ((u = e.memoizedState !== null),
          (c = l !== null && l.memoizedState !== null));
        var m = jt,
          E = Je,
          A = vl;
        ((jt = m || u),
          (vl = A || u),
          (Je = E || c),
          na(t, e, a),
          (Je = E),
          (vl = A),
          (jt = m),
          ua(e),
          n & 8192 &&
            ((t = e.stateNode),
            (t._visibility = u ? t._visibility & -2 : t._visibility | 1),
            !u ||
              l === null ||
              c ||
              jt ||
              Je ||
              ((t = c || Je),
              (a = jt),
              (l = Je),
              (jt = u || jt),
              (Je = t),
              Tn(e, 2),
              (jt = a),
              (Je = l)),
            (!u && vl) || uf(e, u)),
          n & 4 &&
            ((t = e.updateQueue),
            t !== null &&
              ((a = t.retryQueue),
              a !== null && ((t.retryQueue = null), Fr(e, a)))));
        break;
      case 19:
        (na(t, e, a),
          ua(e),
          n & 4 &&
            ((t = e.updateQueue),
            t !== null && ((e.updateQueue = null), Fr(e, t))));
        break;
      case 30:
        (n & 512 && (Je || l === null || Qt(l, l.return)),
          (n = Qc()),
          (u = vc),
          (c = (a & 335544064) === a),
          (m = e.memoizedProps),
          (vc = c && _l(m.default, m.update) !== "none"),
          na(t, e, a),
          ua(e),
          c && l !== null && Le && (e.flags |= 4),
          (vc = u),
          (Le = n));
        break;
      case 21:
        break;
      case 7:
        (n & 512 && (Je || l === null || Qt(l, l.return)),
          l && l.stateNode !== null && (l.stateNode._fragmentFiber = e));
      default:
        (na(t, e, a), ua(e));
    }
  }
  function ua(e) {
    var t = e.flags;
    if (t & 2) {
      try {
        for (var a, l = e.return; l !== null; ) {
          if (y0(l)) {
            a = l;
            break;
          }
          l = l.return;
        }
        l = null;
        for (var n = e.return; n !== null; ) {
          if (Ks(n)) {
            var u = n.stateNode;
            l === null ? (l = [u]) : l.push(u);
          }
          if (Zs(n)) break;
          n = n.return;
        }
        var c = l;
        if (a == null) throw Error(f(160));
        switch (a.tag) {
          case 27:
            var m = a.stateNode,
              E = $s(e);
            kr(e, E, m, c);
            break;
          case 5:
            var A = a.stateNode;
            a.flags & 32 && (Al(A, ""), (a.flags &= -33));
            var _ = $s(e);
            kr(e, _, A, c);
            break;
          case 3:
          case 4:
            var G = a.stateNode.containerInfo,
              C = $s(e);
            Is(e, C, G, c);
            break;
          default:
            throw Error(f(161));
        }
      } catch (D) {
        We(e, e.return, D);
      }
      e.flags &= -3;
    }
    t & 4096 && (e.flags &= -4097);
  }
  function D0(e) {
    if (e.subtreeFlags & 1024)
      for (e = e.child; e !== null; ) {
        var t = e;
        (D0(t),
          t.tag === 5 &&
            t.flags & 1024 &&
            ((t = t.stateNode), (Si = !0), t.reset(), (Si = !1)),
          (e = e.sibling));
      }
  }
  function ni(e, t) {
    if (t.subtreeFlags & 9270)
      for (t = t.child; t !== null; ) (R0(t, e), (t = t.sibling));
    else z0(t);
  }
  function R0(e, t) {
    var a = e.alternate;
    if (a === null) Ws(e, !1);
    else
      switch (e.tag) {
        case 3:
          if (((nf = pl = !1), g0(), ni(t, e), !pl && !Kr)) {
            if (((e = hl), e !== null))
              for (var l = 0; l < e.length; l += 3) {
                a = e[l];
                var n = e[l + 1];
                (Eh(a, e[l + 2]),
                  (a = a.ownerDocument.documentElement),
                  a !== null &&
                    a.animate(
                      { opacity: [0, 0], pointerEvents: ["none", "none"] },
                      {
                        duration: 0,
                        fill: "forwards",
                        pseudoElement: "::view-transition-group(" + n + ")",
                      },
                    ));
              }
            ((e = t.containerInfo),
              (e =
                e.nodeType === 9
                  ? e.documentElement
                  : e.ownerDocument.documentElement),
              e !== null &&
                e.style.viewTransitionName === "" &&
                ((e.style.viewTransitionName = "none"),
                e.animate(
                  { opacity: [0, 0], pointerEvents: ["none", "none"] },
                  {
                    duration: 0,
                    fill: "forwards",
                    pseudoElement: "::view-transition-group(root)",
                  },
                ),
                e.animate(
                  { width: [0, 0], height: [0, 0] },
                  {
                    duration: 0,
                    fill: "forwards",
                    pseudoElement: "::view-transition",
                  },
                )),
              (nf = !0));
          }
          hl = null;
          break;
        case 5:
          ni(t, e);
          break;
        case 4:
          ((l = pl), (pl = !1), ni(t, e), pl && (Kr = !0), (pl = l));
          break;
        case 22:
          e.memoizedState === null &&
            (a.memoizedState !== null ? Ws(e, !1) : ni(t, e));
          break;
        case 30:
          ((l = pl), (n = g0()), (pl = !1), ni(t, e), pl && (e.flags |= 4));
          var u = e.memoizedProps,
            c = e.stateNode;
          ((t = Rl(u, c)), (c = Rl(a.memoizedProps, c)));
          var m = _l(u.default, u.update);
          (m === "none"
            ? (t = !1)
            : ((u = a.memoizedState),
              (a.memoizedState = null),
              (a = e.child),
              (ha = 0),
              (t = af(e, a, t, c, m, u, !0)),
              ha !== (u === null ? 0 : u.length) && (e.flags |= 32)),
            (e.flags & 4) !== 0 && t
              ? (fi(e, e.memoizedProps.onUpdate), (hl = n))
              : n !== null && (n.push.apply(n, hl), (hl = n)),
            (pl = (e.flags & 32) !== 0 ? !0 : l));
          break;
        default:
          ni(t, e);
      }
  }
  function gl(e, t) {
    if (t.subtreeFlags & 8772)
      for (t = t.child; t !== null; ) (N0(e, t.alternate, t), (t = t.sibling));
  }
  function Tn(e, t) {
    for (e = e.child; e !== null; ) {
      var a = e,
        l = t;
      switch (a.tag) {
        case 0:
        case 11:
        case 14:
        case 15:
          (zn(4, a, a.return), Tn(a, l));
          break;
        case 1:
          Qt(a, a.return);
          var n = a.stateNode;
          (typeof n.componentWillUnmount == "function" && d0(a, a.return, n),
            Tn(a, l));
          break;
        case 27:
          (l & 2) !== 0 && Dh(a.stateNode, a.type, a.memoizedProps);
        case 5:
          (Qt(a, a.return), (a.tag !== 5 && a.tag !== 27) || yc(a), Tn(a, l));
          break;
        case 6:
          yc(a);
          break;
        case 26:
          (Qt(a, a.return),
            (n = a.stateNode),
            a.memoizedState !== null ||
              n === null ||
              Je ||
              n.parentNode.removeChild(n),
            Tn(a, l));
          break;
        case 22:
          a.memoizedState === null && Tn(a, l);
          break;
        case 30:
          (Qt(a, a.return), Tn(a, l));
          break;
        case 7:
          Qt(a, a.return);
        default:
          Tn(a, l);
      }
      e = e.sibling;
    }
  }
  function el(e, t, a) {
    for (
      a = (t.subtreeFlags & 8772) !== 0 ? a : a & -2, t = t.child;
      t !== null;

    ) {
      var l = t.alternate,
        n = e,
        u = t,
        c = u.flags,
        m = (a & 1) !== 0;
      switch (u.tag) {
        case 0:
        case 11:
        case 15:
          (el(n, u, a), hc(4, u));
          break;
        case 1:
          if (
            (el(n, u, a),
            (l = u),
            (n = l.stateNode),
            typeof n.componentDidMount == "function")
          )
            try {
              n.componentDidMount();
            } catch (_) {
              We(l, l.return, _);
            }
          if (((l = u), (n = l.updateQueue), n !== null)) {
            var E = l.stateNode;
            try {
              var A = n.shared.hiddenCallbacks;
              if (A !== null)
                for (n.shared.hiddenCallbacks = null, n = 0; n < A.length; n++)
                  ed(A[n], E);
            } catch (_) {
              We(l, l.return, _);
            }
          }
          (m && c & 64 && m0(u), dl(u, u.return));
          break;
        case 27:
          (a & 2) !== 0 && v0(u);
        case 5:
          ((u.tag !== 5 && u.tag !== 27) || h0(u),
            el(n, u, a),
            m && l === null && c & 4 && Js(u),
            dl(u, u.return));
          break;
        case 6:
          h0(u);
          break;
        case 26:
          ((E = u.stateNode),
            u.memoizedState !== null ||
              E === null ||
              jt ||
              Qf(Mc(E.ownerDocument), u.type, E),
            el(n, u, a),
            m && l === null && c & 4 && Js(u),
            dl(u, u.return));
          break;
        case 12:
          el(n, u, a);
          break;
        case 31:
          (el(n, u, a), m && c & 4 && A0(n, u));
          break;
        case 13:
          (el(n, u, a), m && c & 4 && w0(n, u));
          break;
        case 22:
          (u.memoizedState === null && el(n, u, a), dl(u, u.return));
          break;
        case 30:
          (el(n, u, a), dl(u, u.return));
          break;
        case 7:
          dl(u, u.return);
        default:
          el(n, u, a);
      }
      t = t.sibling;
    }
  }
  function rf(e, t) {
    var a = null;
    (e !== null &&
      e.memoizedState !== null &&
      e.memoizedState.cachePool !== null &&
      (a = e.memoizedState.cachePool.pool),
      (e = null),
      t.memoizedState !== null &&
        t.memoizedState.cachePool !== null &&
        (e = t.memoizedState.cachePool.pool),
      e !== a && (e != null && e.refCount++, a != null && tc(a)));
  }
  function of(e, t) {
    ((e = null),
      t.alternate !== null && (e = t.alternate.memoizedState.cache),
      (t = t.memoizedState.cache),
      t !== e && (t.refCount++, e != null && tc(e)));
  }
  function La(e, t, a, l) {
    var n = (a & 335544064) === a;
    if (t.subtreeFlags & (n ? 10262 : 10256))
      for (t = t.child; t !== null; ) (_0(e, t, a, l), (t = t.sibling));
    else n && S0(t);
  }
  function _0(e, t, a, l) {
    var n = (a & 335544064) === a;
    n &&
      t.alternate === null &&
      t.return !== null &&
      t.return.alternate !== null &&
      Zr(t);
    var u = t.flags;
    switch (t.tag) {
      case 0:
      case 11:
      case 15:
        (La(e, t, a, l), u & 2048 && hc(9, t));
        break;
      case 1:
        La(e, t, a, l);
        break;
      case 3:
        (La(e, t, a, l),
          n &&
            nf &&
            ((e = e.containerInfo),
            (e =
              e.nodeType === 9
                ? e.body
                : e.nodeName === "HTML"
                  ? e.ownerDocument.body
                  : e),
            e.style.viewTransitionName === "root" &&
              (e.style.viewTransitionName = ""),
            (e = e.ownerDocument.documentElement),
            e !== null &&
              e.style.viewTransitionName === "none" &&
              (e.style.viewTransitionName = "")),
          u & 2048 &&
            ((u = null),
            t.alternate !== null && (u = t.alternate.memoizedState.cache),
            (t = t.memoizedState.cache),
            t !== u && (t.refCount++, u != null && tc(u))));
        break;
      case 12:
        if (u & 2048) {
          (La(e, t, a, l), (u = t.stateNode));
          try {
            var c = t.memoizedProps,
              m = c.id,
              E = c.onPostCommit;
            typeof E == "function" &&
              E(
                m,
                t.alternate === null ? "mount" : "update",
                u.passiveEffectDuration,
                -0,
              );
          } catch (A) {
            We(t, t.return, A);
          }
        } else La(e, t, a, l);
        break;
      case 31:
        La(e, t, a, l);
        break;
      case 13:
        La(e, t, a, l);
        break;
      case 23:
        break;
      case 22:
        ((c = t.stateNode),
          (m = t.alternate),
          t.memoizedState !== null
            ? (n && m !== null && m.memoizedState === null && Zr(m),
              c._visibility & 2 ? La(e, t, a, l) : pc(e, t))
            : (n && m !== null && m.memoizedState !== null && Zr(t),
              c._visibility & 2
                ? La(e, t, a, l)
                : ((c._visibility |= 2),
                  ui(e, t, a, l, (t.subtreeFlags & 10256) !== 0 || !1))),
          u & 2048 && rf(m, t));
        break;
      case 24:
        (La(e, t, a, l), u & 2048 && of(t.alternate, t));
        break;
      case 30:
        (n &&
          ((u = t.alternate), u !== null && (yl(u.child, !0), yl(t.child, !0))),
          La(e, t, a, l));
        break;
      default:
        La(e, t, a, l);
    }
  }
  function ui(e, t, a, l, n) {
    for (
      n = n && ((t.subtreeFlags & 10256) !== 0 || !1), t = t.child;
      t !== null;

    ) {
      var u = e,
        c = t,
        m = a,
        E = l,
        A = c.flags;
      switch (c.tag) {
        case 0:
        case 11:
        case 15:
          (ui(u, c, m, E, n), hc(8, c));
          break;
        case 23:
          break;
        case 22:
          var _ = c.stateNode;
          (c.memoizedState !== null
            ? _._visibility & 2
              ? ui(u, c, m, E, n)
              : pc(u, c)
            : ((_._visibility |= 2), ui(u, c, m, E, n)),
            n && A & 2048 && rf(c.alternate, c));
          break;
        case 24:
          (ui(u, c, m, E, n), n && A & 2048 && of(c.alternate, c));
          break;
        default:
          ui(u, c, m, E, n);
      }
      t = t.sibling;
    }
  }
  function pc(e, t) {
    if (t.subtreeFlags & 10256)
      for (t = t.child; t !== null; ) {
        var a = e,
          l = t,
          n = l.flags;
        switch (l.tag) {
          case 22:
            (pc(a, l), n & 2048 && rf(l.alternate, l));
            break;
          case 24:
            (pc(a, l), n & 2048 && of(l.alternate, l));
            break;
          default:
            pc(a, l);
        }
        t = t.sibling;
      }
  }
  var du = 8192;
  function hu(e, t, a) {
    if (e.subtreeFlags & du)
      for (e = e.child; e !== null; ) (U0(e, t, a), (e = e.sibling));
  }
  function U0(e, t, a) {
    switch (e.tag) {
      case 26:
        (hu(e, t, a),
          e.flags & du &&
            (e.memoizedState !== null
              ? zv(a, Pa, e.memoizedState, e.memoizedProps)
              : ((e = e.stateNode), (t & 335544128) === t && Gh(a, e))));
        break;
      case 5:
        (hu(e, t, a),
          e.flags & du &&
            ((e = e.stateNode), (t & 335544128) === t && Gh(a, e)));
        break;
      case 3:
      case 4:
        var l = Pa;
        ((Pa = Mc(e.stateNode.containerInfo)), hu(e, t, a), (Pa = l));
        break;
      case 22:
        e.memoizedState === null &&
          ((l = e.alternate),
          l !== null && l.memoizedState !== null
            ? ((l = du), (du = 16777216), hu(e, t, a), (du = l))
            : hu(e, t, a));
        break;
      case 30:
        if (
          (e.flags & du) !== 0 &&
          ((l = e.memoizedProps.name), l != null && l !== "auto")
        ) {
          var n = e.stateNode;
          ((n.paired = null), za === null && (za = new Map()), za.set(l, n));
        }
        hu(e, t, a);
        break;
      default:
        hu(e, t, a);
    }
  }
  function H0(e) {
    var t = e.alternate;
    if (t !== null && ((e = t.child), e !== null)) {
      t.child = null;
      do ((t = e.sibling), (e.sibling = null), (e = t));
      while (e !== null);
    }
  }
  function gc(e) {
    var t = e.deletions;
    if ((e.flags & 16) !== 0) {
      if (t !== null)
        for (var a = 0; a < t.length; a++) {
          var l = t[a];
          ((qt = l), j0(l, e));
        }
      H0(e);
    }
    if (e.subtreeFlags & 10256)
      for (e = e.child; e !== null; ) (B0(e), (e = e.sibling));
  }
  function B0(e) {
    switch (e.tag) {
      case 0:
      case 11:
      case 15:
        (gc(e), e.flags & 2048 && zn(9, e, e.return));
        break;
      case 3:
        gc(e);
        break;
      case 12:
        gc(e);
        break;
      case 22:
        var t = e.stateNode;
        e.memoizedState !== null &&
        t._visibility & 2 &&
        (e.return === null || e.return.tag !== 13)
          ? ((t._visibility &= -3), $r(e))
          : gc(e);
        break;
      default:
        gc(e);
    }
  }
  function $r(e) {
    var t = e.deletions;
    if ((e.flags & 16) !== 0) {
      if (t !== null)
        for (var a = 0; a < t.length; a++) {
          var l = t[a];
          ((qt = l), j0(l, e));
        }
      H0(e);
    }
    for (e = e.child; e !== null; ) {
      switch (((t = e), t.tag)) {
        case 0:
        case 11:
        case 15:
          (zn(8, t, t.return), $r(t));
          break;
        case 22:
          ((a = t.stateNode),
            a._visibility & 2 && ((a._visibility &= -3), $r(t)));
          break;
        default:
          $r(t);
      }
      e = e.sibling;
    }
  }
  function j0(e, t) {
    for (; qt !== null; ) {
      var a = qt;
      switch (a.tag) {
        case 0:
        case 11:
        case 15:
          zn(8, a, t);
          break;
        case 23:
        case 22:
          if (a.memoizedState !== null && a.memoizedState.cachePool !== null) {
            var l = a.memoizedState.cachePool.pool;
            l != null && l.refCount++;
          }
          break;
        case 24:
          tc(a.memoizedState.cache);
      }
      if (((l = a.child), l !== null)) ((l.return = a), (qt = l));
      else
        e: for (a = e; qt !== null; ) {
          l = qt;
          var n = l.sibling,
            u = l.return;
          if ((C0(l), l === a)) {
            qt = null;
            break e;
          }
          if (n !== null) {
            ((n.return = u), (qt = n));
            break e;
          }
          qt = u;
        }
    }
  }
  var py = {
      getCacheForType: function (e) {
        var t = Xt(At),
          a = t.data.get(e);
        return (a === void 0 && ((a = e()), t.data.set(e, a)), a);
      },
      cacheSignal: function () {
        return Xt(At).controller.signal;
      },
    },
    gy = typeof WeakMap == "function" ? WeakMap : Map,
    Ze = 0,
    at = null,
    Re = null,
    je = 0,
    Ie = 0,
    Ta = null,
    Nn = !1,
    ii = !1,
    sf = !1,
    Xl = 0,
    pt = 0,
    Mn = 0,
    yu = 0,
    Ir = 0,
    Na = 0,
    ci = 0,
    Ec = null,
    va = null,
    ff = !1,
    Wr = 0,
    q0 = 0,
    Pr = 1 / 0,
    eo = null,
    Cn = null,
    ht = 0,
    tl = null,
    vu = null,
    El = 0,
    mf = 0,
    df = null,
    Y0 = null,
    ri = null,
    oi = null,
    si = null,
    bc = 0,
    to = null;
  function Ma() {
    return (Ze & 2) !== 0 && je !== 0 ? je & -je : ie.T !== null ? Tf() : Hi();
  }
  function L0() {
    if (Na === 0)
      if ((je & 536870912) === 0 || Ce) {
        var e = xu;
        ((xu <<= 1), (xu & 3932160) === 0 && (xu = 262144), (Na = e));
      } else Na = 536870912;
    return ((e = kt.current), e !== null && (e.flags |= 32), Na);
  }
  function fi(e, t) {
    if (t != null) {
      var a = e.stateNode,
        l = a.ref;
      (l === null && (l = a.ref = bh(Rl(e.memoizedProps, a))),
        oi === null && (oi = []),
        oi.push(t.bind(null, l)));
    }
  }
  function pa(e, t, a) {
    (((e === at && (Ie === 2 || Ie === 9)) || e.cancelPendingCommit !== null) &&
      (mi(e, 0), xn(e, je, Na, !1)),
      nl(e, a),
      ((Ze & 2) === 0 || e !== at) &&
        (e === at &&
          ((Ze & 2) === 0 && (yu |= a), pt === 4 && xn(e, je, Na, !1)),
        bl(e)));
  }
  function G0(e, t, a) {
    if ((Ze & 6) !== 0) throw Error(f(327));
    var l = (!a && (t & 127) === 0 && (t & e.expiredLanes) === 0) || Lt(e, t),
      n = l ? Sy(e, t) : yf(e, t, !0),
      u = l;
    do {
      if (n === 0) {
        ii && !l && xn(e, t, 0, !1);
        break;
      } else {
        if (((a = e.current.alternate), u && !Ey(a))) {
          ((n = yf(e, t, !1)), (u = !1));
          continue;
        }
        if (n === 2) {
          if (((u = t), e.errorRecoveryDisabledLanes & u)) var c = 0;
          else
            ((c = e.pendingLanes & -536870913),
              (c = c !== 0 ? c : c & 536870912 ? 536870912 : 0));
          if (c !== 0) {
            t = c;
            e: {
              var m = e;
              n = Ec;
              var E = m.current.memoizedState.isDehydrated;
              if (
                (E && (mi(m, c).flags |= 256),
                (c = yf(m, c, !1)),
                c !== 2 && c !== 6)
              ) {
                if (sf && !E) {
                  ((m.errorRecoveryDisabledLanes |= u), (yu |= u), (n = 4));
                  break e;
                }
                ((u = va),
                  (va = n),
                  u !== null &&
                    (va === null ? (va = u) : va.push.apply(va, u)));
              }
              n = c;
            }
            if (((u = !1), n !== 2)) continue;
          }
        }
        if (n === 1) {
          (mi(e, 0), xn(e, t, 0, !0));
          break;
        }
        e: {
          switch (((l = e), (u = n), u)) {
            case 0:
            case 1:
              throw Error(f(345));
            case 4:
              if ((t & 4194048) !== t && (t & 62914560) !== t) break;
            case 6:
              xn(l, t, Na, !Nn);
              break e;
            case 2:
              va = null;
              break;
            case 3:
            case 5:
              break;
            default:
              throw Error(f(329));
          }
          if ((t & 62914560) === t && ((n = Wr + 300 - ea()), 10 < n)) {
            if ((xn(l, t, Na, !Nn), Nt(l, 0, !0) !== 0)) break e;
            ((El = t),
              (l.timeoutHandle = Uf(
                X0.bind(
                  null,
                  l,
                  a,
                  va,
                  eo,
                  ff,
                  t,
                  Na,
                  yu,
                  ci,
                  Nn,
                  u,
                  "Throttled",
                  -0,
                  0,
                ),
                n,
              )));
            break e;
          }
          X0(l, a, va, eo, ff, t, Na, yu, ci, Nn, u, null, -0, 0);
        }
      }
      break;
    } while (!0);
    bl(e);
  }
  function X0(e, t, a, l, n, u, c, m, E, A, _, G, C, D) {
    e.timeoutHandle = -1;
    var I = t.subtreeFlags,
      ue = (u & 335544064) === u;
    if (
      ((G = null),
      (ue || I & 8192 || (I & 16785408) === 16785408) &&
        ((G = {
          stylesheets: null,
          count: 0,
          imgCount: 0,
          imgBytes: 0,
          suspenseyImages: [],
          waitingForImages: !0,
          waitingForViewTransition: !1,
          unsuspend: mt,
        }),
        (za = null),
        U0(t, u, G),
        ue &&
          ((I = G),
          (ue = e.containerInfo),
          (ue = (ue.nodeType === 9 ? ue : ue.ownerDocument)
            .__reactViewTransition),
          ue != null &&
            (I.count++,
            (I.waitingForViewTransition = !0),
            (I = Ac.bind(I)),
            ue.finished.then(I, I))),
        (I =
          (u & 62914560) === u
            ? Wr - ea()
            : (u & 4194048) === u
              ? q0 - ea()
              : 0),
        (I = Tv(G, I)),
        I !== null))
    ) {
      ((El = u),
        (e.cancelPendingCommit = I(
          $0.bind(null, e, t, u, a, l, n, c, m, E, A, _, G, null, C, D),
        )),
        xn(e, u, c, !A));
      return;
    }
    $0(e, t, u, a, l, n, c, m, E, A, _, G);
  }
  function Ey(e) {
    for (var t = e; ; ) {
      var a = t.tag;
      if (
        (a === 0 || a === 11 || a === 15) &&
        t.flags & 16384 &&
        ((a = t.updateQueue), a !== null && ((a = a.stores), a !== null))
      )
        for (var l = 0; l < a.length; l++) {
          var n = a[l],
            u = n.getSnapshot;
          n = n.value;
          try {
            if (!ot(u(), n)) return !1;
          } catch {
            return !1;
          }
        }
      if (((a = t.child), t.subtreeFlags & 16384 && a !== null))
        ((a.return = t), (t = a));
      else {
        if (t === e) break;
        for (; t.sibling === null; ) {
          if (t.return === null || t.return === e) return !0;
          t = t.return;
        }
        ((t.sibling.return = t.return), (t = t.sibling));
      }
    }
    return !0;
  }
  function xn(e, t, a, l) {
    ((t = Di(e, t)),
      (t &= ~Ir),
      (t &= ~yu),
      (e.suspendedLanes |= t),
      (e.pingedLanes &= ~t),
      l && (e.warmLanes |= t),
      (l = e.expirationTimes));
    for (var n = t; 0 < n; ) {
      var u = 31 - It(n),
        c = 1 << u;
      ((l[u] = -1), (n &= ~c));
    }
    a !== 0 && Ri(e, a, t);
  }
  function ao() {
    return (Ze & 6) === 0 ? (Sc(0), !1) : !0;
  }
  function hf() {
    if (Re !== null) {
      if (Ie === 0) var e = Re.return;
      else ((e = Re), (Bl = lu = null), Ss(e), (Wu = null), (nc = 0), (e = Re));
      for (; e !== null; ) (f0(e.alternate, e), (e = e.return));
      Re = null;
    }
  }
  function mi(e, t) {
    var a = e.timeoutHandle;
    return (
      a !== -1 && ((e.timeoutHandle = -1), ky(a)),
      (a = e.cancelPendingCommit),
      a !== null && ((e.cancelPendingCommit = null), a()),
      (El = 0),
      hf(),
      (at = e),
      (Re = a = Ul(e.current, null)),
      (je = t),
      (Ie = 0),
      (Ta = null),
      (Nn = !1),
      (ii = Lt(e, t)),
      (sf = !1),
      (ci = Na = Ir = yu = Mn = pt = 0),
      (va = Ec = null),
      (ff = !1),
      (Xl = Di(e, t)),
      sr(),
      a
    );
  }
  function k0(e, t) {
    ((Te = null),
      (ie.H = Hr),
      t === Iu || t === Sr
        ? ((t = $m()), (Ie = 3))
        : t === rs
          ? ((t = $m()), (Ie = 4))
          : (Ie =
              t === Bs
                ? 8
                : t !== null &&
                    typeof t == "object" &&
                    typeof t.then == "function"
                  ? 6
                  : 1),
      (Ta = t),
      Re === null && ((pt = 1), Br(e, Ba(t, e.current))));
  }
  function V0() {
    var e = kt.current;
    return e === null
      ? !0
      : (je & 4194048) === je
        ? Pt === null
        : (je & 62914560) === je || (je & 536870912) !== 0
          ? e === Pt
          : !1;
  }
  function Q0() {
    var e = ie.H;
    return ((ie.H = Hr), e === null ? Hr : e);
  }
  function Z0() {
    var e = ie.A;
    return ((ie.A = py), e);
  }
  function lo() {
    ((pt = 4),
      Nn || ((je & 4194048) !== je && kt.current !== null) || (ii = !0),
      ((Mn & 134217727) === 0 && (yu & 134217727) === 0) ||
        at === null ||
        xn(at, je, Na, !1));
  }
  function yf(e, t, a) {
    var l = Ze;
    Ze |= 2;
    var n = Q0(),
      u = Z0();
    ((at !== e || je !== t) && ((eo = null), mi(e, t)), (t = !1));
    var c = pt;
    e: do
      try {
        if (Ie !== 0 && Re !== null) {
          var m = Re,
            E = Ta;
          switch (Ie) {
            case 8:
              (hf(), (c = 6));
              break e;
            case 3:
            case 2:
            case 9:
            case 6:
              kt.current === null && (t = !0);
              var A = Ie;
              if (((Ie = 0), (Ta = null), di(e, m, E, A), a && ii)) {
                c = 0;
                break e;
              }
              break;
            default:
              ((A = Ie), (Ie = 0), (Ta = null), di(e, m, E, A));
          }
        }
        (by(), (c = pt));
        break;
      } catch (_) {
        k0(e, _);
      }
    while (!0);
    return (
      t && e.shellSuspendCounter++,
      (Bl = lu = null),
      (Ze = l),
      (ie.H = n),
      (ie.A = u),
      Re === null && ((at = null), (je = 0), sr()),
      c
    );
  }
  function by() {
    for (; Re !== null; ) K0(Re);
  }
  function Sy(e, t) {
    var a = Ze;
    Ze |= 2;
    var l = Q0(),
      n = Z0();
    at !== e || je !== t
      ? ((eo = null), (Pr = ea() + 500), mi(e, t))
      : (ii = Lt(e, t));
    e: do
      try {
        if (Ie !== 0 && Re !== null) {
          t = Re;
          var u = Ta;
          t: switch (Ie) {
            case 1:
              ((Ie = 0), (Ta = null), di(e, t, u, 1));
              break;
            case 2:
            case 9:
              if (Jm(u)) {
                ((Ie = 0), (Ta = null), J0(t));
                break;
              }
              ((t = function () {
                ((Ie !== 2 && Ie !== 9) || at !== e || (Ie = 7), bl(e));
              }),
                u.then(t, t));
              break e;
            case 3:
              Ie = 7;
              break e;
            case 4:
              Ie = 5;
              break e;
            case 7:
              Jm(u)
                ? ((Ie = 0), (Ta = null), J0(t))
                : ((Ie = 0), (Ta = null), di(e, t, u, 7));
              break;
            case 5:
              var c = null;
              switch (Re.tag) {
                case 26:
                  c = Re.memoizedState;
                case 5:
                case 27:
                  var m = Re;
                  if (c ? Yh(c) : m.stateNode.complete) {
                    ((Ie = 0), (Ta = null));
                    var E = m.sibling;
                    if (E !== null) Re = E;
                    else {
                      var A = m.return;
                      A !== null ? ((Re = A), no(A)) : (Re = null);
                    }
                    break t;
                  }
              }
              ((Ie = 0), (Ta = null), di(e, t, u, 5));
              break;
            case 6:
              ((Ie = 0), (Ta = null), di(e, t, u, 6));
              break;
            case 8:
              (hf(), (pt = 6));
              break e;
            default:
              throw Error(f(462));
          }
        }
        zy();
        break;
      } catch (_) {
        k0(e, _);
      }
    while (!0);
    return (
      (Bl = lu = null),
      (ie.H = l),
      (ie.A = n),
      (Ze = a),
      Re !== null ? 0 : ((at = null), (je = 0), sr(), pt)
    );
  }
  function zy() {
    for (; Re !== null && !wi(); ) K0(Re);
  }
  function K0(e) {
    var t = o0(e.alternate, e, Xl);
    ((e.memoizedProps = e.pendingProps), t === null ? no(e) : (Re = t));
  }
  function J0(e) {
    var t = e,
      a = t.alternate;
    switch (t.tag) {
      case 15:
      case 0:
        t = a0(a, t, t.pendingProps, t.type, void 0, je);
        break;
      case 11:
        t = a0(a, t, t.pendingProps, t.type.render, t.ref, je);
        break;
      case 5:
        Ss(t);
        var l = t;
        l === Bt &&
          (Ce
            ? (vr(l), l.tag === 5 && l.stateNode != null && (ut = l.stateNode))
            : (vr(l), (Ce = !0)));
      default:
        (f0(a, t), (t = Re = jm(t, Xl)), (t = o0(a, t, Xl)));
    }
    ((e.memoizedProps = e.pendingProps), t === null ? no(e) : (Re = t));
  }
  function di(e, t, a, l) {
    ((Bl = lu = null), Ss(t), (Wu = null), (nc = 0));
    var n = t.return;
    try {
      if (oy(e, n, t, a, je)) {
        ((pt = 1), Br(e, Ba(a, e.current)), (Re = null));
        return;
      }
    } catch (u) {
      if (n !== null) throw ((Re = n), u);
      ((pt = 1), Br(e, Ba(a, e.current)), (Re = null));
      return;
    }
    t.flags & 32768
      ? (Ce || l === 1
          ? (e = !0)
          : ii || (je & 536870912) !== 0
            ? (e = !1)
            : ((Nn = e = !0),
              (l === 2 || l === 9 || l === 3 || l === 6) &&
                ((l = kt.current),
                l !== null && l.tag === 13 && (l.flags |= 16384))),
        F0(t, e))
      : no(t);
  }
  function no(e) {
    var t = e;
    do {
      if ((t.flags & 32768) !== 0) {
        F0(t, Nn);
        return;
      }
      e = t.return;
      var a = dy(t.alternate, t, Xl);
      if (a !== null) {
        Re = a;
        return;
      }
      if (((t = t.sibling), t !== null)) {
        Re = t;
        return;
      }
      Re = t = e;
    } while (t !== null);
    pt === 0 && (pt = 5);
  }
  function F0(e, t) {
    do {
      var a = hy(e.alternate, e);
      if (a !== null) {
        ((a.flags &= 32767), (Re = a));
        return;
      }
      if (
        ((a = e.return),
        a !== null &&
          ((a.flags |= 32768), (a.subtreeFlags = 0), (a.deletions = null)),
        !t && ((e = e.sibling), e !== null))
      ) {
        Re = e;
        return;
      }
      Re = e = a;
    } while (e !== null);
    ((pt = 6), (Re = null));
  }
  function $0(e, t, a, l, n, u, c, m, E, A, _, G) {
    e.cancelPendingCommit = null;
    do uo();
    while (ht !== 0);
    if ((Ze & 6) !== 0) throw Error(f(327));
    if (t !== null) {
      if (t === e.current) throw Error(f(177));
      (e === at && ((Re = at = null), (je = 0)),
        (vu = t),
        (tl = e),
        (El = a),
        (df = n),
        (Y0 = l),
        Ty(e, t, a, c, m, E, G));
    }
  }
  function Ty(e, t, a, l, n, u, c) {
    var m = t.lanes | t.childLanes;
    if (
      ((mf = m),
      (m |= Fo),
      kc(e, a, m, l, n, u),
      (oi = null),
      (a & 335544064) === a
        ? ((si = I1(e)), (l = 10262))
        : ((si = null), (l = 10256)),
      (t.subtreeFlags & l) !== 0 || (t.flags & l) !== 0
        ? ((e.callbackNode = null),
          (e.callbackPriority = 0),
          wy(Ql, function () {
            return (Ef(), null);
          }))
        : ((e.callbackNode = null), (e.callbackPriority = 0)),
      (Vr = !1),
      (l = (t.flags & 13878) !== 0),
      (t.subtreeFlags & 13878) !== 0 || l)
    ) {
      ((l = ie.T), (ie.T = null), (n = ve.p), (ve.p = 2), (u = Ze), (Ze |= 4));
      try {
        yy(e, t, a);
      } finally {
        ((Ze = u), (ve.p = n), (ie.T = l));
      }
    }
    ((ht = 1),
      Vr
        ? (ri = Fy(c, e.containerInfo, si, vf, pf, My, gf, Ef, Ny))
        : (vf(), pf(), gf()));
  }
  function Ny(e) {
    if (ht !== 0) {
      var t = tl.onRecoverableError;
      t(e, { componentStack: null });
    }
  }
  function My() {
    ht === 3 && ((ht = 0), R0(vu, tl), (ht = 4));
  }
  function vf() {
    if (ht === 1) {
      ht = 0;
      var e = tl,
        t = vu,
        a = El,
        l = (t.flags & 13878) !== 0;
      if ((t.subtreeFlags & 13878) !== 0 || l) {
        ((l = ie.T), (ie.T = null));
        var n = ve.p;
        ve.p = 2;
        var u = Ze;
        Ze |= 4;
        try {
          ((vc = Kr = !1), O0(t, e, a), (a = Df));
          var c = sl(e.containerInfo),
            m = a.focusedElem,
            E = a.selectionRange;
          if (
            c !== m &&
            m &&
            m.ownerDocument &&
            Wi(m.ownerDocument.documentElement, m)
          ) {
            if (E !== null && In(m)) {
              var A = E.start,
                _ = E.end;
              if ((_ === void 0 && (_ = A), "selectionStart" in m))
                ((m.selectionStart = A),
                  (m.selectionEnd = Math.min(_, m.value.length)));
              else {
                var G = m.ownerDocument || document,
                  C = (G && G.defaultView) || window;
                if (C.getSelection) {
                  var D = C.getSelection(),
                    I = m.textContent.length,
                    ue = Math.min(E.start, I),
                    Ne = E.end === void 0 ? ue : Math.min(E.end, I);
                  !D.extend && ue > Ne && ((c = Ne), (Ne = ue), (ue = c));
                  var x = ku(m, ue),
                    S = ku(m, Ne);
                  if (
                    x &&
                    S &&
                    (D.rangeCount !== 1 ||
                      D.anchorNode !== x.node ||
                      D.anchorOffset !== x.offset ||
                      D.focusNode !== S.node ||
                      D.focusOffset !== S.offset)
                  ) {
                    var O = G.createRange();
                    (O.setStart(x.node, x.offset),
                      D.removeAllRanges(),
                      ue > Ne
                        ? (D.addRange(O), D.extend(S.node, S.offset))
                        : (O.setEnd(S.node, S.offset), D.addRange(O)));
                  }
                }
              }
            }
            for (G = [], D = m; (D = D.parentNode); )
              D.nodeType === 1 &&
                G.push({ element: D, left: D.scrollLeft, top: D.scrollTop });
            for (
              typeof m.focus == "function" && m.focus(), m = 0;
              m < G.length;
              m++
            ) {
              var L = G[m];
              ((L.element.scrollLeft = L.left), (L.element.scrollTop = L.top));
            }
          }
          ((Si = !!Of), (Df = Of = null));
        } finally {
          ((Ze = u), (ve.p = n), (ie.T = l));
        }
      }
      ((e.current = t), (ht = 2));
    }
  }
  function pf() {
    if (ht === 2) {
      ht = 0;
      var e = tl,
        t = vu,
        a = (t.flags & 8772) !== 0;
      if ((t.subtreeFlags & 8772) !== 0 || a) {
        ((a = ie.T), (ie.T = null));
        var l = ve.p;
        ve.p = 2;
        var n = Ze;
        Ze |= 4;
        try {
          N0(e, t.alternate, t);
        } finally {
          ((Ze = n), (ve.p = l), (ie.T = a));
        }
      }
      ht = 3;
    }
  }
  function gf() {
    if (ht === 4 || ht === 3) {
      ht = 0;
      var e = ri;
      ((ri = null), Ro());
      var t = tl,
        a = vu,
        l = El,
        n = Y0,
        u = (l & 335544064) === l ? 10262 : 10256;
      if (
        ((a.subtreeFlags & u) !== 0 || (a.flags & u) !== 0
          ? (ht = 5)
          : ((ht = 0), (vu = tl = null), I0(t, t.pendingLanes)),
        (u = t.pendingLanes),
        u === 0 && (Cn = null),
        Au(l),
        (a = a.stateNode),
        Tt && typeof Tt.onCommitFiberRoot == "function")
      )
        try {
          Tt.onCommitFiberRoot(Za, a, void 0, (a.current.flags & 128) === 128);
        } catch {}
      if (n !== null) {
        ((a = ie.T), (u = ve.p), (ve.p = 2), (ie.T = null));
        try {
          for (var c = t.onRecoverableError, m = 0; m < n.length; m++) {
            var E = n[m];
            c(E.value, { componentStack: E.stack });
          }
        } finally {
          ((ie.T = a), (ve.p = u));
        }
      }
      if (
        ((n = oi),
        (c = si),
        (si = null),
        n !== null && ((oi = null), c === null && (c = []), e !== null))
      )
        for (E = 0; E < n.length; E++)
          ((a = (0, n[E])(c)), a !== void 0 && e.finished.finally(a));
      ((El & 3) !== 0 && uo(),
        bl(t),
        (u = t.pendingLanes),
        (l & 261930) !== 0 && (u & 42) !== 0
          ? t === to
            ? bc++
            : ((bc = 0), (to = t))
          : ((bc = 0), (to = null)),
        Sc(0));
    }
  }
  function I0(e, t) {
    (e.pooledCacheLanes &= t) === 0 &&
      ((t = e.pooledCache), t != null && ((e.pooledCache = null), tc(t)));
  }
  function uo() {
    return (
      ri !== null && (ri.skipTransition(), (ri = null)),
      vf(),
      pf(),
      gf(),
      Ef()
    );
  }
  function Ef() {
    if (ht !== 5) return !1;
    var e = tl,
      t = mf;
    mf = 0;
    var a = Au(El),
      l = ie.T,
      n = ve.p;
    try {
      ((ve.p = 32 > a ? 32 : a), (ie.T = null), (a = df), (df = null));
      var u = tl,
        c = El;
      if (((ht = 0), (vu = tl = null), (El = 0), (Ze & 6) !== 0))
        throw Error(f(331));
      var m = Ze;
      if (
        ((Ze |= 4),
        B0(u.current),
        _0(u, u.current, c, a),
        (Ze = m),
        Sc(0, !1),
        Tt && typeof Tt.onPostCommitFiberRoot == "function")
      )
        try {
          Tt.onPostCommitFiberRoot(Za, u);
        } catch {}
      return !0;
    } finally {
      ((ve.p = n), (ie.T = l), I0(e, t));
    }
  }
  function W0(e, t, a) {
    ((t = Ba(a, t)),
      (t = Hs(e.stateNode, t, 2)),
      (e = gn(e, t, 2)),
      e !== null && (nl(e, 2), bl(e)));
  }
  function We(e, t, a) {
    if (e.tag === 3) W0(e, e, a);
    else
      for (; t !== null; ) {
        if (t.tag === 3) {
          W0(t, e, a);
          break;
        } else if (t.tag === 1) {
          var l = t.stateNode;
          if (
            typeof t.type.getDerivedStateFromError == "function" ||
            (typeof l.componentDidCatch == "function" &&
              (Cn === null || !Cn.has(l)))
          ) {
            ((e = Ba(a, e)),
              (a = Jd(2)),
              (l = gn(t, a, 2)),
              l !== null && (Fd(a, l, t, e), nl(l, 2), bl(l)));
            break;
          }
        }
        t = t.return;
      }
  }
  function bf(e, t, a) {
    var l = e.pingCache;
    if (l === null) {
      l = e.pingCache = new gy();
      var n = new Set();
      l.set(t, n);
    } else ((n = l.get(t)), n === void 0 && ((n = new Set()), l.set(t, n)));
    n.has(a) ||
      ((sf = !0), n.add(a), (e = Cy.bind(null, e, t, a)), t.then(e, e));
  }
  function Cy(e, t, a) {
    var l = e.pingCache;
    (l !== null && l.delete(t),
      (e.pingedLanes |= e.suspendedLanes & a),
      (e.warmLanes &= ~a),
      at === e &&
        (je & a) === a &&
        ((pt === 4 ||
          (pt === 3 && (je & 62914560) === je && 300 > ea() - Wr)) &&
        (Ze & 2) === 0
          ? mi(e, 0)
          : (Ir |= a),
        ci === je && (ci = 0)),
      bl(e));
  }
  function P0(e, t) {
    (t === 0 && (t = zl()), (e = eu(e, t)), e !== null && (nl(e, t), bl(e)));
  }
  function xy(e) {
    var t = e.memoizedState,
      a = 0;
    (t !== null && (a = t.retryLane), P0(e, a));
  }
  function Ay(e, t) {
    var a = 0;
    switch (e.tag) {
      case 31:
      case 13:
        var l = e.stateNode,
          n = e.memoizedState;
        n !== null && (a = n.retryLane);
        break;
      case 19:
        l = e.stateNode;
        break;
      case 22:
        l = e.stateNode._retryCache;
        break;
      default:
        throw Error(f(314));
    }
    (l !== null && l.delete(t), P0(e, a));
  }
  function wy(e, t) {
    return Yn(e, t);
  }
  var hi = null,
    yi = null,
    Sf = !1,
    io = !1,
    zf = !1,
    An = 0;
  function bl(e) {
    (e !== yi &&
      e.next === null &&
      (yi === null ? (hi = yi = e) : (yi = yi.next = e)),
      (io = !0),
      Sf || ((Sf = !0), Dy()));
  }
  function Sc(e, t) {
    if (!zf && io) {
      zf = !0;
      do
        for (var a = !1, l = hi; l !== null; ) {
          if (e !== 0) {
            var n = l.pendingLanes;
            if (n === 0) var u = 0;
            else {
              var c = l.suspendedLanes,
                m = l.pingedLanes;
              ((u = (1 << (31 - It(42 | e) + 1)) - 1),
                (u &= n & ~(c & ~m)),
                (u = u & 201326741 ? (u & 201326741) | 1 : u ? u | 2 : 0));
            }
            u !== 0 && ((a = !0), lh(l, u));
          } else
            ((u = je),
              (u = Nt(
                l,
                l === at ? u : 0,
                l.cancelPendingCommit !== null || l.timeoutHandle !== -1,
              )),
              (u & 3) === 0 || Lt(l, u) || ((a = !0), lh(l, u)));
          l = l.next;
        }
      while (a);
      zf = !1;
    }
  }
  function Oy() {
    eh();
  }
  function eh() {
    io = Sf = !1;
    var e = 0;
    An !== 0 && Xy() && (e = An);
    for (var t = ea(), a = null, l = hi; l !== null; ) {
      var n = l.next,
        u = th(l, t);
      (u === 0
        ? ((l.next = null),
          a === null ? (hi = n) : (a.next = n),
          n === null && (yi = a))
        : ((a = l), (e !== 0 || (u & 3) !== 0) && (io = !0)),
        (l = n));
    }
    ((ht !== 0 && ht !== 5) || Sc(e), An !== 0 && (An = 0));
  }
  function th(e, t) {
    for (
      var a = e.suspendedLanes,
        l = e.pingedLanes,
        n = e.expirationTimes,
        u = e.pendingLanes & -62914561;
      0 < u;

    ) {
      var c = 31 - It(u),
        m = 1 << c,
        E = n[c];
      (E === -1
        ? ((m & a) === 0 || (m & l) !== 0) && (n[c] = Xc(m, t))
        : E <= t && (e.expiredLanes |= m),
        (u &= ~m));
    }
    if (
      ((t = at),
      (a = je),
      (a = Nt(
        e,
        e === t ? a : 0,
        e.cancelPendingCommit !== null || e.timeoutHandle !== -1,
      )),
      (l = e.callbackNode),
      a === 0 ||
        (e === t && (Ie === 2 || Ie === 9)) ||
        e.cancelPendingCommit !== null)
    )
      return (
        l !== null && l !== null && zu(l),
        (e.callbackNode = null),
        (e.callbackPriority = 0)
      );
    if ((a & 3) === 0 || Lt(e, a)) {
      if (((t = a & -a), t === e.callbackPriority)) return t;
      switch ((l !== null && zu(l), Au(a))) {
        case 2:
        case 8:
          a = Mu;
          break;
        case 32:
          a = Ql;
          break;
        case 268435456:
          a = ca;
          break;
        default:
          a = Ql;
      }
      return (
        (l = ah.bind(null, e)),
        (a = Yn(a, l)),
        (e.callbackPriority = t),
        (e.callbackNode = a),
        t
      );
    }
    return (
      l !== null && l !== null && zu(l),
      (e.callbackPriority = 2),
      (e.callbackNode = null),
      2
    );
  }
  function ah(e, t) {
    if (ht !== 0 && ht !== 5)
      return ((e.callbackNode = null), (e.callbackPriority = 0), null);
    var a = e.callbackNode;
    if (uo() && e.callbackNode !== a) return null;
    var l = je;
    return (
      (l = Nt(
        e,
        e === at ? l : 0,
        e.cancelPendingCommit !== null || e.timeoutHandle !== -1,
      )),
      l === 0
        ? null
        : (G0(e, l, t),
          th(e, ea()),
          e.callbackNode != null && e.callbackNode === a
            ? ah.bind(null, e)
            : null)
    );
  }
  function lh(e, t) {
    if (uo()) return null;
    G0(e, t, !0);
  }
  function Dy() {
    Vy(function () {
      (Ze & 6) !== 0 ? Yn(Nu, Oy) : eh();
    });
  }
  function Tf() {
    if (An === 0) {
      var e = iu;
      (e === 0 && ((e = Zl), (Zl <<= 1), (Zl & 261888) === 0 && (Zl = 256)),
        (An = e));
    }
    return An;
  }
  function nh(e) {
    return e == null || typeof e == "symbol" || typeof e == "boolean"
      ? null
      : typeof e == "function"
        ? e
        : Ue(e);
  }
  function Ry(e, t, a, l, n) {
    if (t === "submit" && a && a.stateNode === n) {
      var u = nh((n[Ut] || null).action),
        c = l.submitter;
      c &&
        ((t = (t = c[Ut] || null)
          ? nh(t.formAction)
          : c.getAttribute("formAction")),
        t !== null && ((u = t), (c = null)));
      var m = new an("action", "action", null, l, n);
      e.push({
        event: m,
        listeners: [
          {
            instance: null,
            listener: function () {
              if (l.defaultPrevented) {
                if (An !== 0) {
                  var E = new FormData(n, c);
                  Os(
                    a,
                    { pending: !0, data: E, method: n.method, action: u },
                    null,
                    E,
                  );
                }
              } else
                typeof u == "function" &&
                  (m.preventDefault(),
                  (E = new FormData(n, c)),
                  Os(
                    a,
                    { pending: !0, data: E, method: n.method, action: u },
                    u,
                    E,
                  ));
            },
            currentTarget: n,
          },
        ],
      });
    }
  }
  for (var Nf = 0; Nf < Jo.length; Nf++) {
    var Mf = Jo[Nf],
      _y = Mf.toLowerCase(),
      Uy = Mf[0].toUpperCase() + Mf.slice(1);
    Ia(_y, "on" + Uy);
  }
  (Ia(Om, "onAnimationEnd"),
    Ia(Dm, "onAnimationIteration"),
    Ia(Rm, "onAnimationStart"),
    Ia("dblclick", "onDoubleClick"),
    Ia("focusin", "onFocus"),
    Ia("focusout", "onBlur"),
    Ia(k1, "onTransitionRun"),
    Ia(V1, "onTransitionStart"),
    Ia(Q1, "onTransitionCancel"),
    Ia(_m, "onTransitionEnd"),
    bt("onMouseEnter", ["mouseout", "mouseover"]),
    bt("onMouseLeave", ["mouseout", "mouseover"]),
    bt("onPointerEnter", ["pointerout", "pointerover"]),
    bt("onPointerLeave", ["pointerout", "pointerover"]),
    cl(
      "onChange",
      "change click focusin focusout input keydown keyup selectionchange".split(
        " ",
      ),
    ),
    cl(
      "onSelect",
      "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(
        " ",
      ),
    ),
    cl("onBeforeInput", ["compositionend", "keypress", "textInput", "paste"]),
    cl(
      "onCompositionEnd",
      "compositionend focusout keydown keypress keyup mousedown".split(" "),
    ),
    cl(
      "onCompositionStart",
      "compositionstart focusout keydown keypress keyup mousedown".split(" "),
    ),
    cl(
      "onCompositionUpdate",
      "compositionupdate focusout keydown keypress keyup mousedown".split(" "),
    ));
  var zc =
      "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(
        " ",
      ),
    Hy = new Set(
      "beforetoggle cancel close invalid load scroll scrollend toggle"
        .split(" ")
        .concat(zc),
    );
  function uh(e, t) {
    t = (t & 4) !== 0;
    for (var a = 0; a < e.length; a++) {
      var l = e[a],
        n = l.event;
      l = l.listeners;
      e: {
        var u = void 0;
        if (t)
          for (var c = l.length - 1; 0 <= c; c--) {
            var m = l[c],
              E = m.instance,
              A = m.currentTarget;
            if (((m = m.listener), E !== u && n.isPropagationStopped()))
              break e;
            ((u = m), (n.currentTarget = A));
            try {
              u(n);
            } catch (_) {
              or(_);
            }
            ((n.currentTarget = null), (u = E));
          }
        else
          for (c = 0; c < l.length; c++) {
            if (
              ((m = l[c]),
              (E = m.instance),
              (A = m.currentTarget),
              (m = m.listener),
              E !== u && n.isPropagationStopped())
            )
              break e;
            ((u = m), (n.currentTarget = A));
            try {
              u(n);
            } catch (_) {
              or(_);
            }
            ((n.currentTarget = null), (u = E));
          }
      }
    }
  }
  function _e(e, t) {
    var a = t[wu];
    a === void 0 && (a = t[wu] = new Set());
    var l = e + "__bubble";
    a.has(l) || (ih(t, e, 2, !1), a.add(l));
  }
  function Cf(e, t, a) {
    var l = 0;
    (t && (l |= 4), ih(a, e, l, t));
  }
  var co = "_reactListening" + Math.random().toString(36).slice(2);
  function xf(e) {
    if (!e[co]) {
      ((e[co] = !0),
        Ct.forEach(function (a) {
          a !== "selectionchange" && (Hy.has(a) || Cf(a, !1, e), Cf(a, !0, e));
        }));
      var t = e.nodeType === 9 ? e : e.ownerDocument;
      t === null || t[co] || ((t[co] = !0), Cf("selectionchange", !1, t));
    }
  }
  function ih(e, t, a, l) {
    switch (Fh(t)) {
      case 2:
        var n = xv;
        break;
      case 8:
        n = Av;
        break;
      default:
        n = Kf;
    }
    ((a = n.bind(null, t, a, e)),
      (n = void 0),
      !Qn ||
        (t !== "touchstart" && t !== "touchmove" && t !== "wheel") ||
        (n = !0),
      l
        ? n !== void 0
          ? e.addEventListener(t, a, { capture: !0, passive: n })
          : e.addEventListener(t, a, !0)
        : n !== void 0
          ? e.addEventListener(t, a, { passive: n })
          : e.addEventListener(t, a, !1));
  }
  function Af(e, t, a, l, n) {
    var u = l;
    if ((t & 1) === 0 && (t & 2) === 0 && l !== null)
      e: for (;;) {
        if (l === null) return;
        var c = l.tag;
        if (c === 3 || c === 4) {
          var m = l.stateNode.containerInfo;
          if (m === n) break;
          if (c === 4)
            for (c = l.return; c !== null; ) {
              var E = c.tag;
              if ((E === 3 || E === 4) && c.stateNode.containerInfo === n)
                return;
              c = c.return;
            }
          for (; m !== null; ) {
            if (((c = ra(m)), c === null)) return;
            if (((E = c.tag), E === 5 || E === 6 || E === 26 || E === 27)) {
              l = u = c;
              continue e;
            }
            m = m.parentNode;
          }
        }
        l = l.return;
      }
    Uu(function () {
      var A = u,
        _ = Pl(a),
        G = [];
      e: {
        var C = Um.get(e);
        if (C !== void 0) {
          var D = an,
            I = e;
          switch (e) {
            case "keypress":
              if (Zn(a) === 0) break e;
            case "keydown":
            case "keyup":
              D = Xo;
              break;
            case "focusin":
              ((I = "focus"), (D = qu));
              break;
            case "focusout":
              ((I = "blur"), (D = qu));
              break;
            case "beforeblur":
            case "afterblur":
              D = qu;
              break;
            case "click":
              if (a.button === 2) break e;
            case "auxclick":
            case "dblclick":
            case "mousedown":
            case "mousemove":
            case "mouseup":
            case "mouseout":
            case "mouseover":
            case "contextmenu":
              D = Kc;
              break;
            case "drag":
            case "dragend":
            case "dragenter":
            case "dragexit":
            case "dragleave":
            case "dragover":
            case "dragstart":
            case "drop":
              D = Fc;
              break;
            case "touchcancel":
            case "touchend":
            case "touchmove":
            case "touchstart":
              D = ar;
              break;
            case Om:
            case Dm:
            case Rm:
              D = qo;
              break;
            case _m:
              D = lr;
              break;
            case "scroll":
            case "scrollend":
              D = Gi;
              break;
            case "wheel":
              D = Zo;
              break;
            case "copy":
            case "cut":
            case "paste":
              D = Ic;
              break;
            case "gotpointercapture":
            case "lostpointercapture":
            case "pointercancel":
            case "pointerdown":
            case "pointermove":
            case "pointerout":
            case "pointerover":
            case "pointerup":
              D = Yu;
              break;
            case "submit":
              D = tr;
              break;
            case "toggle":
            case "beforetoggle":
              D = ma;
          }
          var ue = (t & 4) !== 0,
            Ne = !ue && (e === "scroll" || e === "scrollend"),
            x = ue ? (C !== null ? C + "Capture" : null) : C;
          ue = [];
          for (var S = A, O; S !== null; ) {
            var L = S;
            if (
              ((O = L.stateNode),
              (L = L.tag),
              (L !== 5 && L !== 26 && L !== 27) ||
                O === null ||
                x === null ||
                ((L = ol(S, x)), L != null && ue.push(Tc(S, L, O))),
              Ne)
            )
              break;
            S = S.return;
          }
          0 < ue.length &&
            ((C = new D(C, I, null, a, _)),
            G.push({ event: C, listeners: ue }));
        }
      }
      if ((t & 7) === 0) {
        e: {
          if (
            ((D = e === "mouseover" || e === "pointerover"),
            (C = e === "mouseout" || e === "pointerout"),
            D &&
              a !== He &&
              (I = a.relatedTarget || a.fromElement) &&
              (ra(I) || I[Tl]))
          )
            break e;
          (C || D) &&
            ((I =
              _.window === _
                ? _
                : (D = _.ownerDocument)
                  ? D.defaultView || D.parentWindow
                  : window),
            C
              ? ((D = a.relatedTarget || a.toElement),
                (C = A),
                (D = D ? ra(D) : null),
                D !== null &&
                  ((Ne = b(D)),
                  (ue = D.tag),
                  D !== Ne || (ue !== 5 && ue !== 27 && ue !== 6)) &&
                  (D = null))
              : ((C = null), (D = A)),
            C !== D &&
              ((ue = Kc),
              (L = "onMouseLeave"),
              (x = "onMouseEnter"),
              (S = "mouse"),
              (e === "pointerout" || e === "pointerover") &&
                ((ue = Yu),
                (L = "onPointerLeave"),
                (x = "onPointerEnter"),
                (S = "pointer")),
              (Ne = C == null ? I : Fl(C)),
              (O = D == null ? I : Fl(D)),
              (I = new ue(L, S + "leave", C, a, _)),
              (I.target = Ne),
              (I.relatedTarget = O),
              (L = null),
              ra(_) === A &&
                ((ue = new ue(x, S + "enter", D, a, _)),
                (ue.target = O),
                (ue.relatedTarget = Ne),
                (L = ue)),
              (Ne = L),
              (ue = C && D ? le(C, D, By) : null),
              C !== null && ch(G, I, C, ue, !1),
              D !== null && Ne !== null && ch(G, Ne, D, ue, !0)));
        }
        e: {
          if (
            ((C = A ? Fl(A) : window),
            (D = C.nodeName && C.nodeName.toLowerCase()),
            D === "select" || (D === "input" && C.type === "file"))
          )
            var ae = h;
          else if ($i(C))
            if (y) ae = nt;
            else {
              ae = et;
              var qe = be;
            }
          else
            ((D = C.nodeName),
              !D ||
              D.toLowerCase() !== "input" ||
              (C.type !== "checkbox" && C.type !== "radio")
                ? A && Ea(A.elementType) && (ae = h)
                : (ae = dt));
          if (ae && (ae = ae(e, A))) {
            Ii(G, ae, a, _);
            break e;
          }
          qe && qe(e, C, A);
        }
        switch (((qe = A ? Fl(A) : window), e)) {
          case "focusin":
            ($i(qe) || qe.contentEditable === "true") &&
              ((St = qe), (rn = A), (on = null));
            break;
          case "focusout":
            on = rn = St = null;
            break;
          case "mousedown":
            sn = !0;
            break;
          case "contextmenu":
          case "mouseup":
          case "dragend":
            ((sn = !1), Am(G, a, _));
            break;
          case "selectionchange":
            if (rr) break;
          case "keydown":
          case "keyup":
            Am(G, a, _);
        }
        var me;
        if (nn)
          e: {
            switch (e) {
              case "compositionstart":
                var ge = "onCompositionStart";
                break e;
              case "compositionend":
                ge = "onCompositionEnd";
                break e;
              case "compositionupdate":
                ge = "onCompositionUpdate";
                break e;
            }
            ge = void 0;
          }
        else
          Dl
            ? Gu(e, a) && (ge = "onCompositionEnd")
            : e === "keydown" &&
              a.keyCode === 229 &&
              (ge = "onCompositionStart");
        (ge &&
          (nr &&
            a.locale !== "ko" &&
            (Dl || ge !== "onCompositionStart"
              ? ge === "onCompositionEnd" && Dl && (me = tn())
              : ((Da = _),
                (Ol = "value" in Da ? Da.value : Da.textContent),
                (Dl = !0))),
          (qe = ro(A, ge)),
          0 < qe.length &&
            ((ge = new Fn(ge, e, null, a, _)),
            G.push({ event: ge, listeners: qe }),
            me
              ? (ge.data = me)
              : ((me = Fi(a)), me !== null && (ge.data = me)))),
          (me = Zi ? ur(e, a) : ir(e, a)) &&
            ((ge = ro(A, "onBeforeInput")),
            0 < ge.length &&
              ((qe = new Fn("onBeforeInput", "beforeinput", null, a, _)),
              G.push({ event: qe, listeners: ge }),
              (qe.data = me))),
          Ry(G, e, A, a, _));
      }
      uh(G, t);
    });
  }
  function Tc(e, t, a) {
    return { instance: e, listener: t, currentTarget: a };
  }
  function ro(e, t) {
    for (var a = t + "Capture", l = []; e !== null; ) {
      var n = e,
        u = n.stateNode;
      if (
        ((n = n.tag),
        (n !== 5 && n !== 26 && n !== 27) ||
          u === null ||
          ((n = ol(e, a)),
          n != null && l.unshift(Tc(e, n, u)),
          (n = ol(e, t)),
          n != null && l.push(Tc(e, n, u))),
        e.tag === 3)
      )
        return l;
      e = e.return;
    }
    return [];
  }
  function By(e) {
    if (e === null) return null;
    do e = e.return;
    while (e && e.tag !== 5 && e.tag !== 27);
    return e || null;
  }
  function ch(e, t, a, l, n) {
    for (var u = t._reactName, c = []; a !== null && a !== l; ) {
      var m = a,
        E = m.alternate,
        A = m.stateNode;
      if (((m = m.tag), E !== null && E === l)) break;
      ((m !== 5 && m !== 26 && m !== 27) ||
        A === null ||
        ((E = A),
        n
          ? ((A = ol(a, u)), A != null && c.unshift(Tc(a, A, E)))
          : n || ((A = ol(a, u)), A != null && c.push(Tc(a, A, E)))),
        (a = a.return));
    }
    c.length !== 0 && e.push({ event: t, listeners: c });
  }
  var jy = /\r\n?/g,
    qy = /\u0000|\uFFFD/g;
  function rh(e) {
    return (typeof e == "string" ? e : "" + e)
      .replace(
        jy,
        `
`,
      )
      .replace(qy, "");
  }
  function oh(e, t) {
    return ((t = rh(t)), rh(e) === t);
  }
  function Pe(e, t, a, l, n, u) {
    switch (a) {
      case "children":
        if (typeof l == "string")
          t === "body" || (t === "textarea" && l === "") || Al(e, l);
        else if (typeof l == "number" || typeof l == "bigint")
          t !== "body" && Al(e, "" + l);
        else return;
        break;
      case "className":
        Ja(e, "class", l);
        break;
      case "tabIndex":
        Ja(e, "tabindex", l);
        break;
      case "dir":
      case "role":
      case "viewBox":
      case "width":
      case "height":
        Ja(e, a, l);
        break;
      case "style":
        Ru(e, l, u);
        return;
      case "data":
        if (t !== "object") {
          Ja(e, "data", l);
          break;
        }
      case "src":
      case "href":
        if (l === "" && (t !== "a" || a !== "href")) {
          e.removeAttribute(a);
          break;
        }
        if (
          l == null ||
          typeof l == "function" ||
          typeof l == "symbol" ||
          typeof l == "boolean"
        ) {
          e.removeAttribute(a);
          break;
        }
        ((l = Ue(l)), e.setAttribute(a, l));
        break;
      case "action":
      case "formAction":
        if (typeof l == "function") {
          e.setAttribute(
            a,
            "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')",
          );
          break;
        } else
          typeof u == "function" &&
            (a === "formAction"
              ? (t !== "input" && Pe(e, t, "name", n.name, n, null),
                Pe(e, t, "formEncType", n.formEncType, n, null),
                Pe(e, t, "formMethod", n.formMethod, n, null),
                Pe(e, t, "formTarget", n.formTarget, n, null))
              : (Pe(e, t, "encType", n.encType, n, null),
                Pe(e, t, "method", n.method, n, null),
                Pe(e, t, "target", n.target, n, null)));
        if (l == null || typeof l == "symbol" || typeof l == "boolean") {
          e.removeAttribute(a);
          break;
        }
        ((l = Ue(l)), e.setAttribute(a, l));
        break;
      case "onClick":
        l != null && (e.onclick = mt);
        return;
      case "onScroll":
        l != null && _e("scroll", e);
        return;
      case "onScrollEnd":
        l != null && _e("scrollend", e);
        return;
      case "dangerouslySetInnerHTML":
        if (l != null) {
          if (typeof l != "object" || !("__html" in l)) throw Error(f(61));
          if (((a = l.__html), a != null)) {
            if (n.children != null) throw Error(f(60));
            (u != null ? u.__html : void 0) !== a && (e.innerHTML = a);
          }
        }
        break;
      case "multiple":
        e.multiple = l && typeof l != "function" && typeof l != "symbol";
        break;
      case "muted":
        e.muted = l && typeof l != "function" && typeof l != "symbol";
        break;
      case "suppressContentEditableWarning":
      case "suppressHydrationWarning":
      case "defaultValue":
      case "defaultChecked":
      case "innerHTML":
      case "ref":
        break;
      case "autoFocus":
        break;
      case "xlinkHref":
        if (
          l == null ||
          typeof l == "function" ||
          typeof l == "boolean" ||
          typeof l == "symbol"
        ) {
          e.removeAttribute("xlink:href");
          break;
        }
        ((a = Ue(l)),
          e.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", a));
        break;
      case "contentEditable":
      case "spellCheck":
      case "draggable":
      case "value":
      case "autoReverse":
      case "externalResourcesRequired":
      case "focusable":
      case "preserveAlpha":
        l != null && typeof l != "function" && typeof l != "symbol"
          ? e.setAttribute(a, l)
          : e.removeAttribute(a);
        break;
      case "inert":
      case "allowFullScreen":
      case "async":
      case "autoPlay":
      case "controls":
      case "credentialless":
      case "default":
      case "defer":
      case "disabled":
      case "disablePictureInPicture":
      case "disableRemotePlayback":
      case "formNoValidate":
      case "hidden":
      case "loop":
      case "noModule":
      case "noValidate":
      case "open":
      case "playsInline":
      case "readOnly":
      case "required":
      case "reversed":
      case "scoped":
      case "seamless":
      case "itemScope":
        l && typeof l != "function" && typeof l != "symbol"
          ? e.setAttribute(a, "")
          : e.removeAttribute(a);
        break;
      case "capture":
      case "download":
        l === !0
          ? e.setAttribute(a, "")
          : l !== !1 &&
              l != null &&
              typeof l != "function" &&
              typeof l != "symbol"
            ? e.setAttribute(a, l)
            : e.removeAttribute(a);
        break;
      case "cols":
      case "rows":
      case "size":
      case "span":
        l != null &&
        typeof l != "function" &&
        typeof l != "symbol" &&
        !isNaN(l) &&
        1 <= l
          ? e.setAttribute(a, l)
          : e.removeAttribute(a);
        break;
      case "rowSpan":
      case "start":
        l == null || typeof l == "function" || typeof l == "symbol" || isNaN(l)
          ? e.removeAttribute(a)
          : e.setAttribute(a, l);
        break;
      case "popover":
        (_e("beforetoggle", e), _e("toggle", e), kn(e, "popover", l));
        break;
      case "xlinkActuate":
        oa(e, "http://www.w3.org/1999/xlink", "xlink:actuate", l);
        break;
      case "xlinkArcrole":
        oa(e, "http://www.w3.org/1999/xlink", "xlink:arcrole", l);
        break;
      case "xlinkRole":
        oa(e, "http://www.w3.org/1999/xlink", "xlink:role", l);
        break;
      case "xlinkShow":
        oa(e, "http://www.w3.org/1999/xlink", "xlink:show", l);
        break;
      case "xlinkTitle":
        oa(e, "http://www.w3.org/1999/xlink", "xlink:title", l);
        break;
      case "xlinkType":
        oa(e, "http://www.w3.org/1999/xlink", "xlink:type", l);
        break;
      case "xmlBase":
        oa(e, "http://www.w3.org/XML/1998/namespace", "xml:base", l);
        break;
      case "xmlLang":
        oa(e, "http://www.w3.org/XML/1998/namespace", "xml:lang", l);
        break;
      case "xmlSpace":
        oa(e, "http://www.w3.org/XML/1998/namespace", "xml:space", l);
        break;
      case "is":
        kn(e, "is", l);
        break;
      case "innerText":
      case "textContent":
        return;
      default:
        if (
          !(2 < a.length) ||
          (a[0] !== "o" && a[0] !== "O") ||
          (a[1] !== "n" && a[1] !== "N")
        )
          ((a = Bo.get(a) || a), kn(e, a, l));
        else return;
    }
    Le = !0;
  }
  function wf(e, t, a, l, n, u) {
    switch (a) {
      case "style":
        Ru(e, l, u);
        return;
      case "dangerouslySetInnerHTML":
        if (l != null) {
          if (typeof l != "object" || !("__html" in l)) throw Error(f(61));
          if (((a = l.__html), a != null)) {
            if (n.children != null) throw Error(f(60));
            (u != null ? u.__html : void 0) !== a && (e.innerHTML = a);
          }
        }
        break;
      case "children":
        if (typeof l == "string") Al(e, l);
        else if (typeof l == "number" || typeof l == "bigint") Al(e, "" + l);
        else return;
        break;
      case "onScroll":
        l != null && _e("scroll", e);
        return;
      case "onScrollEnd":
        l != null && _e("scrollend", e);
        return;
      case "onClick":
        l != null && (e.onclick = mt);
        return;
      case "suppressContentEditableWarning":
      case "suppressHydrationWarning":
      case "innerHTML":
      case "ref":
        return;
      case "innerText":
      case "textContent":
        return;
      default:
        if (!Du.hasOwnProperty(a))
          e: {
            if (
              a[0] === "o" &&
              a[1] === "n" &&
              ((n = a.endsWith("Capture")),
              (u = a.slice(2, n ? a.length - 7 : void 0)),
              (t = e[Ut] || null),
              (t = t != null ? t[a] : null),
              typeof t == "function" && e.removeEventListener(u, t, n),
              typeof l == "function")
            ) {
              (typeof t != "function" &&
                t !== null &&
                (a in e
                  ? (e[a] = null)
                  : e.hasAttribute(a) && e.removeAttribute(a)),
                e.addEventListener(u, l, n));
              break e;
            }
            ((Le = !0),
              a in e
                ? (e[a] = l)
                : l === !0
                  ? e.setAttribute(a, "")
                  : kn(e, a, l));
          }
        return;
    }
    Le = !0;
  }
  function Zt(e, t, a) {
    switch (t) {
      case "div":
      case "span":
      case "svg":
      case "path":
      case "a":
      case "g":
      case "p":
      case "li":
        break;
      case "img":
        (_e("error", e), _e("load", e));
        var l = !1,
          n = !1,
          u;
        for (u in a)
          if (a.hasOwnProperty(u)) {
            var c = a[u];
            if (c != null)
              switch (u) {
                case "src":
                  l = !0;
                  break;
                case "srcSet":
                  n = !0;
                  break;
                case "children":
                case "dangerouslySetInnerHTML":
                  throw Error(f(137, t));
                default:
                  Pe(e, t, u, c, a, null);
              }
          }
        (n && Pe(e, t, "srcSet", a.srcSet, a, null),
          l && Pe(e, t, "src", a.src, a, null));
        return;
      case "input":
        _e("invalid", e);
        var m = (u = c = n = null),
          E = null,
          A = null;
        for (l in a)
          if (a.hasOwnProperty(l)) {
            var _ = a[l];
            if (_ != null)
              switch (l) {
                case "name":
                  n = _;
                  break;
                case "type":
                  c = _;
                  break;
                case "checked":
                  E = _;
                  break;
                case "defaultChecked":
                  A = _;
                  break;
                case "value":
                  u = _;
                  break;
                case "defaultValue":
                  m = _;
                  break;
                case "children":
                case "dangerouslySetInnerHTML":
                  if (_ != null) throw Error(f(137, t));
                  break;
                default:
                  Pe(e, t, l, _, a, null);
              }
          }
        Vn(e, u, m, E, A, c, n, !1);
        return;
      case "select":
        (_e("invalid", e), (l = c = u = null));
        for (n in a)
          if (a.hasOwnProperty(n) && ((m = a[n]), m != null))
            switch (n) {
              case "value":
                u = m;
                break;
              case "defaultValue":
                c = m;
                break;
              case "multiple":
                l = m;
              default:
                Pe(e, t, n, m, a, null);
            }
        ((t = u),
          (a = c),
          (e.multiple = !!l),
          t != null ? Fa(e, !!l, t, !1) : a != null && Fa(e, !!l, a, !0));
        return;
      case "textarea":
        (_e("invalid", e), (u = n = l = null));
        for (c in a)
          if (a.hasOwnProperty(c) && ((m = a[c]), m != null))
            switch (c) {
              case "value":
                l = m;
                break;
              case "defaultValue":
                n = m;
                break;
              case "children":
                u = m;
                break;
              case "dangerouslySetInnerHTML":
                if (m != null) throw Error(f(91));
                break;
              default:
                Pe(e, t, c, m, a, null);
            }
        Yi(e, l, n, u);
        return;
      case "option":
        for (E in a)
          if (a.hasOwnProperty(E) && ((l = a[E]), l != null))
            switch (E) {
              case "selected":
                e.selected =
                  l && typeof l != "function" && typeof l != "symbol";
                break;
              default:
                Pe(e, t, E, l, a, null);
            }
        return;
      case "dialog":
        (_e("beforetoggle", e),
          _e("toggle", e),
          _e("cancel", e),
          _e("close", e));
        break;
      case "iframe":
      case "object":
        _e("load", e);
        break;
      case "video":
      case "audio":
        for (l = 0; l < zc.length; l++) _e(zc[l], e);
        break;
      case "image":
        (_e("error", e), _e("load", e));
        break;
      case "details":
        _e("toggle", e);
        break;
      case "embed":
      case "source":
      case "link":
        (_e("error", e), _e("load", e));
      case "area":
      case "base":
      case "br":
      case "col":
      case "hr":
      case "keygen":
      case "meta":
      case "param":
      case "track":
      case "wbr":
      case "menuitem":
        for (A in a)
          if (a.hasOwnProperty(A) && ((l = a[A]), l != null))
            switch (A) {
              case "children":
              case "dangerouslySetInnerHTML":
                throw Error(f(137, t));
              default:
                Pe(e, t, A, l, a, null);
            }
        return;
      default:
        if (Ea(t)) {
          for (_ in a)
            a.hasOwnProperty(_) &&
              ((l = a[_]), l !== void 0 && wf(e, t, _, l, a, void 0));
          return;
        }
    }
    for (m in a)
      a.hasOwnProperty(m) && ((l = a[m]), l != null && Pe(e, t, m, l, a, null));
  }
  var Yy = {};
  function Ly(e, t, a, l) {
    switch (t) {
      case "div":
      case "span":
      case "svg":
      case "path":
      case "a":
      case "g":
      case "p":
      case "li":
        break;
      case "input":
        var n = null,
          u = null,
          c = null,
          m = null,
          E = null,
          A = null,
          _ = null;
        for (D in a) {
          var G = a[D];
          if (a.hasOwnProperty(D) && G != null)
            switch (D) {
              case "checked":
                break;
              case "value":
                break;
              case "defaultValue":
                E = G;
              default:
                l.hasOwnProperty(D) || Pe(e, t, D, null, l, G);
            }
        }
        for (var C in l) {
          var D = l[C];
          if (((G = a[C]), l.hasOwnProperty(C) && (D != null || G != null)))
            switch (C) {
              case "type":
                (D !== G && (Le = !0), (u = D));
                break;
              case "name":
                (D !== G && (Le = !0), (n = D));
                break;
              case "checked":
                (D !== G && (Le = !0), (A = D));
                break;
              case "defaultChecked":
                (D !== G && (Le = !0), (_ = D));
                break;
              case "value":
                (D !== G && (Le = !0), (c = D));
                break;
              case "defaultValue":
                (D !== G && (Le = !0), (m = D));
                break;
              case "children":
              case "dangerouslySetInnerHTML":
                if (D != null) throw Error(f(137, t));
                break;
              default:
                D !== G && Pe(e, t, C, D, l, G);
            }
        }
        Il(e, c, m, E, A, _, u, n);
        return;
      case "select":
        D = c = m = C = null;
        for (u in a)
          if (((E = a[u]), a.hasOwnProperty(u) && E != null))
            switch (u) {
              case "value":
                break;
              case "multiple":
                D = E;
              default:
                l.hasOwnProperty(u) || Pe(e, t, u, null, l, E);
            }
        for (n in l)
          if (
            ((u = l[n]),
            (E = a[n]),
            l.hasOwnProperty(n) && (u != null || E != null))
          )
            switch (n) {
              case "value":
                (u !== E && (Le = !0), (C = u));
                break;
              case "defaultValue":
                (u !== E && (Le = !0), (m = u));
                break;
              case "multiple":
                (u !== E && (Le = !0), (c = u));
              default:
                u !== E && Pe(e, t, n, u, l, E);
            }
        ((t = m),
          (a = c),
          (l = D),
          C != null
            ? Fa(e, !!a, C, !1)
            : !!l != !!a &&
              (t != null ? Fa(e, !!a, t, !0) : Fa(e, !!a, a ? [] : "", !1)));
        return;
      case "textarea":
        D = C = null;
        for (m in a)
          if (
            ((n = a[m]),
            a.hasOwnProperty(m) && n != null && !l.hasOwnProperty(m))
          )
            switch (m) {
              case "value":
                break;
              case "children":
                break;
              default:
                Pe(e, t, m, null, l, n);
            }
        for (c in l)
          if (
            ((n = l[c]),
            (u = a[c]),
            l.hasOwnProperty(c) && (n != null || u != null))
          )
            switch (c) {
              case "value":
                (n !== u && (Le = !0), (C = n));
                break;
              case "defaultValue":
                (n !== u && (Le = !0), (D = n));
                break;
              case "children":
                break;
              case "dangerouslySetInnerHTML":
                if (n != null) throw Error(f(91));
                break;
              default:
                n !== u && Pe(e, t, c, n, l, u);
            }
        qi(e, C, D);
        return;
      case "option":
        for (var I in a)
          if (
            ((C = a[I]),
            a.hasOwnProperty(I) && C != null && !l.hasOwnProperty(I))
          )
            switch (I) {
              case "selected":
                e.selected = !1;
                break;
              default:
                Pe(e, t, I, null, l, C);
            }
        for (E in l)
          if (
            ((C = l[E]),
            (D = a[E]),
            l.hasOwnProperty(E) && C !== D && (C != null || D != null))
          )
            switch (E) {
              case "selected":
                (C !== D && (Le = !0),
                  (e.selected =
                    C && typeof C != "function" && typeof C != "symbol"));
                break;
              default:
                Pe(e, t, E, C, l, D);
            }
        return;
      case "img":
      case "link":
      case "area":
      case "base":
      case "br":
      case "col":
      case "embed":
      case "hr":
      case "keygen":
      case "meta":
      case "param":
      case "source":
      case "track":
      case "wbr":
      case "menuitem":
        for (var ue in a)
          ((C = a[ue]),
            a.hasOwnProperty(ue) &&
              C != null &&
              !l.hasOwnProperty(ue) &&
              Pe(e, t, ue, null, l, C));
        for (A in l)
          if (
            ((C = l[A]),
            (D = a[A]),
            l.hasOwnProperty(A) && C !== D && (C != null || D != null))
          )
            switch (A) {
              case "children":
              case "dangerouslySetInnerHTML":
                if (C != null) throw Error(f(137, t));
                break;
              default:
                Pe(e, t, A, C, l, D);
            }
        return;
      default:
        if (Ea(t)) {
          for (var Ne in a)
            ((C = a[Ne]),
              a.hasOwnProperty(Ne) &&
                C !== void 0 &&
                !l.hasOwnProperty(Ne) &&
                wf(e, t, Ne, void 0, l, C));
          for (_ in l)
            ((C = l[_]),
              (D = a[_]),
              !l.hasOwnProperty(_) ||
                C === D ||
                (C === void 0 && D === void 0) ||
                wf(e, t, _, C, l, D));
          return;
        }
    }
    for (var x in a)
      ((C = a[x]),
        a.hasOwnProperty(x) &&
          C != null &&
          !l.hasOwnProperty(x) &&
          Pe(e, t, x, null, l, C));
    for (G in l)
      ((C = l[G]),
        (D = a[G]),
        !l.hasOwnProperty(G) ||
          C === D ||
          (C == null && D == null) ||
          Pe(e, t, G, C, l, D));
  }
  function sh(e) {
    switch (e) {
      case "css":
      case "script":
      case "font":
      case "img":
      case "image":
      case "input":
      case "link":
        return !0;
      default:
        return !1;
    }
  }
  function Gy() {
    if (typeof performance.getEntriesByType == "function") {
      for (
        var e = 0, t = 0, a = performance.getEntriesByType("resource"), l = 0;
        l < a.length;
        l++
      ) {
        var n = a[l],
          u = n.transferSize,
          c = n.initiatorType,
          m = n.duration;
        if (u && m && sh(c)) {
          for (c = 0, m = n.responseEnd, l += 1; l < a.length; l++) {
            var E = a[l],
              A = E.startTime;
            if (A > m) break;
            var _ = E.transferSize,
              G = E.initiatorType;
            _ &&
              sh(G) &&
              ((E = E.responseEnd), (c += _ * (E < m ? 1 : (m - A) / (E - A))));
          }
          if ((--l, (t += (8 * (u + c)) / (n.duration / 1e3)), e++, 10 < e))
            break;
        }
      }
      if (0 < e) return t / e / 1e6;
    }
    return navigator.connection &&
      ((e = navigator.connection.downlink), typeof e == "number")
      ? e
      : 5;
  }
  var Of = null,
    Df = null;
  function Nc(e) {
    return e.nodeType === 9 ? e : e.ownerDocument;
  }
  function fh(e) {
    switch (e) {
      case "http://www.w3.org/2000/svg":
        return 1;
      case "http://www.w3.org/1998/Math/MathML":
        return 2;
      default:
        return 0;
    }
  }
  function mh(e, t) {
    if (e === 0)
      switch (t) {
        case "svg":
          return 1;
        case "math":
          return 2;
        default:
          return 0;
      }
    return e === 1 && t === "foreignObject" ? 0 : e;
  }
  function dh(e, t, a, l) {
    return (
      (a = Nc(a).createElement(e)),
      (a[Et] = l),
      (a[Ut] = t),
      Zt(a, e, t),
      yt(a),
      a
    );
  }
  function Rf(e, t) {
    return (
      e === "textarea" ||
      e === "noscript" ||
      typeof t.children == "string" ||
      typeof t.children == "number" ||
      typeof t.children == "bigint" ||
      (typeof t.dangerouslySetInnerHTML == "object" &&
        t.dangerouslySetInnerHTML !== null &&
        t.dangerouslySetInnerHTML.__html != null)
    );
  }
  var _f = null;
  function Xy() {
    var e = window.event;
    return e && e.type === "popstate"
      ? e === _f
        ? !1
        : ((_f = e), !0)
      : ((_f = null), !1);
  }
  var Uf = typeof setTimeout == "function" ? setTimeout : void 0,
    ky = typeof clearTimeout == "function" ? clearTimeout : void 0,
    hh = typeof Promise == "function" ? Promise : void 0,
    yh =
      typeof requestAnimationFrame == "function" ? requestAnimationFrame : Uf,
    Vy =
      typeof queueMicrotask == "function"
        ? queueMicrotask
        : typeof hh < "u"
          ? function (e) {
              return hh.resolve(null).then(e).catch(Qy);
            }
          : Uf;
  function Qy(e) {
    setTimeout(function () {
      throw e;
    });
  }
  function wn(e) {
    return e === "head";
  }
  function vh(e, t) {
    var a = t,
      l = 0;
    do {
      var n = a.nextSibling;
      if ((e.removeChild(a), n && n.nodeType === 8))
        if (((a = n.data), a === "/$" || a === "/&")) {
          if (l === 0) {
            (e.removeChild(n), zi(t));
            return;
          }
          l--;
        } else if (
          a === "$" ||
          a === "$?" ||
          a === "$~" ||
          a === "$!" ||
          a === "&"
        )
          l++;
        else if (a === "html") Xf(e.ownerDocument.documentElement);
        else if (a === "head") {
          ((a = e.ownerDocument.head), Xf(a));
          for (var u = a.firstChild; u; ) {
            var c = u.nextSibling,
              m = u.nodeName;
            (u[ul] ||
              m === "SCRIPT" ||
              m === "STYLE" ||
              (m === "LINK" && u.rel.toLowerCase() === "stylesheet") ||
              a.removeChild(u),
              (u = c));
          }
        } else a === "body" && Xf(e.ownerDocument.body);
      a = n;
    } while (a);
    zi(t);
  }
  function ph(e, t) {
    var a = e;
    e = 0;
    do {
      var l = a.nextSibling;
      if (
        (a.nodeType === 1
          ? t
            ? ((a._stashedDisplay = a.style.display),
              (a.style.display = "none"))
            : ((a.style.display = a._stashedDisplay || ""),
              a.getAttribute("style") === "" && a.removeAttribute("style"))
          : a.nodeType === 3 &&
            (t
              ? ((a._stashedText = a.nodeValue), (a.nodeValue = ""))
              : (a.nodeValue = a._stashedText || "")),
        l && l.nodeType === 8)
      )
        if (((a = l.data), a === "/$")) {
          if (e === 0) break;
          e--;
        } else (a !== "$" && a !== "$?" && a !== "$~" && a !== "$!") || e++;
      a = l;
    } while (a);
  }
  function gh(e, t, a) {
    if (
      ((t = CSS.escape(t) !== t ? "r-" + btoa(t).replace(/=/g, "") : t),
      (e.style.viewTransitionName = t),
      a != null && (e.style.viewTransitionClass = a),
      (a = getComputedStyle(e)),
      a.display === "inline")
    ) {
      if (((t = e.getClientRects()), t.length === 1)) var l = 1;
      else
        for (var n = (l = 0); n < t.length; n++) {
          var u = t[n];
          0 < u.width && 0 < u.height && l++;
        }
      l === 1 &&
        ((e = e.style),
        (e.display = t.length === 1 ? "inline-block" : "block"),
        (e.marginTop = "-" + a.paddingTop),
        (e.marginBottom = "-" + a.paddingBottom));
    }
  }
  function Eh(e, t) {
    ((e = e.style), (t = t.style));
    var a =
      t != null
        ? t.hasOwnProperty("viewTransitionName")
          ? t.viewTransitionName
          : t.hasOwnProperty("view-transition-name")
            ? t["view-transition-name"]
            : null
        : null;
    ((e.viewTransitionName =
      a == null || typeof a == "boolean" ? "" : ("" + a).trim()),
      (a =
        t != null
          ? t.hasOwnProperty("viewTransitionClass")
            ? t.viewTransitionClass
            : t.hasOwnProperty("view-transition-class")
              ? t["view-transition-class"]
              : null
          : null),
      (e.viewTransitionClass =
        a == null || typeof a == "boolean" ? "" : ("" + a).trim()),
      e.display === "inline-block" &&
        (t == null
          ? (e.display = e.margin = "")
          : ((a = t.display),
            (e.display = a == null || typeof a == "boolean" ? "" : a),
            (a = t.margin),
            a != null
              ? (e.margin = a)
              : ((a = t.hasOwnProperty("marginTop")
                  ? t.marginTop
                  : t["margin-top"]),
                (e.marginTop = a == null || typeof a == "boolean" ? "" : a),
                (t = t.hasOwnProperty("marginBottom")
                  ? t.marginBottom
                  : t["margin-bottom"]),
                (e.marginBottom =
                  t == null || typeof t == "boolean" ? "" : t)))));
  }
  function Zy(e, t, a) {
    return (
      (a = a.ownerDocument.defaultView),
      {
        rect: e,
        abs: t.position === "absolute" || t.position === "fixed",
        clip:
          t.clipPath !== "none" ||
          t.overflow !== "visible" ||
          t.filter !== "none" ||
          t.mask !== "none" ||
          t.mask !== "none" ||
          t.borderRadius !== "0px",
        view:
          0 <= e.bottom &&
          0 <= e.right &&
          e.top <= a.innerHeight &&
          e.left <= a.innerWidth,
      }
    );
  }
  function Hf(e) {
    var t = e.getBoundingClientRect(),
      a = getComputedStyle(e);
    return Zy(t, a, e);
  }
  function Ky(e) {
    return e.documentElement.clientHeight;
  }
  function Jy(e) {
    (this.addEventListener("load", e), this.addEventListener("error", e));
  }
  function Fy(e, t, a, l, n, u, c, m, E) {
    var A = t.nodeType === 9 ? t : t.ownerDocument;
    try {
      var _ = A.startViewTransition({
        update: function () {
          var C = A.defaultView,
            D = C.navigation && C.navigation.transition,
            I = A.fonts.status;
          l();
          var ue = [];
          if (
            (I === "loaded" &&
              (Ky(A), A.fonts.status === "loading" && ue.push(A.fonts.ready)),
            (I = ue.length),
            e !== null)
          )
            for (var Ne = e.suspenseyImages, x = 0, S = 0; S < Ne.length; S++) {
              var O = Ne[S];
              if (!O.complete) {
                var L = O.getBoundingClientRect();
                if (
                  0 < L.bottom &&
                  0 < L.right &&
                  L.top < C.innerHeight &&
                  L.left < C.innerWidth
                ) {
                  if (((x += Lh(O)), x > fo)) {
                    ue.length = I;
                    break;
                  }
                  ((O = new Promise(Jy.bind(O))), ue.push(O));
                }
              }
            }
          if (0 < ue.length)
            return (
              (C = Promise.race([
                Promise.all(ue),
                new Promise(function (ae) {
                  return setTimeout(ae, 500);
                }),
              ]).then(n, n)),
              (D ? Promise.allSettled([D.finished, C]) : C).then(u, u)
            );
          if ((n(), D)) return D.finished.then(u, u);
          u();
        },
        types: a,
      });
      A.__reactViewTransition = _;
      var G = [];
      return (
        _.ready.then(
          function () {
            for (
              var C = A.documentElement.getAnimations({ subtree: !0 }), D = 0;
              D < C.length;
              D++
            ) {
              var I = C[D],
                ue = I.effect,
                Ne = ue.pseudoElement;
              if (Ne != null && Ne.startsWith("::view-transition")) {
                (G.push(I), (I = ue.getKeyframes()));
                for (var x = (Ne = void 0), S = !0, O = 0; O < I.length; O++) {
                  var L = I[O],
                    ae = L.width;
                  if (Ne === void 0) Ne = ae;
                  else if (Ne !== ae) {
                    S = !1;
                    break;
                  }
                  if (((ae = L.height), x === void 0)) x = ae;
                  else if (x !== ae) {
                    S = !1;
                    break;
                  }
                  (delete L.width,
                    delete L.height,
                    L.transform === "none" && delete L.transform);
                }
                S &&
                  Ne !== void 0 &&
                  x !== void 0 &&
                  (ue.setKeyframes(I),
                  (S = getComputedStyle(ue.target, ue.pseudoElement)),
                  S.width !== Ne || S.height !== x) &&
                  ((S = I[0]),
                  (S.width = Ne),
                  (S.height = x),
                  (S = I[I.length - 1]),
                  (S.width = Ne),
                  (S.height = x),
                  ue.setKeyframes(I));
              }
            }
            c();
          },
          function (C) {
            A.__reactViewTransition === _ && (A.__reactViewTransition = null);
            try {
              if (typeof C == "object" && C !== null)
                switch (C.name) {
                  case "InvalidStateError":
                    (C.message ===
                      "View transition was skipped because document visibility state is hidden." ||
                      C.message ===
                        "Skipping view transition because document visibility state has become hidden." ||
                      C.message ===
                        "Skipping view transition because viewport size changed." ||
                      C.message ===
                        "Transition was aborted because of invalid state") &&
                      (C = null);
                }
              C !== null && E(C);
            } finally {
              (l(), n(), c());
            }
          },
        ),
        _.finished.finally(function () {
          for (var C = 0; C < G.length; C++) G[C].cancel();
          (A.__reactViewTransition === _ && (A.__reactViewTransition = null),
            m());
        }),
        _
      );
    } catch {
      return (l(), n(), c(), null);
    }
  }
  function pu(e, t) {
    ((this._scope = document.documentElement),
      (this._selector = "::view-transition-" + e + "(" + t + ")"));
  }
  ((pu.prototype.animate = function (e, t) {
    return (
      (t = typeof t == "number" ? { duration: t } : K({}, t)),
      (t.pseudoElement = this._selector),
      this._scope.animate(e, t)
    );
  }),
    (pu.prototype.getAnimations = function () {
      for (
        var e = this._scope,
          t = this._selector,
          a = e.getAnimations({ subtree: !0 }),
          l = [],
          n = 0;
        n < a.length;
        n++
      ) {
        var u = a[n].effect;
        u !== null && u.target === e && u.pseudoElement === t && l.push(a[n]);
      }
      return l;
    }),
    (pu.prototype.getComputedStyle = function () {
      return getComputedStyle(this._scope, this._selector);
    }));
  function bh(e) {
    return {
      name: e,
      group: new pu("group", e),
      imagePair: new pu("image-pair", e),
      old: new pu("old", e),
      new: new pu("new", e),
    };
  }
  function Ca(e) {
    ((this._fragmentFiber = e),
      (this._observers = this._eventListeners = null));
  }
  Ca.prototype.addEventListener = function (e, t, a) {
    var l = null,
      n = null;
    if (
      !(
        a != null &&
        typeof a != "boolean" &&
        ((l = a.signal || null), l !== null && l.aborted)
      )
    ) {
      this._eventListeners === null && (this._eventListeners = []);
      var u = this._eventListeners;
      if (zh(u, e, t, a) === -1) {
        var c = this,
          m = t;
        (a != null &&
          typeof a != "boolean" &&
          a.once === !0 &&
          (m = function (E) {
            (c.removeEventListener(e, t, a),
              typeof t == "function" ? t.call(this, E) : t.handleEvent(E));
          }),
          l !== null &&
            ((n = c.removeEventListener.bind(c, e, t, a)),
            l.addEventListener("abort", n, { once: !0 }),
            (n = l.removeEventListener.bind(l, "abort", n))),
          (l = vi(a)),
          u.push({
            type: e,
            listener: t,
            optionsOrUseCapture: a,
            attachedListener: m,
            cleanup: n,
          }),
          p(this._fragmentFiber.child, !1, $y, e, m, l));
      }
      this._eventListeners = u;
    }
  };
  function $y(e, t, a, l) {
    return (V(e).addEventListener(t, a, l), !1);
  }
  Ca.prototype.removeEventListener = function (e, t, a) {
    var l = this._eventListeners;
    if (l !== null && ((t = zh(l, e, t, a)), t !== -1)) {
      var n = l[t];
      a = n.attachedListener;
      var u = n.cleanup;
      ((n = vi(n.optionsOrUseCapture)),
        p(this._fragmentFiber.child, !1, Iy, e, a, n),
        l.splice(t, 1),
        u !== null && u());
    }
  };
  function Iy(e, t, a, l) {
    return (V(e).removeEventListener(t, a, l), !1);
  }
  function vi(e) {
    return e != null &&
      typeof e != "boolean" &&
      (e.once === !0 || e.signal instanceof AbortSignal)
      ? { capture: e.capture, passive: e.passive }
      : e;
  }
  function Sh(e) {
    return e == null
      ? "c=0"
      : typeof e == "boolean"
        ? "c=" + (e ? "1" : "0")
        : "c=" + (e.capture ? "1" : "0");
  }
  function zh(e, t, a, l) {
    if (e.length === 0) return -1;
    l = Sh(l);
    for (var n = 0; n < e.length; n++) {
      var u = e[n];
      if (u.type === t && u.listener === a && Sh(u.optionsOrUseCapture) === l)
        return n;
    }
    return -1;
  }
  ((Ca.prototype.dispatchEvent = function (e) {
    var t = j(this._fragmentFiber);
    if (t === null) return !0;
    t = V(t);
    var a = this._eventListeners;
    if ((a !== null && 0 < a.length) || !e.bubbles) {
      var l =
        t.nodeType === 9 ? t.createComment("") : document.createTextNode("");
      if (a)
        for (var n = 0; n < a.length; n++) {
          var u = a[n];
          l.addEventListener(
            u.type,
            u.attachedListener,
            vi(u.optionsOrUseCapture),
          );
        }
      if ((t.appendChild(l), (e = l.dispatchEvent(e)), a))
        for (n = 0; n < a.length; n++)
          ((u = a[n]),
            l.removeEventListener(
              u.type,
              u.attachedListener,
              vi(u.optionsOrUseCapture),
            ));
      return (t.removeChild(l), e);
    }
    return t.dispatchEvent(e);
  }),
    (Ca.prototype.focus = function (e) {
      p(this._fragmentFiber.child, !0, Th, e, void 0, void 0);
    }));
  function Th(e, t) {
    return e.tag === 6 ? !1 : ((e = V(e)), ov(e, t));
  }
  Ca.prototype.focusLast = function (e) {
    var t = [];
    p(this._fragmentFiber.child, !0, Bf, t, void 0, void 0);
    for (var a = t.length - 1; 0 <= a && !Th(t[a], e); a--);
  };
  function Bf(e, t) {
    return (t.push(e), !1);
  }
  Ca.prototype.blur = function () {
    var e = j(this._fragmentFiber);
    e !== null &&
      ((e = V(e)),
      (e = Nc(e).activeElement),
      e !== null && p(this._fragmentFiber.child, !1, Wy, e, void 0, void 0));
  };
  function Wy(e, t) {
    return e.tag === 6
      ? !1
      : ((e = V(e)), e === t || e.contains(t) ? (t.blur(), !0) : !1);
  }
  Ca.prototype.observeUsing = function (e) {
    (this._observers === null && (this._observers = new Set()),
      this._observers.add(e),
      p(this._fragmentFiber.child, !1, Py, e, void 0, void 0));
  };
  function Py(e, t) {
    return (e.tag === 6 || ((e = V(e)), t.observe(e)), !1);
  }
  Ca.prototype.unobserveUsing = function (e) {
    var t = this._observers;
    if (t !== null && t.has(e)) {
      (t.delete(e), p(this._fragmentFiber.child, !1, ev, e, void 0, void 0));
      for (var a = (t = 0); a < al.length; a++) {
        var l = al[a];
        l.fragmentInstance === this && l.observer === e
          ? e.unobserve(l.instance)
          : (al[t++] = l);
      }
      al.length = t;
    }
  };
  function ev(e, t) {
    return (e.tag === 6 || ((e = V(e)), t.unobserve(e)), !1);
  }
  var al = [],
    jf = !1;
  function tv(e, t, a) {
    (al.push({ fragmentInstance: e, observer: t, instance: a }),
      jf ||
        ((jf = !0),
        sv(function () {
          jf = !1;
          var l = al;
          al = [];
          for (var n = 0; n < l.length; n++) {
            var u = l[n];
            u.observer.unobserve(u.instance);
          }
        })));
  }
  Ca.prototype.getClientRects = function () {
    var e = [];
    return (p(this._fragmentFiber.child, !1, av, e, void 0, void 0), e);
  };
  function av(e, t) {
    if (e.tag === 6) {
      e = e.stateNode;
      var a = e.ownerDocument.createRange();
      (a.selectNodeContents(e), t.push.apply(t, a.getClientRects()));
    } else ((e = V(e)), t.push.apply(t, e.getClientRects()));
    return !1;
  }
  ((Ca.prototype.getRootNode = function (e) {
    var t = j(this._fragmentFiber);
    return t === null ? this : V(t).getRootNode(e);
  }),
    (Ca.prototype.compareDocumentPosition = function (e) {
      var t = j(this._fragmentFiber);
      if (t === null) return Node.DOCUMENT_POSITION_DISCONNECTED;
      var a = [];
      p(this._fragmentFiber.child, !1, Bf, a, void 0, void 0);
      var l = V(t);
      if (a.length === 0) {
        if (((a = l), Z(this._fragmentFiber))) {
          e: {
            for (t = this._fragmentFiber.return; t !== null; ) {
              if (t.tag === 4) {
                t = t.stateNode.containerInfo;
                break e;
              }
              if (t.tag === 3 || t.tag === 5 || t.tag === 27) break;
              t = t.return;
            }
            t = null;
          }
          t != null && (a = t);
        }
        t = this._fragmentFiber;
        var n = (l = a.compareDocumentPosition(e));
        return (
          a === e
            ? (n = Node.DOCUMENT_POSITION_CONTAINS)
            : l & Node.DOCUMENT_POSITION_CONTAINED_BY &&
              ((a = k(t)[1]),
              a === null
                ? (n = Node.DOCUMENT_POSITION_PRECEDING)
                : ((e = V(a).compareDocumentPosition(e)),
                  (n =
                    e === 0 || e & Node.DOCUMENT_POSITION_FOLLOWING
                      ? Node.DOCUMENT_POSITION_FOLLOWING
                      : Node.DOCUMENT_POSITION_PRECEDING))),
          (n |= Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC)
        );
      }
      ((t = V(a[0])), (n = V(a[a.length - 1])));
      var u = Z(this._fragmentFiber) ? t.parentElement : l;
      if (u == null) return Node.DOCUMENT_POSITION_DISCONNECTED;
      ((l = u.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_CONTAINED_BY),
        (u =
          u.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_CONTAINED_BY));
      var c = t.compareDocumentPosition(e),
        m = n.compareDocumentPosition(e),
        E =
          c & Node.DOCUMENT_POSITION_CONTAINED_BY ||
          m & Node.DOCUMENT_POSITION_CONTAINED_BY;
      return (
        (m =
          l &&
          u &&
          c & Node.DOCUMENT_POSITION_FOLLOWING &&
          m & Node.DOCUMENT_POSITION_PRECEDING),
        (t =
          (l && t === e) || (u && n === e) || E || m
            ? Node.DOCUMENT_POSITION_CONTAINED_BY
            : (!l && t === e) || (!u && n === e)
              ? Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC
              : c),
        t & Node.DOCUMENT_POSITION_DISCONNECTED ||
        t & Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC ||
        lv(t, this._fragmentFiber, a[0], a[a.length - 1], e)
          ? t
          : Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC
      );
    }));
  function lv(e, t, a, l, n) {
    var u = ra(n);
    if (e & Node.DOCUMENT_POSITION_CONTAINED_BY) {
      if ((a = !!u))
        e: {
          for (; u !== null; ) {
            if (u.tag === 7 && (u === t || u.alternate === t)) {
              a = !0;
              break e;
            }
            u = u.return;
          }
          a = !1;
        }
      return a;
    }
    if (e & Node.DOCUMENT_POSITION_CONTAINS) {
      if (u === null)
        return (
          (u = n.ownerDocument),
          n === u || n === u.documentElement || n === u.body
        );
      e: {
        for (u = t, t = j(t); u !== null; ) {
          if (
            !(
              (u.tag !== 5 && u.tag !== 3 && u.tag !== 27) ||
              (u !== t && u.alternate !== t)
            )
          ) {
            u = !0;
            break e;
          }
          u = u.return;
        }
        u = !1;
      }
      return u;
    }
    return e & Node.DOCUMENT_POSITION_PRECEDING
      ? ((t = !!u) &&
          !(t = u === a) &&
          ((t = le(a, u, P)),
          t === null
            ? (t = !1)
            : (p(t, !0, z, u, a), (u = oe), (oe = null), (t = u !== null))),
        t)
      : e & Node.DOCUMENT_POSITION_FOLLOWING
        ? ((t = !!u) &&
            !(t = u === l) &&
            ((t = le(l, u, P)),
            t === null
              ? (t = !1)
              : (p(t, !0, te, u, l),
                (u = oe),
                (ne = oe = null),
                (t = u !== null))),
          t)
        : !1;
  }
  function Nh(e, t) {
    var a = e.ownerDocument.createRange();
    (a.selectNodeContents(e),
      (e = a.getBoundingClientRect()),
      window.scrollTo(
        window.scrollX + e.left,
        t
          ? window.scrollY + e.top
          : window.scrollY + e.bottom - window.innerHeight,
      ));
  }
  Ca.prototype.scrollIntoView = function (e) {
    if (typeof e == "object") throw Error(f(566));
    var t = [];
    p(this._fragmentFiber.child, !1, Bf, t, void 0, void 0);
    var a = e !== !1;
    if (t.length === 0) {
      var l = k(this._fragmentFiber);
      if (
        ((l = a ? l[1] || l[0] || j(this._fragmentFiber) : l[0] || l[1]),
        l === null)
      )
        return;
      if (l.tag === 6) {
        ((e = V(l)), Nh(e, a));
        return;
      }
      if (((l = V(l)), l.nodeType !== 9)) {
        if (l.nodeType === 11) {
          ((a = "host" in l ? l.host : null),
            a !== null && a.scrollIntoView(e));
          return;
        }
        l.scrollIntoView(e);
      }
    }
    for (l = a ? t.length - 1 : 0; l !== (a ? -1 : t.length); ) {
      var n = t[l];
      (n.tag === 6 ? ((n = V(n)), Nh(n, a)) : V(n).scrollIntoView(e),
        (l += a ? -1 : 1));
    }
  };
  function nv(e, t) {
    return ((e = V(e)), Mh(e, t), !1);
  }
  function Mh(e, t) {
    (e.reactFragments == null && (e.reactFragments = new Set()),
      e.reactFragments.add(t));
  }
  function Ch(e, t) {
    var a = t._eventListeners;
    if (a !== null)
      for (var l = 0; l < a.length; l++) {
        var n = a[l];
        e.addEventListener(
          n.type,
          n.attachedListener,
          vi(n.optionsOrUseCapture),
        );
      }
    e.nodeType !== 3 &&
      ((a = t._observers),
      a !== null &&
        a.forEach(function (u) {
          for (var c = 0, m = 0; m < al.length; m++) {
            var E = al[m];
            (E.fragmentInstance !== t ||
              E.observer !== u ||
              E.instance !== e) &&
              (al[c++] = E);
          }
          ((al.length = c), u.observe(e));
        }),
      Mh(e, t));
  }
  function uv(e, t) {
    var a = t._eventListeners;
    if (a !== null)
      for (var l = 0; l < a.length; l++) {
        var n = a[l];
        e.removeEventListener(
          n.type,
          n.attachedListener,
          vi(n.optionsOrUseCapture),
        );
      }
    e.nodeType !== 3 &&
      ((a = t._observers),
      a !== null &&
        a.forEach(function (u) {
          typeof u.rootMargin == "string" ? tv(t, u, e) : u.unobserve(e);
        }),
      e.reactFragments != null && e.reactFragments.delete(t));
  }
  function qf(e) {
    var t = e.firstChild;
    for (t && t.nodeType === 10 && (t = t.nextSibling); t; ) {
      var a = t;
      switch (((t = t.nextSibling), a.nodeName)) {
        case "HTML":
        case "HEAD":
        case "BODY":
          (qf(a), Nl(a));
          continue;
        case "SCRIPT":
        case "STYLE":
          continue;
        case "LINK":
          if (a.rel.toLowerCase() === "stylesheet") continue;
      }
      e.removeChild(a);
    }
  }
  function iv(e, t, a, l) {
    for (; e.nodeType === 1; ) {
      var n = a;
      if (e.nodeName.toLowerCase() !== t.toLowerCase()) {
        if (!l && (e.nodeName !== "INPUT" || e.type !== "hidden")) break;
      } else if (l) {
        if (!e[ul])
          switch (t) {
            case "meta":
              if (!e.hasAttribute("itemprop")) break;
              return e;
            case "link":
              if (
                ((u = e.getAttribute("rel")),
                u === "stylesheet" && e.hasAttribute("data-precedence"))
              )
                break;
              if (
                u !== n.rel ||
                e.getAttribute("href") !==
                  (n.href == null || n.href === "" ? null : n.href) ||
                e.getAttribute("crossorigin") !==
                  (n.crossOrigin == null ? null : n.crossOrigin) ||
                e.getAttribute("title") !== (n.title == null ? null : n.title)
              )
                break;
              return e;
            case "style":
              if (e.hasAttribute("data-precedence")) break;
              return e;
            case "script":
              if (
                ((u = e.getAttribute("src")),
                (u !== (n.src == null ? null : n.src) ||
                  e.getAttribute("type") !== (n.type == null ? null : n.type) ||
                  e.getAttribute("crossorigin") !==
                    (n.crossOrigin == null ? null : n.crossOrigin)) &&
                  u &&
                  e.hasAttribute("async") &&
                  !e.hasAttribute("itemprop"))
              )
                break;
              return e;
            default:
              return e;
          }
      } else if (t === "input" && e.type === "hidden") {
        var u = n.name == null ? null : "" + n.name;
        if (n.type === "hidden" && e.getAttribute("name") === u) return e;
      } else return e;
      if (((e = Ga(e.nextSibling)), e === null)) break;
    }
    return null;
  }
  function cv(e, t, a) {
    if (t === "") return null;
    for (; e.nodeType !== 3; )
      if (
        ((e.nodeType !== 1 || e.nodeName !== "INPUT" || e.type !== "hidden") &&
          !a) ||
        ((e = Ga(e.nextSibling)), e === null)
      )
        return null;
    return e;
  }
  function xh(e, t) {
    for (; e.nodeType !== 8; )
      if (
        ((e.nodeType !== 1 || e.nodeName !== "INPUT" || e.type !== "hidden") &&
          !t) ||
        ((e = Ga(e.nextSibling)), e === null)
      )
        return null;
    return e;
  }
  function Yf(e) {
    return e.data === "$?" || e.data === "$~";
  }
  function Lf(e) {
    return (
      e.data === "$!" ||
      (e.data === "$?" && e.ownerDocument.readyState !== "loading")
    );
  }
  function rv(e, t) {
    var a = e.ownerDocument;
    if (e.data === "$~") e._reactRetry = t;
    else if (e.data !== "$?" || a.readyState !== "loading") t();
    else {
      var l = function () {
        (t(), a.removeEventListener("DOMContentLoaded", l));
      };
      (a.addEventListener("DOMContentLoaded", l), (e._reactRetry = l));
    }
  }
  function Ga(e) {
    for (; e != null; e = e.nextSibling) {
      var t = e.nodeType;
      if (t === 1 || t === 3) break;
      if (t === 8) {
        if (
          ((t = e.data),
          t === "$" ||
            t === "$!" ||
            t === "$?" ||
            t === "$~" ||
            t === "&" ||
            t === "F!" ||
            t === "F")
        )
          break;
        if (t === "/$" || t === "/&") return null;
      }
    }
    return e;
  }
  var Gf = null;
  function Ah(e) {
    e = e.nextSibling;
    for (var t = 0; e; ) {
      if (e.nodeType === 8) {
        var a = e.data;
        if (a === "/$" || a === "/&") {
          if (t === 0) return Ga(e.nextSibling);
          t--;
        } else
          (a !== "$" && a !== "$!" && a !== "$?" && a !== "$~" && a !== "&") ||
            t++;
      }
      e = e.nextSibling;
    }
    return null;
  }
  function wh(e) {
    e = e.previousSibling;
    for (var t = 0; e; ) {
      if (e.nodeType === 8) {
        var a = e.data;
        if (a === "$" || a === "$!" || a === "$?" || a === "$~" || a === "&") {
          if (t === 0) return e;
          t--;
        } else (a !== "/$" && a !== "/&") || t++;
      }
      e = e.previousSibling;
    }
    return null;
  }
  function ov(e, t) {
    function a() {
      l = !0;
    }
    if (e.ownerDocument.activeElement === e) return !0;
    var l = !1;
    try {
      (e.ownerDocument.addEventListener("focus", a, !0),
        (e.focus || HTMLElement.prototype.focus).call(e, t));
    } finally {
      e.ownerDocument.removeEventListener("focus", a, !0);
    }
    return l;
  }
  function sv(e) {
    yh(function () {
      yh(function (t) {
        return e(t);
      });
    });
  }
  function Oh(e, t, a) {
    switch (((t = Nc(a)), e)) {
      case "html":
        if (((e = t.documentElement), !e)) throw Error(f(452));
        return e;
      case "head":
        if (((e = t.head), !e)) throw Error(f(453));
        return e;
      case "body":
        if (((e = t.body), !e)) throw Error(f(454));
        return e;
      default:
        throw Error(f(451));
    }
  }
  function Dh(e, t, a) {
    for (var l in a) {
      var n = a[l];
      a.hasOwnProperty(l) && n != null && Pe(e, t, l, null, Yy, n);
    }
    (a.dangerouslySetInnerHTML != null && (e.textContent = ""),
      e.onclick === mt && (e.onclick = null),
      Nl(e));
  }
  function Xf(e) {
    for (var t = e.attributes; t.length; ) e.removeAttributeNode(t[0]);
    Nl(e);
  }
  var Xa = new Map(),
    Rh = new Set();
  function Mc(e) {
    if (typeof e.getRootNode == "function") {
      var t = e.getRootNode();
      if (t.nodeType === 9 || t.nodeType === 11) return t;
    }
    return e.nodeType === 9 ? e : e.ownerDocument;
  }
  var kl = ve.d;
  ve.d = { f: fv, r: mv, D: dv, C: hv, L: yv, m: vv, X: gv, S: pv, M: Ev };
  function fv() {
    var e = kl.f(),
      t = ao();
    return e || t;
  }
  function mv(e) {
    var t = il(e);
    t !== null && t.tag === 5 && t.type === "form" ? Ud(t) : kl.r(e);
  }
  var pi = typeof document > "u" ? null : document;
  function _h(e, t, a) {
    var l = pi;
    if (l && typeof t == "string" && t) {
      var n = Ht(t);
      ((n = 'link[rel="' + e + '"][href="' + n + '"]'),
        typeof a == "string" && (n += '[crossorigin="' + a + '"]'),
        Rh.has(n) ||
          (Rh.add(n),
          (e = { rel: e, crossOrigin: a, href: t }),
          l.querySelector(n) === null &&
            ((t = l.createElement("link")),
            Zt(t, "link", e),
            yt(t),
            l.head.appendChild(t))));
    }
  }
  function dv(e) {
    (kl.D(e), _h("dns-prefetch", e, null));
  }
  function hv(e, t) {
    (kl.C(e, t), _h("preconnect", e, t));
  }
  function yv(e, t, a) {
    kl.L(e, t, a);
    var l = pi;
    if (l && e && t) {
      var n = 'link[rel="preload"][as="' + Ht(t) + '"]';
      t === "image" && a && a.imageSrcSet
        ? ((n += '[imagesrcset="' + Ht(a.imageSrcSet) + '"]'),
          typeof a.imageSizes == "string" &&
            (n += '[imagesizes="' + Ht(a.imageSizes) + '"]'))
        : (n += '[href="' + Ht(e) + '"]');
      var u = n;
      switch (t) {
        case "style":
          u = gi(e);
          break;
        case "script":
          u = Ei(e);
      }
      if (
        !(
          Xa.has(u) ||
          ((e = K(
            {
              rel: "preload",
              href: t === "image" && a && a.imageSrcSet ? void 0 : e,
              as: t,
            },
            a,
          )),
          Xa.set(u, e),
          l.querySelector(n) !== null ||
            (t === "style" && l.querySelector(Cc(u))) ||
            (t === "script" && l.querySelector(xc(u))))
        )
      ) {
        var c = l.createElement("link");
        (Zt(c, "link", e),
          t === "style" &&
            ((c[Jl] = !0),
            (c.onload = c.onerror =
              function () {
                Ou(c);
              })),
          yt(c),
          l.head.appendChild(c));
      }
    }
  }
  function vv(e, t) {
    kl.m(e, t);
    var a = pi;
    if (a && e) {
      var l = t && typeof t.as == "string" ? t.as : "script",
        n =
          'link[rel="modulepreload"][as="' + Ht(l) + '"][href="' + Ht(e) + '"]',
        u = n;
      switch (l) {
        case "audioworklet":
        case "paintworklet":
        case "serviceworker":
        case "sharedworker":
        case "worker":
        case "script":
          u = Ei(e);
      }
      if (
        !Xa.has(u) &&
        ((e = K({ rel: "modulepreload", href: e }, t)),
        Xa.set(u, e),
        a.querySelector(n) === null)
      ) {
        switch (l) {
          case "audioworklet":
          case "paintworklet":
          case "serviceworker":
          case "sharedworker":
          case "worker":
          case "script":
            if (a.querySelector(xc(u))) return;
        }
        ((l = a.createElement("link")),
          Zt(l, "link", e),
          yt(l),
          a.head.appendChild(l));
      }
    }
  }
  function pv(e, t, a) {
    kl.S(e, t, a);
    var l = pi;
    if (l && e) {
      var n = $l(l).hoistableStyles,
        u = gi(e);
      t = t || "default";
      var c = n.get(u);
      if (!c) {
        var m = { loading: 0, preload: null };
        if ((c = l.querySelector(Cc(u)))) m.loading = 5;
        else {
          ((e = K({ rel: "stylesheet", href: e, "data-precedence": t }, a)),
            (a = Xa.get(u)) && kf(e, a));
          var E = (c = l.createElement("link"));
          (yt(E),
            Zt(E, "link", e),
            (E._p = new Promise(function (A, _) {
              ((E.onload = A), (E.onerror = _));
            })),
            E.addEventListener("load", function () {
              m.loading |= 1;
            }),
            E.addEventListener("error", function () {
              m.loading |= 2;
            }),
            (m.loading |= 4),
            oo(c, t, l));
        }
        ((c = { type: "stylesheet", instance: c, count: 1, state: m }),
          n.set(u, c));
      }
    }
  }
  function gv(e, t) {
    kl.X(e, t);
    var a = pi;
    if (a && e) {
      var l = $l(a).hoistableScripts,
        n = Ei(e),
        u = l.get(n);
      u ||
        ((u = a.querySelector(xc(n))),
        u ||
          ((e = K({ src: e, async: !0 }, t)),
          (t = Xa.get(n)) && Vf(e, t),
          (u = a.createElement("script")),
          yt(u),
          Zt(u, "link", e),
          a.head.appendChild(u)),
        (u = { type: "script", instance: u, count: 1, state: null }),
        l.set(n, u));
    }
  }
  function Ev(e, t) {
    kl.M(e, t);
    var a = pi;
    if (a && e) {
      var l = $l(a).hoistableScripts,
        n = Ei(e),
        u = l.get(n);
      u ||
        ((u = a.querySelector(xc(n))),
        u ||
          ((e = K({ src: e, async: !0, type: "module" }, t)),
          (t = Xa.get(n)) && Vf(e, t),
          (u = a.createElement("script")),
          yt(u),
          Zt(u, "link", e),
          a.head.appendChild(u)),
        (u = { type: "script", instance: u, count: 1, state: null }),
        l.set(n, u));
    }
  }
  function Uh(e, t, a, l) {
    var n = (n = Va.current) ? Mc(n) : null;
    if (!n) throw Error(f(446));
    switch (e) {
      case "meta":
      case "title":
        return null;
      case "style":
        return typeof a.precedence == "string" && typeof a.href == "string"
          ? ((a = gi(a.href)),
            (t = $l(n).hoistableStyles),
            (l = t.get(a)),
            l ||
              ((l = { type: "style", instance: null, count: 0, state: null }),
              t.set(a, l)),
            l)
          : { type: "void", instance: null, count: 0, state: null };
      case "link":
        if (
          a.rel === "stylesheet" &&
          typeof a.href == "string" &&
          typeof a.precedence == "string"
        ) {
          e = gi(a.href);
          var u = $l(n).hoistableStyles,
            c = u.get(e);
          if (
            (c ||
              ((n = n.ownerDocument || n),
              (c = {
                type: "stylesheet",
                instance: null,
                count: 0,
                state: { loading: 0, preload: null },
              }),
              u.set(e, c),
              (u = n.querySelector(Cc(e)))
                ? u._p || ((c.instance = u), (c.state.loading = 5))
                : ((u = Xa.get(e)),
                  u ||
                    ((u = {
                      rel: "preload",
                      as: "style",
                      href: a.href,
                      crossOrigin: a.crossOrigin,
                      integrity: a.integrity,
                      media: a.media,
                      hrefLang: a.hrefLang,
                      referrerPolicy: a.referrerPolicy,
                    }),
                    Xa.set(e, u)),
                  bv(n, e, u, c.state))),
            t && l === null)
          )
            throw Error(f(528, ""));
          return c;
        }
        if (t && l !== null) throw Error(f(529, ""));
        return null;
      case "script":
        return (
          (t = a.async),
          (a = a.src),
          typeof a == "string" &&
          t &&
          typeof t != "function" &&
          typeof t != "symbol"
            ? ((a = Ei(a)),
              (t = $l(n).hoistableScripts),
              (l = t.get(a)),
              l ||
                ((l = {
                  type: "script",
                  instance: null,
                  count: 0,
                  state: null,
                }),
                t.set(a, l)),
              l)
            : { type: "void", instance: null, count: 0, state: null }
        );
      default:
        throw Error(f(444, e));
    }
  }
  function gi(e) {
    return 'href="' + Ht(e) + '"';
  }
  function Cc(e) {
    return 'link[rel="stylesheet"][' + e + "]";
  }
  function Hh(e) {
    return K({}, e, { "data-precedence": e.precedence, precedence: null });
  }
  function bv(e, t, a, l) {
    if ((t = e.querySelector('link[rel="preload"][as="style"][' + t + "]"))) {
      if (t[Jl] !== !0) {
        l.loading = 1;
        return;
      }
    } else
      ((t = e.createElement("link")),
        (t[Jl] = !0),
        (t.onload = t.onerror = Ou.bind(null, t)),
        Zt(t, "link", a),
        yt(t),
        e.head.appendChild(t));
    ((l.preload = t),
      t.addEventListener("load", function () {
        return (l.loading |= 1);
      }),
      t.addEventListener("error", function () {
        return (l.loading |= 2);
      }));
  }
  function Ei(e) {
    return '[src="' + Ht(e) + '"]';
  }
  function xc(e) {
    return "script[async]" + e;
  }
  function Bh(e, t, a) {
    if ((t.count++, t.instance === null))
      switch (t.type) {
        case "style":
          var l = e.querySelector('style[data-href~="' + Ht(a.href) + '"]');
          if (l) return ((t.instance = l), yt(l), l);
          var n = K({}, a, {
            "data-href": a.href,
            "data-precedence": a.precedence,
            href: null,
            precedence: null,
          });
          return (
            (l = (e.ownerDocument || e).createElement("style")),
            yt(l),
            Zt(l, "style", n),
            oo(l, a.precedence, e),
            (t.instance = l)
          );
        case "stylesheet":
          n = gi(a.href);
          var u = e.querySelector(Cc(n));
          if (u) return ((t.state.loading |= 4), (t.instance = u), yt(u), u);
          ((l = Hh(a)),
            (n = Xa.get(n)) && kf(l, n),
            (u = (e.ownerDocument || e).createElement("link")),
            yt(u));
          var c = u;
          return (
            (c._p = new Promise(function (m, E) {
              ((c.onload = m), (c.onerror = E));
            })),
            Zt(u, "link", l),
            (t.state.loading |= 4),
            oo(u, a.precedence, e),
            (t.instance = u)
          );
        case "script":
          return (
            (u = Ei(a.src)),
            (n = e.querySelector(xc(u)))
              ? ((t.instance = n), yt(n), n)
              : ((l = a),
                (n = Xa.get(u)) && ((l = K({}, a)), Vf(l, n)),
                (e = e.ownerDocument || e),
                (n = e.createElement("script")),
                yt(n),
                Zt(n, "link", l),
                e.head.appendChild(n),
                (t.instance = n))
          );
        case "void":
          return null;
        default:
          throw Error(f(443, t.type));
      }
    else
      t.type === "stylesheet" &&
        (t.state.loading & 4) === 0 &&
        ((l = t.instance), (t.state.loading |= 4), oo(l, a.precedence, e));
    return t.instance;
  }
  function oo(e, t, a) {
    for (
      var l = a.querySelectorAll(
          'link[rel="stylesheet"][data-precedence],style[data-precedence]',
        ),
        n = l.length ? l[l.length - 1] : null,
        u = n,
        c = 0;
      c < l.length;
      c++
    ) {
      var m = l[c];
      if (m.dataset.precedence === t) u = m;
      else if (u !== n) break;
    }
    u
      ? u.parentNode.insertBefore(e, u.nextSibling)
      : ((t = a.nodeType === 9 ? a.head : a), t.insertBefore(e, t.firstChild));
  }
  function kf(e, t) {
    (e.crossOrigin == null && (e.crossOrigin = t.crossOrigin),
      e.referrerPolicy == null && (e.referrerPolicy = t.referrerPolicy),
      e.title == null && (e.title = t.title));
  }
  function Vf(e, t) {
    (e.crossOrigin == null && (e.crossOrigin = t.crossOrigin),
      e.referrerPolicy == null && (e.referrerPolicy = t.referrerPolicy),
      e.integrity == null && (e.integrity = t.integrity));
  }
  var so = null;
  function jh(e, t, a) {
    if (so === null) {
      var l = new Map(),
        n = (so = new Map());
      n.set(a, l);
    } else ((n = so), (l = n.get(a)), l || ((l = new Map()), n.set(a, l)));
    if (l.has(e)) return l;
    for (
      l.set(e, null), a = a.getElementsByTagName(e), n = 0;
      n < a.length;
      n++
    ) {
      var u = a[n];
      if (
        !(
          u[ul] ||
          u[Et] ||
          (e === "link" && u.getAttribute("rel") === "stylesheet")
        ) &&
        u.namespaceURI !== "http://www.w3.org/2000/svg"
      ) {
        var c = u.getAttribute(t) || "";
        c = e + c;
        var m = l.get(c);
        m ? m.push(u) : l.set(c, [u]);
      }
    }
    return l;
  }
  function Qf(e, t, a) {
    ((e = e.ownerDocument || e),
      e.head.insertBefore(
        a,
        t === "title" ? e.querySelector("head > title") : null,
      ));
  }
  function Sv(e, t, a) {
    if (a === 1 || t.itemProp != null) return !1;
    switch (e) {
      case "meta":
      case "title":
        return !0;
      case "style":
        if (
          typeof t.precedence != "string" ||
          typeof t.href != "string" ||
          t.href === ""
        )
          break;
        return !0;
      case "link":
        if (
          typeof t.rel != "string" ||
          typeof t.href != "string" ||
          t.href === "" ||
          t.onLoad ||
          t.onError
        )
          break;
        switch (t.rel) {
          case "stylesheet":
            return (
              (e = t.disabled),
              typeof t.precedence == "string" && e == null
            );
          default:
            return !0;
        }
      case "script":
        if (
          t.async &&
          typeof t.async != "function" &&
          typeof t.async != "symbol" &&
          !t.onLoad &&
          !t.onError &&
          t.src &&
          typeof t.src == "string"
        )
          return !0;
    }
    return !1;
  }
  function qh(e, t) {
    return (
      e === "img" &&
      t.src != null &&
      t.src !== "" &&
      t.onLoad == null &&
      t.loading !== "lazy"
    );
  }
  function Yh(e) {
    return !(e.type === "stylesheet" && (e.state.loading & 3) === 0);
  }
  function Lh(e) {
    return (
      (e.width || 100) *
      (e.height || 100) *
      (typeof devicePixelRatio == "number" ? devicePixelRatio : 1) *
      0.25
    );
  }
  function Gh(e, t) {
    typeof t.decode == "function" &&
      (e.imgCount++,
      t.complete || ((e.imgBytes += Lh(t)), e.suspenseyImages.push(t)),
      (e = Nv.bind(e)),
      t.decode().then(e, e));
  }
  function zv(e, t, a, l) {
    if (
      a.type === "stylesheet" &&
      (typeof l.media != "string" || matchMedia(l.media).matches !== !1) &&
      (a.state.loading & 4) === 0
    ) {
      if (a.instance === null) {
        var n = gi(l.href),
          u = t.querySelector(Cc(n));
        if (u) {
          ((t = u._p),
            t !== null &&
              typeof t == "object" &&
              typeof t.then == "function" &&
              (e.count++, (e = Ac.bind(e)), t.then(e, e)),
            (a.state.loading |= 4),
            (a.instance = u),
            yt(u));
          return;
        }
        ((u = t.ownerDocument || t),
          (l = Hh(l)),
          (n = Xa.get(n)) && kf(l, n),
          (u = u.createElement("link")),
          yt(u));
        var c = u;
        ((c._p = new Promise(function (m, E) {
          ((c.onload = m), (c.onerror = E));
        })),
          Zt(u, "link", l),
          (a.instance = u));
      }
      (e.stylesheets === null && (e.stylesheets = new Map()),
        e.stylesheets.set(a, t),
        (t = a.state.preload) &&
          (a.state.loading & 3) === 0 &&
          (e.count++,
          (a = Ac.bind(e)),
          t.addEventListener("load", a),
          t.addEventListener("error", a)));
    }
  }
  var fo = 0;
  function Tv(e, t) {
    return (
      e.stylesheets && e.count === 0 && ho(e, e.stylesheets),
      0 < e.count || 0 < e.imgCount
        ? function (a) {
            var l = setTimeout(function () {
              if ((e.stylesheets && ho(e, e.stylesheets), e.unsuspend)) {
                var u = e.unsuspend;
                ((e.unsuspend = null), u());
              }
            }, 6e4 + t);
            0 < e.imgBytes && fo === 0 && (fo = 62500 * Gy());
            var n = setTimeout(
              function () {
                if (
                  ((e.waitingForImages = !1),
                  e.count === 0 &&
                    (e.stylesheets && ho(e, e.stylesheets), e.unsuspend))
                ) {
                  var u = e.unsuspend;
                  ((e.unsuspend = null), u());
                }
              },
              (e.imgBytes > fo ? 50 : 800) + t,
            );
            return (
              (e.unsuspend = a),
              function () {
                ((e.unsuspend = null), clearTimeout(l), clearTimeout(n));
              }
            );
          }
        : null
    );
  }
  function Xh(e) {
    if (e.count === 0 && (e.imgCount === 0 || !e.waitingForImages)) {
      if (e.stylesheets) ho(e, e.stylesheets);
      else if (e.unsuspend) {
        var t = e.unsuspend;
        ((e.unsuspend = null), t());
      }
    }
  }
  function Ac() {
    (this.count--, Xh(this));
  }
  function Nv() {
    (this.imgCount--, Xh(this));
  }
  var mo = null;
  function ho(e, t) {
    ((e.stylesheets = null),
      e.unsuspend !== null &&
        (e.count++,
        (mo = new Map()),
        t.forEach(Mv, e),
        (mo = null),
        Ac.call(e)));
  }
  function Mv(e, t) {
    if (!(t.state.loading & 4)) {
      var a = mo.get(e);
      if (a) var l = a.get(null);
      else {
        ((a = new Map()), mo.set(e, a));
        for (
          var n = e.querySelectorAll(
              "link[data-precedence],style[data-precedence]",
            ),
            u = 0;
          u < n.length;
          u++
        ) {
          var c = n[u];
          (c.nodeName === "LINK" || c.getAttribute("media") !== "not all") &&
            (a.set(c.dataset.precedence, c), (l = c));
        }
        l && a.set(null, l);
      }
      ((n = t.instance),
        (c = n.getAttribute("data-precedence")),
        (u = a.get(c) || l),
        u === l && a.set(null, n),
        a.set(c, n),
        this.count++,
        (l = Ac.bind(this)),
        n.addEventListener("load", l),
        n.addEventListener("error", l),
        u
          ? u.parentNode.insertBefore(n, u.nextSibling)
          : ((e = e.nodeType === 9 ? e.head : e),
            e.insertBefore(n, e.firstChild)),
        (t.state.loading |= 4));
    }
  }
  var bi = {
    $$typeof: Ae,
    Provider: null,
    Consumer: null,
    _currentValue: Oe,
    _currentValue2: Oe,
    _threadCount: 0,
  };
  function Cv(e, t, a, l, n, u, c, m, E) {
    ((this.tag = 1),
      (this.containerInfo = e),
      (this.pingCache = this.current = this.pendingChildren = null),
      (this.timeoutHandle = -1),
      (this.callbackNode =
        this.next =
        this.pendingContext =
        this.context =
        this.cancelPendingCommit =
          null),
      (this.callbackPriority = 0),
      (this.expirationTimes = Ln(-1)),
      (this.entangledLanes =
        this.shellSuspendCounter =
        this.errorRecoveryDisabledLanes =
        this.expiredLanes =
        this.warmLanes =
        this.pingedLanes =
        this.suspendedLanes =
        this.pendingLanes =
          0),
      (this.entanglements = Ln(0)),
      (this.hiddenUpdates = Ln(null)),
      (this.identifierPrefix = l),
      (this.onUncaughtError = n),
      (this.onCaughtError = u),
      (this.onRecoverableError = c),
      (this.pooledCache = null),
      (this.pooledCacheLanes = 0),
      (this.formState = E),
      (this.transitionTypes = null),
      (this.incompleteTransitions = new Map()));
  }
  function kh(e, t, a, l, n, u, c, m, E, A, _, G) {
    return (
      (e = new Cv(e, t, a, c, E, A, _, G, m)),
      (t = 1),
      u === !0 && (t |= 24),
      (u = da(3, null, null, t)),
      (e.current = u),
      (u.stateNode = e),
      (t = us()),
      t.refCount++,
      (e.pooledCache = t),
      t.refCount++,
      (u.memoizedState = { element: l, isDehydrated: a, cache: t }),
      os(u),
      e
    );
  }
  function Vh(e) {
    return e ? ((e = Zu), e) : Zu;
  }
  function Qh(e, t, a, l, n, u) {
    ((n = Vh(n)),
      l.context === null ? (l.context = n) : (l.pendingContext = n),
      (l = pn(t)),
      (l.payload = { element: a }),
      (u = u === void 0 ? null : u),
      u !== null && (l.callback = u),
      (a = gn(e, l, t)),
      a !== null && (pa(a, e, t), uc(a, e, t)));
  }
  function Zh(e, t) {
    if (((e = e.memoizedState), e !== null && e.dehydrated !== null)) {
      var a = e.retryLane;
      e.retryLane = a !== 0 && a < t ? a : t;
    }
  }
  function Zf(e, t) {
    (Zh(e, t), (e = e.alternate) && Zh(e, t));
  }
  function Kh(e) {
    if (e.tag === 13 || e.tag === 31) {
      var t = eu(e, 67108864);
      (t !== null && pa(t, e, 67108864), Zf(e, 67108864));
    }
  }
  function Jh(e) {
    if (e.tag === 13 || e.tag === 31) {
      var t = Ma();
      t = Ui(t);
      var a = eu(e, t);
      (a !== null && pa(a, e, t), Zf(e, t));
    }
  }
  var Si = !0;
  function xv(e, t, a, l) {
    var n = ie.T;
    ie.T = null;
    var u = ve.p;
    try {
      ((ve.p = 2), Kf(e, t, a, l));
    } finally {
      ((ve.p = u), (ie.T = n));
    }
  }
  function Av(e, t, a, l) {
    var n = ie.T;
    ie.T = null;
    var u = ve.p;
    try {
      ((ve.p = 8), Kf(e, t, a, l));
    } finally {
      ((ve.p = u), (ie.T = n));
    }
  }
  function Kf(e, t, a, l) {
    if (Si) {
      var n = Jf(l);
      if (n === null) (Af(e, t, l, yo, a), $h(e, l));
      else if (Ov(n, e, t, a, l)) l.stopPropagation();
      else if (($h(e, l), t & 4 && -1 < wv.indexOf(e))) {
        for (; n !== null; ) {
          var u = il(n);
          if (u !== null)
            switch (u.tag) {
              case 3:
                if (((u = u.stateNode), u.current.memoizedState.isDehydrated)) {
                  var c = Ka(u.pendingLanes);
                  if (c !== 0) {
                    var m = u;
                    for (m.pendingLanes |= 2, m.entangledLanes |= 2; c; ) {
                      var E = 1 << (31 - It(c));
                      ((m.entanglements[1] |= E), (c &= ~E));
                    }
                    (bl(u), (Ze & 6) === 0 && ((Pr = ea() + 500), Sc(0)));
                  }
                }
                break;
              case 31:
              case 13:
                ((m = eu(u, 2)), m !== null && pa(m, u, 2), ao(), Zf(u, 2));
            }
          if (((u = Jf(l)), u === null && Af(e, t, l, yo, a), u === n)) break;
          n = u;
        }
        n !== null && l.stopPropagation();
      } else Af(e, t, l, null, a);
    }
  }
  function Jf(e) {
    return ((e = Pl(e)), Ff(e));
  }
  var yo = null;
  function Ff(e) {
    if (((yo = null), (e = ra(e)), e !== null)) {
      var t = b(e);
      if (t === null) e = null;
      else {
        var a = t.tag;
        if (a === 13) {
          if (((e = N(t)), e !== null)) return e;
          e = null;
        } else if (a === 31) {
          if (((e = M(t)), e !== null)) return e;
          e = null;
        } else if (a === 3) {
          if (t.stateNode.current.memoizedState.isDehydrated)
            return t.tag === 3 ? t.stateNode.containerInfo : null;
          e = null;
        } else t !== e && (e = null);
      }
    }
    return ((yo = e), null);
  }
  function Fh(e) {
    switch (e) {
      case "beforetoggle":
      case "cancel":
      case "click":
      case "close":
      case "contextmenu":
      case "copy":
      case "cut":
      case "auxclick":
      case "dblclick":
      case "dragend":
      case "dragstart":
      case "drop":
      case "focusin":
      case "focusout":
      case "input":
      case "invalid":
      case "keydown":
      case "keypress":
      case "keyup":
      case "mousedown":
      case "mouseup":
      case "paste":
      case "pause":
      case "play":
      case "pointercancel":
      case "pointerdown":
      case "pointerup":
      case "ratechange":
      case "reset":
      case "seeked":
      case "submit":
      case "toggle":
      case "touchcancel":
      case "touchend":
      case "touchstart":
      case "volumechange":
      case "change":
      case "selectionchange":
      case "textInput":
      case "compositionstart":
      case "compositionend":
      case "compositionupdate":
      case "beforeblur":
      case "afterblur":
      case "beforeinput":
      case "blur":
      case "fullscreenchange":
      case "fullscreenerror":
      case "focus":
      case "hashchange":
      case "popstate":
      case "select":
      case "selectstart":
        return 2;
      case "drag":
      case "dragenter":
      case "dragexit":
      case "dragleave":
      case "dragover":
      case "mousemove":
      case "mouseout":
      case "mouseover":
      case "pointermove":
      case "pointerout":
      case "pointerover":
      case "resize":
      case "scroll":
      case "touchmove":
      case "wheel":
      case "mouseenter":
      case "mouseleave":
      case "pointerenter":
      case "pointerleave":
        return 8;
      case "message":
        switch (Tu()) {
          case Nu:
            return 2;
          case Mu:
            return 8;
          case Ql:
          case Lc:
            return 32;
          case ca:
            return 268435456;
          default:
            return 32;
        }
      default:
        return 32;
    }
  }
  var $f = !1,
    On = null,
    Dn = null,
    Rn = null,
    wc = new Map(),
    Oc = new Map(),
    _n = [],
    wv =
      "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(
        " ",
      );
  function $h(e, t) {
    switch (e) {
      case "focusin":
      case "focusout":
        On = null;
        break;
      case "dragenter":
      case "dragleave":
        Dn = null;
        break;
      case "mouseover":
      case "mouseout":
        Rn = null;
        break;
      case "pointerover":
      case "pointerout":
        wc.delete(t.pointerId);
        break;
      case "gotpointercapture":
      case "lostpointercapture":
        Oc.delete(t.pointerId);
    }
  }
  function Dc(e, t, a, l, n, u) {
    return e === null || e.nativeEvent !== u
      ? ((e = {
          blockedOn: t,
          domEventName: a,
          eventSystemFlags: l,
          nativeEvent: u,
          targetContainers: [n],
        }),
        t !== null && ((t = il(t)), t !== null && Kh(t)),
        e)
      : ((e.eventSystemFlags |= l),
        (t = e.targetContainers),
        n !== null && t.indexOf(n) === -1 && t.push(n),
        e);
  }
  function Ov(e, t, a, l, n) {
    switch (t) {
      case "focusin":
        return ((On = Dc(On, e, t, a, l, n)), !0);
      case "dragenter":
        return ((Dn = Dc(Dn, e, t, a, l, n)), !0);
      case "mouseover":
        return ((Rn = Dc(Rn, e, t, a, l, n)), !0);
      case "pointerover":
        var u = n.pointerId;
        return (wc.set(u, Dc(wc.get(u) || null, e, t, a, l, n)), !0);
      case "gotpointercapture":
        return (
          (u = n.pointerId),
          Oc.set(u, Dc(Oc.get(u) || null, e, t, a, l, n)),
          !0
        );
    }
    return !1;
  }
  function Ih(e) {
    var t = ra(e.target);
    if (t !== null) {
      var a = b(t);
      if (a !== null) {
        if (((t = a.tag), t === 13)) {
          if (((t = N(a)), t !== null)) {
            ((e.blockedOn = t),
              Vc(e.priority, function () {
                Jh(a);
              }));
            return;
          }
        } else if (t === 31) {
          if (((t = M(a)), t !== null)) {
            ((e.blockedOn = t),
              Vc(e.priority, function () {
                Jh(a);
              }));
            return;
          }
        } else if (t === 3 && a.stateNode.current.memoizedState.isDehydrated) {
          e.blockedOn = a.tag === 3 ? a.stateNode.containerInfo : null;
          return;
        }
      }
    }
    e.blockedOn = null;
  }
  function vo(e) {
    if (e.blockedOn !== null) return !1;
    for (var t = e.targetContainers; 0 < t.length; ) {
      var a = Jf(e.nativeEvent);
      if (a === null) {
        a = e.nativeEvent;
        var l = new a.constructor(a.type, a);
        ((He = l), a.target.dispatchEvent(l), (He = null));
      } else return ((t = il(a)), t !== null && Kh(t), (e.blockedOn = a), !1);
      t.shift();
    }
    return !0;
  }
  function Wh(e, t, a) {
    vo(e) && a.delete(t);
  }
  function Dv() {
    (($f = !1),
      On !== null && vo(On) && (On = null),
      Dn !== null && vo(Dn) && (Dn = null),
      Rn !== null && vo(Rn) && (Rn = null),
      wc.forEach(Wh),
      Oc.forEach(Wh));
  }
  function po(e, t) {
    e.blockedOn === t &&
      ((e.blockedOn = null),
      $f ||
        (($f = !0),
        o.unstable_scheduleCallback(o.unstable_NormalPriority, Dv)));
  }
  var go = null;
  function Ph(e) {
    go !== e &&
      ((go = e),
      o.unstable_scheduleCallback(o.unstable_NormalPriority, function () {
        go === e && (go = null);
        for (var t = 0; t < e.length; t += 3) {
          var a = e[t],
            l = e[t + 1],
            n = e[t + 2];
          if (typeof l != "function") {
            if (Ff(l || a) === null) continue;
            break;
          }
          var u = il(a);
          u !== null &&
            (e.splice(t, 3),
            (t -= 3),
            Os(u, { pending: !0, data: n, method: a.method, action: l }, l, n));
        }
      }));
  }
  function zi(e) {
    function t(E) {
      return po(E, e);
    }
    (On !== null && po(On, e),
      Dn !== null && po(Dn, e),
      Rn !== null && po(Rn, e),
      wc.forEach(t),
      Oc.forEach(t));
    for (var a = 0; a < _n.length; a++) {
      var l = _n[a];
      l.blockedOn === e && (l.blockedOn = null);
    }
    for (; 0 < _n.length && ((a = _n[0]), a.blockedOn === null); )
      (Ih(a), a.blockedOn === null && _n.shift());
    if (((a = (e.ownerDocument || e).$$reactFormReplay), a != null))
      for (l = 0; l < a.length; l += 3) {
        var n = a[l],
          u = a[l + 1],
          c = n[Ut] || null;
        if (typeof u == "function") c || Ph(a);
        else if (c) {
          var m = null;
          if (u && u.hasAttribute("formAction")) {
            if (((n = u), (c = u[Ut] || null))) m = c.formAction;
            else if (Ff(n) !== null) continue;
          } else m = c.action;
          (typeof m == "function" ? (a[l + 1] = m) : (a.splice(l, 3), (l -= 3)),
            Ph(a));
        }
      }
  }
  function e1() {
    function e(u) {
      u.canIntercept &&
        u.info === "react-transition" &&
        u.intercept({
          handler: function () {
            return new Promise(function (c) {
              return (n = c);
            });
          },
          focusReset: "manual",
          scroll: "manual",
        });
    }
    function t() {
      (n !== null && (n(), (n = null)), l || setTimeout(a, 20));
    }
    function a() {
      if (!l && !navigation.transition) {
        var u = navigation.currentEntry;
        u &&
          u.url != null &&
          navigation.navigate(u.url, {
            state: u.getState(),
            info: "react-transition",
            history: "replace",
          });
      }
    }
    if (typeof navigation == "object") {
      var l = !1,
        n = null;
      return (
        navigation.addEventListener("navigate", e),
        navigation.addEventListener("navigatesuccess", t),
        navigation.addEventListener("navigateerror", t),
        setTimeout(a, 100),
        function () {
          ((l = !0),
            navigation.removeEventListener("navigate", e),
            navigation.removeEventListener("navigatesuccess", t),
            navigation.removeEventListener("navigateerror", t),
            n !== null && (n(), (n = null)));
        }
      );
    }
  }
  function If(e) {
    this._internalRoot = e;
  }
  ((Eo.prototype.render = If.prototype.render =
    function (e) {
      var t = this._internalRoot;
      if (t === null) throw Error(f(409));
      var a = t.current,
        l = Ma();
      Qh(a, l, e, t, null, null);
    }),
    (Eo.prototype.unmount = If.prototype.unmount =
      function () {
        var e = this._internalRoot;
        if (e !== null) {
          this._internalRoot = null;
          var t = e.containerInfo;
          (Qh(e.current, 2, null, e, null, null), ao(), (t[Tl] = null));
        }
      }));
  function Eo(e) {
    this._internalRoot = e;
  }
  Eo.prototype.unstable_scheduleHydration = function (e) {
    if (e) {
      var t = Hi();
      e = { blockedOn: null, target: e, priority: t };
      for (var a = 0; a < _n.length && t !== 0 && t < _n[a].priority; a++);
      (_n.splice(a, 0, e), a === 0 && Ih(e));
    }
  };
  var t1 = d.version;
  if (t1 !== "19.3.1") throw Error(f(527, t1, "19.3.1"));
  ve.findDOMNode = function (e) {
    var t = e._reactInternals;
    if (t === void 0)
      throw typeof e.render == "function"
        ? Error(f(188))
        : ((e = Object.keys(e).join(",")), Error(f(268, e)));
    return (
      (e = q(t)),
      (e = e !== null ? w(e) : null),
      (e = e === null ? null : e.stateNode),
      e
    );
  };
  var Rv = {
    bundleType: 0,
    version: "19.3.1",
    rendererPackageName: "react-dom",
    currentDispatcherRef: ie,
    reconcilerVersion: "19.3.1",
  };
  if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
    var bo = __REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!bo.isDisabled && bo.supportsFiber)
      try {
        ((Za = bo.inject(Rv)), (Tt = bo));
      } catch {}
  }
  return (
    (Rc.createRoot = function (e, t) {
      if (!g(e)) throw Error(f(299));
      var a = !1,
        l = "",
        n = Vd,
        u = Qd,
        c = Zd;
      return (
        t != null &&
          (t.unstable_strictMode === !0 && (a = !0),
          t.identifierPrefix !== void 0 && (l = t.identifierPrefix),
          t.onUncaughtError !== void 0 && (n = t.onUncaughtError),
          t.onCaughtError !== void 0 && (u = t.onCaughtError),
          t.onRecoverableError !== void 0 && (c = t.onRecoverableError)),
        (t = kh(e, 1, !1, null, null, a, l, null, n, u, c, e1)),
        (e[Tl] = t.current),
        xf(e),
        new If(t)
      );
    }),
    (Rc.hydrateRoot = function (e, t, a) {
      if (!g(e)) throw Error(f(299));
      var l = !1,
        n = "",
        u = Vd,
        c = Qd,
        m = Zd,
        E = null;
      return (
        a != null &&
          (a.unstable_strictMode === !0 && (l = !0),
          a.identifierPrefix !== void 0 && (n = a.identifierPrefix),
          a.onUncaughtError !== void 0 && (u = a.onUncaughtError),
          a.onCaughtError !== void 0 && (c = a.onCaughtError),
          a.onRecoverableError !== void 0 && (m = a.onRecoverableError),
          a.formState !== void 0 && (E = a.formState)),
        (t = kh(e, 1, !0, t, a ?? null, l, n, E, u, c, m, e1)),
        (t.context = Vh(null)),
        (a = t.current),
        (l = Ma()),
        (l = Ui(l)),
        (n = pn(l)),
        (n.callback = null),
        gn(a, n, l),
        (a = l),
        (t.current.lanes = a),
        nl(t, a),
        bl(t),
        (e[Tl] = t.current),
        xf(e),
        new Eo(t)
      );
    }),
    (Rc.version = "19.3.1"),
    Rc
  );
}
var d1;
function op() {
  if (d1) return tm.exports;
  d1 = 1;
  function o() {
    if (
      !(
        typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" ||
        typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function"
      )
    )
      try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(o);
      } catch (d) {
        console.error(d);
      }
  }
  return (o(), (tm.exports = rp()), tm.exports);
}
var sp = op();
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const fp = (o) => o.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(),
  q1 = (...o) =>
    o
      .filter((d, v, f) => !!d && d.trim() !== "" && f.indexOf(d) === v)
      .join(" ")
      .trim();
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ var mp = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const dp = Y.forwardRef(
  (
    {
      color: o = "currentColor",
      size: d = 24,
      strokeWidth: v = 2,
      absoluteStrokeWidth: f,
      className: g = "",
      children: b,
      iconNode: N,
      ...M
    },
    B,
  ) =>
    Y.createElement(
      "svg",
      {
        ref: B,
        ...mp,
        width: d,
        height: d,
        stroke: o,
        strokeWidth: f ? (Number(v) * 24) / Number(d) : v,
        className: q1("lucide", g),
        ...M,
      },
      [
        ...N.map(([q, w]) => Y.createElement(q, w)),
        ...(Array.isArray(b) ? b : [b]),
      ],
    ),
);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const de = (o, d) => {
  const v = Y.forwardRef(({ className: f, ...g }, b) =>
    Y.createElement(dp, {
      ref: b,
      iconNode: d,
      className: q1(`lucide-${fp(o)}`, f),
      ...g,
    }),
  );
  return ((v.displayName = `${o}`), v);
};
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const h1 = de("Bell", [
  ["path", { d: "M10.268 21a2 2 0 0 0 3.464 0", key: "vwvbt9" }],
  [
    "path",
    {
      d: "M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326",
      key: "11g9vi",
    },
  ],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const um = de("Brush", [
  [
    "path",
    {
      d: "m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08",
      key: "1styjt",
    },
  ],
  [
    "path",
    {
      d: "M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z",
      key: "z0l1mu",
    },
  ],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const im = de("Check", [["path", { d: "M20 6 9 17l-5-5", key: "1gmf2c" }]]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const hp = de("ChevronDown", [
  ["path", { d: "m6 9 6 6 6-6", key: "qrunsl" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const y1 = de("ChevronRight", [
  ["path", { d: "m9 18 6-6-6-6", key: "mthhwq" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const yp = de("Circle", [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const vp = de("Clock3", [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["polyline", { points: "12 6 12 12 16.5 12", key: "1aq6pp" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const zo = de("Copy", [
  [
    "rect",
    {
      width: "14",
      height: "14",
      x: "8",
      y: "8",
      rx: "2",
      ry: "2",
      key: "17jyea",
    },
  ],
  [
    "path",
    {
      d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",
      key: "zix9uf",
    },
  ],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const To = de("Download", [
  ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", key: "ih7n3h" }],
  ["polyline", { points: "7 10 12 15 17 10", key: "2ggqvy" }],
  ["line", { x1: "12", x2: "12", y1: "15", y2: "3", key: "1vk2je" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const pp = de("Eraser", [
  [
    "path",
    {
      d: "m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21",
      key: "182aya",
    },
  ],
  ["path", { d: "M22 21H7", key: "t4ddhn" }],
  ["path", { d: "m5 11 9 9", key: "1mo9qw" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const gp = de("EyeOff", [
  [
    "path",
    {
      d: "M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49",
      key: "ct8e1f",
    },
  ],
  ["path", { d: "M14.084 14.158a3 3 0 0 1-4.242-4.242", key: "151rxh" }],
  [
    "path",
    {
      d: "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143",
      key: "13bj9a",
    },
  ],
  ["path", { d: "m2 2 20 20", key: "1ooewy" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Ep = de("Eye", [
  [
    "path",
    {
      d: "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",
      key: "1nclc0",
    },
  ],
  ["circle", { cx: "12", cy: "12", r: "3", key: "1v7zrd" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const No = de("Film", [
  [
    "rect",
    { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" },
  ],
  ["path", { d: "M7 3v18", key: "bbkbws" }],
  ["path", { d: "M3 7.5h4", key: "zfgn84" }],
  ["path", { d: "M3 12h18", key: "1i2n21" }],
  ["path", { d: "M3 16.5h4", key: "1230mu" }],
  ["path", { d: "M17 3v18", key: "in4fa5" }],
  ["path", { d: "M17 7.5h4", key: "myr1c1" }],
  ["path", { d: "M17 16.5h4", key: "go4c1d" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const bp = de("FlipHorizontal2", [
  ["path", { d: "m3 7 5 5-5 5V7", key: "couhi7" }],
  ["path", { d: "m21 7-5 5 5 5V7", key: "6ouia7" }],
  ["path", { d: "M12 20v2", key: "1lh1kg" }],
  ["path", { d: "M12 14v2", key: "8jcxud" }],
  ["path", { d: "M12 8v2", key: "1woqiv" }],
  ["path", { d: "M12 2v2", key: "tus03m" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Sp = de("FlipVertical2", [
  ["path", { d: "m17 3-5 5-5-5h10", key: "1ftt6x" }],
  ["path", { d: "m17 21-5-5-5 5h10", key: "1m0wmu" }],
  ["path", { d: "M4 12H2", key: "rhcxmi" }],
  ["path", { d: "M10 12H8", key: "s88cx1" }],
  ["path", { d: "M16 12h-2", key: "10asgb" }],
  ["path", { d: "M22 12h-2", key: "14jgyd" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const v1 = de("Grid2x2", [
  ["path", { d: "M12 3v18", key: "108xh3" }],
  ["path", { d: "M3 12h18", key: "1i2n21" }],
  [
    "rect",
    { x: "3", y: "3", width: "18", height: "18", rx: "2", key: "h1oib" },
  ],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Ni = de("ImagePlus", [
  ["path", { d: "M16 5h6", key: "1vod17" }],
  ["path", { d: "M19 2v6", key: "4bpg5p" }],
  [
    "path",
    {
      d: "M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5",
      key: "1ue2ih",
    },
  ],
  ["path", { d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21", key: "1xmnt7" }],
  ["circle", { cx: "9", cy: "9", r: "2", key: "af1f0g" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const zp = de("Keyboard", [
  ["path", { d: "M10 8h.01", key: "1r9ogq" }],
  ["path", { d: "M12 12h.01", key: "1mp3jc" }],
  ["path", { d: "M14 8h.01", key: "1primd" }],
  ["path", { d: "M16 12h.01", key: "1l6xoz" }],
  ["path", { d: "M18 8h.01", key: "emo2bl" }],
  ["path", { d: "M6 8h.01", key: "x9i8wu" }],
  ["path", { d: "M7 16h10", key: "wp8him" }],
  ["path", { d: "M8 12h.01", key: "czm47f" }],
  [
    "rect",
    { width: "20", height: "16", x: "2", y: "4", rx: "2", key: "18n3k1" },
  ],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const p1 = de("Languages", [
  ["path", { d: "m5 8 6 6", key: "1wu5hv" }],
  ["path", { d: "m4 14 6-6 2-3", key: "1k1g8d" }],
  ["path", { d: "M2 5h12", key: "or177f" }],
  ["path", { d: "M7 2h1", key: "1t2jsx" }],
  ["path", { d: "m22 22-5-10-5 10", key: "don7ne" }],
  ["path", { d: "M14 18h6", key: "1m8k6r" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Mi = de("Layers", [
  [
    "path",
    {
      d: "M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z",
      key: "zw3jo",
    },
  ],
  [
    "path",
    {
      d: "M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12",
      key: "1wduqc",
    },
  ],
  [
    "path",
    {
      d: "M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17",
      key: "kqbvx6",
    },
  ],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Tp = de("LockOpen", [
  [
    "rect",
    {
      width: "18",
      height: "11",
      x: "3",
      y: "11",
      rx: "2",
      ry: "2",
      key: "1w4ew1",
    },
  ],
  ["path", { d: "M7 11V7a5 5 0 0 1 9.9-1", key: "1mm8w8" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Np = de("Lock", [
  [
    "rect",
    {
      width: "18",
      height: "11",
      x: "3",
      y: "11",
      rx: "2",
      ry: "2",
      key: "1w4ew1",
    },
  ],
  ["path", { d: "M7 11V7a5 5 0 0 1 10 0v4", key: "fwvmzm" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Mo = de("Maximize2", [
  ["polyline", { points: "15 3 21 3 21 9", key: "mznyad" }],
  ["polyline", { points: "9 21 3 21 3 15", key: "1avn1i" }],
  ["line", { x1: "21", x2: "14", y1: "3", y2: "10", key: "ota7mn" }],
  ["line", { x1: "3", x2: "10", y1: "21", y2: "14", key: "1atl0r" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const cm = de("MessageCircle", [
  ["path", { d: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z", key: "vv11sd" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Mp = de("Minus", [["path", { d: "M5 12h14", key: "1ays0h" }]]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Cp = de("MousePointer2", [
  [
    "path",
    {
      d: "M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z",
      key: "edeuup",
    },
  ],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const xp = de("Move", [
  ["path", { d: "M12 2v20", key: "t6zp3m" }],
  ["path", { d: "m15 19-3 3-3-3", key: "11eu04" }],
  ["path", { d: "m19 9 3 3-3 3", key: "1mg7y2" }],
  ["path", { d: "M2 12h20", key: "9i4pu4" }],
  ["path", { d: "m5 9-3 3 3 3", key: "j64kie" }],
  ["path", { d: "m9 5 3-3 3 3", key: "l8vdw6" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const rm = de("Music2", [
  ["circle", { cx: "8", cy: "18", r: "4", key: "1fc0mg" }],
  ["path", { d: "M12 18V2l7 4", key: "g04rme" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Ap = de("PaintBucket", [
  [
    "path",
    {
      d: "m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z",
      key: "irua1i",
    },
  ],
  ["path", { d: "m5 2 5 5", key: "1lls2c" }],
  ["path", { d: "M2 13h15", key: "1hkzvu" }],
  [
    "path",
    {
      d: "M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z",
      key: "xk76lq",
    },
  ],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const om = de("Palette", [
  [
    "circle",
    { cx: "13.5", cy: "6.5", r: ".5", fill: "currentColor", key: "1okk4w" },
  ],
  [
    "circle",
    { cx: "17.5", cy: "10.5", r: ".5", fill: "currentColor", key: "f64h9f" },
  ],
  [
    "circle",
    { cx: "8.5", cy: "7.5", r: ".5", fill: "currentColor", key: "fotxhn" },
  ],
  [
    "circle",
    { cx: "6.5", cy: "12.5", r: ".5", fill: "currentColor", key: "qy21gx" },
  ],
  [
    "path",
    {
      d: "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z",
      key: "12rzf8",
    },
  ],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const wp = de("PanelRightClose", [
  [
    "rect",
    { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" },
  ],
  ["path", { d: "M15 3v18", key: "14nvp0" }],
  ["path", { d: "m8 9 3 3-3 3", key: "12hl5m" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Op = de("PanelRightOpen", [
  [
    "rect",
    { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" },
  ],
  ["path", { d: "M15 3v18", key: "14nvp0" }],
  ["path", { d: "m10 15-3-3 3-3", key: "1pgupc" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Dp = de("Pause", [
  [
    "rect",
    { x: "14", y: "4", width: "4", height: "16", rx: "1", key: "zuxfzm" },
  ],
  [
    "rect",
    { x: "6", y: "4", width: "4", height: "16", rx: "1", key: "1okwgv" },
  ],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Rp = de("Pipette", [
  ["path", { d: "m2 22 1-1h3l9-9", key: "1sre89" }],
  ["path", { d: "M3 21v-3l9-9", key: "hpe2y6" }],
  [
    "path",
    {
      d: "m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z",
      key: "196du1",
    },
  ],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const _p = de("Play", [
  ["polygon", { points: "6 3 20 12 6 21 6 3", key: "1oa8hb" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const _c = de("Plus", [
  ["path", { d: "M5 12h14", key: "1ays0h" }],
  ["path", { d: "M12 5v14", key: "s699le" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const g1 = de("Redo2", [
  ["path", { d: "m15 14 5-5-5-5", key: "12vg1m" }],
  [
    "path",
    {
      d: "M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13",
      key: "6uklza",
    },
  ],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const E1 = de("RotateCcw", [
  [
    "path",
    { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", key: "1357e3" },
  ],
  ["path", { d: "M3 3v5h5", key: "1xhq8a" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Uc = de("Save", [
  [
    "path",
    {
      d: "M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
      key: "1c8476",
    },
  ],
  ["path", { d: "M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7", key: "1ydtos" }],
  ["path", { d: "M7 3v4a1 1 0 0 0 1 1h7", key: "t51u73" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const b1 = de("Scissors", [
  ["circle", { cx: "6", cy: "6", r: "3", key: "1lh9wr" }],
  ["path", { d: "M8.12 8.12 12 12", key: "1alkpv" }],
  ["path", { d: "M20 4 8.12 15.88", key: "xgtan2" }],
  ["circle", { cx: "6", cy: "18", r: "3", key: "fqmcym" }],
  ["path", { d: "M14.8 14.8 20 20", key: "ptml3r" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Up = de("Send", [
  [
    "path",
    {
      d: "M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z",
      key: "1ffxy3",
    },
  ],
  ["path", { d: "m21.854 2.147-10.94 10.939", key: "12cjpa" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const sm = de("Settings2", [
  ["path", { d: "M20 7h-9", key: "3s1dr2" }],
  ["path", { d: "M14 17H5", key: "gfn3mx" }],
  ["circle", { cx: "17", cy: "17", r: "3", key: "18b49y" }],
  ["circle", { cx: "7", cy: "7", r: "3", key: "dfmy0x" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Hp = de("SkipBack", [
  ["polygon", { points: "19 20 9 12 19 4 19 20", key: "o2sva" }],
  ["line", { x1: "5", x2: "5", y1: "19", y2: "5", key: "1ocqjk" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Bp = de("SkipForward", [
  ["polygon", { points: "5 4 15 12 5 20 5 4", key: "16p6eg" }],
  ["line", { x1: "19", x2: "19", y1: "5", y2: "19", key: "futhcm" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const jp = de("SlidersHorizontal", [
  ["line", { x1: "21", x2: "14", y1: "4", y2: "4", key: "obuewd" }],
  ["line", { x1: "10", x2: "3", y1: "4", y2: "4", key: "1q6298" }],
  ["line", { x1: "21", x2: "12", y1: "12", y2: "12", key: "1iu8h1" }],
  ["line", { x1: "8", x2: "3", y1: "12", y2: "12", key: "ntss68" }],
  ["line", { x1: "21", x2: "16", y1: "20", y2: "20", key: "14d8ph" }],
  ["line", { x1: "12", x2: "3", y1: "20", y2: "20", key: "m0wm8r" }],
  ["line", { x1: "14", x2: "14", y1: "2", y2: "6", key: "14e1ph" }],
  ["line", { x1: "8", x2: "8", y1: "10", y2: "14", key: "1i6ji0" }],
  ["line", { x1: "16", x2: "16", y1: "18", y2: "22", key: "1lctlv" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const qp = de("Sparkles", [
  [
    "path",
    {
      d: "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z",
      key: "4pj2yx",
    },
  ],
  ["path", { d: "M20 3v4", key: "1olli1" }],
  ["path", { d: "M22 5h-4", key: "1gvqau" }],
  ["path", { d: "M4 17v2", key: "vumght" }],
  ["path", { d: "M5 18H3", key: "zchphs" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Yp = de("Square", [
  [
    "rect",
    { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" },
  ],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Hc = de("Trash2", [
  ["path", { d: "M3 6h18", key: "d0wm0j" }],
  ["path", { d: "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6", key: "4alrt4" }],
  ["path", { d: "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2", key: "v07s0e" }],
  ["line", { x1: "10", x2: "10", y1: "11", y2: "17", key: "1uufr5" }],
  ["line", { x1: "14", x2: "14", y1: "11", y2: "17", key: "xtxkd" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const S1 = de("Undo2", [
  ["path", { d: "M9 14 4 9l5-5", key: "102s5s" }],
  [
    "path",
    {
      d: "M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11",
      key: "f3b9sd",
    },
  ],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const fm = de("Upload", [
  ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", key: "ih7n3h" }],
  ["polyline", { points: "17 8 12 3 7 8", key: "t8dd8p" }],
  ["line", { x1: "12", x2: "12", y1: "3", y2: "15", key: "widbto" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const mm = de("Users", [
  ["path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", key: "1yyitq" }],
  ["circle", { cx: "9", cy: "7", r: "4", key: "nufk8" }],
  ["path", { d: "M22 21v-2a4 4 0 0 0-3-3.87", key: "kshegd" }],
  ["path", { d: "M16 3.13a4 4 0 0 1 0 7.75", key: "1da9ce" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Lp = de("Waves", [
  [
    "path",
    {
      d: "M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1",
      key: "knzxuh",
    },
  ],
  [
    "path",
    {
      d: "M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1",
      key: "2jd2cc",
    },
  ],
  [
    "path",
    {
      d: "M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1",
      key: "rd2r6e",
    },
  ],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const dm = de("X", [
  ["path", { d: "M18 6 6 18", key: "1bl5f8" }],
  ["path", { d: "m6 6 12 12", key: "d8bk6v" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const z1 = de("ZoomIn", [
  ["circle", { cx: "11", cy: "11", r: "8", key: "4ej97u" }],
  ["line", { x1: "21", x2: "16.65", y1: "21", y2: "16.65", key: "13gj7c" }],
  ["line", { x1: "11", x2: "11", y1: "8", y2: "14", key: "1vmskp" }],
  ["line", { x1: "8", x2: "14", y1: "11", y2: "11", key: "durymu" }],
]);
/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const T1 = de("ZoomOut", [
  ["circle", { cx: "11", cy: "11", r: "8", key: "4ej97u" }],
  ["line", { x1: "21", x2: "16.65", y1: "21", y2: "16.65", key: "13gj7c" }],
  ["line", { x1: "8", x2: "14", y1: "11", y2: "11", key: "durymu" }],
]);
function Gp(o, d, v, f) {
  const g = qc(o),
    b = g.find((N) => N.id === d);
  if (!b) return g;
  if (((f = Math.round(f * 1e4) / 1e4), v === "move"))
    return Oo(g, d, b.start + f);
  if (v === "left") {
    const N = b.start + Jt(b),
      M = Math.max(
        0,
        ...g
          .filter((B) => B.id !== d && B.start < b.start)
          .map((B) => B.start + Jt(B)),
      );
    return (
      (b.start = Math.max(M, Math.min(N - FR_MIN_FRAME, b.start + f))),
      (b.duration = N - b.start),
      g
    );
  }
  return ((b.duration = Math.max(FR_MIN_FRAME, Jt(b) + f)), Oo(g, d, b.start));
}
const Y1 = [
    {
      id: "dipHard",
      name: "Dip Pen (Hard)",
      group: "Canetas",
      size: 6,
      spacing: 0.04,
      hardness: 0.97,
      sizePressure: 0.75,
      stabilizer: 0.6,
      flow: 1,
    },
    {
      id: "dipSoft",
      name: "Dip Pen (Soft)",
      group: "Canetas",
      size: 10,
      spacing: 0.05,
      hardness: 0.5,
      sizePressure: 0.65,
      stabilizer: 0.5,
    },
    {
      id: "feltHard",
      name: "Felt Tip (Hard)",
      group: "Canetas",
      size: 9,
      spacing: 0.06,
      hardness: 0.93,
      sizePressure: 0.5,
      stabilizer: 0.5,
    },
    {
      id: "feltSoft",
      name: "Felt Tip (Soft)",
      group: "Canetas",
      size: 12,
      spacing: 0.06,
      hardness: 0.35,
      sizePressure: 0.5,
      stabilizer: 0.45,
    },
    {
      id: "pencil",
      name: "Lápis",
      group: "Canetas",
      size: 4,
      spacing: 0.07,
      hardness: 0.8,
      opacity: 1,
      texture: "grain",
      textureDepth: 0.55,
      sizePressure: 0.55,
    },
    {
      id: "airbrush",
      name: "Airbrush",
      group: "Pincéis",
      size: 64,
      spacing: 0.05,
      hardness: 0.02,
      flow: 0.07,
      opacity: 1,
      sizePressure: 0.35,
      opacityPressure: 0.45,
      stabilizer: 0.4,
    },
    {
      id: "spray",
      name: "Airbrush (Spray)",
      group: "Pincéis",
      size: 44,
      spacing: 0.06,
      hardness: 0.7,
      flow: 0.2,
      opacity: 0.85,
      scatter: 0.85,
      sizePressure: 0.2,
      opacityPressure: 0.5,
    },
    {
      id: "brushNormal",
      name: "Brush (Normal)",
      group: "Pincéis",
      size: 20,
      spacing: 0.09,
      hardness: 0.72,
      texture: "canvas",
      textureDepth: 0.3,
      sizePressure: 0.6,
    },
    {
      id: "watercolor",
      name: "Watercolor",
      group: "Pincéis",
      size: 34,
      spacing: 0.04,
      hardness: 0.12,
      flow: 0.16,
      opacity: 0.9,
      blend: "multiply",
      texture: "paper",
      textureDepth: 0.35,
      sizePressure: 0.4,
      opacityPressure: 0.4,
      stabilizer: 0.5,
    },
    {
      id: "oil",
      name: "Oil Paint",
      group: "Pincéis",
      size: 22,
      spacing: 0.06,
      hardness: 0.6,
      flow: 0.65,
      opacity: 1,
      texture: "canvas",
      textureDepth: 0.45,
      sizePressure: 0.6,
    },
    {
      id: "crayon",
      name: "Crayon",
      group: "Pincéis",
      size: 16,
      spacing: 0.07,
      hardness: 0.5,
      flow: 0.8,
      texture: "chalk",
      textureDepth: 0.75,
      sizePressure: 0.5,
    },
    {
      id: "marker",
      name: "Marcador",
      group: "Marcadores",
      size: 18,
      spacing: 0.04,
      tip: "square",
      hardness: 0.92,
      opacity: 0.75,
      blend: "multiply",
      sizePressure: 0.35,
    },
    {
      id: "markerSoft",
      name: "Marcador (Suave)",
      group: "Marcadores",
      size: 26,
      spacing: 0.05,
      tip: "square",
      hardness: 0.25,
      opacity: 0.6,
      blend: "multiply",
      flow: 0.5,
      sizePressure: 0.3,
    },
    {
      id: "neon",
      name: "Neon",
      group: "Marcadores",
      size: 14,
      spacing: 0.05,
      hardness: 0.6,
      blend: "screen",
      opacity: 1,
      sizePressure: 0.6,
      stabilizer: 0.6,
    },
    {
      id: "eraserHard",
      name: "Borracha (Hard)",
      group: "Borracha",
      type: "erase",
      size: 24,
      spacing: 0.05,
      hardness: 0.95,
      sizePressure: 0.4,
    },
    {
      id: "eraserSoft",
      name: "Borracha (Soft)",
      group: "Borracha",
      type: "erase",
      size: 46,
      spacing: 0.05,
      hardness: 0.18,
      flow: 0.5,
      sizePressure: 0.4,
    },
    {
      id: "smudge",
      name: "Misturar (Smudge)",
      group: "Mistura",
      type: "smudge",
      size: 34,
      strength: 0.55,
      sizePressure: 0.3,
      stabilizer: 0.45,
    },
    {
      id: "liner",
      name: "Fineliner",
      group: "Canetas",
      size: 3,
      spacing: 0.05,
      hardness: 0.98,
      sizePressure: 0.4,
      stabilizer: 0.7,
    },
    {
      id: "brushPen",
      name: "Brush Pen",
      group: "Canetas",
      size: 16,
      spacing: 0.04,
      hardness: 0.86,
      sizePressure: 0.85,
      stabilizer: 0.55,
    },
    {
      id: "calligraphy",
      name: "Caligrafia",
      group: "Canetas",
      size: 14,
      spacing: 0.03,
      tip: "square",
      roundness: 0.28,
      angle: -35,
      hardness: 0.95,
      sizePressure: 0.3,
      stabilizer: 0.6,
    },
    {
      id: "inkWash",
      name: "Nanquim aguado",
      group: "Pincéis",
      size: 30,
      spacing: 0.05,
      hardness: 0.18,
      flow: 0.35,
      opacity: 0.85,
      texture: "paper",
      textureDepth: 0.25,
      sizePressure: 0.5,
    },
    {
      id: "flatBrush",
      name: "Pincel chato",
      group: "Pincéis",
      size: 26,
      spacing: 0.05,
      roundness: 0.32,
      angle: -20,
      hardness: 0.8,
      flow: 0.85,
      sizePressure: 0.45,
    },
    {
      id: "bristle",
      name: "Cerda",
      group: "Pincéis",
      size: 24,
      spacing: 0.08,
      hardness: 0.55,
      flow: 0.7,
      texture: "canvas",
      textureDepth: 0.6,
      sizePressure: 0.6,
      scatter: 0.12,
    },
    {
      id: "gouache",
      name: "Guache",
      group: "Pincéis",
      size: 26,
      spacing: 0.04,
      hardness: 0.5,
      flow: 0.8,
      opacity: 1,
      texture: "paper",
      textureDepth: 0.4,
      sizePressure: 0.55,
    },
    {
      id: "watercolorWet",
      name: "Aquarela úmida",
      group: "Pincéis",
      size: 56,
      spacing: 0.03,
      hardness: 0.04,
      flow: 0.1,
      opacity: 0.6,
      blend: "multiply",
      texture: "paper",
      textureDepth: 0.5,
      sizePressure: 0.3,
      opacityPressure: 0.5,
    },
    {
      id: "markerChisel",
      name: "Marcador chanfrado",
      group: "Marcadores",
      size: 22,
      spacing: 0.03,
      tip: "square",
      roundness: 0.34,
      angle: -30,
      hardness: 0.9,
      opacity: 0.8,
      blend: "multiply",
      sizePressure: 0.25,
    },
    {
      id: "highlighter",
      name: "Marca-texto",
      group: "Marcadores",
      size: 30,
      spacing: 0.03,
      tip: "square",
      roundness: 0.5,
      hardness: 0.6,
      opacity: 0.35,
      blend: "multiply",
      flow: 0.7,
      sizePressure: 0.15,
    },
    {
      id: "charcoal",
      name: "Carvão",
      group: "Texturas",
      size: 20,
      spacing: 0.09,
      hardness: 0.35,
      flow: 0.55,
      texture: "chalk",
      textureDepth: 0.9,
      scatter: 0.3,
      sizePressure: 0.6,
    },
    {
      id: "pastel",
      name: "Pastel",
      group: "Texturas",
      size: 26,
      spacing: 0.07,
      hardness: 0.4,
      flow: 0.7,
      texture: "dots",
      textureDepth: 0.7,
      scatter: 0.18,
      sizePressure: 0.5,
    },
    {
      id: "sponge",
      name: "Esponja",
      group: "Texturas",
      size: 44,
      spacing: 0.12,
      hardness: 0.45,
      flow: 0.4,
      scatter: 0.75,
      texture: "dots",
      textureDepth: 0.8,
      sizePressure: 0.35,
    },
    {
      id: "halftone",
      name: "Retícula",
      group: "Texturas",
      size: 18,
      spacing: 0.35,
      hardness: 0.95,
      flow: 0.9,
      texture: "dots",
      textureDepth: 0.9,
      sizePressure: 0.2,
    },
    {
      id: "glow",
      name: "Brilho",
      group: "Efeitos",
      size: 34,
      spacing: 0.05,
      hardness: 0.02,
      flow: 0.12,
      blend: "screen",
      sizePressure: 0.4,
      stabilizer: 0.5,
    },
    {
      id: "sparkle",
      name: "Faísca",
      group: "Efeitos",
      size: 12,
      spacing: 0.4,
      hardness: 0.9,
      flow: 1,
      scatter: 1.4,
      sizePressure: 0.7,
      opacityPressure: 0.7,
    },
    {
      id: "neonGlow",
      name: "Neon suave",
      group: "Efeitos",
      size: 22,
      spacing: 0.04,
      hardness: 0.1,
      flow: 0.3,
      blend: "screen",
      sizePressure: 0.5,
      stabilizer: 0.6,
    },
    {
      id: "cloud",
      name: "Nuvem",
      group: "Efeitos",
      size: 120,
      spacing: 0.03,
      hardness: 0.01,
      flow: 0.06,
      opacity: 0.9,
      sizePressure: 0.2,
      stabilizer: 0.35,
    },
    {
      id: "eraserChunk",
      name: "Borracha (Bloco)",
      group: "Borracha",
      type: "erase",
      size: 36,
      spacing: 0.08,
      tip: "square",
      hardness: 0.9,
      sizePressure: 0.2,
    },
    {
      id: "smudgeSoft",
      name: "Misturar (Suave)",
      group: "Mistura",
      type: "smudge",
      size: 60,
      strength: 0.28,
      sizePressure: 0.25,
      stabilizer: 0.5,
    },
    {
      id: "pixel",
      name: "Pixel Art",
      group: "Canetas",
      size: 10,
      spacing: 0.1,
      tip: "square",
      hardness: 1,
      opacity: 1,
    },
    {
      id: "softPencil",
      name: "Lápis macio",
      group: "Canetas",
      size: 7,
      spacing: 0.06,
      hardness: 0.45,
      texture: "grain",
      textureDepth: 0.4,
      opacity: 0.8,
    },
    {
      id: "dryInk",
      name: "Nanquim seco",
      group: "Texturas",
      size: 20,
      spacing: 0.1,
      hardness: 0.7,
      texture: "chalk",
      textureDepth: 0.75,
      opacity: 0.9,
    },
  ].map((o) => ({ ...o, preset: !0 })),
  Em = Object.fromEntries(Y1.map((o) => [o.id, o])),
  L1 = () => [1, 0, 0, 1, 0, 0];
function Xp(o, d) {
  return [
    o[0] * d[0] + o[2] * d[1],
    o[1] * d[0] + o[3] * d[1],
    o[0] * d[2] + o[2] * d[3],
    o[1] * d[2] + o[3] * d[3],
    o[0] * d[4] + o[2] * d[5] + o[4],
    o[1] * d[4] + o[3] * d[5] + o[5],
  ];
}
const Cm = (o, d) => ({
  x: o[0] * d.x + o[2] * d.y + o[4],
  y: o[1] * d.x + o[3] * d.y + o[5],
});
function G1(o) {
  const d = o[0] * o[3] - o[1] * o[2];
  return Math.abs(d) < 1e-10
    ? null
    : [
        o[3] / d,
        -o[1] / d,
        -o[2] / d,
        o[0] / d,
        (o[2] * o[5] - o[3] * o[4]) / d,
        (o[1] * o[4] - o[0] * o[5]) / d,
      ];
}
function xm(o) {
  if (o.type === "image" || o.type === "shape")
    return { x: o.x, y: o.y, w: Math.max(1, o.w), h: Math.max(1, o.h) };
  const d = o.points || [];
  if (!d.length) return { x: 0, y: 0, w: 1, h: 1 };
  let v = 1 / 0,
    f = 1 / 0,
    g = -1 / 0,
    b = -1 / 0;
  for (const M of d)
    ((v = Math.min(v, M.x)),
      (f = Math.min(f, M.y)),
      (g = Math.max(g, M.x)),
      (b = Math.max(b, M.y)));
  const N = (o.size || 1) / 2;
  return {
    x: v - N,
    y: f - N,
    w: Math.max(1, g - v + N * 2),
    h: Math.max(1, b - f + N * 2),
  };
}
function xi(o, d = {}) {
  const v = ((d.rotation || 0) * Math.PI) / 180,
    f = Math.cos(v),
    g = Math.sin(v),
    b = (d.sx ?? 1) * (d.flipX ? -1 : 1),
    N = (d.sy ?? 1) * (d.flipY ? -1 : 1),
    M = o.x + o.w / 2,
    B = o.y + o.h / 2;
  return [
    f * b,
    g * b,
    -g * N,
    f * N,
    M + (d.x || 0) - f * b * M + g * N * B,
    B + (d.y || 0) - g * b * M - f * N * B,
  ];
}
const kp = L1(),
  Yc = (o) => o.matrix || (o.transform ? xi(xm(o), o.transform) : kp);
function bm(o, d = L1()) {
  return [
    { x: o.x, y: o.y },
    { x: o.x + o.w, y: o.y },
    { x: o.x + o.w, y: o.y + o.h },
    { x: o.x, y: o.y + o.h },
  ].map((v) => Cm(d, v));
}
function jc(o) {
  if (!o.length) return null;
  let d = 1 / 0,
    v = 1 / 0,
    f = -1 / 0,
    g = -1 / 0;
  for (const b of o)
    for (const N of bm(xm(b), Yc(b)))
      ((d = Math.min(d, N.x)),
        (v = Math.min(v, N.y)),
        (f = Math.max(f, N.x)),
        (g = Math.max(g, N.y)));
  return { x: d, y: v, w: Math.max(1, f - d), h: Math.max(1, g - v) };
}
function Lg1(o, d, v) {
  const f = d.x - o.x,
    g = d.y - o.y,
    b = v.x - o.x,
    N = v.y - o.y,
    M = b * b + N * N,
    B = M ? Math.max(0, Math.min(1, (f * b + g * N) / M)) : 0;
  return Math.hypot(f - b * B, g - N * B);
}
function Lg2(o, d) {
  const v = o.points || [];
  if (!v.length) return 1 / 0;
  if (v.length === 1) return Math.hypot(d.x - v[0].x, d.y - v[0].y);
  let f = 1 / 0;
  for (let g = 1; g < v.length; g++) f = Math.min(f, Lg1(v[g - 1], v[g], d));
  return f;
}
function Vp(o, d, v = 0) {
  const f = G1(Yc(o));
  if (!f) return !1;
  const g = Cm(f, d),
    b = xm(o);
  return (
    g.x >= b.x - v &&
    g.x <= b.x + b.w + v &&
    g.y >= b.y - v &&
    g.y <= b.y + b.h + v &&
    (o.type !== "stroke" || Lg2(o, g) <= v + Math.max(2, (o.size || 1) / 2))
  );
}
function Lg3(o, d, v, f) {
  const g = (q, w, p) =>
    Math.sign((w.x - q.x) * (p.y - q.y) - (w.y - q.y) * (p.x - q.x));
  return g(o, d, v) !== g(o, d, f) && g(v, f, o) !== g(v, f, d);
}
function framiaTime(o) {
  const d = Math.max(0, Math.floor(o || 0)),
    v = Math.floor(d / 60),
    f = d % 60;
  return `${String(v).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
}
function framiaQuad(o, r) {
  const d = G1(Yc(o));
  return d ? bm(r, d) : null;
}
function framiaClipSeg(a, b, poly) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  let t0 = 0,
    t1 = 1,
    area = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i],
      q = poly[(i + 1) % poly.length];
    area += p.x * q.y - q.x * p.y;
  }
  const sgn = area < 0 ? -1 : 1;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i],
      q = poly[(i + 1) % poly.length],
      nx = -(q.y - p.y) * sgn,
      ny = (q.x - p.x) * sgn,
      A = (a.x - p.x) * nx + (a.y - p.y) * ny,
      D = dx * nx + dy * ny;
    if (Math.abs(D) < 1e-9) {
      if (A < 0) return null;
      continue;
    }
    const t = -A / D;
    if (D > 0) {
      if (t > t1) return null;
      t > t0 && (t0 = t);
    } else {
      if (t < t0) return null;
      t < t1 && (t1 = t);
    }
  }
  return { t0, t1 };
}
function framiaMergeRuns(o) {
  const d = [];
  for (const v of o) {
    const f = d[d.length - 1],
      g = f && f[f.length - 1];
    if (f && Math.hypot(g.x - v[0].x, g.y - v[0].y) < 0.5)
      v.slice(1).forEach((b) => f.push(b));
    else d.push(v.slice());
  }
  return d.filter((v) => v.length > 1);
}
function framiaSplitStroke(o, poly) {
  const v = [],
    f = [],
    g = (b, N, M) => ({ x: b.x + (N.x - b.x) * M, y: b.y + (N.y - b.y) * M });
  for (let b = 1; b < o.length; b++) {
    const N = o[b - 1],
      M = o[b],
      B = framiaClipSeg(N, M, poly);
    if (!B) {
      f.push([N, M]);
      continue;
    }
    B.t0 > 0 && f.push([N, g(N, M, B.t0)]);
    v.push([g(N, M, B.t0), g(N, M, B.t1)]);
    B.t1 < 1 && f.push([g(N, M, B.t1), M]);
  }
  return { inside: framiaMergeRuns(v), outside: framiaMergeRuns(f) };
}
function framiaPiece(o, d, v) {
  const f = xm({ ...o, points: v }),
    { transform, ...rest } = o;
  return {
    ...rest,
    id: d,
    points: v,
    x: f.x,
    y: f.y,
    w: f.w,
    h: f.h,
    group: void 0,
    matrix: [...Yc(o)],
  };
}
function Lg4(o, d) {
  const v = jc([o]);
  if (
    !(
      v.x <= d.x + d.w &&
      v.x + v.w >= d.x &&
      v.y <= d.y + d.h &&
      v.y + v.h >= d.y
    )
  )
    return !1;
  if (o.type !== "stroke") return !0;
  const f = Yc(o),
    g = (o.points || []).map((b) => Cm(f, b));
  if (!g.length) return !0;
  const b = (N) =>
    N.x >= d.x && N.x <= d.x + d.w && N.y >= d.y && N.y <= d.y + d.h;
  if (g.some(b)) return !0;
  const N = [
    { x: d.x, y: d.y },
    { x: d.x + d.w, y: d.y },
    { x: d.x + d.w, y: d.y + d.h },
    { x: d.x, y: d.y + d.h },
  ];
  for (let M = 1; M < g.length; M++)
    for (let B = 0; B < 4; B++)
      if (Lg3(g[M - 1], g[M], N[B], N[(B + 1) % 4])) return !0;
  return !1;
}
function wo(o, d, v) {
  return { ...o, matrix: Xp(xi(d, v), Yc(o)) };
}
function Qp(o, d, v, f, g) {
  const b = ((o.rotation || 0) * Math.PI) / 180,
    N = Math.cos(b),
    M = Math.sin(b),
    B = g.x - f.x,
    q = g.y - f.y,
    w = N * B + M * q,
    p = -M * B + N * q,
    j = Math.max(0.01, (o.sx ?? 1) + (v[0] * w) / d.w),
    Z = Math.max(0.01, (o.sy ?? 1) + (v[1] * p) / d.h),
    k = (v[0] * (j - (o.sx ?? 1)) * d.w) / 2,
    W = (v[1] * (Z - (o.sy ?? 1)) * d.h) / 2;
  return {
    ...o,
    sx: j,
    sy: Z,
    x: (o.x || 0) + N * k - M * W,
    y: (o.y || 0) + M * k + N * W,
  };
}
function N1(o) {
  return (
    !!o &&
    typeof o.projectId == "string" &&
    typeof o.frameId == "string" &&
    typeof o.layerId == "string" &&
    Array.isArray(o.ids) &&
    o.ids.length > 0 &&
    o.ids.length <= 2e3 &&
    o.ids.every((d) => typeof d == "string") &&
    o.box &&
    ["x", "y", "w", "h"].every((d) => Number.isFinite(o.box[d])) &&
    o.box.w > 0 &&
    o.box.h > 0 &&
    o.transform &&
    ["x", "y", "sx", "sy", "rotation"].every(
      (d) =>
        o.transform[d] === void 0 ||
        (Number.isFinite(o.transform[d]) && Math.abs(o.transform[d]) < 1e7),
    ) &&
    ["sx", "sy"].every((d) => o.transform[d] === void 0 || o.transform[d] > 0)
  );
}
function Zp() {
  let o = null;
  return {
    clear() {
      o = null;
    },
    draw(d, v, f, g, b, N, M) {
      const B = new Map();
      f.forEach((w, p) =>
        w.ids.forEach((j) => {
          B.has(j) || B.set(j, p);
        }),
      );
      const q = JSON.stringify(f.map((w) => w.ids));
      if (
        !o ||
        o.elements !== v ||
        o.key !== q ||
        o.width !== g ||
        o.height !== b
      ) {
        const w = [];
        for (const Z of v) {
          const k = B.get(Z.id) ?? -1;
          let W = w.at(-1);
          ((!W || W.owner !== k) &&
            ((W = { owner: k, elements: [] }), w.push(W)),
            W.elements.push(Z));
        }
        let p = 0;
        const j =
          w.length <= 32 &&
          !v.some((Z) => {
            const k = Z.brushData || Em[Z.brushPreset];
            return (
              (Z.erase ||
                (k == null ? void 0 : k.type) === "erase" ||
                ((k == null ? void 0 : k.blend) &&
                  k.blend !== "source-over")) &&
              !(w.length === 1 && w[0].owner >= 0)
            );
          });
        for (const Z of w) {
          const k = jc(Z.elements);
          let W = 2;
          for (const V of Z.elements) {
            const oe = Yc(V),
              ne = V.brushData || Em[V.brushPreset],
              z =
                (V.size || (ne == null ? void 0 : ne.size) || 1) *
                (Math.abs((ne == null ? void 0 : ne.scatter) || 0) +
                  Math.SQRT2 *
                    Math.max(
                      1,
                      Math.abs((ne == null ? void 0 : ne.roundness) || 1),
                    ));
            W = Math.max(W, z * Math.hypot(oe[0], oe[1], oe[2], oe[3]) + 2);
          }
          ((Z.box = k && {
            x: Math.floor(k.x - W),
            y: Math.floor(k.y - W),
            w: Math.ceil(k.w + W * 2) + 1,
            h: Math.ceil(k.h + W * 2) + 1,
          }),
            Z.box && (p += Z.box.w * Z.box.h));
        }
        if (j && p <= 25e6)
          for (const Z of w) {
            const k = Z.box;
            if (!k) continue;
            ((Z.canvas = document.createElement("canvas")),
              (Z.canvas.width = k.w),
              (Z.canvas.height = k.h));
            const W = Z.canvas.getContext("2d");
            (W.translate(-k.x, -k.y), Z.elements.forEach((V) => N(W, V, M)));
          }
        o = { elements: v, key: q, width: g, height: b, runs: w };
      }
      for (const w of o.runs) {
        const p = f[w.owner];
        if (w.canvas)
          (d.save(),
            p && d.transform(...xi(p.box, p.transform)),
            d.drawImage(w.canvas, w.box.x, w.box.y),
            d.restore());
        else
          for (const j of w.elements)
            N(d, p ? wo(j, p.box, p.transform) : j, M);
      }
    },
  };
}
const Kp = "framia-project-library",
  Jp = 1,
  FRAMIA_ACCOUNTS_KEY = "framia-accounts",
  FRAMIA_OWNER_KEY = "framia-local-owner",
  FRAMIA_MAX_ACCOUNTS = 3;
let framiaAccountScope = "";
function framiaScopeId(o) {
  const d = String(o || "");
  let v = 5381;
  for (let f = 0; f < d.length; f++) v = ((v * 33) ^ d.charCodeAt(f)) >>> 0;
  return `a${v.toString(36)}`;
}
function framiaScopedKey(o, d = framiaAccountScope) {
  return d ? `${o}:${d}` : o;
}
function framiaAccountScopeFor(o) {
  return o && typeof o.sub === "string" ? framiaScopeId(o.sub) : "";
}
function framiaReadAccounts() {
  try {
    const o = JSON.parse(localStorage.getItem(FRAMIA_ACCOUNTS_KEY));
    return Array.isArray(o)
      ? o
          .filter(
            (d) =>
              d &&
              typeof d.id === "string" &&
              (typeof d.name === "string" || typeof d.email === "string"),
          )
          .slice(0, FRAMIA_MAX_ACCOUNTS)
      : [];
  } catch {
    return [];
  }
}
function framiaWriteAccounts(o) {
  try {
    localStorage.setItem(
      FRAMIA_ACCOUNTS_KEY,
      JSON.stringify(o.slice(0, FRAMIA_MAX_ACCOUNTS)),
    );
  } catch {}
}
function framiaRememberAccount(o) {
  if (!o || typeof o.sub !== "string") return framiaReadAccounts();
  const d = {
      id: o.sub,
      name: typeof o.name === "string" ? o.name : "",
      email: typeof o.email === "string" ? o.email : "",
      picture: typeof o.picture === "string" ? o.picture : "",
    },
    v = framiaReadAccounts().filter((f) => f.id !== d.id);
  let f = [d, ...v];
  (f.length > FRAMIA_MAX_ACCOUNTS &&
    (f = [d, ...v.slice(0, FRAMIA_MAX_ACCOUNTS - 1)]),
    framiaWriteAccounts(f));
  return f.slice(0, FRAMIA_MAX_ACCOUNTS);
}
function framiaForgetAccount(o) {
  const d = framiaReadAccounts().filter((v) => v.id !== o);
  return (framiaWriteAccounts(d), d);
}
function framiaOpenStore(o) {
  return new Promise((d, v) => {
    const f = indexedDB.open(o, Jp);
    ((f.onupgradeneeded = () => {
      const g = f.result;
      (g.objectStoreNames.contains("projects") ||
        g.createObjectStore("projects", { keyPath: "id" }),
        g.objectStoreNames.contains("summaries") ||
          g.createObjectStore("summaries", { keyPath: "id" }));
    }),
      (f.onsuccess = () => d(f.result)),
      (f.onerror = () => v(f.error)));
  });
}
function framiaReadAll(o, d) {
  return new Promise((v, f) => {
    const g = o.transaction(d, "readonly").objectStore(d).getAll();
    ((g.onsuccess = () => v(g.result || [])), (g.onerror = () => f(g.error)));
  });
}
function framiaLoadBrushes() {
  try {
    const o = JSON.parse(localStorage.getItem(framiaScopedKey("framia-brushes")));
    return Array.isArray(o) ? o : [];
  } catch {
    return [];
  }
}
const FRAMIA_TOOL_DEFAULTS = {
  brush: { size: 8, opacity: 100, spacing: 30, rotation: 0, presetId: null },
  eraser: { size: 24, opacity: 100, spacing: 30, rotation: 0, presetId: null },
};
let framiaToolSettingsCache = null;
function framiaToolSettings() {
  if (framiaToolSettingsCache) return framiaToolSettingsCache;
  let o = {};
  try {
    o = JSON.parse(localStorage.getItem("framia-tool-settings")) || {};
  } catch {
    o = {};
  }
  return (framiaToolSettingsCache = {
    brush: { ...FRAMIA_TOOL_DEFAULTS.brush, ...(o.brush || {}) },
    eraser: { ...FRAMIA_TOOL_DEFAULTS.eraser, ...(o.eraser || {}) },
  });
}
function framiaRememberTool(o, d) {
  if (o !== "brush" && o !== "eraser") return;
  const v = framiaToolSettings();
  v[o] = { ...v[o], ...d };
  try {
    localStorage.setItem("framia-tool-settings", JSON.stringify(v));
  } catch {}
}
async function framiaClaimLocalData(o) {
  if (!o) return !1;
  let d = null;
  try {
    d = localStorage.getItem(FRAMIA_OWNER_KEY);
    if (!d) localStorage.setItem(FRAMIA_OWNER_KEY, o);
  } catch {
    return !1;
  }
  if (d && d !== o) return !1;
  for (const [v, f] of [
    ["framia-brushes", `framia-brushes:${o}`],
    ["framia-project", `framia-project:${o}`],
  ])
    try {
      const g = localStorage.getItem(v);
      g && (localStorage.setItem(f, g), localStorage.removeItem(v));
    } catch {}
  try {
    const v = await framiaOpenStore(Kp),
      [f, g] = await Promise.all([
        framiaReadAll(v, "projects"),
        framiaReadAll(v, "summaries"),
      ]);
    v.close();
    if (f.length || g.length) {
      const b = await framiaOpenStore(`${Kp}-${o}`);
      await new Promise((N, M) => {
        const B = b.transaction(["projects", "summaries"], "readwrite");
        for (const q of f) B.objectStore("projects").put(q);
        for (const q of g) B.objectStore("summaries").put(q);
        ((B.oncomplete = () => N()), (B.onerror = () => M(B.error)));
      });
      (b.close(), await framiaClearStore(Kp));
    }
  } catch {}
  return !0;
}
async function framiaClearStore(o) {
  try {
    const d = await framiaOpenStore(o);
    await new Promise((v, f) => {
      const g = d.transaction(["projects", "summaries"], "readwrite");
      (g.objectStore("projects").clear(),
        g.objectStore("summaries").clear(),
        (g.oncomplete = () => v()),
        (g.onerror = () => f(g.error)));
    });
    d.close();
  } catch {}
}
async function framiaUseAccount(o) {
  const d = framiaAccountScopeFor(o);
  ((framiaAccountScope = d), await framiaClaimLocalData(d));
  return d;
}
function Do() {
  return new Promise((o, d) => {
    const v = indexedDB.open(
      framiaAccountScope ? `${Kp}-${framiaAccountScope}` : Kp,
      Jp,
    );
    ((v.onupgradeneeded = () => {
      const f = v.result;
      (f.objectStoreNames.contains("projects") ||
        f.createObjectStore("projects", { keyPath: "id" }),
        f.objectStoreNames.contains("summaries") ||
          f.createObjectStore("summaries", { keyPath: "id" }));
    }),
      (v.onsuccess = () => o(v.result)),
      (v.onerror = () => d(v.error)));
  });
}
async function hm(o) {
  const d = await Do();
  return new Promise((v, f) => {
    const g = d.transaction(["projects", "summaries"], "readwrite"),
      b = Date.now();
    (g.objectStore("projects").put(o),
      g.objectStore("summaries").put({
        id: o.id,
        name: o.name || "Sem título",
        width: o.width,
        height: o.height,
        fps: o.fps,
        frames: o.frames.length,
        updatedAt: b,
      }),
      (g.oncomplete = () => {
        (d.close(), v(b));
      }),
      (g.onerror = () => {
        (d.close(), f(g.error));
      }),
      (g.onabort = () => {
        (d.close(), f(g.error));
      }));
  });
}
async function ym() {
  const o = await Do();
  return new Promise((d, v) => {
    const f = o.transaction("summaries", "readonly"),
      g = f.objectStore("summaries").getAll();
    ((g.onsuccess = () =>
      d(g.result.sort((b, N) => N.updatedAt - b.updatedAt))),
      (g.onerror = () => v(g.error)),
      (f.oncomplete = () => o.close()));
  });
}
async function Fp(o) {
  const d = await Do();
  return new Promise((v, f) => {
    const g = d.transaction("projects", "readonly"),
      b = g.objectStore("projects").get(o);
    ((b.onsuccess = () => v(b.result)),
      (b.onerror = () => f(b.error)),
      (g.oncomplete = () => d.close()));
  });
}
async function $p(o) {
  const d = await Do();
  return new Promise((v, f) => {
    const g = d.transaction(["projects", "summaries"], "readwrite");
    (g.objectStore("projects").delete(o),
      g.objectStore("summaries").delete(o),
      (g.oncomplete = () => {
        (d.close(), v());
      }),
      (g.onerror = () => {
        (d.close(), f(g.error));
      }));
  });
}
const Co = () => crypto.randomUUID(),
  Bc = (o, d, v) => Math.max(d, Math.min(v, o));
function Ip(o, d = "Duo Studio") {
  if (
    !o ||
    !Array.isArray(o.layers) ||
    !o.layers.length ||
    !Number.isInteger(o.total) ||
    o.total < 1 ||
    o.total > 1e4
  )
    throw new Error("Formato .duo inválido");
  const v = Bc(Math.round(Number(o.fps) || 12), 1, 60),
    f = Bc(Math.round(Number(o.w) || 1280), 1, 8192),
    g = Bc(Math.round(Number(o.h) || 720), 1, 8192),
    b = Array.from({ length: o.total }, (B, q) => {
      var p;
      const w = Number((p = o.fdur) == null ? void 0 : p[q]);
      return { id: Co(), duration: w > 0 ? Math.max(1, Math.round(w * v)) : 1 };
    }),
    N = o.layers.map((B, q) => ({
      id: Co(),
      name: String(B.name || `Camada ${q + 1}`),
      visible: B.visible !== !1,
      locked: !1,
      opacity: Bc(Number(B.opacity ?? 1), 0, 1),
      blend:
        { "source-over": "normal", "plus-lighter": "lighter" }[B.blend] ||
        B.blend ||
        "normal",
    })),
    M = Object.fromEntries(b.map((B) => [B.id, {}]));
  return (
    o.layers.forEach((B, q) => {
      for (const [w, p] of Object.entries(B.frames || {})) {
        const j = Number(w);
        !Number.isInteger(j) ||
          j < 0 ||
          j >= b.length ||
          typeof p != "string" ||
          !/^data:image\/png;base64,[a-z\d+/]+=*$/i.test(p) ||
          (M[b[j].id][N[q].id] = [
            {
              id: Co(),
              type: "image",
              src: p,
              x: 0,
              y: 0,
              w: f,
              h: g,
              opacity: 1,
            },
          ]);
      }
    }),
    {
      id: Co(),
      name: d.replace(/\.duo$/i, "") || "Duo Studio",
      width: f,
      height: g,
      fps: v,
      frames: b,
      layers: N,
      content: M,
      clips: [],
      revision: 0,
      duoImport: {
        version: o.v || 1,
        frame: Bc(Number(o.frame) || 0, 0, b.length - 1),
        activeLayer: o.activeLayer,
        settings: o.settings || null,
      },
    }
  );
}
function Wp(o, d, v, f, g, b, N = 1) {
  const M = o.width,
    B = o.height;
  if (
    ((f = Math.floor(f)),
    (g = Math.floor(g)),
    f < 0 || g < 0 || f >= M || g >= B)
  )
    return null;
  const q = document.createElement("canvas");
  ((q.width = M), (q.height = B));
  const w = q.getContext("2d", { willReadFrequently: !0 });
  for (const ee of d) v(w, ee);
  const p = w.getImageData(0, 0, M, B).data,
    j = (g * M + f) * 4,
    Z = p.slice(j, j + 4),
    k = new Uint8Array(M * B),
    W = w.createImageData(M, B),
    V = W.data,
    oe = parseInt(b.slice(1, 3), 16),
    ne = parseInt(b.slice(3, 5), 16),
    z = parseInt(b.slice(5, 7), 16);
  if (![oe, ne, z].every(Number.isFinite)) return null;
  const te = Math.round(N * 255),
    P = (ee) => {
      const Ee = ee * 4;
      return (
        Math.abs(p[Ee] - Z[0]) +
          Math.abs(p[Ee + 1] - Z[1]) +
          Math.abs(p[Ee + 2] - Z[2]) +
          Math.abs(p[Ee + 3] - Z[3]) <=
        70
      );
    },
    le = [g * M + f];
  let K = 0;
  for (; le.length; ) {
    const ee = le.pop();
    if (ee < 0 || ee >= k.length || k[ee] || !P(ee)) continue;
    const Ee = Math.floor(ee / M),
      pe = ee % M;
    let he = pe,
      ct = pe;
    for (; he > 0 && !k[Ee * M + he - 1] && P(Ee * M + he - 1); ) he--;
    for (; ct < M - 1 && !k[Ee * M + ct + 1] && P(Ee * M + ct + 1); ) ct++;
    for (let Fe = he; Fe <= ct; Fe++) {
      const Ae = Ee * M + Fe,
        J = Ae * 4;
      ((k[Ae] = 1),
        K++,
        (V[J] = oe),
        (V[J + 1] = ne),
        (V[J + 2] = z),
        (V[J + 3] = te),
        Ee > 0 && !k[Ae - M] && P(Ae - M) && le.push(Ae - M),
        Ee < B - 1 && !k[Ae + M] && P(Ae + M) && le.push(Ae + M));
    }
  }
  if (!K) return null;
  const F = document.createElement("canvas");
  return (
    (F.width = M),
    (F.height = B),
    F.getContext("2d").putImageData(W, 0, 0),
    F.toDataURL("image/png")
  );
}
const Ci = new Map();
function Pp(o, d) {
  var M;
  const v = `${o.id}:${d}:${o.hardness ?? ""}:${o.texture || ""}:${o.textureDepth ?? ""}:${o.tip || ""}:${o.roundness ?? ""}:${o.angle ?? ""}`;
  if (Ci.has(v)) return Ci.get(v);
  const f = document.createElement("canvas");
  f.width = f.height = 96;
  const g = f.getContext("2d"),
    b = Math.max(0, Math.min(1, o.hardness ?? 0.9)),
    N = o.tip === "square" ? 4 : 48;
  if (b >= 0.96)
    ((g.fillStyle = d),
      o.tip === "square"
        ? g.fillRect(N, N, 96 - N * 2, 96 - N * 2)
        : (g.beginPath(), g.arc(48, 48, 47, 0, Math.PI * 2), g.fill()));
  else {
    const B = g.createRadialGradient(48, 48, Math.max(0, b * 45), 48, 48, 48);
    (B.addColorStop(0, d),
      B.addColorStop(1, `${d}00`),
      (g.fillStyle = B),
      o.tip === "square"
        ? g.fillRect(N, N, 96 - N * 2, 96 - N * 2)
        : (g.beginPath(), g.arc(48, 48, 47, 0, Math.PI * 2), g.fill()));
  }
  if (o.textureDepth > 0 || o.texture) {
    const B = g.getImageData(0, 0, 96, 96),
      q = Math.max(0, Math.min(1, o.textureDepth ?? 0.35));
    for (let w = 0; w < 96; w++)
      for (let p = 0; p < 96; p++) {
        const j = (w * 96 + p) * 4 + 3,
          Z =
            (Math.sin(
              p * 127.1 +
                w * 311.7 +
                (((M = o.id) == null ? void 0 : M.length) || 7) * 71.9,
            ) *
              43758.5453) %
            1;
        B.data[j] *= 1 - q * Math.abs(Z);
      }
    g.putImageData(B, 0, 0);
  }
  return (Ci.set(v, f), Ci.size > 120 && Ci.delete(Ci.keys().next().value), f);
}
function X1(o, d) {
  const v = d.brushData || Em[d.brushPreset];
  if (!v) return;
  const f = d.points || [];
  if (!f.length) return;
  const g = Math.max(1, d.size || v.size || 8),
    b = Math.max(1, g * (d.spacing || v.spacing || 0.08)),
    N = Pp(v, d.color || "#22242b"),
    M = o.globalAlpha;
  o.globalCompositeOperation =
    d.erase || v.type === "erase"
      ? "destination-out"
      : v.blend || "source-over";
  let B = 0;
  const q = (p) => {
    const j = (Math.sin(B * 78.233 + 11.3) * 43758.5) % 1,
      Z = B * 2.399,
      k = (v.scatter || 0) * g * j,
      W = Math.max(
        0.25,
        Math.min(2, 1 + ((p.pressure ?? 0.5) - 0.5) * (v.sizePressure || 0)),
      ),
      V = g * W;
    ((o.globalAlpha = M * Math.max(0.02, Math.min(1, v.flow ?? 1))),
      o.save(),
      o.translate(p.x + Math.cos(Z) * k, p.y + Math.sin(Z) * k),
      o.rotate(((v.angle || 0) * Math.PI) / 180),
      o.scale(1, v.roundness || 1),
      o.drawImage(N, -V / 2, -V / 2, V, V),
      o.restore(),
      B++);
  };
  q(f[0]);
  let w = 0;
  for (let p = 1; p < f.length; p++) {
    const j = f[p - 1],
      Z = f[p],
      k = Math.hypot(Z.x - j.x, Z.y - j.y);
    if (!(k < 0.01)) {
      for (let W = b - w; W <= k; W += b) {
        const V = W / k;
        q({
          x: j.x + (Z.x - j.x) * V,
          y: j.y + (Z.y - j.y) * V,
          pressure:
            (j.pressure ?? 0.5) +
            ((Z.pressure ?? 0.5) - (j.pressure ?? 0.5)) * V,
        });
      }
      w = (w + k) % b;
    }
  }
  o.globalAlpha = M;
}
function eg({
  ticketUrl: o = "/api/realtime/ticket",
  room: d,
  onMessage: v = () => {},
  onStatus: f = () => {},
  websocketUrl: g = (b) => b,
}) {
  const b = new URL(o, window.location.href);
  if (b.origin !== window.location.origin)
    throw new Error("The realtime ticket endpoint must be same-origin.");
  let N,
    M,
    B,
    q = !1,
    w = 0,
    p;
  const j = new Map(),
    Z = new TextEncoder();
  function k(ne) {
    if (
      (N == null ? void 0 : N.readyState) !== WebSocket.OPEN ||
      N.bufferedAmount > 64 * 1024
    )
      return !1;
    try {
      if (
        ne.type === "presence" &&
        Z.encode(JSON.stringify(ne.data)).length > 1024
      )
        return !1;
      const z = JSON.stringify(ne);
      return Z.encode(z).length > 16 * 1024 ? !1 : (N.send(z), !0);
    } catch {
      return !1;
    }
  }
  const W = (ne) => {
      if ((clearTimeout(B), (B = void 0), !!ne)) {
        ((ne.onmessage = ne.onclose = ne.onerror = null),
          N === ne && (N = void 0));
        try {
          ne.close(1e3, "Authorization renewal");
        } catch {}
      }
    },
    V = () => {
      if ((clearTimeout(M), q)) return;
      const ne =
        Math.min(3e4, 500 * 2 ** Math.min(w++, 6)) * (0.5 + Math.random());
      M = setTimeout(() => {
        ((M = void 0), oe());
      }, ne);
    };
  async function oe() {
    if (q || p) return;
    f("connecting");
    const ne = new AbortController();
    p = ne;
    const z = setTimeout(() => ne.abort(), 2e4);
    try {
      const te = await fetch(b, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: d }),
        signal: ne.signal,
      });
      if (q) return;
      if (te.status === 401 || te.status === 403) {
        ((q = !0), f("unauthorized"));
        return;
      }
      if (!te.ok) throw new Error("Ticket request failed.");
      const P = await te.json();
      if (q) return;
      const le = new WebSocket(g(P.websocketUrl));
      ((N = le),
        (le.onmessage = ({ data: K }) => {
          if (q || N !== le) return;
          let F;
          try {
            F = JSON.parse(K);
          } catch {
            return;
          }
          if (F.type === "ready") {
            ((w = 0), j.clear(), clearTimeout(B));
            const ee = Number.isFinite(F.expiresInMs)
                ? Math.max(1e3, Math.min(3e5, F.expiresInMs))
                : 3e5,
              Ee = Math.max(250, ee - 500 - Math.random() * 500);
            ((B = setTimeout(() => {
              q || N !== le || (W(le), oe());
            }, Ee)),
              f("connected"));
          }
          if (F.type === "presence") {
            j.clear();
            for (const ee of F.members) j.set(ee.connectionId, ee);
          }
          if (F.type === "presence_update") {
            (j.set(F.member.connectionId, F.member),
              v({ type: "presence", members: [...j.values()] }));
            return;
          }
          v(F);
        }),
        (le.onclose = () => {
          q || N !== le || (W(le), f("disconnected"), V());
        }),
        (le.onerror = () => {
          q || N !== le || (W(le), f("disconnected"), V());
        }));
    } catch {
      q || (f("disconnected"), V());
    } finally {
      (clearTimeout(z), p === ne && (p = void 0));
    }
  }
  return (
    oe(),
    {
      broadcast(ne, z) {
        return k({ type: "broadcast", event: ne, data: z });
      },
      presence(ne) {
        return k({ type: "presence", data: ne });
      },
      close() {
        ((q = !0), clearTimeout(M), p == null || p.abort(), W(N), f("closed"));
      },
    }
  );
}
async function bu(o, d, v) {
  const f = await fetch(o, {
      method: d,
      credentials: "same-origin",
      cache: "no-store",
      headers:
        v instanceof Blob
          ? { "Content-Type": v.type || "application/octet-stream" }
          : { "Content-Type": "application/json" },
      body: v === void 0 ? void 0 : v instanceof Blob ? v : JSON.stringify(v),
    }),
    g = await f.json().catch(() => ({}));
  if (!f.ok) {
    const b = new Error(g.error || `HTTP ${f.status}`);
    throw ((b.status = f.status), b);
  }
  return g;
}
async function tg(o) {
  return bu("/api/rooms", "POST", { project: o });
}
async function M1(o) {
  return bu(`/api/rooms/${encodeURIComponent(o)}/join`, "POST", {});
}
class ag {
  constructor(d, v, { onProject: f, onMessage: g, onStatus: b, onError: N }) {
    ((this.code = d),
      (this.revision = v),
      (this.onProject = f),
      (this.onMessage = g),
      (this.onStatus = b),
      (this.onError = N),
      (this.queue = Promise.resolve()),
      (this.pending = 0),
      (this.closed = !1),
      (this.refreshing = !1),
      (this.connection = eg({
        room: `project:${d}`,
        onStatus: b,
        onMessage: (M) => {
          M.type === "ready" ||
          (M.type === "broadcast" && M.event === "project-updated")
            ? this.refresh()
            : g(M);
        },
      })));
  }
  async refresh(d = !1) {
    if (!(this.closed || this.pending || this.refreshing)) {
      this.refreshing = !0;
      try {
        const v = await bu(`/api/rooms/${this.code}`, "GET");
        !this.closed &&
          !this.pending &&
          (d || v.revision > this.revision) &&
          ((this.revision = v.revision), this.onProject(v.project));
      } catch (v) {
        this.onError(v);
      } finally {
        this.refreshing = !1;
      }
    }
  }
  enqueue(d) {
    return (
      this.pending++,
      (this.queue = this.queue
        .catch(() => {})
        .then(async () => {
          if (!this.closed)
            try {
              return await d();
            } catch (v) {
              this.onError(v);
            }
        })
        .finally(() => {
          (this.pending--, this.pending || this.refresh(!0));
        })),
      this.queue
    );
  }
  stroke(d, v, f) {
    return this.enqueue(async () => {
      const g = await bu(`/api/rooms/${this.code}/stroke`, "POST", {
        frameId: d,
        layerId: v,
        elements: f,
      });
      this.revision = g.revision;
    });
  }
  undo() {
    return this.enqueue(async () => {
      const d = await bu(`/api/rooms/${this.code}/undo`, "POST", {});
      this.revision = d.revision;
      return d;
    });
  }
  mutation(d) {
    return this.enqueue(async () => {
      for (let v = 0; v < 4; v++) {
        const f = await bu(`/api/rooms/${this.code}`, "GET"),
          g = structuredClone(f.project);
        d(g);
        try {
          const b = await bu(`/api/rooms/${this.code}`, "PUT", {
            baseRevision: f.revision,
            project: g,
          });
          this.revision = b.revision;
          return;
        } catch (b) {
          if (b.status !== 409) throw b;
        }
      }
      throw Error("A sala mudou enquanto você editava. Tente novamente.");
    });
  }
  mutations(d) {
    return this.enqueue(async () => {
      if (!d.length) return;
      for (let v = 0; v < 4; v++) {
        const f = await bu(`/api/rooms/${this.code}`, "GET"),
          g = structuredClone(f.project);
        for (const b of d) b(g);
        try {
          const b = await bu(`/api/rooms/${this.code}`, "PUT", {
            baseRevision: f.revision,
            project: g,
          });
          this.revision = b.revision;
          return;
        } catch (b) {
          if (b.status !== 409) throw b;
        }
      }
      throw Error("A sala mudou enquanto você editava. Tente novamente.");
    });
  }
  async uploadMedia(d, v) {
    return bu(`/api/rooms/${this.code}/media/${d}`, "PUT", v);
  }
  async media(d) {
    const v = await fetch(`/api/rooms/${this.code}/media/${d}`, {
      credentials: "same-origin",
    });
    if (!v.ok) throw Error("Mídia indisponível");
    return v.blob();
  }
  broadcast(d, v) {
    return this.connection.broadcast(d, v);
  }
  presence(d) {
    return this.connection.presence(d);
  }
  close() {
    ((this.closed = !0), this.connection.close());
  }
}
const Ke = () => Math.random().toString(36).slice(2, 10),
  Rt = (o, d, v) => Math.max(d, Math.min(v, o)),
  EMOJI_NAMES = { sob: "😭", joy: "😂", laugh: "😂", heart: "❤️", fire: "🔥", sparkles: "✨", thumbsup: "👍", thumbsdown: "👎", clap: "👏", tada: "🎉", eyes: "👀", thinking: "🤔", angry: "😠", scream: "😱", blush: "😊", wink: "😉", cry: "😢", smile: "😄", grin: "😁", rofl: "🤣", kiss: "😘", heart_eyes: "😍", cool: "😎", neutral: "😐", confused: "😕", sleepy: "😴", sick: "🤢", poop: "💩", skull: "💀", ghost: "👻", robot: "🤖", cat: "🐱", dog: "🐶", ok_hand: "👌", pray: "🙏", muscle: "💪", wave: "👋", check: "✅", x: "❌", warning: "⚠️", star: "⭐", hundred: "💯", rocket: "🚀", party: "🥳" },
  expandEmojiNames = (o) =>
    String(o || "").replace(/:([a-z0-9_+-]+):/gi, (d, v) => EMOJI_NAMES[v.toLowerCase()] || d),
  copyText = async (o) => {
    try {
      if (navigator.clipboard && window.isSecureContext) return await navigator.clipboard.writeText(o);
    } catch {}
    const d = document.createElement("textarea");
    d.value = o; d.setAttribute("readonly", ""); d.style.position = "fixed"; d.style.opacity = "0";
    document.body.appendChild(d); d.select();
    const v = document.execCommand("copy"); d.remove();
    if (!v) throw Error("Não foi possível copiar");
    return void 0;
  },
  SHORTCUT_STORE = "framia-shortcuts",
  SHORTCUT_DEFAULTS = {
    transform: "v",
    brush: "b",
    eraser: "e",
    smudge: "s",
    fill: "g",
    pan: "h",
    pipette: "i",
    line: "l",
    rect: "r",
    ellipse: "o",
    note: "n",
  },
  loadShortcuts = () => {
    try {
      const o = JSON.parse(localStorage.getItem(SHORTCUT_STORE) || "{}"),
        d = { ...SHORTCUT_DEFAULTS };
      for (const v of Object.keys(SHORTCUT_DEFAULTS))
        typeof o[v] === "string" && /^[a-z0-9]$/.test(o[v]) && (d[v] = o[v]);
      return d;
    } catch {
      return { ...SHORTCUT_DEFAULTS };
    }
  },
  saveShortcuts = (o) => {
    try {
      localStorage.setItem(SHORTCUT_STORE, JSON.stringify(o));
    } catch {}
    return o;
  };
async function gu(o, d = "GET", v) {
  const f = await fetch(o, {
    method: d,
    credentials: "same-origin",
    headers: v ? { "Content-Type": "application/json" } : {},
    body: v ? JSON.stringify(v) : void 0,
  });
  if (!f.ok) throw Error(`Cloud ${f.status}`);
  return f.json();
}
function C1({ brush: o, color: d = "#333447" }) {
  const v = Y.useRef(null);
  return (
    Y.useEffect(() => {
      const f = v.current;
      if (!f) return;
      const g = f.getContext("2d");
      (g.clearRect(0, 0, 180, 48),
        (g.fillStyle = "#f5f2ec"),
        g.fillRect(0, 0, 90, 48),
        (g.fillStyle = "#292b38"),
        g.fillRect(90, 0, 90, 48));
      const b = o.type === "erase";
      if (
        (b && ((g.fillStyle = "#9a90ba"), g.fillRect(7, 8, 166, 32)),
        g.save(),
        o.type === "smudge" &&
          ((g.strokeStyle = "#aa7e8e"),
          (g.lineWidth = 12),
          g.beginPath(),
          g.moveTo(10, 32),
          g.bezierCurveTo(48, 6, 112, 44, 170, 16),
          g.stroke(),
          (g.globalAlpha = 0.45),
          g.translate(5, 3)),
        o.src)
      ) {
        const N = new Image();
        ((N.onload = () => {
          g.drawImage(N, 18, 10, 144, 28);
        }),
          (N.src = o.src));
      } else
        X1(g, {
          brushData: o,
          points: Array.from({ length: 65 }, (N, M) => ({
            x: 9 + M * 2.5,
            y: 24 + Math.sin(M / 10) * 8,
            pressure: 0.5 + M / 130,
          })),
          size: Math.min(o.size || 14, 18),
          spacing: o.spacing || 0.06,
          color: b ? "#333447" : d,
          erase: b,
        });
      g.restore();
    }, [o, d]),
    r.createElement("canvas", {
      className: "brush-preview-canvas",
      width: "180",
      height: "48",
      ref: v,
    })
  );
}
const lg = ["#22242b", "#ffffff", "#f06875", "#f6bd59", "#72a9ed", "#77d0b8"],
  ng = [
    "normal",
    "multiply",
    "screen",
    "overlay",
    "lighter",
    "color-dodge",
    "color-burn",
    "soft-light",
    "hard-light",
    "difference",
    "exclusion",
    "hue",
    "saturation",
    "color",
    "luminosity",
  ],
  x1 = {
    normal: "source-over",
    multiply: "multiply",
    screen: "screen",
    overlay: "overlay",
    lighter: "lighter",
    "color-dodge": "color-dodge",
    "color-burn": "color-burn",
    "soft-light": "soft-light",
    "hard-light": "hard-light",
    difference: "difference",
    exclusion: "exclusion",
    hue: "hue",
    saturation: "saturation",
    color: "color",
    luminosity: "luminosity",
  },
  A1 = {
    pt: {
      file: "Arquivo",
      edit: "Editar",
      view: "Visualizar",
      project: "Projeto",
      open: "Abrir",
      save: "Salvar",
      export: "Exportar",
      canvas: "Tela",
      timeline: "Linha do tempo",
      layers: "Camadas",
      brush: "Pincel",
      brushes: "Pincéis",
      color: "Cor",
      opacity: "Opacidade",
      size: "Tamanho",
      spacing: "Espaçamento",
      rotation: "Rotação",
      symmetry: "Simetria",
      none: "Nenhuma",
      horizontal: "Horizontal",
      vertical: "Vertical",
      both: "Ambas",
      settings: "Configurações",
      resolution: "Resolução",
      custom: "Personalizada",
      width: "Largura",
      height: "Altura",
      fps: "Quadros/s",
      apply: "Aplicar",
      cancel: "Cancelar",
      newFrame: "Novo quadro",
      duplicate: "Duplicar",
      delete: "Excluir",
      split: "Cortar",
      onion: "Onion skin",
      chat: "Chat",
      notes: "Anotações",
      clearNotes: "Limpar anotações",
      chatEmpty: "Nenhuma mensagem ainda — diga oi para quem está na sala.",
      full: "Só tela",
      theme: "Tema",
      language: "Idioma",
      audio: "Áudio",
      video: "Vídeo",
      image: "Imagem",
      import: "Importar",
      recent: "Cores recentes",
      connected: "Conectado nesta janela",
      offline: "Sessão local",
      transform: "Transformar",
      confirm: "Confirmar",
      reset: "Redefinir",
      presets: "Predefinições",
      selected: "Selecionado",
      effects: "Aparência",
      previous: "Anteriores",
      next: "Próximos",
      frames: "quadros",
      preview: "Prévia",
      stamp: "Carimbo",
      welcome: "Seu estúdio criativo",
      message: "Mensagem",
      send: "Enviar",
      copy: "Copiar",
      paste: "Colar",
      group: "Agrupar",
      ungroup: "Desagrupar",
      rename: "Renomear",
      addLayer: "Nova camada",
      hide: "Ocultar",
      show: "Mostrar",
      shortcuts: "Atalhos",
      play: "Reproduzir",
      pause: "Pausar",
      trimming: "Arraste as bordas para aparar",
      collab: "Colaboração local",
      notAvailable:
        "Sessão remota precisa de um servidor de colaboração configurado.",
    },
    en: {
      file: "File",
      edit: "Edit",
      view: "View",
      project: "Project",
      open: "Open",
      save: "Save",
      export: "Export",
      canvas: "Canvas",
      timeline: "Timeline",
      layers: "Layers",
      brush: "Brush",
      brushes: "Brushes",
      color: "Color",
      opacity: "Opacity",
      size: "Size",
      spacing: "Spacing",
      rotation: "Rotation",
      symmetry: "Symmetry",
      none: "None",
      horizontal: "Horizontal",
      vertical: "Vertical",
      both: "Both",
      settings: "Settings",
      resolution: "Resolution",
      custom: "Custom",
      width: "Width",
      height: "Height",
      fps: "Frames/s",
      apply: "Apply",
      cancel: "Cancel",
      newFrame: "New frame",
      duplicate: "Duplicate",
      delete: "Delete",
      split: "Split",
      onion: "Onion skin",
      chat: "Chat",
      notes: "Annotations",
      clearNotes: "Clear annotations",
      chatEmpty: "No messages yet — say hi to whoever is in the room.",
      full: "Canvas only",
      theme: "Theme",
      language: "Language",
      audio: "Audio",
      video: "Video",
      image: "Image",
      import: "Import",
      recent: "Recent colors",
      connected: "Connected in this window",
      offline: "Local session",
      transform: "Transform",
      confirm: "Confirm",
      reset: "Reset",
      presets: "Presets",
      selected: "Selected",
      effects: "Appearance",
      previous: "Previous",
      next: "Next",
      frames: "frames",
      preview: "Preview",
      stamp: "Stamp",
      welcome: "Your creative studio",
      message: "Message",
      send: "Send",
      copy: "Copy",
      paste: "Paste",
      group: "Group",
      ungroup: "Ungroup",
      rename: "Rename",
      addLayer: "New layer",
      hide: "Hide",
      show: "Show",
      shortcuts: "Shortcuts",
      play: "Play",
      pause: "Pause",
      trimming: "Drag edges to trim",
      collab: "Local collaboration",
      notAvailable: "Remote sessions need a configured collaboration server.",
    },
    es: {
      file: "Archivo",
      edit: "Editar",
      view: "Ver",
      project: "Proyecto",
      open: "Abrir",
      save: "Guardar",
      export: "Exportar",
      canvas: "Lienzo",
      timeline: "Línea de tiempo",
      layers: "Capas",
      brush: "Pincel",
      brushes: "Pinceles",
      color: "Color",
      opacity: "Opacidad",
      size: "Tamaño",
      spacing: "Espaciado",
      rotation: "Rotación",
      symmetry: "Simetría",
      none: "Ninguna",
      horizontal: "Horizontal",
      vertical: "Vertical",
      both: "Ambas",
      settings: "Configuración",
      resolution: "Resolución",
      custom: "Personalizada",
      width: "Ancho",
      height: "Alto",
      fps: "Fotogramas/s",
      apply: "Aplicar",
      cancel: "Cancelar",
      newFrame: "Nuevo fotograma",
      duplicate: "Duplicar",
      delete: "Eliminar",
      split: "Dividir",
      onion: "Papel cebolla",
      chat: "Chat",
      notes: "Anotaciones",
      clearNotes: "Borrar anotaciones",
      chatEmpty: "Todavía no hay mensajes — saluda a quien esté en la sala.",
      full: "Solo lienzo",
      theme: "Tema",
      language: "Idioma",
      audio: "Audio",
      video: "Video",
      image: "Imagen",
      import: "Importar",
      recent: "Colores recientes",
      connected: "Conectado en esta ventana",
      offline: "Sesión local",
      transform: "Transformar",
      confirm: "Confirmar",
      reset: "Restablecer",
      presets: "Preajustes",
      selected: "Seleccionado",
      effects: "Apariencia",
      previous: "Anteriores",
      next: "Próximos",
      frames: "fotogramas",
      preview: "Vista previa",
      stamp: "Sello",
      welcome: "Tu estudio creativo",
      message: "Mensaje",
      send: "Enviar",
      copy: "Copiar",
      paste: "Pegar",
      group: "Agrupar",
      ungroup: "Desagrupar",
      rename: "Renombrar",
      addLayer: "Nueva capa",
      hide: "Ocultar",
      show: "Mostrar",
      shortcuts: "Atajos",
      play: "Reproducir",
      pause: "Pausar",
      trimming: "Arrastra los bordes para recortar",
      collab: "Colaboración local",
      notAvailable:
        "Las sesiones remotas necesitan un servidor de colaboración configurado.",
    },
  },
  w1 = {
    pt: {
      eyebrow: "SEU ESPAÇO CRIATIVO",
      title: "Comece a criar no Framia.",
      subtitle: "Escolha o tamanho da tela ou continue de onde parou.",
      new: "Novo projeto",
      create: "Criar projeto",
      import: "Importar projeto",
      library: "Seus projetos",
      empty: "Seus projetos salvos aparecerão aqui.",
      updated: "Atualizado",
      open: "Abrir projeto",
      remove: "Excluir projeto",
      autosave: "Salvo automaticamente",
      saving: "Salvando...",
      failed: "Erro ao salvar",
      home: "Projetos",
    },
    en: {
      eyebrow: "YOUR CREATIVE SPACE",
      title: "Start creating in Framia.",
      subtitle: "Choose a canvas size or pick up where you left off.",
      new: "New project",
      create: "Create project",
      import: "Import project",
      library: "Your projects",
      empty: "Your saved projects will appear here.",
      updated: "Updated",
      open: "Open project",
      remove: "Delete project",
      autosave: "Saved automatically",
      saving: "Saving...",
      failed: "Save failed",
      home: "Projects",
    },
    es: {
      eyebrow: "TU ESPACIO CREATIVO",
      title: "Empieza a crear en Framia.",
      subtitle: "Elige el tamaño del lienzo o continúa donde lo dejaste.",
      new: "Nuevo proyecto",
      create: "Crear proyecto",
      import: "Importar proyecto",
      library: "Tus proyectos",
      empty: "Tus proyectos guardados aparecerán aquí.",
      updated: "Actualizado",
      open: "Abrir proyecto",
      remove: "Eliminar proyecto",
      autosave: "Guardado automáticamente",
      saving: "Guardando...",
      failed: "Error al guardar",
      home: "Proyectos",
    },
  },
  Sm = (o = 1920, d = 1080, v = "Meu projeto") => {
    let f = Ke(),
      g = Ke();
    return {
      id: Ke(),
      name: v,
      width: o,
      height: d,
      background: "#ffffff",
      fps: 12,
      frames: [{ id: f, start: 0, duration: 1 }],
      layers: [
        {
          id: g,
          name: "Camada 1",
          visible: !0,
          locked: !1,
          opacity: 1,
          blend: "normal",
        },
      ],
      content: { [f]: { [g]: [] } },
      clips: [],
      grid: !1,
      gridSize: 12,
      loop: !0,
      revision: 0,
    };
  };
function ug() {
  var o, d;
  try {
    let v = JSON.parse(localStorage.getItem(framiaScopedKey("framia-project")));
    return (o = v == null ? void 0 : v.frames) != null &&
      o.length &&
      (d = v == null ? void 0 : v.layers) != null &&
      d.length
      ? { ...v, id: v.id || Ke(), frames: qc(v.frames) }
      : Sm();
  } catch {
    return Sm();
  }
}
const ig = [],
  zm = new Map();
function Tm(o, d) {
  if (!o) return null;
  let v = zm.get(o);
  return (
    v || ((v = new Image()), (v.onload = d), (v.src = o), zm.set(o, v)),
    v.complete && v.naturalWidth ? v : null
  );
}
function Eu(o, d, v) {
  if (
    (o.save(),
    o.transform(...Yc(d)),
    (o.imageSmoothingEnabled = !0),
    (o.imageSmoothingQuality = "high"),
    (o.globalAlpha = d.opacity ?? 1),
    d.type === "stroke" && (d.brushPreset || d.brushData))
  ) {
    (X1(o, d), o.restore());
    return;
  }
  if (d.type === "image") {
    let f = Tm(d.src, v);
    f && o.drawImage(f, d.x, d.y, d.w, d.h);
  } else if (d.type === "stroke") {
    d.erase && (o.globalCompositeOperation = "destination-out");
    let f = d.points || [];
    if (
      ((o.strokeStyle = d.color || "#222"),
      (o.fillStyle = d.color || "#222"),
      (o.lineWidth = d.size || 4),
      (o.lineCap = "round"),
      (o.lineJoin = "round"),
      d.brushImage)
    ) {
      let g = Tm(d.brushImage, v);
      if (g) {
        let b = 0,
          N = Math.max(1, (d.size || 24) * (d.spacing || 0.3));
        for (let M = 0; M < f.length; M++)
          if (M) {
            let B = f[M - 1],
              q = f[M],
              w = Math.hypot(q.x - B.x, q.y - B.y);
            for (let p = N - b; p <= w; p += N) {
              let j = p / w;
              (o.save(),
                o.translate(B.x + (q.x - B.x) * j, B.y + (q.y - B.y) * j),
                o.rotate(((d.brushRotation || 0) * Math.PI) / 180),
                o.drawImage(g, -d.size / 2, -d.size / 2, d.size, d.size),
                o.restore());
            }
            b = (b + w) % N;
          } else
            o.drawImage(
              g,
              f[0].x - d.size / 2,
              f[0].y - d.size / 2,
              d.size,
              d.size,
            );
      }
    } else if (f.length)
      if ((o.beginPath(), o.moveTo(f[0].x, f[0].y), f.length === 1))
        (o.arc(f[0].x, f[0].y, (d.size || 4) / 2, 0, Math.PI * 2), o.fill());
      else {
        for (let g = 1; g < f.length; g++) o.lineTo(f[g].x, f[g].y);
        o.stroke();
      }
  } else
    d.type === "shape" &&
      ((o.strokeStyle = d.color),
      (o.lineWidth = d.size || 4),
      o.beginPath(),
      d.shape === "rect"
        ? o.rect(d.x, d.y, d.w, d.h)
        : d.shape === "ellipse"
          ? o.ellipse(
              d.x + d.w / 2,
              d.y + d.h / 2,
              Math.abs(d.w / 2),
              Math.abs(d.h / 2),
              0,
              0,
              Math.PI * 2,
            )
          : d.points && d.points.length > 1
            ? (o.moveTo(d.points[0].x, d.points[0].y),
              o.lineTo(d.points[1].x, d.points[1].y))
            : (o.moveTo(d.x, d.y), o.lineTo(d.x + d.w, d.y + d.h)),
      o.stroke());
  o.restore();
}
function O1(o, d, v, f) {
  const g = [o];
  return (
    (f === "vertical" || f === "both") &&
      g.push({
        ...o,
        id: `${o.id}-v`,
        points: o.points.map((b) => ({ ...b, x: d - b.x })),
        x: d - o.x - o.w,
      }),
    (f === "horizontal" || f === "both") &&
      g.push({
        ...o,
        id: `${o.id}-h`,
        points: o.points.map((b) => ({ ...b, y: v - b.y })),
        y: v - o.y - o.h,
      }),
    f === "both" &&
      g.push({
        ...o,
        id: `${o.id}-hv`,
        points: o.points.map((b) => ({ ...b, x: d - b.x, y: v - b.y })),
        x: d - o.x - o.w,
        y: v - o.y - o.h,
      }),
    g
  );
}
function D1({
  box: o,
  transform: d,
  scale: v = 1,
  remote: f = !1,
  onStart: g,
  onMove: b,
  onEnd: N,
}) {
  if (!o || !d) return null;
  const M = bm(o, xi(o, d)),
    B = { x: o.x + o.w / 2 + (d.x || 0), y: o.y + o.h / 2 + (d.y || 0) },
    q = { x: (M[0].x + M[1].x) / 2, y: (M[0].y + M[1].y) / 2 },
    w = Math.hypot(q.x - B.x, q.y - B.y) || 1,
    p = {
      x: q.x + ((q.x - B.x) / w) * 28 * v,
      y: q.y + ((q.y - B.y) / w) * 28 * v,
    },
    j = bm(o, xi(o, { ...d, flipX: !1, flipY: !1 }));
  return r.createElement(
    "g",
    {
      className: f ? "remote-transform" : "local-transform",
      onPointerMove: f ? void 0 : b,
      onPointerUp: f ? void 0 : N,
      onPointerCancel: f ? void 0 : N,
    },
    r.createElement("polygon", {
      className: "transform-outline",
      points: M.map((Z) => `${Z.x},${Z.y}`).join(" "),
      onPointerDown: f ? void 0 : (Z) => g(Z, "move"),
    }),
    r.createElement("line", { x1: q.x, y1: q.y, x2: p.x, y2: p.y }),
    j.map((Z, k) =>
      r.createElement("rect", {
        key: k,
        "data-transform-handle": k,
        className: "transform-handle",
        x: Z.x - 5 * v,
        y: Z.y - 5 * v,
        width: 10 * v,
        height: 10 * v,
        onPointerDown: f
          ? void 0
          : (W) =>
              g(
                W,
                "resize",
                [
                  [-1, -1],
                  [1, -1],
                  [1, 1],
                  [-1, 1],
                ][k],
              ),
      }),
    ),
    r.createElement("circle", {
      className: "transform-rotate",
      "data-transform-handle": "rotate",
      cx: p.x,
      cy: p.y,
      r: 6 * v,
      onPointerDown: f ? void 0 : (Z) => g(Z, "rotate"),
    }),
    f &&
      r.createElement(
        "text",
        { x: p.x + 10 * v, y: p.y, fontSize: 11 * v },
        "Live preview",
      ),
  );
}
function cg() {
  var Fi, Dl, ur, ir, cr, $i, Ii, un, cn;
  const o = Y.useRef(new Map()),
    d = Y.useRef(null),
    [v, f] = Y.useState(null),
    g = Y.useRef(!1),
    [b, N] = Y.useState({ x: 0, y: 0 }),
    [M, B] = Y.useState(null),
    [q, w] = Y.useState(null),
    [p, j] = Y.useState("content"),
    [Z, k] = Y.useState({}),
    W = Y.useRef(new Map()),
    V = Y.useRef(null),
    oe = Y.useRef(null),
    ne = (i, s) => {
      (clearTimeout(W.current.get(i)),
        k((h) => {
          const y = { ...h };
          return (N1(s) ? (y[i] = s) : delete y[i], y);
        }),
        N1(s) &&
          W.current.set(
            i,
            setTimeout(
              () =>
                k((h) => {
                  const y = { ...h };
                  return (delete y[i], y);
                }),
              3e4,
            ),
          ));
    },
    [z, te] = Y.useState(ug),
    [P, le] = Y.useState(0),
    [K, F] = Y.useState(0),
    [ee, Ee] = Y.useState(z.layers[0].id),
    [pe, he] = Y.useState("brush"),
    [ct, Fe] = Y.useState("#22242b"),
    [Ae, J] = Y.useState(() => framiaToolSettings().brush.size),
    [re, ye] = Y.useState(() => framiaToolSettings().brush.opacity),
    [xe, ke] = Y.useState(70),
    [Yt, ga] = Y.useState(!1),
    [xa, T] = Y.useState(2),
    [Q, fe] = Y.useState(1),
    [ce, Ye] = Y.useState(18),
    [we, Ge] = Y.useState("none"),
    [ie, ve] = Y.useState("properties"),
    [Oe, Ve] = Y.useState(""),
    [ka, Ft] = Y.useState(!1),
    [gt, Qe] = Y.useState(!1),
    [$t, Aa] = Y.useState(!1),
    [Va, ia] = Y.useState(null),
    [$e, rt] = Y.useState(null),
    [jn, Vl] = Y.useState(null),
    [Me, Ai] = Y.useState(localStorage.getItem("framia-language") || "pt"),
    [ft, Qa] = Y.useState(() => {
      try {
        return (
          JSON.parse(localStorage.getItem("framia-theme")) || {
            accent: "#9585ed",
            surface: "#1b1d27",
            background: "",
          }
        );
      } catch {
        return { accent: "#9585ed", surface: "#1b1d27", background: "" };
      }
    }),
    [ll, qn] = Y.useState(() => {
      try {
        return framiaLoadBrushes();
      } catch {
        return [];
      }
    }),
    [lt, Sl] = Y.useState(null),
    [Yn, zu] = Y.useState(() => framiaToolSettings().brush.spacing),
    [wi, Ro] = Y.useState(() => framiaToolSettings().brush.rotation),
    [ea, Tu] = Y.useState(!1),
    [Nu, Mu] = Y.useState([]),
    [Ql, Lc] = Y.useState(""),
    [emojiOpen, setEmojiOpen] = Y.useState(!1),
    [fpsOpen, setFpsOpen] = Y.useState(!1),
    [shortcuts, setShortcuts] = Y.useState(loadShortcuts),
    [renderFps, setRenderFps] = Y.useState(0),
    [ca, Cu] = Y.useState(null),
    [noteStrokes, setNoteStrokes] = Y.useState([]),
    [noteVisible, setNoteVisible] = Y.useState(!0),
    [_o, Za] = Y.useState([]),
    [Tt, ta] = Y.useState(null),
    [It, Oi] = Y.useState(1),
    [Gc, Uo] = Y.useState(239),
    [Zl, xu] = Y.useState(""),
    [Kl, Ka] = Y.useState("Canetas"),
    [Nt, Lt] = Y.useState(null),
    [Di, Xc] = Y.useState(!1),
    [zl, Ln] = Y.useState(""),
    [nl, kc] = Y.useState(null),
    [Ri, _i] = Y.useState("offline"),
    [Mt, Ui] = Y.useState(null),
    [authAvailable, setAuthAvailable] = Y.useState(!1),
    [accounts, setAccounts] = Y.useState(framiaReadAccounts),
    [accountMenu, setAccountMenu] = Y.useState(!1),
    [profile, setProfile] = Y.useState(null),
    [profileDraft, setProfileDraft] = Y.useState(null),
    [profilePeek, setProfilePeek] = Y.useState(null),
    [friends, setFriends] = Y.useState({ friend: [], incoming: [], outgoing: [] }),
    [friendQuery, setFriendQuery] = Y.useState(""),
    [friendResults, setFriendResults] = Y.useState([]),
    [usernameStatus, setUsernameStatus] = Y.useState(""),
    [Au, Hi] = Y.useState({}),
    [rc, setRc] = Y.useState({}),
    [Vc, wa] = Y.useState([]),
    [Et, Ut] = Y.useState(null),
    [Tl, wu] = Y.useState(
      () => typeof window > "u" || window.innerWidth > 900,
    ),
    [Bi, Ho] = Y.useState(() => {
      try {
        return JSON.parse(localStorage.getItem("framia-themes")) || [];
      } catch {
        return [];
      }
    }),
    [Oa, ul] = Y.useState("home"),
    [Jl, Nl] = Y.useState([]),
    [ra, il] = Y.useState({ width: 1920, height: 1080 }),
    [Fl, $l] = Y.useState("Meu projeto"),
    [yt, Ou] = Y.useState("saved"),
    Ct = Y.useRef(null),
    Du = Y.useRef(null),
    cl = Y.useRef(0),
    cursorAt = Y.useRef(0),
    bt = Y.useRef(z),
    Gn = Y.useRef(z.revision || 0),
    Ml = Y.useRef(null),
    Xn = Y.useRef(!1),
    [ji, Le] = Y.useState({}),
    [Qc, kn] = Y.useState(0),
    Ja = Y.useRef(new Map()),
    oa = Y.useRef(new Map()),
    H = A1[Me] || A1.pt,
    xt = w1[Me] || w1.pt,
    Cl = Y.useRef(null),
    noteRef = Y.useRef(null),
    noteDraw = Y.useRef(null),
    sa = Y.useRef(null),
    Wt = Y.useRef(null),
    fa = Y.useRef([]),
    Ht = Y.useRef([]),
    rl_redo = Y.useRef([]),
    Il = Y.useRef(null),
    Vn = Y.useRef(Ke()),
    xl = Y.useRef(null),
    Fa = Y.useRef(null),
    qi = Y.useRef(null),
    Yi = Y.useRef(null),
    Al = Y.useRef(null),
    Zc = Y.useRef(null),
    Wl = Y.useRef(null),
    Ru = Y.useRef(null),
    Ea = Y.useRef(new Map());
  Y.useRef(null);
  const Bo = Y.useRef(!1),
    ze = P >= 0 ? z.frames[P] : null,
    Ue = z.layers.find((i) => i.id === ee) || z.layers[0],
    mt =
      ((Dl =
        (Fi = z.content) == null ? void 0 : Fi[ze == null ? void 0 : ze.id]) ==
      null
        ? void 0
        : Dl[Ue == null ? void 0 : Ue.id]) || [];
  Y.useEffect(() => {
    let active = !0;
    fetch("/api/me", { credentials: "same-origin" })
      .then(async (i) => {
        setAuthAvailable(i.headers.get("content-type")?.includes("json") || !1);
        const s = i.ok ? await i.json().catch(() => null) : null,
          h = (s == null ? void 0 : s.user) || null;
        (Ui(h),
          setAccounts(framiaRememberAccount(h)),
          await framiaUseAccount(h));
        if (h)
          try {
            const y = await bu("/api/profile", "GET");
            active && y && y.profile && setProfile(y.profile);
          } catch {}
        if (!active) return;
        try {
          (qn(framiaLoadBrushes()), Nl(await ym()));
        } catch {}
        Xc(!0);
      })
      .catch(() => Xc(!0));
    return () => {
      active = !1;
    };
  }, []);
  Y.useEffect(() => {
    if (!accountMenu) return;
    const i = (s) => {
        var h;
        (h = s.target) != null &&
          h.closest &&
          h.closest(".account-control") ||
          setAccountMenu(!1);
      },
      s = (h) => h.key === "Escape" && setAccountMenu(!1);
    return (
      document.addEventListener("pointerdown", i),
      window.addEventListener("keydown", s),
      () => {
        (document.removeEventListener("pointerdown", i),
          window.removeEventListener("keydown", s));
      }
    );
  }, [accountMenu]);
  const He = (i, s = "", h = null) => {
      (Cu({ title: i, body: s, action: h, id: Ke() }),
        setTimeout(
          () => Cu((y) => ((y == null ? void 0 : y.title) === i ? null : y)),
          4500,
        ));
    },
    Pl = async (i) => {
      for (const s of i)
        if (!(!s.mediaId || oa.current.has(s.mediaId)))
          try {
            let y = await pm(s.mediaId);
            if (
              (!y &&
                Ct.current &&
                ((y = await Ct.current.media(s.mediaId)),
                await xo(s.mediaId, y)),
              y)
            ) {
              const R = URL.createObjectURL(y);
              (oa.current.set(s.mediaId, R),
                Le((U) => ({ ...U, [s.mediaId]: R })));
            }
          } catch {}
    };
  (Y.useEffect(
    () => (
      Pl(z.clips),
      () => {
        for (const i of oa.current.values()) URL.revokeObjectURL(i);
      }
    ),
    [],
  ),
    Y.useEffect(() => {
      for (const i of z.clips) {
        const s = Ja.current.get(i.id);
        if (!s) continue;
        const h = K >= i.start && K < i.start + i.duration,
          y = i.offset + K - i.start;
        (h &&
          s.readyState >= 1 &&
          Math.abs(s.currentTime - y) > 0.12 &&
          (s.currentTime = Rt(y, 0, Math.max(0, i.sourceDuration - 0.01))),
          h && $t
            ? s.paused && s.play().catch(() => {})
            : s.paused || s.pause());
      }
    }, [K, $t, z.clips, ji]));
  const roomQueue = Y.useRef([]),
    roomTimer = Y.useRef(null),
    queueRoomMutation = (i) => {
      roomQueue.current.push(i);
      (clearTimeout(roomTimer.current),
        (roomTimer.current = setTimeout(() => {
          const s = roomQueue.current,
            h = Ct.current;
          ((roomQueue.current = []), h && s.length && h.mutations(s));
        }, 160)));
    };
  const De = Y.useCallback((i) => {
      var y;
      const s = bt.current,
        h = structuredClone(s);
      (i(h),
        (h.revision = ++Gn.current),
        fa.current.push(s),
        fa.current.length > 12 && fa.current.shift(),
        (Ht.current = []),
        (bt.current = h),
        te(h),
        (y = Ct.current) != null && y && queueRoomMutation(i));
    }, []),
    rl = (i, s, h) => {
      var X, $;
      const y = bt.current,
        R = y.content[i] || {},
        U = {
          ...y,
          content: {
            ...y.content,
            [i]: {
              ...R,
              [s]: [
                ...(R[s] || []),
                ...h.map((element) => ({
                  ...element,
                  authorId: (Mt == null ? void 0 : Mt.sub) || Vn.current,
                  createdAt: Date.now(),
                })),
              ],
            },
          },
          revision: ++Gn.current,
        };
      (fa.current.push(y),
        fa.current.length > 12 && fa.current.shift(),
        (Ht.current = []),
        (rl_redo.current = []),
        (bt.current = U),
        te(U),
        (X = Ct.current) == null ||
          X.stroke(
            i,
            s,
            h.map((element) => ({
              ...element,
              authorId: (Mt == null ? void 0 : Mt.sub) || Vn.current,
              createdAt: Date.now(),
            })),
          ),
        ($ = Ct.current) == null ||
          $.broadcast("stroke-end", { frameId: i, layerId: s }));
    },
    Li = (i) => {
      var h;
      const s = { ...i, frames: qc(i.frames) };
      ((bt.current = s),
        (Gn.current = s.revision || 0),
        Ea.current.clear(),
        te(s),
        le((y) => Math.max(-1, gm(s.frames, K, s.fps))),
        s.layers.some((y) => y.id === ee) ||
          Ee((h = s.layers[0]) == null ? void 0 : h.id),
        Pl(s.clips || []));
    },
    _u = (i) => {
      var h;
      const s = { ...i, revision: ++Gn.current };
      ((bt.current = s),
        Ea.current.clear(),
        te(s),
        (h = Ct.current) != null &&
          h &&
          queueRoomMutation((y) => Object.assign(y, structuredClone(i))));
    },
    Uu = async () => {
      (B(null), rt(null), ia(null));
      if (Ct.current) {
        const i = await Ct.current.undo();
        i &&
          i.removed &&
          i.element &&
          (rl_redo.current.push({
            frameId: i.frameId,
            layerId: i.layerId,
            element: i.element,
          }),
          rl_redo.current.length > 30 && rl_redo.current.shift());
        return;
      }
      const i = fa.current.pop();
      i && (Ht.current.push(bt.current), _u(i));
    },
    ol = async () => {
      (B(null), rt(null), ia(null));
      if (Ct.current) {
        const i = rl_redo.current.pop();
        if (!i) {
          He(
            "Nada para refazer",
            "Cada pessoa só refaz as próprias ações nesta sala.",
          );
          return;
        }
        try {
          await Ct.current.stroke(i.frameId, i.layerId, [
            { ...i.element, createdAt: i.element.createdAt || Date.now() },
          ]);
        } catch (s) {
          (rl_redo.current.push(i),
            He("Não foi possível refazer", s && s.message ? s.message : ""));
        }
        return;
      }
      const i = Ht.current.pop();
      i && (fa.current.push(bt.current), _u(i));
    },
    ba = (i) => {
      ((Ml.current = i),
        !Xn.current &&
          ((Xn.current = !0),
          Ou("saving"),
          (async () => {
            try {
              for (; Ml.current; ) {
                const s = Ml.current;
                ((Ml.current = null),
                  await hm(s),
                  Mt &&
                    !Ct.current &&
                    (await gu(
                      `/api/projects/${encodeURIComponent(s.id)}`,
                      "PUT",
                      s,
                    )));
              }
              Ou("saved");
            } catch {
              (Ou("error"),
                He(
                  "Não foi possível sincronizar",
                  "Uma cópia local foi salva. Exporte o projeto para manter outra cópia.",
                ));
            } finally {
              ((Xn.current = !1), Ml.current && ba(Ml.current));
            }
          })()));
    },
    Qn = async () => {
      const i = await ym();
      if (!Mt) return i;
      try {
        const { projects: s } = await gu("/api/projects");
        return [...s, ...i.filter((h) => !s.some((y) => y.id === h.id))].sort(
          (h, y) => y.updatedAt - h.updatedAt,
        );
      } catch {
        return (
          He("Nuvem indisponível", "Projetos locais ainda estão disponíveis."),
          i
        );
      }
    };
  Y.useEffect(() => {
    (async () => {
      var i, s;
      try {
        let h = await ym();
        const y = localStorage.getItem(
          framiaScopedKey("framia-project"),
        );
        if (y) {
          const R = JSON.parse(y);
          (i = R == null ? void 0 : R.frames) != null &&
            i.length &&
            (s = R == null ? void 0 : R.layers) != null &&
            s.length &&
            ((R.id = R.id || bt.current.id),
            (R.frames = R.frames.map((U) => ({ ...U, duration: Jt(U) }))),
            h.some((U) => U.id === R.id) || (await hm(R)),
            localStorage.removeItem(framiaScopedKey("framia-project")),
            (h = await ym()));
        }
        Nl(h);
      } catch {
        He(
          "Biblioteca indisponível",
          "Verifique o armazenamento do navegador.",
        );
      }
    })();
  }, []);
  const wl = Y.useRef(!1),
    Da = Y.useRef(null);
  (Y.useEffect(() => {
    Di &&
      (Mt
        ? (Qn()
            .then(Nl)
            .catch(() => {}),
          gu("/api/brushes")
            .then(({ brushes: i }) => {
              qn((s) => {
                const h = new Set(i.map((R) => R.id)),
                  y = [...i, ...s.filter((R) => !h.has(R.id))];
                return (
                  y.length !== i.length &&
                    gu("/api/brushes", "PUT", y).catch(() =>
                      He("Pincéis locais não sincronizados"),
                    ),
                  (wl.current = !0),
                  y
                );
              });
            })
            .catch(() =>
              He(
                "Pincéis locais disponíveis",
                "Não foi possível ler os pincéis da conta.",
              ),
            ))
        : (wl.current = !1));
  }, [Mt, Di]),
    Y.useEffect(() => {
      if (!(!Mt || !wl.current))
        return (
          clearTimeout(Da.current),
          (Da.current = setTimeout(
            () =>
              gu("/api/brushes", "PUT", ll).catch(() =>
                He(
                  "Pincéis não sincronizados",
                  "A biblioteca permanece salva neste navegador.",
                ),
              ),
            500,
          )),
          () => clearTimeout(Da.current)
        );
    }, [ll, Mt]),
    Y.useEffect(() => {
      Oa === "editor" && ba(z);
    }, [z, Oa]),
    Y.useEffect(() => {
      (localStorage.setItem("framia-language", Me),
        (document.documentElement.lang = Me === "pt" ? "pt-BR" : Me));
    }, [Me]),
    Y.useEffect(() => {
      try {
        localStorage.setItem("framia-theme", JSON.stringify(ft));
      } catch {}
    }, [ft]),
    Y.useEffect(() => {
      try {
        localStorage.setItem(
          framiaScopedKey("framia-brushes"),
          JSON.stringify(ll),
        );
      } catch {}
    }, [ll]),
    Y.useEffect(() => {
      try {
        localStorage.setItem("framia-themes", JSON.stringify(Bi));
      } catch {}
    }, [Bi]),
    Y.useEffect(() => {
      const i = new BroadcastChannel("framia-local");
      return (
        (Il.current = i),
        (i.onmessage = (s) => {
          let h = s.data;
          h.sender !== Vn.current &&
            (h.type === "chat" &&
              (Mu((y) =>
                y.some((R) => R.id === h.payload.id) ? y : [...y, h.payload],
              ),
              He(h.payload.name, h.payload.text, () => Tu(!0))),
            h.type === "reaction" && Za((y) => [...y, h.payload]),
            h.type === "transform" && ne(h.sender, h.payload));
        }),
        () => i.close()
      );
    }, []));
  const Ol = (i) => {
    var s, h;
    ((s = Il.current) == null ||
      s.postMessage({ sender: Vn.current, type: "transform", payload: i }),
      (h = Ct.current) == null || h.broadcast("transform", i));
  };
  (Y.useEffect(() => {
    const i =
      pe === "transform" && Oa === "editor" && M && $e
        ? { ...M, projectId: z.id, transform: $e }
        : null;
    ((V.current = i),
      i
        ? oe.current ||
          (oe.current = setTimeout(() => {
            ((oe.current = null), Ol(V.current));
          }, 60))
        : (clearTimeout(oe.current), (oe.current = null), Ol(null)));
  }, [M, $e, pe, Oa, z.id]),
    Y.useEffect(() => {
      const i = () => Ol(null);
      return (
        window.addEventListener("pagehide", i),
        () => {
          (i(),
            clearTimeout(oe.current),
            window.removeEventListener("pagehide", i));
          for (const s of W.current.values()) clearTimeout(s);
        }
      );
    }, []),
    Y.useEffect(() => {
      (B(null), ia(null), rt(null), w(null), (Wt.current = null));
    }, [z.id, ze == null ? void 0 : ze.id]),
    Y.useEffect(() => {
      (pe !== "transform" ||
        Oa !== "editor" ||
        (M && (M.layerId !== ee || Ue.locked || !Ue.visible))) &&
        (B(null), ia(null), rt(null));
    }, [pe, Oa, ee, Ue.locked, Ue.visible]),
    Y.useEffect(() => {
      if (!$t) return;
      const i = performance.now(),
        s = K,
        h = Math.max(
          Hn(z.frames) / z.fps,
          ...z.clips.map((U) => U.start + U.duration),
          1 / z.fps,
        );
      let y;
      const R = (U) => {
        const X = s + (U - i) / 1e3;
        if (z.loop === !1 && X >= h) {
          (F(h), Aa(!1));
          return;
        }
        (F(z.loop === !1 ? Math.min(h, X) : X % h),
          (y = requestAnimationFrame(R)));
      };
      return ((y = requestAnimationFrame(R)), () => cancelAnimationFrame(y));
    }, [$t, z.frames, z.clips, z.fps, z.loop]),
    Y.useEffect(() => le(gm(z.frames, K, z.fps)), [K, z.fps, z.frames]),
    Y.useLayoutEffect(() => {
      const i = Cl.current;
      if (!i) return;
      let s = i.getContext("2d", { alpha: !1 });
      (i.width !== z.width && (i.width = z.width),
        i.height !== z.height && (i.height = z.height),
        (s.globalAlpha = 1),
        (s.globalCompositeOperation = "source-over"),
        s.clearRect(0, 0, i.width, i.height),
        (s.fillStyle = z.background || "#ffffff"),
        s.fillRect(0, 0, i.width, i.height));
      let h = z.clips.find(
          (X) => X.type === "video" && K >= X.start && K < X.start + X.duration,
        ),
        y = h && Ja.current.get(h.id);
      if (y && y.readyState >= 2) {
        let X = Math.min(i.width / y.videoWidth, i.height / y.videoHeight),
          $ = y.videoWidth * X,
          se = y.videoHeight * X;
        s.drawImage(y, (i.width - $) / 2, (i.height - se) / 2, $, se);
      }
      let R = () => {
        (Ea.current.clear(), o.current.clear(), te((X) => ({ ...X })));
      };
      const U = (X, $, se) => {
        var et, dt, nt, Be, ot, Ua, Xu;
        let be = z.frames[X];
        if (be)
          for (let aa of z.layers) {
            if (
              !aa.visible ||
              (se &&
                ((se === "#f36083" &&
                  ((et = aa.onion) == null ? void 0 : et.previous) === !1) ||
                  (se === "#54bfe9" &&
                    ((dt = aa.onion) == null ? void 0 : dt.next) === !1)))
            )
              continue;
            let ku =
                ((Be = (nt = z.content) == null ? void 0 : nt[be.id]) == null
                  ? void 0
                  : Be[aa.id]) || ig,
              Wi = ku,
              sl = Ea.current.get(Wi);
            if (!sl) {
              ((sl = document.createElement("canvas")),
                (sl.width = z.width),
                (sl.height = z.height));
              let St = sl.getContext("2d");
              for (let rn of ku) Eu(St, rn, R);
              (Ea.current.set(Wi, sl),
                Ea.current.size >
                  Math.max(
                    1,
                    Math.min(8, Math.floor(1e8 / (z.width * z.height * 4))),
                  ) && Ea.current.delete(Ea.current.keys().next().value));
            }
            (s.save(),
              (s.globalAlpha =
                $ *
                aa.opacity *
                (se
                  ? (((ot = aa.onion) == null ? void 0 : ot.opacity) ?? 1)
                  : 1)),
              (s.globalCompositeOperation = x1[aa.blend] || "source-over"));
            const In =
                M && $e && M.frameId === be.id && M.layerId === aa.id
                  ? { ...M, transform: $e }
                  : null,
              rr = Object.values(Z).filter(
                (St) =>
                  St.projectId === z.id &&
                  St.frameId === be.id &&
                  St.layerId === aa.id,
              );
            const liveDraft = [];
            if (jn && ze && be.id === ze.id && aa.id === ee)
              for (const X of O1(jn, z.width, z.height, we))
                liveDraft.push({ element: X, alpha: 1 });
            for (const X of Object.values(Au))
              X.element &&
                X.frameId === be.id &&
                X.layerId === aa.id &&
                liveDraft.push({ element: X.element, alpha: 0.6 });
            if (In || rr.length || liveDraft.length) {
              const St =
                d.current || (d.current = document.createElement("canvas"));
              (St.width !== z.width && (St.width = z.width),
                St.height !== z.height && (St.height = z.height));
              const rn = St.getContext("2d");
              if (In || rr.length) {
                rn.clearRect(0, 0, St.width, St.height);
                const on = be.id + ":" + aa.id;
                let sn = o.current.get(on);
                (sn ||
                  ((sn = Zp()),
                  o.current.set(on, sn),
                  o.current.size > 4 &&
                    o.current.delete(o.current.keys().next().value)),
                  sn.draw(
                    rn,
                    ku,
                    [...(In ? [In] : []), ...rr],
                    z.width,
                    z.height,
                    Eu,
                    R,
                  ));
              } else (rn.clearRect(0, 0, St.width, St.height), rn.drawImage(sl, 0, 0));
              for (const X of liveDraft)
                (rn.save(),
                  (rn.globalAlpha = X.alpha),
                  Eu(rn, X.element, R),
                  rn.restore());
              s.drawImage(St, 0, 0);
            } else s.drawImage(sl, 0, 0);
            (se &&
              ((s.globalCompositeOperation = "source-atop"),
              (s.fillStyle =
                se === "#f36083"
                  ? ((Ua = aa.onion) == null ? void 0 : Ua.previousColor) || se
                  : ((Xu = aa.onion) == null ? void 0 : Xu.nextColor) || se),
              (s.globalAlpha = $ * 0.18),
              s.fillRect(0, 0, i.width, i.height)),
              s.restore());
          }
      };
      if (Yt && !$t && P >= 0) {
        for (let X = xa; X >= 1; X--)
          U(P - X, (ce / 100) * (1 - (X - 1) / (xa + 1)), "#f36083");
        for (let X = Q; X >= 1; X--)
          U(P + X, (ce / 100) * (1 - (X - 1) / (Q + 1)), "#54bfe9");
      }
      U(P, 1, null);
    }, [
      z,
      P,
      z.clips.some((i) => i.type === "video") ? K : 0,
      Qc,
      jn,
      we,
      Yt,
      $t,
      xa,
      Q,
      ce,
      $e,
      Va,
      M,
      Z,
      Au,
    ]));
  const en = (i, s = !1) => {
      let h = Cl.current.getBoundingClientRect();
      const y = ((i.clientX - h.left) / h.width) * z.width,
        R = ((i.clientY - h.top) / h.height) * z.height;
      return {
        x: s ? y : Rt(y, 0, z.width),
        y: s ? R : Rt(R, 0, z.height),
        pressure: i.pressure || 0.5,
      };
    },
    tn = (i, s = ee) => {
      var U, X;
      const h =
          ((X =
            (U = z.content) == null
              ? void 0
              : U[ze == null ? void 0 : ze.id]) == null
            ? void 0
            : X[s]) || [],
        y = new Set(i),
        Pg = new Set(
          h.filter(($) => y.has($.id) && $.group).map(($) => $.group),
        ),
        Gi2 = [
          ...new Set([
            ...i,
            ...h
              .filter(($) => $.group && Pg.has($.group))
              .map(($) => $.id),
          ]),
        ],
        R = jc(h.filter(($) => Gi2.includes($.id)));
      return (
        Ee(s),
        ia(Gi2[0] || null),
        B(R ? { ids: Gi2, box: R, frameId: ze.id, layerId: s } : null),
        rt(R ? {} : null),
        R
      );
    },
    Zn = () => {
      !Ue.visible || Ue.locked || tn(mt.map((i) => i.id));
    },
    Hu = (i, s, h) => {
      if (!M || !$e || Ue.locked) return;
      (i.preventDefault(),
        i.stopPropagation(),
        i.currentTarget.setPointerCapture(i.pointerId));
      const y = en(i, !0);
      Wt.current = {
        type: s,
        start: y,
        base: $e,
        box: M.box,
        handle: h,
        center: {
          x: M.box.x + M.box.w / 2 + ($e.x || 0),
          y: M.box.y + M.box.h / 2 + ($e.y || 0),
        },
      };
    },
    Bu = () => {
      (he("transform"),
        ve("properties"),
        wu(!0),
        !M &&
          mt.length &&
          !Ue.locked &&
          Ue.visible &&
          tn(p === "layer" ? mt.map((i) => i.id) : [mt.at(-1).id]));
    },
    Gt = (i) => {
      if (i.button !== 0 && i.button !== 1) return;
      let s = en(i, pe === "transform" || pe === "select");
      Ct.current &&
        (cursorAt.current = Date.now()) &&
        Ct.current.broadcast("cursor", {
          x: s.x,
          y: s.y,
          name: (Mt == null ? void 0 : Mt.name) || "",
        });
      if (
        (i.currentTarget.setPointerCapture(i.pointerId),
        pe === "pan" || i.button === 1 || i.altKey)
      ) {
        Wt.current = {
          type: "pan",
          start: { x: i.clientX, y: i.clientY },
          base: b,
        };
        return;
      }
      if (!ze) return;
      if (pe === "transform" || pe === "select") {
        if (Ue.locked || !Ue.visible) return;
        const tol = (() => {
          const c = i.currentTarget,
            r = c && c.getBoundingClientRect();
          return r && r.width
            ? Math.max(4, (8 * (c.width || r.width)) / r.width)
            : 8;
        })();
        if (M && $e) {
          const R = G1(xi(M.box, $e)),
            U = R && Cm(R, s),
            X = M.box;
          const selHit =
            !i.shiftKey &&
            mt.some((R2) => M.ids.includes(R2.id) && Vp(R2, s, tol));
          if (
            (U &&
              U.x >= X.x &&
              U.x <= X.x + X.w &&
              U.y >= X.y &&
              U.y <= X.y + X.h) ||
            selHit
          ) {
            if (!i.shiftKey) {
              Wt.current = { type: "move", start: s, base: $e };
              return;
            }
          } else Gi();
        }
        const y = [...mt].reverse().find((R) => Vp(R, s, tol));
        if (p === "layer" && mt.length)
          tn(mt.map((U) => U.id)) &&
            (Wt.current = { type: "move", start: s, base: {} });
        else if (y) {
          const cur = (M && M.ids) || [],
            R = i.shiftKey
              ? cur.includes(y.id)
                ? cur.filter((U) => {
                    const X = mt.find(($) => $.id === U);
                    return y.group ? !X || X.group !== y.group : U !== y.id;
                  })
                : [...new Set([...cur, y.id])]
              : [y.id];
          (tn(R),
            R.length
              ? (Wt.current = { type: "move", start: s, base: {} })
              : (Wt.current = null));
        } else
          ((Wt.current = {
            type: "marquee",
            start: s,
            base: i.shiftKey ? ((M && M.ids) || []) : [],
          }),
            i.shiftKey || (B(null), ia(null), rt(null)),
            w({ x: s.x, y: s.y, w: 0, h: 0 }));
        return;
      }
      if (Ue.locked || !Ue.visible) return;
      if (pe === "pipette") {
        let y = Cl.current
          .getContext("2d")
          .getImageData(
            Math.min(z.width - 1, Math.round(s.x)),
            Math.min(z.height - 1, Math.round(s.y)),
            1,
            1,
          ).data;
        (Fe(
          "#" +
            Array.from(y.slice(0, 3))
              .map((R) => R.toString(16).padStart(2, "0"))
              .join(""),
        ),
          he("brush"));
        return;
      }
      if (pe === "smudge") {
        const y = document.createElement("canvas"),
          R = document.createElement("canvas"),
          U = document.createElement("canvas");
        ((y.width = R.width = z.width),
          (y.height = R.height = z.height),
          (U.width = U.height = Math.max(2, Math.ceil(Ae))));
        const X = y.getContext("2d");
        for (const $ of mt) Eu(X, $);
        Wt.current = {
          type: "smudge",
          work: y,
          overlay: R,
          scratch: U,
          last: s,
          changed: !1,
        };
        return;
      }
      if (pe === "fill") {
        const y = Wp(Cl.current, mt, Eu, s.x, s.y, ct, re / 100);
        y &&
          rl(ze.id, ee, [
            {
              id: Ke(),
              type: "image",
              src: y,
              x: 0,
              y: 0,
              w: z.width,
              h: z.height,
              opacity: 1,
            },
          ]);
        return;
      }
      let h = {
        id: Ke(),
        type: ["rect", "ellipse", "line"].includes(pe) ? "shape" : "stroke",
        shape: pe,
        color: ct,
        size: Ae,
        opacity: re / 100,
        points: [s],
        x: s.x,
        y: s.y,
        w: 0,
        h: 0,
        erase: pe === "eraser",
        brushPreset:
          (pe === "brush" || pe === "eraser") && lt != null && lt.preset
            ? lt.id
            : null,
        brushData:
          (pe === "brush" || pe === "eraser") && lt && !lt.preset && !lt.src
            ? { ...lt }
            : null,
        brushImage: pe === "brush" ? (lt == null ? void 0 : lt.src) : null,
        spacing: Yn / 100,
        brushRotation: wi,
      };
      ((Wt.current = { type: "draw", el: h, start: s }), Vl(h));
    },
    $a = (i) => {
      var y;
      if (!Wt.current) return;
      let s = en(
          i,
          ["move", "resize", "rotate", "marquee"].includes(Wt.current.type),
        ),
        h = Wt.current;
      Ct.current &&
        Date.now() - cursorAt.current > 60 &&
        ((cursorAt.current = Date.now()),
        Ct.current.broadcast("cursor", {
          x: s.x,
          y: s.y,
          name: (Mt == null ? void 0 : Mt.name) || "",
        }));
      if (h.type === "marquee") {
        w({
          x: Math.min(h.start.x, s.x),
          y: Math.min(h.start.y, s.y),
          w: Math.abs(s.x - h.start.x),
          h: Math.abs(s.y - h.start.y),
        });
        return;
      }
      if (h.type === "pan") {
        N({
          x: h.base.x + i.clientX - h.start.x,
          y: h.base.y + i.clientY - h.start.y,
        });
        return;
      }
      if (h.type === "smudge") {
        const R = Math.hypot(s.x - h.last.x, s.y - h.last.y),
          U = h.scratch.width / 2;
        if (R < U / 4) return;
        const X = h.work.getContext("2d"),
          $ = h.overlay.getContext("2d"),
          se = h.scratch.getContext("2d"),
          be = Cl.current.getContext("2d"),
          et = Math.max(1, Math.ceil(R / Math.max(2, U / 2)));
        be.save();
        for (let dt = 1; dt <= et; dt++) {
          const nt = {
              x: h.last.x + ((s.x - h.last.x) * dt) / et,
              y: h.last.y + ((s.y - h.last.y) * dt) / et,
            },
            Be = {
              x: h.last.x + ((s.x - h.last.x) * (dt - 1)) / et,
              y: h.last.y + ((s.y - h.last.y) * (dt - 1)) / et,
            };
          (se.clearRect(0, 0, h.scratch.width, h.scratch.height),
            (se.globalCompositeOperation = "source-over"),
            se.drawImage(
              h.work,
              Be.x - U,
              Be.y - U,
              U * 2,
              U * 2,
              0,
              0,
              U * 2,
              U * 2,
            ),
            (se.globalCompositeOperation = "destination-in"),
            se.beginPath(),
            se.arc(U, U, U, 0, Math.PI * 2),
            se.fill(),
            (se.globalCompositeOperation = "source-over"),
            ($.globalAlpha = 0.7),
            (X.globalAlpha = 0.7),
            (be.globalAlpha = 0.7),
            $.drawImage(h.scratch, nt.x - U, nt.y - U),
            X.drawImage(h.scratch, nt.x - U, nt.y - U),
            be.drawImage(h.scratch, nt.x - U, nt.y - U));
        }
        (be.restore(), (h.last = s), (h.changed = !0));
        return;
      }
      if (h.type === "move") {
        rt({
          ...h.base,
          x: (h.base.x || 0) + s.x - h.start.x,
          y: (h.base.y || 0) + s.y - h.start.y,
        });
        return;
      }
      if (h.type === "resize") {
        rt(Qp(h.base, h.box, h.handle, h.start, s));
        return;
      }
      if (h.type === "rotate") {
        let R = Math.atan2(h.start.y - h.center.y, h.start.x - h.center.x),
          U = Math.atan2(s.y - h.center.y, s.x - h.center.x);
        rt({
          ...h.base,
          rotation: (h.base.rotation || 0) + ((U - R) * 180) / Math.PI,
        });
        return;
      }
      if (h.el.type === "shape")
        h.el = {
          ...h.el,
          x: Math.min(h.start.x, s.x),
          y: Math.min(h.start.y, s.y),
          w: Math.abs(s.x - h.start.x),
          h: Math.abs(s.y - h.start.y),
          ...(h.el.shape === "line"
            ? { points: [h.start, { x: s.x, y: s.y }] }
            : {}),
        };
      else {
        let R = h.el.points.at(-1);
        if (Math.hypot(s.x - R.x, s.y - R.y) < 1.4) return;
        h.el = { ...h.el, points: [...h.el.points, s] };
      }
      (Vl(h.el),
        Date.now() - cl.current > 65 &&
          ((cl.current = Date.now()),
          (y = Ct.current) == null ||
            y.broadcast("stroke-preview", {
              frameId: ze.id,
              layerId: ee,
              element: h.el,
            })));
    },
    an = () => {
      let i = Wt.current;
      if (i) {
        if (((Wt.current = null), i.type === "marquee")) {
          if (q) {
            const picked = new Set(i.base || []),
              cut = [],
              pieces = [];
            for (const h of mt) {
              if (!Lg4(h, q)) continue;
              const poly =
                h.type === "stroke" && (h.points || []).length
                  ? framiaQuad(h, q)
                  : null;
              if (!poly) {
                picked.add(h.id);
                continue;
              }
              const parts = framiaSplitStroke(h.points, poly);
              if (!parts.inside.length || !parts.outside.length) {
                picked.add(h.id);
                continue;
              }
              cut.push({
                id: h.id,
                outside: parts.outside.map((pts) => framiaPiece(h, Ke(), pts)),
              });
              parts.inside.forEach((pts) => {
                const frag = framiaPiece(h, Ke(), pts);
                (pieces.push(frag), picked.add(frag.id));
              });
            }
            if (cut.length) {
              De((draft) => {
                const frame =
                    draft.content[ze.id] || (draft.content[ze.id] = {}),
                  list = frame[ee] || [],
                  removed = new Map(cut.map((c) => [c.id, c.outside]));
                const next = [];
                for (const el of list) {
                  const rest = removed.get(el.id);
                  if (!rest) {
                    next.push(el);
                    continue;
                  }
                  rest.forEach((p) => next.push(p));
                }
                pieces.forEach((p) => next.push(p));
                frame[ee] = next;
              });
              const groups = new Set(
                mt.filter((el) => picked.has(el.id) && el.group).map((el) => el.group),
              );
              mt.forEach((el) => {
                el.group && groups.has(el.group) && picked.add(el.id);
              });
              const ids = [...picked],
                box = jc([...mt.filter((el) => picked.has(el.id)), ...pieces]);
              (Ee(ee),
                ia(ids[0] || null),
                B(box ? { ids, box, frameId: ze.id, layerId: ee } : null),
                rt(box ? {} : null));
            } else tn([...picked]);
          }
          w(null);
          return;
        }
        if (i.type === "smudge" && i.changed) {
          rl(ze.id, ee, [
            {
              id: Ke(),
              type: "image",
              src: i.overlay.toDataURL("image/png"),
              x: 0,
              y: 0,
              w: z.width,
              h: z.height,
              opacity: 1,
            },
          ]);
          return;
        }
        if (i.type === "draw") {
          let s = i.el,
            h = O1(s, z.width, z.height, we).map((y, R) =>
              R ? { ...y, id: Ke() } : y,
            );
          (rl(ze.id, ee, h), Vl(null));
        }
      }
    },
    Ra = () => {
      ((V.current = null),
        clearTimeout(oe.current),
        (oe.current = null),
        B(null),
        ia(null),
        rt(null),
        w(null),
        Ol(null));
    },
    Gi = () => {
      if (!M || !$e || Ue.locked) return;
      const i = M,
        s = $e;
      (De((h) => {
        var U, X;
        const y = h.layers.find(($) => $.id === i.layerId);
        if (!y || y.locked) return;
        const R =
          (X = (U = h.content) == null ? void 0 : U[i.frameId]) == null
            ? void 0
            : X[i.layerId];
        R &&
          (h.content[i.frameId][i.layerId] = R.map(($) =>
            i.ids.includes($.id) ? wo($, i.box, s) : $,
          ));
      }),
        Ra());
    },
    removeSelection = () => {
      if (Tt) {
        (De((i) => (i.clips = i.clips.filter((s) => s.id !== Tt))), ta(null));
        return !0;
      }
      const i = M && M.ids.length ? M.ids : Va ? [Va] : [];
      if (!i.length || !ze || Ue.locked) return !1;
      return (
        De((s) => {
          const h = s.content[ze.id] && s.content[ze.id][ee];
          h && (s.content[ze.id][ee] = h.filter((y) => !i.includes(y.id)));
        }),
        Ra(),
        !0
      );
    },
    duplicateSelection = () => {
      const i = M && M.ids.length ? M.ids : Va ? [Va] : [],
        s = mt.filter((h) => i.includes(h.id));
      if (!s.length || !ze || Ue.locked) return !1;
      const gmap = new Map(),
        h = s.map((y) => {
          const R = { ...wo(y, jc(s), { x: 28, y: 28 }), id: Ke() };
          return (
            y.group &&
              (gmap.has(y.group) || gmap.set(y.group, Ke()),
              (R.group = gmap.get(y.group))),
            R
          );
        });
      return (
        De((y) => {
          var R;
          ((R = y.content[ze.id])[ee] ?? (R[ee] = []),
            y.content[ze.id][ee].push(...h));
        }),
        he("transform"),
        ia(h[0].id),
        !0
      );
    },
    groupSelection = () => {
      const i = M && M.ids.length ? M.ids : Va ? [Va] : [];
      if (i.length < 2 || !ze || Ue.locked)
        return (
          He(
            Me === "en" ? "Select more elements" : "Selecione mais traços",
            Me === "en"
              ? "Grouping needs at least two selected elements."
              : "Para agrupar, selecione pelo menos dois elementos.",
          ),
          !1
        );
      const s = Ke();
      return (
        De((h) => {
          const y = h.content?.[ze.id]?.[ee];
          y &&
            (h.content[ze.id][ee] = y.map((R) =>
              i.includes(R.id) ? { ...R, group: s } : R,
            ));
        }),
        He(
          Me === "en" ? "Group created" : "Grupo criado",
          Me === "en"
            ? "The selected elements now move together."
            : "Os elementos selecionados agora se movem juntos.",
        ),
        !0
      );
    },
    ungroupSelection = () => {
      const i = M && M.ids.length ? M.ids : Va ? [Va] : [];
      if (!i.length || !ze || Ue.locked) return !1;
      return (
        De((h) => {
          const y = h.content?.[ze.id]?.[ee];
          y &&
            (h.content[ze.id][ee] = y.map((R) => {
              if (!R.group || !i.includes(R.id)) return R;
              const { group: U, ...X } = R;
              return X;
            }));
        }),
        !0
      );
    },
    restoreToolSettings = (i) => {
      if (i !== "brush" && i !== "eraser") return;
      const s = framiaToolSettings()[i];
      (J(s.size),
        ye(s.opacity),
        zu(s.spacing),
        Ro(s.rotation),
        Sl([...Zo, ...ll].find((h) => h.id === s.presetId) || null));
    },
    loadFriendsNow = async () => {
      try {
        setFriends(await bu("/api/friends", "GET"));
      } catch {}
    },
    openMyProfile = async () => {
      (setAccountMenu(!1), Ve("profile"), setProfilePeek(null));
      try {
        const i = await bu("/api/profile", "GET");
        (setProfile(i.profile), setProfileDraft(i.profile));
        await loadFriendsNow();
      } catch (i) {
        He("Não foi possível carregar o perfil", i.message);
      }
    },
    openProfile = async (i) => {
      if (!i) return;
      try {
        const s = await bu(`/api/profiles/${encodeURIComponent(i)}`, "GET");
        (setProfilePeek(s), setProfileDraft(null), setFriendResults([]), Ve("profile"));
      } catch (s) {
        He("Perfil indisponível", s.message);
      }
    },
    checkUsername = (i) => {
      (clearTimeout(window.__framiaUserTimer),
        setUsernameStatus(
          !i
            ? ""
            : profile && profile.username === i
              ? "current"
              : i.length < 3
                ? "short"
                : "checking",
        ));
      if (!i || i.length < 3 || (profile && profile.username === i)) return;
      window.__framiaUserTimer = setTimeout(async () => {
        try {
          const s = await bu(
            `/api/profile/username?u=${encodeURIComponent(i)}`,
            "GET",
          );
          setUsernameStatus(s.available ? "ok" : "taken");
        } catch {
          setUsernameStatus("");
        }
      }, 380);
    },
    saveProfile = async () => {
      if (!profileDraft) return;
      if (usernameStatus === "taken") {
        He("Esse @ já está em uso");
        return;
      }
      try {
        const i = await bu("/api/profile", "PUT", {
          username: profileDraft.username || "",
          displayName: profileDraft.displayName || "",
          bio: profileDraft.bio || "",
          avatar: profileDraft.avatar || "",
          banner: profileDraft.banner || "",
          bannerImage: profileDraft.bannerImage || "",
        });
        (setProfile(i.profile), setProfileDraft(i.profile), He("Perfil salvo"));
      } catch (i) {
        He("Não foi possível salvar o perfil", i.message);
      }
    },
    pickProfileImage = (i, s, h) => {
      const y = i.target.files && i.target.files[0];
      if (!y) return;
      const R = new FileReader();
      ((R.onload = () => {
        const U = new Image();
        ((U.onload = () => {
          const X = Math.min(1, h / Math.max(U.width, U.height)),
            $ = document.createElement("canvas");
          (($.width = Math.max(1, Math.round(U.width * X))),
            ($.height = Math.max(1, Math.round(U.height * X))));
          const se = $.getContext("2d");
          (se.drawImage(U, 0, 0, $.width, $.height),
            setProfileDraft((be) => ({
              ...be,
              [s]: $.toDataURL("image/jpeg", s === "avatar" ? 0.86 : 0.82),
            })));
        }),
          (U.src = R.result));
      }),
        R.readAsDataURL(y));
    },
    searchPeople = async () => {
      const i = friendQuery.trim().toLowerCase();
      if (i.length < 2) return;
      try {
        const s = await bu(
          `/api/users/search?q=${encodeURIComponent(i)}`,
          "GET",
        );
        setFriendResults(s.people || []);
      } catch (s) {
        He("Busca indisponível", s.message);
      }
    },
    addFriend = async (i) => {
      if (!i) return;
      try {
        const s = await bu("/api/friends/request", "POST", { username: i });
        (He(s.state === "friend" ? "Agora vocês são amigos" : "Pedido enviado"),
          setFriendResults((h) =>
            h.map((y) => (y.username === i ? { ...y, friend: s.state } : y)),
          ),
          await loadFriendsNow());
      } catch (s) {
        He("Não foi possível enviar o pedido", s.message);
      }
    },
    respondFriend = async (i, s) => {
      try {
        (await bu("/api/friends/respond", "POST", { id: i, accept: !!s }),
          await loadFriendsNow(),
          setProfilePeek(null));
      } catch (h) {
        He("Não foi possível responder", h.message);
      }
    },
    profileCard = (i, s) =>
      i
        ? r.createElement(
            "div",
            {
              className: `profile-card${s ? " large" : ""}`,
              style: i.bannerImage
                ? {
                    backgroundImage: `url(${i.bannerImage})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : { background: i.banner || "#9585ed" },
            },
            r.createElement(
              "div",
              { className: "profile-card-inner" },
              i.avatar
                ? r.createElement("img", {
                    className: "profile-avatar",
                    src: i.avatar,
                    alt: "",
                  })
                : r.createElement(
                    "span",
                    { className: "profile-avatar initials" },
                    ((i.displayName || i.username || "F").trim()[0] || "F").toUpperCase(),
                  ),
              r.createElement("b", null, i.displayName || i.username || "Framia"),
              i.username
                ? r.createElement("small", null, `@${i.username}`)
                : null,
              i.bio ? r.createElement("p", null, i.bio) : null,
            ),
          )
        : null,
    profileModalBody =
      r.createElement(
                    "div",
                    { className: "modal-body profile-body" },
                    profilePeek
                      ? r.createElement(
                          r.Fragment,
                          null,
                          profileCard(profilePeek.profile, !0),
                          r.createElement(
                            "div",
                            { className: "profile-actions" },
                            profilePeek.friend && profilePeek.friend.state === "friend"
                              ? r.createElement(
                                  "span",
                                  { className: "profile-badge" },
                                  "Amigos",
                                )
                              : profilePeek.friend &&
                                  profilePeek.friend.state === "outgoing"
                                ? r.createElement(
                                    "span",
                                    { className: "profile-badge" },
                                    "Pedido enviado",
                                  )
                                : profilePeek.friend &&
                                    profilePeek.friend.state === "incoming"
                                  ? r.createElement(
                                      "button",
                                      {
                                        type: "button",
                                        className: "primary-button",
                                        onClick: () =>
                                          respondFriend(profilePeek.friend.id, !0),
                                      },
                                      "Aceitar pedido de amizade",
                                    )
                                  : r.createElement(
                                      "button",
                                      {
                                        type: "button",
                                        className: "primary-button",
                                        disabled: !profilePeek.profile.username,
                                        onClick: () =>
                                          addFriend(profilePeek.profile.username),
                                      },
                                      profilePeek.profile.username
                                        ? "Adicionar amigo"
                                        : "Esta pessoa ainda não escolheu um @",
                                    ),
                          ),
                        )
                      : profileDraft
                        ? r.createElement(
                            r.Fragment,
                            null,
                            profileCard(
                              {
                                ...profileDraft,
                                username:
                                  profile && profile.username
                                    ? profile.username
                                    : "",
                              },
                              !0,
                            ),
                            r.createElement(
                              "label",
                              { className: "profile-field" },
                              "Nome de usuário (único)",
                              r.createElement("input", {
                                value: profileDraft.username || "",
                                placeholder: "seu_nome",
                                maxLength: 20,
                                disabled: !!(profile && profile.username),
                                title:
                                  profile && profile.username
                                    ? "O nome de usuário é único e não pode ser alterado."
                                    : "Escolha com cuidado: não poderá ser alterado depois.",
                                onChange: (i) => {
                                  const s = i.target.value
                                    .toLowerCase()
                                    .replace(/[^a-z0-9_]/g, "");
                                  (setProfileDraft((h) => ({
                                    ...h,
                                    username: s,
                                  })),
                                    checkUsername(s));
                                },
                              }),
                              r.createElement(
                                "small",
                                {
                                  className: `profile-hint ${usernameStatus}`,
                                },
                                usernameStatus === "short"
                                  ? "Mínimo de 3 caracteres."
                                  : usernameStatus === "checking"
                                    ? "Verificando..."
                                    : usernameStatus === "ok"
                                      ? "Disponível."
                                      : usernameStatus === "taken"
                                        ? "Já está em uso, escolha outro."
                                        : profile && profile.username
                                          ? "Seu @ é único e não pode ser alterado."
                                          : "Só letras minúsculas, números e _. Escolha com cuidado: não poderá alterar depois.",
                              ),
                            ),
                            r.createElement(
                              "label",
                              { className: "profile-field" },
                              "Nome de exibição",
                              r.createElement("input", {
                                value: profileDraft.displayName || "",
                                maxLength: 40,
                                onChange: (i) =>
                                  setProfileDraft((s) => ({
                                    ...s,
                                    displayName: i.target.value,
                                  })),
                              }),
                            ),
                            r.createElement(
                              "label",
                              { className: "profile-field" },
                              "Bio",
                              r.createElement("textarea", {
                                value: profileDraft.bio || "",
                                maxLength: 280,
                                rows: 3,
                                onChange: (i) =>
                                  setProfileDraft((s) => ({
                                    ...s,
                                    bio: i.target.value,
                                  })),
                              }),
                            ),
                            r.createElement(
                              "div",
                              { className: "profile-banners" },
                              [
                                "linear-gradient(135deg,#9585ed,#54bfe9)",
                                "linear-gradient(135deg,#f36083,#ffb86b)",
                                "linear-gradient(135deg,#54bfe9,#3ddc97)",
                                "linear-gradient(135deg,#2b2f45,#9585ed)",
                                "linear-gradient(135deg,#ffb86b,#f36083)",
                                "linear-gradient(135deg,#1b1d27,#3ddc97)",
                              ].map((i) =>
                                r.createElement("button", {
                                  key: i,
                                  type: "button",
                                  className:
                                    profileDraft.banner === i
                                      ? "profile-swatch selected"
                                      : "profile-swatch",
                                  style: { background: i },
                                  "aria-label": "Cor do banner",
                                  onClick: () =>
                                    setProfileDraft((s) => ({
                                      ...s,
                                      banner: i,
                                      bannerImage: "",
                                    })),
                                }),
                              ),
                              r.createElement("input", {
                                type: "color",
                                className: "profile-color",
                                value: /^#[0-9a-f]{6}$/i.test(
                                  profileDraft.banner || "",
                                )
                                  ? profileDraft.banner
                                  : "#9585ed",
                                onChange: (i) =>
                                  setProfileDraft((s) => ({
                                    ...s,
                                    banner: i.target.value,
                                    bannerImage: "",
                                  })),
                              }),
                              r.createElement(
                                "label",
                                { className: "profile-upload" },
                                "Banner (imagem/GIF)",
                                r.createElement("input", {
                                  type: "file",
                                  accept: "image/*",
                                  onChange: (i) =>
                                    pickProfileImage(i, "bannerImage", 1200),
                                }),
                              ),
                              r.createElement(
                                "label",
                                { className: "profile-upload" },
                                "Avatar",
                                r.createElement("input", {
                                  type: "file",
                                  accept: "image/*",
                                  onChange: (i) =>
                                    pickProfileImage(i, "avatar", 256),
                                }),
                              ),
                              profileDraft.bannerImage &&
                                r.createElement(
                                  "button",
                                  {
                                    type: "button",
                                    className: "ghost-button",
                                    onClick: () =>
                                      setProfileDraft((s) => ({
                                        ...s,
                                        bannerImage: "",
                                      })),
                                  },
                                  "Remover imagem",
                                ),
                            ),
                            r.createElement(
                              "button",
                              {
                                type: "button",
                                className: "primary-button",
                                onClick: () => saveProfile(),
                              },
                              "Salvar perfil",
                            ),
                            r.createElement(
                              "section",
                              { className: "friends-section" },
                              r.createElement("h3", null, "Amigos"),
                              r.createElement(
                                "div",
                                { className: "friend-search" },
                                r.createElement("input", {
                                  value: friendQuery,
                                  placeholder: "@nome de usuário",
                                  maxLength: 20,
                                  onChange: (i) =>
                                    setFriendQuery(
                                      i.target.value.toLowerCase(),
                                    ),
                                  onKeyDown: (i) =>
                                    i.key === "Enter" && searchPeople(),
                                }),
                                r.createElement(
                                  "button",
                                  {
                                    type: "button",
                                    className: "ghost-button",
                                    onClick: () => searchPeople(),
                                  },
                                  "Buscar",
                                ),
                              ),
                              friendResults.length > 0 &&
                                r.createElement(
                                  "div",
                                  { className: "friend-list" },
                                  friendResults.map((i) =>
                                    r.createElement(
                                      "div",
                                      { className: "friend-row", key: i.id },
                                      i.avatar
                                        ? r.createElement("img", {
                                            className: "friend-avatar",
                                            src: i.avatar,
                                            alt: "",
                                          })
                                        : r.createElement(
                                            "span",
                                            { className: "friend-avatar" },
                                            (i.displayName ||
                                              i.username ||
                                              "F")[0].toUpperCase(),
                                          ),
                                      r.createElement(
                                        "div",
                                        { className: "friend-text" },
                                        r.createElement(
                                          "b",
                                          null,
                                          i.displayName || i.username,
                                        ),
                                        r.createElement(
                                          "small",
                                          null,
                                          `@${i.username}`,
                                        ),
                                      ),
                                      r.createElement(
                                        "button",
                                        {
                                          type: "button",
                                          className: "ghost-button",
                                          onClick: () => addFriend(i.username),
                                        },
                                        i.friend === "friend"
                                          ? "Amigos"
                                          : i.friend === "outgoing"
                                            ? "Pendente"
                                            : "Adicionar",
                                      ),
                                    ),
                                  ),
                                ),
                              friends.incoming.length > 0 &&
                                r.createElement(
                                  "div",
                                  { className: "friend-list" },
                                  r.createElement(
                                    "small",
                                    { className: "friend-caption" },
                                    "Pedidos recebidos",
                                  ),
                                  friends.incoming.map((i) =>
                                    r.createElement(
                                      "div",
                                      {
                                        className: "friend-row",
                                        key: i.requestId,
                                      },
                                      r.createElement(
                                        "div",
                                        { className: "friend-text" },
                                        r.createElement(
                                          "b",
                                          null,
                                          i.profile.displayName ||
                                            i.profile.username,
                                        ),
                                        r.createElement(
                                          "small",
                                          null,
                                          `@${i.profile.username}`,
                                        ),
                                      ),
                                      r.createElement(
                                        "button",
                                        {
                                          type: "button",
                                          className: "ghost-button",
                                          onClick: () =>
                                            respondFriend(i.requestId, !0),
                                        },
                                        "Aceitar",
                                      ),
                                      r.createElement(
                                        "button",
                                        {
                                          type: "button",
                                          className: "ghost-button",
                                          onClick: () =>
                                            respondFriend(i.requestId, !1),
                                        },
                                        "Recusar",
                                      ),
                                    ),
                                  ),
                                ),
                              friends.friend.length > 0 &&
                                r.createElement(
                                  "div",
                                  { className: "friend-list" },
                                  r.createElement(
                                    "small",
                                    { className: "friend-caption" },
                                    "Seus amigos",
                                  ),
                                  friends.friend.map((i) =>
                                    r.createElement(
                                      "div",
                                      {
                                        className: "friend-row",
                                        key: i.requestId,
                                      },
                                      r.createElement(
                                        "div",
                                        { className: "friend-text" },
                                        r.createElement(
                                          "b",
                                          null,
                                          i.profile.displayName ||
                                            i.profile.username,
                                        ),
                                        r.createElement(
                                          "small",
                                          null,
                                          `@${i.profile.username}`,
                                        ),
                                      ),
                                      r.createElement(
                                        "button",
                                        {
                                          type: "button",
                                          className: "ghost-button",
                                          onClick: () =>
                                            openProfile(i.profile.id),
                                        },
                                        "Perfil",
                                      ),
                                    ),
                                  ),
                                ),
                            ),
                          )
                        : r.createElement(
                            "div",
                            { className: "modal-note" },
                            "Carregando perfil...",
                          ),
                  ),
    addGuide = (i) => {
      De((s) => {
        (s.guides || (s.guides = [])).push({
          id: Ke(),
          axis: i,
          pos: 0.5,
          from: 0,
          to: 1,
        });
      });
    },
    addGuideShape = (i) => {
      De((s) => {
        (s.guides || (s.guides = [])).push({
          id: Ke(),
          kind: i,
          x: 0.2,
          y: 0.2,
          w: i === "circle" ? (0.5 * s.height) / s.width : 0.6,
          h: 0.5,
        });
      });
    },
    moveGuideShape = (i, s) => {
      (i.stopPropagation(), i.preventDefault());
      const h = (
          i.currentTarget.closest(".guide-layer") || i.currentTarget
        ).getBoundingClientRect(),
        y = i.currentTarget,
        R = Math.max(0, Math.min(1, s.w ?? 0.5)),
        U = Math.max(0, Math.min(1, s.h ?? 0.5));
      let X = Number.isFinite(s.x) ? s.x : 0.2,
        $ = Number.isFinite(s.y) ? s.y : 0.2;
      const se = (g) => {
          ((X = Math.max(0, Math.min(1 - R, (g.clientX - h.left) / h.width - R / 2))),
            ($ = Math.max(0, Math.min(1 - U, (g.clientY - h.top) / h.height - U / 2))),
            (y.style.left = `${X * 100}%`),
            (y.style.top = `${$ * 100}%`));
        },
        be = () => {
          (window.removeEventListener("pointermove", se),
            window.removeEventListener("pointerup", be),
            window.removeEventListener("pointercancel", be),
            De((g) => {
              const b = (g.guides || []).find((N) => N.id === s.id);
              b && ((b.x = X), (b.y = $));
            }));
        };
      (window.addEventListener("pointermove", se),
        window.addEventListener("pointerup", be),
        window.addEventListener("pointercancel", be));
    },
    resizeGuideShape = (i, s) => {
      (i.stopPropagation(), i.preventDefault());
      const h = (
          i.currentTarget.closest(".guide-layer") || i.currentTarget
        ).getBoundingClientRect(),
        y = i.currentTarget.closest(".guide-shape"),
        R0 = Number.isFinite(s.x) ? s.x : 0.2,
        U0 = Number.isFinite(s.y) ? s.y : 0.2;
      let R = Number.isFinite(s.w) ? s.w : 0.5,
        U = Number.isFinite(s.h) ? s.h : 0.5;
      const X = (g) => {
          ((R = Math.max(0.05, Math.min(1 - R0, (g.clientX - h.left) / h.width - R0))),
            (U = Math.max(0.05, Math.min(1 - U0, (g.clientY - h.top) / h.height - U0))));
          s.kind === "circle" &&
            ((U = Math.max(0.05, Math.min(1 - U0, (R * z.width) / z.height))),
            (R = Math.max(0.05, Math.min(1 - R0, (U * z.height) / z.width))));
          y &&
            ((y.style.width = `${R * 100}%`),
            (y.style.height = `${U * 100}%`));
        },
        $ = () => {
          (window.removeEventListener("pointermove", X),
            window.removeEventListener("pointerup", $),
            window.removeEventListener("pointercancel", $),
            De((g) => {
              const b = (g.guides || []).find((N) => N.id === s.id);
              b && ((b.w = R), (b.h = U));
            }));
        };
      (window.addEventListener("pointermove", X),
        window.addEventListener("pointerup", $),
        window.addEventListener("pointercancel", $));
    },
    moveGuide = (i, s) => {
      (i.stopPropagation(), i.preventDefault());
      const h = (i.currentTarget.closest(".guide-layer") || i.currentTarget)
          .getBoundingClientRect(),
        y = i.currentTarget,
        R = (g) =>
          s.axis === "x"
            ? (g.clientX - h.left) / h.width
            : (g.clientY - h.top) / h.height;
      let p = Number.isFinite(s.pos) ? s.pos : 0.5;
      const U = (g) => {
          p = Math.max(0, Math.min(1, R(g)));
          y.style[s.axis === "x" ? "left" : "top"] = `${p * 100}%`;
        },
        X = () => {
          (window.removeEventListener("pointermove", U),
            window.removeEventListener("pointerup", X),
            window.removeEventListener("pointercancel", X),
            De((b) => {
              const N = (b.guides || []).find((M) => M.id === s.id);
              N && (N.pos = p);
            }));
        };
      (window.addEventListener("pointermove", U),
        window.addEventListener("pointerup", X),
        window.addEventListener("pointercancel", X));
    },
    resizeGuide = (i, s, h) => {
      (i.stopPropagation(), i.preventDefault());
      const y = i.currentTarget.closest(".guide-line"),
        R = (y && y.parentElement ? y.parentElement : y).getBoundingClientRect(),
        U = (g) =>
          s.axis === "x"
            ? (g.clientY - R.top) / R.height
            : (g.clientX - R.left) / R.width;
      let X = Number.isFinite(s.from) ? s.from : 0,
        $ = Number.isFinite(s.to) ? s.to : 1;
      const se = (g) => {
          const be = Math.max(-2, Math.min(3, U(g)));
          if (h === "from") X = Math.min(be, $ - 0.02);
          else $ = Math.max(be, X + 0.02);
          if (y)
            if (s.axis === "x") {
              (y.style.top = `${X * 100}%`);
              y.style.height = `${($ - X) * 100}%`;
            } else {
              (y.style.left = `${X * 100}%`);
              y.style.width = `${($ - X) * 100}%`;
            }
        },
        be = () => {
          (window.removeEventListener("pointermove", se),
            window.removeEventListener("pointerup", be),
            window.removeEventListener("pointercancel", be),
            De((et) => {
              const dt = (et.guides || []).find((nt) => nt.id === s.id);
              dt && ((dt.from = X), (dt.to = $));
            }));
        };
      (window.addEventListener("pointermove", se),
        window.addEventListener("pointerup", be),
        window.addEventListener("pointercancel", be));
    },
    removeGuide = (i) =>
      De((s) => {
        s.guides = (s.guides || []).filter((h) => h.id !== i);
      }),
    selectTool = (i) => {
      (i !== "transform" && M && $e && Gi(),
        i !== "transform" && restoreToolSettings(i),
        i === "transform" ? Bu() : he(i));
    },
    readNotes = (i) => {
      try {
        const s = JSON.parse(localStorage.getItem(`framia-notes-${i}`) || "[]");
        return Array.isArray(s)
          ? s
              .filter((h) => h && Array.isArray(h.points))
              .map((h) => ({
                color: typeof h.color == "string" ? h.color : "#ff4d6d",
                size: Number(h.size) || 7,
                points: h.points.filter(
                  (y) => y && Number.isFinite(y.x) && Number.isFinite(y.y),
                ),
              }))
              .filter((h) => h.points.length > 0)
          : [];
      } catch {
        return [];
      }
    },
    writeNotes = (i, s) => {
      try {
        localStorage.setItem(`framia-notes-${i}`, JSON.stringify(s));
      } catch {}
    },
    paintNotes = () => {
      const i = noteRef.current;
      if (!i) return;
      const s = Math.max(1, Math.round((Math.min(1e3, z.width) * xe) / 100)),
        h = Math.max(1, Math.round((s / z.width) * z.height));
      (i.width !== s || i.height !== h) && ((i.width = s), (i.height = h));
      const y = i.getContext("2d");
      if (!y) return;
      if ((y.clearRect(0, 0, s, h), !noteVisible)) return;
      ((y.lineCap = "round"),
        (y.lineJoin = "round"),
        noteStrokes.forEach((R) => {
          const U = R.points || [];
          if (!U.length) return;
          ((y.strokeStyle = R.color || "#ff4d6d"),
            (y.lineWidth = Math.max(1.5, (R.size || 7) * (s / z.width))),
            y.beginPath(),
            U.forEach((X, $) => {
              const se = (X.x / z.width) * s,
                be = (X.y / z.height) * h;
              $ ? y.lineTo(se, be) : y.moveTo(se, be);
            }),
            U.length === 1 &&
              y.lineTo((U[0].x / z.width) * s + 0.01, (U[0].y / z.height) * h),
            y.stroke());
        }));
    },
    clearNotes = () => {
      (setNoteStrokes([]), writeNotes(z.id, []));
    },
    notePointerDown = (i) => {
      if (pe !== "note" || !noteVisible || i.button !== 0) return;
      (i.preventDefault(), i.currentTarget.setPointerCapture(i.pointerId));
      const s = en(i);
      noteDraw.current = { color: "#ff4d6d", size: 7, points: [s] };
      setNoteStrokes((h) => [...h, noteDraw.current]);
    },
    notePointerMove = (i) => {
      const s = noteDraw.current;
      if (!s) return;
      const h = en(i),
        y = s.points.at(-1);
      if (y && Math.hypot(h.x - y.x, h.y - y.y) < 1.5) return;
      (s.points.push(h),
        setNoteStrokes((R) => {
          const U = R.slice();
          return ((U[U.length - 1] = { ...s, points: [...s.points] }), U);
        }));
    },
    notePointerUp = () => {
      noteDraw.current = null;
    },
    Kn = () => {
      if (!M) return;
      const i = mt
        .filter((s) => M.ids.includes(s.id))
        .map((s) => wo(s, M.box, $e || {}));
      sessionStorage.setItem("framia-copy", JSON.stringify(i));
    },
    Jn = () => {
      if (!(!ze || Ue.locked || !Ue.visible))
        try {
          const i = JSON.parse(sessionStorage.getItem("framia-copy")),
            s = Array.isArray(i) ? i : i ? [i] : [],
            h = jc(s);
          if (!h) return;
          const y = s.map((R) => ({ ...wo(R, h, { x: 28, y: 28 }), id: Ke() }));
          (De((R) => {
            var U, X, $;
            ((U = R.content)[(X = ze.id)] ?? (U[X] = {}),
              ($ = R.content[ze.id])[ee] ?? ($[ee] = []),
              R.content[ze.id][ee].push(...y));
          }),
            he("transform"),
            ve("properties"),
            ia(y[0].id),
            B({
              ids: y.map((R) => R.id),
              box: jc(y),
              frameId: ze.id,
              layerId: ee,
            }),
            rt({}));
        } catch {
          He("Não foi possível colar a seleção");
        }
    },
    ln = (i = !1) => {
      const s = ze ? Ti(z.frames, P) + Jt(ze) : Math.round(K * z.fps),
        h = { id: Ke(), start: s, duration: 1 };
      (De((y) => {
        var R;
        if (
          ((y.frames = Oo([...y.frames, h], h.id, s)),
          (y.content[h.id] = {}),
          i && ze)
        )
          for (let U of y.layers)
            y.content[h.id][U.id] = structuredClone(
              ((R = y.content[ze.id]) == null ? void 0 : R[U.id]) || [],
            );
      }),
        F(s / z.fps),
        le(
          z.frames.filter((y) => Ti(z.frames, z.frames.indexOf(y)) < s).length,
        ));
    },
    ju = () => {
      if (!ze || z.frames.length === 1) return;
      De((s) => {
        (s.frames.splice(P, 1), delete s.content[ze.id]);
      });
      let i = Math.max(0, P - 1);
      (F(Ti(z.frames, i) / z.fps), le(i));
    },
    Kc = () => {
      let i = {
        id: Ke(),
        name: `Camada ${z.layers.length + 1}`,
        visible: !0,
        locked: !1,
        opacity: 1,
        blend: "normal",
      };
      (De((s) => {
        var h, y;
        s.layers.push(i);
        for (let R of s.frames)
          ((h = s.content)[(y = R.id)] ?? (h[y] = {}),
            (s.content[R.id][i.id] = []));
      }),
        Ee(i.id));
    },
    Jc = (i, s) =>
      De((h) => {
        let y = h.layers.find((R) => R.id === ee);
        y && (y[i] = s);
      }),
    moveLayer = (i) => {
      const s = z.layers.findIndex((h) => h.id === ee),
        h = s + i;
      s < 0 ||
        h < 0 ||
        h >= z.layers.length ||
        De((y) => {
          const R = y.layers[s];
          (y.layers.splice(s, 1), y.layers.splice(h, 0, R));
        });
    },
    mergeLayer = (i) => {
      const s = z.layers.findIndex((h) => h.id === ee);
      if (s < 0) return;
      const h = i === "down" ? s - 1 : s + 1;
      if (h < 0 || h >= z.layers.length) return;
      const y = Math.min(s, h),
        R = Math.max(s, h),
        U = z.layers[y],
        X = z.layers[R];
      (De((f) => {
        for (const g of f.frames) {
          const b = f.content[g.id] || (f.content[g.id] = {}),
            N = b[U.id] || [],
            M = b[X.id] || [],
            B =
              (U.blend || "normal") === "normal" &&
              (X.blend || "normal") === "normal" &&
              (U.opacity ?? 1) === 1 &&
              (X.opacity ?? 1) === 1;
          if (B) b[U.id] = [...N, ...M];
          else {
            const q = document.createElement("canvas");
            ((q.width = f.width), (q.height = f.height));
            const w = q.getContext("2d");
            for (const [p, j] of [
              [U, N],
              [X, M],
            ]) {
              (w.save(),
                (w.globalAlpha = p.opacity ?? 1),
                (w.globalCompositeOperation = x1[p.blend] || "source-over"),
                j.forEach((Z) => Eu(w, Z)),
                w.restore());
            }
            b[U.id] = [
              {
                id: Ke(),
                type: "image",
                src: q.toDataURL("image/png"),
                x: 0,
                y: 0,
                w: f.width,
                h: f.height,
                opacity: 1,
              },
            ];
          }
          delete b[X.id];
        }
        ((f.layers[y] = { ...U, opacity: 1, blend: "normal" }),
          f.layers.splice(R, 1));
      }),
        Ee(U.id),
        He(
          Me === "en"
            ? "Layers merged"
            : Me === "es"
              ? "Capas combinadas"
              : "Camadas mescladas",
        ));
    },
    Fc = async (i) => {
      if (!i) return;
      let s = await new Promise((y) => {
          let R = new FileReader();
          ((R.onload = () => y(R.result)), R.readAsDataURL(i));
        }),
        h = new Image();
      ((h.onload = () => {
        let y = {
          id: Ke(),
          name: i.name.replace(/\.[^.]+$/, ""),
          visible: !0,
          locked: !1,
          opacity: 1,
          blend: "normal",
        };
        (De((R) => {
          var U, X;
          (R.layers.push(y),
            (U = R.content)[(X = ze.id)] ?? (U[X] = {}),
            (R.content[ze.id][y.id] = [
              {
                id: Ke(),
                type: "image",
                src: s,
                x: (R.width - h.width) / 2,
                y: (R.height - h.height) / 2,
                w: h.width,
                h: h.height,
                opacity: 1,
              },
            ]));
        }),
          Ee(y.id),
          he("transform"),
          He(H.image, i.name));
      }),
        (h.src = s));
    },
    $c = (i, s) => {
      var se;
      if (!i) return;
      const h = Ke(),
        y = URL.createObjectURL(i);
      (oa.current.set(h, y),
        Le((be) => ({ ...be, [h]: y })),
        xo(h, i).catch(() => He("Armazenamento de mídia cheio", i.name)),
        (se = Ct.current) == null ||
          se
            .uploadMedia(h, i)
            .catch(() => He("Falha ao enviar mídia para a sala", i.name)));
      let R = 5,
        U = !1,
        X = document.createElement(s === "audio" ? "audio" : "video");
      ((X.preload = "metadata"),
        (X.onloadedmetadata = () => {
          ((R = Number.isFinite(X.duration) ? X.duration : 5), $());
        }),
        (X.onerror = $),
        (X.src = y));
      function $() {
        if (U) return;
        U = !0;
        let be = {
          id: Ke(),
          type: s,
          name: i.name,
          mediaId: h,
          start: K,
          duration: Math.max(0.1, R),
          offset: 0,
          sourceDuration: Math.max(0.1, R),
        };
        (De((et) => et.clips.push(be)), ta(be.id), He(H.import, i.name));
      }
    },
    qu = () => {
      let i = z.clips.find((h) => h.id === Tt);
      if (!i) return;
      let s = K;
      if (s <= i.start + 0.001 || s >= i.start + i.duration - 0.001) {
        He("Posicione o cursor dentro do clipe");
        return;
      }
      De((h) => {
        let y = h.clips.find((U) => U.id === i.id),
          R = s - y.start;
        ((y.duration = R),
          h.clips.push({
            ...y,
            id: Ke(),
            start: s,
            offset: y.offset + R,
            duration: i.duration - R,
          }));
      });
    },
    jo = () => {
      if (!ze) {
        He("Selecione um quadro antes de cortar");
        return;
      }
      const i = z.frames[P],
        s = Ti(z.frames, P),
        h = Math.round((K * z.fps - s) * 1e4) / 1e4,
        y = Jt(i);
      if (h < FR_MIN_FRAME || h >= y) {
        He("Estique o quadro e posicione o cursor dentro dele");
        return;
      }
      const R = Ke();
      (De((U) => {
        ((U.frames[P].duration = h),
          U.frames.splice(P + 1, 0, { id: R, start: s + h, duration: y - h }),
          (U.content[R] = structuredClone(U.content[i.id] || {})));
      }),
        F((s + h) / z.fps),
        le(P + 1));
    },
    qo = () => (Tt ? qu() : jo()),
    Yo = (i, s) => {
      if (!z.frames.some((R) => R.id === i)) return;
      const h = Oo(z.frames, i, s),
        y = h.findIndex((R) => R.id === i);
      (De((R) => (R.frames = h)), le(y), F(h[y].start / z.fps));
    },
    Ic = (i, s, h) => {
      let y = h / _a;
      z.clips.find((U) => U.id === i) &&
        De((U) => {
          let X = U.clips.find(($) => $.id === i);
          if (s === "left") {
            let $ = Rt(y, -X.offset, X.duration - 0.1);
            ((X.start += $), (X.offset += $), (X.duration -= $));
          } else
            X.duration = Rt(X.duration + y, 0.1, X.sourceDuration - X.offset);
        });
    },
    Wc = (i, s, h) => {
      let y = document.createElement("a");
      ((y.href = URL.createObjectURL(new Blob([s], { type: h }))),
        (y.download = i),
        y.click(),
        setTimeout(() => URL.revokeObjectURL(y.href), 1e3));
    },
    Fn = async () => {
      try {
        Wc(
          `${z.name || "framia"}.framia`,
          await framiaPackProject(await Bv(z)),
          "application/x-framia",
        );
      } catch (i) {
        He("Falha ao salvar", i.message);
      }
    },
    Xi = Y.useRef(!1),
    Pc = async (i, includeAudio = !1) => {
      if (!Xi.current) {
        ((Xi.current = !0),
          Aa(!1),
          He("Exportando…", "Mantenha esta aba aberta."));
        try {
          const s = await tp(
            z,
            i,
            Eu,
            x1,
            () => {},
            async (h) => {
              (Tm(h), await zm.get(h).decode());
            },
            { includeAudio },
          );
          (Wc(`${z.name || "framia"}.${i}`, s, s.type),
            He("Exportação concluída", i.toUpperCase()));
        } catch (s) {
          He("Não foi possível exportar", s.message);
        } finally {
          Xi.current = !1;
        }
      }
    },
    Lo = () => {
      let i = document.createElement("a");
      ((i.href = Cl.current.toDataURL("image/png")),
        (i.download = `${z.name || "framia"}-quadro-${P + 1}.png`),
        i.click());
    },
    ki = (i) => {
      const s = {
        ...i,
        id: i.id || Ke(),
        frames: qc(i.frames),
        clips: i.clips || [],
      };
      ((bt.current = s),
        (Gn.current = s.revision || 0),
        (fa.current = []),
        (Ht.current = []),
        Ea.current.clear(),
        te(s),
        le(0),
        F(0),
        Ee(s.layers[0].id),
        ia(null),
        ta(null),
        rt(null),
        Aa(!1),
        ul("editor"),
        Pl(s.clips));
    },
    Vi = () =>
      ki(
        Sm(
          Rt(+ra.width || 1920, 64, 8192),
          Rt(+ra.height || 1080, 64, 8192),
          Fl.trim() || "Meu projeto",
        ),
      ),
    Go = async (i) => {
      try {
        let s = await Fp(i);
        if (Mt)
          try {
            ((s = (await gu(`/api/projects/${encodeURIComponent(i)}`)).project),
              await hm(s));
          } catch (h) {
            if (!s) throw h;
          }
        if (!s) throw Error();
        ki(s);
      } catch {
        He("Projeto indisponível", "Não foi possível abrir este projeto.");
      }
    },
    Xo = async () => {
      (Aa(!1), ba(bt.current));
      const i = Date.now() + 5e3;
      for (; Xn.current && Date.now() < i; )
        await new Promise((s) => setTimeout(s, 25));
      ul("home");
      (Ct.current
        ? Vo()
        : location.search.includes("room=") &&
          window.history.replaceState(null, "", location.pathname));
      try {
        Nl(await Qn());
      } catch {}
    },
    er = async (i) => {
      var s, h, y, R;
      if (i)
        try {
          const V2 = await framiaUnpackProject(i);
          let U = V2 || JSON.parse(await i.text()),
            X =
              !V2 &&
              (/\.duo$/i.test(i.name) ||
                (!U.content &&
                  Array.isArray(U.layers) &&
                  Number.isInteger(U.total))),
            $ = X ? Ip(U, i.name) : await jv(U);
          if (
            !((s = $.frames) != null && s.length) ||
            !((h = $.layers) != null && h.length) ||
            !$.content
          )
            throw Error();
          if (
            X &&
            typeof U.audioData == "string" &&
            /^data:[^,]*;base64,/i.test(U.audioData)
          ) {
            const se = await (await fetch(U.audioData)).blob(),
              be = Ke();
            await xo(be, se);
            const et = URL.createObjectURL(se),
              dt = await new Promise((nt) => {
                const Be = new Audio(),
                  ot = setTimeout(() => {
                    ((Be.src = ""), nt(Hn($.frames) / $.fps));
                  }, 1800);
                ((Be.onloadedmetadata = () => {
                  (clearTimeout(ot),
                    nt(
                      Number.isFinite(Be.duration)
                        ? Be.duration
                        : Hn($.frames) / $.fps,
                    ),
                    (Be.src = ""));
                }),
                  (Be.onerror = () => {
                    (clearTimeout(ot), nt(Hn($.frames) / $.fps));
                  }),
                  (Be.src = et));
              });
            (URL.revokeObjectURL(et),
              $.clips.push({
                id: Ke(),
                type: "audio",
                name: U.audioName || "Áudio Duo Studio",
                mediaId: be,
                start: 0,
                duration: dt,
                offset: 0,
                sourceDuration: dt,
              }));
          }
          if ((($.id = Ke()), ki($), X)) {
            const se = (U.brushes || [])
              .filter(
                (Be) =>
                  typeof Be.tipImage == "string" &&
                  Be.tipImage.startsWith("data:image/"),
              )
              .map((Be) => ({
                id: Ke(),
                name: Be.name || "Pincel Duo",
                src: Be.tipImage,
                originalId: Be.id,
              }));
            se.length && qn((Be) => [...Be, ...se]);
            let be = se.find((Be) => {
              var ot;
              return (
                Be.originalId ===
                ((ot = U.settings) == null ? void 0 : ot.brushId)
              );
            });
            be && Sl(be);
            let et = $.duoImport.frame;
            (le(et), F(Ti($.frames, et) / $.fps));
            let dt = U.layers.findIndex(
              (Be) => Be.id === $.duoImport.activeLayer,
            );
            (dt >= 0 && Ee($.layers[dt].id),
              /^#[0-9a-f]{6}$/i.test(
                ((y = U.settings) == null ? void 0 : y.color) || "",
              ) && Fe(U.settings.color));
            const nt = { h: "horizontal", v: "vertical", both: "both" }[
              (R = U.settings) == null ? void 0 : R.sym
            ];
            nt && Ge(nt);
          }
          He(H.open, i.name);
        } catch (U) {
          (console.error("Project import failed", U),
            He(
              "Arquivo inválido",
              "Escolha um projeto .framia, .duo ou .json válido",
            ));
        }
    },
    Yu = (i, s, h) => {
      var R;
      ((R = Ct.current) == null || R.close(),
        (Du.current = i),
        kc(i),
        h && Li(h));
      const y = new ag(i, s, {
        onProject: Li,
        onStatus: (U) => {
          var X;
          (_i(U),
            U !== "connected"
              ? k({})
              : V.current &&
                ((X = Ct.current) == null ||
                  X.broadcast("transform", V.current)));
        },
        onError: (U) => He("Erro na sala", U.message),
        onMessage: (U) => {
          var $;
          if (U.type === "presence") {
            wa(U.members || []);
            const se = new Set((U.members || []).map((be) => be.connectionId));
            k((be) =>
              Object.fromEntries(
                Object.entries(be).filter(([et]) => se.has(et)),
              ),
            );
            return;
          }
          if (U.type !== "broadcast") return;
          const X = U.data || {};
          if (
            (U.event === "media-ready" &&
              typeof X.mediaId == "string" &&
              Pl(bt.current.clips.filter((se) => se.mediaId === X.mediaId)),
            U.event === "chat" && typeof X.text == "string")
          ) {
            if (X.senderId && Mt && X.senderId === Mt.sub) return;
            const se = {
              id: typeof X.id === "string" ? X.id : Ke(),
              name: String(X.name || "Colaborador").slice(0, 50),
              username: String(X.username || "").slice(0, 20),
              avatar: typeof X.avatar === "string" ? X.avatar : "",
              text: expandEmojiNames(X.text.slice(0, 500)),
            };
            (Mu((be) => (be.some((et) => et.id === se.id) ? be : [...be, se])),
              He(se.name, se.text, () => Tu(!0)));
          }
          if (
            U.event === "cursor" &&
            !(Mt && U.userId === Mt.sub) &&
            Number.isFinite(X.x) &&
            Number.isFinite(X.y)
          ) {
            const se = Date.now();
            (setRc((be) => ({
              ...be,
              [U.userId]: {
                x: Rt(Number(X.x), -5e3, 5e3),
                y: Rt(Number(X.y), -5e3, 5e3),
                name: String(X.name || "").slice(0, 40),
                at: se,
              },
            })),
              setTimeout(
                () =>
                  setRc((be) =>
                    be[U.userId] == null || be[U.userId].at !== se
                      ? be
                      : Object.fromEntries(
                          Object.entries(be).filter(
                            ([et]) => et !== U.userId,
                          ),
                        ),
                  ),
                4500,
              ));
          }
          if (U.event === "reaction" && typeof X.emoji == "string") {
            const se = {
              id: Ke(),
              emoji: X.emoji.slice(0, 4),
              x: Rt(Number(X.x) || 50, 5, 95),
            };
            (Za((be) => [...be, se]),
              setTimeout(
                () => Za((be) => be.filter((et) => et.id !== se.id)),
                2400,
              ));
          }
          if (
            U.event === "stroke-preview" &&
            Array.isArray(($ = X.element) == null ? void 0 : $.points) &&
            X.element.points.length < 300
          ) {
            const se = Date.now();
            (Hi((be) => ({ ...be, [U.userId]: { ...X, at: se } })),
              setTimeout(
                () =>
                  Hi((be) => {
                    var dt;
                    if (((dt = be[U.userId]) == null ? void 0 : dt.at) !== se)
                      return be;
                    const et = { ...be };
                    return (delete et[U.userId], et);
                  }),
                1800,
              ));
          }
          U.event === "stroke-end" &&
            Hi((be) =>
              U.userId in be
                ? Object.fromEntries(Object.entries(be).filter((et) => et[0] !== U.userId))
                : be,
            );
          U.event === "transform" && ne(U.connectionId || U.userId, X || null);
        },
      });
      ((Ct.current = y),
        (rl_redo.current = []),
        (fa.current = []),
        (Ht.current = []),
        y.refresh(!0),
        Mt &&
          y.presence({
            name:
              (profile == null ? void 0 : profile.displayName) ||
              Mt.name ||
              Mt.email ||
              "Colaborador",
            username: (profile == null ? void 0 : profile.username) || "",
            avatar:
              (profile == null ? void 0 : profile.avatar) ||
              (Mt == null ? void 0 : Mt.picture) ||
              "",
            userId: Mt.sub,
          }),
        Ve(""),
        He("Sala conectada", i));
    },
    createRoomFromHome = async () => {
      if (!Mt) {
        location.href =
          "/auth/freebuff/signin?returnTo=" + encodeURIComponent("/");
        return;
      }
      (ki(
        Sm(
          Rt(+ra.width || 1920, 64, 8192),
          Rt(+ra.height || 1080, 64, 8192),
          Fl.trim() || "Meu projeto",
        ),
      ),
        await ko());
    },
    ko = async () => {
      if (!Mt) {
        location.href =
          "/auth/freebuff/signin?returnTo=" +
          encodeURIComponent(location.pathname + location.search);
        return;
      }
      try {
        const i = await tg(bt.current);
        Yu(i.code, i.revision);
        for (const s of bt.current.clips)
          s.mediaId &&
            pm(s.mediaId)
              .then((h) => {
                var y;
                return (
                  h &&
                  ((y = Ct.current) == null
                    ? void 0
                    : y.uploadMedia(s.mediaId, h))
                );
              })
              .catch(() => He("Falha ao enviar mídia para a sala", s.name));
        window.history.replaceState(null, "", `?room=${i.code}`);
      } catch (i) {
        He("Não foi possível criar sala", i.message);
      }
    },
    tr = async () => {
      if (!Mt) {
        location.href =
          "/auth/freebuff/signin?returnTo=" +
          encodeURIComponent("/?room=" + zl.trim().toUpperCase());
        return;
      }
      try {
        const i = zl.trim().toUpperCase();
        await M1(i);
        const s = await fetch(`/api/rooms/${i}`, {
          credentials: "same-origin",
        });
        if (!s.ok) throw Error("Sala indisponível");
        const h = await s.json();
        (ul("editor"),
          Yu(i, h.revision, h.project),
          window.history.replaceState(null, "", `?room=${i}`));
      } catch (i) {
        He("Não foi possível entrar na sala", i.message);
      }
    };
  Y.useEffect(() => {
    const i = new URLSearchParams(location.search).get("room");
    Di &&
      !Mt &&
      i &&
      (location.href =
        "/auth/freebuff/signin?returnTo=" +
        encodeURIComponent(location.pathname + location.search));
  }, [Mt, Di]);
  Y.useEffect(() => {
    const i = new URLSearchParams(location.search).get("room");
    Mt &&
      i &&
      !Du.current &&
      (Ln(i.toUpperCase()),
      M1(i.toUpperCase())
        .then(async () => {
          const s = await fetch(`/api/rooms/${i.toUpperCase()}`, {
            credentials: "same-origin",
          });
          if (!s.ok) throw Error("Sala indisponível");
          const h = await s.json();
          (ul("editor"), Yu(i.toUpperCase(), h.revision, h.project));
        })
        .catch((s) => He("Não foi possível entrar na sala", s.message)));
  }, [Mt]);
  const Vo = () => {
      var i;
      const s = Ct.current,
        h = roomQueue.current.splice(0);
      (clearTimeout(roomTimer.current),
        h.length && s && s.mutations(h),
        Ol(null),
        k({}),
        (i = Ct.current) == null || i.close(),
        (Ct.current = null),
        (rl_redo.current = []),
        (fa.current = []),
        (Ht.current = []),
        (Du.current = null),
        kc(null),
        wa([]),
        _i("offline"),
        window.history.replaceState(null, "", location.pathname));
    },
    Yq = () => (Vo(), ul("home")),
    ar = () => {
      var s, h;
      if (!Ql.trim()) return;
      let i = {
        id: Ke(),
        name:
          (profile == null ? void 0 : profile.displayName) ||
          (Mt == null ? void 0 : Mt.name) ||
          "Colaborador",
        username: (profile == null ? void 0 : profile.username) || "",
        avatar:
          (profile == null ? void 0 : profile.avatar) ||
          (Mt == null ? void 0 : Mt.picture) ||
          "",
        senderId: (Mt == null ? void 0 : Mt.sub) || Vn.current,
        text: expandEmojiNames(Ql.trim()),
        time: Date.now(),
      };
      (Mu((y) => [...y, i]),
        (s = Il.current) == null ||
          s.postMessage({ sender: Vn.current, type: "chat", payload: i }),
        (h = Ct.current) == null ||
          h.broadcast("chat", {
            id: i.id,
            senderId: i.senderId,
            name: i.name,
            username: i.username,
            avatar: i.avatar,
            text: i.text,
          }),
        Lc(""));
    },
    Qo = (i) => {
      var h, y;
      let s = { id: Ke(), emoji: i, x: 15 + Math.random() * 70 };
      (Za((R) => [...R, s]),
        (h = Il.current) == null ||
          h.postMessage({ sender: Vn.current, type: "reaction", payload: s }),
        (y = Ct.current) == null ||
          y.broadcast("reaction", { emoji: i, x: s.x }),
        setTimeout(() => Za((R) => R.filter((U) => U.id !== s.id)), 2400));
    };
  Y.useEffect(() => {
    if (Oa !== "editor") return;
    const i = (y) => {
      if (y.key === "Escape") {
        if (Oe) {
          Ve("");
          return;
        }
        if (gt) {
          Qe(!1);
          return;
        }
      }
      if (Oe) return;
      let R = y.target,
        U = R.tagName;
      if (
        U === "TEXTAREA" ||
        U === "SELECT" ||
        R.isContentEditable ||
        (U === "INPUT" &&
          !["range", "color", "checkbox", "radio", "button"].includes(R.type))
      ) {
        M &&
          R.closest(".transform-panel") &&
          y.key === "Enter" &&
          (y.preventDefault(), Gi(), R.blur());
        return;
      }
      if (
        (y.key === "Tab" && (y.preventDefault(), Ft(($) => !$)),
        y.code === "Space" && (y.preventDefault(), y.repeat || Aa(($) => !$)),
        y.key === "Enter")
      ) {
        (y.preventDefault(), Gi());
        return;
      }
      if (
        (y.key === "Escape" && Ra(),
        (y.ctrlKey || y.metaKey) && y.key.toLowerCase() === "z")
      ) {
        (y.preventDefault(), y.shiftKey ? ol() : Uu());
        return;
      }
      if ((y.ctrlKey || y.metaKey) && y.key.toLowerCase() === "y") {
        (y.preventDefault(), ol());
        return;
      }
      if (
        ((y.ctrlKey || y.metaKey) &&
          y.key.toLowerCase() === "s" &&
          (y.preventDefault(), Fn()),
        (y.ctrlKey || y.metaKey) && y.key.toLowerCase() === "c" && M)
      ) {
        (y.preventDefault(), Kn());
        return;
      }
      if ((y.ctrlKey || y.metaKey) && y.key.toLowerCase() === "v") {
        (y.preventDefault(), Jn());
        return;
      }
      if ((y.ctrlKey || y.metaKey) && y.key.toLowerCase() === "g") {
        (y.preventDefault(), y.shiftKey ? ungroupSelection() : groupSelection());
        return;
      }
      ((y.key === "Delete" || y.key === "Backspace") &&
        (removeSelection(), y.preventDefault()),
        (y.ctrlKey || y.metaKey) &&
          y.key.toLowerCase() === "d" &&
          (y.preventDefault(), duplicateSelection()),
        !(y.ctrlKey || y.metaKey || y.altKey) &&
          (y.key.toLowerCase() === "p" && Ve("brushes"),
          (y.key === "[" || y.key === "]") &&
            (y.preventDefault(),
            J(($) =>
              Rt(
                Math.round($ * (y.key === "]" ? 1.15 : 1 / 1.15)) || 1,
                1,
                1000,
              ),
            )),
          y.key === "Home" && (y.preventDefault(), F(0)),
          y.key === "End" &&
            (y.preventDefault(), F(Math.max(0, (Hn(z.frames) - 1) / z.fps))),
          (() => {
            const $ = y.key.toLowerCase();
            if ($ === "t") return selectTool("transform");
            const se = Object.keys(shortcuts).find((be) => shortcuts[be] === $);
            se && selectTool(se);
          })(),
          y.key === "ArrowRight" &&
            F(($) => Math.min(Hn(z.frames) / z.fps, $ + 1 / z.fps)),
          y.key === "ArrowLeft" && F(($) => Math.max(0, $ - 1 / z.fps))));
    };
    window.addEventListener("keydown", i);
    const s = (y) => {
      y.key === " " && (Bo.current = !1);
    };
    window.addEventListener("keyup", s);
    const h = (y) => {
      var R, U;
      if (
        (U = (R = y.clipboardData) == null ? void 0 : R.files) != null &&
        U.length
      ) {
        let X = [...y.clipboardData.files].find(($) =>
          $.type.startsWith("image/"),
        );
        X && (y.preventDefault(), Fc(X));
      }
    };
    return (
      window.addEventListener("paste", h),
      () => {
        (window.removeEventListener("keydown", i),
          window.removeEventListener("keyup", s),
          window.removeEventListener("paste", h));
      }
    );
  }, [z, P, ee, Va, $e, mt, Oa, Oe, gt, M, p, shortcuts]);
  Y.useEffect(() => {
    if (!fpsOpen) return;
    let i = 0,
      s = performance.now(),
      h = 0;
    const y = (R) => {
      (i++,
        R - s >= 500 &&
          (setRenderFps(Math.round((i * 1e3) / (R - s))), (i = 0), (s = R)),
        (h = requestAnimationFrame(y)));
    };
    return ((h = requestAnimationFrame(y)), () => cancelAnimationFrame(h));
  }, [fpsOpen]);
  Y.useEffect(() => {
    framiaRememberTool(pe, {
      size: Ae,
      opacity: re,
      spacing: Yn,
      rotation: wi,
      presetId: (lt == null ? void 0 : lt.id) || null,
    });
  }, [pe, Ae, re, Yn, wi, lt]);
  const lr = (i) => {
      const s =
          (i == null ? void 0 : i.type) === "erase"
            ? "eraser"
            : (i == null ? void 0 : i.type) === "smudge"
              ? "smudge"
              : "brush",
        h = {
          size: (i == null ? void 0 : i.size) || 8,
          opacity: Math.round(((i == null ? void 0 : i.opacity) ?? 1) * 100),
          spacing: Math.round(((i == null ? void 0 : i.spacing) ?? 0.1) * 100),
          presetId: (i == null ? void 0 : i.id) || null,
        };
      (framiaRememberTool(s, h),
        Sl(i),
        J(h.size),
        ye(h.opacity),
        zu(h.spacing),
        he(s),
        Ve(""));
    },
    Qi = [
      "Canetas",
      "Pincéis",
      "Marcadores",
      "Texturas",
      "Efeitos",
      "Borracha",
      "Mistura",
      "Meus pincéis",
    ],
    Zo = [
      ...Y1,
      ...ll.map((i) => ({ ...i, group: i.group || "Meus pincéis" })),
    ].sort(
      (i, s) =>
        Qi.indexOf(i.group) - Qi.indexOf(s.group) ||
        i.name.localeCompare(s.name),
    ),
    NoteIcon = de("PenLine", [
      ["path", { d: "M12 20h9", key: "note-a" }],
      ["path", { d: "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z", key: "note-b" }],
    ]),
    Lu = [
      [Cp, "transform", H.transform, "T"],
      [um, "brush", H.brush, "B"],
      [
        pp,
        "eraser",
        Me === "en" ? "Eraser" : Me === "es" ? "Borrador" : "Borracha",
        "E",
      ],
      [
        Lp,
        "smudge",
        Me === "en" ? "Smudge" : Me === "es" ? "Difuminar" : "Esfumar",
        "S",
      ],
      [
        Ap,
        "fill",
        Me === "en" ? "Fill" : Me === "es" ? "Rellenar" : "Balde",
        "G",
      ],
      [
        xp,
        "pan",
        Me === "en" ? "Pan" : Me === "es" ? "Mover lienzo" : "Mover tela",
        "H",
      ],
      [
        Rp,
        "pipette",
        Me === "en"
          ? "Eyedropper"
          : Me === "es"
            ? "Cuentagotas"
            : "Conta-gotas",
        "I",
      ],
      [Mp, "line", Me === "en" ? "Line" : Me === "es" ? "Línea" : "Linha", "L"],
      [
        Yp,
        "rect",
        Me === "en" ? "Rectangle" : Me === "es" ? "Rectángulo" : "Retângulo",
        "R",
      ],
      [yp, "ellipse", Me === "en" ? "Ellipse" : "Elipse", "O"],
      [NoteIcon, "note", H.notes, "N"],
    ],
    ma = 62 * It,
    _a = ma * z.fps,
    rulerStep = Math.max(1, Math.ceil(6 / ma)),
    nn =
      Math.max(
        Hn(z.frames),
        ...z.clips.map((i) => Math.ceil((i.start + i.duration) * z.fps)),
        z.fps,
      ) + z.fps,
    $n = v || z.frames,
    Zi = (i, s, h = "move") => {
      if (i.button !== 0) return;
      (i.preventDefault(), i.stopPropagation());
      const y = i.currentTarget,
        R = Ru.current,
        U = i.clientX,
        X = R.scrollLeft,
        $ = z.frames;
      let se = !1,
        be = $;
      y.setPointerCapture(i.pointerId);
      const et = (nt) => {
          const Be = nt.clientX - U + R.scrollLeft - X;
          (!se && Math.abs(Be) < 3) ||
            ((se = !0), (be = Gp($, s.id, h, Be / ma)), f(be));
        },
        dt = (nt, Be = !1) => {
          if (
            (Be || et(nt),
            (y.onpointermove = null),
            (y.onpointerup = null),
            (y.onpointercancel = null),
            f(null),
            (g.current = se || Be),
            se && !Be)
          ) {
            De((Ua) => {
              Ua.frames = be;
            });
            const ot = be.find((Ua) => Ua.id === s.id);
            F(ot.start / z.fps);
          } else Be || (ta(null), F(s.start / z.fps));
        };
      ((y.onpointermove = et),
        (y.onpointerup = (nt) => dt(nt)),
        (y.onpointercancel = (nt) => dt(nt, !0)));
    },
    nr = (i) => {
      if (i.button !== 0) return;
      const s = i.currentTarget;
      (Aa(!1), s.setPointerCapture(i.pointerId));
      const h = (y) => {
        const R = s.getBoundingClientRect();
        F(Math.max(0, (y.clientX - R.left + s.scrollLeft) / _a));
      };
      (h(i),
        (s.onpointermove = h),
        (s.onpointerup = (y) => {
          (h(y),
            (s.onpointermove = null),
            (s.onpointerup = null),
            (s.onpointercancel = null));
        }),
        (s.onpointercancel = () => {
          ((s.onpointermove = null),
            (s.onpointerup = null),
            (s.onpointercancel = null));
        }));
    },
    Ki = (i, s) => {
      let h = s.getBoundingClientRect();
      Ut(Math.max(0, (i.clientX - h.left + s.scrollLeft) / ma));
    },
    Ji = (i) => {
      i.preventDefault();
      const s = Ru.current;
      if (!s) return;
      const h = s.getBoundingClientRect(),
        y = i.clientX - h.left,
        R = (s.scrollLeft + y) / ma,
        U = Rt(It * (i.deltaY < 0 ? 1.15 : 1 / 1.15), 0.08, 12);
      (Oi(U),
        requestAnimationFrame(() => {
          ((s.scrollLeft = R * 62 * U - y),
            Wl.current && (Wl.current.scrollLeft = s.scrollLeft));
        }));
    },
    Gu = (i, s, h) => {
      var R;
      i = Rt(i, 20, 400);
      const y = (R = sa.current) == null ? void 0 : R.getBoundingClientRect();
      if (y) {
        const U = s - (y.left + y.width / 2),
          X = h - (y.top + y.height / 2),
          $ = i / xe;
        N((se) => ({ x: U - (U - se.x) * $, y: X - (X - se.y) * $ }));
      }
      ke(i);
    };
  Y.useEffect(() => {
    (setNoteStrokes(readNotes(z.id)), (noteDraw.current = null));
  }, [z.id]);
  Y.useEffect(() => {
    paintNotes();
  }, [noteStrokes, noteVisible, xe, z.width, z.height]);
  Y.useEffect(() => {
    writeNotes(z.id, noteStrokes);
  }, [noteStrokes]);
  Y.useEffect(() => {
    const canvas = sa.current;
    const ruler = Wl.current;
    const tracks = Ru.current;
    const canvasWheel = (event) => {
      event.preventDefault();
      Gu(xe * (event.deltaY < 0 ? 1.1 : 1 / 1.1), event.clientX, event.clientY);
    };
    canvas?.addEventListener("wheel", canvasWheel, { passive: false });
    ruler?.addEventListener("wheel", Ji, { passive: false });
    tracks?.addEventListener("wheel", Ji, { passive: false });
    return () => {
      canvas?.removeEventListener("wheel", canvasWheel);
      ruler?.removeEventListener("wheel", Ji);
      tracks?.removeEventListener("wheel", Ji);
    };
  });
  const accountLabels =
      Me === "en"
        ? {
            profile: "My profile",
            signIn: "Sign in with Freebuff",
            signOut: "Sign out",
            add: "Add account",
            current: "Current account",
            switch: "Switch",
            remove: "Remove from this device",
            limit: "Up to 3 saved accounts",
            note: "Local projects and brushes are stored separately for each account.",
          }
        : Me === "es"
          ? {
              profile: "Mi perfil",
              signIn: "Entrar con Freebuff",
              signOut: "Salir",
              add: "Añadir cuenta",
              current: "Cuenta actual",
              switch: "Cambiar",
              remove: "Quitar de este dispositivo",
              limit: "Hasta 3 cuentas guardadas",
              note: "Los proyectos y pinceles locales se guardan por separado para cada cuenta.",
            }
          : {
              profile: "Meu perfil",
              signIn: "Entrar com Freebuff",
              signOut: "Sair",
              add: "Adicionar conta",
              current: "Conta atual",
              switch: "Alternar",
              remove: "Remover deste dispositivo",
              limit: "Até 3 contas salvas",
              note: "Projetos e pincéis locais ficam separados por conta.",
            },
    accountAvatar = (i, s = 24) =>
      i && i.picture
        ? r.createElement("img", {
            className: "account-avatar",
            src: i.picture,
            alt: "",
            width: s,
            height: s,
          })
        : r.createElement(
            "span",
            {
              className: "account-avatar account-initials",
              style: { width: s, height: s, fontSize: Math.round(s * 0.45) },
            },
            ((i && (i.name || i.email)) || "F").trim().slice(0, 1).toUpperCase(),
          ),
    renderAccountControl = (showName = !1) => {
      if (!Di || !authAvailable) return null;
      const i = location.pathname + location.search,
        s = `/auth/freebuff/signin?returnTo=${encodeURIComponent(i)}`,
        h = `${s}&prompt=select_account`,
        y = Mt ? { id: Mt.sub, name: Mt.name || "", email: Mt.email || "", picture: Mt.picture || "" } : null,
        $ = y && !accounts.some((V) => V.id === y.id)
          ? [y, ...accounts].slice(0, FRAMIA_MAX_ACCOUNTS)
          : accounts,
        se = y ? y.id : null;
      return y
        ? r.createElement(
            "div",
            { className: `account-control ${accountMenu ? "open" : ""}` },
            r.createElement(
              "button",
              {
                type: "button",
                className: "account-button account-trigger",
                onClick: () => setAccountMenu((V) => !V),
                "aria-expanded": accountMenu,
                "aria-haspopup": "menu",
                title: y.name || y.email || "Freebuff",
              },
              accountAvatar(y, 24),
              showName &&
                r.createElement(
                  "span",
                  { className: "account-name" },
                  y.name || y.email || "Freebuff",
                ),
              r.createElement(
                "span",
                { className: "account-caret", "aria-hidden": "true" },
                "\u25BE",
              ),
            ),
            accountMenu &&
              r.createElement(
                "div",
                { className: "account-menu", role: "menu" },
                r.createElement(
                  "div",
                  { className: "account-menu-head" },
                  r.createElement("span", null, "Freebuff"),
                  r.createElement("small", null, accountLabels.limit),
                ),
                $.map((V) => {
                  const oe = V.id === se;
                  return r.createElement(
                    "div",
                    {
                      key: V.id,
                      className: `account-row ${oe ? "current" : ""}`,
                    },
                    accountAvatar(V, 28),
                    r.createElement(
                      "span",
                      { className: "account-row-text" },
                      r.createElement(
                        "b",
                        null,
                        V.name || V.email || "Freebuff",
                      ),
                      r.createElement(
                        "small",
                        null,
                        oe ? accountLabels.current : V.email || "",
                      ),
                    ),
                    !oe &&
                      r.createElement(
                        "button",
                        {
                          type: "button",
                          className: "account-remove",
                          title: accountLabels.remove,
                          "aria-label": accountLabels.remove,
                          onClick: (ne) => {
                            (ne.stopPropagation(),
                              setAccounts(framiaForgetAccount(V.id)));
                          },
                        },
                        "\u00D7",
                      ),
                    !oe &&
                      r.createElement(
                        "a",
                        {
                          className: "account-switch",
                          href: h,
                          onClick: () => setAccountMenu(!1),
                        },
                        accountLabels.switch,
                      ),
                  );
                }),
                r.createElement(
                  "div",
                  { className: "account-menu-actions" },
                  $.length < FRAMIA_MAX_ACCOUNTS
                    ? r.createElement(
                        "a",
                        {
                          className: "account-add",
                          href: h,
                          onClick: () => setAccountMenu(!1),
                        },
                        "+ ",
                        accountLabels.add,
                      )
                    : r.createElement(
                        "span",
                        { className: "account-limit" },
                        accountLabels.limit,
                      ),
                  r.createElement(
                    "button",
                    {
                      type: "button",
                      className: "account-profile",
                      onClick: () => openMyProfile(),
                    },
                    accountLabels.profile,
                  ),
                  r.createElement(
                    "form",
                    { action: "/auth/freebuff/signout", method: "POST" },
                    r.createElement(
                      "button",
                      { type: "submit", className: "account-signout" },
                      accountLabels.signOut,
                    ),
                  ),
                ),
                r.createElement("p", { className: "account-note" }, accountLabels.note),
              ),
          )
        : r.createElement(
            "a",
            { className: "account-button", href: s },
            accountLabels.signIn,
          );
    };
  return Oa === "home"
    ? r.createElement(
        "div",
        { className: "home-shell", style: { "--accent": ft.accent } },
        r.createElement("input", {
          ref: xl,
          type: "file",
          accept: ".framia,.duo,.json",
          hidden: !0,
          onChange: (i) => {
            (er(i.target.files[0]), (i.target.value = ""));
          },
        }),
        Oe === "profile" &&
          r.createElement(
            "div",
            {
              className: "modal-backdrop",
              onMouseDown: (i) => i.target === i.currentTarget && Ve(""),
            },
            r.createElement(
              "div",
              { className: "modal" },
              r.createElement(
                "div",
                { className: "modal-head" },
                r.createElement(
                  "div",
                  null,
                  r.createElement(
                    "span",
                    { className: "modal-kicker" },
                    "FRAMIA STUDIO",
                  ),
                  r.createElement("h2", null, "Meu perfil"),
                ),
                r.createElement(
                  "button",
                  { onClick: () => Ve("") },
                  r.createElement(dm, { size: 20 }),
                ),
              ),
              profileModalBody,
            ),
          ),
        r.createElement(
          "header",
          { className: "home-header" },
          r.createElement(
            "div",
            { className: "home-brand" },
            r.createElement("img", { src: "/brand/framia-logo.webp", alt: "" }),
            r.createElement(
              "b",
              null,
              "framia",
              r.createElement("span", null, "."),
            ),
          ),
          r.createElement(
            "div",
            { className: "home-header-right" },
            r.createElement(
              "span",
              null,
              r.createElement(im, { size: 14 }),
              xt.autosave,
            ),
            renderAccountControl(!0),
            r.createElement(
              "select",
              {
                value: Me,
                onChange: (i) => Ai(i.target.value),
                "aria-label": H.language,
              },
              r.createElement("option", { value: "pt" }, "Português"),
              r.createElement("option", { value: "en" }, "English"),
              r.createElement("option", { value: "es" }, "Español"),
            ),
          ),
        ),
        r.createElement(
          "main",
          { className: "home-main" },
          r.createElement(
            "div",
            { className: "home-intro" },
            r.createElement(
              "div",
              { className: "home-kicker" },
              r.createElement(qp, { size: 14 }),
              xt.eyebrow,
            ),
            r.createElement("h1", null, xt.title),
            r.createElement("p", null, xt.subtitle),
          ),
          r.createElement(
            "div",
            { className: "home-create" },
            r.createElement(
              "div",
              { className: "home-create-title" },
              r.createElement(
                "div",
                null,
                r.createElement(
                  "span",
                  { className: "home-card-icon" },
                  r.createElement(_c, { size: 19 }),
                ),
                r.createElement("h2", null, xt.new),
              ),
              r.createElement(
                "button",
                { className: "home-import", onClick: () => xl.current.click() },
                r.createElement(fm, { size: 16 }),
                xt.import,
              ),
            ),
            r.createElement(
              "div",
              { className: "home-presets" },
              [
                [1920, 1080, "Full HD", "16:9"],
                [1280, 720, "HD", "16:9"],
                [1080, 1080, "Quadrado", "1:1"],
                [1080, 1920, "Vertical", "9:16"],
              ].map(([i, s, h, y]) =>
                r.createElement(
                  "button",
                  {
                    key: h,
                    className:
                      ra.width === i && ra.height === s ? "selected" : "",
                    onClick: () => il({ width: i, height: s }),
                  },
                  r.createElement("span", {
                    className: `preset-icon ${i === s ? "square" : i < s ? "portrait" : "landscape"}`,
                  }),
                  r.createElement("b", null, h),
                  r.createElement(
                    "small",
                    null,
                    i,
                    " × ",
                    s,
                    " ",
                    r.createElement("i", null, y),
                  ),
                ),
              ),
            ),
            r.createElement(
              "div",
              { className: "home-custom" },
              r.createElement(
                "label",
                null,
                H.project,
                r.createElement("input", {
                  value: Fl,
                  onChange: (i) => $l(i.target.value),
                }),
              ),
              r.createElement(
                "label",
                null,
                H.width,
                r.createElement("input", {
                  type: "number",
                  min: "64",
                  max: "8192",
                  value: ra.width,
                  onChange: (i) => il((s) => ({ ...s, width: i.target.value })),
                }),
              ),
              r.createElement(
                "label",
                null,
                H.height,
                r.createElement("input", {
                  type: "number",
                  min: "64",
                  max: "8192",
                  value: ra.height,
                  onChange: (i) =>
                    il((s) => ({ ...s, height: i.target.value })),
                }),
              ),
              r.createElement(
                "button",
                { className: "home-create-button", onClick: Vi },
                r.createElement(_c, { size: 17 }),
                xt.create,
              ),
            ),
          ),
          r.createElement(
            "div",
            { className: "home-room" },
            r.createElement(mm, { size: 19 }),
            r.createElement(
              "div",
              null,
              r.createElement("b", null, "Sala multiplayer"),
              r.createElement(
                "small",
                null,
                "Compartilhe um código para desenhar e editar juntos.",
              ),
            ),
            r.createElement(
              "button",
              { className: "home-room-create", onClick: createRoomFromHome },
              r.createElement(mm, { size: 14 }),
              Me === "en"
                ? "Create room"
                : Me === "es"
                  ? "Crear sala"
                  : "Criar sala",
            ),
            r.createElement("input", {
              maxLength: 8,
              value: zl,
              placeholder: "Código da sala",
              onChange: (i) => Ln(i.target.value.toUpperCase()),
            }),
            r.createElement(
              "button",
              { disabled: ![6, 8].includes(zl.trim().length), onClick: tr },
              "Entrar",
            ),
          ),
          r.createElement(
            "div",
            { className: "home-library-head" },
            r.createElement(
              "div",
              null,
              r.createElement("h2", null, xt.library),
              r.createElement("span", null, Jl.length),
            ),
            r.createElement(
              "button",
              { onClick: () => xl.current.click() },
              r.createElement(fm, { size: 15 }),
              xt.import,
            ),
          ),
          Jl.length
            ? r.createElement(
                "div",
                { className: "home-project-grid" },
                Jl.map((i) =>
                  r.createElement(
                    "div",
                    { className: "home-project", key: i.id },
                    r.createElement(
                      "button",
                      {
                        className: "home-project-open",
                        onClick: () => Go(i.id),
                      },
                      r.createElement(
                        "span",
                        { className: "home-project-thumb" },
                        r.createElement("img", {
                          src: "/brand/framia-logo.webp",
                          alt: "",
                        }),
                      ),
                      r.createElement(
                        "span",
                        { className: "home-project-name" },
                        i.name,
                      ),
                      r.createElement(
                        "span",
                        { className: "home-project-meta" },
                        i.width,
                        " × ",
                        i.height,
                        " · ",
                        i.frames,
                        " ",
                        H.frames,
                      ),
                      r.createElement(
                        "span",
                        { className: "home-project-date" },
                        xt.updated,
                        " ",
                        new Date(i.updatedAt).toLocaleDateString(
                          Me === "pt"
                            ? "pt-BR"
                            : Me === "es"
                              ? "es-ES"
                              : "en-US",
                        ),
                      ),
                    ),
                    r.createElement(
                      "button",
                      {
                        className: "home-project-delete",
                        title: xt.remove,
                        onClick: async () => {
                          if (window.confirm(`${xt.remove}: ${i.name}?`)) {
                            if ((await $p(i.id), Mt))
                              try {
                                await gu(
                                  `/api/projects/${encodeURIComponent(i.id)}`,
                                  "DELETE",
                                );
                              } catch {
                                He("Não foi possível excluir na nuvem");
                              }
                            Nl(await Qn());
                          }
                        },
                      },
                      r.createElement(Hc, { size: 15 }),
                    ),
                  ),
                ),
              )
            : r.createElement(
                "div",
                { className: "home-empty" },
                r.createElement(v1, { size: 26 }),
                r.createElement("span", null, xt.empty),
              ),
        ),
        ca &&
          r.createElement(
            "div",
            { className: "toast" },
            r.createElement(h1, { size: 17 }),
            r.createElement(
              "div",
              null,
              r.createElement("b", null, ca.title),
              ca.body && r.createElement("p", null, ca.body),
            ),
          ),
      )
    : r.createElement(
        "div",
        {
          className: `app ${ka ? "canvas-only" : ""}`,
          style: {
            "--accent": ft.accent,
            "--surface": ft.surface,
            "--timeline-bg": ft.timeline || "#181920",
            "--toolbar-bg": ft.toolbar || "#191a23",
            "--app-bg": ft.background ? `url(${ft.background})` : "none",
          },
        },
        r.createElement("input", {
          ref: xl,
          type: "file",
          accept: ".framia,.duo,.json",
          hidden: !0,
          onChange: (i) => {
            (er(i.target.files[0]), (i.target.value = ""));
          },
        }),
        r.createElement("input", {
          ref: Fa,
          type: "file",
          accept: "image/*",
          hidden: !0,
          onChange: (i) => Fc(i.target.files[0]),
        }),
        r.createElement("input", {
          ref: qi,
          type: "file",
          accept: "audio/*",
          hidden: !0,
          onChange: (i) => $c(i.target.files[0], "audio"),
        }),
        r.createElement("input", {
          ref: Yi,
          type: "file",
          accept: "video/*",
          hidden: !0,
          onChange: (i) => $c(i.target.files[0], "video"),
        }),
        r.createElement("input", {
          ref: Al,
          type: "file",
          accept: "image/*",
          hidden: !0,
          onChange: async (i) => {
            let s = i.target.files[0];
            if (!s) return;
            let h = await new Promise((R) => {
                let U = new FileReader();
                ((U.onload = () => R(U.result)), U.readAsDataURL(s));
              }),
              y = { id: Ke(), name: s.name, src: h };
            (qn((R) => [...R, y]), Sl(y), He(H.brush, s.name));
          },
        }),
        r.createElement("input", {
          ref: Zc,
          type: "file",
          accept: "image/*",
          hidden: !0,
          onChange: async (i) => {
            let s = i.target.files[0];
            if (!s) return;
            let h = await new Promise((y) => {
              let R = new FileReader();
              ((R.onload = () => y(R.result)), R.readAsDataURL(s));
            });
            Qa((y) => ({ ...y, background: h }));
          },
        }),
        r.createElement(
          "div",
          { className: "media-deck", "aria-hidden": "true" },
          z.clips.map((i) =>
            i.type === "video"
              ? r.createElement("video", {
                  key: i.id,
                  ref: (s) => {
                    s ? Ja.current.set(i.id, s) : Ja.current.delete(i.id);
                  },
                  src: ji[i.mediaId] || i.url || "",
                  preload: "auto",
                  playsInline: !0,
                  onLoadedData: () => kn((s) => s + 1),
                  onSeeked: () => kn((s) => s + 1),
                })
              : r.createElement("audio", {
                  key: i.id,
                  ref: (s) => {
                    s ? Ja.current.set(i.id, s) : Ja.current.delete(i.id);
                  },
                  src: ji[i.mediaId] || i.url || "",
                  preload: "auto",
                }),
          ),
        ),
        r.createElement(
          "header",
          { className: "topbar" },
          r.createElement(
            "button",
            { className: "brand", onClick: Xo, title: xt.home },
            r.createElement(
              "span",
              { className: "brand-mark" },
              r.createElement("img", {
                src: "/brand/framia-logo.webp",
                alt: "",
              }),
            ),
            r.createElement(
              "span",
              null,
              "framia",
              r.createElement("span", { className: "brand-dot" }, "."),
            ),
          ),
          r.createElement("div", { className: "top-divider" }),
          r.createElement(
            "div",
            { className: "menu" },
            r.createElement("button", { onClick: () => Ve("file") }, H.file),
            r.createElement("button", { onClick: () => Ve("edit") }, H.edit),
            r.createElement(
              "button",
              { onClick: () => Ve("settings") },
              H.project,
            ),
            r.createElement("button", { onClick: () => Ve("view") }, H.view),
          ),
          r.createElement(
            "div",
            { className: "project-title", onClick: () => Ve("settings") },
            r.createElement("span", { className: "project-dot" }),
            z.name,
            r.createElement(hp, { size: 13 }),
          ),
          r.createElement(
            "div",
            { className: "top-actions" },
            r.createElement(
              "button",
              { className: "session room-trigger", onClick: () => Ve("room") },
              r.createElement(mm, { size: 13 }),
              nl ? `${nl} · ${Ri}` : "Criar ou entrar em sala",
            ),
            r.createElement(
              "span",
              { className: `autosave-status ${yt}` },
              r.createElement(im, { size: 13 }),
              yt === "saving"
                ? xt.saving
                : yt === "error"
                  ? xt.failed
                  : xt.autosave,
            ),
            renderAccountControl(),
            r.createElement(
              "button",
              { className: "icon-button", title: "Undo Ctrl+Z", onClick: Uu },
              r.createElement(S1, { size: 16 }),
            ),
            r.createElement(
              "button",
              {
                className: "icon-button",
                title: "Redo Ctrl+Shift+Z",
                onClick: ol,
              },
              r.createElement(g1, { size: 16 }),
            ),
            r.createElement("span", { className: "top-divider" }),
            r.createElement(
              "button",
              { className: "top-action", onClick: Fn },
              r.createElement(Uc, { size: 15 }),
              H.save,
            ),
            r.createElement(
              "button",
              { className: "top-action primary", onClick: () => Ve("export") },
              r.createElement(To, { size: 15 }),
              H.export,
            ),
          ),
        ),
        r.createElement(
          "div",
          { className: "workspace" },
          r.createElement(
            "nav",
            { className: "toolrail" },
            r.createElement(
              "div",
              { className: "rail-group" },
              Lu.map(([i, s, h, y]) =>
                r.createElement(
                  "button",
                  {
                    key: s,
                    className: `tool ${pe === s ? "active" : ""}`,
                    title: `${h} (${(shortcuts[s] || y).toUpperCase()})`,
                    onClick: () => selectTool(s),
                  },
                  r.createElement(i, { size: 18, strokeWidth: 1.8 }),
                  r.createElement(
                    "kbd",
                    null,
                    (shortcuts[s] || y).toUpperCase(),
                  ),
                ),
              ),
            ),
            r.createElement("div", { className: "rail-spacer" }),
            r.createElement(
              "div",
              { className: "rail-group" },
              r.createElement(
                "button",
                {
                  className: "tool",
                  title: H.image,
                  onClick: () => Fa.current.click(),
                },
                r.createElement(Ni, { size: 19 }),
              ),
              r.createElement(
                "button",
                {
                  className: "tool",
                  title: H.shortcuts,
                  onClick: () => Ve("shortcuts"),
                },
                r.createElement(zp, { size: 19 }),
              ),
              r.createElement(
                "button",
                {
                  className: "tool",
                  title: H.settings,
                  onClick: () => Ve("settings"),
                },
                r.createElement(sm, { size: 19 }),
              ),
            ),
          ),
          r.createElement(
            "main",
            { className: "main-area" },
            r.createElement(
              "div",
              { className: "canvas-toolbar" },
              r.createElement(
                "div",
                { className: "canvas-left" },
                r.createElement(
                  "span",
                  { className: "eyebrow" },
                  H.canvas,
                  " / ",
                  P + 1,
                  " de ",
                  z.frames.length,
                ),
                r.createElement("span", { className: "toolbar-sep" }),
                r.createElement(
                  "span",
                  { className: "resolution-text" },
                  z.width,
                  " × ",
                  z.height,
                ),
              ),
              r.createElement(
                "div",
                { className: "canvas-controls" },
                r.createElement(
                  "button",
                  {
                    className: `mini-toggle ${Yt ? "on" : ""}`,
                    onClick: () => ga((i) => !i),
                  },
                  r.createElement(Mi, { size: 14 }),
                  H.onion,
                ),
                r.createElement(
                  "button",
                  {
                    className: "mini-toggle",
                    onClick: () => Ve("onion"),
                    title: H.settings,
                  },
                  r.createElement(sm, { size: 14 }),
                ),
                r.createElement(
                  "button",
                  {
                    className: `mini-toggle ${noteVisible ? "on" : ""}`,
                    title: H.notes,
                    "aria-pressed": noteVisible,
                    onClick: () => setNoteVisible((i) => !i),
                  },
                  r.createElement(NoteIcon, { size: 14 }),
                  H.notes,
                ),
                noteStrokes.length > 0 &&
                  r.createElement(
                    "button",
                    {
                      className: "mini-icon",
                      title: H.clearNotes,
                      "aria-label": H.clearNotes,
                      onClick: clearNotes,
                    },
                    r.createElement(Hc, { size: 14 }),
                  ),
                r.createElement("span", { className: "toolbar-sep" }),
                r.createElement(
                  "button",
                  {
                    className: `mini-icon ${z.grid ? "on" : ""}`,
                    title:
                      Me === "en"
                        ? "Toggle grid"
                        : Me === "es"
                          ? "Mostrar cuadrícula"
                          : "Mostrar grade",
                    onClick: () => De((i) => (i.grid = !i.grid)),
                  },
                  r.createElement(v1, { size: 15 }),
                ),
                r.createElement(
                  "button",
                  {
                    className: "mini-icon",
                    title: "Reduzir zoom",
                    "aria-label": "Reduzir zoom",
                    onClick: () =>
                      Gu(
                        xe - 10,
                        sa.current.getBoundingClientRect().left +
                          sa.current.clientWidth / 2,
                        sa.current.getBoundingClientRect().top +
                          sa.current.clientHeight / 2,
                      ),
                  },
                  r.createElement(T1, { size: 16 }),
                ),
                r.createElement("span", { className: "zoom-value" }, Math.round(xe), "%"),
                r.createElement(
                  "button",
                  {
                    className: "mini-icon",
                    title: "Aumentar zoom",
                    "aria-label": "Aumentar zoom",
                    onClick: () =>
                      Gu(
                        xe + 10,
                        sa.current.getBoundingClientRect().left +
                          sa.current.clientWidth / 2,
                        sa.current.getBoundingClientRect().top +
                          sa.current.clientHeight / 2,
                      ),
                  },
                  r.createElement(z1, { size: 16 }),
                ),
                r.createElement(
                  "button",
                  {
                    className: "mini-toggle",
                    onClick: () => {
                      (ke(70), N({ x: 0, y: 0 }));
                    },
                  },
                  H.reset,
                ),
                r.createElement(
                  "button",
                  {
                    className: "mini-icon",
                    title: H.full + " (Tab)",
                    onClick: () => Ft((i) => !i),
                  },
                  r.createElement(Mo, { size: 15 }),
                ),
              ),
            ),
            r.createElement(
              "div",
              {
                className: "canvas-viewport",
                ref: sa,
              },
              r.createElement("div", { className: "canvas-grid" }),
              r.createElement(
                "div",
                {
                  className: "paper-shadow",
                  style: {
                    width: `${Math.round((Math.min(1e3, z.width) * xe) / 100)}px`,
                    aspectRatio: `${z.width}/${z.height}`,
                    transform: `translate(${b.x}px, ${b.y}px)`,
                  },
                },
                z.grid &&
                  !$t &&
                  r.createElement("div", {
                    className: "canvas-guides",
                    style: {
                      backgroundSize: `${100 / Rt(Math.round(z.gridSize || 12), 2, 64)}% ${100 / Rt(Math.round(z.gridSize || 12), 2, 64)}%`,
                    },
                  }),
                !$t &&
                  (z.guides || []).length > 0 &&
                  r.createElement(
                    "div",
                    { className: "guide-layer" },
                    (z.guides || [])
                      .filter((i) => i.kind === "circle" || i.kind === "rect")
                      .map((i) =>
                        r.createElement(
                          "div",
                          {
                            key: i.id,
                            className: `guide-shape ${i.kind}`,
                            style: {
                              left: `${(i.x ?? 0.2) * 100}%`,
                              top: `${(i.y ?? 0.2) * 100}%`,
                              width: `${(i.w ?? 0.6) * 100}%`,
                              height: `${(i.h ?? 0.6) * 100}%`,
                            },
                            title:
                              Me === "en"
                                ? "Drag to move, corner resizes, double-click removes"
                                : Me === "es"
                                  ? "Arrastra para mover, esquina redimensiona, doble clic quita"
                                  : "Arraste para mover, canto redimensiona, clique duplo remove",
                            onPointerDown: (s) => moveGuideShape(s, i),
                            onDoubleClick: () => removeGuide(i.id),
                          },
                          r.createElement("span", {
                            className: "guide-shape-knob",
                            onPointerDown: (s) => resizeGuideShape(s, i),
                          }),
                        ),
                      ),
                    (z.guides || [])
                      .filter((i) => i.kind !== "circle" && i.kind !== "rect")
                      .map((i) =>
                      r.createElement(
                        "div",
                        {
                          key: i.id,
                          className: `guide-line ${i.axis === "x" ? "vertical" : "horizontal"}`,
                          style:
                            i.axis === "x"
                              ? {
                                  left: `${i.pos * 100}%`,
                                  top: `${(i.from ?? 0) * 100}%`,
                                  height: `${((i.to ?? 1) - (i.from ?? 0)) * 100}%`,
                                }
                              : {
                                  top: `${i.pos * 100}%`,
                                  left: `${(i.from ?? 0) * 100}%`,
                                  width: `${((i.to ?? 1) - (i.from ?? 0)) * 100}%`,
                                },
                          title:
                            Me === "en"
                              ? "Drag to move, ends resize, double-click to remove"
                              : Me === "es"
                                ? "Arrastra para mover, extremos alargan, doble clic para quitar"
                                : "Arraste para mover, pontas alongam, clique duplo remove",
                          onPointerDown: (s) => moveGuide(s, i),
                          onDoubleClick: () => removeGuide(i.id),
                        },
                        r.createElement("span", {
                          className: "guide-knob start",
                          onPointerDown: (s) => resizeGuide(s, i, "from"),
                          onDoubleClick: () => {},
                        }),
                        r.createElement("span", {
                          className: "guide-knob end",
                          onPointerDown: (s) => resizeGuide(s, i, "to"),
                          onDoubleClick: () => {},
                        }),
                      ),
                    ),
                  ),
                r.createElement("canvas", {
                  ref: Cl,
                  className: "drawing-canvas",
                  onPointerDown: Gt,
                  onPointerMove: $a,
                  onPointerUp: an,
                  onPointerCancel: an,
                }),
                r.createElement("canvas", {
                  ref: noteRef,
                  className: `annotation-canvas${pe === "note" ? " drawing" : ""}${noteVisible ? "" : " hidden"}`,
                  onPointerDown: notePointerDown,
                  onPointerMove: notePointerMove,
                  onPointerUp: notePointerUp,
                  onPointerCancel: notePointerUp,
                }),
                fpsOpen &&
                  r.createElement(
                    "div",
                    { className: "fps-panel" },
                    r.createElement(
                      "div",
                      { className: "fps-panel-head" },
                      r.createElement("b", null, renderFps, " FPS"),
                      r.createElement(
                        "button",
                        {
                          type: "button",
                          className: "fps-close",
                          "aria-label": "Fechar painel de FPS",
                          onClick: () => setFpsOpen(!1),
                        },
                        "×",
                      ),
                    ),
                    r.createElement(
                      "small",
                      null,
                      "Renderização ao vivo · projeto ",
                      z.fps,
                      " FPS",
                    ),
                    z.clips.filter((i) => i.type === "video").length === 0
                      ? r.createElement("small", null, "Nenhum vídeo importado.")
                      : z.clips
                          .filter((i) => i.type === "video")
                          .slice(0, 4)
                          .map((i) =>
                            r.createElement(
                              "small",
                              { key: i.id, className: "fps-video-row" },
                              r.createElement("span", null, i.name || "Vídeo"),
                              r.createElement(
                                "span",
                                null,
                                Math.round(i.duration * 100) / 100,
                                "s de vídeo no projeto",
                              ),
                            ),
                          ),
                    r.createElement(
                      "button",
                      {
                        type: "button",
                        className: "ghost-button",
                        onClick: () => Ve("settings"),
                      },
                      "Ajustar FPS do projeto",
                    ),
                  ),
                nl &&
                  Object.entries(rc).map(([i, s]) =>
                    r.createElement(
                      "div",
                      {
                        key: i,
                        className: "remote-cursor",
                        style: {
                          left: `${(s.x / z.width) * 100}%`,
                          top: `${(s.y / z.height) * 100}%`,
                        },
                      },
                      r.createElement("span", {
                        className: "remote-cursor-dot",
                      }),
                      r.createElement(
                        "span",
                        { className: "remote-cursor-name" },
                        s.name || "Colaborador",
                      ),
                    ),
                  ),
                pe === "transform" &&
                  r.createElement(
                    "svg",
                    {
                      className: "transform-overlay",
                      viewBox: `0 0 ${z.width} ${z.height}`,
                    },
                    r.createElement(D1, {
                      box: M == null ? void 0 : M.box,
                      transform: $e,
                      scale: z.width / ((Math.min(1e3, z.width) * xe) / 100),
                      onStart: Hu,
                      onMove: $a,
                      onEnd: an,
                    }),
                    q &&
                      r.createElement("rect", {
                        className: "transform-marquee",
                        x: q.x,
                        y: q.y,
                        width: q.w,
                        height: q.h,
                      }),
                  ),
                r.createElement(
                  "svg",
                  {
                    className: "transform-overlay remote-transform-overlay",
                    viewBox: `0 0 ${z.width} ${z.height}`,
                  },
                  Object.entries(Z)
                    .filter(
                      ([, i]) =>
                        i.projectId === z.id &&
                        i.frameId === (ze == null ? void 0 : ze.id),
                    )
                    .map(([i, s]) =>
                      r.createElement(D1, {
                        key: i,
                        box: s.box,
                        transform: s.transform,
                        remote: !0,
                        scale: z.width / ((Math.min(1e3, z.width) * xe) / 100),
                      }),
                    ),
                ),
              ),
              r.createElement(
                "div",
                { className: "canvas-corner-label" },
                z.width,
                " × ",
                z.height,
                " px ",
                r.createElement("span", null, "•"),
                " ",
                Math.round(xe),
                "%",
              ),
            ),
          ),
          Tl &&
            r.createElement(
              "aside",
              { className: "right-panel" },
              r.createElement(
                "div",
                { className: "panel-heading" },
                r.createElement("span", null, "INSPECTOR"),
                r.createElement(
                  "button",
                  { className: "plain-icon", onClick: () => wu(!1) },
                  r.createElement(wp, { size: 16 }),
                ),
              ),
              r.createElement(
                "div",
                { className: "panel-tabs" },
                r.createElement(
                  "button",
                  {
                    className: ie === "properties" ? "active" : "",
                    onClick: () => ve("properties"),
                  },
                  H.brush,
                ),
                r.createElement(
                  "button",
                  {
                    className: ie === "layers" ? "active" : "",
                    onClick: () => ve("layers"),
                  },
                  H.layers,
                ),
              ),
              ie === "properties"
                ? r.createElement(
                    "div",
                    { className: "panel-scroll" },
                    r.createElement(
                      "section",
                      { className: "inspector-section" },
                      r.createElement(
                        "div",
                        { className: "section-heading" },
                        r.createElement(
                          "span",
                          null,
                          pe === "transform" ? H.transform : H.brush,
                        ),
                        r.createElement(
                          "button",
                          {
                            className: "text-link",
                            onClick: () => Ve("brushes"),
                          },
                          H.brushes,
                          r.createElement(y1, { size: 13 }),
                        ),
                      ),
                      r.createElement(
                        "div",
                        { className: "brush-preview" },
                        r.createElement(
                          "svg",
                          {
                            viewBox: "0 0 250 50",
                            preserveAspectRatio: "none",
                          },
                          r.createElement("path", {
                            d: "M10 30 C55 8, 95 42, 145 21 S205 15, 240 24",
                            fill: "none",
                            stroke: ct,
                            strokeWidth: Math.max(3, Ae / 3),
                            strokeLinecap: "round",
                          }),
                        ),
                      ),
                      r.createElement(
                        "div",
                        { className: "brush-name" },
                        (lt == null ? void 0 : lt.name) || "Studio Ink",
                        " ",
                        r.createElement(
                          "span",
                          null,
                          lt ? H.stamp : "BRUSH 01",
                        ),
                      ),
                      r.createElement(
                        "div",
                        { className: "field-label" },
                        r.createElement("span", null, H.size),
                        r.createElement("input", {
                          className: "size-input",
                          type: "number",
                          min: "1",
                          max: "1000",
                          value: Ae,
                          onChange: (i) =>
                            J(Rt(Math.round(+i.target.value) || 1, 1, 1000)),
                        }),
                      ),
                      r.createElement("input", {
                        type: "range",
                        min: "1",
                        max: "1000",
                        value: Math.min(1000, Ae),
                        onChange: (i) => J(+i.target.value),
                      }),
                      r.createElement(
                        "div",
                        { className: "field-label" },
                        r.createElement("span", null, H.opacity),
                        r.createElement("strong", null, re, "%"),
                      ),
                      r.createElement("input", {
                        type: "range",
                        min: "1",
                        max: "100",
                        value: re,
                        onChange: (i) => ye(+i.target.value),
                      }),
                      lt &&
                        r.createElement(
                          r.Fragment,
                          null,
                          r.createElement(
                            "div",
                            { className: "field-label" },
                            r.createElement("span", null, H.spacing),
                            r.createElement("strong", null, Yn, "%"),
                          ),
                          r.createElement("input", {
                            type: "range",
                            min: "5",
                            max: "150",
                            value: Yn,
                            onChange: (i) => zu(+i.target.value),
                          }),
                          r.createElement(
                            "div",
                            { className: "field-label" },
                            r.createElement("span", null, H.rotation),
                            r.createElement("strong", null, wi, "°"),
                          ),
                          r.createElement("input", {
                            type: "range",
                            min: "0",
                            max: "360",
                            value: wi,
                            onChange: (i) => Ro(+i.target.value),
                          }),
                        ),
                    ),
                    r.createElement(
                      "section",
                      { className: "inspector-section" },
                      r.createElement(
                        "div",
                        { className: "section-heading" },
                        r.createElement("span", null, H.color),
                        r.createElement(om, { size: 15 }),
                      ),
                      r.createElement(
                        "div",
                        { className: "color-control" },
                        r.createElement("input", {
                          type: "color",
                          value: ct,
                          onChange: (i) => Fe(i.target.value),
                        }),
                        r.createElement("input", {
                          value: ct.toUpperCase(),
                          onChange: (i) =>
                            /^#[0-9a-fA-F]{0,6}$/.test(i.target.value) &&
                            Fe(i.target.value),
                        }),
                      ),
                      r.createElement(
                        "div",
                        { className: "swatches" },
                        lg.map((i) =>
                          r.createElement("button", {
                            key: i,
                            style: { background: i },
                            onClick: () => Fe(i),
                            className: ct === i ? "selected" : "",
                          }),
                        ),
                      ),
                    ),
                    r.createElement(
                      "section",
                      { className: "inspector-section" },
                      r.createElement(
                        "div",
                        { className: "section-heading" },
                        r.createElement("span", null, H.symmetry),
                      ),
                      r.createElement(
                        "div",
                        { className: "option-grid" },
                        ["none", "horizontal", "vertical", "both"].map((i) =>
                          r.createElement(
                            "button",
                            {
                              key: i,
                              className: we === i ? "selected" : "",
                              onClick: () => Ge(i),
                            },
                            H[i],
                          ),
                        ),
                      ),
                    ),
                    pe === "transform" &&
                      r.createElement(
                        "section",
                        { className: "inspector-section transform-panel" },
                        r.createElement(
                          "div",
                          { className: "section-heading" },
                          H.transform,
                        ),
                        r.createElement(
                          "div",
                          { className: "option-grid" },
                          r.createElement(
                            "button",
                            {
                              className: p === "content" ? "selected" : "",
                              onClick: () => {
                                (Ra(), j("content"));
                              },
                            },
                            H.selected,
                          ),
                          r.createElement(
                            "button",
                            {
                              className: p === "layer" ? "selected" : "",
                              onClick: () => {
                                (j("layer"), Zn());
                              },
                            },
                            H.layers,
                          ),
                        ),
                        r.createElement(
                          "p",
                          { className: "transform-hint" },
                          Me === "en"
                            ? "Click a stroke to take it whole; drag a box to take and cut whatever it covers. Shift-click adds or removes. Ctrl+G groups, Ctrl+Shift+G ungroups. Enter applies the transform, Esc cancels."
                            : "Clique em um traço pega ele inteiro; arraste uma caixa para pegar e recortar o que ela cobre. Shift soma ou tira da seleção. Ctrl+G agrupa, Ctrl+Shift+G desagrupa. Enter aplica, Esc cancela.",
                        ),
                        r.createElement(
                          "button",
                          { className: "subtle-wide", onClick: Zn },
                          H.layers,
                          ": ",
                          Ue.name,
                        ),
                        M &&
                          r.createElement(
                            r.Fragment,
                            null,
                            r.createElement(
                              "div",
                              { className: "transform-actions" },
                              r.createElement(
                                "button",
                                {
                                  title: H.rotation,
                                  onClick: () =>
                                    rt((i) => ({
                                      ...i,
                                      rotation:
                                        (((i == null ? void 0 : i.rotation) ||
                                          0) +
                                          90) %
                                        360,
                                    })),
                                },
                                r.createElement(E1, { size: 15 }),
                                "90°",
                              ),
                              r.createElement(
                                "button",
                                {
                                  title: "Flip horizontal",
                                  onClick: () =>
                                    rt((i) => ({
                                      ...i,
                                      flipX: !(i != null && i.flipX),
                                    })),
                                },
                                r.createElement(bp, { size: 15 }),
                              ),
                              r.createElement(
                                "button",
                                {
                                  title: "Flip vertical",
                                  onClick: () =>
                                    rt((i) => ({
                                      ...i,
                                      flipY: !(i != null && i.flipY),
                                    })),
                                },
                                r.createElement(Sp, { size: 15 }),
                              ),
                            ),
                            [
                              ["sx", H.size + " X"],
                              ["sy", H.size + " Y"],
                            ].map(([i, s]) =>
                              r.createElement(
                                "label",
                                { className: "field-label", key: i },
                                s,
                                r.createElement("input", {
                                  "aria-label": s,
                                  type: "number",
                                  min: "1",
                                  max: "1000",
                                  value: Math.round(
                                    (($e == null ? void 0 : $e[i]) ?? 1) * 100,
                                  ),
                                  onChange: (h) =>
                                    rt((y) => ({
                                      ...y,
                                      [i]: Rt(+h.target.value, 1, 1e3) / 100,
                                    })),
                                }),
                                "%",
                              ),
                            ),
                            r.createElement(
                              "label",
                              { className: "field-label" },
                              H.rotation,
                              r.createElement("input", {
                                "aria-label": H.rotation,
                                type: "number",
                                value: Math.round(
                                  ($e == null ? void 0 : $e.rotation) || 0,
                                ),
                                onChange: (i) =>
                                  rt((s) => ({
                                    ...s,
                                    rotation: +i.target.value,
                                  })),
                              }),
                            ),
                            r.createElement(
                              "div",
                              { className: "option-grid" },
                              r.createElement(
                                "button",
                                { onClick: Kn },
                                H.copy,
                              ),
                              r.createElement(
                                "button",
                                { onClick: Jn },
                                H.paste,
                              ),
                            ),
                            r.createElement(
                              "div",
                              { className: "option-grid" },
                              r.createElement(
                                "button",
                                { onClick: groupSelection, title: "Ctrl+G" },
                                H.group,
                              ),
                              r.createElement(
                                "button",
                                {
                                  onClick: ungroupSelection,
                                  title: "Ctrl+Shift+G",
                                },
                                H.ungroup,
                              ),
                            ),
                            r.createElement(
                              "button",
                              { className: "wide-primary", onClick: Gi },
                              r.createElement(im, { size: 15 }),
                              H.confirm,
                            ),
                            r.createElement(
                              "button",
                              { className: "subtle-wide", onClick: Ra },
                              H.cancel,
                              " · Esc",
                            ),
                          ),
                      ),
                  )
                : r.createElement(
                    "div",
                    { className: "panel-scroll" },
                    r.createElement(
                      "section",
                      { className: "inspector-section" },
                      r.createElement(
                        "div",
                        { className: "section-heading" },
                        r.createElement(
                          "span",
                          null,
                          H.layers,
                          " ",
                          r.createElement("em", null, z.layers.length),
                        ),
                        r.createElement(
                          "button",
                          { className: "text-link", onClick: Kc },
                          r.createElement(_c, { size: 14 }),
                          H.addLayer,
                        ),
                      ),
                      r.createElement(
                        "div",
                        { className: "layer-list" },
                        z.layers
                          .slice()
                          .reverse()
                          .map((i) =>
                            r.createElement(
                              "div",
                              {
                                key: i.id,
                                className: `layer-row ${ee === i.id ? "selected" : ""}`,
                                onClick: () => {
                                  (Ra(), Ee(i.id));
                                },
                              },
                              r.createElement(
                                "span",
                                { className: "layer-thumb" },
                                r.createElement(Mi, { size: 16 }),
                              ),
                              r.createElement(
                                "span",
                                { className: "layer-info" },
                                r.createElement("b", null, i.name),
                                r.createElement(
                                  "small",
                                  null,
                                  i.blend,
                                  " · ",
                                  Math.round(i.opacity * 100),
                                  "%",
                                ),
                              ),
                              r.createElement(
                                "button",
                                {
                                  onClick: (s) => {
                                    (s.stopPropagation(),
                                      De((h) => {
                                        h.layers.find(
                                          (y) => y.id === i.id,
                                        ).visible = !i.visible;
                                      }));
                                  },
                                },
                                i.visible
                                  ? r.createElement(Ep, { size: 15 })
                                  : r.createElement(gp, { size: 15 }),
                              ),
                              r.createElement(
                                "button",
                                {
                                  onClick: (s) => {
                                    (s.stopPropagation(),
                                      De((h) => {
                                        h.layers.find(
                                          (y) => y.id === i.id,
                                        ).locked = !i.locked;
                                      }));
                                  },
                                },
                                i.locked
                                  ? r.createElement(Np, { size: 14 })
                                  : r.createElement(Tp, { size: 14 }),
                              ),
                            ),
                          ),
                      ),
                      r.createElement(
                        "div",
                        { className: "layer-tools" },
                        r.createElement(
                          "button",
                          {
                            title:
                              Me === "en"
                                ? "Move layer up"
                                : Me === "es"
                                  ? "Subir capa"
                                  : "Mover camada para cima",
                            "aria-label":
                              Me === "en"
                                ? "Move layer up"
                                : Me === "es"
                                  ? "Subir capa"
                                  : "Mover camada para cima",
                            disabled: ee === z.layers[z.layers.length - 1].id,
                            onClick: () => moveLayer(1),
                          },
                          "\u2191",
                        ),
                        r.createElement(
                          "button",
                          {
                            title:
                              Me === "en"
                                ? "Move layer down"
                                : Me === "es"
                                  ? "Bajar capa"
                                  : "Mover camada para baixo",
                            "aria-label":
                              Me === "en"
                                ? "Move layer down"
                                : Me === "es"
                                  ? "Bajar capa"
                                  : "Mover camada para baixo",
                            disabled: ee === z.layers[0].id,
                            onClick: () => moveLayer(-1),
                          },
                          "\u2193",
                        ),
                        r.createElement(
                          "button",
                          {
                            className: "wide",
                            disabled: ee === z.layers[0].id,
                            onClick: () => mergeLayer("down"),
                          },
                          Me === "en"
                            ? "Merge down"
                            : Me === "es"
                              ? "Combinar abajo"
                              : "Mesclar abaixo",
                        ),
                        r.createElement(
                          "button",
                          {
                            className: "wide",
                            disabled: ee === z.layers[z.layers.length - 1].id,
                            onClick: () => mergeLayer("up"),
                          },
                          Me === "en"
                            ? "Merge up"
                            : Me === "es"
                              ? "Combinar arriba"
                              : "Mesclar acima",
                        ),
                      ),
                      r.createElement(
                        "div",
                        { className: "field-label" },
                        r.createElement("span", null, H.opacity),
                        r.createElement(
                          "strong",
                          null,
                          Math.round(Ue.opacity * 100),
                          "%",
                        ),
                      ),
                      r.createElement("input", {
                        type: "range",
                        min: "0",
                        max: "100",
                        value: Ue.opacity * 100,
                        onChange: (i) => Jc("opacity", +i.target.value / 100),
                      }),
                      r.createElement(
                        "div",
                        { className: "field-label" },
                        r.createElement("span", null, "Blend mode"),
                      ),
                      r.createElement(
                        "select",
                        {
                          value: Ue.blend,
                          onChange: (i) => Jc("blend", i.target.value),
                        },
                        ng.map((i) =>
                          r.createElement("option", { value: i, key: i }, i),
                        ),
                      ),
                      r.createElement(
                        "button",
                        {
                          className: "subtle-wide",
                          onClick: () => {
                            z.layers.length !== 1 &&
                              (De((i) => {
                                i.layers = i.layers.filter((s) => s.id !== ee);
                                for (let s of i.frames)
                                  delete i.content[s.id][ee];
                              }),
                              Ee(z.layers.find((i) => i.id !== ee).id));
                          },
                        },
                        r.createElement(Hc, { size: 14 }),
                        H.delete,
                      ),
                    ),
                  ),
              r.createElement(
                "div",
                { className: "panel-footer" },
                r.createElement(
                  "button",
                  { onClick: () => ve("layers") },
                  r.createElement(Mi, { size: 15 }),
                  z.layers.length,
                  " ",
                  H.layers,
                ),
                r.createElement("span", null, z.width, " × ", z.height),
              ),
            ),
          !Tl &&
            !ka &&
            r.createElement(
              "button",
              {
                className: "reopen-panel",
                title: "Abrir painel lateral",
                "aria-label": "Abrir painel lateral",
                onClick: () => wu(!0),
              },
              r.createElement(Op, { size: 16 }),
            ),
        ),
        r.createElement(
          "div",
          { className: "bottom-area", style: { height: Gc } },
          r.createElement("div", {
            className: "timeline-resize",
            title:
              Me === "en"
                ? "Drag to resize timeline"
                : Me === "es"
                  ? "Arrastra para cambiar el tamaño"
                  : "Arraste para mudar a altura da timeline",
            onPointerDown: (i) => {
              const s = i.currentTarget,
                h = i.clientY,
                y = Gc;
              (s.setPointerCapture(i.pointerId),
                (s.onpointermove = (R) =>
                  Uo(Rt(y + h - R.clientY, 165, window.innerHeight - 150))),
                (s.onpointerup = () => {
                  ((s.onpointermove = null), (s.onpointerup = null));
                }));
            },
          }),
          r.createElement(
            "div",
            { className: "transport" },
            r.createElement(
              "div",
              { className: "transport-left" },
              r.createElement(
                "button",
                {
                  className: "icon-button",
                  title: "Voltar ao início",
                  "aria-label": "Voltar ao início",
                  onClick: () => F(0),
                },
                r.createElement(Hp, { size: 16 }),
              ),
              r.createElement(
                "button",
                {
                  className: "play-button",
                  title: $t ? "Pausar (Espaço)" : "Reproduzir (Espaço)",
                  "aria-label": $t ? "Pausar" : "Reproduzir",
                  onClick: () => Aa((i) => !i),
                },
                $t
                  ? r.createElement(Dp, { size: 17, fill: "currentColor" })
                  : r.createElement(_p, { size: 17, fill: "currentColor" }),
              ),
              r.createElement(
                "button",
                {
                  className: "icon-button",
                  title: "Ir para o fim",
                  "aria-label": "Ir para o fim",
                  onClick: () => F(Ti(z.frames, z.frames.length - 1) / z.fps),
                },
                r.createElement(Bp, { size: 16 }),
              ),
              r.createElement(
                "span",
                { className: "time-readout" },
                String(Math.floor(K / 60)).padStart(2, "0"),
                ":",
                String(Math.floor(K % 60)).padStart(2, "0"),
                ":",
                String(Math.floor(K * z.fps) % z.fps).padStart(2, "0"),
              ),
              r.createElement(
                "span",
                { className: "frame-count" },
                P >= 0 ? P + 1 : "—",
                " / ",
                z.frames.length,
              ),
              r.createElement("span", { className: "transport-sep" }),
              r.createElement(
                "button",
                {
                  type: "button",
                  className: fpsOpen ? "fps-label open" : "fps-label",
                  title: "Painel de FPS",
                  "aria-label": "Painel de FPS",
                  "aria-pressed": fpsOpen,
                  onClick: () => setFpsOpen((i) => !i),
                },
                z.fps,
                " FPS",
              ),
            ),
            r.createElement(
              "div",
              { className: "transport-right" },
              r.createElement(
                "button",
                { onClick: () => Ve("settings") },
                r.createElement(sm, { size: 15 }),
                H.project,
              ),
              r.createElement(
                "button",
                { onClick: () => Tu((i) => !i) },
                r.createElement(cm, { size: 15 }),
                H.chat,
                Nu.length > 0 && r.createElement("i", null),
              ),
              r.createElement(
                "button",
                { onClick: () => Ft((i) => !i) },
                r.createElement(Mo, { size: 15 }),
                H.full,
              ),
            ),
          ),
          r.createElement(
            "div",
            { className: "timeline-head" },
            r.createElement(
              "div",
              { className: "timeline-label" },
              r.createElement(No, { size: 15 }),
              r.createElement("span", null, H.timeline),
            ),
            r.createElement(
              "div",
              {
                className: "timeline-ruler",
                ref: Wl,
                onMouseMove: (i) => Ki(i, i.currentTarget),
                onMouseLeave: () => Ut(null),
                onPointerDown: nr,
              },
              r.createElement(
                "div",
                {
                  className: "ruler-inner",
                  style: { width: nn * ma },
                },
                Array.from(
                  { length: Math.min(900, Math.ceil(nn / z.fps) + 1) },
                  (i, s) =>
                    r.createElement(
                      "div",
                      {
                        key: `s${s}`,
                        className: "ruler-mark",
                        style: { left: s * _a },
                      },
                      r.createElement("i", null),
                      r.createElement("span", null, framiaTime(s)),
                    ),
                ),
                Array.from(
                  { length: Math.min(2000, Math.floor(nn / rulerStep) + 1) },
                  (i, s) => {
                    const h = s * rulerStep;
                    return h % z.fps === 0
                      ? null
                      : r.createElement("i", {
                          key: `f${h}`,
                          className: "ruler-mini",
                          style: { left: h * ma },
                        });
                  },
                ),
              ),
            ),
            r.createElement(
              "div",
              { className: "timeline-zoom" },
              r.createElement(
                "button",
                {
                  title: "Menos zoom na timeline",
                  "aria-label": "Menos zoom na timeline",
                  onClick: () => Oi((i) => Rt(i - 0.15, 0.08, 12)),
                },
                r.createElement(T1, { size: 14 }),
              ),
              r.createElement(
                "button",
                {
                  title: "Mais zoom na timeline",
                  "aria-label": "Mais zoom na timeline",
                  onClick: () => Oi((i) => Rt(i + 0.15, 0.08, 12)),
                },
                r.createElement(z1, { size: 14 }),
              ),
            ),
          ),
          r.createElement(
            "div",
            { className: "timeline-content" },
            r.createElement(
              "div",
              { className: "track-labels" },
              r.createElement(
                "div",
                { className: "track-name" },
                r.createElement(Mi, { size: 14 }),
                "Animação",
              ),
              r.createElement(
                "div",
                { className: "track-name" },
                r.createElement(rm, { size: 14 }),
                H.audio,
              ),
              r.createElement(
                "div",
                { className: "track-name" },
                r.createElement(No, { size: 14 }),
                H.video,
              ),
            ),
            r.createElement(
              "div",
              {
                className: "tracks",
                ref: Ru,
                onMouseMove: (i) => Ki(i, i.currentTarget),
                onMouseLeave: () => Ut(null),
                onScroll: (i) => {
                  Wl.current &&
                    (Wl.current.scrollLeft = i.currentTarget.scrollLeft);
                },
              },
              r.createElement("div", {
                className: "playhead",
                style: { left: K * _a },
              }),
              Et !== null &&
                r.createElement(
                  "div",
                  { className: "timeline-hover", style: { left: Et * ma } },
                  r.createElement("span", null, framiaTime(Et / z.fps)),
                ),
              r.createElement(
                "div",
                {
                  className: "frame-track",
                  style: { width: nn * ma },
                  onClick: (i) => {
                    i.target === i.currentTarget &&
                      F(
                        Math.max(
                          0,
                          (i.clientX -
                            i.currentTarget.getBoundingClientRect().left) /
                            _a,
                        ),
                      );
                  },
                  onDragOver: (i) => i.preventDefault(),
                  onDrop: (i) => {
                    (i.preventDefault(),
                      Yo(
                        i.dataTransfer.getData("text/plain"),
                        Math.round(
                          ((i.clientX -
                            i.currentTarget.getBoundingClientRect().left) /
                            ma) *
                            4,
                        ) / 4,
                      ));
                  },
                },
                $n.map((i, s) =>
                  r.createElement(
                    "button",
                    {
                      key: i.id,
                      "data-frame-id": i.id,
                      className: `frame-cell ${i.id === (ze == null ? void 0 : ze.id) ? "selected" : ""} ${v ? "frame-preview" : ""}`,
                      style: { left: i.start * ma, width: ma * Jt(i) },
                      onPointerDown: (h) => Zi(h, i),
                      onClick: () => {
                        if (g.current) {
                          g.current = !1;
                          return;
                        }
                        (ta(null), F(i.start / z.fps));
                      },
                    },
                    r.createElement(
                      "span",
                      { className: "frame-index" },
                      String(s + 1).padStart(2, "0"),
                    ),
                    r.createElement(
                      "span",
                      { className: "frame-mini" },
                      r.createElement(
                        "svg",
                        { viewBox: "0 0 32 20" },
                        r.createElement("path", {
                          d: "M2 15 C9 3 17 18 29 6",
                          stroke: "#ae9cff",
                          strokeWidth: "2",
                          fill: "none",
                        }),
                      ),
                    ),
                    Jt(i) !== 1 &&
                      r.createElement(
                        "span",
                        { className: "frame-duration" },
                        fv(Jt(i)),
                        "f",
                      ),
                    r.createElement("span", {
                      className: "frame-trim left",
                      title: H.trimming,
                      onPointerDown: (h) => Zi(h, i, "left"),
                    }),
                    r.createElement("span", {
                      className: "frame-trim right",
                      title: H.trimming,
                      onPointerDown: (h) => Zi(h, i, "right"),
                    }),
                  ),
                ),
              ),
              ["audio", "video"].map((i) =>
                r.createElement(
                  "div",
                  {
                    className: "media-track",
                    key: i,
                    style: { width: nn * ma },
                  },
                  z.clips
                    .filter((s) => s.type === i)
                    .map((s) =>
                      r.createElement(
                        "div",
                        {
                          key: s.id,
                          className: `clip ${s.type} ${Tt === s.id ? "selected" : ""}`,
                          style: { left: s.start * _a, width: s.duration * _a },
                          onClick: () => ta(s.id),
                          onPointerDown: (h) => {
                            if (h.target.classList.contains("trim")) return;
                            let y = h.clientX,
                              R = s.start;
                            (h.currentTarget.setPointerCapture(h.pointerId),
                              (h.currentTarget.onpointermove = (U) => {
                                let X = (U.clientX - y) / _a;
                                h.currentTarget.style.left = `${Math.max(0, R + X) * _a}px`;
                              }),
                              (h.currentTarget.onpointerup = (U) => {
                                let X = (U.clientX - y) / _a;
                                (De(
                                  ($) =>
                                    ($.clips.find(
                                      (se) => se.id === s.id,
                                    ).start = Math.max(0, R + X)),
                                ),
                                  (h.currentTarget.onpointermove = null),
                                  (h.currentTarget.onpointerup = null));
                              }));
                          },
                        },
                        r.createElement("span", {
                          className: "trim left",
                          onPointerDown: (h) => {
                            h.stopPropagation();
                            let y = h.clientX;
                            (h.currentTarget.setPointerCapture(h.pointerId),
                              (h.currentTarget.onpointerup = (R) => {
                                (Ic(s.id, "left", R.clientX - y),
                                  (h.currentTarget.onpointerup = null));
                              }));
                          },
                        }),
                        i === "audio"
                          ? r.createElement(rm, { size: 13 })
                          : r.createElement(No, { size: 13 }),
                        r.createElement(
                          "span",
                          { className: "clip-name" },
                          s.name,
                        ),
                        r.createElement("span", {
                          className: "trim right",
                          onPointerDown: (h) => {
                            h.stopPropagation();
                            let y = h.clientX;
                            (h.currentTarget.setPointerCapture(h.pointerId),
                              (h.currentTarget.onpointerup = (R) => {
                                (Ic(s.id, "right", R.clientX - y),
                                  (h.currentTarget.onpointerup = null));
                              }));
                          },
                        }),
                      ),
                    ),
                ),
              ),
            ),
          ),
          r.createElement(
            "div",
            { className: "timeline-actions" },
            r.createElement(
              "div",
              { className: "action-group" },
              r.createElement(
                "button",
                { onClick: () => ln(!1) },
                r.createElement(_c, { size: 14 }),
                H.newFrame,
              ),
              r.createElement(
                "button",
                { onClick: () => ln(!0) },
                r.createElement(zo, { size: 14 }),
                H.duplicate,
              ),
              r.createElement(
                "button",
                { onClick: ju },
                r.createElement(Hc, { size: 14 }),
                H.delete,
              ),
              r.createElement("span", { className: "action-sep" }),
              r.createElement(
                "button",
                { className: Tt ? "emphasis" : "", onClick: qo },
                r.createElement(b1, { size: 14 }),
                H.split,
              ),
              Tt &&
                r.createElement(
                  "button",
                  {
                    onClick: () => {
                      (De(
                        (i) => (i.clips = i.clips.filter((s) => s.id !== Tt)),
                      ),
                        ta(null));
                    },
                  },
                  r.createElement(Hc, { size: 14 }),
                  H.delete,
                  " clip",
                ),
            ),
            r.createElement(
              "div",
              { className: "action-group" },
              r.createElement(
                "button",
                { onClick: () => Fa.current.click() },
                r.createElement(Ni, { size: 14 }),
                H.image,
              ),
              r.createElement(
                "button",
                { onClick: () => qi.current.click() },
                r.createElement(rm, { size: 14 }),
                H.audio,
              ),
              r.createElement(
                "button",
                { onClick: () => Yi.current.click() },
                r.createElement(No, { size: 14 }),
                H.video,
              ),
              r.createElement("span", { className: "action-sep" }),
              r.createElement(
                "button",
                { className: Yt ? "active" : "", onClick: () => ga((i) => !i) },
                r.createElement(Mi, { size: 14 }),
                H.onion,
              ),
            ),
          ),
        ),
        ka &&
          r.createElement(
            r.Fragment,
            null,
            r.createElement(
              "button",
              {
                className: "canvas-tools-button",
                onClick: () => Qe((i) => !i),
              },
              r.createElement(v1, { size: 17 }),
              Me === "en"
                ? "Tools"
                : Me === "es"
                  ? "Herramientas"
                  : "Ferramentas",
              " ",
              r.createElement(
                "span",
                null,
                (ur = Lu.find((i) => i[1] === pe)) == null ? void 0 : ur[3],
              ),
            ),
            gt &&
              r.createElement(
                "div",
                { className: "canvas-tools-menu" },
                Lu.map(([i, s, h, y]) =>
                  r.createElement(
                    "button",
                    {
                      key: s,
                      className: pe === s ? "active" : "",
                      onClick: () => {
                        (selectTool(s), Qe(!1));
                      },
                    },
                    r.createElement(i, { size: 17 }),
                    r.createElement("span", null, h),
                    r.createElement(
                      "kbd",
                      null,
                      (shortcuts[s] || y).toUpperCase(),
                    ),
                  ),
                ),
                r.createElement(
                  "button",
                  {
                    onClick: () => {
                      (Ve("brushes"), Qe(!1));
                    },
                  },
                  r.createElement(um, { size: 17 }),
                  r.createElement("span", null, H.brushes),
                ),
              ),
            r.createElement(
              "button",
              { className: "exit-canvas-only", onClick: () => Ft(!1) },
              r.createElement(Mo, { size: 15 }),
              " Tab",
            ),
          ),
        ea &&
          !ka &&
          r.createElement(
            "div",
            { className: "chat-panel" },
            r.createElement(
              "div",
              { className: "chat-head" },
              r.createElement(
                "div",
                null,
                r.createElement(cm, { size: 17 }),
                r.createElement("b", null, H.chat),
                r.createElement("small", null, nl ? `Sala ${nl}` : H.collab),
              ),
              r.createElement(
                "button",
                { onClick: () => Tu(!1) },
                r.createElement(dm, { size: 17 }),
              ),
            ),
            r.createElement(
              "div",
              { className: "chat-messages" },
              Nu.length === 0
                ? r.createElement(
                    "div",
                    { className: "empty-chat" },
                    r.createElement(cm, { size: 28 }),
                    r.createElement("b", null, H.chat),
                    r.createElement("p", null, H.chatEmpty),
                  )
                : Nu.map((i) =>
                    r.createElement(
                      "div",
                      { className: "chat-message", key: i.id },
                      i.avatar
                        ? r.createElement("img", {
                            className: "chat-avatar",
                            src: i.avatar,
                            alt: "",
                          })
                        : r.createElement(
                            "span",
                            { className: "chat-avatar chat-avatar-fallback" },
                            (i.name || "?").slice(0, 1).toUpperCase(),
                          ),
                      r.createElement(
                        "div",
                        { className: "chat-message-body" },
                        r.createElement(
                          "b",
                          {
                            className: i.senderId ? "chat-author" : "",
                            onClick: i.senderId
                              ? () => openProfile(i.senderId)
                              : void 0,
                          },
                          i.name,
                          i.username &&
                            r.createElement("small", null, " @", i.username),
                        ),
                        r.createElement("p", null, i.text),
                      ),
                    ),
                  ),
            ),
            r.createElement(
              "div",
              { className: "reaction-bar" },
              ["❤️", "👏", "🔥", "✨", "👍", "🎉"].map((i) =>
                r.createElement("button", { key: i, onClick: () => Qo(i) }, i),
              ),
            ),
            r.createElement(
              "div",
              { className: "chat-input" },
              r.createElement("input", {
                placeholder: `${H.message} · use :sob:`,
                value: Ql,
                list: "framia-emoji-names",
                onChange: (i) => Lc(i.target.value),
                onKeyDown: (i) => (i.key === "Enter" ? ar() : i.key === "Tab" && setEmojiOpen(!1)),
              }),
              r.createElement(
                "datalist",
                { id: "framia-emoji-names" },
                Object.entries(EMOJI_NAMES).map(([i, s]) =>
                  r.createElement("option", { key: i, value: `:${i}:` }, `${s} ${i}`),
                ),
              ),
              r.createElement(
                "button",
                {
                  type: "button",
                  className: emojiOpen ? "emoji-toggle open" : "emoji-toggle",
                  title: "Emojis",
                  "aria-label": "Emojis",
                  "aria-expanded": emojiOpen,
                  onClick: () => setEmojiOpen((i) => !i),
                },
                "😀",
              ),
              r.createElement(
                "button",
                { onClick: ar },
                r.createElement(Up, { size: 16 }),
              ),
            ),
            emojiOpen &&
              r.createElement(
                "div",
                { className: "emoji-picker" },
                r.createElement("small", null, "Digite :nome: para converter automaticamente"),
                r.createElement(
                  "div",
                  { className: "emoji-grid" },
                  Object.entries(EMOJI_NAMES).map(([i, s]) =>
                    r.createElement(
                      "button",
                      {
                        key: i,
                        type: "button",
                        title: `:${i}:`,
                        onClick: () => {
                          (Lc((h) => `${h}${s}`), setEmojiOpen(!1));
                        },
                      },
                      s,
                    ),
                  ),
                ),
              ),
          ),
        _o.map((i) =>
          r.createElement(
            "div",
            {
              key: i.id,
              className: "floating-reaction",
              style: { left: `${i.x}%` },
            },
            i.emoji,
          ),
        ),
        ca &&
          r.createElement(
            "div",
            {
              className: "toast",
              onClick: () => {
                var i;
                ((i = ca.action) == null || i.call(ca), Cu(null));
              },
            },
            r.createElement(h1, { size: 17 }),
            r.createElement(
              "div",
              null,
              r.createElement("b", null, ca.title),
              ca.body && r.createElement("p", null, ca.body),
            ),
            r.createElement(
              "button",
              {
                onClick: (i) => {
                  (i.stopPropagation(), Cu(null));
                },
              },
              r.createElement(dm, { size: 15 }),
            ),
          ),
        Oe &&
          r.createElement(
            "div",
            {
              className: "modal-backdrop",
              onMouseDown: (i) => i.target === i.currentTarget && Ve(""),
            },
            r.createElement(
              "div",
              { className: "modal" },
              r.createElement(
                "div",
                { className: "modal-head" },
                r.createElement(
                  "div",
                  null,
                  r.createElement(
                    "span",
                    { className: "modal-kicker" },
                    "FRAMIA STUDIO",
                  ),
                  r.createElement(
                    "h2",
                    null,
                    Oe === "room"
                      ? "Sala multiplayer"
                      : Oe === "settings"
                        ? H.project
                        : Oe === "onion"
                          ? H.onion
                          : Oe === "brushes"
                            ? H.brushes
                            : Oe === "shortcuts"
                              ? H.shortcuts
                              : Oe === "theme"
                                ? H.theme
                                : Oe === "export"
                                  ? H.export
                                  : Oe === "file"
                                    ? H.file
                                    : Oe === "edit"
                                      ? H.edit
                                      : Oe === "language"
                                        ? H.language
                                        : H.view,
                  ),
                ),
                r.createElement(
                  "button",
                  { onClick: () => Ve("") },
                  r.createElement(dm, { size: 20 }),
                ),
              ),
              Oe === "profile"
                ? profileModalBody
                : Oe === "shortcuts"
                ? r.createElement(
                    "div",
                    { className: "modal-body shortcuts-list" },
                    Lu.map(([, i, s]) =>
                      r.createElement(
                        "div",
                        { key: i },
                        r.createElement("span", null, s),
                        r.createElement(
                          "kbd",
                          {
                            className: "shortcut-key",
                            tabIndex: 0,
                            role: "button",
                            title: "Clique e pressione a tecla desejada",
                            "aria-label": `${s}: atalho atual`,
                            onKeyDown: (h) => {
                              (h.preventDefault(), h.stopPropagation());
                              const y = h.key.toLowerCase();
                              if (h.key === "Escape" || h.key === "Tab" || h.key === "Enter") return;
                              if (!/^[a-z0-9]$/.test(y)) return;
                              setShortcuts((R) => {
                                const U = { ...R };
                                for (const X of Object.keys(U)) if (U[X] === y) U[X] = R[i];
                                return ((U[i] = y), saveShortcuts(U));
                              });
                            },
                          },
                          (shortcuts[i] || "").toUpperCase(),
                        ),
                      ),
                    ),
                    r.createElement(
                      "button",
                      {
                        type: "button",
                        className: "ghost-button",
                        onClick: () => setShortcuts(saveShortcuts({ ...SHORTCUT_DEFAULTS })),
                      },
                      "Restaurar atalhos padrão",
                    ),
                    [
                      ["P", H.brushes],
                      ["[ / ]", H.size],
                      ["Espaço", "Reproduzir / pausar"],
                      ["Ctrl+Z / Ctrl+Y", "Desfazer / refazer"],
                      ["Delete", "Excluir seleção"],
                      ["Ctrl+D", "Duplicar seleção"],
                      ["Ctrl+C / Ctrl+V", "Copiar / colar"],
                      ["Tab", "Modo só tela"],
                      ["Esc", "Fechar painel"],
                    ].map(([i, s]) =>
                      r.createElement(
                        "div",
                        { key: i },
                        r.createElement("span", null, s),
                        r.createElement("kbd", null, i),
                      ),
                    ),
                  )
                : Oe === "room"
                  ? r.createElement(
                      "div",
                      { className: "modal-body room-modal" },
                      r.createElement(
                        "p",
                        null,
                        "Desenhe e edite o mesmo projeto com outras pessoas. Cada participante escolhe seu próprio quadro e tempo.",
                      ),
                      nl
                        ? r.createElement(
                            r.Fragment,
                            null,
                            r.createElement(
                              "div",
                              { className: "room-code" },
                              r.createElement("b", null, nl),
                              r.createElement(
                                "button",
                                {
                                  onClick: async () => {
                                    const invite = `${location.origin}${location.pathname}?room=${encodeURIComponent(nl)}`;
                                    try {
                                      await copyText(invite);
                                      He("Link copiado", "Quem tiver o link pode pedir entrada nesta sala.");
                                    } catch (i) {
                                      He("Não foi possível copiar", i.message);
                                    }
                                  },
                                },
                                r.createElement(zo, { size: 15 }),
                                " Copiar convite",
                              ),
                            ),
                            r.createElement(
                              "small",
                              null,
                              Vc.length,
                              Vc.length === 1 ? " conexão · " : " conexões · ",
                              Ri,
                            ),
                            r.createElement(
                              "button",
                              { className: "subtle-wide", onClick: Yq },
                              "Sair da sala",
                            ),
                          )
                        : r.createElement(
                            r.Fragment,
                            null,
                            r.createElement(
                              "a",
                              {
                                className: "room-signin",
                                href: "/auth/freebuff/signin?returnTo=/",
                              },
                              Mt
                                ? `Conectado como ${Mt.name}`
                                : "Entrar com Freebuff para colaborar",
                            ),
                            r.createElement(
                              "button",
                              { className: "wide-primary", onClick: ko },
                              r.createElement(mm, { size: 16 }),
                              " Criar sala com este projeto",
                            ),
                            r.createElement(
                              "div",
                              { className: "room-join" },
                              r.createElement("input", {
                                value: zl,
                                maxLength: 8,
                                placeholder: "Código da sala",
                                onChange: (i) =>
                                  Ln(i.target.value.toUpperCase()),
                              }),
                              r.createElement(
                                "button",
                                {
                                  onClick: tr,
                                  disabled: ![6, 8].includes(zl.trim().length),
                                },
                                "Entrar",
                              ),
                            ),
                          ),
                    )
                  : Oe === "settings"
                    ? r.createElement(
                        "div",
                        { className: "modal-body" },
                        r.createElement(
                          "label",
                          null,
                          H.project,
                          r.createElement("input", {
                            value: z.name,
                            onChange: (i) =>
                              De((s) => (s.name = i.target.value)),
                          }),
                        ),
                        r.createElement(
                          "div",
                          { className: "section-heading" },
                          r.createElement("span", null, H.resolution),
                        ),
                        r.createElement(
                          "div",
                          { className: "preset-grid" },
                          [
                            [1920, 1080, "Full HD"],
                            [1280, 720, "HD"],
                            [1080, 1080, "Square"],
                            [1080, 1920, "Vertical"],
                            [2048, 2048, "2K"],
                          ].map(([i, s, h]) =>
                            r.createElement(
                              "button",
                              {
                                key: h,
                                className:
                                  z.width === i && z.height === s
                                    ? "selected"
                                    : "",
                                onClick: () =>
                                  De((y) => {
                                    ((y.width = i), (y.height = s));
                                  }),
                              },
                              r.createElement("b", null, h),
                              r.createElement("small", null, i, " × ", s),
                            ),
                          ),
                        ),
                        r.createElement(
                          "div",
                          { className: "two-fields" },
                          r.createElement(
                            "label",
                            null,
                            H.width,
                            r.createElement("input", {
                              type: "number",
                              min: "64",
                              max: "8192",
                              value: z.width,
                              onChange: (i) =>
                                De(
                                  (s) =>
                                    (s.width = Rt(+i.target.value, 64, 8192)),
                                ),
                            }),
                          ),
                          r.createElement(
                            "label",
                            null,
                            H.height,
                            r.createElement("input", {
                              type: "number",
                              min: "64",
                              max: "8192",
                              value: z.height,
                              onChange: (i) =>
                                De(
                                  (s) =>
                                    (s.height = Rt(+i.target.value, 64, 8192)),
                                ),
                            }),
                          ),
                        ),
                        r.createElement(
                          "label",
                          null,
                          H.fps,
                          r.createElement("input", {
                            type: "number",
                            min: "1",
                            max: "60",
                            value: z.fps,
                            onChange: (i) =>
                              De((s) => (s.fps = Rt(+i.target.value, 1, 60))),
                          }),
                        ),
                        r.createElement(
                          "div",
                          { className: "switch-row" },
                          r.createElement(
                            "span",
                            null,
                            Me === "en"
                              ? "Loop animation"
                              : Me === "es"
                                ? "Repetir animaci\u00f3n"
                                : "Repetir anima\u00e7\u00e3o",
                          ),
                          r.createElement("input", {
                            type: "checkbox",
                            checked: z.loop !== !1,
                            onChange: (i) =>
                              De((s) => (s.loop = i.target.checked)),
                          }),
                        ),
                        r.createElement(
                          "div",
                          { className: "switch-row" },
                          r.createElement(
                            "span",
                            null,
                            Me === "en"
                              ? "Show grid"
                              : Me === "es"
                                ? "Mostrar cuadr\u00edcula"
                                : "Mostrar grade",
                          ),
                          r.createElement("input", {
                            type: "checkbox",
                            checked: !!z.grid,
                            onChange: (i) =>
                              De((s) => (s.grid = i.target.checked)),
                          }),
                        ),
                        z.grid &&
                          r.createElement(
                            "label",
                            null,
                            Me === "en"
                              ? "Grid divisions"
                              : Me === "es"
                                ? "Divisiones de la cuadr\u00edcula"
                                : "Divis\u00f5es da grade",
                            r.createElement("input", {
                              type: "number",
                              min: "2",
                              max: "64",
                              value: z.gridSize || 12,
                              onChange: (i) =>
                                De(
                                  (s) =>
                                    (s.gridSize = Rt(
                                      Math.round(+i.target.value) || 12,
                                      2,
                                      64,
                                    )),
                                ),
                            }),
                          ),
                        r.createElement(
                          "div",
                          { className: "guide-row" },
                          r.createElement(
                            "span",
                            null,
                            Me === "en"
                              ? "Guides"
                              : Me === "es"
                                ? "Guías"
                                : "Guias",
                          ),
                          r.createElement(
                            "button",
                            {
                              type: "button",
                              className: "ghost-button",
                              onClick: () => addGuide("x"),
                            },
                            Me === "en"
                              ? "+ Vertical"
                              : Me === "es"
                                ? "+ Vertical"
                                : "+ Vertical",
                          ),
                          r.createElement(
                            "button",
                            {
                              type: "button",
                              className: "ghost-button",
                              onClick: () => addGuide("y"),
                            },
                            Me === "en"
                              ? "+ Horizontal"
                              : Me === "es"
                                ? "+ Horizontal"
                                : "+ Horizontal",
                          ),
                            r.createElement(
                              "button",
                              {
                                type: "button",
                                className: "ghost-button",
                                title: "Guia circular",
                                onClick: () => addGuideShape("circle"),
                              },
                              "+ Círculo",
                            ),
                            r.createElement(
                              "button",
                              {
                                type: "button",
                                className: "ghost-button",
                                title: "Guia retangular",
                                onClick: () => addGuideShape("rect"),
                              },
                              "+ Retângulo",
                            ),
                          (z.guides || []).length > 0 &&
                            r.createElement(
                              "button",
                              {
                                type: "button",
                                className: "ghost-button",
                                onClick: () =>
                                  De((i) => {
                                    i.guides = [];
                                  }),
                              },
                              Me === "en"
                                ? "Clear"
                                : Me === "es"
                                  ? "Borrar"
                                  : "Limpar",
                            ),
                        ),
                        r.createElement(
                          "label",
                          null,
                          Me === "en"
                            ? "Canvas background"
                            : Me === "es"
                              ? "Fondo del lienzo"
                              : "Fundo da tela",
                          r.createElement("input", {
                            type: "color",
                            value: z.background || "#ffffff",
                            onChange: (i) =>
                              De((s) => (s.background = i.target.value)),
                          }),
                        ),
                        r.createElement(
                          "div",
                          { className: "modal-note" },
                          H.resolution,
                          ": ",
                          z.width,
                          " × ",
                          z.height,
                          " · ",
                          (z.width / z.height).toFixed(2),
                          ":1",
                        ),
                      )
                    : Oe === "onion"
                      ? r.createElement(
                          "div",
                          { className: "modal-body" },
                          r.createElement(
                            "div",
                            { className: "switch-row" },
                            r.createElement("span", null, H.onion),
                            r.createElement("input", {
                              type: "checkbox",
                              checked: Yt,
                              onChange: (i) => ga(i.target.checked),
                            }),
                          ),
                          r.createElement(
                            "div",
                            { className: "two-fields" },
                            r.createElement(
                              "label",
                              null,
                              H.previous,
                              r.createElement("input", {
                                type: "number",
                                min: "0",
                                max: "8",
                                value: xa,
                                onChange: (i) => T(Rt(+i.target.value, 0, 8)),
                              }),
                            ),
                            r.createElement(
                              "label",
                              null,
                              H.next,
                              r.createElement("input", {
                                type: "number",
                                min: "0",
                                max: "8",
                                value: Q,
                                onChange: (i) => fe(Rt(+i.target.value, 0, 8)),
                              }),
                            ),
                          ),
                          r.createElement(
                            "label",
                            null,
                            H.opacity,
                            " · ",
                            ce,
                            "%",
                            r.createElement("input", {
                              type: "range",
                              min: "1",
                              max: "70",
                              value: ce,
                              onChange: (i) => Ye(+i.target.value),
                            }),
                          ),
                          r.createElement(
                            "div",
                            { className: "modal-note" },
                            H.previous,
                            ": ",
                            r.createElement(
                              "span",
                              { style: { color: "#f36083" } },
                              "●",
                            ),
                            "   ",
                            H.next,
                            ": ",
                            r.createElement(
                              "span",
                              { style: { color: "#54bfe9" } },
                              "●",
                            ),
                          ),
                          r.createElement(
                            "div",
                            { className: "section-heading" },
                            r.createElement("span", null, Ue.name),
                          ),
                          r.createElement(
                            "div",
                            { className: "switch-row" },
                            r.createElement("span", null, H.previous),
                            r.createElement("input", {
                              type: "checkbox",
                              checked:
                                ((ir = Ue.onion) == null
                                  ? void 0
                                  : ir.previous) !== !1,
                              onChange: (i) =>
                                De((s) => {
                                  let h = s.layers.find((y) => y.id === ee);
                                  h.onion = {
                                    ...h.onion,
                                    previous: i.target.checked,
                                  };
                                }),
                            }),
                          ),
                          r.createElement(
                            "div",
                            { className: "switch-row" },
                            r.createElement("span", null, H.next),
                            r.createElement("input", {
                              type: "checkbox",
                              checked:
                                ((cr = Ue.onion) == null ? void 0 : cr.next) !==
                                !1,
                              onChange: (i) =>
                                De((s) => {
                                  let h = s.layers.find((y) => y.id === ee);
                                  h.onion = {
                                    ...h.onion,
                                    next: i.target.checked,
                                  };
                                }),
                            }),
                          ),
                          r.createElement(
                            "label",
                            null,
                            H.opacity,
                            " · ",
                            Math.round(
                              ((($i = Ue.onion) == null
                                ? void 0
                                : $i.opacity) ?? 1) * 100,
                            ),
                            "%",
                            r.createElement("input", {
                              type: "range",
                              min: "0",
                              max: "100",
                              value:
                                (((Ii = Ue.onion) == null
                                  ? void 0
                                  : Ii.opacity) ?? 1) * 100,
                              onChange: (i) =>
                                De((s) => {
                                  let h = s.layers.find((y) => y.id === ee);
                                  h.onion = {
                                    ...h.onion,
                                    opacity: +i.target.value / 100,
                                  };
                                }),
                            }),
                          ),
                          r.createElement(
                            "div",
                            { className: "two-fields" },
                            r.createElement(
                              "label",
                              null,
                              H.previous,
                              " color",
                              r.createElement("input", {
                                type: "color",
                                value:
                                  ((un = Ue.onion) == null
                                    ? void 0
                                    : un.previousColor) || "#f36083",
                                onChange: (i) =>
                                  De((s) => {
                                    let h = s.layers.find((y) => y.id === ee);
                                    h.onion = {
                                      ...h.onion,
                                      previousColor: i.target.value,
                                    };
                                  }),
                              }),
                            ),
                            r.createElement(
                              "label",
                              null,
                              H.next,
                              " color",
                              r.createElement("input", {
                                type: "color",
                                value:
                                  ((cn = Ue.onion) == null
                                    ? void 0
                                    : cn.nextColor) || "#54bfe9",
                                onChange: (i) =>
                                  De((s) => {
                                    let h = s.layers.find((y) => y.id === ee);
                                    h.onion = {
                                      ...h.onion,
                                      nextColor: i.target.value,
                                    };
                                  }),
                              }),
                            ),
                          ),
                        )
                      : Oe === "brushes"
                        ? r.createElement(
                            "div",
                            { className: "modal-body brush-library" },
                            r.createElement("input", {
                              className: "brush-search",
                              value: Zl,
                              onChange: (i) => xu(i.target.value),
                              placeholder:
                                Me === "en"
                                  ? "Search brushes"
                                  : Me === "es"
                                    ? "Buscar pinceles"
                                    : "Buscar pincéis",
                            }),
                            r.createElement(
                              "div",
                              { className: "brush-categories" },
                              Qi.map((i) =>
                                r.createElement(
                                  "button",
                                  {
                                    key: i,
                                    className: Kl === i ? "selected" : "",
                                    onClick: () => {
                                      (Ka(i), Lt(null));
                                    },
                                  },
                                  i,
                                ),
                              ),
                            ),
                            r.createElement(
                              "div",
                              { className: "brush-list" },
                              r.createElement(
                                "button",
                                {
                                  className: lt ? "" : "selected",
                                  onClick: () => lr(null),
                                },
                                r.createElement(um, { size: 19 }),
                                r.createElement(
                                  "span",
                                  null,
                                  r.createElement("b", null, "Studio Ink"),
                                  r.createElement(
                                    "small",
                                    null,
                                    "Pincel padrão",
                                  ),
                                ),
                              ),
                              Zo.filter(
                                (i) =>
                                  (i.group === Kl || Zl) &&
                                  i.name
                                    .toLowerCase()
                                    .includes(Zl.toLowerCase()),
                              ).map((i) =>
                                r.createElement(
                                  "div",
                                  { className: "brush-card", key: i.id },
                                  r.createElement(
                                    "button",
                                    {
                                      className:
                                        (lt == null ? void 0 : lt.id) === i.id
                                          ? "selected"
                                          : "",
                                      onClick: () => lr(i),
                                    },
                                    r.createElement(C1, { brush: i }),
                                    r.createElement(
                                      "span",
                                      null,
                                      r.createElement("b", null, i.name),
                                      r.createElement(
                                        "small",
                                        null,
                                        i.size || 8,
                                        "px · ",
                                        i.type === "erase"
                                          ? "Borracha"
                                          : i.type === "smudge"
                                            ? "Mistura"
                                            : "Pintura",
                                      ),
                                    ),
                                  ),
                                  r.createElement(
                                    "button",
                                    {
                                      className: "brush-edit-button",
                                      title: `Editar ${i.name}`,
                                      onClick: () =>
                                        Lt({
                                          ...i,
                                          id: i.preset ? Ke() : i.id,
                                          preset: !1,
                                          name: i.preset
                                            ? `${i.name} (personalizado)`
                                            : i.name,
                                          group: "Meus pincéis",
                                        }),
                                    },
                                    r.createElement(jp, { size: 16 }),
                                  ),
                                ),
                              ),
                            ),
                            Nt &&
                              r.createElement(
                                "div",
                                { className: "brush-editor" },
                                r.createElement(
                                  "h3",
                                  null,
                                  "Personalizar pincel",
                                ),
                                r.createElement(C1, { brush: Nt }),
                                r.createElement(
                                  "label",
                                  null,
                                  "Nome",
                                  r.createElement("input", {
                                    value: Nt.name,
                                    onChange: (i) =>
                                      Lt((s) => ({
                                        ...s,
                                        name: i.target.value,
                                      })),
                                  }),
                                ),
                                r.createElement(
                                  "div",
                                  { className: "brush-fields" },
                                  [
                                    ["size", "Tamanho", 1, 1000, 1],
                                    ["opacity", "Opacidade", 0, 1, 0.01],
                                    ["spacing", "Espaçamento", 0.01, 1, 0.01],
                                    ["hardness", "Dureza", 0, 1, 0.01],
                                    ["flow", "Fluxo", 0, 1, 0.01],
                                    ["scatter", "Dispersão", 0, 2, 0.01],
                                    ["angle", "Rotação", -180, 180, 1],
                                    ["roundness", "Formato", 0.1, 1, 0.01],
                                    ["textureDepth", "Textura", 0, 1, 0.01],
                                    ["stabilizer", "Estabilização", 0, 1, 0.01],
                                  ].map(([i, s, h, y, R]) =>
                                    r.createElement(
                                      "label",
                                      { key: i },
                                      s,
                                      " · ",
                                      Nt[i] ??
                                        (i === "opacity" ||
                                        i === "flow" ||
                                        i === "roundness"
                                          ? 1
                                          : 0),
                                      r.createElement("input", {
                                        type: "range",
                                        min: h,
                                        max: y,
                                        step: R,
                                        value:
                                          Nt[i] ??
                                          (i === "opacity" ||
                                          i === "flow" ||
                                          i === "roundness"
                                            ? 1
                                            : 0),
                                        onChange: (U) =>
                                          Lt((X) => ({
                                            ...X,
                                            [i]: +U.target.value,
                                          })),
                                      }),
                                    ),
                                  ),
                                ),
                                r.createElement(
                                  "div",
                                  { className: "two-fields" },
                                  r.createElement(
                                    "label",
                                    null,
                                    "Tipo",
                                    r.createElement(
                                      "select",
                                      {
                                        value: Nt.type || "paint",
                                        onChange: (i) =>
                                          Lt((s) => ({
                                            ...s,
                                            type: i.target.value,
                                          })),
                                      },
                                      r.createElement(
                                        "option",
                                        { value: "paint" },
                                        "Pincel",
                                      ),
                                      r.createElement(
                                        "option",
                                        { value: "erase" },
                                        "Borracha",
                                      ),
                                      r.createElement(
                                        "option",
                                        { value: "smudge" },
                                        "Esfumar",
                                      ),
                                    ),
                                  ),
                                  r.createElement(
                                    "label",
                                    null,
                                    "Ponta",
                                    r.createElement(
                                      "select",
                                      {
                                        value: Nt.tip || "round",
                                        onChange: (i) =>
                                          Lt((s) => ({
                                            ...s,
                                            tip: i.target.value,
                                          })),
                                      },
                                      r.createElement(
                                        "option",
                                        { value: "round" },
                                        "Redonda",
                                      ),
                                      r.createElement(
                                        "option",
                                        { value: "square" },
                                        "Quadrada",
                                      ),
                                    ),
                                  ),
                                  r.createElement(
                                    "label",
                                    null,
                                    "Textura",
                                    r.createElement(
                                      "select",
                                      {
                                        value: Nt.texture || "",
                                        onChange: (i) =>
                                          Lt((s) => ({
                                            ...s,
                                            texture: i.target.value,
                                          })),
                                      },
                                      [
                                        "",
                                        "grain",
                                        "paper",
                                        "canvas",
                                        "chalk",
                                        "dots",
                                      ].map((i) =>
                                        r.createElement(
                                          "option",
                                          { key: i, value: i },
                                          i || "Nenhuma",
                                        ),
                                      ),
                                    ),
                                  ),
                                  r.createElement(
                                    "label",
                                    null,
                                    "Mesclagem",
                                    r.createElement(
                                      "select",
                                      {
                                        value: Nt.blend || "source-over",
                                        onChange: (i) =>
                                          Lt((s) => ({
                                            ...s,
                                            blend: i.target.value,
                                          })),
                                      },
                                      [
                                        "source-over",
                                        "multiply",
                                        "screen",
                                        "overlay",
                                      ].map((i) =>
                                        r.createElement(
                                          "option",
                                          { key: i },
                                          i,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                                r.createElement(
                                  "button",
                                  {
                                    className: "wide-primary",
                                    disabled: !Nt.name.trim(),
                                    onClick: () => {
                                      const i = { ...Nt, name: Nt.name.trim() };
                                      (qn((s) => [
                                        ...s.filter((h) => h.id !== i.id),
                                        i,
                                      ]),
                                        Sl(i),
                                        Ka("Meus pincéis"),
                                        Lt(null));
                                    },
                                  },
                                  r.createElement(Uc, { size: 16 }),
                                  " Salvar pincel",
                                ),
                                ll.some((i) => i.id === Nt.id) &&
                                  r.createElement(
                                    "button",
                                    {
                                      className: "subtle-wide",
                                      onClick: () => {
                                        (qn((i) =>
                                          i.filter((s) => s.id !== Nt.id),
                                        ),
                                          (lt == null ? void 0 : lt.id) ===
                                            Nt.id && Sl(null),
                                          Lt(null));
                                      },
                                    },
                                    r.createElement(Hc, { size: 16 }),
                                    " Excluir pincel",
                                  ),
                              ),
                            r.createElement(
                              "button",
                              {
                                className: "subtle-wide",
                                onClick: () => {
                                  (Lt({
                                    id: Ke(),
                                    name: "Novo pincel",
                                    group: "Meus pincéis",
                                    size: 18,
                                    spacing: 0.06,
                                    hardness: 0.8,
                                    flow: 1,
                                    opacity: 1,
                                    type: Kl === "Borracha" ? "erase" : "paint",
                                  }),
                                    Ka("Meus pincéis"));
                                },
                              },
                              r.createElement(_c, { size: 16 }),
                              " Criar pincel",
                            ),
                            r.createElement(
                              "button",
                              {
                                className: "subtle-wide",
                                onClick: () => Al.current.click(),
                              },
                              r.createElement(Ni, { size: 16 }),
                              H.import,
                              " ",
                              H.brush,
                            ),
                          )
                        : Oe === "theme"
                          ? r.createElement(
                              "div",
                              { className: "modal-body" },
                              r.createElement(
                                "label",
                                null,
                                "Cor principal",
                                r.createElement("input", {
                                  type: "color",
                                  value: ft.accent,
                                  onChange: (i) =>
                                    Qa((s) => ({
                                      ...s,
                                      accent: i.target.value,
                                    })),
                                }),
                              ),
                              r.createElement(
                                "label",
                                null,
                                "Cor dos painéis",
                                r.createElement("input", {
                                  type: "color",
                                  value: ft.surface,
                                  onChange: (i) =>
                                    Qa((s) => ({
                                      ...s,
                                      surface: i.target.value,
                                    })),
                                }),
                              ),
                              r.createElement(
                                "label",
                                null,
                                "Cor da timeline",
                                r.createElement("input", {
                                  type: "color",
                                  value: ft.timeline || "#181920",
                                  onChange: (i) =>
                                    Qa((s) => ({
                                      ...s,
                                      timeline: i.target.value,
                                    })),
                                }),
                              ),
                              r.createElement(
                                "label",
                                null,
                                "Cor das barras",
                                r.createElement("input", {
                                  type: "color",
                                  value: ft.toolbar || "#191a23",
                                  onChange: (i) =>
                                    Qa((s) => ({
                                      ...s,
                                      toolbar: i.target.value,
                                    })),
                                }),
                              ),
                              r.createElement(
                                "button",
                                {
                                  className: "subtle-wide",
                                  onClick: () => {
                                    let i = window.prompt("Nome do tema");
                                    i != null &&
                                      i.trim() &&
                                      Ho((s) => [
                                        ...s,
                                        { ...ft, name: i.trim() },
                                      ]);
                                  },
                                },
                                r.createElement(Uc, { size: 15 }),
                                H.save,
                                " ",
                                H.theme,
                              ),
                              Bi.map((i, s) =>
                                r.createElement(
                                  "button",
                                  {
                                    key: s,
                                    className: "subtle-wide",
                                    onClick: () => Qa(i),
                                  },
                                  r.createElement(om, { size: 15 }),
                                  i.name,
                                ),
                              ),
                              r.createElement(
                                "button",
                                {
                                  className: "subtle-wide",
                                  onClick: () => Zc.current.click(),
                                },
                                r.createElement(Ni, { size: 15 }),
                                H.import,
                                " background",
                              ),
                              r.createElement(
                                "button",
                                {
                                  className: "subtle-wide",
                                  onClick: () =>
                                    Qa({
                                      accent: "#9585ed",
                                      surface: "#1b1d27",
                                      background: "",
                                    }),
                                },
                                r.createElement(E1, { size: 15 }),
                                H.reset,
                              ),
                            )
                          : Oe === "language"
                            ? null
                            : r.createElement(
                                "div",
                                { className: "modal-body menu-list" },
                                (Oe === "export"
                                  ? [
                                      [Ni, "PNG — quadro atual", Lo],
                                      [
                                        To,
                                        "GIF — animação sem áudio",
                                        () => Pc("gif"),
                                      ],
                                      [
                                        To,
                                        "MP4 — sem música (suporte do navegador)",
                                        () => Pc("mp4", !1),
                                      ],
                                      [
                                        To,
                                        "MP4 — com música (suporte do navegador)",
                                        () => Pc("mp4", !0),
                                      ],
                                      [Uc, "Projeto .framia", Fn],
                                    ]
                                  : Oe === "file"
                                    ? [
                                        [fm, H.open, () => xl.current.click()],
                                        [
                                          Ni,
                                          `${H.import} ${H.image}`,
                                          () => Fa.current.click(),
                                        ],
                                        [Uc, H.save, Fn],
                                        [To, H.export, () => Ve("export")],
                                        [
                                          vp,
                                          "Duo Studio recuperado",
                                          () =>
                                            window.open(
                                              "/recovered/duo-studio-original.html",
                                              "_blank",
                                            ),
                                        ],
                                      ]
                                    : Oe === "edit"
                                      ? [
                                          [S1, "Undo", Uu],
                                          [g1, "Redo", ol],
                                          [zo, H.copy, Kn],
                                          [zo, H.paste, Jn],
                                          [b1, H.split, qu],
                                        ]
                                      : [
                                          [om, H.theme, () => Ve("theme")],
                                          [
                                            p1,
                                            H.language,
                                            () => Ve("language"),
                                          ],
                                          [Mi, H.onion, () => Ve("onion")],
                                          [Mo, H.full, () => Ft(!0)],
                                        ]
                                ).map(([i, s, h]) =>
                                  r.createElement(
                                    "button",
                                    {
                                      key: s,
                                      onClick: () => {
                                        (h(),
                                          ((Oe === "file" && s !== H.export) ||
                                            Oe === "edit" ||
                                            s === H.full) &&
                                            Ve(""));
                                      },
                                    },
                                    r.createElement(i, { size: 18 }),
                                    s,
                                    r.createElement(y1, { size: 14 }),
                                  ),
                                ),
                              ),
              Oe === "language" &&
                r.createElement(
                  "div",
                  { className: "modal-body language-options" },
                  [
                    ["pt", "Português"],
                    ["en", "English"],
                    ["es", "Español"],
                  ].map(([i, s]) =>
                    r.createElement(
                      "button",
                      {
                        key: i,
                        onClick: () => {
                          (Ai(i), Ve(""));
                        },
                        className: Me === i ? "selected" : "",
                      },
                      r.createElement(p1, { size: 17 }),
                      s,
                    ),
                  ),
                ),
              r.createElement(
                "div",
                { className: "modal-foot" },
                r.createElement("button", { onClick: () => Ve("") }, H.cancel),
                r.createElement(
                  "button",
                  { className: "primary", onClick: () => Ve("") },
                  H.apply,
                ),
              ),
            ),
          ),
      );
}
sp.createRoot(document.getElementById("root")).render(
  r.createElement(cg, null),
);
