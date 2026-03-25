#!/usr/bin/env python3
"""
Laser Checker Fix — Inkscape Extension
Prepares SVG files for laser cutting in four steps (always in this order):
  1. Ungroup elements (Inkscape layers are preserved)
  2. Split compound paths into individual paths
  3. Remove duplicate paths
  4. Join connected line segments / paths into polylines

Install: copy both laser_checker_fix.py and laser_checker_fix.inx to your
Inkscape extensions folder, then restart Inkscape.
  Windows : %APPDATA%\inkscape\extensions\
  macOS   : ~/.config/inkscape/extensions/
  Linux   : ~/.config/inkscape/extensions/
"""

import re
from collections import defaultdict

import inkex
from inkex.paths import Path

# ── Shared tolerance (same as the web app) ────────────────────────────────────
EPS = 0.5


# ── Helpers ───────────────────────────────────────────────────────────────────

def _local_tag(el):
    """Return the local (un-namespaced) tag name of an lxml element."""
    tag = el.tag
    return tag.split('}')[-1] if '}' in tag else tag


def _parse_nums(s):
    return [float(n) for n in re.findall(r'[-+]?(?:\d*\.?\d+)(?:[eE][-+]?\d+)?', s)]


def _is_layer(el):
    return el.get(inkex.addNS('groupmode', 'inkscape')) == 'layer'


def _points_equal(a, b):
    return abs(a[0] - b[0]) < EPS and abs(a[1] - b[1]) < EPS


def _stroke_key(el):
    """
    Style key based on stroke properties only — fill is irrelevant for laser
    cutting, so paths that differ only in fill should still be merged.
    Reads from both individual attributes and the inline style="" attribute;
    the style attribute takes precedence.
    """
    props = {}
    for attr in ('stroke', 'stroke-width', 'stroke-opacity'):
        v = el.get(attr)
        if v is not None:
            props[attr] = v
    for decl in el.get('style', '').split(';'):
        if ':' not in decl:
            continue
        k, _, v = decl.partition(':')
        k = k.strip()
        if k in ('stroke', 'stroke-width', 'stroke-opacity'):
            props[k] = v.strip()
    return ';'.join(f'{k}={v}' for k, v in sorted(props.items()))


def _el_to_points(el):
    """
    Convert a <line> or simple open <path> (M/L/H/V commands only, one
    sub-path, no curves, not closed) to an ordered list of absolute (x, y)
    tuples.  Returns None if the element cannot be represented this way.
    """
    tag = _local_tag(el)

    if tag == 'line':
        return [
            (float(el.get('x1', 0)), float(el.get('y1', 0))),
            (float(el.get('x2', 0)), float(el.get('y2', 0))),
        ]

    if tag == 'path':
        d = el.get('d', '')
        # Reject curves, closed paths, compound paths
        if re.search(r'[CcSsQqTtAaZz]', d):
            return None
        if len(re.findall(r'[Mm]', d)) > 1:
            return None

        points = []
        x, y = 0.0, 0.0
        for token in re.split(r'(?=[MmLlHhVv])', d.strip()):
            token = token.strip()
            if not token:
                continue
            cmd = token[0]
            args = _parse_nums(token[1:])
            if cmd == 'M':
                i = 0
                while i + 1 < len(args):
                    x, y = args[i], args[i + 1]
                    points.append((x, y))
                    i += 2
            elif cmd == 'm':
                i = 0
                while i + 1 < len(args):
                    x += args[i]; y += args[i + 1]
                    points.append((x, y))
                    i += 2
            elif cmd == 'L':
                i = 0
                while i + 1 < len(args):
                    x, y = args[i], args[i + 1]
                    points.append((x, y))
                    i += 2
            elif cmd == 'l':
                i = 0
                while i + 1 < len(args):
                    x += args[i]; y += args[i + 1]
                    points.append((x, y))
                    i += 2
            elif cmd == 'H':
                for a in args:
                    x = a; points.append((x, y))
            elif cmd == 'h':
                for a in args:
                    x += a; points.append((x, y))
            elif cmd == 'V':
                for a in args:
                    y = a; points.append((x, y))
            elif cmd == 'v':
                for a in args:
                    y += a; points.append((x, y))

        return points if len(points) >= 2 else None

    return None


def _chain_segments(point_lists):
    """
    Chain a list of point-lists by shared endpoints.  Connected sequences are
    merged into a single ordered point list; isolated segments stay separate.
    Handles all four connection orientations:
      head→tail, tail→tail, tail→head, head→head
    """
    remaining = [list(pts) for pts in point_lists]
    chains = []

    while remaining:
        chain = remaining.pop(0)
        extended = True
        while extended:
            extended = False
            tail = chain[-1]
            head = chain[0]
            for i, pts in enumerate(remaining):
                r_head = pts[0]
                r_tail = pts[-1]
                if _points_equal(r_head, tail):
                    # Segment head matches chain tail → append (skip shared point)
                    chain.extend(pts[1:])
                    remaining.pop(i); extended = True; break
                elif _points_equal(r_tail, tail):
                    # Segment tail matches chain tail → append reversed
                    chain.extend(list(reversed(pts))[1:])
                    remaining.pop(i); extended = True; break
                elif _points_equal(r_tail, head):
                    # Segment tail matches chain head → prepend (skip shared point)
                    chain[0:0] = pts[:-1]
                    remaining.pop(i); extended = True; break
                elif _points_equal(r_head, head):
                    # Segment head matches chain head → prepend reversed
                    chain[0:0] = list(reversed(pts))[:-1]
                    remaining.pop(i); extended = True; break
        chains.append(chain)

    return chains


# ── Extension class ───────────────────────────────────────────────────────────

class LaserCheckerFix(inkex.EffectExtension):

    def effect(self):
        # Fixed order — same as the web app
        self._fix_groups()
        self._fix_compound_paths()
        self._fix_duplicate_paths()
        self._fix_disconnected_lines()

    # ── Step 1: Ungroup ───────────────────────────────────────────────────────

    def _fix_groups(self):
        """Flatten all <g> elements that are not Inkscape layers."""
        changed = True
        while changed:
            changed = False
            for g in self.svg.xpath('//svg:g', namespaces=inkex.NSS):
                if _is_layer(g):
                    continue
                parent = g.getparent()
                if parent is None:
                    continue
                idx = list(parent).index(g)
                children = list(g)
                for i, child in enumerate(children):
                    parent.insert(idx + i, child)
                parent.remove(g)
                changed = True

    # ── Step 2: Split compound paths ─────────────────────────────────────────

    def _fix_compound_paths(self):
        """
        Split any <path> with multiple sub-paths (multiple M commands) into
        individual <path> elements.  Uses inkex's Path.to_absolute() so all
        relative 'm' offsets are resolved to correct absolute coordinates.
        """
        for el in list(self.svg.xpath('//svg:path', namespaces=inkex.NSS)):
            d = el.get('d', '')
            if len(re.findall(r'[Mm]', d)) <= 1:
                continue
            try:
                abs_cmds = list(Path(d).to_absolute())
            except Exception:
                continue

            # Split at every Move command except the first
            sub_paths = []
            current = []
            for cmd in abs_cmds:
                if type(cmd).__name__ == 'Move' and current:
                    sub_paths.append(current)
                    current = []
                current.append(cmd)
            if current:
                sub_paths.append(current)

            if len(sub_paths) <= 1:
                continue

            parent = el.getparent()
            idx = list(parent).index(el)
            for i, sub in enumerate(sub_paths):
                new_el = el.copy()
                new_el.set('d', str(Path(sub)))
                if i > 0:
                    new_el.attrib.pop('id', None)
                parent.insert(idx + i, new_el)
            parent.remove(el)

    # ── Step 3: Remove duplicate paths ───────────────────────────────────────

    def _fix_duplicate_paths(self):
        """Remove <path> elements whose 'd' attribute is an exact duplicate."""
        seen = set()
        for el in list(self.svg.xpath('//svg:path', namespaces=inkex.NSS)):
            # Normalise whitespace so "M 10, 10" and "M  10,10" match
            key = ' '.join(el.get('d', '').split())
            if key in seen:
                el.getparent().remove(el)
            else:
                seen.add(key)

    # ── Step 4: Join disconnected lines ──────────────────────────────────────

    def _fix_disconnected_lines(self):
        """
        Convert <line> elements to <path> and chain paths that share endpoints
        (within EPS tolerance) into single polyline paths.  Only same-stroke
        segments are merged; fill differences are ignored.
        """
        candidates = list(self.svg.xpath(
            '//svg:line | //svg:path', namespaces=inkex.NSS
        ))

        segs = []
        for el in candidates:
            pts = _el_to_points(el)
            if pts:
                segs.append({'points': pts, 'el': el, 'key': _stroke_key(el)})

        if not segs:
            return

        # Group by stroke style so only same-stroke segments are merged
        groups = defaultdict(list)
        for seg in segs:
            groups[seg['key']].append(seg)

        # We will insert all new paths before the first original element
        ref_el = segs[0]['el']
        parent = ref_el.getparent()

        for group_segs in groups.values():
            chains = _chain_segments([s['points'] for s in group_segs])
            ref = group_segs[0]['el']
            for chain in chains:
                path_el = inkex.PathElement()
                path_el.set('d', ' '.join(
                    f"{'M' if i == 0 else 'L'} {p[0]},{p[1]}"
                    for i, p in enumerate(chain)
                ))
                # Copy all non-positional, non-identity attributes from the
                # reference element (carries stroke, stroke-width, etc.)
                skip = {'x1', 'y1', 'x2', 'y2', 'id', 'd'}
                for attr_name, attr_val in ref.attrib.items():
                    local = attr_name.split('}')[-1] if '}' in attr_name else attr_name
                    if local not in skip:
                        path_el.set(attr_name, attr_val)
                parent.insert(list(parent).index(ref_el), path_el)

        # Remove all original elements that were processed
        for seg in segs:
            p = seg['el'].getparent()
            if p is not None:
                p.remove(seg['el'])


if __name__ == '__main__':
    LaserCheckerFix().run()
