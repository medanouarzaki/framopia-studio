"""
Resolve After Effects' font names to files the panel can actually draw with.

**The panel is a browser and can only draw a face it can load as a file.** After
Effects hands over names, and Block 10 session 12 measured that its names and
macOS's disagree for a variable font's instance: After Effects says
`Inter-SemiBold` where the system publishes `Inter-Regular_SemiBold`. Matching on
the published PostScript name resolves only 900 of 1188 here, and misses two of
the three faces this studio actually uses.

CoreText resolves all three, because it is the thing that owns the naming. It is
asked through `ctypes` rather than a dependency: no venv, no wheel, stdlib only.

**A substitution is rejected, never returned.** `CTFontDescriptorCreateWithNameAndSize`
answers a descriptor for a name it does not have, so the name it resolved is
compared against the name asked for and a mismatch is reported as unresolvable.
That is the same defect this whole field exists to fix — a face silently standing
in for the one that was chosen.

**The variation axes come back with the file**, because a variable font loaded by
CSS renders its default instance unless told otherwise: the file behind
`Inter-SemiBold` is `Inter-VariableFont_opsz,wght.ttf`, whose default is Regular.
CoreText gives `wght: 600` exactly, so nothing is guessed from a weight name.

JSON on stdin, JSON on stdout, nothing else on stdout ever — the CV sidecar's
contract.
"""

import ctypes
import ctypes.util
import json
import sys

_cf = ctypes.cdll.LoadLibrary(ctypes.util.find_library("CoreFoundation"))
_ct = ctypes.cdll.LoadLibrary(ctypes.util.find_library("CoreText"))

_UTF8 = 0x08000100
_POSIX_PATH = 0
_CF_DOUBLE = 13

for _name, _res, _args in [
    ("CFStringCreateWithCString", ctypes.c_void_p, [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_uint32]),
    ("CFStringGetCString", ctypes.c_bool, [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_long, ctypes.c_uint32]),
    ("CFRelease", None, [ctypes.c_void_p]),
    ("CFURLCopyFileSystemPath", ctypes.c_void_p, [ctypes.c_void_p, ctypes.c_uint32]),
    ("CFDictionaryGetCount", ctypes.c_long, [ctypes.c_void_p]),
    ("CFDictionaryGetKeysAndValues", None, [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p]),
    ("CFNumberGetValue", ctypes.c_bool, [ctypes.c_void_p, ctypes.c_long, ctypes.c_void_p]),
]:
    _fn = getattr(_cf, _name)
    _fn.restype = _res
    _fn.argtypes = _args

_ct.CTFontDescriptorCreateWithNameAndSize.restype = ctypes.c_void_p
_ct.CTFontDescriptorCreateWithNameAndSize.argtypes = [ctypes.c_void_p, ctypes.c_double]
_ct.CTFontDescriptorCopyAttribute.restype = ctypes.c_void_p
_ct.CTFontDescriptorCopyAttribute.argtypes = [ctypes.c_void_p, ctypes.c_void_p]

_URL_ATTR = ctypes.c_void_p.in_dll(_ct, "kCTFontURLAttribute")
_NAME_ATTR = ctypes.c_void_p.in_dll(_ct, "kCTFontNameAttribute")
_VARIATION_ATTR = ctypes.c_void_p.in_dll(_ct, "kCTFontVariationAttribute")


def _cfstr(value):
    return _cf.CFStringCreateWithCString(None, value.encode("utf-8"), _UTF8)


def _text(ref):
    if not ref:
        return None
    buffer = ctypes.create_string_buffer(4096)
    if _cf.CFStringGetCString(ref, buffer, 4096, _UTF8):
        return buffer.value.decode("utf-8")
    return None


def _number(ref):
    if not ref:
        return None
    out = ctypes.c_double()
    return out.value if _cf.CFNumberGetValue(ref, _CF_DOUBLE, ctypes.byref(out)) else None


def _axes(descriptor):
    """Axis tag to value, e.g. `{"wght": 600.0}`. Empty for a static face."""
    variation = _ct.CTFontDescriptorCopyAttribute(descriptor, _VARIATION_ATTR)
    if not variation:
        return {}
    out = {}
    count = _cf.CFDictionaryGetCount(variation)
    keys = (ctypes.c_void_p * count)()
    values = (ctypes.c_void_p * count)()
    _cf.CFDictionaryGetKeysAndValues(variation, keys, values)
    for i in range(count):
        tag = _number(keys[i])
        value = _number(values[i])
        if tag is None or value is None:
            continue
        packed = int(tag)
        out["".join(chr((packed >> shift) & 0xFF) for shift in (24, 16, 8, 0))] = value
    _cf.CFRelease(variation)
    return out


def resolve(name):
    handle = _cfstr(name)
    descriptor = _ct.CTFontDescriptorCreateWithNameAndSize(handle, 0.0)
    _cf.CFRelease(handle)
    if not descriptor:
        return {"path": None, "axes": {}, "why": "CoreText knows no font by that name"}
    resolved = _text(_ct.CTFontDescriptorCopyAttribute(descriptor, _NAME_ATTR))
    url = _ct.CTFontDescriptorCopyAttribute(descriptor, _URL_ATTR)
    path = None
    if url:
        raw = _cf.CFURLCopyFileSystemPath(url, _POSIX_PATH)
        path = _text(raw)
        if raw:
            _cf.CFRelease(raw)
        _cf.CFRelease(url)
    axes = _axes(descriptor)
    _cf.CFRelease(descriptor)

    if resolved != name:
        # CoreText answers with a substitute rather than nothing. Returning it
        # would show a face nobody chose, which is the defect this fixes.
        return {"path": None, "axes": {}, "why": f"the system offers {resolved} instead"}
    if path is None:
        # Two cases look identical from here and neither is guessed at: a font an
        # application registered in its own process (Adobe's UI faces do this),
        # and a name nothing has. CoreText answers a descriptor for both and a
        # file URL for neither, so the message states what was observed.
        return {
            "path": None,
            "axes": axes,
            "why": "the system offers no file for this font",
        }
    return {"path": path, "axes": axes, "why": None}


def main():
    request = json.load(sys.stdin)
    names = request.get("names", [])
    json.dump({"fonts": {name: resolve(name) for name in names}}, sys.stdout)


if __name__ == "__main__":
    main()
