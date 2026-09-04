/*
 * A minimal JSON.stringify for ExtendScript, installed when the host has none
 * — or when the host's cannot serialise an ordinary string.
 *
 * **Every result comes back through this.** The driver passes options in
 * through a file that ExtendScript reads with eval, and the only direction
 * that needs serialising is the result coming back; a stringify that throws
 * leaves the result file open, empty and unparseable, which is what a build
 * reports as *Unexpected end of JSON input*.
 *
 * **`ESCAPES[c]` is not a safe lookup on an ExtendScript object.** Every object
 * in ExtendScript carries the operator methods the language overloads —
 * `'-'`, `'/'`, `'+'`, `'*'` — as inherited native functions, so
 * `ESCAPES['-']` is a *truthy Function*, and concatenating it raises *Object of
 * type Function found where a Number, Array, or Property is needed*. Block 10
 * session 52 met it on every build: two file paths and one font name
 * (`Almarai-Bold`) each contain one of those characters. `hasOwnProperty` is
 * the guard, and it is the reason nothing here indexes a table without one.
 *
 * The usability probe rather than a version stamp: a host with a working
 * JSON keeps it, byte for byte, so nothing that already agrees with After
 * Effects' own output moves.
 */
if (typeof JSON === 'undefined') {
    JSON = {};
}
(function () {
    function usable() {
        try {
            return JSON.stringify('a-b/c+d*e') === '"a-b/c+d*e"' &&
                JSON.stringify({ a: 1, b: [null, true] }) === '{"a":1,"b":[null,true]}';
        } catch (probeError) {
            return false;
        }
    }

    if (typeof JSON.stringify === 'function' && usable()) return;

    var ESCAPES = {
        '\b': '\\b', '\t': '\\t', '\n': '\\n', '\f': '\\f', '\r': '\\r',
        '"': '\\"', '\\': '\\\\'
    };

    function escapeFor(c) {
        return ESCAPES.hasOwnProperty(c) ? ESCAPES[c] : null;
    }

    function quote(s) {
        var out = '"';
        for (var i = 0; i < s.length; i++) {
            var c = s.charAt(i);
            var escaped = escapeFor(c);
            if (escaped !== null) {
                out += escaped;
            } else if (c < ' ') {
                var hex = c.charCodeAt(0).toString(16);
                out += '\\u' + '0000'.substring(hex.length) + hex;
            } else {
                out += c;
            }
        }
        return out + '"';
    }

    /*
     * `undefined` and functions are dropped from objects and become `null` in
     * arrays, which is what After Effects' own stringify does: this only ever
     * runs in place of the host's, so it must not change the shape of what a
     * result file says.
     */
    function str(value, indent, gap) {
        if (value === null) return 'null';
        var t = typeof value;
        if (t === 'string') return quote(value);
        if (t === 'boolean') return String(value);
        if (t === 'number') return isFinite(value) ? String(value) : 'null';
        if (t !== 'object') return undefined;

        var inner = gap + indent;
        var open = indent === '' ? '' : '\n' + inner;
        var close = indent === '' ? '' : '\n' + gap;
        var separator = indent === '' ? ',' : ',\n' + inner;
        var colon = indent === '' ? ':' : ': ';

        var parts = [];
        var i;
        if (value instanceof Array) {
            for (i = 0; i < value.length; i++) {
                var element = str(value[i], indent, inner);
                parts.push(element === undefined ? 'null' : element);
            }
            if (parts.length === 0) return '[]';
            return '[' + open + parts.join(separator) + close + ']';
        }
        for (var k in value) {
            if (!value.hasOwnProperty(k)) continue;
            var v = str(value[k], indent, inner);
            if (v !== undefined) parts.push(quote(k) + colon + v);
        }
        if (parts.length === 0) return '{}';
        return '{' + open + parts.join(separator) + close + '}';
    }

    JSON.stringify = function (value, replacer, space) {
        var indent = '';
        if (typeof space === 'number' && space > 0) {
            for (var i = 0; i < space; i++) indent += ' ';
        } else if (typeof space === 'string') {
            indent = space;
        }
        var s = str(value, indent, '');
        return s === undefined ? 'null' : s;
    };
}());
