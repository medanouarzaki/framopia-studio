/*
 * Dumps what is actually in templates/library.aep so the manifest can be
 * checked against it. TEMPLATE_LIBRARY_GUIDE §9 asks for an ExtendScript audit
 * run; this is that run.
 *
 * It reads and writes nothing in the project. The output is a JSON file whose
 * path is passed in through a global the caller sets before evaluating this
 * file, because DoScript takes a string rather than arguments.
 *
 * Invoked by cli.ts through `osascript -e 'tell application ... to DoScript'`.
 * Launching After Effects with `-r` does not work on this machine: a script
 * that only calls app.quit() leaves the app running, so the file is never
 * reached from a cold start. A already-running instance driven over Apple
 * events does run it.
 */
function framopiaAudit(aepPath, outPath) {
    var result = { ok: false };
    try {
        if (app.project) {
            app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
        }
        app.open(new File(aepPath));

        var comps = [];
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (!(item instanceof CompItem)) continue;

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
                layers.push({ name: layer.name, kind: kind });
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
