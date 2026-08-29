/*
 * How wide a given string sets, in a given face, at a given size.
 *
 * `SUBTITLE_SAFE_WIDTH` is 1940 px and nothing had ever checked a real keyword
 * against it in the emphasis face, which did not exist when the constant was
 * chosen. `wrap:survey` measures the subtitle track; this measures one string
 * in one face on demand, which is what a ratio decision needs.
 *
 * Driven over AppleScript `DoScript`; it takes an options file and writes a
 * result file, and shows no dialog — `DoScript` is synchronous and a modal
 * would block After Effects until someone walked to the machine.
 *
 * It adds one temporary composition to the project already open and removes it
 * again. **It never saves.** After Effects marks the project modified as soon
 * as anything is added and that flag is read-only from a script.
 *
 * ES3 only.
 */

function framopiaMeasureWidths(optionsPath, outPath) {
    var stage = 'read-options';
    var result;
    var comp = null;

    try {
        var o = framopiaReadJsonFile(optionsPath);

        stage = 'check-fonts';
        var installed = framopiaInstalledFontNames();
        if (installed === null) {
            throw new Error('this After Effects cannot list its fonts');
        }
        var wanted = [];
        var i;
        for (i = 0; i < o.cases.length; i++) {
            wanted.push(o.cases[i].font);
        }
        var missing = framopiaMissingFonts(wanted, installed);
        if (missing.length > 0) {
            throw new Error('this machine does not have ' + missing.join(', '));
        }

        stage = 'measure';
        app.beginUndoGroup('Framopia width measurement');
        comp = app.project.items.addComp('framopia_width_probe', 2160, 1200, 1, 2, 30);
        var layer = comp.layers.addText('measure');
        var rows = [];
        for (i = 0; i < o.cases.length; i++) {
            var c = o.cases[i];
            var prop = layer.property('Source Text');
            var doc = prop.value;
            doc.text = c.text;
            doc.font = c.font;
            doc.fontSize = c.size;
            prop.setValue(doc);
            var r = layer.sourceRectAtTime(comp.duration / 2, false);
            rows.push({
                id: c.id,
                text: c.text,
                font: c.font,
                fontReadBack: String(layer.property('Source Text').value.font),
                size: c.size,
                width: r.width,
                height: r.height,
                top: r.top,
                left: r.left
            });
        }

        result = {
            ok: true,
            aeVersion: app.version,
            measuredAt: new Date().toString(),
            safeWidth: o.safeWidth,
            cases: rows
        };
    } catch (err) {
        result = { ok: false, stage: stage, message: String(err) };
    }

    try {
        if (comp !== null) comp.remove();
    } catch (removeError) {
        result.compLeftBehind = String(removeError);
    }
    try {
        app.endUndoGroup();
    } catch (undoError) {
        // The group was never opened, which is the only way this throws.
    }

    framopiaWriteJsonFile(outPath, result);
    return result.ok ? 'ok' : 'error';
}

function framopiaReadJsonFile(p) {
    var f = new File(p);
    if (!f.exists) throw new Error('options file not found: ' + p);
    f.encoding = 'UTF-8';
    f.open('r');
    var text = f.read();
    f.close();
    return eval('(' + text + ')');
}

function framopiaWriteJsonFile(p, value) {
    var f = new File(p);
    f.encoding = 'UTF-8';
    f.open('w');
    f.write(JSON.stringify(value, null, 2));
    f.close();
}
