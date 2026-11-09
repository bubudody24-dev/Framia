# framia-fill (Rust → WebAssembly)

Núcleo do balde (flood fill + dilatação + crescimento pelas franjas claras) usado
pelo `src/fr.js` quando o wasm carrega; sem wasm o app cai no caminho JavaScript.

Build:

```
bun run build:wasm
```

Isso gera `public/wasm/fill.wasm` (servido como asset estático). O binário é
versionado, então o deploy funciona mesmo sem toolchain Rust na máquina.

Contrato de memória: o chamador aloca `w * h * 4` bytes com `alloc`, escreve os
pixels RGBA, chama `fill` e lê os pixels de volta no mesmo buffer.
