/**
 * CoordinateLab (lessons 2.3 polar coordinates and 2.4 cylindrical and spherical coordinates): four views.
 * Maths from src/math/coords.ts (the conventions, with the spherical angle θ measured FROM THE POSITIVE z-AXIS and the
 * azimuth φ in the xy-plane, are stated there). Angles in the state are radians; sliders and steppers show degrees,
 * and the readout adds the multiple of π when the angle is one (π/6, π/4, 3π/4 …). Colour code (never alone): r =
 * accent, θ = cool (--delta), z and φ = green (--limit), the arctan ghost = warm (--eps), hollow marks for
 * "wrong/outside", filled for "right/inside".
 *
 * mode 'polar' (2.3, objective 1): a polar grid over the Cartesian axes, the point P (drag it: it snaps to the 0.25
 * grid; or the r and θ sliders; or the arrow keys). Drawn: the radius r, the arc θ from the positive x-axis, the dashed
 * legs x = r cos θ and y = r sin θ, the quadrant numerals (the one holding P in ink). The readout goes both ways,
 * (r, θ) → (x, y) and (x, y) → r = √(x² + y²), and shows THE ARCTAN TRAP: arctan(y/x) next to the true θ. With the
 * toggle "arctan(y/x)" (default on) a warm dashed ray and a HOLLOW ring show where arctan(y/x) points; it differs from
 * P in quadrants II and III (by 180°) and in quadrant IV (by 360°, shown only as a negative angle), and on the y-axis
 * it does not exist. With the toggle "θ מעבר ל-360°" θ may run over −360°…720°: (r, θ + 360°) is the same point.
 * mode 'curve' (2.3, objective 2): a polar curve r = f(θ) from a preset (buttons; `curves` chooses which). The θ
 * slider traces the curve from the start of its range to the current θ (radius drawn); the rest is hidden, or, with
 * the toggle "כל העקום", faint and dashed. For the ray θ = π/4 the slider moves r instead. The readout gives θ, r(θ),
 * (x, y) and the Cartesian equation when it is simple. NEGATIVE r: the course keeps r ≥ 0, so every preset is
 * drawn only on a θ range where f ≥ 0 (r = 2cos θ on −90°…90°, r = 2sin θ on 0°…180°, one petal of r = 2cos 2θ on
 * −45°…45°, r = 1/cos θ on −60°…60°, r = 2/sin θ on 45°…135°, the spiral r = θ/4 on 0°…720°); the figure never plots
 * a point by reflection through the origin.
 * mode 'region' (2.3, objective 3): the region a ≤ r ≤ b, α ≤ θ ≤ β shaded; steppers for a (0…2), b (0.5…2.5) in steps of 0.5 and α, β (step
 * 15°, α ≥ 0, β ≤ 360°); its boundary pieces labelled (r = a, r = b, θ = α, θ = β); a draggable test point Q (snaps to
 * the 0.25 grid) that is FILLED (green) when it satisfies the inequalities and HOLLOW (red) when it does not; the readout
 * says which of the two conditions (on r, on θ) holds.
 * mode 'space' (2.4): one point of space in an axonometric view (src/sims/core/axo.ts): drag the background (or the
 * arrow keys, or the two sliders) to turn the view. System 'cylindrical' (r, θ, z): the drop line, r in the floor, θ in
 * the floor from the x-axis, the height z. System 'spherical' (r, θ, φ): the radius r, θ as an arc from the positive
 * z-axis, φ as an arc in the floor, the footprint with its length r sin θ. The two systems are buttons (when `systems`
 * allows both); switching converts the same point. Toggles show the COORDINATE SURFACES through the point (cylindrical:
 * r = c cylinder, θ = c half-plane, z = c plane; spherical: r = c sphere, θ = c cone, flat at θ = 90°, φ = c
 * half-plane) as light wireframes, and the notes' LATITUDE (π/2 − θ, an arc from the floor, dashed warm) with its
 * Hebrew name. `solid` draws a wireframe ball (x² + y² + z² ≤ 4), cylinder (x² + y² ≤ 4, 0 ≤ z ≤ 3) or cone
 * (√(x² + y²) ≤ z ≤ 2) with its inequalities in the readout, and P is a filled green dot inside and a hollow red one
 * outside. The readout gives the conversion formulas with the current numbers, both directions.
 *
 * Props (defaults): id (required); mode ('polar'); controls (true: false hides sliders, steppers and toggles, so only a
 * step or a drag moves the figure); tasks ([]).
 *   polar:  r (2), thetaDeg (60), arctan (true), wrap (false)
 *   curve:  curve ('circle'), curves (all presets: 'circle' | 'ray' | 'cos' | 'sin' | 'cardioid' | 'spiral' | 'petal' |
 *           'vline' | 'hline'), thetaDeg (a quarter of the way along the curve's range; the angle of the traced end), r
 *           (the traced length of the ray, 1.5), showAll (false)
 *   region: a (1), b (2), alphaDeg (0), betaDeg (90), qx (1.25), qy (0.75)
 *   space:  system ('cylindrical'), systems (both), r (2), thetaDeg (60), phiDeg (40), z (1) [z only for cylindrical; for
 *           spherical thetaDeg is the angle from the z-axis and phiDeg the azimuth; for cylindrical thetaDeg is the
 *           azimuth and phiDeg is unused], surfaces (list of 'r' | 'theta' | 'third', default none; 'third' is z (cylindrical)
 *           or φ (spherical)), latitude (false), solid ('none' | 'ball' | 'cylinder' | 'cone'), az (30), el (24)
 * Step `set` keys (a text step sets state through the step bus and never ticks a task):
 *   polar:  r, thetaDeg, x and y (both: the point (x, y)), arctan, wrap
 *   curve:  curve, thetaDeg (the traced end), r (the ray's length), showAll
 *   region: a, b, alphaDeg, betaDeg, qx, qy
 *   space:  system (applied first, converting the point), r, thetaDeg, phiDeg, z (to the current system), surfR, surfTheta,
 *           surfThird, latitude, solid, az, el
 * Tasks (ticked only by the reader's own change of a quantity the task depends on since the last step or reset, and a
 * state that already had the property when the step or reset made it must be left and found again):
 *   polar:  polar-quadrant-2    P at (−1, 1) (±0.04 each): read θ = 135° against arctan(y/x) = −45°
 *           polar-same-arctan   P in quadrant III with arctan(y/x) within 2° of 45° (like (1, 1)): its θ is 225°
 *           polar-axis          P on the negative y-axis (|x| < 0.04, y < −0.3): arctan(y/x) does not exist
 *           polar-wrap          the toggle on and θ at least 365°: the point is where θ − 360° puts it
 *   curve:  curve-cos-closes    r = 2cos θ traced to 90° (±1.5°): the circle is closed, back at the origin
 *           curve-cardioid-origin   r = 1 + cos θ traced to 180° (±1.5°): r = 0, the cusp at the origin
 *           curve-cardioid-left     r = 1 + cos θ traced to 120° or 240° (±2°): the smallest x, −1/4, not at the origin
 *           curve-sin-circle    r = 2sin θ traced to 180° (±1.5°): the circle x² + (y − 1)² = 1
 *   region: region-quarter-ring a = 1, b = 2, α = 90°, β = 180° (the quarter-ring in quadrant II)
 *           region-disc         a = 0, b = 2, full turn (α = 0°, β = 360°)
 *           region-sector       a = 0, b ≥ 1, α = 270°, β = 360° (a quarter-disc in quadrant IV)
 *           region-r-only       Q with a ≤ r ≤ b but outside the angle range (r > 0.25)
 *   space:  space-neg-z         spherical, θ within 2° of 180°, r ≥ 0.3: P on the negative z-axis
 *           space-cone-sweep    spherical, the θ-surface toggle on, 5° < θ < 175°, and φ turned through ≥ 340° with θ untouched
 *           space-two-r         spherical, r = 2 (±0.03) and θ = 30° (±0.5°): the distance from the z-axis is 1
 *           space-latitude      spherical, the latitude toggle on and θ = 60° (±0.5°): the latitude is 30°
 *           space-cyl-axis      cylindrical, r < 0.03: P on the z-axis, θ undefined
 */

import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  CURVE_KEYS,
  POLAR_CURVES,
  SOLIDS,
  angleInRange,
  arctanNaive,
  curvePoint,
  cylSurfaceR,
  cylSurfaceTheta,
  cylSurfaceZ,
  fromCylindrical,
  fromPolar,
  fromSpherical,
  inRegion,
  inSolid,
  isAngleDefinedCyl,
  isAngleDefinedSph,
  latitudeOf,
  niceAngle,
  quadrantOf,
  regionKind,
  sphSurfacePhi,
  sphSurfaceR,
  sphSurfaceTheta,
  toCylindrical,
  toPolar,
  toSpherical,
  wrap2pi,
  type CurveKey,
  type SolidKey,
  type SurfaceKind,
  type Vec2,
  type Vec3,
} from '~/math/coords';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { camera, makeProjector } from './core/axo';
import { toScreen, toWorld, useFigureCanvas, type FrameInfo, type Palette, type View } from './core/canvas';
import { arrow, withAlpha } from './core/ink';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import './CoordinateLab.css';

export type CoordMode = 'polar' | 'curve' | 'region' | 'space';
export type CoordSystem = 'cylindrical' | 'spherical';
type SurfaceName = 'r' | 'theta' | 'third';

const DEG = Math.PI / 180;
const TAU = 2 * Math.PI;
const WORLD_W = 7.2;
const WORLD_H = 5.6;
/** the reset and fullscreen buttons cover this corner of the stage (CSS px from the top-right) */
const BUTTONS_W = 96;
const BUTTONS_H = 52;
const R_MAX = 2.75;
const GRID = 0.25;
const HIT = 30;
const AXL = 3.4;
const SPACE_LIM = 3;
const SPACE_R = 3.6;

interface State {
  // polar
  r: number;
  th: number;
  arctan: boolean;
  wrap: boolean;
  // curve
  curve: CurveKey;
  ct: number;
  showAll: boolean;
  // region (angles in degrees)
  ra: number;
  rb: number;
  al: number;
  be: number;
  qx: number;
  qy: number;
  // space
  system: CoordSystem;
  cr: number;
  cth: number;
  cz: number;
  sr: number;
  sth: number;
  sphi: number;
  sfR: boolean;
  sfTheta: boolean;
  sfThird: boolean;
  lat: boolean;
  solid: SolidKey | 'none';
  az: number;
  el: number;
}

export interface CoordinateLabProps {
  id: string;
  mode?: CoordMode;
  controls?: boolean;
  tasks?: string[];
  // polar
  r?: number;
  thetaDeg?: number;
  arctan?: boolean;
  wrap?: boolean;
  // curve
  curve?: CurveKey;
  curves?: CurveKey[];
  showAll?: boolean;
  // region
  a?: number;
  b?: number;
  alphaDeg?: number;
  betaDeg?: number;
  qx?: number;
  qy?: number;
  // space
  system?: CoordSystem;
  systems?: CoordSystem[];
  phiDeg?: number;
  z?: number;
  surfaces?: SurfaceName[];
  latitude?: boolean;
  solid?: SolidKey | 'none';
  az?: number;
  el?: number;
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const snapTo = (v: number, g: number) => Math.round(v / g) * g;
const wrapAz = (a: number) => ((a % 360) + 360) % 360;

/** default traced end of a curve: a quarter of the way along its range (the ray: its length) */
const defaultTrace = (k: CurveKey, r = 1.5): number => {
  const c = POLAR_CURVES[k];
  return c.ray ? r : c.range[0] + 0.25 * (c.range[1] - c.range[0]);
};

function initial(p: CoordinateLabProps): State {
  const curve = p.curve ?? 'circle';
  const cdef = POLAR_CURVES[curve];
  const sys = p.system ?? 'cylindrical';
  const sphLike = sys === 'spherical';
  return {
    r: p.r ?? 2,
    th: (p.thetaDeg ?? 60) * DEG,
    arctan: p.arctan ?? true,
    wrap: p.wrap ?? false,
    curve,
    ct: cdef.ray ? (p.r ?? 1.5) : typeof p.thetaDeg === 'number' ? p.thetaDeg * DEG : defaultTrace(curve),
    showAll: p.showAll ?? false,
    ra: p.a ?? 1,
    rb: p.b ?? 2,
    al: p.alphaDeg ?? 0,
    be: p.betaDeg ?? 90,
    qx: p.qx ?? 1.25,
    qy: p.qy ?? 0.75,
    system: sys,
    cr: sphLike ? 1.5 : (p.r ?? 2),
    cth: sphLike ? 40 * DEG : (p.thetaDeg ?? 60) * DEG,
    cz: p.z ?? 1,
    sr: sphLike ? (p.r ?? 2) : 2,
    sth: sphLike ? (p.thetaDeg ?? 60) * DEG : 60 * DEG,
    sphi: (p.phiDeg ?? 40) * DEG,
    sfR: p.surfaces?.includes('r') ?? false,
    sfTheta: p.surfaces?.includes('theta') ?? false,
    sfThird: p.surfaces?.includes('third') ?? false,
    lat: p.latitude ?? false,
    solid: p.solid ?? 'none',
    az: typeof p.az === 'number' ? wrapAz(p.az) : 30,
    el: typeof p.el === 'number' ? clamp(p.el, 0, 85) : 24,
  };
}

/** switching system converts the same point of space */
function convertSystem(s: State, to: CoordSystem): Partial<State> {
  if (to === s.system) return {};
  if (to === 'spherical') {
    const q = toSpherical(fromCylindrical(s.cr, s.cth, s.cz));
    return { system: to, sr: q.r, sth: q.theta, sphi: q.phi };
  }
  const c = toCylindrical(fromSpherical(s.sr, s.sth, s.sphi));
  return { system: to, cr: c.r, cth: c.theta, cz: c.z };
}

/* ------------------------------------------------------------------ text */

/** a left-to-right island inside Hebrew text (U+2066 … U+2069), with no-break spaces so it never wraps */
const ltr = (s: string) => `⁦${s.replace(/ /g, '\u00A0')}⁩`;

const TASK_LABEL: Record<string, string> = {
  // neutral on purpose: this label is on screen before the reader answers pred-2-3, which asks about this very point
  'polar-quadrant-2': `הציבו את P בנקודה ${ltr('(−1, 1)')}. באיזה רביע היא, ומה הזווית θ שלה?`,
  'polar-same-arctan': `הציבו את P ברביע השלישי כך ש-${ltr('arctan(y/x)')} יהיה ${ltr('45°')}, כמו ב-${ltr('(1, 1)')}. מה הזווית θ האמיתית שלו?`,
  'polar-axis': `הציבו את P על ציר ${ltr('y')} השלילי. מה קורה ל-${ltr('arctan(y/x)')}, ומה הזווית θ?`,
  'polar-wrap': `הפעילו את "θ מעבר ל-360°" והגדילו את θ מעל ${ltr('360°')}. האם הנקודה זזה?`,
  'curve-cos-closes': `עקבו אחרי ${ltr('r = 2cos θ')}: באיזו זווית θ העקום חוזר לראשית ונסגר?`,
  'curve-cardioid-origin': `בקרדיואידה ${ltr('r = 1 + cos θ')} מצאו את הזווית שבה העקום עובר בראשית (${ltr('r = 0')}).`,
  'curve-cardioid-left': `בקרדיואידה מצאו את הנקודה השמאלית ביותר, ה-${ltr('x')} הכי שלילי. באיזו זווית היא, והאם שם ${ltr('r')} הוא הגדול ביותר?`,
  'curve-sin-circle': `עקבו אחרי ${ltr('r = 2sin θ')} עד ${ltr('θ = 180°')}. איזה עקום קיבלתם, ומה משוואתו הקרטזית?`,
  'region-quarter-ring': `סמנו את הטבעת החלקית ${ltr('1 ≤ r ≤ 2')} ברביע השני בלבד.`,
  'region-disc': `הציבו עיגול מלא ברדיוס 2: ${ltr('0 ≤ r ≤ 2')} וסיבוב שלם.`,
  'region-sector': `הציבו רבע עיגול ברביע הרביעי (גזרה שמתחילה בראשית, ברדיוס ${ltr('1')} לפחות).`,
  'region-r-only': `הזיזו את ${ltr('Q')} לנקודה שמקיימת את התנאי על ${ltr('r')} אבל לא את התנאי על ${ltr('θ')}.`,
  'space-neg-z': `בקואורדינטות כדוריות הציבו את הנקודה על ציר ${ltr('z')} השלילי. מה ${ltr('θ')} שלה?`,
  'space-cone-sweep': `בקואורדינטות כדוריות הדליקו את משטח ${ltr('θ')}, ושמרו על ${ltr('θ')} קבוע בזמן שמסובבים את ${ltr('φ')} סיבוב שלם. איזה משטח הנקודה צירה?`,
  'space-two-r': `בקואורדינטות כדוריות הציבו ${ltr('r = 2')} ו-${ltr('θ = 30°')}. מה המרחק של הנקודה מציר ${ltr('z')}?`,
  'space-latitude': `הדליקו את זווית הרוחב של הסיכומים והציבו ${ltr('θ = 60°')} בכדוריות. מה זווית הרוחב?`,
  'space-cyl-axis': `בקואורדינטות גליליות הציבו את הנקודה על ציר ${ltr('z')} (${ltr('r = 0')}). מה קורה לזווית ${ltr('θ')}?`,
};

/** the state fields a task depends on: the reader must have changed one of them since the last step or reset */
const TASK_KEYS: Record<string, (keyof State)[]> = {
  'polar-quadrant-2': ['r', 'th'],
  'polar-same-arctan': ['r', 'th'],
  'polar-axis': ['r', 'th'],
  'polar-wrap': ['th', 'wrap'],
  'curve-cos-closes': ['curve', 'ct'],
  'curve-cardioid-origin': ['curve', 'ct'],
  'curve-cardioid-left': ['curve', 'ct'],
  'curve-sin-circle': ['curve', 'ct'],
  'region-quarter-ring': ['ra', 'rb', 'al', 'be'],
  'region-disc': ['ra', 'rb', 'al', 'be'],
  'region-sector': ['ra', 'rb', 'al', 'be'],
  'region-r-only': ['qx', 'qy', 'ra', 'rb', 'al', 'be'],
  'space-neg-z': ['system', 'sr', 'sth'],
  'space-cone-sweep': ['sth', 'sphi', 'sfTheta', 'system'],
  'space-two-r': ['system', 'sr', 'sth'],
  'space-latitude': ['lat', 'sth', 'system'],
  'space-cyl-axis': ['system', 'cr'],
};

interface TaskCtx {
  /** the span of φ (radians) the reader swept with θ untouched */
  sweep: number;
}

function taskHolds(task: string, s: State, cx: TaskCtx): boolean {
  switch (task) {
    case 'polar-quadrant-2': {
      const [x, y] = fromPolar(s.r, s.th);
      return Math.abs(x + 1) < 0.04 && Math.abs(y - 1) < 0.04;
    }
    case 'polar-same-arctan': {
      const [x, y] = fromPolar(s.r, s.th);
      return x < -0.04 && y < -0.04 && s.r >= 0.3 && Math.abs(Math.atan(y / x) - 45 * DEG) <= 2 * DEG;
    }
    case 'polar-axis': {
      const [x, y] = fromPolar(s.r, s.th);
      return Math.abs(x) < 0.04 && y < -0.3;
    }
    case 'polar-wrap':
      return s.wrap && s.th >= 365 * DEG;
    case 'curve-cos-closes':
      return s.curve === 'cos' && Math.abs(s.ct - 90 * DEG) <= 1.5 * DEG;
    case 'curve-cardioid-origin':
      return s.curve === 'cardioid' && Math.abs(s.ct - 180 * DEG) <= 1.5 * DEG;
    case 'curve-cardioid-left':
      return s.curve === 'cardioid' && (Math.abs(s.ct - 120 * DEG) <= 2 * DEG || Math.abs(s.ct - 240 * DEG) <= 2 * DEG);
    case 'curve-sin-circle':
      return s.curve === 'sin' && s.ct >= 180 * DEG - 1.5 * DEG;
    case 'region-quarter-ring':
      return s.ra === 1 && s.rb === 2 && s.al === 90 && s.be === 180;
    case 'region-disc':
      return s.ra === 0 && s.rb === 2 && s.be - s.al >= 360;
    case 'region-sector':
      return s.ra === 0 && s.rb >= 1 && s.al === 270 && s.be === 360;
    case 'region-r-only': {
      const r = Math.hypot(s.qx, s.qy);
      return r > 0.25 && r >= s.ra - 1e-9 && r <= s.rb + 1e-9 && !angleInRange(Math.atan2(s.qy, s.qx), s.al * DEG, s.be * DEG);
    }
    case 'space-neg-z':
      return s.system === 'spherical' && Math.abs(s.sth - Math.PI) <= 2 * DEG && s.sr >= 0.3;
    case 'space-cone-sweep':
      return s.system === 'spherical' && s.sfTheta && s.sth > 5 * DEG && s.sth < 175 * DEG && cx.sweep >= 340 * DEG;
    case 'space-two-r':
      return s.system === 'spherical' && Math.abs(s.sr - 2) <= 0.03 && Math.abs(s.sth - 30 * DEG) <= 0.5 * DEG;
    case 'space-latitude':
      return s.system === 'spherical' && s.lat && Math.abs(s.sth - 60 * DEG) <= 0.5 * DEG;
    case 'space-cyl-axis':
      return s.system === 'cylindrical' && s.cr < 0.03;
    default:
      return false;
  }
}

/** a state that already had the property at the step or reset must be left and found again */
function taskDone(task: string, s: State, cx: TaskCtx, touched: Set<keyof State>, base: State, baseCx: TaskCtx): boolean {
  const keys = TASK_KEYS[task];
  if (!keys || !keys.some((k) => touched.has(k))) return false;
  if (!taskHolds(task, s, cx)) return false;
  if (taskHolds(task, base, baseCx) && keys.every((k) => s[k] === base[k])) return false;
  return true;
}

/** a number to `d` decimals with trailing zeros trimmed and U+2212 for the minus sign */
function num(v: number, d = 2): string {
  const x = Math.abs(v) < 0.5 * 10 ** -d ? 0 : v;
  let t = x.toFixed(d);
  if (t.includes('.')) t = t.replace(/0+$/, '').replace(/\.$/, '');
  return t.replace('-', '−');
}
/** an angle for the readout: "135° = 3π/4" */
function ang(rad: number): string {
  const d = (rad * 180) / Math.PI;
  const dd = Math.abs(d - Math.round(d)) < 0.05 ? String(Math.round(d)) : num(d, 1);
  const nice = niceAngle(rad);
  return `${dd.replace('-', '−')}°${nice && nice !== '0' ? ` = ${nice}` : ''}`;
}
const degTxt = (rad: number) => `${num((rad * 180) / Math.PI, 1)}°`;
/** an angle in a range: the multiple of π when it is one, else degrees */
const angShort = (rad: number) => niceAngle(rad) ?? degTxt(rad);
const QUAD_HE = ['ראשון', 'שני', 'שלישי', 'רביעי'];
const AXIS_HE: Record<string, string> = { '+x': 'ציר x החיובי', '-x': 'ציר x השלילי', '+y': 'ציר y החיובי', '-y': 'ציר y השלילי' };

const SURFACE_HE: Record<SurfaceKind, string> = {
  cylinder: 'גליל סביב ציר z',
  'half-plane': 'חצי מישור שמכיל את ציר z',
  plane: 'מישור מקביל למישור xy',
  sphere: 'ספירה שמרכזה בראשית',
  cone: 'חרוט סביב ציר z',
  axis: 'ציר z (או חצי ממנו)',
  'xy-plane': 'מישור xy',
  point: 'הראשית',
};

const CURVE_HE: Record<CurveKey, string> = {
  circle: 'מעגל סביב הראשית',
  ray: 'קרן מהראשית',
  cos: 'מעגל דרך הראשית',
  sin: 'מעגל דרך הראשית',
  cardioid: 'קרדיואידה',
  spiral: 'ספירלה',
  petal: 'עלה של שושנה',
  vline: 'ישר אנכי',
  hline: 'ישר אופקי',
};

const SOLID_HE: Record<SolidKey, string> = { ball: 'כדור', cylinder: 'גליל', cone: 'חרוט' };

/** a readout row: a Hebrew label and a value that is left-to-right math, or (plain) a Hebrew sentence */
function Row(p: { id: string; label?: string; strong?: boolean; plain?: boolean; children: ComponentChildren }) {
  return (
    <div class={`cl-row${p.strong ? ' strong' : ''}`} data-readout={p.id}>
      {p.label && <span class="cl-lab">{p.label}</span>}
      {p.plain ? <span class="cl-val">{p.children}</span> : <span class="q cl-math">{p.children}</span>}
    </div>
  );
}

function Note(p: { id: string; children: ComponentChildren }) {
  return (
    <div class="cl-row" data-readout={p.id}>
      <span class="cl-note">{p.children}</span>
    </div>
  );
}

function Stepper(p: { name: string; label: string; text: string; canDec: boolean; canInc: boolean; onDec: () => void; onInc: () => void }) {
  return (
    <span class="cl-stepper" data-stepper={p.name} role="group" aria-label={p.label}>
      <span class="cl-stepper-name q">{p.label}</span>
      <button type="button" data-step="dec" aria-label={`הקטנת ${p.label}`} disabled={!p.canDec} onClick={p.onDec}>
        −
      </button>
      <output class="q" data-value aria-label={p.label}>
        {p.text}
      </output>
      <button type="button" data-step="inc" aria-label={`הגדלת ${p.label}`} disabled={!p.canInc} onClick={p.onInc}>
        +
      </button>
    </span>
  );
}

/* ------------------------------------------------------------------ the component */

export default function CoordinateLab(props: CoordinateLabProps) {
  const mode: CoordMode = props.mode ?? 'polar';
  const showControls = props.controls !== false;
  const [s, setS] = useState<State>(() => initial(props));
  const cur = useRef(s);
  cur.current = s;
  const [live, setLive] = useState('');
  const touched = useRef<Set<keyof State>>(new Set());
  const base = useRef<State>(s);
  const sweep = useRef({ anchor: NaN, lo: 0, hi: 0 });
  const baseSweep = useRef(0);
  const drag = useRef<{ kind: 'point' | 'view'; x: number; y: number } | null>(null);
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));
  const systems = props.systems ?? ['cylindrical', 'spherical'];
  const curves = props.curves && props.curves.length > 0 ? props.curves : CURVE_KEYS;

  const apply = (patch: Partial<State>): State => {
    const next = { ...cur.current, ...patch };
    cur.current = next;
    setS(next);
    return next;
  };

  /** the reader's own change: the only place a task can tick */
  const userSet = (patch: Partial<State>) => {
    for (const k of Object.keys(patch) as (keyof State)[]) if (patch[k] !== cur.current[k]) touched.current.add(k);
    // φ swept with θ untouched (space-cone-sweep)
    const sw = sweep.current;
    if ('sth' in patch && (!Number.isFinite(sw.anchor) || Math.abs((patch.sth as number) - sw.anchor) > 0.5 * DEG)) {
      sw.anchor = patch.sth as number;
      sw.lo = cur.current.sphi;
      sw.hi = cur.current.sphi;
    }
    const next = apply(patch);
    if ('sphi' in patch) {
      if (!Number.isFinite(sw.anchor)) {
        sw.anchor = next.sth;
        sw.lo = sw.hi = next.sphi;
      }
      sw.lo = Math.min(sw.lo, next.sphi);
      sw.hi = Math.max(sw.hi, next.sphi);
    }
    const cx: TaskCtx = { sweep: Number.isFinite(sw.anchor) && Math.abs(next.sth - sw.anchor) <= 0.5 * DEG ? sw.hi - sw.lo : 0 };
    for (const task of props.tasks ?? []) {
      if (taskDone(task, next, cx, touched.current, base.current, { sweep: baseSweep.current })) markTask(`${props.id}:${task}`);
    }
  };

  const rebase = (next: State) => {
    touched.current = new Set();
    sweep.current = { anchor: NaN, lo: 0, hi: 0 };
    baseSweep.current = 0;
    base.current = next;
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        const patch: Partial<State> = {};
        const nm = (k: string) => (typeof st[k] === 'number' ? (st[k] as number) : undefined);
        const bl = (k: string) => (typeof st[k] === 'boolean' ? (st[k] as boolean) : undefined);
        let c = cur.current;
        if (mode === 'polar') {
          const x = nm('x');
          const y = nm('y');
          if (x !== undefined && y !== undefined) {
            const q = toPolar([x, y]);
            patch.r = q.r;
            if (q.r > 0) patch.th = q.theta;
          }
          if (nm('r') !== undefined) patch.r = nm('r');
          if (nm('thetaDeg') !== undefined) patch.th = (nm('thetaDeg') as number) * DEG;
          if (bl('arctan') !== undefined) patch.arctan = bl('arctan');
          if (bl('wrap') !== undefined) patch.wrap = bl('wrap');
        } else if (mode === 'curve') {
          const key = typeof st.curve === 'string' && (CURVE_KEYS as string[]).includes(st.curve) ? (st.curve as CurveKey) : c.curve;
          if (key !== c.curve) {
            patch.curve = key;
            patch.ct = defaultTrace(key);
          }
          if (POLAR_CURVES[key].ray) {
            if (nm('r') !== undefined) patch.ct = nm('r');
          } else if (nm('thetaDeg') !== undefined) patch.ct = (nm('thetaDeg') as number) * DEG;
          if (bl('showAll') !== undefined) patch.showAll = bl('showAll');
        } else if (mode === 'region') {
          if (nm('a') !== undefined) patch.ra = nm('a');
          if (nm('b') !== undefined) patch.rb = nm('b');
          if (nm('alphaDeg') !== undefined) patch.al = nm('alphaDeg');
          if (nm('betaDeg') !== undefined) patch.be = nm('betaDeg');
          if (nm('qx') !== undefined) patch.qx = nm('qx');
          if (nm('qy') !== undefined) patch.qy = nm('qy');
        } else {
          if (st.system === 'cylindrical' || st.system === 'spherical') {
            Object.assign(patch, convertSystem(c, st.system));
            c = { ...c, ...patch };
          }
          if (c.system === 'cylindrical') {
            if (nm('r') !== undefined) patch.cr = nm('r');
            if (nm('thetaDeg') !== undefined) patch.cth = (nm('thetaDeg') as number) * DEG;
            if (nm('z') !== undefined) patch.cz = nm('z');
          } else {
            if (nm('r') !== undefined) patch.sr = nm('r');
            if (nm('thetaDeg') !== undefined) patch.sth = (nm('thetaDeg') as number) * DEG;
            if (nm('phiDeg') !== undefined) patch.sphi = (nm('phiDeg') as number) * DEG;
          }
          if (bl('surfR') !== undefined) patch.sfR = bl('surfR');
          if (bl('surfTheta') !== undefined) patch.sfTheta = bl('surfTheta');
          if (bl('surfThird') !== undefined) patch.sfThird = bl('surfThird');
          if (bl('latitude') !== undefined) patch.lat = bl('latitude');
          if (st.solid === 'none' || st.solid === 'ball' || st.solid === 'cylinder' || st.solid === 'cone') patch.solid = st.solid;
        }
        if (nm('az') !== undefined) patch.az = wrapAz(nm('az') as number);
        if (nm('el') !== undefined) patch.el = clamp(nm('el') as number, 0, 85);
        // a state a text step produced never ticks a task: forget the reader's moves and re-base
        rebase(apply(patch));
      }),
    [props.id],
  );

  const reset = () => {
    const f = initial(props);
    cur.current = f;
    setS(f);
    rebase(f);
    setLive('האיור אופס.');
  };

  /* ---------- the canvas ---------- */
  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    if (mode === 'space') drawSpace(ctx, view, p, s);
    else if (mode === 'polar') drawPolar(ctx, view, p, s);
    else if (mode === 'curve') drawCurve(ctx, view, p, s);
    else drawRegion(ctx, view, p, s);
  };
  const { canvasRef, invalidate, viewRef } = useFigureCanvas(draw, {
    worldWidth: mode === 'space' ? 1 : WORLD_W,
    worldHeight: mode === 'space' ? 1 : WORLD_H,
    animate: false,
  });
  useEffect(invalidate, [s]);

  /* ---------- pointer and keyboard ---------- */
  const polarPoint = (st: State): Vec2 => fromPolar(st.r, st.th);
  const worldOf = (e: PointerEvent): Vec2 | null => {
    const v = viewRef.current;
    return v ? toWorld(v, e.offsetX, e.offsetY) : null;
  };
  /** the reader puts the polar point at the Cartesian point w (snapped to the grid) */
  const movePolar = (w: Vec2) => {
    let x = clamp(snapTo(w[0], GRID), -3.25, 3.25);
    let y = clamp(snapTo(w[1], GRID), -2.5, 2.5);
    const r0 = Math.hypot(x, y);
    if (r0 > R_MAX) {
      x = (x * R_MAX) / r0;
      y = (y * R_MAX) / r0;
    }
    const q = toPolar([x, y]);
    let th = q.r === 0 ? cur.current.th : q.theta;
    if (cur.current.wrap) th += TAU * Math.round((cur.current.th - th) / TAU);
    userSet({ r: q.r, th });
  };
  const moveQ = (w: Vec2) => userSet({ qx: clamp(snapTo(w[0], GRID), -3.25, 3.25), qy: clamp(snapTo(w[1], GRID), -2.5, 2.5) });

  const onPointerDown = (e: PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    if (mode === 'space') {
      drag.current = { kind: 'view', x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
      return;
    }
    const v = viewRef.current;
    const w = worldOf(e);
    if (!v || !w) return;
    const P = mode === 'polar' ? polarPoint(cur.current) : mode === 'region' ? ([cur.current.qx, cur.current.qy] as Vec2) : null;
    if (!P || Math.hypot(P[0] - w[0], P[1] - w[1]) * v.ppm > HIT) return;
    drag.current = { kind: 'point', x: e.clientX, y: e.clientY };
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === 'view') {
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      drag.current = { kind: 'view', x: e.clientX, y: e.clientY };
      apply({ az: wrapAz(cur.current.az - dx * 0.5), el: clamp(cur.current.el + dy * 0.4, 0, 85) });
      return;
    }
    const w = worldOf(e);
    if (!w) return;
    if (mode === 'polar') movePolar(w);
    else if (mode === 'region') moveQ(w);
  };
  const onPointerUp = () => {
    if (drag.current?.kind === 'point') setLive(describe());
    drag.current = null;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const big = e.shiftKey;
    const c = cur.current;
    if (mode === 'space') {
      const k = big ? 15 : 5;
      if (e.key === 'ArrowLeft') apply({ az: wrapAz(c.az - k) });
      else if (e.key === 'ArrowRight') apply({ az: wrapAz(c.az + k) });
      else if (e.key === 'ArrowUp') apply({ el: clamp(c.el + k, 0, 85) });
      else if (e.key === 'ArrowDown') apply({ el: clamp(c.el - k, 0, 85) });
      else return;
      e.preventDefault();
      return;
    }
    if (mode === 'polar') {
      const dth = (big ? 15 : 5) * DEG;
      if (e.key === 'ArrowLeft') userSet({ th: c.wrap ? c.th + dth : wrap2pi(c.th + dth) });
      else if (e.key === 'ArrowRight') userSet({ th: c.wrap ? c.th - dth : wrap2pi(c.th - dth) });
      else if (e.key === 'ArrowUp') userSet({ r: clamp(snapTo(c.r + 0.25, GRID), 0, R_MAX) });
      else if (e.key === 'ArrowDown') userSet({ r: clamp(snapTo(c.r - 0.25, GRID), 0, R_MAX) });
      else return;
    } else if (mode === 'curve') {
      const def = POLAR_CURVES[c.curve];
      const [lo, hi] = def.range;
      const step = def.ray ? 0.1 : (big ? 15 : 5) * DEG;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') userSet({ ct: clamp(c.ct - step, lo, hi) });
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') userSet({ ct: clamp(c.ct + step, lo, hi) });
      else return;
    } else {
      const d: Record<string, Vec2> = { ArrowLeft: [-GRID, 0], ArrowRight: [GRID, 0], ArrowUp: [0, GRID], ArrowDown: [0, -GRID] };
      const m = d[e.key];
      if (!m) return;
      moveQ([c.qx + m[0], c.qy + m[1]]);
    }
    e.preventDefault();
    setLive(describe());
  };

  /* ---------- derived ---------- */
  const [px, py] = fromPolar(s.r, s.th);
  const cdef = POLAR_CURVES[s.curve];
  const cpt = curvePoint(s.curve, s.ct);
  const reg = { a: s.ra, b: s.rb, alpha: s.al * DEG, beta: s.be * DEG };
  const Pcyl = fromCylindrical(s.cr, s.cth, s.cz);
  const Psph = fromSpherical(s.sr, s.sth, s.sphi);
  const P3 = s.system === 'cylindrical' ? Pcyl : Psph;

  function describe(): string {
    if (mode === 'polar') return `P ב-r = ${num(s.r)}, θ = ${degTxt(s.th)}, כלומר x = ${num(px)}, y = ${num(py)}.`;
    if (mode === 'curve') return `העקום ${cdef.equation}, מסומן עד θ = ${degTxt(cpt.theta)}: r = ${num(cpt.r)}, x = ${num(cpt.x)}, y = ${num(cpt.y)}.`;
    if (mode === 'region') {
      const inside = inRegion(s.qx, s.qy, reg);
      return `התחום ${s.ra} ≤ r ≤ ${s.rb}, ${s.al}° ≤ θ ≤ ${s.be}°. נקודת הבדיקה Q ב-(${num(s.qx)}, ${num(s.qy)}) ${inside ? 'בתוך התחום' : 'מחוץ לתחום'}.`;
    }
    return s.system === 'cylindrical'
      ? `קואורדינטות גליליות: r = ${num(s.cr)}, θ = ${degTxt(s.cth)}, z = ${num(s.cz)}.`
      : `קואורדינטות כדוריות: r = ${num(s.sr)}, θ = ${degTxt(s.sth)} מציר z, φ = ${degTxt(s.sphi)}.`;
  }

  const label =
    mode === 'polar'
      ? 'איור חי: רשת קוטבית על הצירים x ו-y, ונקודה P עם r, θ והרגליים x ו-y. גררו את P או הזיזו אותו בחצים. '
      : mode === 'curve'
        ? 'איור חי: עקום קוטבי r = f(θ) שנמתח עד הזווית θ שבוחרים. חצים משנים את θ. '
        : mode === 'region'
          ? 'איור חי: תחום קוטבי שמוגדר ב-r ובזווית, ונקודת בדיקה Q שגוררים. '
          : 'איור חי: נקודה במרחב בקואורדינטות גליליות או כדוריות, בהטלה אקסונומטרית. גררו את הרקע או הזיזו בחצים כדי לסובב את המבט. ';

  /* ---------- readout ---------- */
  let readout: ComponentChildren = null;
  if (mode === 'polar') {
    const q = quadrantOf(px, py);
    const onYAxis = Math.abs(px) < 1e-9;
    const thTrue = toPolar([px, py]).theta;
    const at = onYAxis ? NaN : arctanNaive(px, py);
    const wrapped = s.th < -1e-9 || s.th >= TAU - 1e-9;
    readout = (
      <div class="cl-readout">
        <Row id="to-xy" label="מקוטבי לקרטזי:">
          {`x = r cos θ = ${num(s.r)}·cos ${degTxt(s.th)} = ${num(px)},   y = r sin θ = ${num(s.r)}·sin ${degTxt(s.th)} = ${num(py)}`}
        </Row>
        <Row id="to-polar" label="מקרטזי לקוטבי:" strong>
          {`r = √(x² + y²) = √((${num(px)})² + (${num(py)})²) = ${num(s.r)}`}
        </Row>
        <Row id="quadrant" label="הרביע:" plain>
          {q.kind === 'quadrant'
            ? `${QUAD_HE[q.n - 1]} ${ltr(`(x ${px > 0 ? '>' : '<'} 0, y ${py > 0 ? '>' : '<'} 0)`)}`
            : q.kind === 'axis'
              ? `על ${AXIS_HE[q.axis]}`
              : 'בראשית'}
        </Row>
        {q.kind === 'origin' ? (
          <Note id="theta">בראשית r = 0 והזווית θ אינה מוגדרת: כל זווית נותנת את אותה נקודה.</Note>
        ) : (
          <>
            {onYAxis ? (
              <Note id="arctan">{`${ltr('x = 0')}, ולכן ${ltr('y/x')} לא מוגדר: ${ltr('arctan(y/x)')} לא קיים.`}</Note>
            ) : (
              <Row id="arctan" label="arctan(y/x):">
                {`arctan(${num(py)}/${px < 0 ? `(${num(px)})` : num(px)}) = ${degTxt(at)}`}
              </Row>
            )}
            <Row id="theta" label="הזווית θ האמיתית:" strong>
              {ang(thTrue)}
            </Row>
            <div class="cl-row" data-readout="trap">
              <span class="cl-note">
                {onYAxis
                  ? `על ציר ${ltr('y')} קובעים את הזווית לפי הציר: ${ltr('90°')} או ${ltr('270°')}.`
                  : px > 0 && py > 0
                    ? `ברביע הראשון ${ltr('arctan(y/x)')} הוא ${ltr('θ')}.`
                    : px > 0
                      ? `ברביע הרביעי ${ltr('arctan(y/x)')} שלילי: ${ltr('θ = arctan(y/x) + 360°')}.`
                      : `כש-${ltr('x < 0')}, ${ltr('arctan(y/x)')} מצביע לצד ההפוך: ${ltr('θ = arctan(y/x) + 180°')}.`}
              </span>
            </div>
          </>
        )}
        {wrapped && (
          <Row id="wrap" label="אותה נקודה:">
            {`θ = ${degTxt(s.th)} = ${degTxt(wrap2pi(s.th))} + ${Math.round((s.th - wrap2pi(s.th)) / TAU)}·360°`}
          </Row>
        )}
      </div>
    );
  }

  if (mode === 'curve') {
    const thTxt = cdef.ray ? '45°' : ang(cpt.theta);
    readout = (
      <div class="cl-readout">
        <Row id="equation" label={CURVE_HE[s.curve] + ':'} strong>
          {cdef.equation}
        </Row>
        {cdef.ray ? (
          <Row id="point" label="הקרן נמתחת עד:">
            {`θ = π/4 = 45° (קבוע),   r = ${num(cpt.r)}`}
          </Row>
        ) : (
          <>
            <Row id="theta" label="הזווית:">
              {`θ = ${thTxt}`}
            </Row>
            <Row id="r" label="המרחק מהראשית:">
              {`r = ${curveSubstitution(s.curve, cpt.theta)} = ${num(cpt.r)}`}
            </Row>
          </>
        )}
        <Row id="xy" label="הנקודה:">
          {`(x, y) = (r cos θ, r sin θ) = (${num(cpt.x)}, ${num(cpt.y)})`}
        </Row>
        {cdef.cartesian ? (
          <Row id="cartesian" label="במשוואה קרטזית:">
            {cdef.cartesian}
          </Row>
        ) : (
          <Note id="cartesian">לעקום הזה אין משוואה קרטזית פשוטה.</Note>
        )}
        <div class="cl-row" data-readout="range">
          <span class="cl-lab">טווח הזוויות שמוצג:</span>
          <span class="q cl-math">{cdef.ray ? 'r ≥ 0' : `${angShort(cdef.range[0])} ≤ θ ≤ ${angShort(cdef.range[1])}`}</span>
          <span class="cl-lab">(r ≥ 0 בכל הטווח)</span>
        </div>
      </div>
    );
  }

  if (mode === 'region') {
    const r = Math.hypot(s.qx, s.qy);
    const inR = r >= s.ra - 1e-9 && r <= s.rb + 1e-9;
    const thetaQ = r === 0 ? 0 : wrap2pi(Math.atan2(s.qy, s.qx));
    const inTh = r === 0 || angleInRange(thetaQ, reg.alpha, reg.beta);
    const full = s.be - s.al >= 360;
    const kind = regionKind(reg);
    const KIND_HE = { empty: 'תחום ריק', disc: 'עיגול', annulus: 'טבעת', sector: 'גזרה', 'annular-sector': 'חלק של טבעת' } as const;
    readout = (
      <div class="cl-readout">
        <Row id="region" label={`${KIND_HE[kind]}:`} strong>
          {`${num(s.ra, 1)} ≤ r ≤ ${num(s.rb, 1)},   ${angShort(reg.alpha)} ≤ θ ≤ ${angShort(reg.beta)}`}
        </Row>
        <Row id="q-point" label="נקודת הבדיקה Q:">
          {`(x, y) = (${num(s.qx)}, ${num(s.qy)}),   r = ${num(r)},   θ = ${ang(thetaQ)}`}
        </Row>
        <Row id="q-r" label="התנאי על r:">
          {`${num(s.ra, 1)} ≤ ${num(r)} ≤ ${num(s.rb, 1)}   ${inR ? '✓ מתקיים' : '✗ לא מתקיים'}`}
        </Row>
        <Row id="q-theta" label="התנאי על θ:">
          {full ? 'סיבוב שלם ✓' : `${angShort(reg.alpha)} ≤ θ ≤ ${angShort(reg.beta)} (מודולו 360°)   ${inTh ? '✓ מתקיים' : '✗ לא מתקיים'}`}
        </Row>
        <Note id="q-verdict">{inR && inTh ? 'Q בתוך התחום (נקודה מלאה).' : 'Q מחוץ לתחום (נקודה חלולה).'}</Note>
      </div>
    );
  }

  if (mode === 'space') {
    const cyl = s.system === 'cylindrical';
    const P = P3;
    const cs = toCylindrical(P);
    const sp = toSpherical(P);
    const surfaces: { key: string; text: string }[] = [];
    if (cyl) {
      if (s.sfR) surfaces.push({ key: 'r', text: `r = ${num(s.cr)}: ${SURFACE_HE[cylSurfaceR(s.cr)]}` });
      if (s.sfTheta) surfaces.push({ key: 'theta', text: `θ = ${degTxt(s.cth)}: ${SURFACE_HE[cylSurfaceTheta()]}` });
      if (s.sfThird) surfaces.push({ key: 'z', text: `z = ${num(s.cz)}: ${SURFACE_HE[cylSurfaceZ(s.cz)]}` });
    } else {
      if (s.sfR) surfaces.push({ key: 'r', text: `r = ${num(s.sr)}: ${SURFACE_HE[sphSurfaceR(s.sr)]}` });
      if (s.sfTheta) surfaces.push({ key: 'theta', text: `θ = ${degTxt(s.sth)}: ${SURFACE_HE[sphSurfaceTheta(s.sth)]}` });
      if (s.sfThird) surfaces.push({ key: 'phi', text: `φ = ${degTxt(s.sphi)}: ${SURFACE_HE[sphSurfacePhi()]}` });
    }
    const [x, y, z] = P;
    const hasAngle = cyl ? isAngleDefinedCyl(P) : isAngleDefinedSph(P);
    const q = quadrantOf(x, y);
    readout = (
      <div class="cl-readout">
        {cyl ? (
          <>
            <Row id="to-xyz" label="מגליליות לקרטזיות:">
              {`x = r cos θ = ${num(s.cr)}·cos ${degTxt(s.cth)} = ${num(x)},   y = r sin θ = ${num(s.cr)}·sin ${degTxt(s.cth)} = ${num(y)},   z = ${num(s.cz)}`}
            </Row>
            <Row id="to-cyl" label="מקרטזיות לגליליות:" strong>
              {`r = √(x² + y²) = √((${num(x)})² + (${num(y)})²) = ${num(cs.r)},   θ = ${hasAngle ? ang(cs.theta) : 'לא מוגדרת'},   z = ${num(z)}`}
            </Row>
            {!hasAngle ? (
              <Note id="angle">{`על ציר ${ltr('z')} (${ltr('r = 0')}) הזווית ${ltr('θ')} לא מוגדרת: כל זווית נותנת את אותה נקודה.`}</Note>
            ) : (
              <Note id="angle">
                {q.kind === 'quadrant' && (q.n === 2 || q.n === 3)
                  ? `${ltr('x < 0')}: ${ltr('arctan(y/x)')} לבדו מצביע לצד ההפוך, ולכן מוסיפים ${ltr('180°')}. הרביע נקבע לפי הסימנים של ${ltr('x')} ו-${ltr('y')}.`
                  : `הזווית ${ltr('θ')} היא האזימוט של ההיטל ${ltr('(x, y)')} במישור ${ltr('xy')}, כמו בקוטביות. הרביע נקבע לפי הסימנים של ${ltr('x')} ו-${ltr('y')}.`}
              </Note>
            )}
          </>
        ) : (
          <>
            <Row id="to-xyz" label="מכדוריות לקרטזיות:">
              {`x = r sin θ cos φ = ${num(x)},   y = r sin θ sin φ = ${num(y)},   z = r cos θ = ${num(s.sr)}·cos ${degTxt(s.sth)} = ${num(z)}`}
            </Row>
            <Row id="to-sph" label="מקרטזיות לכדוריות:" strong>
              {`r = √(x² + y² + z²) = ${num(sp.r)},   θ = arccos(z/r) = ${sp.r > 0 ? ang(sp.theta) : 'לא מוגדרת'},   φ = ${hasAngle ? ang(sp.phi) : 'לא מוגדרת'}`}
            </Row>
            <Row id="cyl-r" label="המרחק מציר z (ה-r הגלילי):">
              {`r sin θ = ${num(s.sr)}·sin ${degTxt(s.sth)} = ${num(s.sr * Math.sin(s.sth))}   (ולא r)`}
            </Row>
            {s.lat && (
              <Row id="latitude" label="זווית הרוחב של הסיכומים:">
                {`π/2 − θ = 90° − ${degTxt(s.sth)} = ${degTxt(latitudeOf(s.sth))}`}
              </Row>
            )}
            {!hasAngle && <Note id="angle">{`על ציר ${ltr('z')} האזימוט ${ltr('φ')} לא מוגדר: כל זווית נותנת את אותה נקודה.`}</Note>}
          </>
        )}
        {surfaces.length > 0 && (
          <div class="cl-row" data-readout="surfaces">
            <span class="cl-lab">משטחי הקואורדינטות דרך P:</span>
            <ul class="cl-list">
              {surfaces.map((x2) => (
                <li key={x2.key}>
                  <span class="q">{x2.text.split(':')[0]}</span>
                  <span>:{x2.text.split(':')[1]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {s.solid !== 'none' && (
          <>
            {s.solid === 'cylinder' && !cyl ? (
              <Note id="solid">{`${SOLID_HE.cylinder}: ${ltr('x² + y² ≤ 4,  0 ≤ z ≤ 3')}. בכדוריות התיאור מסובך (${ltr('r')} תלוי בזווית): בחרו גליליות.`}</Note>
            ) : (
              <Row id="solid" label={`${SOLID_HE[s.solid]}:`} strong>
                {solidInequalities(s.solid, cyl)}
              </Row>
            )}
            <Note id="solid-in">{inSolid(s.solid, P) ? 'P בתוך הגוף (נקודה מלאה).' : 'P מחוץ לגוף (נקודה חלולה).'}</Note>
          </>
        )}
      </div>
    );
  }

  /* ---------- controls ---------- */
  let controls: ComponentChildren = null;
  if (showControls) {
    if (mode === 'polar') {
      controls = (
        <>
          <Slider label="r" min={0} max={R_MAX} step={0.05} value={s.r} format={(v) => num(v)} onChange={(v) => userSet({ r: v })} />
          <Slider
            label="θ"
            min={s.wrap ? -360 : 0}
            max={s.wrap ? 720 : 359}
            step={1}
            value={Math.round((s.th * 180) / Math.PI)}
            format={(v) => `${v}°`}
            onChange={(v) => userSet({ th: v * DEG })}
          />
          <div class="group" role="group" aria-label="מה להציג">
            <Toggle label={<><bdi dir="ltr">arctan(y/x)</bdi></>} on={s.arctan} swatch="var(--eps)" onChange={(on) => userSet({ arctan: on })} />
            <Toggle
              label="θ מעבר ל-360°"
              on={s.wrap}
              swatch="var(--delta)"
              onChange={(on) => userSet(on ? { wrap: true } : { wrap: false, th: wrap2pi(cur.current.th) })}
            />
          </div>
        </>
      );
    } else if (mode === 'curve') {
      const [lo, hi] = cdef.range;
      controls = (
        <>
          {curves.length > 1 && (
            <div class="group" role="group" aria-label="העקום">
              {curves.map((k) => (
                <button
                  type="button"
                  key={k}
                  class={`toggle ${s.curve === k ? 'on' : ''}`}
                  aria-pressed={s.curve === k}
                  data-curve={k}
                  onClick={() => userSet({ curve: k, ct: defaultTrace(k) })}
                >
                  <bdi dir="ltr">{POLAR_CURVES[k].equation}</bdi>
                </button>
              ))}
            </div>
          )}
          {cdef.ray ? (
            <Slider label="r" min={lo} max={hi} step={0.05} value={s.ct} format={(v) => num(v)} onChange={(v) => userSet({ ct: v })} />
          ) : (
            <Slider
              label="θ"
              min={Math.round(lo / DEG)}
              max={Math.round(hi / DEG)}
              step={1}
              value={Math.round(s.ct / DEG)}
              format={(v) => `${v}°`}
              onChange={(v) => userSet({ ct: v * DEG })}
            />
          )}
          <div class="group" role="group" aria-label="מה להציג">
            <Toggle label="כל העקום" on={s.showAll} swatch="var(--curve)" onChange={(on) => userSet({ showAll: on })} />
          </div>
          <p class="hint">בקורס r ≥ 0: כל עקום מוצג רק בטווח הזוויות שבו r אינו שלילי.</p>
        </>
      );
    } else if (mode === 'region') {
      const up = (k: 'ra' | 'rb' | 'al' | 'be', d: number): Partial<State> => {
        const v = { ra: s.ra, rb: s.rb, al: s.al, be: s.be };
        if (k === 'ra') {
          v.ra = clamp(s.ra + d, 0, 2);
          if (v.rb < v.ra + 0.5) v.rb = v.ra + 0.5;
        } else if (k === 'rb') {
          v.rb = clamp(s.rb + d, 0.5, 2.5);
          if (v.ra > v.rb - 0.5) v.ra = v.rb - 0.5;
        } else if (k === 'al') {
          v.al = clamp(s.al + d, 0, 345);
          if (v.be < v.al + 15) v.be = v.al + 15;
        } else {
          v.be = clamp(s.be + d, 15, 360);
          if (v.al > v.be - 15) v.al = v.be - 15;
        }
        return v;
      };
      controls = (
        <div class="cl-steppers">
          <Stepper name="a" label="a" text={num(s.ra, 1)} canDec={s.ra > 0} canInc={s.ra < 2} onDec={() => userSet(up('ra', -0.5))} onInc={() => userSet(up('ra', 0.5))} />
          <Stepper name="b" label="b" text={num(s.rb, 1)} canDec={s.rb > 0.5} canInc={s.rb < 2.5} onDec={() => userSet(up('rb', -0.5))} onInc={() => userSet(up('rb', 0.5))} />
          <Stepper name="alpha" label="α" text={`${s.al}°`} canDec={s.al > 0} canInc={s.al < 345} onDec={() => userSet(up('al', -15))} onInc={() => userSet(up('al', 15))} />
          <Stepper name="beta" label="β" text={`${s.be}°`} canDec={s.be > 15} canInc={s.be < 360} onDec={() => userSet(up('be', -15))} onInc={() => userSet(up('be', 15))} />
        </div>
      );
    } else {
      const cyl = s.system === 'cylindrical';
      const swName = cyl ? ['r = c', 'θ = c', 'z = c'] : ['r = c', 'θ = c', 'φ = c'];
      controls = (
        <>
          {systems.length > 1 && (
            <div class="group" role="group" aria-label="מערכת קואורדינטות">
              {systems.map((k) => (
                <Toggle
                  key={k}
                  label={k === 'cylindrical' ? 'גליליות' : 'כדוריות'}
                  on={s.system === k}
                  onChange={() => userSet(convertSystem(cur.current, k))}
                />
              ))}
            </div>
          )}
          {cyl ? (
            <>
              <Slider label="r" min={0} max={3} step={0.05} value={s.cr} format={(v) => num(v)} onChange={(v) => userSet({ cr: v })} />
              <Slider label="θ" min={0} max={359} step={1} value={Math.round(s.cth / DEG)} format={(v) => `${v}°`} onChange={(v) => userSet({ cth: v * DEG })} />
              <Slider label="z" min={-2.5} max={3} step={0.05} value={s.cz} format={(v) => num(v)} onChange={(v) => userSet({ cz: v })} />
            </>
          ) : (
            <>
              <Slider label="r" min={0} max={3} step={0.05} value={s.sr} format={(v) => num(v)} onChange={(v) => userSet({ sr: v })} />
              <Slider label="θ (מציר z)" min={0} max={180} step={1} value={Math.round(s.sth / DEG)} format={(v) => `${v}°`} onChange={(v) => userSet({ sth: v * DEG })} />
              <Slider label="φ" min={0} max={359} step={1} value={Math.round(s.sphi / DEG)} format={(v) => `${v}°`} onChange={(v) => userSet({ sphi: v * DEG })} />
            </>
          )}
          <div class="group" role="group" aria-label="משטחי הקואורדינטות דרך הנקודה">
            <Toggle label={<bdi dir="ltr">{swName[0]}</bdi>} on={s.sfR} swatch="var(--accent)" onChange={(on) => userSet({ sfR: on })} />
            <Toggle label={<bdi dir="ltr">{swName[1]}</bdi>} on={s.sfTheta} swatch="var(--delta)" onChange={(on) => userSet({ sfTheta: on })} />
            <Toggle label={<bdi dir="ltr">{swName[2]}</bdi>} on={s.sfThird} swatch="var(--limit)" onChange={(on) => userSet({ sfThird: on })} />
            {!cyl && <Toggle label="זווית הרוחב של הסיכומים" on={s.lat} swatch="var(--eps)" onChange={(on) => userSet({ lat: on })} />}
          </div>
          <div class="group" role="group" aria-label="גוף">
            {(['none', 'ball', 'cylinder', 'cone'] as const).map((k) => (
              <Toggle key={k} label={k === 'none' ? 'בלי גוף' : SOLID_HE[k]} on={s.solid === k} onChange={() => userSet({ solid: k })} />
            ))}
          </div>
          <div class="cl-views">
            <Slider label="סיבוב המבט" value={s.az} min={0} max={359} step={1} format={(v) => `${Math.round(v)}°`} onChange={(v) => apply({ az: wrapAz(v) })} />
            <Slider label="הטיית המבט" value={s.el} min={0} max={85} step={1} format={(v) => `${Math.round(v)}°`} onChange={(v) => apply({ el: clamp(v, 0, 85) })} />
          </div>
          <p class="hint hand">גררו את הרקע של האיור כדי לסובב את המבט.</p>
        </>
      );
    }
  }

  return (
    <SimShell
      fig={props.id}
      label={`${label}${describe()}`}
      canvasRef={canvasRef}
      aspect={mode === 'space' ? 1.2 : WORLD_W / WORLD_H}
      live={live}
      tasks={tasks}
      onReset={reset}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      cursor={mode === 'curve' ? 'default' : 'grab'}
      readout={readout}
      controls={controls}
    />
  );
}

/** the equation of a curve with the current angle put in: "2cos(45° = π/4)"; the spiral takes θ in radians */
function curveSubstitution(k: CurveKey, theta: number): string {
  const a = ang(theta);
  switch (k) {
    case 'circle':
      return '2';
    case 'cos':
      return `2cos(${a})`;
    case 'sin':
      return `2sin(${a})`;
    case 'cardioid':
      return `1 + cos(${a})`;
    case 'spiral':
      return `θ/4 = ${num(theta)}/4`;
    case 'petal':
      return `2cos(2·${a})`;
    case 'vline':
      return `1/cos(${a})`;
    case 'hline':
      return `2/sin(${a})`;
    default:
      return 'θ';
  }
}

/** The inequalities of a solid in cylindrical and in spherical coordinates (plain text, a left-to-right island). */
function solidInequalities(k: SolidKey, cyl: boolean): string {
  if (k === 'ball') {
    const R = SOLIDS.ball.R;
    return cyl
      ? `0 ≤ θ < 2π,  0 ≤ r ≤ ${R},  −√(${R * R} − r²) ≤ z ≤ √(${R * R} − r²)`
      : `0 ≤ r ≤ ${R},  0 ≤ θ ≤ π,  0 ≤ φ < 2π`;
  }
  if (k === 'cylinder') {
    const { R, H } = SOLIDS.cylinder;
    return `0 ≤ r ≤ ${R},  0 ≤ θ < 2π,  0 ≤ z ≤ ${H}`;
  }
  const H = SOLIDS.cone.H;
  return cyl ? `0 ≤ θ < 2π,  0 ≤ r ≤ ${H},  r ≤ z ≤ ${H}` : `0 ≤ φ < 2π,  0 ≤ θ ≤ π/4,  0 ≤ r ≤ ${H}/cos θ`;
}

/* ------------------------------------------------------------------ canvas drawing, plane */

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, p: Palette, v: View, size = 13, italic = false) {
  ctx.save();
  ctx.font = `${italic ? 'italic ' : ''}600 ${size}px ${p.fontUi}`;
  const half = ctx.measureText(text).width / 2;
  const pad = 4;
  const cx = Math.min(Math.max(x, half + pad), v.w - half - pad);
  let cy = Math.min(Math.max(y, 9 + pad), v.h - 9 - pad);
  let cx2 = cx;
  if (cx + half > v.w - BUTTONS_W && cy < BUTTONS_H + 9) {
    if (y < BUTTONS_H / 2 + 9) cy = BUTTONS_H + 9;
    else cx2 = v.w - BUTTONS_W - half - pad;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4;
  ctx.strokeStyle = withAlpha(p.paper, 0.9);
  ctx.strokeText(text, cx2, cy);
  ctx.fillStyle = color;
  ctx.fillText(text, cx2, cy);
  ctx.restore();
}

function dotAt(ctx: CanvasRenderingContext2D, at: Vec2, r: number, fill: string | null, stroke: string, p: Palette, width = 2) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(at[0], at[1], r, 0, TAU);
  ctx.fillStyle = fill ?? p.paper;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

function strokePath(ctx: CanvasRenderingContext2D, pts: readonly Vec2[], color: string, width: number, dash: number[] = [], alpha = 1) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  pts.forEach((q, i) => (i === 0 ? ctx.moveTo(q[0], q[1]) : ctx.lineTo(q[0], q[1])));
  ctx.stroke();
  ctx.restore();
}

/** points of an arc about screen centre c from math angle a0 to a1 (counter-clockwise on screen for a1 > a0); radius rad(t) */
function arcPoints(c: Vec2, rad: (t: number) => number, a0: number, a1: number, steps = 48): Vec2[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const a = a0 + (a1 - a0) * t;
    const rr = rad(t);
    return [c[0] + rr * Math.cos(a), c[1] - rr * Math.sin(a)] as Vec2;
  });
}

/** the polar grid over the Cartesian axes; returns the screen origin and the scale */
function planeBase(ctx: CanvasRenderingContext2D, view: View, p: Palette, quadrant: number | null): { O: Vec2; ppm: number } {
  const O = toScreen(view, 0, 0);
  const ppm = view.ppm;
  ctx.save();
  ctx.strokeStyle = p.rule;
  ctx.lineWidth = 1;
  for (let r = 0.5; r <= 4.5; r += 0.5) {
    ctx.beginPath();
    ctx.arc(O[0], O[1], r * ppm, 0, TAU);
    ctx.stroke();
  }
  const reach = Math.hypot(view.w, view.h);
  for (let i = 0; i < 12; i++) {
    const t = (i * Math.PI) / 6;
    ctx.beginPath();
    ctx.moveTo(O[0], O[1]);
    ctx.lineTo(O[0] + reach * Math.cos(t), O[1] - reach * Math.sin(t));
    ctx.stroke();
  }
  ctx.restore();
  arrow(ctx, 6, O[1], view.w - 8, O[1], { color: p.ink3, width: 1.4, head: 8 });
  arrow(ctx, O[0], view.h - 6, O[0], 8, { color: p.ink3, width: 1.4, head: 8 });
  label(ctx, 'x', view.w - 14, O[1] + 14, p.ink2, p, view, 14, true);
  label(ctx, 'y', O[0] + 14, 16, p.ink2, p, view, 14, true);
  label(ctx, 'O', O[0] - 10, O[1] + 12, p.ink2, p, view);
  for (const r of [1, 2]) label(ctx, String(r), O[0] + 9, O[1] + r * ppm - 1, p.ink3, p, view, 12);
  if (quadrant !== null) {
    const Q: [string, number, number][] = [
      ['I', 1, 1],
      ['II', -1, 1],
      ['III', -1, -1],
      ['IV', 1, -1],
    ];
    Q.forEach(([name, sx, sy], i) => {
      const at = toScreen(view, sx * 3.1, sy * 2.35);
      label(ctx, name, at[0], at[1], i + 1 === quadrant ? p.ink : p.ink3, p, view, i + 1 === quadrant ? 17 : 14, true);
    });
  }
  return { O, ppm };
}

const quadrantNumber = (x: number, y: number): number | null => {
  const q = quadrantOf(x, y);
  return q.kind === 'quadrant' ? q.n : null;
};

function drawPolar(ctx: CanvasRenderingContext2D, view: View, p: Palette, s: State) {
  const [x, y] = fromPolar(s.r, s.th);
  const { O } = planeBase(ctx, view, p, quadrantNumber(x, y));
  const at = (wx: number, wy: number): Vec2 => toScreen(view, wx, wy);
  const P = at(x, y);

  // arctan(y/x): a warm dashed ray, its arc from +x, and a HOLLOW ring where it lands (only where it differs from P)
  if (s.arctan && s.r > 0 && Math.abs(x) > 1e-9) {
    const a = Math.atan(y / x);
    const same = Math.abs(wrap2pi(a - s.th + Math.PI) - Math.PI) < 1e-6;
    if (!same) {
      const G = at(s.r * Math.cos(a), s.r * Math.sin(a));
      strokePath(ctx, [O, G], p.eps, 1.8, [6, 5]);
      strokePath(ctx, arcPoints(O, () => 40, 0, a), p.eps, 1.6, [4, 4]);
      dotAt(ctx, G, 7, null, p.eps, p, 2);
      const lab = at((s.r + 0.35) * Math.cos(a), (s.r + 0.35) * Math.sin(a));
      label(ctx, 'arctan', lab[0], lab[1], p.eps, p, view, 12);
    }
  }
  // dashed legs: x = r cos θ along the x-axis, y = r sin θ along the y-axis
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = p.ink3;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(P[0], P[1]);
  ctx.lineTo(P[0], O[1]);
  ctx.moveTo(P[0], P[1]);
  ctx.lineTo(O[0], P[1]);
  ctx.stroke();
  ctx.restore();
  if (Math.abs(x) > 0.15) label(ctx, 'x', P[0], O[1] + (y >= 0 ? 15 : -15), p.ink2, p, view, 13, true);
  if (Math.abs(y) > 0.15) label(ctx, 'y', O[0] + (x >= 0 ? -14 : 14), P[1], p.ink2, p, view, 13, true);
  // r
  if (s.r > 0) {
    strokePath(ctx, [O, P], p.accent, 2.6);
    const m = at((x / 2) - 0.2 * Math.sin(s.th), (y / 2) + 0.2 * Math.cos(s.th));
    label(ctx, 'r', m[0], m[1], p.accent, p, view, 14, true);
    // θ: an arc from +x, growing by 3 px per full turn when θ runs past 360°
    if (Math.abs(s.th) > 0.05) {
      const turns = (t: number) => 28 + 4 * Math.floor(Math.abs(s.th * t) / TAU);
      strokePath(ctx, arcPoints(O, turns, 0, s.th, 96), p.delta, 2.2);
      const mid = s.th / 2;
      const rr = 28 + 14;
      label(ctx, 'θ', O[0] + rr * Math.cos(mid), O[1] - rr * Math.sin(mid), p.delta, p, view, 14, true);
    }
  }
  // P: a filled dot with a handle ring
  ctx.save();
  ctx.strokeStyle = withAlpha(p.ink, 0.35);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(P[0], P[1], 13, 0, TAU);
  ctx.stroke();
  ctx.restore();
  dotAt(ctx, P, 5.5, p.ink, p.paper, p, 1.5);
  const away = s.r > 0 ? [Math.cos(s.th), Math.sin(s.th)] : [1, 1];
  label(ctx, 'P', P[0] + 20 * away[0], P[1] - 20 * away[1], p.ink, p, view, 14, true);
}

function drawCurve(ctx: CanvasRenderingContext2D, view: View, p: Palette, s: State) {
  const { O } = planeBase(ctx, view, p, null);
  const at = (wx: number, wy: number): Vec2 => toScreen(view, wx, wy);
  const key = s.curve;
  const def = POLAR_CURVES[key];
  const [lo, hi] = def.range;
  const pts = (a: number, b: number, n = 240): Vec2[] =>
    Array.from({ length: n + 1 }, (_, i) => {
      const c = curvePoint(key, a + ((b - a) * i) / n);
      return at(c.x, c.y);
    });
  if (s.showAll) strokePath(ctx, pts(s.ct, hi), p.curve, 1.8, [6, 5], 0.4);
  const traced = pts(lo, s.ct);
  strokePath(ctx, traced, p.curve, 3);
  const c = curvePoint(key, s.ct);
  const P = at(c.x, c.y);
  if (c.r > 1e-9) {
    strokePath(ctx, [O, P], p.accent, 2.2);
    const m = at(c.x / 2 - 0.2 * Math.sin(c.theta), c.y / 2 + 0.2 * Math.cos(c.theta));
    label(ctx, 'r', m[0], m[1], p.accent, p, view, 14, true);
  }
  // θ: the arc from +x to the current direction (the ray's direction is fixed)
  if (Math.abs(c.theta) > 0.05 && c.r > 0.35) {
    const th = c.theta;
    const turns = (t: number) => 26 + 4 * Math.floor(Math.abs(th * t) / TAU);
    strokePath(ctx, arcPoints(O, turns, 0, th, 96), p.delta, 2);
    label(ctx, 'θ', O[0] + 42 * Math.cos(th / 2), O[1] - 42 * Math.sin(th / 2), p.delta, p, view, 14, true);
  }
  dotAt(ctx, P, 6, p.curve, p.paper, p, 2);
  // the start of the traced curve: a hollow mark
  const S0 = pts(lo, lo, 1)[0];
  if (Math.hypot(S0[0] - P[0], S0[1] - P[1]) > 9) dotAt(ctx, S0, 4, null, p.curve, p, 1.6);
}

function drawRegion(ctx: CanvasRenderingContext2D, view: View, p: Palette, s: State) {
  const { O, ppm } = planeBase(ctx, view, p, null);
  const at = (wx: number, wy: number): Vec2 => toScreen(view, wx, wy);
  const a = s.al * DEG;
  const b = s.be * DEG;
  const full = s.be - s.al >= 360;
  const fill = withAlpha(p.delta, 0.3);
  ctx.save();
  ctx.beginPath();
  if (full) {
    ctx.arc(O[0], O[1], s.rb * ppm, 0, TAU);
    if (s.ra > 0) ctx.arc(O[0], O[1], s.ra * ppm, 0, TAU, true);
    ctx.fillStyle = fill;
    ctx.fill('evenodd');
  } else {
    ctx.arc(O[0], O[1], s.rb * ppm, -a, -b, true);
    if (s.ra > 0) ctx.arc(O[0], O[1], s.ra * ppm, -b, -a, false);
    else ctx.lineTo(O[0], O[1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.restore();
  // the boundary pieces
  const edge = p.delta;
  strokePath(ctx, arcPoints(O, () => s.rb * ppm, a, full ? a + TAU : b, 120), edge, 2.6);
  if (s.ra > 0) strokePath(ctx, arcPoints(O, () => s.ra * ppm, a, full ? a + TAU : b, 120), edge, 2.6);
  if (!full) {
    const r0 = s.ra * ppm;
    const r1 = s.rb * ppm;
    strokePath(ctx, [[O[0] + r0 * Math.cos(a), O[1] - r0 * Math.sin(a)], [O[0] + r1 * Math.cos(a), O[1] - r1 * Math.sin(a)]], edge, 2.6, [7, 5]);
    strokePath(ctx, [[O[0] + r0 * Math.cos(b), O[1] - r0 * Math.sin(b)], [O[0] + r1 * Math.cos(b), O[1] - r1 * Math.sin(b)]], edge, 2.6, [7, 5]);
  }
  // labels sit on the boundary pieces (they carry a halo)
  const mid = full ? 270 * DEG : (a + b) / 2;
  const ang1 = (t: number) => niceAngle(t) ?? `${Math.round((t * 180) / Math.PI)}°`;
  label(ctx, `r = ${num(s.rb, 1)}`, O[0] + s.rb * ppm * Math.cos(mid), O[1] - s.rb * ppm * Math.sin(mid), p.ink, p, view, 13);
  if (s.ra > 0) label(ctx, `r = ${num(s.ra, 1)}`, O[0] + s.ra * ppm * Math.cos(mid), O[1] - s.ra * ppm * Math.sin(mid), p.ink, p, view, 13);
  if (!full) {
    const rm = ((s.ra + s.rb) / 2) * ppm;
    label(ctx, `θ = ${ang1(a)}`, O[0] + rm * Math.cos(a), O[1] - rm * Math.sin(a), p.ink, p, view, 13);
    label(ctx, `θ = ${ang1(b)}`, O[0] + rm * Math.cos(b), O[1] - rm * Math.sin(b), p.ink, p, view, 13);
  }
  // the test point Q: filled (inside) or hollow (outside)
  const inside = inRegion(s.qx, s.qy, { a: s.ra, b: s.rb, alpha: a, beta: b });
  const Q = at(s.qx, s.qy);
  ctx.save();
  ctx.strokeStyle = withAlpha(p.ink, 0.35);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(Q[0], Q[1], 13, 0, TAU);
  ctx.stroke();
  ctx.restore();
  if (inside) dotAt(ctx, Q, 6.5, p.pointIn, p.paper, p, 2);
  else dotAt(ctx, Q, 6.5, null, p.pointOut, p, 2.6);
  label(ctx, 'Q', Q[0] + 18, Q[1] - 16, p.ink, p, view, 14, true);
}

/* ------------------------------------------------------------------ canvas drawing, space */

type Pt3 = Vec3;
const range = (n: number, f: (t: number) => Pt3): Pt3[] => Array.from({ length: n + 1 }, (_, i) => f(i / n));

function drawSpace(ctx: CanvasRenderingContext2D, view: View, p: Palette, s: State) {
  const cam = camera(s.az, s.el);
  const scale = (Math.min(view.w, view.h) * 0.5 * 0.94) / SPACE_R;
  const proj = makeProjector(cam, { cx: view.w / 2, cy: view.h / 2 + 8, scale });
  const sc = (v: Pt3): Vec2 => {
    const q = proj(v);
    return [q[0], q[1]];
  };
  const line = (pts: Pt3[], color: string, width: number, dash: number[] = [], alpha = 1) => strokePath(ctx, pts.map(sc), color, width, dash, alpha);
  const L = (text: string, v: Pt3, color: string, dx = 0, dy = 0, size = 14) => {
    const q = sc(v);
    label(ctx, text, q[0] + dx, q[1] + dy, color, p, view, size, true);
  };
  const O = sc([0, 0, 0]);

  // floor grid z = 0
  for (let i = -SPACE_LIM; i <= SPACE_LIM; i++) {
    line([[i, -SPACE_LIM, 0], [i, SPACE_LIM, 0]], p.rule, 1);
    line([[-SPACE_LIM, i, 0], [SPACE_LIM, i, 0]], p.rule, 1);
  }
  // axes
  const axes: [Pt3, string][] = [
    [[1, 0, 0], 'x'],
    [[0, 1, 0], 'y'],
    [[0, 0, 1], 'z'],
  ];
  for (const [e, name] of axes) {
    const neg = sc([-AXL * e[0], -AXL * e[1], -AXL * e[2]]);
    strokePath(ctx, [neg, O], p.ink3, 1.3, [5, 4], 0.8);
    const end = sc([AXL * e[0], AXL * e[1], AXL * e[2]]);
    arrow(ctx, O[0], O[1], end[0], end[1], { color: p.ink3, width: 1.6, head: 9 });
    L(name, [(AXL + 0.35) * e[0], (AXL + 0.35) * e[1], (AXL + 0.35) * e[2]], p.ink2);
  }

  const cyl = s.system === 'cylindrical';
  const P: Pt3 = cyl ? fromCylindrical(s.cr, s.cth, s.cz) : fromSpherical(s.sr, s.sth, s.sphi);
  const F: Pt3 = [P[0], P[1], 0];
  const surfAlpha = 0.5;

  // the solid, as a wireframe
  if (s.solid !== 'none') drawSolid(line, s.solid, p);

  // coordinate surfaces through the point
  if (cyl) {
    if (s.sfR) {
      for (const zv of [-2, -1, 0, 1, 2, s.cz]) line(range(72, (t) => fromCylindrical(s.cr, TAU * t, zv)), p.accent, 1.1, [], surfAlpha * (zv === s.cz ? 1 : 0.7));
      for (let k = 0; k < 12; k++) line([fromCylindrical(s.cr, (k * Math.PI) / 6, -2.4), fromCylindrical(s.cr, (k * Math.PI) / 6, 2.4)], p.accent, 1.1, [], surfAlpha * 0.7);
    }
    if (s.sfTheta) {
      for (const zv of [-2, -1, 0, 1, 2]) line([fromCylindrical(0, s.cth, zv), fromCylindrical(3, s.cth, zv)], p.delta, 1.1, [], surfAlpha);
      for (const rr of [0, 1, 2, 3]) line([fromCylindrical(rr, s.cth, -2.4), fromCylindrical(rr, s.cth, 2.4)], p.delta, 1.1, [], surfAlpha);
    }
    if (s.sfThird) {
      for (const rr of [1, 2, 3]) line(range(72, (t) => fromCylindrical(rr, TAU * t, s.cz)), p.limit, 1.1, [], surfAlpha);
      for (let k = 0; k < 12; k++) line([fromCylindrical(0, 0, s.cz), fromCylindrical(3, (k * Math.PI) / 6, s.cz)], p.limit, 1.1, [], surfAlpha);
    }
    // the circle P draws when θ turns, on its cylinder
    if (!s.sfR) line(range(72, (t) => fromCylindrical(s.cr, TAU * t, s.cz)), p.ink3, 1.2, [3, 4], 0.9);
  } else {
    if (s.sfR) {
      for (const th of [30, 60, 90, 120, 150]) line(range(72, (t) => fromSpherical(s.sr, th * DEG, TAU * t)), p.accent, 1.1, [], surfAlpha);
      for (let k = 0; k < 12; k++) line(range(36, (t) => fromSpherical(s.sr, Math.PI * t, (k * Math.PI) / 6)), p.accent, 1.1, [], surfAlpha);
    }
    if (s.sfTheta) {
      for (let k = 0; k < 12; k++) line([[0, 0, 0], fromSpherical(3, s.sth, (k * Math.PI) / 6)], p.delta, 1.1, [], surfAlpha);
      for (const rr of [1, 2, 3]) line(range(72, (t) => fromSpherical(rr, s.sth, TAU * t)), p.delta, 1.1, [], surfAlpha);
    }
    if (s.sfThird) {
      for (let k = 0; k <= 6; k++) line([[0, 0, 0], fromSpherical(3, (k * Math.PI) / 6, s.sphi)], p.limit, 1.1, [], surfAlpha);
      for (const rr of [1, 2, 3]) line(range(36, (t) => fromSpherical(rr, Math.PI * t, s.sphi)), p.limit, 1.1, [], surfAlpha);
    }
    // the circle P draws when φ turns, on its cone (a plane at θ = 90°)
    if (!s.sfTheta && Math.sin(s.sth) > 1e-6) line(range(72, (t) => fromSpherical(s.sr, s.sth, TAU * t)), p.ink3, 1.2, [3, 4], 0.9);
  }

  const Ps = sc(P);
  if (cyl) {
    // r in the floor, θ in the floor from the x-axis, the height z
    line([[0, 0, 0], F], p.accent, 2.6);
    if (s.cr > 0.05) {
      const a = Math.min(0.5, 0.5 * s.cr);
      line(range(40, (t) => fromCylindrical(a, s.cth * t, 0)), p.delta, 2.2);
      if (s.cth > 0.1) L('θ', fromCylindrical(a + 0.3, s.cth / 2, 0), p.delta);
      // r's letter on the side of its segment away from the θ wedge, so "θ" and "r" never read as one word
      const at = sc(fromCylindrical(Math.max(0.62 * s.cr, Math.min(s.cr, a + 0.45)), s.cth, 0));
      const Fs = sc(F);
      const len = Math.hypot(Fs[0] - O[0], Fs[1] - O[1]) || 1;
      let nx = -(Fs[1] - O[1]) / len;
      let ny = (Fs[0] - O[0]) / len;
      const wedge = sc(fromCylindrical(a + 0.3, s.cth / 2, 0));
      const side = (wedge[0] - at[0]) * nx + (wedge[1] - at[1]) * ny;
      if (side > 1 || (Math.abs(side) <= 1 && ny < 0)) {
        nx = -nx;
        ny = -ny;
      }
      label(ctx, 'r', at[0] + 13 * nx, at[1] + 13 * ny, p.accent, p, view, 14, true);
    }
    if (Math.abs(s.cz) > 0.05) {
      line([F, P], p.limit, 2.6);
      L('z', [F[0], F[1], s.cz / 2], p.limit, 14, 0);
    }
    line([[0, 0, 0], F], p.ink3, 1.2, [3, 4]);
    dotAt(ctx, sc(F), 3.4, null, p.ink, p, 1.4);
  } else {
    // r, the drop and the footprint with its length r sin θ, θ from the +z axis, φ in the floor
    line([[0, 0, 0], P], p.accent, 2.6);
    // with the latitude arc on (it sits around the middle of OP, on the floor side), r's letter moves up along OP and to the other side
    if (s.sr > 0.05) {
      const f = s.lat ? 0.74 : 0.5;
      L('r', [P[0] * f, P[1] * f, P[2] * f], p.accent, s.lat ? -12 : 12, -8);
    }
    line([P, F], p.ink3, 1.2, [3, 4]);
    line([[0, 0, 0], F], p.ink3, 1.4, [4, 4]);
    dotAt(ctx, sc(F), 3.4, null, p.ink, p, 1.4);
    if (s.sr > 0.05 && Math.sin(s.sth) > 0.05) {
      // the footprint's length: written past the footprint when the footprint is short, where the φ arc and its
      // letter (at 0.85 from the origin) would otherwise be under it
      const fl = Math.hypot(F[0], F[1]);
      const k = fl > 2.2 ? 0.72 : (fl + 0.5) / fl;
      L('r sin θ', [F[0] * k, F[1] * k, 0], p.ink2, 0, 16, 12);
      const a = 0.7;
      line(range(40, (t) => fromSpherical(a, s.sth * t, s.sphi)), p.delta, 2.2);
      L('θ', fromSpherical(a + 0.3, s.sth / 2, s.sphi), p.delta);
      if (s.sphi > 0.1) {
        line(range(40, (t) => fromSpherical(0.5, Math.PI / 2, s.sphi * t)), p.limit, 2.2);
        L('φ', fromSpherical(0.85, Math.PI / 2, s.sphi / 2), p.limit);
      }
      if (s.lat) {
        // the notes' latitude: from the floor up to OP, π/2 − θ
        line(range(40, (t) => fromSpherical(1.1, Math.PI / 2 + (s.sth - Math.PI / 2) * t, s.sphi)), p.eps, 2, [5, 4]);
        L('קו רוחב', fromSpherical(1.6, (Math.PI / 2 + s.sth) / 2, s.sphi), p.eps, 14, 0, 12);
      }
    } else if (s.sr > 0.05) {
      // on the z-axis: only θ is drawn (0 or 180°), φ is undefined
      const a = 0.7;
      line(range(40, (t) => fromSpherical(a, s.sth * t, s.sphi)), p.delta, 2.2);
      L('θ', fromSpherical(a + 0.3, s.sth / 2, s.sphi), p.delta);
    }
  }

  // the point: filled; with a solid, filled green inside and hollow red outside
  if (s.solid !== 'none') {
    if (inSolid(s.solid, P)) dotAt(ctx, Ps, 6.5, p.pointIn, p.paper, p, 2);
    else dotAt(ctx, Ps, 6.5, null, p.pointOut, p, 2.6);
  } else dotAt(ctx, Ps, 5.5, p.ink, p.paper, p, 1.5);
  // P's label away from the origin on the screen
  const dx = Ps[0] - O[0];
  const dy = Ps[1] - O[1];
  const d = Math.hypot(dx, dy) || 1;
  label(ctx, 'P', Ps[0] + (18 * dx) / d, Ps[1] + (18 * dy) / d, p.ink, p, view, 14, true);
  dotAt(ctx, O, 2.8, p.ink, p.paper, p, 1);
}

function drawSolid(line: (pts: Pt3[], color: string, width: number, dash?: number[], alpha?: number) => void, k: SolidKey, p: Palette) {
  const col = p.ink2;
  if (k === 'ball') {
    const R = SOLIDS.ball.R;
    for (const th of [45, 90, 135]) line(range(72, (t) => fromSpherical(R, th * DEG, TAU * t)), col, 1.3, [], 0.55);
    for (let j = 0; j < 8; j++) line(range(36, (t) => fromSpherical(R, Math.PI * t, (j * Math.PI) / 4)), col, 1.3, [], 0.55);
  } else if (k === 'cylinder') {
    const { R, H } = SOLIDS.cylinder;
    for (const zv of [0, H]) line(range(72, (t) => fromCylindrical(R, TAU * t, zv)), col, 1.4, [], 0.6);
    for (let j = 0; j < 12; j++) line([fromCylindrical(R, (j * Math.PI) / 6, 0), fromCylindrical(R, (j * Math.PI) / 6, H)], col, 1.2, [], 0.5);
  } else {
    const H = SOLIDS.cone.H;
    line(range(72, (t) => fromCylindrical(H, TAU * t, H)), col, 1.4, [], 0.6);
    for (let j = 0; j < 12; j++) line([[0, 0, 0], fromCylindrical(H, (j * Math.PI) / 6, H)], col, 1.2, [], 0.5);
  }
}
