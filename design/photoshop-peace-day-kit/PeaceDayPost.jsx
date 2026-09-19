/* =====================================================================================
   PEACE DAY POST KIT  v1.2   —  Adobe Photoshop ExtendScript (.jsx)
   -------------------------------------------------------------------------------------
   EK CLICK ME:
     1. PIC COMBINE   – 1/2/3/4 photos ko 1080x1350 black canvas ke yellow frame wale
                        photo-zone me auto fit + crop karke daalta hai (grid layout).
     2. FACE EDIT     – skin soften (Surface Blur = edges safe), soft glow, mid-tone
                        lift (auto dodge), detail pop (Unsharp). Koi plugin nahi chahiye.
                        Face select karke chalayein to SIRF wahi area edit hota hai.
     3. COLOR GRADING – 5 presets; har wash alag layer = baad me opacity se tune ho jata
                        hai. Wash sirf photo pixels tak clip hote hain, isliye black
                        background pure #000 rehta hai (social pe ye zaroori hai).
     4. OUTLINE       – photo pe sticker ring (white + optional black outer ring)
                        aur/ya clean edge border, plus canvas pe yellow frame.
     5. EXPORT        – PNG + JPG 1080x1350 + layered PSD, OUTPUT folder me.

   RUN:  File > Scripts > Browse...  ->  PeaceDayPost.jsx      (settings dialog khulta hai)
         Bina dialog: CFG.SHOW_UI = false
   TARGET: Photoshop CS6, CC 2015 - CC 2025 (Win/Mac), 8-bit RGB.
   HAR risky filter guarded hai — jo version me na ho wo skip ho kar "notes" me
   dikhta hai, script kabhi crash nahi karti.
   ===================================================================================== */

// #target photoshop     // <- sirf ExtendScript SDK / command line se chalate waqt uncomment karein

(function peaceDayPostKit() {

    var APP = app;

    /* =================================================================================
       SECTION 0 — CONFIG  (daily tuning yahin)
       ================================================================================= */

    var CFG = {

        SHOW_UI: true,             // false = dialog skip, neeche wali values se direct run
        OVERWRITE_OK: true,        // OUTPUT me same naam = poochhe bina replace

        /* ---------- Canvas (aapka post size) ---------- */
        CANVAS: { w: 1080, h: 1350, dpi: 72 },
        BG_COLOR: "#000000",       // bg black

        /* ---------- Photo zone (photo yahan jayegi) ----------
           1080x1350 ke pixels — aapke template ke yellow frame ke ANDAR ka area.
           Frame alag ho to sirf ye 4 numbers badlein; ya Photoshop me 4 guides
           (2 vertical + 2 horizontal) daal dein aur USE_GUIDES = rakhein. */
        PHOTO_ZONE: { left: 96, top: 300, right: 984, bottom: 1264 },
        USE_GUIDES: true,

        /* ---------- 1) PIC COMBINE ---------- */
        PHOTOS: {
            layout: "auto",        // "auto" | "single" | "duo" | "trio" | "quad"
            gap: 12,               // photos ke beech gap (px)
            fit: "cover",          // cover = crop karke bhar de | contain = poori photo | stretch
            vAlign: 0.72,          // 0 = photo ka neeche ka hissa | 0.5 = center | 1 = upar (faces)
            zoom: 1.0              // 1.05 = thoda aur crop/zoom
        },

        /* ---------- 2) FACE EDIT ---------- */
        FACE: {
            enabled: true,
            soften: 60,            // 0-100  skin smoothing
            blurRadius: 4.5,       // px     softness ka size
            keepEdges: 12,         // 1-256  Surface Blur threshold (bara = aankhein/hont safe)
            glow: 22,              // 0-100  soft Orton glow
            lift: 20,              // 0-100  mid-tone brightness (auto dodge)
            detail: 45,            // 0-100  Unsharp detail/eye pop
            detailRadius: 1.4,     // px     Unsharp radius
            useMySelection: true,  // selection ho to sirf wahi edit ho
            noSelectionFallback: "whole"   // selection na ho to: "whole" | "skip"
        },

        /* ---------- 3) COLOR GRADING ---------- */
        GRADE: {
            enabled: true,
            preset: "Warm Gold",   // Warm Gold | Teal-Orange | Clean Bright | Moody Film | Mono Pop | None
            strength: 70,          // 0-100 overall taqat
            contrast: 8,           // -50 .. +50
            autoTone: false,       // pehle Auto Tone (blacks lift kar sakta hai, isliye off)
            clipToPhoto: true      // washes sirf photo pixels tak = bg black safe
        },

        /* ---------- 4) OUTLINE ---------- */
        OUTLINE: {
            photo: "sticker",      // none | sticker | edge | sticker+edge
            stickerColor: "#FFFFFF",
            stickerWidth: 16,      // px (main ring)
            stickerColor2: "#101010",
            stickerWidth2: 6,      // px (outer ring, 0 = off)
            edgeColor: "#FFF200",  // photo box ke upar line
            edgeWidth: 4,          // 0 = off
            softness: 1.2          // px — ring ko anti-alias karo
        },

        /* ---------- FRAME + TEMPLATE ---------- */
        FRAME: {
            draw: true,            // yellow frame khud bana de
            color: "#FFF200",
            width: 22,
            outerPad: 62,          // canvas edge se frame ki doori
            useTemplateFile: true, // assets/frame-template.png = aapka original frame PNG
            useStickerFile: true,  // assets/title-sticker.png  = "Celebrating Peace Day" sticker
            templateOpacity: 100
        },

        /* ---------- OPTIONAL CAPTION ---------- */
        CAPTION: {
            text: "",              // e.g. "21 September  |  Peace Day"   (khali = skip)
            color: "#FFF200",
            size: 40,
            font: "Arial-BoldMT",  // PostScript font name
            bottomMargin: 46
        },

        /* ---------- EXPORT ---------- */
        EXPORT: {
            outDir: "OUTPUT",      // script folder ke andar, ya absolute path
            png: true,
            jpg: true,
            jpgQuality: 11,        // 1-12
            psd: true,
            suffix: "_PEACE",
            also2x: false,         // 2160x2700 bhi (display/print)
            flattenForExport: true // export copy flatten ho (PSD me layers barkarar)
        },

        /* ---------- BATCH ---------- */
        BATCH: { enabled: false, folder: "" },

        MAX_PHOTOS: 4,
        ASSETS_DIR: "assets",
        MASK_CHANNEL: "PD_PHOTOMASK"
    };

    /* =================================================================================
       SECTION 1 — utils  (ExtendScript = ES3: sirf var, koi => / forEach / JSON nahi)
       ================================================================================= */

    var LOGS = [];
    function log(m) { LOGS[LOGS.length] = String(m); }
    function warn(m) { LOGS[LOGS.length] = "! " + String(m); }
    function trim(s) { return String(s).replace(/^\s+/, "").replace(/\s+$/, ""); }
    function endsWith(s, t) { s = String(s); t = String(t); return s.length >= t.length && s.substring(s.length - t.length) === t; }
    function pad2(n) { return (n < 10 ? "0" : "") + n; }
    function num(v, d) { v = Number(v); return (v === null || v === "" || isNaN(v)) ? d : v; }
    function clamp(v, lo, hi) { v = num(v, lo); return v < lo ? lo : (v > hi ? hi : v); }
    function stamp() {
        var d = new Date();
        return "" + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) +
            "-" + pad2(d.getHours()) + pad2(d.getMinutes());
    }

    function hexColor(hex) {
        var c = new SolidColor();
        hex = trim(String(hex)).replace(/^#/, "");
        if (hex.indexOf(",") >= 0) {
            var p = hex.split(",");
            c.rgb.red = num(p[0], 255); c.rgb.green = num(p[1], 255); c.rgb.blue = num(p[2], 255);
            return c;
        }
        if (hex.length === 3) {
            hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
        }
        var r = parseInt(hex.substring(0, 2), 16), g = parseInt(hex.substring(2, 4), 16), b = parseInt(hex.substring(4, 6), 16);
        c.rgb.red = isNaN(r) ? 255 : r;
        c.rgb.green = isNaN(g) ? 255 : g;
        c.rgb.blue = isNaN(b) ? 255 : b;
        return c;
    }

    var BLEND = null;
    function blendModeOf(name) {
        if (!BLEND) {
            BLEND = {
                NORMAL: BlendMode.NORMAL, MULTIPLY: BlendMode.MULTIPLY, SCREEN: BlendMode.SCREEN,
                OVERLAY: BlendMode.OVERLAY, DARKEN: BlendMode.DARKEN, LIGHTEN: BlendMode.LIGHTEN,
                DARKENCOLOR: BlendMode.DARKENCOLOR, LIGHTENCOLOR: BlendMode.LIGHTENCOLOR,
                SOFTLIGHT: BlendMode.SOFTLIGHT, HARDLIGHT: BlendMode.HARDLIGHT,
                DIFFERENCE: BlendMode.DIFFERENCE, HUE: BlendMode.HUE, SATURATION: BlendMode.SATURATION,
                COLOR: BlendMode.COLOR, LUMINOSITY: BlendMode.LUMINOSITY,
                LINEARLIGHT: BlendMode.LINEARLIGHT, LINEARLIGHT_: BlendMode.LINEARLIGHT,
                PINLIGHT: BlendMode.PINLIGHT, HARDMIX: BlendMode.HARDMIX,
                SUBTRACT: BlendMode.SUBTRACT, DIVIDE: BlendMode.DIVIDE,
                GRAINEXTRACT: BlendMode.GRAINEXTRACT, GRAINMERGE: BlendMode.GRAINMERGE
            };
        }
        var m = BLEND[String(name).toUpperCase().replace(/[^A-Z_]/g, "")];
        return m === undefined ? BlendMode.NORMAL : m;
    }

    /* guarded calls — version me feature na ho to skip, crash nahi */
    function tryOp(obj, method, args, label) {
        if (!obj || typeof obj[method] !== "function") { if (label) warn("  skip: " + label + " (n/a)"); return false; }
        try { obj[method].apply(obj, args || []); if (label) log("  ok: " + label); return true; }
        catch (e) { if (label) warn("  skip: " + label + (e && e.message ? " — " + e.message : "")); return false; }
    }
    function trySet(obj, prop, v, label) {
        try { obj[prop] = v; if (label) log("  ok: " + label); return true; }
        catch (e) { if (label) warn("  skip: " + label); return false; }
    }

    function unlock(L) {
        try { L.allLocked = false; } catch (e) {}
        try { L.pixelsLocked = false; } catch (e) {}
        try { L.positionLocked = false; } catch (e) {}
        try { L.transparentPixelsLocked = false; } catch (e) {}
    }

    function newLayer(doc, name) {
        var L = doc.artLayers.add();
        try { L.name = name; } catch (e) {}
        unlock(L);
        return L;
    }

    function dupAbove(L, doc, name) {
        var n = L.duplicate(L, ElementPlacement.PLACEBEFORE);
        n = (n && n.length) ? n[0] : n;
        try { n.name = name; } catch (e) {}
        unlock(n);
        doc.activeLayer = n;
        return n;
    }

    function boxOf(L) {
        var b = null;
        try { b = L.boundsNoEffects; } catch (e) { b = null; }
        if (!b) b = L.bounds;
        return {
            left: parseFloat(b[0].as("px")), top: parseFloat(b[1].as("px")),
            right: parseFloat(b[2].as("px")), bottom: parseFloat(b[3].as("px"))
        };
    }

    function setOpacityPct(L, pct) { try { L.opacity = clamp(pct, 0, 100); } catch (e) {} }

    function docW(doc) { return doc.width.as("px"); }
    function docH(doc) { return doc.height.as("px"); }

    function clearSel(doc) { try { doc.selection.deselect(); } catch (e) {} }
    function selectAll(doc) { try { doc.selection.selectAll(); } catch (e) {} }
    function selectBox(doc, box, mode) {
        doc.selection.select([box.left, box.top, box.right, box.bottom], mode || SelectionType.REPLACE, 0, true);
    }
    function clearSelectedPixels(doc) {
        if (tryOp(doc.selection, "clear", [], "selection clear")) return true;
        if (tryOp(doc, "clear", [], "document clear")) return true;
        // aakhri rasta: cut (pixels hat jate hain, clipboard use ho jata hai)
        return tryOp(doc, "cut", [], "document cut (fallback)");
    }
    /* Selection.border() DOM me nahi hota -> isliye "outer fill + inner clear" se band banate hain */
    function fillBand(doc, name, outer, inner, color) {
        var L = newLayer(doc, name);
        clearSel(doc);
        try {
            selectBox(doc, outer);
            fillActive(doc, L, color);
            selectBox(doc, inner);
            doc.activeLayer = L;
            if (!clearSelectedPixels(doc)) {
                warn("Pixels clear nahi ho paye -> band layer hata di (frame skip).");
                try { L.remove(); } catch (e2) {}
                L = null;
            }
        } catch (e) { warn("band skip: " + e.message); }
        clearSel(doc);
        return L;
    }
    function inset(box, px) {
        return { left: box.left + px, top: box.top + px, right: box.right - px, bottom: box.bottom - px };
    }
    function resampleTo(doc, w, h, label) {
        var tries = [
            [w, h, CFG.CANVAS.dpi, ResampleMethod.BICUBICSHARPER],
            [w, h, CFG.CANVAS.dpi, ResampleMethod.BICUBIC],
            [w, h, CFG.CANVAS.dpi, undefined],
            [w, h]
        ];
        for (var i = 0; i < tries.length; i++) {
            if (tryOp(doc, "resizeImage", tries[i], label || "resizeImage")) return true;
        }
        return false;
    }
    function fillActive(doc, L, color) {
        doc.activeLayer = L;
        if (tryOp(L, "fillSolid", [color, false], "fill")) return true;
        return tryOp(doc, "fill", [color], "document fill");
    }
    function blurLayer(doc, L, radius, label) {
        if (tryOp(L, "applyGaussianBlur", [radius], label || "gaussian blur (layer)")) return true;
        doc.activeLayer = L;
        return tryOp(doc, "gaussianBlur", [radius], label || "gaussian blur (doc)");
    }
    function surfaceBlurLayer(doc, L, amount, radius) {
        if (tryOp(L, "applySurfaceBlur", [amount, radius], "surface blur (layer)")) return true;
        doc.activeLayer = L;
        if (tryOp(doc, "surfaceBlur", [amount, radius], "surface blur (doc)")) return true;
        return blurLayer(doc, L, radius / 2, "gaussian fallback");
    }

    function scriptFolder() {
        try { return new File($.fileName).parent; } catch (e) { return Folder.myDocuments; }
    }
    function asset(name) {
        if (!name) return null;
        var f = new File(name);
        if (f.exists) return f;
        f = new File(scriptFolder().fsName + "/" + CFG.ASSETS_DIR + "/" + name);
        if (f.exists) return f;
        f = new File(scriptFolder().fsName + "/" + name);
        return f.exists ? f : null;
    }
    function outFolder() {
        var f = null;
        if (CFG.EXPORT.outDir) {
            f = new Folder(CFG.EXPORT.outDir);
            if (!f.exists) f = new Folder(scriptFolder().fsName + "/" + CFG.EXPORT.outDir);
        }
        if (!f) return scriptFolder();
        if (!f.exists) { try { f.create(); } catch (e) { return scriptFolder(); } }
        return f.exists ? f : scriptFolder();
    }
    function inList(arr, v) { var i; for (i = 0; i < arr.length; i++) { if (arr[i] === v) return true; } return false; }

    /* =================================================================================
       SECTION 2 — units / document / zone
       ================================================================================= */

    var _units = null;
    function usePixels() { try { _units = APP.preferences.rulerUnits; } catch (e) {} APP.preferences.rulerUnits = Units.PIXELS; }
    function restoreUnits() { if (_units !== null) { try { APP.preferences.rulerUnits = _units; } catch (e) {} } }

    function newPostDoc() {
        var d = APP.documents.add(CFG.CANVAS.w, CFG.CANVAS.h, CFG.CANVAS.dpi,
            "PeaceDay_" + stamp(), NewDocumentMode.RGB, DocumentFill.BLACK);
        try { d.backgroundLayer.name = "00_BG_BLACK"; } catch (e) {}
        return d;
    }

    function ensure8BitRGB(doc) {
        var mode = "";
        try { mode = String(doc.mode); } catch (e0) {}
        try {
            if (mode.indexOf("RGB") < 0 && mode.indexOf("16") < 0) {
                doc.changeMode(ChangeMode.RGB);
                log("  mode -> RGB");
            }
        } catch (e1) {}
        try {
            if (String(doc.bitsPerChannel).indexOf("16") >= 0 || String(doc.bitsPerChannel).indexOf("32") >= 0) {
                doc.bitsPerChannel = BitsPerChannelType.EIGHT;
                log("  bits/channel -> 8");
            }
        } catch (e2) {}
    }

    function ensureCanvas(doc) {
        var w = docW(doc), h = docH(doc);
        if (Math.abs(w - CFG.CANVAS.w) < 1 && Math.abs(h - CFG.CANVAS.h) < 1) return;
        log("Canvas " + Math.round(w) + "x" + Math.round(h) + " -> " + CFG.CANVAS.w + "x" + CFG.CANVAS.h);
        var s = Math.min(CFG.CANVAS.w / w, CFG.CANVAS.h / h);
        resampleTo(doc, Math.round(w * s), Math.round(h * s), "canvas resize");
        tryOp(doc, "resizeCanvas", [CFG.CANVAS.w, CFG.CANVAS.h, AnchorPosition.MIDDLECENTER], "resizeCanvas");
    }

    function hasBlackBG(doc) {
        try {
            for (var i = 0; i < doc.layers.length; i++) {
                if (String(doc.layers[i].name).indexOf("00_BG") === 0) return true;
            }
        } catch (e) {}
        return false;
    }

    function ensureBlackBG(doc) {
        if (hasBlackBG(doc)) return;
        var L = newLayer(doc, "00_BG_BLACK");
        selectAll(doc);
        fillActive(doc, L, hexColor(CFG.BG_COLOR));
        clearSel(doc);
        tryOp(L, "move", [doc, ElementPlacement.PLACEATEND], "bg -> bottom");
    }

    function zoneFromGuides(doc) {
        if (!CFG.USE_GUIDES) return null;
        try {
            var g = doc.guides, v = [], h = [], i, o;
            if (!g || g.length < 4) return null;
            for (i = 0; i < g.length; i++) {
                o = parseFloat(g[i].coordinate.as("px"));
                if (String(g[i].direction) === "VERTICAL") v[v.length] = o; else h[h.length] = o;
            }
            if (v.length < 2 || h.length < 2) return null;
            v.sort(function (a, b) { return a - b; });
            h.sort(function (a, b) { return a - b; });
            var box = { left: v[0], right: v[v.length - 1], top: h[0], bottom: h[h.length - 1] };
            if (box.right - box.left < 60 || box.bottom - box.top < 60) return null;
            log("Photo zone = guides: " + Math.round(box.left) + "," + Math.round(box.top) +
                " -> " + Math.round(box.right) + "," + Math.round(box.bottom));
            return box;
        } catch (e) { return null; }
    }

    /* =================================================================================
       SECTION 3 — selection / mask helpers
       ================================================================================= */

    function transpChannel(L) {
        try { return L.channels[L.channels.length - 1]; } catch (e) { return null; }
    }
    function hasSelection(doc) {
        try { return !!doc.selection.bounds; } catch (e) { return false; }
    }
    function removeChannel(doc, name) {
        try { doc.channels.getByName(name).remove(); } catch (e) {}
    }
    function stashSelection(doc, name) {
        if (!hasSelection(doc)) return null;
        removeChannel(doc, name);
        try {
            var c = doc.channels.add();
            c.name = name;
            doc.selection.store(c, SelectionType.REPLACE);
            return c;
        } catch (e) { warn("Selection stash nahi ho saka"); return null; }
    }
    function loadSel(doc, ch) {
        if (!ch) return false;
        return tryOp(doc.selection, "load", [ch, SelectionType.REPLACE, 0, true], null);
    }
    function cutOutsideSel(doc, L) {
        doc.activeLayer = L;
        unlock(L);
        if (!tryOp(doc.selection, "invert", [], null)) return;
        if (!clearSelectedPixels(doc)) warn("selection-clip skip");
        tryOp(doc.selection, "invert", [], null);
        clearSel(doc);
    }

    /* photo pixels ki union selection -> alpha channel (ye sab kuch bg se alag rakhta hai) */
    function photoMaskChannel(doc, photoLayers, name) {
        var i, ch, ok = false;
        clearSel(doc);
        for (i = 0; i < photoLayers.length; i++) {
            ch = transpChannel(photoLayers[i]);
            if (!ch) continue;
            if (tryOp(doc.selection, "load", [ch, ok ? SelectionType.EXTEND : SelectionType.REPLACE, 0, true], null)) ok = true;
        }
        if (!ok) return null;
        removeChannel(doc, name);
        try {
            var m = doc.channels.add();
            m.name = name;
            doc.selection.store(m, SelectionType.REPLACE);
            clearSel(doc);
            return m;
        } catch (e) { warn("Photo mask channel nahi bana"); clearSel(doc); return null; }
    }

    /* =================================================================================
       SECTION 4 — PIC COMBINE
       ================================================================================= */

    function isImageFile(f) {
        var ext = [".jpg", ".jpeg", ".png", ".tif", ".tiff", ".psd", ".webp", ".bmp", ".gif", ".heic"];
        var n = String(f.name).toLowerCase(), i;
        for (i = 0; i < ext.length; i++) { if (endsWith(n, ext[i])) return true; }
        return false;
    }

    function layoutSpec(n) {
        var w = String(CFG.PHOTOS.layout);
        if (w === "single") return { cols: 1, rows: 1 };
        if (w === "duo") return { cols: 1, rows: 2 };
        if (w === "trio") return { cols: 1, rows: 3 };
        if (w === "quad") return { cols: 2, rows: 2 };
        if (n <= 1) return { cols: 1, rows: 1 };
        if (n === 2) return { cols: 1, rows: 2 };
        if (n === 3) return { cols: 1, rows: 3 };
        return { cols: 2, rows: 2 };
    }

    function desiredPhotoCount() {
        var w = String(CFG.PHOTOS.layout);
        if (w === "single") return 1;
        if (w === "duo") return 2;
        if (w === "trio") return 3;
        if (w === "quad") return 4;
        return CFG.MAX_PHOTOS;
    }

    function choosePhotoFiles(max) {
        var out = [], f;
        for (;;) {
            f = File.openDialog("Photo chunein  (" + (out.length + 1) + " / " + max + ")", "", false);
            if (!f) break;
            out[out.length] = f.fsName;
            if (out.length >= max) break;
            if (!confirm("Aur photo add karni hai?   (No/Cancel = bas itni hi)")) break;
        }
        return out;
    }

    function makeZones(box, n) {
        var grid = layoutSpec(n), gap = num(CFG.PHOTOS.gap, 0);
        var cw = (box.right - box.left - gap * (grid.cols - 1)) / grid.cols;
        var ch = (box.bottom - box.top - gap * (grid.rows - 1)) / grid.rows;
        var out = [], i, r, c;
        for (i = 0; i < n; i++) {
            r = Math.floor(i / grid.cols); c = i % grid.cols;
            out[out.length] = {
                left: box.left + c * (cw + gap), top: box.top + r * (ch + gap),
                right: box.left + c * (cw + gap) + cw, bottom: box.top + r * (ch + gap) + ch
            };
        }
        return out;
    }

    function scaleLayerPct(doc, pctW, pctH) {
        if (Math.abs(pctW - 100) < 0.05 && Math.abs(pctH - 100) < 0.05) return true;
        var before, cx, cy, done = false;
        try {
            before = boxOf(doc.activeLayer);
            cx = (before.left + before.right) / 2; cy = (before.top + before.bottom) / 2;
        } catch (e) { return false; }
        try {
            var d = new ActionDescriptor();
            d.putEnumerated(charIDToTypeID("FTcs"), charIDToTypeID("QCSt"), charIDToTypeID("Qcsa"));
            d.putUnitDouble(charIDToTypeID("Hrzn"), charIDToTypeID("#Rlt"), 0);
            d.putUnitDouble(charIDToTypeID("Vrtc"), charIDToTypeID("#Rlt"), 0);
            d.putUnitDouble(charIDToTypeID("Wdth"), charIDToTypeID("#Prc"), pctW);
            d.putUnitDouble(charIDToTypeID("Hght"), charIDToTypeID("#Prc"), pctH);
            try { d.putEnumerated(charIDToTypeID("Intp"), charIDToTypeID("Bcbc"), charIDToTypeID("Bcbc")); } catch (e0) {}
            APP.executeAction(charIDToTypeID("Trnf"), d, DialogModes.NO);
            done = true;
        } catch (e) { warn("Layer scale skip: " + e.message); }
        if (!done) return false;
        try {
            var a = boxOf(doc.activeLayer);
            doc.activeLayer.translate(cx - (a.left + a.right) / 2, cy - (a.top + a.bottom) / 2);
        } catch (e2) {}
        return true;
    }

    // file -> photo layer, box me fit (cover/contain/stretch) + bahar ka hissa delete
    function placePhotoInBox(doc, filePath, box, i) {
        var src = null;
        try { src = APP.open(new File(filePath)); }
        catch (e) { warn("Open nahi hua: " + filePath); return null; }
        var ok = false;
        try {
            clearSel(src);
            selectAll(src);
            if (tryOp(src.selection, "copy", [true], null)) ok = true;
            else if (tryOp(src.selection, "copy", [], null)) ok = true;
        } catch (e2) { ok = false; }
        if (!ok) { warn("Copy nahi hua: " + filePath); try { src.close(SaveOptions.DONOTSAVECHANGES); } catch (e) {} return null; }
        try { src.close(SaveOptions.DONOTSAVECHANGES); } catch (e) {}

        APP.activeDocument = doc;
        if (!tryOp(doc, "paste", [], null)) { warn("Paste nahi hua"); return null; }
        var L = doc.activeLayer;
        unlock(L);
        try { L.name = "01_PHOTO_" + (i + 1); } catch (e) {}

        var b = boxOf(L), lw = b.right - b.left, lh = b.bottom - b.top;
        var zw = box.right - box.left, zh = box.bottom - box.top;
        if (lw < 2 || lh < 2) return L;

        var mode = String(CFG.PHOTOS.fit), s, zoom = num(CFG.PHOTOS.zoom, 1);
        doc.activeLayer = L;
        if (mode === "stretch") scaleLayerPct(doc, (zw / lw) * 100, (zh / lh) * 100);
        else {
            s = (mode === "contain") ? Math.min(zw / lw, zh / lh) : Math.max(zw / lw, zh / lh) * zoom;
            scaleLayerPct(doc, s * 100, s * 100);
        }

        b = boxOf(L);
        var layerW = b.right - b.left, layerH = b.bottom - b.top;
        var tx = (box.left + box.right) / 2, ty = (box.top + box.bottom) / 2;
        if (mode !== "stretch") {
            var overY = Math.max(0, layerH - zh);
            ty = box.top + layerH / 2 - overY * (1 - clamp(CFG.PHOTOS.vAlign, 0, 1));
            var overX = Math.max(0, layerW - zw);
            tx = box.left + layerW / 2 - overX * 0.5;
        }
        tryOp(L, "translate", [tx - (b.left + b.right) / 2, ty - (b.top + b.bottom) / 2], "photo aligned");

        clearSel(doc);
        selectAll(doc);
        selectBox(doc, box, SelectionType.DIMINISH);
        doc.activeLayer = L;
        clearSelectedPixels(doc);
        clearSel(doc);
        return L;
    }

    /* =================================================================================
       SECTION 5 — FACE EDIT  (sab kuch layer-based = non-destructive ke qareeb)
       ================================================================================= */

    function faceEdit(doc, photoLayers, faceSel, mask) {
        if (!CFG.FACE.enabled) return;
        log("— FACE EDIT —");

        var soften = clamp(CFG.FACE.soften, 0, 100) / 100;
        var glow = clamp(CFG.FACE.glow, 0, 100) / 100;
        var radius = Math.max(0.4, num(CFG.FACE.blurRadius, 4.5));
        var thresh = Math.max(1, num(CFG.FACE.keepEdges, 12));
        var selReady = false;
        if (CFG.FACE.useMySelection) selReady = (faceSel && loadSel(doc, faceSel)) || hasSelection(doc);
        if (!selReady && String(CFG.FACE.noSelectionFallback) === "skip") {
            warn("Face selection nahi mili -> FACE EDIT skip (fallback 'whole' karein).");
            return;
        }

        var i;
        for (i = 0; i < photoLayers.length; i++) {
            var p = photoLayers[i];
            doc.activeLayer = p;

            /* A) SKIN SOFTEN — Surface Blur: skin smooth, edges/aankhein bachii hui */
            if (soften > 0) {
                var soft = dupAbove(p, doc, "02_FACE_SOFTEN_" + (i + 1));
                surfaceBlurLayer(doc, soft, thresh, Math.max(1, radius * 2));
                setOpacityPct(soft, soften * 92);
                if (selReady) {
                    if (faceSel) loadSel(doc, faceSel);
                    // sirf tabhi cut karo jab selection waqai ho (warna poora layer hat jata)
                    if (hasSelection(doc)) cutOutsideSel(doc, soft);
                }
            }
            /* B) GLOW — bara blur + Soft Light = soft premium skin (kids portraits me acha) */
            if (glow > 0) {
                var g = dupAbove(p, doc, "03_FACE_GLOW_" + (i + 1));
                blurLayer(doc, g, Math.max(6, num(CFG.CANVAS.w, 1080) * 0.012), "glow blur");
                g.blendMode = blendModeOf("SOFTLIGHT");
                setOpacityPct(g, glow * 60);
            }
        }

        /* C) MID-TONE LIFT (auto dodge) — photo mask tak limited layer */
        var lift = clamp(CFG.FACE.lift, 0, 100);
        if (lift > 0) {
            var Lg = newLayer(doc, "04_FACE_LIFT");
            if (mask) { loadSel(doc, mask); } else { selectAll(doc); }
            fillActive(doc, Lg, hexColor("#8C8C8C"));
            clearSel(doc);
            Lg.blendMode = blendModeOf("LINEARLIGHT");
            setOpacityPct(Lg, lift * 0.16);
        }

        /* D) DETAIL POP — Unsharp (version me na ho to Sharpen, wo bhi na ho to skip) */
        var detail = clamp(CFG.FACE.detail, 0, 100);
        if (detail > 0) {
            for (i = 0; i < photoLayers.length; i++) {
                doc.activeLayer = photoLayers[i];
                if (mask) loadSel(doc, mask);
                var done = tryOp(doc, "unsharpMask", [Math.round(detail), num(CFG.FACE.detailRadius, 1.4), 3], "unsharp mask");
                if (!done) tryOp(doc, "sharpen", [Math.round(detail * 0.5)], "sharpen");
                clearSel(doc);
            }
        }
        log("— FACE EDIT done —");
    }

    /* =================================================================================
       SECTION 6 — COLOR GRADING
       ================================================================================= */

    /* COLOR  = tone/hue shift (kale ko sparsh nahi karta)
       SOFTLIGHT = contrast + color   |   SCREEN = haze/highlight lift
       MULTIPLY = film crush          |   SATURATION with #808080 = mono
       Sab wash layer hain -> PSD me aap opacity se 2 second me tune kar sakte ho. */
    var PRESETS = {
        "Warm Gold": [
            { hex: "#FFB347", blend: "SOFTLIGHT", op: 34 },
            { hex: "#123A5A", blend: "COLOR", op: 22 },
            { hex: "#FFE7BF", blend: "SCREEN", op: 8 }
        ],
        "Teal-Orange": [
            { hex: "#FF7A2F", blend: "SOFTLIGHT", op: 30 },
            { hex: "#006E7A", blend: "COLOR", op: 30 },
            { hex: "#0A1E2A", blend: "MULTIPLY", op: 12 }
        ],
        "Clean Bright": [
            { hex: "#FFE9C7", blend: "SOFTLIGHT", op: 20 },
            { hex: "#9FD8FF", blend: "COLOR", op: 12 },
            { hex: "#FFFFFF", blend: "SCREEN", op: 8 }
        ],
        "Moody Film": [
            { hex: "#2A1C10", blend: "MULTIPLY", op: 24 },
            { hex: "#7FB3C8", blend: "COLOR", op: 22 },
            { hex: "#3B2E22", blend: "SOFTLIGHT", op: 26 }
        ],
        "Mono Pop": [
            { hex: "#808080", blend: "SATURATION", op: 100 },
            { hex: "#FFD79A", blend: "SOFTLIGHT", op: 22 },
            { hex: "#000000", blend: "MULTIPLY", op: 10 }
        ],
        "None": []
    };

    function applyGrade(doc, photoLayers) {
        if (!CFG.GRADE.enabled) return;
        var name = String(CFG.GRADE.preset), list = PRESETS[name];
        if (!list) { warn("Grade preset unknown: " + name); return; }
        if (!list.length) { log("GRADE = None (skip)"); return; }
        log("— COLOR GRADING: " + name + " —");

        var strength = clamp(CFG.GRADE.strength, 0, 100) / 100;
        var anchor = doc.layers[0];
        var mask = null;
        if (CFG.GRADE.clipToPhoto) mask = photoMaskChannel(doc, photoLayers, CFG.MASK_CHANNEL + "_G");

        if (CFG.GRADE.autoTone) {
            if (mask) loadSel(doc, mask); else selectAll(doc);
            tryOp(doc, "autoTone", [], "autoTone");
            clearSel(doc);
        }

        var i, L;
        for (i = 0; i < list.length; i++) {
            L = newLayer(doc, "05_GRADE_" + (i + 1) + "_" + name.replace(/[^A-Za-z]/g, ""));
            tryOp(L, "move", [anchor, ElementPlacement.PLACEBEFORE], null);
            if (mask) { if (!loadSel(doc, mask)) selectAll(doc); } else selectAll(doc);
            fillActive(doc, L, hexColor(list[i].hex));
            clearSel(doc);
            L.blendMode = blendModeOf(list[i].blend);
            setOpacityPct(L, clamp(num(list[i].op, 20) * strength, 0, 100));
        }

        var c = num(CFG.GRADE.contrast, 0);
        if (c !== 0) {
            if (mask) loadSel(doc, mask); else selectAll(doc);
            tryOp(doc, "brightnessContrast", [Math.round(c * 0.35), c], "brightness/contrast");
            clearSel(doc);
        }
        if (mask) { try { mask.remove(); } catch (e) {} }
    }

    /* =================================================================================
       SECTION 7 — OUTLINE
       ================================================================================= */

    /* photo shape select -> expand -> solid fill = blob. Photo ke NEECHE jaata hai,
       isliye visible sirf ring dikhti hai (cleanest sticker look, bina mask API ke). */
    function outlineBlob(doc, photoL, expandPx, hex, name, soft) {
        clearSel(doc);
        var ch = transpChannel(photoL);
        if (!ch) return null;
        if (!tryOp(doc.selection, "load", [ch, SelectionType.REPLACE, 0, true], null)) return null;
        tryOp(doc.selection, "expand", [Math.max(1, expandPx)], null);
        var L = newLayer(doc, name);
        fillActive(doc, L, hexColor(hex));
        clearSel(doc);
        if (soft > 0) blurLayer(doc, L, soft, "ring AA");
        tryOp(L, "move", [photoL, ElementPlacement.PLACEAFTER], null);
        return L;
    }

    function addOutlines(doc, photoLayers, zones) {
        var mode = String(CFG.OUTLINE.photo);
        if (mode === "none") return;
        log("— OUTLINE: " + mode + " —");
        var w1 = num(CFG.OUTLINE.stickerWidth, 0), w2 = num(CFG.OUTLINE.stickerWidth2, 0);
        var soft = num(CFG.OUTLINE.softness, 0), ew = num(CFG.OUTLINE.edgeWidth, 0), i;

        for (i = 0; i < photoLayers.length; i++) {
            var p = photoLayers[i];
            unlock(p);

            if ((mode === "sticker" || mode === "sticker+edge") && w1 > 0) {
                if (w2 > 0) outlineBlob(doc, p, w1 + w2 + Math.round(soft), CFG.OUTLINE.stickerColor2,
                    "06_OUTLINE_OUTER_" + (i + 1), soft);
                outlineBlob(doc, p, w1 + Math.round(soft), CFG.OUTLINE.stickerColor,
                    "06_OUTLINE_RING_" + (i + 1), soft);
            }

            if ((mode === "edge" || mode === "sticker+edge") && ew > 0 && zones && zones[i]) {
                var z = zones[i];
                var half = Math.round(ew / 2);
                var outer = { left: z.left - half, top: z.top - half, right: z.right + half, bottom: z.bottom + half };
                var LE = fillBand(doc, "06_OUTLINE_EDGE_" + (i + 1), outer,
                    inset(outer, Math.max(1, ew)), hexColor(CFG.OUTLINE.edgeColor));
                if (LE) tryOp(LE, "move", [p, ElementPlacement.PLACEBEFORE], null);
            }
        }
        clearSel(doc);
    }

    /* =================================================================================
       SECTION 8 — FRAME / TEMPLATE / STICKER / CAPTION
       ================================================================================= */

    function drawFrame(doc) {
        if (!CFG.FRAME.draw) return;
        var W = docW(doc), H = docH(doc);
        var pad = num(CFG.FRAME.outerPad, 0), wdt = Math.max(1, num(CFG.FRAME.width, 20));
        var outer = { left: pad, top: pad, right: W - pad, bottom: H - pad };
        var L = fillBand(doc, "07_FRAME_YELLOW", outer, inset(outer, wdt), hexColor(CFG.FRAME.color));
        if (L) tryOp(L, "move", [doc, ElementPlacement.PLACEATBEGINNING], "frame -> top");
    }

    /* overlay PNG (template frame / title sticker).
       transparency na ho (black bg wala flattened PNG) -> MULTIPLY = black apne aap gayab */
    function overlayFile(doc, file, name, toCanvas, topMarginPx, maxWidthPct) {
        if (!file) return null;
        var src;
        try { src = APP.open(file); } catch (e) { warn("Overlay open failed: " + file.name); return null; }
        var hasAlpha = false;
        try { hasAlpha = src.channels.length > 3; } catch (e0) {}
        try { if (String(src.mode).indexOf("RGB") < 0) src.changeMode(ChangeMode.RGB); } catch (e1) {}
        clearSel(src);
        selectAll(src);
        var okc = tryOp(src.selection, "copy", [true], null) || tryOp(src.selection, "copy", [], null);
        try { src.close(SaveOptions.DONOTSAVECHANGES); } catch (e) {}
        if (!okc) { warn("Overlay copy failed"); return null; }

        APP.activeDocument = doc;
        if (!tryOp(doc, "paste", [], null)) { warn("Overlay paste failed"); return null; }
        var L = doc.activeLayer;
        unlock(L);
        try { L.name = name; } catch (e) {}

        var W = docW(doc), H = docH(doc), b = boxOf(L);
        var lw = b.right - b.left, lh = b.bottom - b.top;
        if (lw < 2 || lh < 2) return L;
        doc.activeLayer = L;
        if (toCanvas) scaleLayerPct(doc, (W / lw) * 100, (H / lh) * 100);
        else {
            var maxW = W * clamp(num(maxWidthPct, 0.78), 0.1, 1);
            if (lw > maxW) scaleLayerPct(doc, (maxW / lw) * 100, (maxW / lw) * 100);
        }
        b = boxOf(L);
        var tx = W / 2 - (b.left + b.right) / 2;
        var ty = toCanvas ? (H / 2 - (b.top + b.bottom) / 2)
            : (num(topMarginPx, 30) + (b.bottom - b.top) / 2 - (b.top + b.bottom) / 2);
        tryOp(L, "translate", [tx, ty], null);
        tryOp(L, "move", [doc, ElementPlacement.PLACEATBEGINNING], name + " -> top");
        if (!hasAlpha) {
            L.blendMode = blendModeOf("MULTIPLY");
            log("  overlay me transparency nahi -> MULTIPLY (black bg safe rahega)");
        }
        setOpacityPct(L, num(CFG.FRAME.templateOpacity, 100));
        return L;
    }

    function addCaption(doc) {
        var t = trim(CFG.CAPTION.text || "");
        if (!t) return;
        try {
            var L = doc.artLayers.add();
            L.kind = LayerKind.TEXT;
            var ti = L.textItem;
            ti.contents = t;
            ti.color = hexColor(CFG.CAPTION.color);
            ti.size = UnitValue(num(CFG.CAPTION.size, 40), "px");
            if (CFG.CAPTION.font) { try { ti.font = CFG.CAPTION.font; } catch (eF) { warn("Caption font skip"); } }
            try { ti.justification = TextAlignmentType.CENTER; } catch (eJ) {}
            ti.position = [UnitValue(docW(doc) / 2, "px"), UnitValue(docH(doc) - num(CFG.CAPTION.bottomMargin, 46), "px")];
            L.name = "08_CAPTION";
            L.move(doc, ElementPlacement.PLACEATBEGINNING);
        } catch (e) { warn("Caption skip (text layer API): " + e.message); }
    }

    /* =================================================================================
       SECTION 9 — EXPORT
       ================================================================================= */

    function baseName(path, suffix) {
        var n = String(path);
        try { n = new File(path).name; } catch (e) {}
        n = n.replace(/\.[^.]+$/, "");
        n = n.replace(/[^A-Za-z0-9._-]/g, "_");
        if (n.length > 60) n = n.substring(n.length - 60);
        return n + (suffix || "");
    }

    function exportDoc(doc, name) {
        var dir = outFolder(), out = [];
        var sizes = [[num(CFG.CANVAS.w, 1080), num(CFG.CANVAS.h, 1350)]];
        if (CFG.EXPORT.also2x) sizes[sizes.length] = [sizes[0][0] * 2, sizes[0][1] * 2];

        for (var s = 0; s < sizes.length; s++) {
            var tag = sizes.length > 1 ? (s === 0 ? "_1080" : "_2160") : "";
            var d = null;
            try { d = doc.duplicate(name + tag, false); } catch (e) { warn("Export duplicate fail: " + e.message); continue; }
            if (CFG.EXPORT.flattenForExport) tryOp(d, "flatten", [], null);
            try {
                if (Math.abs(d.width.as("px") - sizes[s][0]) > 1) {
                    resampleTo(d, sizes[s][0], sizes[s][1], "export resize");
                }
            } catch (e2) {}

            if (CFG.EXPORT.png) {
                var pn = new File(dir.fsName + "/" + name + tag + ".png");
                try {
                    var o = new ExportOptionsSaveForWeb();
                    o.format = SaveDocumentType.PNG;
                    o.PNG8 = false;
                    o.transparency = true;
                    o.quality = 100;
                    o.includeProfile = false;
                    d.exportDocument(pn, ExportType.SAVEFORWEB, o);
                    out[out.length] = pn.fsName;
                } catch (e3) { warn("PNG export skip: " + e3.message); }
            }
            if (CFG.EXPORT.jpg) {
                try {
                    var jd = d.duplicate("jpg", true);
                    tryOp(jd, "flatten", [], null);
                    var jo = new JPEGSaveOptions();
                    jo.quality = Math.round(clamp(num(CFG.EXPORT.jpgQuality, 10), 1, 12));
                    jo.embedColorProfile = true;
                    jo.formatOptions = FormatOptions.STANDARDBASELINE;
                    var jf = new File(dir.fsName + "/" + name + tag + ".jpg");
                    jd.saveAs(jf, jo, true);
                    out[out.length] = jf.fsName;
                    jd.close(SaveOptions.DONOTSAVECHANGES);
                } catch (e4) { warn("JPG export skip: " + e4.message); }
            }
            try { d.close(SaveOptions.DONOTSAVECHANGES); } catch (e5) {}
        }
        return out;
    }

    function savePSD(doc, name) {
        if (!CFG.EXPORT.psd) return null;
        var f = new File(outFolder().fsName + "/" + name + ".psd");
        try {
            var o = new PhotoshopSaveOptions();
            o.layers = true;
            o.embedColorProfile = true;
            doc.saveAs(f, o, true);
            return f.fsName;
        } catch (e) { warn("PSD save skip: " + e.message); return null; }
    }

    /* =================================================================================
       SECTION 10 — settings file + dialog
       ================================================================================= */

    var NUM = [
        "PHOTOS.gap", "PHOTOS.zoom", "PHOTOS.vAlign",
        "FACE.soften", "FACE.blurRadius", "FACE.keepEdges", "FACE.glow", "FACE.lift",
        "FACE.detail", "FACE.detailRadius",
        "GRADE.strength", "GRADE.contrast",
        "OUTLINE.stickerWidth", "OUTLINE.stickerWidth2", "OUTLINE.edgeWidth", "OUTLINE.softness",
        "FRAME.width", "FRAME.outerPad", "FRAME.templateOpacity",
        "CAPTION.size", "CAPTION.bottomMargin", "EXPORT.jpgQuality",
        "CANVAS.w", "CANVAS.h", "CANVAS.dpi"
    ];
    var STR = [
        "GRADE.preset", "PHOTOS.layout", "PHOTOS.fit", "FACE.noSelectionFallback", "OUTLINE.photo",
        "OUTLINE.stickerColor", "OUTLINE.stickerColor2", "OUTLINE.edgeColor", "FRAME.color",
        "CAPTION.text", "CAPTION.font", "BG_COLOR", "EXPORT.outDir"
    ];
    var BOOL = [
        "FACE.enabled", "FACE.useMySelection", "GRADE.enabled", "GRADE.autoTone", "GRADE.clipToPhoto",
        "FRAME.draw", "FRAME.useTemplateFile", "FRAME.useStickerFile", "USE_GUIDES",
        "EXPORT.png", "EXPORT.jpg", "EXPORT.psd", "EXPORT.also2x", "EXPORT.flattenForExport", "OVERWRITE_OK"
    ];

    function cfgGet(path) {
        var p = path.split("."), o = CFG, i;
        for (i = 0; i < p.length; i++) { if (!o) return ""; o = o[p[i]]; }
        return (o === undefined || o === null) ? "" : o;
    }
    function cfgSet(path, v) {
        var p = path.split("."), o = CFG, i;
        for (i = 0; i < p.length - 1; i++) { if (!o[p[i]]) o[p[i]] = {}; o = o[p[i]]; }
        o[p[p.length - 1]] = v;
    }
    function prefsFile() { return new File(scriptFolder().fsName + "/PeaceDayPost.settings.txt"); }

    function savePrefs() {
        try {
            var lines = [], i;
            for (i = 0; i < NUM.length; i++) lines[lines.length] = NUM[i] + "=" + cfgGet(NUM[i]);
            for (i = 0; i < STR.length; i++) lines[lines.length] = STR[i] + "=" + cfgGet(STR[i]);
            for (i = 0; i < BOOL.length; i++) lines[lines.length] = BOOL[i] + "=" + cfgGet(BOOL[i]);
            lines[lines.length] = "ZONE=" + CFG.PHOTO_ZONE.left + "," + CFG.PHOTO_ZONE.top + "," +
                CFG.PHOTO_ZONE.right + "," + CFG.PHOTO_ZONE.bottom;
            var f = prefsFile();
            f.encoding = "UTF-8";
            if (f.open("w")) { f.lineFeed = "\n"; f.write(lines.join("\n")); f.close(); }
        } catch (e) {}
    }

    function loadPrefs() {
        try {
            var f = prefsFile();
            if (!f.exists) return;
            f.encoding = "UTF-8";
            if (!f.open("r")) return;
            var txt = f.read();
            f.close();
            var rows = String(txt).split("\n"), i, eq, k, v;
            for (i = 0; i < rows.length; i++) {
                var r = trim(rows[i]);
                if (!r || r.charAt(0) === "#") continue;
                eq = r.indexOf("=");
                if (eq < 1) continue;
                k = trim(r.substring(0, eq));
                v = trim(r.substring(eq + 1));
                if (k === "ZONE") {
                    var z = v.split(",");
                    if (z.length === 4) {
                        CFG.PHOTO_ZONE = {
                            left: num(z[0], 96), top: num(z[1], 300),
                            right: num(z[2], 984), bottom: num(z[3], 1264)
                        };
                    }
                    continue;
                }
                if (inList(NUM, k)) cfgSet(k, num(v, cfgGet(k)));
                else if (inList(STR, k)) cfgSet(k, v);
                else if (inList(BOOL, k)) cfgSet(k, v === "true");
            }
        } catch (e) {}
    }

    function buildUI() {
        var dlg = new Window("dialog", "Peace Day Post Kit   —   " + CFG.CANVAS.w + "x" + CFG.CANVAS.h);
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.spacing = 6;
        dlg.margins = 14;

        function panel(t) {
            var p = dlg.add("panel", undefined, t);
            p.orientation = "column"; p.alignChildren = ["left", "center"]; p.margins = 12; p.spacing = 5;
            return p;
        }
        function ctl(parent, label, kind, value, choices, w) {
            var g = parent.add("group");
            g.orientation = "row"; g.alignChildren = ["left", "center"]; g.spacing = 6;
            var st = g.add("statictext", undefined, label);
            st.preferredSize = [150, 20];
            var c, i, sel = 0;
            if (kind === "dd") {
                c = g.add("dropdownlist", undefined, choices);
                for (i = 0; i < choices.length; i++) { if (String(choices[i]) === String(value)) sel = i; }
                c.selection = sel;
            } else if (kind === "chk") {
                c = g.add("checkbox"); c.value = !!value;
            } else {
                c = g.add("edittext", undefined, String(value));
                c.preferredSize = [w || 84, 22];
            }
            return c;
        }

        var p1 = panel("1)  PIC COMBINE");
        var ddLayout = ctl(p1, "Layout", "dd", CFG.PHOTOS.layout, ["auto", "single", "duo", "trio", "quad"]);
        var ddFit = ctl(p1, "Fit", "dd", CFG.PHOTOS.fit, ["cover", "contain", "stretch"]);
        var edVA = ctl(p1, "vAlign 0=btm 1=top", "ed", CFG.PHOTOS.vAlign);
        var edZoom = ctl(p1, "Zoom", "ed", CFG.PHOTOS.zoom);
        var edGap = ctl(p1, "Gap px", "ed", CFG.PHOTOS.gap);

        var p2 = panel("2)  FACE EDIT");
        var ckFace = ctl(p2, "Enable", "chk", CFG.FACE.enabled);
        var edSoft = ctl(p2, "Soften 0-100", "ed", CFG.FACE.soften);
        var edRad = ctl(p2, "Blur radius px", "ed", CFG.FACE.blurRadius);
        var edEdge = ctl(p2, "Keep edges", "ed", CFG.FACE.keepEdges);
        var edGlow = ctl(p2, "Glow 0-100", "ed", CFG.FACE.glow);
        var edLift = ctl(p2, "Skin lift 0-100", "ed", CFG.FACE.lift);
        var edDet = ctl(p2, "Detail 0-100", "ed", CFG.FACE.detail);
        var ckSel = ctl(p2, "Use my selection", "chk", CFG.FACE.useMySelection);
        var ddNoSel = ctl(p2, "No selection ->", "dd", CFG.FACE.noSelectionFallback, ["whole", "skip"]);

        var p3 = panel("3)  COLOR GRADING");
        var ckGrade = ctl(p3, "Enable", "chk", CFG.GRADE.enabled);
        var ddPreset = ctl(p3, "Preset", "dd", CFG.GRADE.preset,
            ["Warm Gold", "Teal-Orange", "Clean Bright", "Moody Film", "Mono Pop", "None"]);
        var edStr = ctl(p3, "Strength 0-100", "ed", CFG.GRADE.strength);
        var edCon = ctl(p3, "Contrast -50/+50", "ed", CFG.GRADE.contrast);
        var ckClip = ctl(p3, "Clip to photo (bg safe)", "chk", CFG.GRADE.clipToPhoto);
        var ckAuto = ctl(p3, "Auto tone first", "chk", CFG.GRADE.autoTone);

        var p4 = panel("4)  OUTLINE");
        var ddOut = ctl(p4, "Type", "dd", CFG.OUTLINE.photo, ["sticker", "edge", "sticker+edge", "none"]);
        var edC1 = ctl(p4, "Ring color", "ed", CFG.OUTLINE.stickerColor, null, 100);
        var edW1 = ctl(p4, "Ring width px", "ed", CFG.OUTLINE.stickerWidth);
        var edC2 = ctl(p4, "Outer ring color", "ed", CFG.OUTLINE.stickerColor2, null, 100);
        var edW2 = ctl(p4, "Outer ring px", "ed", CFG.OUTLINE.stickerWidth2);
        var edEC = ctl(p4, "Edge color", "ed", CFG.OUTLINE.edgeColor, null, 100);
        var edEW = ctl(p4, "Edge width px", "ed", CFG.OUTLINE.edgeWidth);
        var edSf = ctl(p4, "Softness px", "ed", CFG.OUTLINE.softness);

        var p5 = panel("5)  FRAME + TEMPLATE + CAPTION");
        var ckFrame = ctl(p5, "Draw yellow frame", "chk", CFG.FRAME.draw);
        var edFC = ctl(p5, "Frame color", "ed", CFG.FRAME.color, null, 100);
        var edFW = ctl(p5, "Frame width px", "ed", CFG.FRAME.width);
        var ckTpl = ctl(p5, "use assets/frame-template.png", "chk", CFG.FRAME.useTemplateFile);
        var ckStick = ctl(p5, "use assets/title-sticker.png", "chk", CFG.FRAME.useStickerFile);
        var edCap = ctl(p5, "Caption text", "ed", CFG.CAPTION.text, null, 300);

        var p6 = panel("6)  PHOTO ZONE (px)");
        var ckGuides = ctl(p6, "read from guides", "chk", CFG.USE_GUIDES);
        var edZL = ctl(p6, "Left", "ed", CFG.PHOTO_ZONE.left);
        var edZT = ctl(p6, "Top", "ed", CFG.PHOTO_ZONE.top);
        var edZR = ctl(p6, "Right", "ed", CFG.PHOTO_ZONE.right);
        var edZB = ctl(p6, "Bottom", "ed", CFG.PHOTO_ZONE.bottom);

        var p7 = panel("7)  RUN");
        var ddMode = ctl(p7, "Mode", "dd", CFG.BATCH.enabled ? "batch folder" : "pick photos",
            ["pick photos", "current document", "batch folder"]);
        var ckPng = ctl(p7, "Export PNG", "chk", CFG.EXPORT.png);
        var ckJpg = ctl(p7, "Export JPG", "chk", CFG.EXPORT.jpg);
        var ckPsd = ctl(p7, "Save PSD", "chk", CFG.EXPORT.psd);
        var ck2x = ctl(p7, "Also 2x", "chk", CFG.EXPORT.also2x);

        var bg = dlg.add("group");
        bg.orientation = "row"; bg.alignment = ["center", "top"]; bg.spacing = 10;
        var bRun = bg.add("button", undefined, "RUN  —  post banao", { name: "ok" });
        bRun.preferredSize = [240, 30];
        bg.add("button", undefined, "Cancel", { name: "cancel" });

        bRun.onClick = function () {
            CFG.PHOTOS.layout = String(ddLayout.selection.text);
            CFG.PHOTOS.fit = String(ddFit.selection.text);
            CFG.PHOTOS.vAlign = clamp(num(edVA.text, 0.72), 0, 1);
            CFG.PHOTOS.zoom = num(edZoom.text, 1) || 1;
            CFG.PHOTOS.gap = num(edGap.text, 0);

            CFG.FACE.enabled = ckFace.value;
            CFG.FACE.soften = clamp(num(edSoft.text, 0), 0, 100);
            CFG.FACE.blurRadius = num(edRad.text, 4.5);
            CFG.FACE.keepEdges = num(edEdge.text, 12);
            CFG.FACE.glow = clamp(num(edGlow.text, 0), 0, 100);
            CFG.FACE.lift = clamp(num(edLift.text, 0), 0, 100);
            CFG.FACE.detail = clamp(num(edDet.text, 0), 0, 100);
            CFG.FACE.useMySelection = ckSel.value;
            CFG.FACE.noSelectionFallback = String(ddNoSel.selection.text);

            CFG.GRADE.enabled = ckGrade.value;
            CFG.GRADE.preset = String(ddPreset.selection.text);
            CFG.GRADE.strength = clamp(num(edStr.text, 0), 0, 100);
            CFG.GRADE.contrast = clamp(num(edCon.text, 0), -100, 100);
            CFG.GRADE.clipToPhoto = ckClip.value;
            CFG.GRADE.autoTone = ckAuto.value;

            CFG.OUTLINE.photo = String(ddOut.selection.text);
            CFG.OUTLINE.stickerColor = trim(edC1.text) || "#FFFFFF";
            CFG.OUTLINE.stickerWidth = num(edW1.text, 0);
            CFG.OUTLINE.stickerColor2 = trim(edC2.text) || "#101010";
            CFG.OUTLINE.stickerWidth2 = num(edW2.text, 0);
            CFG.OUTLINE.edgeColor = trim(edEC.text) || "#FFF200";
            CFG.OUTLINE.edgeWidth = num(edEW.text, 0);
            CFG.OUTLINE.softness = num(edSf.text, 0);

            CFG.FRAME.draw = ckFrame.value;
            CFG.FRAME.color = trim(edFC.text) || "#FFF200";
            CFG.FRAME.width = num(edFW.text, 22);
            CFG.FRAME.useTemplateFile = ckTpl.value;
            CFG.FRAME.useStickerFile = ckStick.value;
            CFG.CAPTION.text = trim(edCap.text);

            CFG.USE_GUIDES = ckGuides.value;
            CFG.PHOTO_ZONE.left = num(edZL.text, 96);
            CFG.PHOTO_ZONE.top = num(edZT.text, 300);
            CFG.PHOTO_ZONE.right = num(edZR.text, num(CFG.CANVAS.w, 1080) - 96);
            CFG.PHOTO_ZONE.bottom = num(edZB.text, num(CFG.CANVAS.h, 1350) - 86);

            CFG.EXPORT.png = ckPng.value;
            CFG.EXPORT.jpg = ckJpg.value;
            CFG.EXPORT.psd = ckPsd.value;
            CFG.EXPORT.also2x = ck2x.value;

            var m = String(ddMode.selection.text);
            CFG.BATCH.enabled = (m === "batch folder");
            CFG.__mode = m;
            CFG.__ok = true;
            savePrefs();
            dlg.close(1);
        };
        return dlg.show() === 1;
    }

    /* =================================================================================
       SECTION 11 — PIPELINE
       ================================================================================= */

    function collectEditableLayers(doc) {
        var out = [], i, L, n;
        try {
            for (i = 0; i < doc.artLayers.length; i++) {
                L = doc.artLayers[i];
                try { if (L.isBackgroundLayer || !L.visible) continue; } catch (e0) {}
                try { if (L.kind !== LayerKind.NORMAL) continue; } catch (e1) {}
                n = String(L.name);
                if (n.indexOf("00_BG") === 0 || n.indexOf("02_") === 0 || n.indexOf("03_") === 0 ||
                    n.indexOf("04_") === 0 || n.indexOf("05_") === 0 || n.indexOf("06_") === 0 ||
                    n.indexOf("07_") === 0 || n.indexOf("08_") === 0) continue;
                out[out.length] = L;
            }
        } catch (e) {}
        return out;
    }

    function compose(doc, files) {
        var box = zoneFromGuides(doc) || {
            left: CFG.PHOTO_ZONE.left, top: CFG.PHOTO_ZONE.top,
            right: CFG.PHOTO_ZONE.right, bottom: CFG.PHOTO_ZONE.bottom
        };
        var W = docW(doc), H = docH(doc);
        box.left = Math.max(0, num(box.left, 0));
        box.top = Math.max(0, num(box.top, 0));
        box.right = Math.min(W, num(box.right, W));
        box.bottom = Math.min(H, num(box.bottom, H));

        ensureBlackBG(doc);
        ensure8BitRGB(doc);

        var photos = [], zones = makeZones(box, files.length), i;
        try { doc.activeLayer = doc.layers[0]; } catch (e) {}
        for (i = 0; i < files.length; i++) {
            var L = placePhotoInBox(doc, files[i], zones[i], i);
            if (L) photos[photos.length] = L;
        }
        if (!photos.length) { warn("Koi photo place nahi hui."); return null; }
        return { photos: photos, zones: zones };
    }

    function finish(doc, built, faceSel) {
        var mask = photoMaskChannel(doc, built.photos, CFG.MASK_CHANNEL);
        faceEdit(doc, built.photos, faceSel, mask);
        applyGrade(doc, built.photos);
        addOutlines(doc, built.photos, built.zones);
        if (mask) { try { mask.remove(); } catch (e) {} }

        // frame/template/caption grade ke BAAD -> yellow aur black pure rehte hain
        var tpl = CFG.FRAME.useTemplateFile ? asset("frame-template.png") : null;
        if (tpl) overlayFile(doc, tpl, "07_FRAME_TEMPLATE", true, 0, 1);
        else drawFrame(doc);
        if (CFG.FRAME.useStickerFile) {
            var stk = asset("title-sticker.png");
            if (stk) overlayFile(doc, stk, "08_TITLE_STICKER", false, 34, 0.78);
        }
        addCaption(doc);
        clearSel(doc);
    }

    function runOne(files, name) {
        var doc = newPostDoc();
        APP.activeDocument = doc;
        ensureCanvas(doc);
        var built = compose(doc, files);
        if (!built) return null;
        finish(doc, built, null);
        return { doc: doc, exports: exportDoc(doc, name), psd: savePSD(doc, name) };
    }

    function runOnCurrentDoc() {
        var doc = APP.activeDocument;
        if (!doc) { APP.alert("Koi document open nahi hai."); return null; }
        APP.activeDocument = doc;
        ensureCanvas(doc);
        var photos = collectEditableLayers(doc);
        if (!photos.length) {
            APP.alert("Current document me koi editable raster layer nahi (Background layer skip hoti hai).\nMode 'pick photos' use karein.");
            return null;
        }
        var faceSel = null;
        if (CFG.FACE.useMySelection) faceSel = stashSelection(doc, "PD_FACESEL");
        var zones = [], i;
        for (i = 0; i < photos.length; i++) { try { zones[zones.length] = boxOf(photos[i]); } catch (e) {} }
        finish(doc, { photos: photos, zones: zones }, faceSel);
        if (faceSel) { try { faceSel.remove(); } catch (e2) {} }
        var dn = String(doc.name);
        try { if (doc.fullName) dn = String(doc.fullName.fsName || doc.fullName); } catch (eN) {}
        var nm = baseName(dn, CFG.EXPORT.suffix).replace(/[^A-Za-z0-9._-]/g, "_");
        return { doc: doc, exports: exportDoc(doc, nm), psd: savePSD(doc, nm) };
    }

    function listImages(folder) {
        var all = folder.getFiles(), out = [], i;
        for (i = 0; i < all.length; i++) { if (all[i] instanceof File && isImageFile(all[i])) out[out.length] = all[i]; }
        return out;
    }

    function runBatch() {
        var folder = null;
        if (CFG.BATCH.folder && CFG.BATCH.folder !== "auto" && CFG.BATCH.folder !== "undefined") {
            folder = new Folder(CFG.BATCH.folder);
        }
        if (!folder || !folder.exists) folder = Folder.selectDialog("Photos ka folder chunein");
        if (!folder) return;
        var all = listImages(folder);
        if (!all.length) { APP.alert("Folder me image nahi mili:\n" + folder.fsName); return; }

        var want = String(CFG.PHOTOS.layout);
        var groupN = want === "duo" ? 2 : want === "trio" ? 3 : want === "quad" ? 4 : 1;
        var made = 0, i, k, chunk, names, r;
        for (i = 0; i < all.length; i += groupN) {
            chunk = []; names = [];
            for (k = 0; k < groupN && (i + k) < all.length; k++) {
                chunk[chunk.length] = all[i + k].fsName;
                names[names.length] = all[i + k].name.replace(/\.[^.]+$/, "");
            }
            r = runOne(chunk, baseName("PeaceDay_" + names.join("_"), ""));
            if (r) { made++; try { r.doc.close(SaveOptions.DONOTSAVECHANGES); } catch (e) {} }
        }
        APP.alert("BATCH DONE — " + made + " post(s).\nOutput: " + outFolder().fsName);
    }

    function report(r) {
        var msg = "Peace Day post ready ✔\n\n", i;
        if (r && r.exports && r.exports.length) {
            msg += "Export:\n";
            for (i = 0; i < r.exports.length; i++) msg += "  " + r.exports[i] + "\n";
        } else msg += "Koi export nahi hua — EXPORT settings dekh lein.\n";
        if (r && r.psd) msg += "\nLayered PSD (tweak ke liye):\n  " + r.psd + "\n";
        var bad = [], j;
        for (j = 0; j < LOGS.length; j++) { if (LOGS[j].charAt(0) === "!") bad[bad.length] = LOGS[j].substring(2); }
        if (bad.length) msg += "\nNotes / skipped:\n  " + bad.join("\n  ") + "\n";
        msg += "\nLayers 02-05 = retouch + grade washes: opacity se live tune kar sakte ho.";
        log(msg);
        APP.alert(msg);
    }

    function main() {
        loadPrefs();
        CFG.__ok = false;
        CFG.__mode = null;
        if (CFG.SHOW_UI) {
            var ok = false;
            try { ok = buildUI(); }
            catch (eUI) { warn("Dialog nahi bana (" + eUI.message + ") — CFG values se run."); ok = true; CFG.__mode = "pick photos"; }
            if (!ok && !CFG.__ok) return;
        }
        if (!CFG.__mode) CFG.__mode = CFG.BATCH.enabled ? "batch folder" : "pick photos";

        var origDD = DialogModes.ALL;
        usePixels();
        try { origDD = APP.displayDialogs; } catch (e0) {}
        APP.displayDialogs = DialogModes.NO;

        try {
            if (CFG.BATCH.enabled || CFG.__mode === "batch folder") { runBatch(); return; }

            if (CFG.__mode === "current document") {
                var rc = runOnCurrentDoc();
                if (rc) report(rc);
                return;
            }

            var files = choosePhotoFiles(desiredPhotoCount());
            if (!files.length) return;
            var name = files.length === 1 ? baseName(files[0], CFG.EXPORT.suffix) : "PeaceDay_" + stamp();
            report(runOne(files, name));
        } catch (e) {
            APP.alert("ERROR: " + (e && e.message ? e.message : e) +
                "\n\nCheck: Image > Mode = RGB Color, Bits/Channel = 8, document locked nahi, " +
                "aur photo layer 'Background' nahi honi chahiye.");
        } finally {
            try { if (APP.activeDocument) APP.activeDocument.selection.deselect(); } catch (e2) {}
            try { APP.displayDialogs = origDD; } catch (e3) {}
            restoreUnits();
        }
    }

    main();

}());
