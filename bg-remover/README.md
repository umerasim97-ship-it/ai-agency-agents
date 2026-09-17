# 🖼️ BG Remover — No API, 100% Browser

Remove image backgrounds **entirely inside the browser**. No API keys, no server uploads, no sign-ups, no usage limits, no per-image costs. The AI model runs locally via WebAssembly.

> **Urdu:** Image ka background browser mein hi remove hota hai — koi API nahi, koi upload nahi, koi limit nahi. AI model pehli dafa ~52 MB download hota hai, phir cache se chalta hai.

## ✨ Features

| Feature | Detail |
| --- | --- |
| ✨ **AI Cutout** | ISNet neural network (via `@imgly/background-removal`) — works on people, products, animals, anything |
| 🎨 **Color Key** | Instant chroma-key for solid/studio backgrounds — click the image to pick the color, adjust tolerance |
| 🌈 **Backgrounds** | Transparent, white, black, any custom color, or blurred original |
| 👁 **Compare** | Hold the "Original" button to see before/after |
| 📋 **Export** | Download PNG (full resolution, up to 4096px) or copy to clipboard |
| 🔒 **Private** | Images never leave the device — nothing is uploaded anywhere |
| 💸 **Free** | No API, no billing, no rate limits |

## 🚀 Run

```bash
cd bg-remover
python3 server.py          # serves on http://0.0.0.0:3000
# ya: PORT=8080 python3 server.py
```

Koi build step nahi, koi `npm install` nahi — plain static files hain. Sirf server zaroori hai kyunke ES modules aur WASM ko sahi MIME type chahiye.

## 🧠 How it works

```
index.html + style.css + app.js     → UI (vanilla JS, no framework)
vendor/imgly.mjs                    → @imgly/background-removal@1.4.5 bundled
                                      with onnxruntime-web@1.17.3 (esbuild, single file)
models/                             → ISNet model (quantized, ~42 MB) + ORT wasm
                                      engine chunks + resources.json — all served
                                      same-origin from ./models/
```

- **AI mode**: the library fetches `models/resources.json`, re-assembles the content-addressed chunks, feeds the ONNX model through `onnxruntime-web` (WASM, single-threaded fallback), and returns a full-resolution PNG with alpha.
- **Fast quality** = `models/small` (quint8, ~42 MB, vendored locally — works offline after first load).
- **High quality** = `models/medium` (fp16, ~84 MB) — not vendored (repo size), fetched from `staticimgly.com` CDN on demand. Fallback CDN imports (jsdelivr/esm.sh) are configured in `app.js` in case the local vendor file is missing.

## 📦 Rebuilding the vendor bundle

```bash
npm i @imgly/background-removal@1.4.5 onnxruntime-web@1.17.3 esbuild
echo "export * from '@imgly/background-removal';" > entry.mjs
npx esbuild entry.mjs --bundle --format=esm --platform=browser --minify \
  --outfile=vendor/imgly.mjs
```

## 📄 Licenses

- App code: MIT (same as this repo)
- `@imgly/background-removal`: MIT — © imPLY Studio
- ISNet model weights & onnxruntime-web: see `models/ThirdPartyLicenses.json` and upstream licenses
