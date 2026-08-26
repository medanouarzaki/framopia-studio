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
                if (n > 0) into.push({ path: prefix + p.name, keyframes: n });
            } else {
                collectAnimated(p, into, prefix + p.name + '/');
            }
        }
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

    try {
        if (app.project) {
            app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
        }
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

                var entry = {
                    name: layer.name,
                    kind: kind,
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

    var out = new File(outPath);
    out.encoding = 'UTF-8';
    out.open('w');
    out.write(JSON.stringify(result));
    out.close();
    return result.ok ? 'ok' : 'error';
}
