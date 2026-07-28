use <./../modules/scad/roundedcube.scad>

_box_width = 100;
_box_depth = 100;
_box_height = 50;
_thickness = 3;
_box_radius = 5;
// Anzahl Löcher pro Segment und Wand: -1 = automatisch (so viele wie möglich), 0 = keine, 1-n = genau diese Anzahl
// Untere Wand (y=0, entlang X):  _left = linkes Segment (kleine X), _right = rechtes Segment (große X)
_num_holes_bottom_left  = 1;
_num_holes_bottom_right = 0;
// Obere Wand (y=_d, entlang X):
_num_holes_top_left  = 1;
_num_holes_top_right = 0;
// Linke Wand (x=0, entlang Y):   _front = vorderes Segment (kleine Y), _back = hinteres Segment (große Y)
_num_holes_left_front = 1;
_num_holes_left_back  = 0;
// Rechte Wand (x=_w, entlang Y):
_num_holes_right_front = 1;
_num_holes_right_back  = 0;
_hole_diameter = 16;  // Durchmesser der Kabeldurchführungs-Löcher in mm
_hole_distance = 5;   // Mindestabstand zwischen zwei Löchern in mm

// ---------------------------------------------------------------------------
// Parameter für die Montagelöcher
// ---------------------------------------------------------------------------
// Wo sollen die Montagelöcher hin?
//   "floor"  = 4 Löcher im Boden (je _floor_hole_offset von den Ecken)
//   "bottom" = Löcher in der unteren Wand (y=0, entlang X)
//   "top"    = Löcher in der oberen Wand  (y=_d, entlang X)
//   "left"   = Löcher in der linken Wand  (x=0, entlang Y)
//   "right"  = Löcher in der rechten Wand (x=_w, entlang Y)
//   "none"   = keine Montagelöcher
_mount_location              = "floor";
_mount_hole_count            = 2;   // Anzahl Löcher bei Wandmontage (2 oder 3; bei "floor": immer 4)
_floor_hole_diameter         = 5;   // Innendurchmesser des Lochs (z.B. 5 für M4-Schraube)
_floor_hole_reinforce_diam   = 12;  // Außendurchmesser des Verstärkungsrings
_floor_hole_reinforce_height = 2;   // Höhe des Verstärkungsrings über dem Boden (nach innen)
_floor_hole_offset           = 25;  // Abstand der Loch-Mittelpunkte von den Ecken/Rändern (X und Y)

// ---------------------------------------------------------------------------
// Parameter für die Deckelbefestigung (Mittelstege)
// ---------------------------------------------------------------------------
// Anzahl der Mittelstege (Schmelzmuttern-Halter) pro Seite – ohne die 4 Eckpfosten
//   0 = kein Mittelsteg (mehr Platz für Kabellöcher)
//   1 = ein Steg in der Mitte
//   N = N gleichmäßig verteilte Stege
_lid_posts_front = 0;  // Vorderseite (y=0, entlang X)
_lid_posts_back  = 0;  // Rückseite   (y=d, entlang X)
_lid_posts_left  = 0;  // Linke Seite (x=0, entlang Y)
_lid_posts_right = 0;  // Rechte Seite (x=w, entlang Y)

// nut holder radius (used for collision check)
// Radius der Schmelzmuttern-Halter – wird für die Kollisionsprüfung genutzt
_nut_holder_r = 5;

// ---------------------------------------------------------------------------
// Hilfsfunktionen: Steg-Positionen und gesperrte Bereiche
// ---------------------------------------------------------------------------
// Gleichmäßig verteilte Positionen für Mittelstege zwischen den Eckpfosten
// (Eckpfosten liegen immer bei 7 und wall_len-7)
function _mid_post_pos(wall_len, count) =
    count <= 0 ? [] :
    count == 1 ? [wall_len / 2] :
    let(step = (wall_len - 14) / (count + 1))
    [for (i = [1 : count]) 7 + i * step];

// Alle gesperrten Positionen einer Wand: Eckpfosten + Mittelstege
function _blocked_pos(wall_len, count) =
    let(mids = _mid_post_pos(wall_len, count))
    concat([7], mids, [wall_len - 7]);

// Gesperrte Positionen je Wand – automatisch aus _lid_posts_* berechnet
_blocked_x_front = _blocked_pos(_box_width, _lid_posts_front);
_blocked_x_back  = _blocked_pos(_box_width, _lid_posts_back);
_blocked_y_left  = _blocked_pos(_box_depth, _lid_posts_left);
_blocked_y_right = _blocked_pos(_box_depth, _lid_posts_right);

// ---------------------------------------------------------------------------
// Hilfsfunktion: Summiert alle Elemente eines Vektors (rekursiv)
// ---------------------------------------------------------------------------
function _sum(v, i=0) = i >= len(v) ? 0 : v[i] + _sum(v, i + 1);

// ---------------------------------------------------------------------------
// Hilfsfunktion: Berechnet alle freien Segmente (gültige Bereiche für
// Loch-Mittelpunkte) entlang einer Wand.
//
// Die Wand ist in der Mitte durch Schmelzmuttern-Halter unterbrochen.
// Jeder Halter sperrt einen Bereich von ±clear_gap um seinen Mittelpunkt.
// Die freien Segmente sind die Lücken zwischen diesen Sperrzonen,
// begrenzt durch die Wandgrenzen [min_x, max_x].
//
// Voraussetzung: blocked muss aufsteigend sortiert sein.
// ---------------------------------------------------------------------------
function _free_segments(min_x, max_x, blocked, clear_gap) = [
    for (i = [-1 : len(blocked) - 1])
    let(
        // Linke Grenze: entweder Wandrand oder rechter Rand der vorherigen Sperrzone
        lo = (i == -1) ? min_x : blocked[i] + clear_gap,
        // Rechte Grenze: entweder Wandrand oder linker Rand der nächsten Sperrzone
        hi = (i == len(blocked) - 1) ? max_x : blocked[i + 1] - clear_gap
    )
    if (hi > lo) [lo, hi]  // Nur ausnehmen wenn tatsächlich Platz vorhanden
];

// ---------------------------------------------------------------------------
// Hilfsfunktion: Aggregiert num_segs-Einträge ab Index 'from' aufsummiert.
//
// Wird benötigt, wenn weniger Segmente existieren als num_segs-Einträge vorhanden
// sind (z.B. wegen fehlender Mittelstege). In diesem Fall werden die überschüssigen
// Einträge zum letzten Segment addiert.
//
// Rückgabe:
//   -1  → auto (kein Eintrag vorhanden, oder mindestens ein Eintrag ist -1)
//   ≥0  → Summe aller Einträge ab 'from'
// ---------------------------------------------------------------------------
function _agg_num(v, i) =
    i >= len(v) ? -1 :
    v[i] < 0   ? -1 :
    let(r = _agg_num(v, i + 1))
    (r == -1 && i < len(v) - 1) ? -1 :  // mittlerer -1-Eintrag → auto
    (r == -1)                   ? v[i] : // kein weiterer Eintrag → nur dieser Wert
    v[i] + r;

// ---------------------------------------------------------------------------
// Hilfsfunktion: Maximale Anzahl Löcher die in ein Segment passen.
// Berechnung: (Segmentbreite + Abstand) / (Durchmesser + Abstand)
// ---------------------------------------------------------------------------
function _max_holes_in_seg(seg, hole_diam, hole_dist) =
    max(0, floor((seg[1] - seg[0] + hole_dist) / (hole_diam + hole_dist)));

// ---------------------------------------------------------------------------
// Hilfsfunktion: Platziert n Löcher gleichmäßig über das gesamte Segment verteilt.
// Gibt eine Liste der Loch-Mittelpunkte zurück.
//
// Bei n=1: Loch mittig im Segment.
// Bei n>1: erstes Loch am linken Rand (seg[0]+r), letztes am rechten Rand (seg[1]-r),
//          dazwischen gleichmäßige Abstände – nutzt damit den vollen freien Bereich.
// ---------------------------------------------------------------------------
function _place_in_seg(seg, n, hole_diam, hole_dist) =
    n <= 0 ? [] :
    n == 1 ? [(seg[0] + seg[1]) / 2] :
    let(
        r     = hole_diam / 2,
        start = seg[0] + r,
        end   = seg[1] - r,
        step  = (end - start) / (n - 1)
    )
    [for (i = [0 : n - 1]) start + i * step];

// ---------------------------------------------------------------------------
// Hauptfunktion: Berechnet die endgültigen Lochpositionen entlang einer Wand.
//
// Funktionsweise:
//   1. Die Wand wird in freie Segmente zwischen den Schmelzmuttern-Haltern
//      aufgeteilt (Sperrzonen = Halter-Mittelpunkt ± (Lochradius + Halterradius))
//   2. Jedes Segment wird unabhängig gesteuert und zentriert befüllt
//
// Parameter:
//   wall_len  – Länge der Wand
//   num_segs  – Liste mit gewünschter Lochanzahl je Segment, z.B. [2, 1]:
//                 -1  → automatisch, so viele wie in das Segment passen
//                  0  → keine Löcher in diesem Segment
//                 1-n → genau diese Anzahl; passt sie nicht, werden 0 Löcher
//                       gesetzt (Warnung erfolgt im aufrufenden Modul)
//   dist      – Mindestabstand zwischen zwei Löchern (_hole_distance)
//   hole_r    – Lochradius (_hole_diameter / 2)
//   blocked   – Liste der gesperrten Positionen (aufsteigend sortiert)
//   t         – Wandstärke (_thickness)
//
// Rückgabe: Flache Liste aller Loch-Mittelpunkte (leer = keine Löcher)
//
// Segmentanzahl vs. num_segs-Länge:
//   segs > num_segs  → überschüssige Segmente werden automatisch befüllt (-1)
//   segs < num_segs  → überschüssige num_segs-Einträge werden zum letzten
//                       Segment addiert, damit kein Wunsch "unter den Tisch fällt"
// ---------------------------------------------------------------------------
function calc_hole_positions(wall_len, num_segs, dist, hole_r, blocked, t) =
    let(
        min_x = t + hole_r,
        max_x = wall_len - t - hole_r,
        hole_diam = hole_r * 2,
        // Mindestabstand Lochmittelpunkt zu Halter-Mittelpunkt (Kante-zu-Kante = 0)
        clear_gap = hole_r + _nut_holder_r,
        segs = _free_segments(min_x, max_x, blocked, clear_gap)
    )
    len(segs) == 0 ? [] :
    [for (i = [0 : len(segs) - 1])
        let(
            // Letztes Segment: alle verbleibenden num_segs-Einträge aggregieren
            // Vorherige Segmente: direkt zugeordnet (oder -1 = auto wenn kein Eintrag)
            num   = (i < len(segs) - 1)
                        ? ((i < len(num_segs)) ? num_segs[i] : -1)
                        : _agg_num(num_segs, i),
            max_n = _max_holes_in_seg(segs[i], hole_diam, dist),
            // Bei num > max_n ist Platzierung unmöglich → 0 Löcher (Warnung im Modul)
            n = (num == -1) ? max_n : ((num > max_n) ? 0 : num)
        )
        each _place_in_seg(segs[i], n, hole_diam, dist)
    ];

// Löcher in der unteren Wand (entlang X, bei y=0)
// num_left: Segment links (kleine X-Werte), num_right: Segment rechts (große X-Werte)
module wall_holes_bottom(_w, _d, _h, _t, num_left, num_right, dist, diam, blocked) {
    hole_r = diam / 2;
    positions = calc_hole_positions(_w, [num_left, num_right], dist, hole_r, blocked, _t);
    // Warnung wenn eine feste Anzahl (> 0) nicht vollständig platziert werden konnte
    fixed = (num_left > 0 ? num_left : 0) + (num_right > 0 ? num_right : 0);
    if (fixed > 0 && len(positions) < fixed) {
        echo(str("INFO: Untere Wand – nicht alle Löcher platzierbar (gewünscht=", fixed, ", platziert=", len(positions), ", dist=", dist, ", diam=", diam, ")"));
    }
    for (p = positions) {
        translate([p, -1, _h / 2])
        rotate([-90, 0, 0])
        cylinder(h = _t + 2, d = diam);
    }
}

// Löcher in der oberen Wand (entlang X, bei y=_d)
// num_left: Segment links (kleine X-Werte), num_right: Segment rechts (große X-Werte)
module wall_holes_top(_w, _d, _h, _t, num_left, num_right, dist, diam, blocked) {
    hole_r = diam / 2;
    positions = calc_hole_positions(_w, [num_left, num_right], dist, hole_r, blocked, _t);
    fixed = (num_left > 0 ? num_left : 0) + (num_right > 0 ? num_right : 0);
    if (fixed > 0 && len(positions) < fixed) {
        echo(str("INFO: Obere Wand – nicht alle Löcher platzierbar (gewünscht=", fixed, ", platziert=", len(positions), ", dist=", dist, ", diam=", diam, ")"));
    }
    for (p = positions) {
        translate([p, _d - _t - 1, _h / 2])
        rotate([-90, 0, 0])
        cylinder(h = _t + 2, d = diam);
    }
}

// Löcher in der linken Wand (entlang Y, bei x=0)
// num_front: Segment vorne (kleine Y-Werte, nahe untere Wand), num_back: Segment hinten (große Y-Werte)
module wall_holes_left(_w, _d, _h, _t, num_front, num_back, dist, diam, blocked) {
    hole_r = diam / 2;
    positions = calc_hole_positions(_d, [num_front, num_back], dist, hole_r, blocked, _t);
    fixed = (num_front > 0 ? num_front : 0) + (num_back > 0 ? num_back : 0);
    if (fixed > 0 && len(positions) < fixed) {
        echo(str("INFO: Linke Wand – nicht alle Löcher platzierbar (gewünscht=", fixed, ", platziert=", len(positions), ", dist=", dist, ", diam=", diam, ")"));
    }
    for (p = positions) {
        translate([-1, p, _h / 2])
        rotate([0, 90, 0])
        cylinder(h = _t + 2, d = diam);
    }
}

// Löcher in der rechten Wand (entlang Y, bei x=_w)
// num_front: Segment vorne (kleine Y-Werte, nahe untere Wand), num_back: Segment hinten (große Y-Werte)
module wall_holes_right(_w, _d, _h, _t, num_front, num_back, dist, diam, blocked) {
    hole_r = diam / 2;
    positions = calc_hole_positions(_d, [num_front, num_back], dist, hole_r, blocked, _t);
    fixed = (num_front > 0 ? num_front : 0) + (num_back > 0 ? num_back : 0);
    if (fixed > 0 && len(positions) < fixed) {
        echo(str("INFO: Rechte Wand – nicht alle Löcher platzierbar (gewünscht=", fixed, ", platziert=", len(positions), ", dist=", dist, ", diam=", diam, ")"));
    }
    for (p = positions) {
        translate([_w - _t - 1, p, _h / 2])
        rotate([0, 90, 0])
        cylinder(h = _t + 2, d = diam);
    }
}

module box_base(_w, _d, _h, _t, _r) {
    difference() {
        roundedcube(size = [_w, _d, _h], center = false, radius = _r, "z");
        translate([_t, _t, _t])
        roundedcube(size = [_w - _t * 2, _d - _t * 2, _h], center = false, radius = _r, "z");
    }
}

module lid_base(_w, _d, _h, _t, _r) {
    difference() {
        roundedcube(size = [_w + _t * 2, _d + _t * 2, _t * 2], center = false, radius = _r, "z");
        translate([_t + 0.1, _t + 0.1, _t])
        roundedcube(size = [_w + 0.2, _d + 0.2, _h], center = false, radius = _r, "z");
    }
}


module fusable_nuts_holder(_h) {
    difference() {
        cylinder(h = _h, r = 5);
        translate([0, 0, -1])
        cylinder(h = _h + 2, r = 2.5);
    }
}

// ---------------------------------------------------------------------------
// Verstärkter Montageloch-Einsatz im Boden.
//
// Besteht aus zwei Teilen:
//   1. boss()  – der Verstärkungsring, der aus dem Boden nach innen ragt
//                (wird in union() zur Box addiert)
//   2. cut()   – das Durchgangsloch durch Boden + Ring
//                (wird in difference() von der Box subtrahiert)
//
// Beide Module müssen an derselben [x, y]-Position aufgerufen werden.
// ---------------------------------------------------------------------------
module floor_hole_boss(_t, _reinforce_d, _reinforce_h) {
    // Verstärkungsring sitzt auf der Innenseite des Bodens
    translate([0, 0, _t])
    cylinder(h = _reinforce_h, d = _reinforce_d);
}

module floor_hole_cut(_t, _hole_d, _reinforce_h) {
    // Durchgangsloch durch Boden und Verstärkungsring (mit 1mm Überstand je Seite)
    translate([0, 0, -1])
    cylinder(h = _t + _reinforce_h + 2, d = _hole_d);
}

// ---------------------------------------------------------------------------
// Hilfsfunktion: Positionen für Wandmontagelöcher.
// Verteilt count Löcher gleichmäßig zwischen offset und wall_len - offset.
// ---------------------------------------------------------------------------
function _mount_wall_positions(wall_len, count, offset) =
    count <= 0 ? [] :
    count == 1 ? [wall_len / 2] :
    let(step = (wall_len - 2 * offset) / (count - 1))
    [for (i = [0 : count - 1]) offset + i * step];

// Verstärkungsringe für Wandmontagelöcher (in union() addieren).
// loc: "bottom" | "top" | "left" | "right"
module wall_mount_boss(loc, _w, _d, _h, _t, _reinforce_d, _reinforce_h, positions) {
    for (p = positions) {
        if (loc == "bottom")
            translate([p, _t,      _h / 2]) rotate([-90, 0,   0]) cylinder(h = _reinforce_h, d = _reinforce_d);
        if (loc == "top")
            translate([p, _d - _t, _h / 2]) rotate([ 90, 0,   0]) cylinder(h = _reinforce_h, d = _reinforce_d);
        if (loc == "left")
            translate([_t,      p, _h / 2]) rotate([  0, 90,  0]) cylinder(h = _reinforce_h, d = _reinforce_d);
        if (loc == "right")
            translate([_w - _t, p, _h / 2]) rotate([  0, -90, 0]) cylinder(h = _reinforce_h, d = _reinforce_d);
    }
}

// Durchgangslöcher für Wandmontagelöcher (in difference() subtrahieren).
// loc: "bottom" | "top" | "left" | "right"
module wall_mount_cut(loc, _w, _d, _h, _t, _hole_d, _reinforce_h, positions) {
    for (p = positions) {
        if (loc == "bottom")
            translate([p,      -1,      _h / 2]) rotate([-90, 0,   0]) cylinder(h = _t + _reinforce_h + 2, d = _hole_d);
        if (loc == "top")
            translate([p,      _d + 1,  _h / 2]) rotate([ 90, 0,   0]) cylinder(h = _t + _reinforce_h + 2, d = _hole_d);
        if (loc == "left")
            translate([-1,     p,       _h / 2]) rotate([  0, 90,  0]) cylinder(h = _t + _reinforce_h + 2, d = _hole_d);
        if (loc == "right")
            translate([_w + 1, p,       _h / 2]) rotate([  0, -90, 0]) cylinder(h = _t + _reinforce_h + 2, d = _hole_d);
    }
}

module box(_w, _d, _h, _t, _r) {
    difference() {

        union() {
            box_base(_w, _d, _h, _t, _r);

            color("pink") {
                // Eckpfosten (immer vorhanden)
                translate([7,      7,      0]) fusable_nuts_holder(_h);
                translate([_w - 7, 7,      0]) fusable_nuts_holder(_h);
                translate([_w - 7, _d - 7, 0]) fusable_nuts_holder(_h);
                translate([7,      _d - 7, 0]) fusable_nuts_holder(_h);

                // Mittelstege Vorderseite (y=7)
                for (x = _mid_post_pos(_w, _lid_posts_front))
                    translate([x, 7, 0]) fusable_nuts_holder(_h);
                // Mittelstege Rückseite (y=d-7)
                for (x = _mid_post_pos(_w, _lid_posts_back))
                    translate([x, _d - 7, 0]) fusable_nuts_holder(_h);
                // Mittelstege Linke Seite (x=7)
                for (y = _mid_post_pos(_d, _lid_posts_left))
                    translate([7, y, 0]) fusable_nuts_holder(_h);
                // Mittelstege Rechte Seite (x=w-7)
                for (y = _mid_post_pos(_d, _lid_posts_right))
                    translate([_w - 7, y, 0]) fusable_nuts_holder(_h);
            }

            // Verstärkungsringe der Montagelöcher
            color("lightblue") {
                if (_mount_location == "floor") {
                    translate([_floor_hole_offset,      _floor_hole_offset,      0]) floor_hole_boss(_t, _floor_hole_reinforce_diam, _floor_hole_reinforce_height); // vl
                    translate([_w - _floor_hole_offset, _floor_hole_offset,      0]) floor_hole_boss(_t, _floor_hole_reinforce_diam, _floor_hole_reinforce_height); // vr
                    translate([_w - _floor_hole_offset, _d - _floor_hole_offset, 0]) floor_hole_boss(_t, _floor_hole_reinforce_diam, _floor_hole_reinforce_height); // hr
                    translate([_floor_hole_offset,      _d - _floor_hole_offset, 0]) floor_hole_boss(_t, _floor_hole_reinforce_diam, _floor_hole_reinforce_height); // hl
                } else if (_mount_location != "none") {
                    wall_mount_boss(
                        _mount_location, _w, _d, _h, _t,
                        _floor_hole_reinforce_diam, _floor_hole_reinforce_height,
                        _mount_wall_positions(
                            (_mount_location == "bottom" || _mount_location == "top") ? _w : _d,
                            _mount_hole_count, _floor_hole_offset
                        )
                    );
                }
            }
        }



        // Holes in walls
        wall_holes_bottom(_w, _d, _h, _t, _num_holes_bottom_left,  _num_holes_bottom_right, _hole_distance, _hole_diameter, _blocked_x_front);
        wall_holes_top   (_w, _d, _h, _t, _num_holes_top_left,     _num_holes_top_right,    _hole_distance, _hole_diameter, _blocked_x_back);
        wall_holes_left  (_w, _d, _h, _t, _num_holes_left_front,   _num_holes_left_back,    _hole_distance, _hole_diameter, _blocked_y_left);
        wall_holes_right (_w, _d, _h, _t, _num_holes_right_front,  _num_holes_right_back,   _hole_distance, _hole_diameter, _blocked_y_right);

        // Durchgangslöcher der Montagelöcher
        if (_mount_location == "floor") {
            translate([_floor_hole_offset,      _floor_hole_offset,      0]) floor_hole_cut(_t, _floor_hole_diameter, _floor_hole_reinforce_height); // vl
            translate([_w - _floor_hole_offset, _floor_hole_offset,      0]) floor_hole_cut(_t, _floor_hole_diameter, _floor_hole_reinforce_height); // vr
            translate([_w - _floor_hole_offset, _d - _floor_hole_offset, 0]) floor_hole_cut(_t, _floor_hole_diameter, _floor_hole_reinforce_height); // hr
            translate([_floor_hole_offset,      _d - _floor_hole_offset, 0]) floor_hole_cut(_t, _floor_hole_diameter, _floor_hole_reinforce_height); // hl
        } else if (_mount_location != "none") {
            wall_mount_cut(
                _mount_location, _w, _d, _h, _t,
                _floor_hole_diameter, _floor_hole_reinforce_height,
                _mount_wall_positions(
                    (_mount_location == "bottom" || _mount_location == "top") ? _w : _d,
                    _mount_hole_count, _floor_hole_offset
                )
            );
        }
    }
}

module lid(_w, _d, _h, _t, _r) {

    difference() {
        lid_base(_w, _d, _h, _t, _r);

        // Eckschrauben (immer vorhanden)
        translate([7 + _t,      7 + _t,      -10]) cylinder(h = _t + 20, r = 2.5); // ul
        translate([_w - 7 + _t, 7 + _t,      -10]) cylinder(h = _t + 20, r = 2.5); // ur
        translate([_w - 7 + _t, _d - 7 + _t, -10]) cylinder(h = _t + 20, r = 2.5); // or
        translate([7 + _t,      _d - 7 + _t, -10]) cylinder(h = _t + 20, r = 2.5); // ol

        // Mittelstege Vorderseite
        for (x = _mid_post_pos(_w, _lid_posts_front))
            translate([x + _t, 7 + _t, -10]) cylinder(h = _t + 20, r = 2.5);
        // Mittelstege Rückseite
        for (x = _mid_post_pos(_w, _lid_posts_back))
            translate([x + _t, _d - 7 + _t, -10]) cylinder(h = _t + 20, r = 2.5);
        // Mittelstege Linke Seite
        for (y = _mid_post_pos(_d, _lid_posts_left))
            translate([7 + _t, y + _t, -10]) cylinder(h = _t + 20, r = 2.5);
        // Mittelstege Rechte Seite
        for (y = _mid_post_pos(_d, _lid_posts_right))
            translate([_w - 7 + _t, y + _t, -10]) cylinder(h = _t + 20, r = 2.5);

    }
}


translate([_box_width +_thickness, - _thickness, 60])
rotate([0, 180, 0])
lid(_box_width, _box_depth, _box_height, _thickness, _box_radius);
//box(_box_width, _box_depth, _box_height, _thickness, _box_radius);

