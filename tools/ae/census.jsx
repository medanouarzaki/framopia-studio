/*
 * A read-only census of a built .aep, for comparing one build against another.
 *
 * Session 1 of Block 10 read a built project back out of After Effects with a
 * throwaway script and threw it away. The comparison it performed — is every
 * placeholder filled, is every font the one the client declares, is the
 * watermark where the plan says — is the spine of the golden run, so it is a
 * tool rather than a session's scratch file.
 *
 * **It opens nothing, sets nothing and saves nothing.** In particular it never
 * writes `TextDocument.font`: a name that is set but not installed is added to
 * `app.fonts.allFonts` for the rest of the application session, which would
 * make the next font check report a face the machine does not have. So the
 * project it describes must already be open, and it refuses rather than
 * opening one — a census that opened a file would replace whatever the user
 * had, and a census is not worth that.
 *
 * ES3 only.
 */

function framopiaCensusReadValue(layer, group, prop) {
    try {
        return layer.property(group).property(prop).valueAtTime(0, false);
    } catch (e) {
        return null;
    }
}

function framopiaCensusAudio(layer) {
    var out = { hasAudio: false, levelDb: null };
    try {
        out.hasAudio = layer.hasAudio === true;
    } catch (e1) {
        out.hasAudio = false;
    }
    var lv = framopiaCensusReadValue(layer, 'Audio', 'Audio Levels');
    if (lv !== null) out.levelDb = [lv[0], lv[1]];
    return out;
}

function framopiaCensusSource(layer, info) {
    var src;
    try {
        src = layer.source;
    } catch (e) {
        info.sourceName = null;
        return;
    }
    if (src === null || typeof src === 'undefined') {
        info.sourceName = null;
        return;
    }
    info.sourceName = String(src.name);
    info.sourceIsComp = src instanceof CompItem;
    if (src instanceof FootageItem) {
        info.sourceFile = src.file ? String(src.file.fsName) : null;
        try {
            info.alphaMode = src.mainSource.alphaMode;
        } catch (alphaError) {
            info.alphaMode = null;
        }
    }
}

function framopiaCensusText(layer, info) {
    info.kind = 'text';
    try {
        var td = layer.property('Source Text').valueAtTime(0, false);
        info.text = String(td.text);
        info.font = String(td.font);
        info.fontSize = td.fontSize;
        info.tracking = td.tracking;
        info.leading = td.autoLeading === true ? null : td.leading;
        info.autoLeading = td.autoLeading;
        info.justificationRaw = td.justification;
        info.fillColor = td.applyFill
            ? [td.fillColor[0], td.fillColor[1], td.fillColor[2]]
            : null;
        info.applyFill = td.applyFill;
    } catch (e) {
        info.text = null;
        info.font = null;
        info.textUnreadable = String(e);
    }
}

function framopiaCensusLayer(layer) {
    var info = { name: String(layer.name), index: layer.index };
    try { info.enabled = layer.enabled; } catch (e0) { info.enabled = null; }
    try { info.inPoint = layer.inPoint; } catch (e1) { info.inPoint = null; }
    try { info.outPoint = layer.outPoint; } catch (e2) { info.outPoint = null; }
    try { info.startTime = layer.startTime; } catch (e3) { info.startTime = null; }
    try { info.stretch = layer.stretch; } catch (e4) { info.stretch = null; }
    try { info.parentName = layer.parent ? String(layer.parent.name) : null; } catch (e5) { info.parentName = null; }

    framopiaCensusSource(layer, info);

    var p = framopiaCensusReadValue(layer, 'Transform', 'Position');
    info.position = p === null ? null : [p[0], p[1]];
    var s = framopiaCensusReadValue(layer, 'Transform', 'Scale');
    info.scale = s === null ? null : [s[0], s[1]];
    var a = framopiaCensusReadValue(layer, 'Transform', 'Anchor Point');
    info.anchorPoint = a === null ? null : [a[0], a[1]];

    if (layer instanceof TextLayer) {
        framopiaCensusText(layer, info);
    } else if (info.sourceName === null) {
        info.kind = 'other';
    } else {
        info.kind = 'av';
    }

    var au = framopiaCensusAudio(layer);
    info.hasAudio = au.hasAudio;
    info.audioLevelDb = au.levelDb;
    return info;
}

function framopiaCensus(optionsPath, resultPath) {
    var out = {};
    var stage = 'read-options';
    try {
        var opts = framopiaCensusReadJson(optionsPath);

        stage = 'check-project';
        out.projectFile = app.project && app.project.file ? String(app.project.file.fsName) : null;
        if (out.projectFile === null || out.projectFile !== opts.aepPath) {
            throw new Error(
                'this census reads the project After Effects already has open, and that is ' +
                    (out.projectFile === null ? 'an unsaved project' : out.projectFile) +
                    ' rather than ' + opts.aepPath +
                    '. Open that file in After Effects and run this again; the census never ' +
                    'opens a project itself, because doing so would replace whatever is open.'
            );
        }

        stage = 'census';
        out.aeVersion = String(app.version);
        out.projectDirty = app.project.dirty;
        out.numItems = app.project.numItems;

        var names = framopiaInstalledFontNames();
        out.fontNameCount = names === null ? null : names.length;

        var comps = [];
        var footageItems = [];
        var i;
        var j;
        for (i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem) {
                var c = {
                    name: String(item.name),
                    width: item.width,
                    height: item.height,
                    duration: item.duration,
                    frameRate: item.frameRate,
                    numLayers: item.numLayers,
                    layers: []
                };
                for (j = 1; j <= item.numLayers; j++) {
                    c.layers.push(framopiaCensusLayer(item.layer(j)));
                }
                comps.push(c);
            } else if (item instanceof FootageItem) {
                footageItems.push({
                    name: String(item.name),
                    file: item.file ? String(item.file.fsName) : null,
                    width: item.width,
                    height: item.height
                });
            }
        }
        out.ok = true;
        out.comps = comps;
        out.footageItems = footageItems;
    } catch (err) {
        out.ok = false;
        out.stage = stage;
        out.message = String(err);
    }

    var f = new File(resultPath);
    f.encoding = 'UTF-8';
    f.open('w');
    f.write(JSON.stringify(out));
    f.close();
    return out.ok ? 'ok' : 'error';
}

function framopiaCensusReadJson(p) {
    var f = new File(p);
    if (!f.exists) throw new Error('options file not found: ' + p);
    f.encoding = 'UTF-8';
    f.open('r');
    var text = f.read();
    f.close();
    return eval('(' + text + ')');
}
