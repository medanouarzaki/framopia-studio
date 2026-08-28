/*
 * What does After Effects do with an audio layer whose `startTime` is before
 * the composition's start?
 *
 * The question is load-bearing. `whoosh_01`'s loudest point is 0.6913 s into
 * the file and the first image of a reel sits 0.0990 s in, so the layer has to
 * begin 0.4568 s before frame zero for the peak to land on the picture. If AE
 * honours that, the sound is recoverable; if AE silently clamps it to zero, the
 * peak lands 14 frames late and the only honest answer is to leave that image
 * silent.
 *
 * This asks AE and reports what it says. It decides nothing, and it is
 * deliberately minimal — one comp, one audio layer per case, no reel.
 *
 * ES3 only. json2.jsx installs JSON.stringify where the host lacks it.
 */
function framopiaAudioStartProbe(optionsPath, outPath) {
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

    var closedProject = null;

    try {
        var o = readOptions(optionsPath);

        stage = 'new-project';
        /*
         * The same refusal every script that opens a project carries: an
         * unreadable `dirty` counts as dirty, because refusing costs a re-run
         * and guessing costs the user's work.
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
            // Saved, so closing it loses nothing — but say which one, rather
            // than closing the user's project silently.
            closedProject = openFile === null ? '(unsaved, never written)' : openFile.fsName;
            app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
        }
        app.newProject();

        stage = 'import-audio';
        var f = new File(o.audioPath);
        if (!f.exists) throw new Error('file not found: ' + o.audioPath);
        var sound = app.project.importFile(new ImportOptions(f));

        stage = 'probe';
        var comp = app.project.items.addComp(
            'audio_start_probe', 480, 270, 1, o.compDurationS, o.frameRate
        );

        var cases = [];
        for (var i = 0; i < o.cases.length; i++) {
            var c = o.cases[i];
            var layer = comp.layers.add(sound);
            layer.name = c.name;
            layer.startTime = c.startTimeS;
            // Set second, so the report can separate "AE refused the start" from
            // "AE moved the in-point": a layer may legally begin before the comp
            // while the portion that plays starts at zero.
            if (c.setInPointS !== null && c.setInPointS !== undefined) {
                layer.inPoint = c.setInPointS;
            }

            var levels = null;
            try {
                levels = layer.property('Audio').property('Audio Levels').value;
            } catch (eLevels) {
                levels = null;
            }

            cases.push({
                name: c.name,
                askedStartTimeS: c.startTimeS,
                askedInPointS: c.setInPointS === undefined ? null : c.setInPointS,
                startTimeS: layer.startTime,
                inPointS: layer.inPoint,
                outPointS: layer.outPoint,
                // Where the file's own first sample sits on the comp's timeline.
                // This is the number the placement rule depends on.
                fileZeroAtS: layer.startTime,
                // And where its measured peak therefore lands.
                peakAtS: layer.startTime + o.peakOffsetS,
                hasAudio: layer.hasAudio,
                audioActive: layer.audioActive,
                audioLevels: levels
            });
        }

        result = {
            ok: true,
            aeVersion: app.version,
            closedProject: closedProject,
            compDurationS: comp.duration,
            compFrameRate: comp.frameRate,
            sourceDurationS: sound.duration,
            cases: cases
        };
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
