# 🎨 Photoshop "Peace Day Post Kit"

**Ek `.jsx` script jo aapke social post ka poora kaam kar deti hai:** photo frame ke andar
place karna (pic combine), face edit (skin/glow/detail), color grading, outline, aur
1080×1350 PNG + JPG + layered PSD export — sab **ek click** me, batch me bhi.

Template spec (aapke post jaisa): `1080×1350` (4:5), background pure **black `#000000`**,
yellow frame `#FFF200`, andar photo zone.

| File | Kya hai |
|---|---|
| `PeaceDayPost.jsx` | Main script — UI dialog + 11 modules (combine, face, grade, outline, frame, export) |
| `PeaceDay_MeasureZone.jsx` | Helper — aapke frame PNG se PHOTO ZONE auto-measure karke settings file me save karta hai |
| `assets/` | Yahan apna `frame-template.png` / `title-sticker.png` daal dein (optional) |
| `OUTPUT/` | Exports yahan aate hain (created on first run, git-ignored) |

---

## 1. Install (30 second)

**Option A — direct run (roz ke liye best)**
1. Photoshop kholen.
2. `File > Scripts > Browse...`
3. `PeaceDayPost.jsx` select karein → settings dialog khulega → **RUN**.

**Option B — permanent menu entry**
```
Windows: C:\Program Files\Adobe\Adobe Photoshop 2024\Presets\Scripts\
macOS:   /Applications/Adobe Photoshop 2024/Presets/Scripts/
```
`.jsx` ko us folder me copy karein, Photoshop **restart** karein → ab `File > Scripts > PeaceDayPost` 1 click me milega.

**Option C — keyboard shortcut / Action**
- `Edit > Keyboard Shortcuts > Applications Menus > File > Scripts > PeaceDayPost` → `F8` de dein.
- Ya ek Action record karein aur `File > Automate > Batch / Conditional Mode` se chalayen (script dialog ke saath "Include All Files" mode).

> Require: **8-bit RGB** document. CS6 se CC 2025 tak chalta hai. Har risky filter
> `try/catch` me guarded hai — jo API aapke version me na ho wo **skip** ho jati hai aur
> end me "Notes / skipped" me likh kar aa jati hai (script crash nahi karti).

---

## 2. 3 run modes (dialog me "Mode")

| Mode | Kab use karein |
|---|---|
| **pick photos** | Normal kaam: 1–4 photos choose karein → naya 1080×1350 black doc banega, photo frame ke andar fit, retouch + grade + outline, export. |
| **current document** | Photo already open hai (aur shayad face select bhi kiya hai) → usi doc pe face edit + grade + outline + frame + export. `Background` layer skip hoti hai; ek normal raster layer chahiye. |
| **batch folder** | Ek folder ki saari photos → har photo (ya `duo/trio/quad` layout me group) se alag post, sab `OUTPUT/` me. |

**Pro tip (sirf face edit karna ho):** `current document` mode me jaake pehle
*Quick Selection / Object Selection* se face select kar lein, phir script chalayein →
smoothing/glow **sirf usi selection** ke andar lagta hai, baaki image sharp rehti hai.

---

## 3. PHOTO ZONE — sabse zaroori setting

Photo kis area me jayegi, ye 4 numbers decide karte hain (`left, top, right, bottom`, px):

```javascript
PHOTO_ZONE: { left: 96, top: 300, right: 984, bottom: 1264 },
```

Ye aapke bheje hue template (1080×1350, yellow frame) ke inner area se liye gaye hain.
Agar frame thoda alag ho, to **koi bhi** ek tarika:

1. **Auto measure:** `frame-template.png` ko Photoshop me open karein → `PeaceDay_MeasureZone.jsx` chalayein → values detect ho kar `PeaceDayPost.settings.txt` me save ho jayengi.
2. **Guides:** document me 4 guides (2 vertical = frame ki andar ki lines, 2 horizontal) daal dein; `USE_GUIDES: true` hai to script guides se zone padh legi.
3. **Manual:** dialog ke "6) PHOTO ZONE" panel me 4 values bhar dein (auto-save ho jati hain).

---

## 4. Module guide (kya hota hai, kaise tune karein)

### 4.1 Pic combine
```javascript
PHOTOS: { layout:"auto", gap:12, fit:"cover", vAlign:0.72, zoom:1.0 }
```
* `layout`: `single` | `duo` (2 photo ek ke neeche ek) | `trio` (3 rows) | `quad` (2×2) | `auto` (kitni photos aayi hain usse).
* `fit`: `cover` = box bhar de (crop), `contain` = poori photo (bars), `stretch` = distort.
* `vAlign`: 0 = photo ka neeche ka hissa dikhe, 0.5 = center, 1 = upar ka. **Faces ke liye 0.6–0.9 best** (default 0.72) — sirf vertical crop control karta hai, zoom nahi.
* `zoom`: 1.05 = thoda aur andar.

### 4.2 Face edit (pure layer-based, PSD me live tweakable)
```javascript
FACE: { soften:60, blurRadius:4.5, keepEdges:12, glow:22, lift:20, detail:45,
        detailRadius:1.4, useMySelection:true, noSelectionFallback:"whole" }
```
| Layer | Kaam |
|---|---|
| `02_FACE_SOFTEN` | duplicate + **Surface Blur** (threshold se aankhein/hont/lines safe) — opacity hi "strength" hai |
| `03_FACE_GLOW` | bada Gaussian blur + **Soft Light** — soft premium skin/Orton look |
| `04_FACE_LIFT` | 60% gray + **Linear Light** = auto dodge (mid-tone brightness), sirf photo pixels tak |
| Unsharp | `detail` — eyes/hair/baal ki micro-contrast wapas |

Natural look ke liye: `soften 40-55`, `glow 10-20`, `lift 10-20`, `detail 35-55`.
Bahut "plastic" lage to `soften` kam karein aur `blurRadius` 3 rakhein.

### 4.3 Color grading (preset = wash layers ki list)
```javascript
GRADE: { preset:"Warm Gold", strength:70, contrast:8, clipToPhoto:true, autoTone:false }
```
| Preset | Mood |
|---|---|
| `Warm Gold` | Peace Day / school event ke liye golden warm (default) |
| `Teal-Orange` | cinematic poster look |
| `Clean Bright` | bright, clean, "professional NGO" feed |
| `Moody Film` | muted, film-ish, serious message |
| `Mono Pop` | black-white + warm highlight (quote posters pe strong) |
| `None` | sirf retouch + outline |

Kaise kaam karta hai: har wash ek **solid-colour layer + blend mode** hoti hai
(`COLOR` tone change karta hai blacks ko chhue bina, `SOFTLIGHT` color+contrast,
`SCREEN` haze, `MULTIPLY` crush, `SATURATION` with `#808080` = mono).
`clipToPhoto: true` ki wajah se wash **sirf photo pixels** tak limited rehte hain —
isliye aapka background **pure `#000000`** hi rehta hai (na dhundhla, na gray).

Apna preset banane ke liye script me `PRESETS` object me line add karein:
```javascript
"Saqafat Warm": [
    { hex:"#FFB347", blend:"SOFTLIGHT", op: 30 },
    { hex:"#0F3B5C", blend:"COLOR",     op: 22 }
]
```
phir dialog me preset list me naam add kar dein (ya `GRADE.preset` CFG me set karke
`SHOW_UI:false` se direct run karein).

### 4.4 Outline
```javascript
OUTLINE: { photo:"sticker", stickerColor:"#FFFFFF", stickerWidth:16,
           stickerColor2:"#101010", stickerWidth2:6, edgeColor:"#FFF200",
           edgeWidth:4, softness:1.2 }
```
* `sticker` = photo ki shape ke bahaar ring (cartoon/sticker feel) — white ring + optional
  black outer ring.
* `edge` = photo box ke kinare pe clean line (frame jaisa).
* `sticker+edge` = dono. Photo ke **neeche** layer ban kar jaati hai, isliye kabhi chehra nahi katta.
* `softness` = ring ko 1px blur (jaggy edge hatata hai).
* `FRAME` block se canvas pe yellow border (`color/width/outerPad`).

### 4.5 Frame + aapka original template
```javascript
FRAME: { useTemplateFile:true, useStickerFile:true, templateOpacity:100 }
```
* `assets/frame-template.png` rakha ho → **wahi** frame use hoga (aapka original design bilkul same rehta hai — "same rahe" wali requirement). Transparency na ho (flattened black-bg PNG) to script khud **MULTIPLY** laga deti hai, jisse black gayab aur yellow frame sharp.
* `assets/title-sticker.png` (aapka "Celebrating Peace Day" sticker) rakha ho → top pe center ho jayega, 78% width tak.
* Dono na hon → script plain yellow frame draw kar deta hai (1080×1350 pe 22px line, 62px padding) taake phir bhi post ready ho.
* `CAPTION.text` bhar dein → neeche centered text layer (default `Arial-BoldMT`, `#FFF200`).

### 4.6 Export
```javascript
EXPORT: { outDir:"OUTPUT", png:true, jpg:true, jpgQuality:11, psd:true, suffix:"_PEACE", also2x:false }
```
`PeaceDay_<name>_PEACE.png` + `.jpg` (1080×1350) aur **layered `.psd`** (opacity se live tune
karne ke liye). `also2x: true` = 2160×2700 display/print version bhi.

---

## 5. Bina dialog / automation

`CFG.SHOW_UI = false` kar dein → script saved settings (`PeaceDayPost.settings.txt`) ya CFG
defaults se chalta hai. Photoshop Action / terminal se bhi chalega:

```bash
# macOS / Windows — Photoshop band ho to yehi command use hoti hai
/Applications/Adobe\ Photoshop\ 2024/Adobe\ Photoshop\ 2024.app/Contents/MacOS/Adobe\ Photoshop\ 2024 \
  -r /full/path/PeaceDayPost.jsx
```
(`-r` = run script on launch; Windows pe `.exe` ke saath wahi flag.)

Ek aur tariqa: doosri `.jsx` se embed karein —
```javascript
app.load(new File("/full/path/PeaceDayPost.jsx")); // ya app.doJavaScript(File contents)
```

---

## 6. Troubleshooting

| Error / problem | Fix |
|---|---|
| `Illegal character` / script load nahi hoti | File UTF-8/ASCII me honi chahiye (ye file hai); `.jsx` ka naam `PeaceDayPost.jsx` rakhein, folder me space na ho to behtar. |
| "General Photoshop error occurred" | Document 16-bit ya CMYK hai → `Image > Mode > RGB Color` + `8 Bits/Channel`. Layer locked hai → unlock karein. |
| Photo frame se bahar / galat jagah | PHOTO ZONE values aapke template se match nahi karti → `PeaceDay_MeasureZone.jsx` chalayein ya guides use karein (section 3). |
| Chehra kat gaya | `vAlign` 0.85–1.0 karein, `zoom` 1.0 rakhein, ya `fit:"contain"`. |
| Black background gray ho gaya | `GRADE.clipToPhoto` aur `FACE` lift on rakhein; `autoTone:false` rakhein. (AutoTone pure black ko lift karta hai.) |
| Outline dikhi hi nahi | `OUTLINE.photo` ≠ none ho; `stickerWidth > 0`; photo layer Background na ho. |
| Template ka frame photo ke peeche chup gaya | Template layer upar honi chahiye — script khud top pe rakhti hai; manually `07_FRAME_TEMPLATE` ko top me drag kar dein. |
| Batch me ek photo fail hui | Log me file ka naam `!` ke saath aayega; baaki files process hoti rehti hain. |
| PSD me layers bahut zyada | Normal hai (har wash/retouch alag layer = tune karne layak). Flat PNG/JPG export ho chuka hai. |

---

## 7. Quick Roman-Urdu cheat sheet

```
File > Scripts > Browse > PeaceDayPost.jsx   →  dialog khulega
Mode: "pick photos"                           →  1-4 photo select karein
Layout: auto (1 photo = full, 2 = duo)        →  Fit: cover
FACE: soften 50, glow 15, lift 15, detail 45   →  natural look
GRADE: Warm Gold, strength 70                 →  frame ka yellow safe rahega
OUTLINE: sticker, ring 16 white, outer 6 black →  sticker look
FRAME: use assets/frame-template.png           →  aapka original design same rahega
RUN                                            →  OUTPUT/ me PNG + JPG + PSD
```

Aur fast: photo ka face pehle select karke `current document` mode → sirf face retouch.

---

## 8. Kya jaan-boojh kar NAHI kiya gaya (honest limits)

* **Face *detection* scriptable nahi** — ExtendScript me `Select > Subject` / Face-Aware
  Liquify / Neural Filters API nahi hain. Isliye smoothing ya to poori image pe halka haath
  se lagta hai, ya aap **selection de dein** (best result). Skin-tone color-range trick bhi
  unreliable hoti hai, isliye use nahi kiya.
* Grading **wash layers** se hoti hai, `.cube` LUT apply ExtendScript se reliably nahi hota.
  Agar aapke paas LUT ho: `File > Automate > Replace Color`/ adjustment layer manually, ya
  bata dein — LUT-apply version bhi bana deta hoon.
* Script non-destructive **ke qareeb** hai (sab kuch alag layers me, PSD save hota hai),
  par `Unsharp`/`Brightness-Contrast` photo layer pe hi lagte hain. Smart Object me convert
  karke filter chahiye ho to bolo, `FACE.useSmartObject` add kar dunga.
