/*
 * Answers one API question this pipeline has never demonstrated: does a solid
 * IMG_MAIN accept a replaced source? The built comps use solids rather than
 * the placeholder still TEMPLATE_LIBRARY_GUIDE §4 suggests, and the validator
 * accepts both on the assumption that a solid replaces as well.
 *
 * ES3 only. Operates on the project already open, so the card placed by
 * build.jsx and this image sit in one master comp the user can look at.
 * Nothing here positions by zone: placement is a solved problem elsewhere and
 * this is an API question.
 */
function framopiaImageProbe(optionsPath, outPath) {
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

    function snapshot(layer) {
        var a = [];
        animatedOf(layer, a, '');
        return {
            kind: (layer.source && layer.source.mainSource instanceof SolidSource) ? 'solid' : 'footage',
            sourceName: layer.source ? layer.source.name : null,
            width: layer.width,
            height: layer.height,
            position: layer.property('Position').value,
            anchorPoint: layer.property('Anchor Point').value,
            scale: layer.property('Scale').value,
            opacity: layer.property('Opacity').value,
            animated: a
        };
    }

    try {
        var o = readOptions(optionsPath);

        stage = 'find-template';
        var template = findItem(o.templateId);
        if (!template || !(template instanceof CompItem)) {
            throw new Error('no comp named "' + o.templateId + '" in the open project');
        }

        stage = 'import-image';
        var imgFile = new File(o.imagePath);
        if (!imgFile.exists) throw new Error('image not found: ' + o.imagePath);
        var imgItem = app.project.importFile(new ImportOptions(imgFile));

        stage = 'duplicate-template';
        var instance = template.duplicate();
        instance.name = o.instanceName;

        stage = 'find-placeholder';
        var img = findLayer(instance, o.placeholder);
        if (!img) throw new Error('comp "' + o.instanceName + '" has no layer named "' + o.placeholder + '"');
        var before = snapshot(img);

        stage = 'replace-source';
        // The whole question. replaceSource keeps the layer and swaps what it
        // shows, which is what preserves transforms and keyframes; adding a new
        // layer would not.
        img.replaceSource(imgItem, false);
        var after = snapshot(img);

        stage = 'add-to-master';
        var master = findItem(o.masterName);
        if (!master || !(master instanceof CompItem)) {
            throw new Error('no comp named "' + o.masterName + '" in the open project');
        }
        var layer = master.layers.add(instance);
        layer.startTime = o.inPointS;
        layer.inPoint = o.inPointS;
        layer.outPoint = o.outPointS;
        layer.property('Position').setValue([o.positionX, o.positionY]);

        result = {
            ok: true,
            api: 'AVLayer.replaceSource(FootageItem, false)',
            image: { name: imgItem.name, width: imgItem.width, height: imgItem.height },
            comp: { name: instance.name, width: instance.width, height: instance.height },
            placeholder: { before: before, after: after },
            masterLayer: {
                name: layer.name,
                inPoint: layer.inPoint,
                outPoint: layer.outPoint,
                position: layer.property('Position').value
            }
        };

        stage = 'save';
        app.project.save(new File(o.savePath));

        stage = 'park-playhead';
        master.openInViewer();
        master.time = o.parkAtS;
    } catch (e) {
        result = { ok: false, stage: stage, message: String(e) };
    }

    var out = new File(outPath);
    out.encoding = 'UTF-8';
    out.open('w');
    out.write(JSON.stringify(result));
    out.close();
    return result.ok ? 'ok' : 'error';
}
