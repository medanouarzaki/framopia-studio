/*
 * Builds a whole reel: every subtitle card, keyword, image and SFX layer, into
 * one or more master comps in a single project.
 *
 * ES3 only. json2.jsx installs JSON.stringify where the host lacks it.
 *
 * Two properties this file exists to guarantee:
 *
 *   - **One duplicated comp per element, shared by every master.** The text and
 *     the artwork are then literally the same item in each, so two masters
 *     built to compare timing cannot differ in anything else.
 *   - **No decisions here.** Text, timings, positions, scales and template ids
 *     all arrive computed. This places them and reports what AE stored.
 */
function framopiaBuildReel(optionsPath, outPath) {
    var stage = 'start';
    var result;
    var savedOwnOutput = null;
    var emptiedUntitled = false;

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

    function importOnce(pathStr, cache) {
        if (cache[pathStr]) return cache[pathStr];
        var f = new File(pathStr);
        if (!f.exists) throw new Error('file not found: ' + pathStr);
        var item = app.project.importFile(new ImportOptions(f));
        cache[pathStr] = item;
        return item;
    }

    try {
        var o = readOptions(optionsPath);
        var imports = {};
        var warnings = [];

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
            /*
             * **A project this tool wrote is not someone's unsaved work.**
             *
             * The guard stopped the user four times running, and every time the
             * file it refused to close was `.local/build/…` — the build's own
             * previous output, open because the last build left it there. So a
             * file under that directory is saved and the build proceeds, saying
             * which one it saved. Anything else keeps the refusal, and a project
             * that was never written to disk keeps it too: there is no file to
             * save it to and no way to know what it holds.
             */
            var isOurs = openFile !== null && o.buildDir && openFile.fsName.indexOf(o.buildDir) === 0;
            if (isDirty && isOurs) {
                app.project.save();
                savedOwnOutput = openFile.fsName;
                isDirty = false;
            }
            /*
             * **An empty project holds no work.** A project with no items that
             * has never been written to disk cannot lose anything by being
             * replaced — and it is the state After Effects is in after any
             * script adds a temporary comp and removes it again, because the
             * modified flag is read-only and cannot be put back. This is not
             * the "unreadable dirty counts as dirty" case: `numItems` is read
             * and it is zero. A project with even one item keeps the refusal,
             * and so does a saved one with unsaved changes.
             */
            var itemCount = -1;
            try {
                itemCount = app.project.numItems;
            } catch (eItems) {
                itemCount = -1;
            }
            if (isDirty && openFile === null && itemCount === 0) {
                isDirty = false;
                emptiedUntitled = true;
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

        /*
         * Before a single card is placed. After Effects accepts a font name it
         * cannot resolve and renders a substitute without saying so, so a face
         * that is missing from this machine produces a comp that looks built
         * and is set in the wrong type. `o.requiredFonts` is empty until a
         * build actually names its faces, and an empty list checks nothing.
         */
        stage = 'check-fonts';
        if (o.requiredFonts && o.requiredFonts.length > 0) {
            var installedNames = framopiaInstalledFontNames();
            if (installedNames === null) {
                return { ok: false, stage: 'check-fonts',
                         message: 'this After Effects cannot list its fonts, so the faces this ' +
                                  'build needs cannot be confirmed present' };
            }
            var missingFonts = framopiaMissingFonts(o.requiredFonts, installedNames);
            if (missingFonts.length > 0) {
                return { ok: false, stage: 'check-fonts',
                         message: 'this machine does not have ' + missingFonts.join(', ') +
                                  '. After Effects would substitute another face without saying ' +
                                  'so, so the build stops instead. Install the font and run it ' +
                                  'again.' };
            }
        }

        stage = 'import-footage';
        var footage = importOnce(o.footagePath, imports);

        stage = 'import-templates';
        var aepFile = new File(o.templatesAepPath);
        if (!aepFile.exists) throw new Error('template library not found: ' + o.templatesAepPath);
        framopiaRefuseSelfImport(aepFile.fsName);
        app.project.importFile(new ImportOptions(aepFile));

        /* One duplicate per element, built once and shared by every master. */
        stage = 'build-elements';
        var built = {};
        var i, j, e;
        for (i = 0; i < o.elements.length; i++) {
            e = o.elements[i];
            var template = findItem(e.templateId);
            if (!template || !(template instanceof CompItem)) {
                throw new Error('no comp named "' + e.templateId + '" for element ' + e.id);
            }
            var instance = template.duplicate();
            instance.name = e.id + '__' + e.templateId;

            var ph = findLayer(instance, e.placeholder);
            if (!ph) {
                throw new Error('comp "' + e.templateId + '" has no layer named "' + e.placeholder + '"');
            }

            if (e.kind !== 'image') {
                /*
                 * PROJECT_SPEC §3 ruling 3: a card too wide for the safe width
                 * is broken onto two lines at full size where it can be, and
                 * shrunk only where it cannot. Never clipped. The break point
                 * arrives precomputed; whether it is needed is decided here,
                 * because only AE knows the rendered width.
                 */
                e.shrink = framopiaFitCard(
                    ph, instance.duration / 2, e.candidate, o.safeWidth,
                    e.textStyle, o.shrinkMaxAttempts
                );
                if (!e.shrink.fits) {
                    throw new Error(framopiaTooWideMessage(
                        e.id, e.kind, e.shrink, o.safeWidth,
                        e.textStyle ? e.textStyle.font : null
                    ));
                }
                /*
                 * The shadow is a copy of the word drawn behind it, so it has
                 * to say the word. Block 9 session 8 found the duplicated layer
                 * still holding the template's own placeholder text, one build
                 * away from putting `kan9olo` on every card of every reel.
                 *
                 * Same text, same font, same size — and, since 2026-08-31, the
                 * client's deeper colour. The templates carry #820000, which is
                 * K2's red, so every other client was getting K2's shadow with
                 * nothing saying so. `framopiaSetText` still leaves the colour
                 * alone when the style carries none, which is what a client with
                 * no measured faces gets.
                 */
                if (e.shadowLayers) {
                    for (var si = 0; si < e.shadowLayers.length; si++) {
                        var shadowName = e.shadowLayers[si];
                        var shadow = findLayer(instance, shadowName);
                        if (!shadow) {
                            throw new Error('comp "' + e.templateId + '" declares shadow layer "' +
                                            shadowName + '" but has no layer of that name');
                        }
                        /*
                         * The text is the one that was placed, break character
                         * and all, and the size is the one the fit landed on —
                         * not the style's. A shadow left unbroken behind a
                         * broken word, or at full size behind a shrunk one,
                         * would draw a different shape from the word in front
                         * of it. Both layers are read back below rather than
                         * assumed equal.
                         */
                        var shadowStyle = { fontSize: e.shrink.finalFontSize };
                        if (e.textStyle) {
                            shadowStyle.font = e.textStyle.font;
                            if (e.textStyle.shadowFillColor) {
                                shadowStyle.fillColor = e.textStyle.shadowFillColor;
                            }
                        }
                        framopiaSetText(shadow, e.shrink.text, shadowStyle);
                        e.shadowApplied = framopiaReadTextStyle(shadow);
                        e.shadowText = String(shadow.property('Source Text').value.text);
                    }
                }
                /*
                 * Read back rather than assumed: After Effects substitutes a
                 * face it cannot resolve and reports the name it was given, so
                 * this proves only that the write took, not that the face is
                 * real. `check-fonts` above is what proves the face is real.
                 *
                 * The placeholder is read unconditionally now, because the
                 * shrink writes a size whether or not the client carries a
                 * face, and the size on both layers has to be checked.
                 */
                e.textStyleApplied = framopiaReadTextStyle(ph);
                e.placedText = String(ph.property('Source Text').value.text);
                /*
                 * Where the card actually reaches inside its comp. Measured
                 * here, beside the width the fit already measured, because a
                 * card is bounded in two directions and only one was checked.
                 */
                e.vertical = framopiaVerticalExtent(
                    instance,
                    ph,
                    e.shadowLayers && e.shadowLayers.length > 0
                        ? findLayer(instance, e.shadowLayers[0])
                        : null,
                    instance.duration / 2
                );
                if (e.shadowApplied &&
                    e.shadowApplied.fontSize !== e.textStyleApplied.fontSize) {
                    throw new Error('comp "' + instance.name + '": the word is set at ' +
                        e.textStyleApplied.fontSize + ' and its shadow at ' +
                        e.shadowApplied.fontSize + '. Both layers carry the same word ' +
                        'and must carry the same size.');
                }
                /*
                 * The colour is read back for the same reason the size and the
                 * text are: this is the pair of layers Block 9 session 8 found
                 * one build away from carrying the template's placeholder word,
                 * and a fill that reached the word and not its shadow would draw
                 * K2's red behind another client's type with nothing saying so.
                 */
                if (e.textStyle && e.textStyle.shadowFillColor && e.shadowApplied) {
                    var want = e.textStyle.shadowFillColor;
                    var got = e.shadowApplied.fillColor;
                    var same = got !== null &&
                        Math.abs(got[0] - want[0]) < 0.002 &&
                        Math.abs(got[1] - want[1]) < 0.002 &&
                        Math.abs(got[2] - want[2]) < 0.002;
                    if (!same || e.shadowApplied.applyFill !== true) {
                        throw new Error('comp "' + instance.name + '": the shadow was set to ' +
                            framopiaColourText(want) + ' and reads ' +
                            (got === null ? 'no colour at all' : framopiaColourText(got)) +
                            (e.shadowApplied.applyFill === true ? '' : ', with its fill not applied') +
                            '. The shadow carries the client\'s deeper colour.');
                    }
                }
                /*
                 * A break that reached one layer and not the other is the same
                 * defect as a size that did: the shadow would sit behind a
                 * shape the word does not have.
                 */
                if (typeof e.shadowText === 'string' && e.shadowText !== e.placedText) {
                    throw new Error('comp "' + instance.name + '": the word reads "' +
                        e.placedText + '" and its shadow reads "' + e.shadowText +
                        '". Both layers carry the same string, break included.');
                }
            } else {
                var img = importOnce(e.imagePath, imports);
                ph.replaceSource(img, false);
                // A replaced layer takes the source's dimensions, so the
                // template's 100% would render the image at the source's size
                // inside a comp built for the solid. The factor is computed by
                // the caller from the audited solid size and the real source
                // size; without it a 2048px image fills 171% of a 1200px comp.
                ph.property('Scale').setValue([e.placeholderScalePercent, e.placeholderScalePercent]);
                // The file's content is not always centred in its canvas, so
                // centring the canvas puts the subject off-centre in the zone.
                // Moved by the anchor point, not the position: img_slide_left
                // keyframes Position and AE refuses setValue on a keyframed
                // property.
                if (e.contentAnchor) {
                    ph.property('Anchor Point').setValue([e.contentAnchor.x, e.contentAnchor.y]);
                }
                // The frame is only a frame if it separates from the picture's
                // own edge. The colour is derived by the caller from that edge;
                // a Fill effect recolours this instance's own layer and leaves
                // the shared solid the template draws from untouched.
                if (e.cardColor) {
                    var card = instance.layer('CARD');
                    if (card === null) {
                        return { ok: false, stage: 'card-frame',
                                 message: 'no CARD layer in ' + e.templateId };
                    }
                    var fill = card.property('Effects').addProperty('ADBE Fill');
                    fill.property('Color').setValue([
                        e.cardColor[0], e.cardColor[1], e.cardColor[2], 1
                    ]);
                    e.cardColorApplied = card.property('Effects')
                        .property('Fill').property('Color').value;
                }
                e.measured = {
                    sourceWidth: img.width,
                    sourceHeight: img.height,
                    layerWidth: ph.width,
                    layerHeight: ph.height,
                    anchorPoint: ph.property('Anchor Point').value,
                    scale: ph.property('Scale').value
                };
            }
            built[e.id] = instance;
        }

        stage = 'build-masters';
        var comps = [];
        var watermarkReport = null;
        for (i = 0; i < o.masters.length; i++) {
            var spec = o.masters[i];
            var master = app.project.items.addComp(
                spec.name, o.masterWidth, o.masterHeight, 1, o.reelDurationS, o.frameRate
            );
            var reelLayer = master.layers.add(footage);
            reelLayer.startTime = 0;
            // Every reel is delivered with its peak on full scale, so a second
            // sound cannot be added at any gain without the sum passing 0 dBFS.
            // The whole mix comes down together, which leaves the balance
            // between voice and effect exactly as the offsets describe it.
            if (o.dialogueGainDb) {
                reelLayer.property('Audio').property('Audio Levels').setValue([
                    o.dialogueGainDb, o.dialogueGainDb
                ]);
            }

            var counts = { subtitle: 0, keyword: 0, image: 0, audio: 0, watermark: 0 };
            for (j = 0; j < spec.placements.length; j++) {
                var pl = spec.placements[j];
                var item = built[pl.elementId];
                if (!item) throw new Error('no built element for ' + pl.elementId);
                var layer = master.layers.add(item);
                // Stretch before the in and out points: a stretch changes the
                // layer's duration, so setting the ends first would be undone.
                // This is layer time stretching, never keyframe editing —
                // TEMPLATE_LIBRARY_GUIDE §5 forbids the system touching a
                // template's keyframes.
                if (pl.stretchPercent && pl.stretchPercent !== 100) {
                    layer.stretch = pl.stretchPercent;
                }
                layer.startTime = pl.inPointS;
                layer.inPoint = pl.inPointS;
                layer.outPoint = pl.outPointS;
                layer.property('Position').setValue([pl.positionX, pl.positionY]);
                if (pl.scalePercent) {
                    layer.property('Scale').setValue([pl.scalePercent, pl.scalePercent]);
                }
                counts[pl.kind] = counts[pl.kind] + 1;
            }

            /*
             * The watermark, above everything (PROJECT_SPEC §4: overlaid, and
             * it does not extend the video). Added before the audio layers so
             * that `layers.add` leaves it at index 1 — AE inserts at the top,
             * so the last visual layer added is the topmost.
             */
            if (spec.watermark) {
                var wmItem = importOnce(spec.watermark.filePath, imports);
                // ARCHITECTURE §1.2: the file is premultiplied against black and
                // AE must be told so explicitly. Guessing it straight would
                // brighten every edge of the artwork.
                if (spec.watermark.premultiplied) {
                    wmItem.mainSource.alphaMode = AlphaMode.PREMULTIPLIED;
                    wmItem.mainSource.premulColor = [0, 0, 0];
                }
                var wm = master.layers.add(wmItem);
                wm.moveToBeginning();
                wm.startTime = 0;
                wm.inPoint = 0;
                wm.outPoint = spec.watermark.outPointS;
                wm.property('Position').setValue([
                    spec.watermark.positionX, spec.watermark.positionY
                ]);
                wm.property('Scale').setValue([
                    spec.watermark.scalePercent, spec.watermark.scalePercent
                ]);
                wm.property('Audio').property('Audio Levels').setValue([
                    spec.watermark.gainDb, spec.watermark.gainDb
                ]);
                counts.watermark = 1;
                watermarkReport = {
                    index: wm.index,
                    inPoint: wm.inPoint,
                    outPoint: wm.outPoint,
                    position: wm.property('Position').value,
                    scale: wm.property('Scale').value,
                    audioLevels: wm.property('Audio').property('Audio Levels').value,
                    width: wm.width,
                    height: wm.height,
                    // Read back rather than assumed: setting it is not proof.
                    alphaMode: String(wmItem.mainSource.alphaMode),
                    // An AV layer's audio is bounded by its in and out points,
                    // so the beeps stop with the picture. Reported so the claim
                    // rests on what AE says rather than on the setter.
                    hasAudio: wmItem.hasAudio,
                    audioActive: wm.audioActive,
                    audioEndsWithLayer: wm.outPoint,
                    premultipliedConstant: String(AlphaMode.PREMULTIPLIED),
                    layersAbove: wm.index - 1
                };
            }

            var audioPlaced = [];
            for (j = 0; j < spec.audio.length; j++) {
                var a = spec.audio[j];
                var sound = importOnce(a.filePath, imports);
                var al = master.layers.add(sound);
                // May be negative: a sound whose lead-in is longer than the reel
                // in front of its element begins before the composition, so its
                // peak can still land on the impact frame. AE honours that.
                al.startTime = a.timeS;
                // The in-point is stated rather than inherited, so the portion
                // that plays is exactly the composition even when the layer's
                // own time zero is outside it.
                if (a.timeS < 0) al.inPoint = 0;
                // Audio Levels is in dB and takes a two-channel array.
                al.property('Audio').property('Audio Levels').setValue([a.gainDb, a.gainDb]);
                audioPlaced.push({
                    sourceElementId: a.sourceElementId,
                    askedStartTimeS: a.timeS,
                    startTimeS: al.startTime,
                    inPointS: al.inPoint,
                    outPointS: al.outPoint,
                    gainDb: a.gainDb
                });
                counts.audio = counts.audio + 1;
            }

            comps.push({
                name: master.name,
                audio: audioPlaced,
                frameRate: master.frameRate,
                duration: master.duration,
                numLayers: master.numLayers,
                counts: counts
            });
        }

        stage = 'save';
        app.project.save(new File(o.savePath));
        /*
         * Read back from the project rather than echoing the option: this is
         * the one place that knows where After Effects actually put the file,
         * and the deliverable of this whole system is that file. A build that
         * cannot say where it wrote is a build the panel cannot hand over.
         */
        var savedTo = app.project.file ? app.project.file.fsName : o.savePath;

        stage = 'park-playhead';
        var active = findItem(o.activeComp);
        var parkedAt = o.parkAtS;
        var parkedOn = null;
        /*
         * Park on the first card the fit had to do something to — broken or
         * shrunk — so the thing to judge is on screen rather than something to
         * go hunting for. Which cards those are is only known here, after
         * measuring, so the choice cannot be made by the caller.
         */
        if (o.parkOnShrunk) {
            var wrappedId = null;
            for (i = 0; i < o.elements.length; i++) {
                var fit = o.elements[i].shrink;
                if (fit && (fit.broken || fit.factor < 1)) {
                    wrappedId = o.elements[i].id;
                    break;
                }
            }
            if (wrappedId) {
                for (i = 0; i < o.masters.length; i++) {
                    if (o.masters[i].name !== o.activeComp) continue;
                    for (j = 0; j < o.masters[i].placements.length; j++) {
                        var cand = o.masters[i].placements[j];
                        if (cand.elementId !== wrappedId) continue;
                        parkedAt = (cand.inPointS + cand.outPointS) / 2;
                        parkedOn = wrappedId;
                    }
                }
            }
            if (!parkedOn) warnings.push('no broken or shrunk card to park on; used the midpoint');
        }
        if (active && active instanceof CompItem) {
            active.openInViewer();
            active.time = parkedAt;
        } else {
            warnings.push('no comp named "' + o.activeComp + '" to open');
        }

        var measured = [];
        var fits = [];
        for (i = 0; i < o.elements.length; i++) {
            if (o.elements[i].measured) {
                measured.push({ id: o.elements[i].id, measured: o.elements[i].measured });
            }
            if (o.elements[i].shrink) {
                fits.push({
                    id: o.elements[i].id,
                    kind: o.elements[i].kind,
                    templateId: o.elements[i].templateId,
                    font: o.elements[i].textStyleApplied ? o.elements[i].textStyleApplied.font : null,
                    shrink: o.elements[i].shrink,
                    vertical: o.elements[i].vertical
                });
            }
        }

        result = {
            ok: true,
            aeVersion: app.version,
            savePath: savedTo,
            savedOwnOutput: savedOwnOutput,
            emptiedUntitled: emptiedUntitled,
            elementsBuilt: o.elements.length,
            masters: comps,
            imageMeasurements: measured,
            watermark: watermarkReport,
            textFits: fits,
            parkedOn: parkedOn,
            parkedAtS: parkedAt,
            projectItems: app.project.numItems,
            warnings: warnings
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
