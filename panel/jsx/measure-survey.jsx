/*
 * Measures every card in the corpus against SUBTITLE_SAFE_WIDTH, so the survey
 * is emitted by the thing that measures rather than hand-typed.
 *
 * ES3 only. Requires text-fit.jsx.
 *
 * One scratch duplicate per template, with the text swapped between cards,
 * rather than a duplicate per card: 194 comp duplications would dominate the
 * run and nothing here is placed in a master, so a single instance answers for
 * all of them. `templates/library.aep` is opened as an import source and never
 * written.
 */
function framopiaMeasureSurvey(optionsPath, outPath) {
    var stage = 'start';
    var result;

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

        stage = 'import-templates';
        var aepFile = new File(o.templatesAepPath);
        if (!aepFile.exists) throw new Error('template library not found: ' + o.templatesAepPath);
        framopiaRefuseSelfImport(aepFile.fsName);
        app.project.importFile(new ImportOptions(aepFile));

        stage = 'scratch-instances';
        var scratch = {};
        var i, j;
        for (i = 0; i < o.templateIds.length; i++) {
            var id = o.templateIds[i];
            var template = findItem(id);
            if (!template || !(template instanceof CompItem)) {
                throw new Error('no comp named "' + id + '"');
            }
            var dup = template.duplicate();
            dup.name = 'scratch__' + id;
            var layer = findLayer(dup, 'TXT_MAIN');
            if (!layer) throw new Error('comp "' + id + '" has no TXT_MAIN');
            scratch[id] = { comp: dup, layer: layer, sampleTime: dup.duration / 2 };
        }

        /*
         * The claim that the source rect is independent of the layer's
         * transforms, checked rather than assumed: TXT_MAIN's Position is
         * keyframed 750 -> 700, so if the rect followed the transform these
         * two would differ.
         */
        stage = 'transform-independence';
        var independence = [];
        for (var k in scratch) {
            if (!scratch.hasOwnProperty(k)) continue;
            var sc = scratch[k];
            framopiaSetText(sc.layer, o.probeText);
            independence.push({
                templateId: k,
                atZero: framopiaMeasureAt(sc.layer, 0),
                atSample: framopiaMeasureAt(sc.layer, sc.sampleTime),
                positionAtZero: sc.layer.property('Position').valueAtTime(0, false),
                positionAtSample: sc.layer.property('Position').valueAtTime(sc.sampleTime, false)
            });
        }

        stage = 'measure';
        var reels = [];
        for (i = 0; i < o.reels.length; i++) {
            var reel = o.reels[i];
            var cards = [];
            for (j = 0; j < reel.cards.length; j++) {
                var card = reel.cards[j];
                var s = scratch[card.templateId];
                if (!s) throw new Error('no scratch instance for ' + card.templateId);
                var fit = framopiaFitText(s.layer, s.sampleTime, card.candidate, o.safeWidth);
                cards.push({
                    id: card.id,
                    kind: card.kind,
                    templateId: card.templateId,
                    text: card.candidate.oneLine,
                    fit: fit
                });
            }
            reels.push({ reel: reel.reel, cards: cards });
        }

        result = { ok: true, aeVersion: app.version, independence: independence, reels: reels };
    } catch (err) {
        result = { ok: false, stage: stage, message: String(err) };
    }

    var out = new File(outPath);
    out.encoding = 'UTF-8';
    out.open('w');
    out.write(JSON.stringify(result));
    out.close();
    return result.ok ? 'ok' : 'error';
}
