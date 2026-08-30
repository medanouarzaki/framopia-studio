/*
 * How far the shadow layer's ink reaches beyond the word it sits behind.
 *
 * The shadow is a duplicate of the text layer, offset by a Transform effect and
 * softened by a Fast Box Blur. Neither reach is knowable from the offset alone:
 * the blur spreads further than the offset moves, and `sourceRectAtTime` on the
 * layer does not include what an effect does to it. So this measures the comp
 * itself — it asks each template comp for its own bounds through a temporary
 * parent comp, which is the only way to see the effect's contribution.
 *
 * Read-only on the library: it imports the comps rather than opening the file.
 *
 * ES3 only.
 */

function framopiaMeasureShadow(optionsPath, outPath) {
    var stage = 'read-options';
    var result;
    var probe = null;
    try {
        var o = framopiaReadJsonFile(optionsPath);

        stage = 'import-library';
        app.beginUndoGroup('Framopia shadow measurement');
        var aep = new File(o.aepPath);
        if (!aep.exists) throw new Error('template library not found: ' + o.aepPath);
        app.project.importFile(new ImportOptions(aep));

        stage = 'measure';
        var rows = [];
        var i;
        for (i = 0; i < o.comps.length; i++) {
            var spec = o.comps[i];
            var comp = framopiaFindComp(spec.id);
            if (comp === null) throw new Error('no comp named ' + spec.id);

            probe = app.project.items.addComp(
                'framopia_shadow_probe', comp.width, comp.height, 1, comp.duration, comp.frameRate
            );
            var layer = probe.layers.add(comp);

            /* The word set on both layers, so the two rects are comparable. */
            var main = framopiaFindLayerByName(comp, spec.placeholder);
            var shadow = framopiaFindLayerByName(comp, spec.shadow);
            if (main === null || shadow === null) {
                throw new Error(spec.id + ' is missing ' + spec.placeholder + ' or ' + spec.shadow);
            }
            framopiaSetPlain(main, spec.text);
            framopiaSetPlain(shadow, spec.text);

            var withShadow = layer.sourceRectAtTime(comp.duration / 2, true);
            shadow.enabled = false;
            var withoutShadow = layer.sourceRectAtTime(comp.duration / 2, true);
            shadow.enabled = true;

            rows.push({
                comp: spec.id,
                text: spec.text,
                withShadow: {
                    top: withShadow.top, left: withShadow.left,
                    width: withShadow.width, height: withShadow.height
                },
                withoutShadow: {
                    top: withoutShadow.top, left: withoutShadow.left,
                    width: withoutShadow.width, height: withoutShadow.height
                },
                extraLeft: withoutShadow.left - withShadow.left,
                extraTop: withoutShadow.top - withShadow.top,
                extraRight: (withShadow.left + withShadow.width) - (withoutShadow.left + withoutShadow.width),
                extraBottom: (withShadow.top + withShadow.height) - (withoutShadow.top + withoutShadow.height)
            });

            probe.remove();
            probe = null;
        }

        result = { ok: true, aeVersion: app.version, measuredAt: new Date().toString(), rows: rows };
    } catch (err) {
        result = { ok: false, stage: stage, message: String(err) };
    }

    try {
        if (probe !== null) probe.remove();
    } catch (removeError) {
        result.probeLeftBehind = String(removeError);
    }
    try {
        app.endUndoGroup();
    } catch (undoError) {
        // never opened
    }

    framopiaWriteJsonFile(outPath, result);
    return result.ok ? 'ok' : 'error';
}

function framopiaFindComp(name) {
    var i;
    for (i = 1; i <= app.project.numItems; i++) {
        var it = app.project.item(i);
        if (it instanceof CompItem && it.name === name) return it;
    }
    return null;
}

function framopiaFindLayerByName(comp, name) {
    var i;
    for (i = 1; i <= comp.numLayers; i++) {
        if (comp.layer(i).name === name) return comp.layer(i);
    }
    return null;
}

function framopiaSetPlain(layer, value) {
    var prop = layer.property('Source Text');
    var doc = prop.value;
    doc.text = value;
    prop.setValue(doc);
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
