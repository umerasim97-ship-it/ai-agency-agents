/* =====================================================================================
   PEACE DAY — ZONE MEASURER (helper)   v1.0
   -------------------------------------------------------------------------------------
   Kaam: aapke frame/template document me yellow (ya kisi bhi) frame line ko detect karke
   PHOTO ZONE (left, top, right, bottom) nikaal leta hai aur PeaceDayPost.settings.txt
   me likh deta hai. Uske baad PeaceDayPost.jsx guides ke bina bhi sahi jagah photo dalega.

   Use:
     1. Apna frame/template PNG Photoshop me open karein (1080x1350 template).
     2. File > Scripts > Browse -> PeaceDay_MeasureZone.jsx
     3. Alert me values aayengi; "Yes" = settings file me save kar de.

   Kaise kaam karta hai: canvas ke kuch points pe 1px select -> Select > Similar
   -> selection bounds = frame ka bbox. Jo point sabse zyada plausible bounds de, wahi jeetta hai.
   ===================================================================================== */

(function measureZone() {

    var APP = app;
    if (!APP.activeDocument) { APP.alert("Pehle apna frame/template document open karein."); return; }
    var doc = APP.activeDocument;
    var u = APP.preferences.rulerUnits;
    APP.preferences.rulerUnits = Units.PIXELS;
    APP.displayDialogs = DialogModes.NO;

    function px(v) { return parseFloat(v.as("px")); }
    var W = px(doc.width), H = doc.height;
    var area = W * H;

    // frame lines ke likely positions (aapke template ke ratio se)
    var cands = [
        [0.068, 0.50], [0.930, 0.50], [0.50, 0.193], [0.50, 0.961],
        [0.068, 0.30], [0.930, 0.30], [0.068, 0.70], [0.930, 0.70],
        [0.50, 0.185], [0.50, 0.955], [0.10, 0.50], [0.90, 0.50],
        [0.068, 0.068], [0.930, 0.068], [0.068, 0.930], [0.930, 0.930]
    ];

    var best = null, bestArea = 0, i;
    for (i = 0; i < cands.length; i++) {
        try {
            var x = Math.round(cands[i][0] * W), y = Math.round(cands[i][1] * H);
            doc.selection.deselect();
            doc.selection.select([x, y, x + 1, y + 1], SelectionType.REPLACE, 0, false);
            try { doc.selection.similar(28, false); } catch (e1) { continue; }
            var b = doc.selection.bounds;
            var l = px(b[0]), t = px(b[1]), r = px(b[2]), bo = px(b[3]);
            var a = (r - l) * (bo - t);
            // poora canvas na ho, aur kaafi bara ho
            if (a > area * 0.10 && a < area * 0.995 && r - l > 200 && bo - t > 200) {
                if (a > bestArea) { bestArea = a; best = { left: l, top: t, right: r, bottom: bo }; }
            }
        } catch (e) { /* next candidate */ }
    }

    try { doc.selection.deselect(); } catch (e2) {}
    APP.preferences.rulerUnits = u;

    if (!best) {
        APP.alert("Frame bbox detect nahi ho paya.\n\nYe karein:\n - Frame document me 4 guides daal dein (frame ke andar ki lines pe)\n   aur PeaceDayPost.jsx me USE_GUIDES = true rakhein, ya\n - PeaceDayPost.jsx ke dialog me PHOTO ZONE manually bhar dein.");
        return;
    }

    var thick = Math.max(6, Math.round(W * 0.022));
    var zone = {
        left: Math.round(best.left + thick),
        top: Math.round(best.top + thick),
        right: Math.round(best.right - thick),
        bottom: Math.round(best.bottom - thick)
    };

    var msg = "Frame bbox  : " + Math.round(best.left) + ", " + Math.round(best.top) + " -> " +
        Math.round(best.right) + ", " + Math.round(best.bottom) + "\n" +
        "Line thickness (est): " + thick + " px\n\n" +
        "PHOTO ZONE (inner):\n  left=" + zone.left + "  top=" + zone.top +
        "\n  right=" + zone.right + "  bottom=" + zone.bottom + "\n\nSettings file me save kar dein?";

    if (confirm(msg)) {
        try {
            var scriptDir = new File($.fileName).parent;
            var f = new File(scriptDir.fsName + "/PeaceDayPost.settings.txt");
            var lines = [], existed = f.exists, txt = "", k;
            if (existed) {
                f.encoding = "UTF-8";
                if (f.open("r")) { txt = f.read(); f.close(); }
                var rows = String(txt).split("\n"), j;
                for (j = 0; j < rows.length; j++) {
                    var r2 = String(rows[j]);
                    if (r2.indexOf("ZONE=") !== 0) lines[lines.length] = r2;
                }
            } else {
                // chhota default file — baaki values script ke CFG se aa jayengi
                lines[lines.length] = "USE_GUIDES=false";
            }
            lines[lines.length] = "ZONE=" + zone.left + "," + zone.top + "," + zone.right + "," + zone.bottom;
            f.encoding = "UTF-8";
            if (f.open("w")) { f.lineFeed = "\n"; f.write(lines.join("\n")); f.close(); }
            APP.alert("Saved ✔  " + f.fsName + "\n\nAb PeaceDayPost.jsx chalayein — photo isi zone me jayegi.");
        } catch (e) {
            APP.alert("Save nahi ho saka: " + e.message + "\n\nYe values manually dialog me bhar dein:\nleft=" +
                zone.left + " top=" + zone.top + " right=" + zone.right + " bottom=" + zone.bottom);
        }
    }
}());
