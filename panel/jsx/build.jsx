/*
 * Places one template instance in a master comp, per ARCHITECTURE §2. The seed
 * of the real builder: it does exactly what a subtitle card needs and nothing
 * more.
 *
 * ES3 only — var, no const/let, no arrow functions, no Array.prototype.map.
 * json2.jsx installs JSON.stringify when the host lacks it.
 *
 * Contract with the driver: every AE-DOM mutation is inside a stage, and a
 * stage that fails returns {ok:false, stage, message} rather than throwing.
 * The driver reads the result from a file because DoScript returns only a
 * short string.
 *
 * Nothing here decides anything. Timings, text and target geometry all arrive
 * computed in the options file; this script places, measures, and reports what
 * AE actually did. Logic that could live in the service does not live here.
 */
function framopiaBuild(optionsPath, outPath) {
    var stage = 'start';
    var result;
    var notes = {};

    function fail(message) {
        return { ok: false, stage: stage, message: String(message) };
    }

    function readOptions(p) {
        var f = new File(p);
        if (!f.exists) throw new Error('options file not found: ' + p);
        f.encoding = 'UTF-8';
        f.open('r');
        var text = f.read();
        f.close();
        return eval('(' + text + ')');
    }

    function findItem(name) {
        for (var i = 1; i <= app.project.numItems; i++) {
            if (app.project.item(i).name === name) return app.project.item(i);
        }
        return null;
    }

    function findLayer(comp, name) {
        for (var i = 1; i <= comp.numLayers; i++) {
            if (comp.layer(i).name === name) return comp.layer(i);
        }
        return null;
    }

    /* Every animated property, so keyframe survival can be compared across a
     * duplication without knowing where the animation lives. */
    function animatedOf(group, into, prefix) {
        var n;
        try { n = group.numProperties; } catch (e) { return; }
        for (var i = 1; i <= n; i++) {
            var p;
            try { p = group.property(i); } catch (e2) { continue; }
            if (!p) continue;
            var leaf = false;
            try { leaf = p.propertyType === PropertyType.PROPERTY; } catch (e3) { leaf = false; }
            if (leaf) {
                var k = 0;
                try { k = p.numKeys; } catch (e4) { k = 0; }
                if (k > 0) into.push({ path: prefix + p.name, keyframes: k });
            } else {
                animatedOf(p, into, prefix + p.name + '/');
            }
        }
    }

    function textStyleOf(layer, atTime) {
        var td = layer.property('Source Text').valueAtTime(atTime, false);
        return { font: td.font, fontSize: td.fontSize, justificationRaw: td.justification, tracking: td.tracking };
    }

    try {
        var o = readOptions(optionsPath);

        stage = 'new-project';
        /*
         * **Never discard unsaved work.**
         *
         * This closed whatever the user had open with DO_NOT_SAVE_CHANGES — the
         * same defect session 22 removed from the template audit, and the same
         * class as a diagnostic that writes to the plan. Nothing this script
         * produces is worth someone's unsaved morning.
         *
         * An unreadable `dirty` is treated as dirty: refusing costs a re-run, guessing costs the user's work.
         */
        if (app.project) {
            var openFile = null;
            try {
                openFile = app.project.file;
            } catch (eFile) {
                openFile = null;
            }
            var isDirty = true;
            try {
                isDirty = app.project.dirty === true;
            } catch (eDirty) {
                isDirty = true;
            }
            if (isDirty) {
                throw new Error(
                    'the open After Effects project has unsaved changes' +
                        (openFile === null ? ' and has never been saved' : ': ' + openFile.fsName) +
                        '. This will not close it. Save or close it yourself, then run it again.'
                );
            }
            app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
        }
        app.newProject();

        stage = 'import-footage';
        var footageFile = new File(o.footagePath);
        if (!footageFile.exists) throw new Error('footage not found: ' + o.footagePath);
        var footage = app.project.importFile(new ImportOptions(footageFile));

        stage = 'master-comp';
        // frameRate is passed as the exact rational the reels use; AE stores
        // its own approximation and the driver compares the two.
        var master = app.project.items.addComp(
            o.masterName, o.masterWidth, o.masterHeight, 1, o.reelDurationS, o.frameRate
        );
        master.layers.add(footage).startTime = 0;
        notes.masterFrameRate = master.frameRate;

        stage = 'import-templates';
        var aepFile = new File(o.templatesAepPath);
        if (!aepFile.exists) throw new Error('template library not found: ' + o.templatesAepPath);
        var beforeCount = app.project.numItems;
        app.project.importFile(new ImportOptions(aepFile));
        var imported = [];
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            imported.push({ name: it.name, type: (it instanceof CompItem) ? 'comp' : (it instanceof FolderItem ? 'folder' : 'footage') });
        }
        notes.importedItemCount = app.project.numItems - beforeCount;
        notes.importedItems = imported;

        stage = 'find-template';
        var template = findItem(o.templateId);
        if (!template || !(template instanceof CompItem)) {
            throw new Error('no comp named "' + o.templateId + '" in ' + o.templatesAepPath);
        }
        var originalBefore = {
            name: template.name,
            numLayers: template.numLayers,
            animated: []
        };
        var originalLayer = findLayer(template, o.placeholder);
        if (!originalLayer) {
            throw new Error('comp "' + o.templateId + '" has no layer named "' + o.placeholder + '"');
        }
        animatedOf(originalLayer, originalBefore.animated, '');
        originalBefore.sourceText = String(originalLayer.property('Source Text').value.text);
        originalBefore.style = textStyleOf(originalLayer, template.duration / 2);

        stage = 'duplicate-template';
        var instance = template.duplicate();
        instance.name = o.instanceName;

        stage = 'set-source-text';
        var txt = findLayer(instance, o.placeholder);
        if (!txt) throw new Error('duplicated comp has no layer named "' + o.placeholder + '"');
        var doc = txt.property('Source Text').value;
        doc.text = o.text;
        txt.property('Source Text').setValue(doc);

        stage = 'add-to-master';
        var layer = master.layers.add(instance);

        stage = 'retime';
        // outroS is 0, so the structure is intro + hold with a hard cut out.
        layer.startTime = o.inPointS;
        layer.inPoint = o.inPointS;
        layer.outPoint = o.outPointS;

        stage = 'position';
        // The anchor AE gave this comp layer is read back rather than assumed:
        // the offset from it to the placeholder's baseline is what decides the
        // layer's position, and assuming a centred anchor is exactly the guess
        // this session exists to avoid.
        var anchor = layer.property('Anchor Point').value;
        var targetX = o.targetBaselineX;
        var targetY = o.targetBaselineY;
        var posX = targetX - (o.placeholderBaselineX - anchor[0]);
        var posY = targetY - (o.placeholderBaselineY - anchor[1]);
        layer.property('Position').setValue([posX, posY]);

        stage = 'measure';
        var animatedAfter = [];
        animatedOf(txt, animatedAfter, '');
        var placedAnchor = layer.property('Anchor Point').value;
        var placedPos = layer.property('Position').value;
        var originalAfter = { numLayers: template.numLayers, animated: [] };
        animatedOf(originalLayer, originalAfter.animated, '');
        originalAfter.sourceText = String(originalLayer.property('Source Text').value.text);
        originalAfter.style = textStyleOf(originalLayer, template.duration / 2);

        result = {
            ok: true,
            aeVersion: app.version,
            master: {
                name: master.name,
                frameRate: master.frameRate,
                requestedFrameRate: o.frameRate,
                width: master.width,
                height: master.height,
                duration: master.duration
            },
            imported: { count: notes.importedItemCount, items: notes.importedItems },
            instance: { name: instance.name, width: instance.width, height: instance.height },
            layer: {
                name: layer.name,
                index: layer.index,
                inPoint: layer.inPoint,
                outPoint: layer.outPoint,
                startTime: layer.startTime,
                requestedInPoint: o.inPointS,
                requestedOutPoint: o.outPointS,
                anchorPoint: placedAnchor,
                position: placedPos,
                // Where the placeholder's baseline landed in master space,
                // recomputed from what AE reports rather than from what was
                // asked for.
                baselineXInMaster: placedPos[0] + (o.placeholderBaselineX - placedAnchor[0]),
                baselineYInMaster: placedPos[1] + (o.placeholderBaselineY - placedAnchor[1])
            },
            placeholder: {
                name: txt.name,
                text: String(txt.property('Source Text').value.text),
                styleAfter: textStyleOf(txt, instance.duration / 2),
                animatedAfter: animatedAfter
            },
            original: { before: originalBefore, after: originalAfter }
        };

        stage = 'save';
        var outFile = new File(o.savePath);
        app.project.save(outFile);

        stage = 'park-playhead';
        master.openInViewer();
        master.time = o.parkAtS;
    } catch (e) {
        result = fail(e);
    }

    var out = new File(outPath);
    out.encoding = 'UTF-8';
    out.open('w');
    out.write(JSON.stringify(result));
    out.close();
    return result.ok ? 'ok' : 'error';
}
