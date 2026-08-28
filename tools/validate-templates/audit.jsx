/*
 * Dumps what is actually in templates/library.aep so the manifest can be
 * checked against it, and so a build stage can compute geometry from measured
 * values rather than assumptions. TEMPLATE_LIBRARY_GUIDE §9 asks for an
 * ExtendScript audit run; this is that run.
 *
 * It reads and writes nothing in the project. The output is a JSON file whose
 * path is passed in through a global the caller sets before evaluating this
 * file, because DoScript takes a string rather than arguments.
 *
 * Invoked by cli.ts through `osascript -e 'tell application ... to DoScript'`.
 * After Effects must already be running: launching it with `-r` is unusable
 * here, and a resident `-r` process has been observed executing its body long
 * afterwards and quitting the application.
 *
 * Values are emitted exactly as AE reports them — no rounding, no unit
 * conversion, no interpretation. A property that cannot be read for a given
 * layer kind emits an explicit null with a reason, because an absent
 * measurement is not a measurement of zero.
 */
function framopiaAudit(aepPath, outPath) {
    var result = { ok: false };

    function unreadable(reason) {
        return { value: null, valueAtSampleTime: null, keyframes: null, unreadable: reason };
    }

    /*
     * `prop.value` on an animated property is its value at the project's
     * current time indicator, not at any time this script chose — sub_pop's
     * TXT_MAIN reported y 750 and opacity 0 because the CTI happened to sit at
     * frame 0, which is the *start* of the intro rather than the settled pose a
     * build has to place from. `valueAtSampleTime` is the one to compute from;
     * `value` is kept beside it so the difference stays visible rather than
     * being quietly resolved.
     */
    function readProperty(layer, propName, sampleTime) {
        var prop;
        try {
            prop = layer.property(propName);
        } catch (e) {
            return unreadable('property "' + propName + '" threw: ' + String(e));
        }
        if (!prop) return unreadable('layer has no property "' + propName + '"');
        var out = { value: null, valueAtSampleTime: null, keyframes: null, unreadable: null };
        try {
            out.value = prop.value;
        } catch (e2) {
            out.unreadable = 'value threw: ' + String(e2);
        }
        try {
            out.valueAtSampleTime = prop.valueAtTime(sampleTime, false);
        } catch (e2b) {
            out.valueAtSampleTime = null;
            out.unreadable = 'valueAtTime threw: ' + String(e2b);
        }
        try {
            out.keyframes = prop.numKeys;
        } catch (e3) {
            out.keyframes = null;
        }
        return out;
    }

    /*
     * Every animated property in the layer, whatever group it sits in, so a
     * duplication can be checked for keyframe survival without knowing in
     * advance where the animation lives. Effects and transform both.
     */
    function collectAnimated(group, into, prefix) {
        var count;
        try {
            count = group.numProperties;
        } catch (e) {
            return;
        }
        for (var i = 1; i <= count; i++) {
            var p;
            try {
                p = group.property(i);
            } catch (e2) {
                continue;
            }
            if (!p) continue;
            var isLeaf = false;
            try {
                isLeaf = p.propertyType === PropertyType.PROPERTY;
            } catch (e3) {
                isLeaf = false;
            }
            if (isLeaf) {
                var n = 0;
                try {
                    n = p.numKeys;
                } catch (e4) {
                    n = 0;
                }
                if (n > 0) {
                    /*
                     * The times and values of every key, not just how many.
                     *
                     * A count cannot answer where an entrance resolves, and
                     * that is the frame a sound has to land on: the moment
                     * kw_slam's scale settles, not the card's start. Emitted
                     * exactly as AE reports them, so the derivation happens
                     * outside where it can be read and tested.
                     */
                    var keys = [];
                    for (var k = 1; k <= n; k++) {
                        var key = {
                            index: k,
                            time: null,
                            value: null,
                            inInterpolation: null,
                            outInterpolation: null,
                            inEase: null,
                            outEase: null,
                            unreadable: null
                        };
                        try {
                            key.time = p.keyTime(k);
                        } catch (e5) {
                            key.unreadable = 'keyTime threw: ' + String(e5);
                        }
                        try {
                            key.value = p.keyValue(k);
                        } catch (e6) {
                            key.unreadable = (key.unreadable ? key.unreadable + '; ' : '') +
                                'keyValue threw: ' + String(e6);
                        }
                        /*
                         * **The easing, without which the curve between two keys
                         * is unknowable.**
                         *
                         * Two endpoints and a duration do not say when the value
                         * arrives: linear puts kw_slam's word at 95% on frame
                         * 11.4, and the user's eye puts it on frame 4, because
                         * the motion is front-loaded. Session 23 could not
                         * measure the impact frame for exactly this reason.
                         *
                         * `influence` and `speed` are what AE exposes per side,
                         * and together with the interpolation type they define
                         * the bezier. Emitted exactly as reported.
                         */
                        key.inInterpolation = interpolationName(p, k, true);
                        key.outInterpolation = interpolationName(p, k, false);
                        key.inEase = easeOf(p, k, true);
                        key.outEase = easeOf(p, k, false);
                        keys.push(key);
                    }
                    into.push({ path: prefix + p.name, keyframes: n, keys: keys });
                }
            } else {
                collectAnimated(p, into, prefix + p.name + '/');
            }
        }
    }

    /*
     * A keyframe's interpolation type per side, named rather than numbered so a
     * reader does not have to know AE's enum.
     */
    function interpolationName(prop, index, incoming) {
        var type;
        try {
            type = incoming ? prop.keyInInterpolationType(index) : prop.keyOutInterpolationType(index);
        } catch (e) {
            return null;
        }
        try {
            if (type === KeyframeInterpolationType.LINEAR) return 'LINEAR';
            if (type === KeyframeInterpolationType.BEZIER) return 'BEZIER';
            if (type === KeyframeInterpolationType.HOLD) return 'HOLD';
        } catch (e2) {
            return null;
        }
        return String(type);
    }

    /*
     * The temporal ease on one side of a key: influence as a percentage and
     * speed in value-units per second, one entry per dimension. A property AE
     * refuses the call for emits null, never a zero that would read as "no
     * easing".
     */
    function easeOf(prop, index, incoming) {
        var ease;
        try {
            ease = incoming ? prop.keyInTemporalEase(index) : prop.keyOutTemporalEase(index);
        } catch (e) {
            return null;
        }
        if (!ease || !ease.length) return null;
        var out = [];
        for (var i = 0; i < ease.length; i++) {
            var entry = { influence: null, speed: null };
            try {
                entry.influence = ease[i].influence;
            } catch (e2) {
                entry.influence = null;
            }
            try {
                entry.speed = ease[i].speed;
            } catch (e3) {
                entry.speed = null;
            }
            out.push(entry);
        }
        return out;
    }

    function justificationName(value) {
        try {
            if (value === ParagraphJustification.LEFT_JUSTIFY) return 'LEFT_JUSTIFY';
            if (value === ParagraphJustification.RIGHT_JUSTIFY) return 'RIGHT_JUSTIFY';
            if (value === ParagraphJustification.CENTER_JUSTIFY) return 'CENTER_JUSTIFY';
            if (value === ParagraphJustification.FULL_JUSTIFY_LASTLINE_LEFT) return 'FULL_JUSTIFY_LASTLINE_LEFT';
            if (value === ParagraphJustification.FULL_JUSTIFY_LASTLINE_RIGHT) return 'FULL_JUSTIFY_LASTLINE_RIGHT';
            if (value === ParagraphJustification.FULL_JUSTIFY_LASTLINE_CENTER) return 'FULL_JUSTIFY_LASTLINE_CENTER';
            if (value === ParagraphJustification.FULL_JUSTIFY_LASTLINE_FULL) return 'FULL_JUSTIFY_LASTLINE_FULL';
        } catch (e) {
            return null;
        }
        return null;
    }

    /*
     * **Never close a project this script did not open, and never discard
     * unsaved changes.**
     *
     * This used to call close(DO_NOT_SAVE_CHANGES) unconditionally, which
     * destroys whatever the user has open. It is a diagnostic that mutated the
     * host, which is the same class of mistake as a diagnostic that writes to
     * the plan, and it cost Block 8 session 21 its second half: the impact
     * frame could not be measured because running the audit would have thrown
     * away his work.
     *
     * A project with unsaved changes is a refusal, not a prompt. `app.project.file`
     * is null for a project that has never been saved, and `dirty` is true when
     * it has edits AE has not written — either is enough to stop.
     */
    var refusal = refuseIfUnsafe(aepPath, result);
    if (refusal !== null) {
        writeResult(outPath, { ok: false, error: refusal, refused: true });
        return 'error';
    }

    /*
     * **Never close a project this script did not open, and never discard
     * unsaved changes.**
     *
     * This used to call close(DO_NOT_SAVE_CHANGES) unconditionally, which
     * destroys whatever the user has open. A diagnostic that mutates the host
     * is the same class of mistake as a diagnostic that writes to the plan, and
     * it cost Block 8 session 21 its second half: the impact frame could not be
     * measured because taking the measurement would have thrown his work away.
     *
     * Returns a sentence when it refuses, or null when it is safe to proceed.
     * `app.project.file` is null for a project never saved; `dirty` is true when
     * it carries edits AE has not written. An unreadable `dirty` is treated as
     * dirty: refusing costs a re-run, guessing costs the user's work.
     */
    function refuseIfUnsafe(aepPath, result) {
        if (!app.project) return null;

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
            return 'the open After Effects project has unsaved changes' +
                (openFile === null ? ' and has never been saved' : ': ' + openFile.fsName) +
                '. The audit will not close it. Save or close it yourself, then run the audit again.';
        }

        var wanted = new File(aepPath);
        var alreadyTheLibrary = openFile !== null && String(openFile.fsName) === String(wanted.fsName);
        if (!alreadyTheLibrary && app.project.numItems > 0) {
            /*
             * Saved, so no work is at risk — but it is still not this script's
             * project to close, and closing it loses the user's place. Announced
             * in the output rather than done silently.
             */
            result.closedProject = openFile === null ? '(untitled)' : String(openFile.fsName);
            app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
        }
        return null;
    }

    function writeResult(outPath, value) {
        var out = new File(outPath);
        out.encoding = 'UTF-8';
        out.open('w');
        out.write(JSON.stringify(value));
        out.close();
    }

    try {
        app.open(new File(aepPath));

        var comps = [];
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (!(item instanceof CompItem)) continue;

            // Geometry that varies over time is read at one instant, and the
            // report names it rather than leaving the reader to guess.
            var sampleTime = item.duration / 2;

            var layers = [];
            for (var j = 1; j <= item.numLayers; j++) {
                var layer = item.layer(j);
                var kind = 'other';
                if (layer instanceof TextLayer) {
                    kind = 'text';
                } else if (layer instanceof ShapeLayer) {
                    kind = 'shape';
                } else if (layer instanceof CameraLayer) {
                    kind = 'camera';
                } else if (layer instanceof LightLayer) {
                    kind = 'light';
                } else if (layer instanceof AVLayer) {
                    // A solid is a footage item too, so the two are separated by
                    // what the source actually is rather than by layer class.
                    kind = 'footage';
                    if (layer.source && layer.source instanceof FootageItem) {
                        if (layer.source.mainSource instanceof SolidSource) kind = 'solid';
                    }
                }

                var parentName = null;
                try {
                    if (layer.parent) parentName = layer.parent.name;
                } catch (eP) {
                    parentName = null;
                }

                var entry = {
                    name: layer.name,
                    kind: kind,
                    // Decides whether a layer's position is in the comp's
                    // coordinate space or its parent's; two layers with the
                    // same numbers land in different places depending on it.
                    parent: parentName,
                    position: readProperty(layer, 'Position', sampleTime),
                    anchorPoint: readProperty(layer, 'Anchor Point', sampleTime),
                    scale: readProperty(layer, 'Scale', sampleTime),
                    opacity: readProperty(layer, 'Opacity', sampleTime),
                    width: null,
                    height: null,
                    sampleTime: sampleTime,
                    sourceRect: null,
                    text: null,
                    animated: []
                };

                try {
                    entry.width = layer.width;
                    entry.height = layer.height;
                } catch (eWH) {
                    entry.width = null;
                    entry.height = null;
                    entry.sizeUnreadable = 'layer kind "' + kind + '" reports no width/height: ' + String(eWH);
                }

                try {
                    var r = layer.sourceRectAtTime(sampleTime, false);
                    entry.sourceRect = { top: r.top, left: r.left, width: r.width, height: r.height };
                } catch (eSR) {
                    entry.sourceRect = null;
                    entry.sourceRectUnreadable = 'sourceRectAtTime threw: ' + String(eSR);
                }

                if (kind === 'text') {
                    try {
                        var td = layer.property('Source Text').valueAtTime(sampleTime, false);
                        entry.text = {
                            font: td.font,
                            fontSize: td.fontSize,
                            justification: justificationName(td.justification),
                            justificationRaw: td.justification,
                            tracking: td.tracking
                        };
                    } catch (eT) {
                        entry.text = null;
                        entry.textUnreadable = 'Source Text threw: ' + String(eT);
                    }
                }

                collectAnimated(layer, entry.animated, '');
                layers.push(entry);
            }

            comps.push({
                name: item.name,
                frameRate: item.frameRate,
                width: item.width,
                height: item.height,
                duration: item.duration,
                layers: layers
            });
        }

        result = { ok: true, aeVersion: app.version, comps: comps };
    } catch (e) {
        result = { ok: false, error: String(e) };
    }

    writeResult(outPath, result);
    return result.ok ? 'ok' : 'error';
}
