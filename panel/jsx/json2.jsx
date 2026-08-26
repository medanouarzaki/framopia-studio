/*
 * A minimal JSON.stringify for ExtendScript, installed only when the host has
 * no JSON global. After Effects 26 does provide one, but the panel is ES3 and
 * CEP hosts differ, so build.jsx must not assume it.
 *
 * Deliberately stringify-only: the driver passes options in through a file
 * that ExtendScript reads with eval, and the only direction that needs
 * serialising is the result coming back.
 */
if (typeof JSON === 'undefined') {
    JSON = {};
}
if (typeof JSON.stringify !== 'function') {
    JSON.stringify = (function () {
        var ESCAPES = {
            '\b': '\\b', '\t': '\\t', '\n': '\\n', '\f': '\\f', '\r': '\\r',
            '"': '\\"', '\\': '\\\\'
        };

        function quote(s) {
            var out = '"';
            for (var i = 0; i < s.length; i++) {
                var c = s.charAt(i);
                if (ESCAPES[c]) {
                    out += ESCAPES[c];
                } else if (c < ' ') {
                    var hex = c.charCodeAt(0).toString(16);
                    out += '\\u' + '0000'.substring(hex.length) + hex;
                } else {
                    out += c;
                }
            }
            return out + '"';
        }

        function str(value) {
            if (value === null) return 'null';
            var t = typeof value;
            if (t === 'string') return quote(value);
            if (t === 'boolean') return String(value);
            if (t === 'number') return isFinite(value) ? String(value) : 'null';
            if (t !== 'object') return 'null';

            var parts = [];
            var i;
            if (value instanceof Array) {
                for (i = 0; i < value.length; i++) {
                    var el = str(value[i]);
                    parts.push(el === undefined ? 'null' : el);
                }
                return '[' + parts.join(',') + ']';
            }
            for (var k in value) {
                if (!value.hasOwnProperty(k)) continue;
                var v = str(value[k]);
                if (v !== undefined) parts.push(quote(k) + ':' + v);
            }
            return '{' + parts.join(',') + '}';
        }

        return function (value) {
            var s = str(value);
            return s === undefined ? 'null' : s;
        };
    }());
}
