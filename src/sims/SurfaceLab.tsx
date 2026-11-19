/**
 * Lesson 2.5's figure: a quadric surface drawn as a wireframe of its sections, with a cutting plane and the section in
 * its own plane. No three.js: the pedagogy is "a surface is drawn from its traces", and a canvas works on a weak machine.
 *
 * Top: the surface in an axonometric view (src/sims/core/axo.ts; turn by dragging the canvas, the two view sliders or the
 * arrow keys), clipped to the box |x|, |y|, |z| ≤ 3. The wireframe is real curves computed from the equation by
 * src/math/quadrics.ts (light, fading with depth; the far side of a closed surface dashed). The cutting plane
 * `axis = c` is a translucent rectangle (cool tint) and the section on it is the bold accent curve. Below: the section
 * flat in its own plane, equal scales, the curve exact (hyperbola with dashed asymptotes), and a readout: the plane, the
 * surface's equation with the plane put in, the simplified equation of the section, and its type in Hebrew (ellipse,
 * circle, hyperbola, parabola, pair of lines, single point, "אין חתך"). Every degenerate case is exact.
 *
 * PROPS (all optional but `id`)
 *   id            figure id: tasks are stored as `${id}:${task}`, the step bus delivers to it
 *   surface       preset id (default 'ellipsoid'); in `mystery` the hidden surface
 *   surfaces      preset ids offered in a selector (default [surface]; one → no selector)
 *   axis          'x' | 'y' | 'z', the cutting plane's normal axis (default 'z')
 *   c             the plane's position, −3…3 in steps of 0.25 (default 0)
 *   accumulate    keep the sections already visited drawn in the 3D view (default false)
 *   mystery       hide the surface's name, its equation and the wireframe; show only the sections the reader visits,
 *                 and a list of names to choose from (default false)
 *   options       mystery: the preset ids in the list of names (default ellipsoid, cone, paraboloid, saddle,
 *                 hyperboloid1, hyperboloid2; the hidden surface is added when missing)
 *   az, el        the view in degrees (defaults 40 and 22; el in 0…85)
 *   controls      which control groups show: 'surface' (selector), 'axis', 'c', 'accumulate', 'views'
 *                 (default all of them)
 *   tasks         task ids, below
 *
 * STEP KEYS (<Step set={{…}}>; a step never ticks a task and re-bases the tasks): surface (preset id), axis, c,
 * accumulate (boolean), az, el. A step that changes the surface restarts the visited sections.
 *
 * PRESETS (id: equation; Hebrew name)
 *   ellipsoid     x²/4 + y²/9 + z² = 1       אליפסואיד (the notes' example)
 *   sphere        x² + y² + z² = 4           ספירה
 *   cone          x² + y² − z² = 0           חרוט (the notes' example)
 *   paraboloid    z = x² + y²                פרבולואיד סיבובי
 *   saddle        z = x² − y²                פרבולואיד היפרבולי (אוכף)
 *   hyperboloid1  x² + y² − z² = 1           היפרבולואיד חד-יריעתי
 *   hyperboloid2  x² + y² − z² = −1          היפרבולואיד דו-יריעתי
 *   cylinder      x² + y² = 1                גליל (z is missing from the equation)
 *   pcyl          z = x²                     גליל מעל פרבולה (y is missing)
 *
 * TASKS (tick only from the reader's own change of the PLANE (axis or c), or of the answer in `mystery`, since the last
 * step, reset or change of surface; a state that a step, the reset or the surface selector already satisfied must be
 * left and found again: selecting the saddle while the plane is z = 0 does not tick 'saddle-lines')
 *   ellipsoid-point      the surface is the ellipsoid or the sphere and the section is a single point
 *   cone-lines           the cone is cut by y = 0 or x = 0 (a pair of lines)
 *   no-intersection      the two-sheet hyperboloid is cut by a plane that does not meet it
 *   saddle-lines         the saddle is cut so that the section is a pair of lines (z = 0)
 *   hyperboloid-lines    the one-sheet hyperboloid is cut so that the section is a pair of lines (x = ±1 or y = ±1)
 *   mystery-identify     (needs `mystery`) the reader chose the hidden surface's name correctly after at least two
 *                        sections of their own
 * The section planes are z = c for 'z', x = c for 'x', y = c for 'y'; in the flat panel (u, v) is (x, y) for z = c,
 * (y, z) for x = c and (x, z) for y = c.
 */

import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  classifyConic,
  fmtConicEquation,
  fmtLines,
  fmtRational,
  fmtSqrtRational,
  gradient,
  planeVars,
  presetById,
  sampleConic,
  sampleTrace,
  substitutePlane,
  traceConic,
  type Axis,
  type ConicInfo,
  type Preset,
  type PresetId,
  type Vec3,
} from '~/math/quadrics';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { camera, makeProjector } from './core/axo';
import { arrow, withAlpha } from './core/ink';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import './SurfaceLab.css';

const BOX = 3;
const AXES: Axis[] = ['x', 'y', 'z'];
const DEFAULT_OPTIONS: PresetId[] = ['ellipsoid', 'cone', 'paraboloid', 'saddle', 'hyperboloid1', 'hyperboloid2'];

export interface SurfaceLabProps {
  id: string;
  surface?: string;
  surfaces?: string[];
  axis?: Axis;
  c?: number;
  accumulate?: boolean;
  mystery?: boolean;
  options?: string[];
  az?: number;
  el?: number;
  controls?: string[];
  tasks?: string[];
}

interface Cut {
  axis: Axis;
  c: number;
  /** chosen by the reader (a step's cut is drawn but does not count) */
  own: boolean;
}

interface State {
  surface: string;
  axis: Axis;
  c: number;
  accumulate: boolean;
  visited: Cut[];
  answer: string | null;
  az: number;
  el: number;
}

type Key = 'surface' | 'axis' | 'c' | 'answer';

interface Ctx {
  touched: Set<Key>;
  /** tasks whose property was false at some reader move since the last step */
  wasOff: Set<string>;
  baseline: State;
}

const NAME: Record<PresetId, string> = {
  ellipsoid: 'אליפסואיד',
  sphere: 'ספירה',
  cone: 'חרוט',
  paraboloid: 'פרבולואיד סיבובי',
  saddle: 'פרבולואיד היפרבולי (אוכף)',
  hyperboloid1: 'היפרבולואיד חד-יריעתי',
  hyperboloid2: 'היפרבולואיד דו-יריעתי',
  cylinder: 'גליל',
  pcyl: 'גליל מעל פרבולה',
};

/**
 * the wireframe: which sections are drawn for each surface (0 sections are the medium-weight coordinate sections).
 * Chosen so each surface is recognisable in a still picture: rings for the round ones, a grid of parabolas for the saddle.
 */
const FAMILIES: Record<PresetId, Partial<Record<Axis, number[]>>> = {
  ellipsoid: { z: [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1], x: [0], y: [0] },
  sphere: { z: [-1.5, -1, -0.5, 0, 0.5, 1, 1.5], x: [0], y: [0] },
  cone: { z: [-3, -2.25, -1.5, -0.75, 0, 0.75, 1.5, 2.25, 3], x: [0], y: [0] },
  paraboloid: { z: [0, 0.5, 1, 1.5, 2, 2.5, 3], x: [-1, 0, 1], y: [-1, 0, 1] },
  saddle: { x: [-1.7, -1.275, -0.85, -0.425, 0, 0.425, 0.85, 1.275, 1.7], y: [-1.7, -1.275, -0.85, -0.425, 0, 0.425, 0.85, 1.275, 1.7], z: [0] },
  hyperboloid1: { z: [-2.5, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5], x: [-1, 0, 1], y: [-1, 0, 1] },
  hyperboloid2: { z: [-3, -2.5, -2, -1.5, -1.25, -1, 1, 1.25, 1.5, 2, 2.5, 3], x: [0], y: [0] },
  cylinder: { z: [-3, -1.5, 0, 1.5, 3], x: [-1, -0.5, 0, 0.5, 1], y: [-1, -0.5, 0, 0.5, 1] },
  pcyl: { x: [-1.5, -1, -0.5, 0, 0.5, 1, 1.5], y: [-3, -1.5, 0, 1.5, 3] },
};

/**
 * the wireframe of a graph surface is drawn only over a rectangle of the floor, |x| ≤ lim[0], |y| ≤ lim[1], chosen so the
 * whole patch stays inside the box (the saddle over |x|, |y| ≤ 1.7 has |z| ≤ 2.89): every wire then runs from edge to
 * edge of the patch, and the saddle reads as a saddle. (Clipping each section to a square of its own plane, as the
 * sampler does, cut the parabolas at different heights and left a tangle.)
 */
const WIRE_PATCH: Partial<Record<PresetId, [number, number]>> = { saddle: [1.7, 1.7], pcyl: [1.5, 3] };

/** the parts of the polylines over the floor rectangle |x| ≤ lx, |y| ≤ ly; a crossing is interpolated on its segment */
function clipToPatch(runs: Vec3[][], lx: number, ly: number): Vec3[][] {
  const inside = (p: Vec3) => Math.abs(p[0]) <= lx + 1e-9 && Math.abs(p[1]) <= ly + 1e-9;
  /** the point of the segment a → b (a inside, b outside) on the edge of the rectangle */
  const edge = (a: Vec3, b: Vec3): Vec3 => {
    let t = 1;
    if (Math.abs(b[0]) > lx) t = Math.min(t, (Math.sign(b[0]) * lx - a[0]) / (b[0] - a[0]));
    if (Math.abs(b[1]) > ly) t = Math.min(t, (Math.sign(b[1]) * ly - a[1]) / (b[1] - a[1]));
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])];
  };
  const out: Vec3[][] = [];
  for (const run of runs) {
    if (run.length === 1) {
      if (inside(run[0])) out.push(run);
      continue;
    }
    let part: Vec3[] = [];
    for (let i = 0; i < run.length; i++) {
      const p = run[i];
      if (inside(p)) {
        if (part.length === 0 && i > 0) part.push(edge(p, run[i - 1]));
        part.push(p);
      } else if (part.length) {
        part.push(edge(part[part.length - 1], p));
        out.push(part);
        part = [];
      }
    }
    if (part.length > 1) out.push(part);
  }
  return out;
}

/** a left-to-right island inside Hebrew text (U+2066 … U+2069), with no-break spaces so it never wraps */
const ltr = (s: string) => `⁦${s.replace(/ /g, ' ')}⁩`;

const TASK_LABEL: Record<string, string> = {
  'ellipsoid-point': `מצאו מישור חתך שבו החתך של האליפסואיד מתכווץ לנקודה בודדת. באיזה ערך של ${ltr('c')} זה קורה, ובאיזה מישורים?`,
  'cone-lines': `חתכו את החרוט במישור ${ltr('y = 0')} (או ${ltr('x = 0')}). מה מתקבל?`,
  'no-intersection': `מצאו מישור חתך שאינו פוגש את ההיפרבולואיד הדו-יריעתי. אילו ערכים של ${ltr('c')} מתאימים?`,
  'saddle-lines': `מצאו חתך של האוכף שהוא זוג ישרים. באיזה מישור זה קורה?`,
  'hyperboloid-lines': `מצאו מישור חתך שחותך את ההיפרבולואיד החד-יריעתי בזוג ישרים. רמז: לא אחד מהמישורים האופקיים.`,
  'mystery-identify': `חתכו את המשטח הנסתר במישורים שונים, ובחרו מהרשימה את שמו.`,
};

const clampC = (c: number) => Math.min(BOX, Math.max(-BOX, Math.round(c * 4) / 4));
const clampEl = (e: number) => Math.min(85, Math.max(0, e));
const wrapAz = (a: number) => ((a % 360) + 360) % 360;
const isAxis = (x: unknown): x is Axis => x === 'x' || x === 'y' || x === 'z';

function fresh(p: SurfaceLabProps): State {
  const surface = p.surface && presetById(p.surface) ? p.surface : 'ellipsoid';
  const axis = isAxis(p.axis) ? p.axis : 'z';
  const c = typeof p.c === 'number' && Number.isFinite(p.c) ? clampC(p.c) : 0;
  const accumulate = p.mystery ? true : (p.accumulate ?? false);
  return {
    surface,
    axis,
    c,
    accumulate,
    visited: [{ axis, c, own: false }],
    answer: null,
    az: typeof p.az === 'number' ? wrapAz(p.az) : 40,
    el: typeof p.el === 'number' ? clampEl(p.el) : 22,
  };
}

const preset = (s: State): Preset => presetById(s.surface) as Preset;

function infoOf(s: State): ConicInfo {
  return classifyConic(traceConic(preset(s).q, s.axis, s.c));
}

/** whether the state has the property a task asks for (only ever asked after the reader's own change) */
function taskHolds(task: string, s: State, mystery: boolean): boolean {
  const kind = infoOf(s).kind;
  switch (task) {
    case 'ellipsoid-point':
      return (s.surface === 'ellipsoid' || s.surface === 'sphere') && kind === 'point';
    case 'cone-lines':
      return s.surface === 'cone' && s.axis !== 'z' && s.c === 0;
    case 'no-intersection':
      return s.surface === 'hyperboloid2' && kind === 'empty';
    case 'saddle-lines':
      return s.surface === 'saddle' && kind === 'two-lines';
    case 'hyperboloid-lines':
      return s.surface === 'hyperboloid1' && kind === 'two-lines';
    case 'mystery-identify':
      return mystery && s.answer === s.surface && s.visited.filter((v) => v.own).length >= 2;
    default:
      return false;
  }
}

const TASK_KEYS: Record<string, Key[]> = {
  'ellipsoid-point': ['axis', 'c'],
  'cone-lines': ['axis', 'c'],
  'no-intersection': ['axis', 'c'],
  'saddle-lines': ['axis', 'c'],
  'hyperboloid-lines': ['axis', 'c'],
  'mystery-identify': ['answer'],
};

/* ---------- text ---------- */

function typeText(info: ConicInfo): string {
  switch (info.kind) {
    case 'circle':
      return `מעגל ברדיוס ${ltr(fmtSqrtRational(info.ra * info.ra))}`;
    case 'ellipse':
      return 'אליפסה';
    case 'hyperbola':
      return 'היפרבולה';
    case 'parabola':
      return 'פרבולה';
    case 'two-lines':
      return 'זוג ישרים נחתכים';
    case 'parallel-lines':
      return 'זוג ישרים מקבילים';
    case 'double-line':
      return 'ישר אחד (שני הישרים מתלכדים)';
    case 'line':
      return 'ישר';
    case 'point':
      return 'נקודה בודדת';
    case 'plane':
      return 'כל המישור';
    default:
      return 'אין חתך';
  }
}

function detailText(info: ConicInfo, names: readonly [string, string]): string | null {
  const [u, v] = [ltr(names[0]), ltr(names[1])];
  const pt = (a: number, b: number) => ltr(`(${fmtRational(a)}, ${fmtRational(b)})`);
  if (info.kind === 'ellipse') return `חצאי הצירים: ${ltr(fmtSqrtRational(info.ra * info.ra))} בכיוון ${u}, ${ltr(fmtSqrtRational(info.rb * info.rb))} בכיוון ${v}`;
  if (info.kind === 'circle') return `המרכז ${pt(info.u0, info.v0)}`;
  if (info.kind === 'hyperbola') return `הענפים נפתחים בכיוון ${info.transverse === 'u' ? u : v}, המרכז ${pt(info.u0, info.v0)}`;
  if (info.kind === 'parabola') {
    const dir = info.axis === 'v' ? ((info.p as number) > 0 ? `כלפי ${v} חיובי` : `כלפי ${v} שלילי`) : (info.p as number) > 0 ? `כלפי ${u} חיובי` : `כלפי ${u} שלילי`;
    return `נפתחת ${dir}, הקודקוד ${pt(info.u0, info.v0)}`;
  }
  if (info.kind === 'point') return `הנקודה ${pt(info.u0, info.v0)}`;
  return null;
}

const planeName = (axis: Axis, c: number) => `${axis} = ${fmtRational(c)}`;

/* ---------- canvas helpers ---------- */

type Pt = [number, number];

function halo(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, p: Palette, size = 15, italic = true) {
  ctx.save();
  ctx.font = `${italic ? 'italic ' : ''}700 ${size}px ${p.fontUi}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4;
  ctx.strokeStyle = withAlpha(p.paper, 0.85);
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function strokeSeg(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, color: string, width: number, alpha: number, dash: number[] = []) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.setLineDash(dash);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
  ctx.restore();
}

function ring(ctx: CanvasRenderingContext2D, [x, y]: Pt, r: number, fill: string | null, stroke: string, p: Palette, width = 2) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill ?? p.paper;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

/** the one-line description of what the 3D canvas shows, for the accessible label */
function describe(s: State, mystery: boolean): string {
  const info = infoOf(s);
  const revealed = !mystery || s.answer === s.surface;
  const head = revealed ? `משטח: ${NAME[s.surface as PresetId]}, ${preset(s).eq}.` : 'משטח נסתר, מוצגים רק החתכים שביקרתם בהם.';
  const cut = `מישור החתך ${planeName(s.axis, s.c)}: ${typeText(info)}.`;
  return `${head} ${cut}`;
}

export default function SurfaceLab(props: SurfaceLabProps) {
  const mystery = props.mystery ?? false;
  const show = (g: string) => (props.controls ? props.controls.includes(g) : true);
  const offered: PresetId[] = useMemo(() => {
    const ids = (props.surfaces && props.surfaces.length ? props.surfaces : [props.surface ?? 'ellipsoid']).filter((x) => presetById(x)) as PresetId[];
    return ids.length ? ids : ['ellipsoid'];
  }, [props.surfaces, props.surface]);
  const [s, setS] = useState<State>(() => fresh(props));
  const cur = useRef(s);
  cur.current = s;
  const drag = useRef<{ x: number; y: number } | null>(null);
  const ctxRef = useRef<Ctx>({ touched: new Set(), wasOff: new Set(), baseline: s });
  const [live, setLive] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: TASK_LABEL[id] ?? id }));

  const apply = (patch: Partial<State>): State => {
    const next = { ...cur.current, ...patch };
    cur.current = next;
    setS(next);
    return next;
  };

  /** record a cut in the visited list (a repeat only upgrades `own`) */
  const withVisit = (st: State, own: boolean): State => {
    const i = st.visited.findIndex((v) => v.axis === st.axis && v.c === st.c);
    if (i >= 0) {
      if (own && !st.visited[i].own) return { ...st, visited: st.visited.map((v, k) => (k === i ? { ...v, own: true } : v)) };
      return st;
    }
    return { ...st, visited: [...st.visited, { axis: st.axis, c: st.c, own }].slice(-80) };
  };

  /** the reader's own change of surface / plane / answer: the only place a task can tick */
  const userSet = (patch: Partial<State>) => {
    const cx = ctxRef.current;
    const before = cur.current;
    for (const k of ['surface', 'axis', 'c', 'answer'] as Key[]) if (k in patch && patch[k] !== before[k]) cx.touched.add(k);
    let next: State = { ...before, ...patch };
    if (patch.surface !== undefined && patch.surface !== before.surface) next = { ...next, visited: [], answer: null };
    if (patch.accumulate === true && !before.accumulate) next = { ...next, visited: [] };
    if (next.accumulate || mystery) next = withVisit(next, true);
    cur.current = next;
    setS(next);
    // choosing another surface is not finding a section: the plane the reader happens to be on is the new baseline,
    // and a task about the plane ticks only after the reader moves the plane (away and back, if it already fits)
    if (patch.surface !== undefined && patch.surface !== before.surface) {
      ctxRef.current = { touched: new Set(), wasOff: new Set(), baseline: next };
      return next;
    }
    for (const task of props.tasks ?? []) {
      const holds = taskHolds(task, next, mystery);
      if (!holds) {
        cx.wasOff.add(task);
        continue;
      }
      const keys = TASK_KEYS[task] ?? [];
      if (!keys.some((k) => cx.touched.has(k))) continue;
      if (taskHolds(task, cx.baseline, mystery) && !cx.wasOff.has(task)) continue;
      markTask(`${props.id}:${task}`);
    }
    return next;
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        const patch: Partial<State> = {};
        if (typeof st.surface === 'string' && presetById(st.surface)) patch.surface = st.surface;
        if (isAxis(st.axis)) patch.axis = st.axis;
        if (typeof st.c === 'number' && Number.isFinite(st.c)) patch.c = clampC(st.c);
        if (typeof st.accumulate === 'boolean') patch.accumulate = st.accumulate;
        if (typeof st.az === 'number') patch.az = wrapAz(st.az);
        if (typeof st.el === 'number') patch.el = clampEl(st.el);
        let next: State = { ...cur.current, ...patch };
        if (patch.surface !== undefined && patch.surface !== cur.current.surface) next = { ...next, visited: [], answer: null };
        if (patch.accumulate === true && !cur.current.accumulate) next = { ...next, visited: [] };
        if (next.accumulate || mystery) next = withVisit(next, false);
        cur.current = next;
        setS(next);
        setFeedback(null);
        // a state a text step produced never ticks a task: forget the reader's moves and re-base
        ctxRef.current = { touched: new Set(), wasOff: new Set(), baseline: next };
      }),
    [props.id],
  );

  /* ---------- derived ---------- */
  const pr = preset(s);
  const conic = traceConic(pr.q, s.axis, s.c);
  const info = classifyConic(conic);
  const names = planeVars(s.axis);
  const revealed = !mystery || s.answer === s.surface;
  const [uN, vN] = names;

  const wire = useMemo(() => {
    const fam = FAMILIES[pr.id as PresetId];
    const out: { axis: Axis; c: number; runs: Vec3[][] }[] = [];
    const patch = WIRE_PATCH[pr.id as PresetId];
    for (const ax of AXES) {
      for (const c of fam[ax] ?? []) {
        const runs = sampleTrace(pr.q, ax, c, BOX, 160);
        out.push({ axis: ax, c, runs: patch ? clipToPatch(runs, patch[0], patch[1]) : runs });
      }
    }
    return out;
  }, [pr]);

  /* ---------- 3D canvas ---------- */
  const draw3 = ({ ctx, view, palette: p }: FrameInfo) => {
    const cam = camera(s.az, s.el);
    const R = 5.1;
    const scale = (Math.min(view.w, view.h) * 0.5 * 0.94) / R;
    const P = makeProjector(cam, { cx: view.w / 2, cy: view.h / 2 + 4, scale });
    const px = (v: Vec3): Pt => {
      const q = P(v);
      return [q[0], q[1]];
    };
    const depthA = (v: Vec3) => {
      const d = v[0] * cam.toward[0] + v[1] * cam.toward[1] + v[2] * cam.toward[2];
      return Math.min(1, Math.max(0.28, 0.28 + (0.72 * (d + 5)) / 10));
    };
    const O = px([0, 0, 0]);

    // the box the surface is clipped to
    const corners: Vec3[] = [];
    for (const i of [-1, 1]) for (const j of [-1, 1]) for (const k of [-1, 1]) corners.push([i * BOX, j * BOX, k * BOX]);
    for (let a = 0; a < 8; a++) {
      for (let b = a + 1; b < 8; b++) {
        const diff = [0, 1, 2].filter((m) => corners[a][m] !== corners[b][m]).length;
        if (diff === 1) strokeSeg(ctx, px(corners[a]), px(corners[b]), p.rule, 1, 0.9);
      }
    }

    // axes with ticks and names
    const AXV: Vec3[] = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    const L = BOX + 0.8;
    AXV.forEach((e, m) => {
      const neg = px([-L * e[0], -L * e[1], -L * e[2]]);
      const end = px([L * e[0], L * e[1], L * e[2]]);
      strokeSeg(ctx, neg, O, p.ink3, 1.2, 0.8, [5, 4]);
      arrow(ctx, O[0], O[1], end[0], end[1], { color: p.ink3, width: 1.5, head: 8 });
      const lab = px([(L + 0.5) * e[0], (L + 0.5) * e[1], (L + 0.5) * e[2]]);
      halo(ctx, AXES[m], lab[0], lab[1], p.ink2, p, 15);
    });

    const drawRuns = (runs: Vec3[][], color: string, width: number, alpha: number, depthFade: boolean, backDash: boolean, normalOf?: (v: Vec3) => Vec3) => {
      for (const run of runs) {
        if (run.length === 1) {
          ring(ctx, px(run[0]), 4, color, p.paper, p, 1.5);
          continue;
        }
        for (let i = 1; i < run.length; i++) {
          const a = run[i - 1];
          const b = run[i];
          const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
          let back = false;
          if (backDash && normalOf) {
            const n = normalOf(mid);
            back = n[0] * cam.toward[0] + n[1] * cam.toward[1] + n[2] * cam.toward[2] < 0;
          }
          strokeSeg(ctx, px(a), px(b), color, width, (depthFade ? depthA(mid) : 1) * alpha * (back ? 0.55 : 1), back ? [4, 4] : []);
        }
      }
    };

    // the wireframe of the surface
    if (!mystery) for (const w of wire) drawRuns(w.runs, p.curve, w.c === 0 ? 1.9 : 1.1, 0.95, true, pr.closed, (v) => gradient(pr.q, v));

    // the cutting plane: a translucent rectangle
    const [pu, pv] = planeVars(s.axis);
    const idx = (n: Axis) => (n === 'x' ? 0 : n === 'y' ? 1 : 2);
    const corner = (a: number, b: number): Vec3 => {
      const v: [number, number, number] = [0, 0, 0];
      v[idx(s.axis)] = s.c;
      v[idx(pu)] = a * BOX;
      v[idx(pv)] = b * BOX;
      return v;
    };
    const quad = [corner(1, 1), corner(-1, 1), corner(-1, -1), corner(1, -1)].map(px);
    ctx.save();
    ctx.beginPath();
    quad.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = withAlpha(p.delta, 0.16);
    ctx.fill();
    ctx.strokeStyle = withAlpha(p.delta, 0.9);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    const tag = quad.reduce((best, q) => (q[0] > best[0] ? q : best), quad[0]);
    const tx = Math.min(view.w - 34, Math.max(34, tag[0] + 6));
    const ty = Math.min(view.h - 12, Math.max(12, tag[1] - 11));
    halo(ctx, planeName(s.axis, s.c), tx, ty, p.delta, p, 14, false);

    // the sections visited so far (thin accent), then the current one (bold)
    if (s.accumulate || mystery) {
      for (const v of s.visited) {
        if (v.axis === s.axis && v.c === s.c) continue;
        drawRuns(sampleTrace(pr.q, v.axis, v.c, BOX, 160), p.accent, 1.5, 0.7, false, false);
      }
    }
    drawRuns(sampleTrace(pr.q, s.axis, s.c, BOX, 200), p.accent, 3.4, 1, false, false);
  };

  /* ---------- 2D canvas ---------- */
  const draw2 = ({ ctx, view, palette: p }: FrameInfo) => {
    const W = BOX + 0.9;
    const sc = Math.min(view.w, view.h) / (2 * W);
    const cx = view.w / 2;
    const cy = view.h / 2;
    const X = (u: number) => cx + u * sc;
    const Y = (v: number) => cy - v * sc;
    // grid at the integers and the window the 3D view shows
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = p.rule;
    ctx.beginPath();
    for (let i = -BOX; i <= BOX; i++) {
      ctx.moveTo(X(i), Y(-BOX));
      ctx.lineTo(X(i), Y(BOX));
      ctx.moveTo(X(-BOX), Y(i));
      ctx.lineTo(X(BOX), Y(i));
    }
    ctx.stroke();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = p.ink3;
    ctx.strokeRect(X(-BOX), Y(BOX), 2 * BOX * sc, 2 * BOX * sc);
    ctx.restore();
    // axes
    arrow(ctx, X(-W + 0.15), Y(0), X(W - 0.05), Y(0), { color: p.ink3, width: 1.5, head: 8 });
    arrow(ctx, X(0), Y(-W + 0.15), X(0), Y(W - 0.05), { color: p.ink3, width: 1.5, head: 8 });
    halo(ctx, uN, X(W - 0.3), Y(0) + 15, p.ink2, p, 15);
    halo(ctx, vN, X(0) + 13, Y(W - 0.3), p.ink2, p, 15);
    ctx.save();
    ctx.font = `600 11px ${p.fontUi}`;
    ctx.fillStyle = p.ink3;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = -BOX; i <= BOX; i++) {
      if (i === 0) continue;
      ctx.fillText(fmtRational(i), X(i), Y(0) + 4);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(fmtRational(i), X(0) - 5, Y(i));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
    }
    ctx.restore();

    // asymptotes of a hyperbola (thin dashed): not part of the section
    if (info.kind === 'hyperbola') {
      const m = info.rb / info.ra;
      for (const sg of [1, -1]) {
        strokeSeg(ctx, [X(-W), Y(info.v0 - sg * m * (-W - info.u0))], [X(W), Y(info.v0 - sg * m * (W - info.u0))], p.ink3, 1.2, 0.85, [3, 4]);
      }
    }
    // the section
    const runs = sampleConic(conic, BOX, 240);
    for (const run of runs) {
      if (run.length === 1) {
        ring(ctx, [X(run[0][0]), Y(run[0][1])], 6.5, p.accent, p.paper, p, 2.2);
        continue;
      }
      ctx.save();
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 3.4;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      run.forEach(([u, v], i) => (i ? ctx.lineTo(X(u), Y(v)) : ctx.moveTo(X(u), Y(v))));
      ctx.stroke();
      ctx.restore();
    }
    if (info.kind === 'empty') {
      halo(ctx, 'אין חתך', cx, cy - 60, p.ink, p, 22, false);
      halo(ctx, `המישור ${ltr(planeName(s.axis, s.c))} לא פוגש את המשטח`, cx, cy - 34, p.ink2, p, 13, false);
    }
  };

  const c3 = useFigureCanvas(draw3, { worldWidth: 1, worldHeight: 1, animate: false });
  const c2 = useFigureCanvas(draw2, { worldWidth: 1, worldHeight: 1, animate: false });
  useEffect(() => {
    c3.invalidate();
    c2.invalidate();
  }, [s]);

  const onPointerDown = (e: PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    drag.current = { x: e.clientX, y: e.clientY };
    apply({ az: wrapAz(cur.current.az - dx * 0.5), el: clampEl(cur.current.el + dy * 0.4) });
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const k = e.shiftKey ? 15 : 5;
    if (e.key === 'ArrowLeft') apply({ az: wrapAz(cur.current.az - k) });
    else if (e.key === 'ArrowRight') apply({ az: wrapAz(cur.current.az + k) });
    else if (e.key === 'ArrowUp') apply({ el: clampEl(cur.current.el + k) });
    else if (e.key === 'ArrowDown') apply({ el: clampEl(cur.current.el - k) });
    else return;
    e.preventDefault();
  };

  const reset = () => {
    const f = fresh(props);
    cur.current = f;
    ctxRef.current = { touched: new Set(), wasOff: new Set(), baseline: f };
    setS(f);
    setFeedback(null);
    setLive('האיור אופס.');
  };

  const announce = (st: State) => {
    const i = infoOf(st);
    setLive(`${planeName(st.axis, st.c)}: ${typeText(i)}`);
  };

  const chooseAxis = (a: Axis) => announce(userSet({ axis: a }));
  const chooseC = (c: number) => announce(userSet({ c: clampC(c) }));
  const chooseSurface = (id: string) => {
    setFeedback(null);
    announce(userSet({ surface: id }));
  };
  const toggleAcc = (on: boolean) => userSet({ accumulate: on });
  const clearVisited = () => apply({ visited: [{ axis: cur.current.axis, c: cur.current.c, own: true }] });
  const answer = (id: string) => {
    const next = userSet({ answer: id });
    if (id === cur.current.surface) {
      const n = next.visited.filter((v) => v.own).length;
      setFeedback(n >= 2 ? `נכון: ${NAME[id as PresetId]}. המשוואה נחשפה למעלה.` : `נכון, אבל נחשו מעט: חתכו בעוד מישורים ובדקו.`);
    } else setFeedback(`לא נכון: ${NAME[id as PresetId]} לא מתאים לחתכים שראיתם. חתכו עוד מישורים (גם במישורים אנכיים) ונסו שוב.`);
  };

  /* ---------- readout ---------- */
  const exact = fmtConicEquation(conic, names);
  const lines = fmtLines(conic, names);
  const detail = detailText(info, names);
  const Row = (p: { id: string; label: string; strong?: boolean; children: ComponentChildren }) => (
    <div class={`sf-row${p.strong ? ' strong' : ''}`} data-readout={p.id}>
      <span class="sf-lab">{p.label}</span>
      <span class="q sf-math" dir="ltr">
        {p.children}
      </span>
    </div>
  );

  const readout = (
    <div class="sf-wrap">
      <div class="sf-plane ltr-space">
        <canvas
          ref={c2.canvasRef}
          role="img"
          aria-label={`החתך במישור ${planeName(s.axis, s.c)}, מצויר במישור שלו עם הצירים ${uN} ו-${vN}: ${typeText(info)}.`}
        />
      </div>
      <div class="sf-rows">
        {revealed && (
          <Row id="surface" label={`${NAME[pr.id as PresetId]}:`}>
            {pr.eq}
          </Row>
        )}
        {!revealed && (
          <div class="sf-row" data-readout="surface">
            <span class="sf-note">משטח נסתר: זהו אותו לפי החתכים.</span>
          </div>
        )}
        <Row id="plane" label="מישור החתך:" strong>
          {planeName(s.axis, s.c)}
        </Row>
        {revealed && (
          <Row id="substitute" label="מציבים:">
            {substitutePlane(pr.eq, s.axis, s.c)}
          </Row>
        )}
        <Row id="section" label="משוואת החתך:" strong>
          {lines && info.kind !== 'empty' ? `${exact},  ${lines}` : exact}
        </Row>
        <div class="sf-row" data-readout="type">
          <span class="sf-lab">סוג החתך:</span>
          <span class="sf-note">{typeText(info)}</span>
        </div>
        {detail && (
          <div class="sf-row" data-readout="detail">
            <span class="sf-lab">{detail}</span>
          </div>
        )}
        {info.kind === 'empty' && (
          <div class="sf-row" data-readout="empty">
            <span class="sf-lab">אין ערכים ממשיים שמקיימים את המשוואה, ולכן המישור לא פוגש את המשטח.</span>
          </div>
        )}
      </div>
    </div>
  );

  /* ---------- controls ---------- */
  const options: PresetId[] = (() => {
    const base = (props.options ?? DEFAULT_OPTIONS).filter((x) => presetById(x)) as PresetId[];
    return base.includes(s.surface as PresetId) ? base : [...base, s.surface as PresetId];
  })();

  const controls = (
    <>
      {!mystery && show('surface') && offered.length > 1 && (
        <label class="sf-select">
          <span class="sf-lab">משטח</span>
          <select value={s.surface} onChange={(e) => chooseSurface((e.currentTarget as HTMLSelectElement).value)}>
            {offered.map((id) => (
              <option value={id} key={id}>
                {NAME[id]}
              </option>
            ))}
          </select>
        </label>
      )}
      {show('axis') && (
        <div class="group" role="group" aria-label="כיוון מישור החתך">
          {AXES.map((a) => (
            <Toggle
              key={a}
              label={
                <>
                  <bdi dir="ltr">{a} = c</bdi>
                </>
              }
              on={s.axis === a}
              onChange={() => chooseAxis(a)}
            />
          ))}
        </div>
      )}
      {show('c') && (
        <div class="sf-views">
          <Slider label="מקום המישור" value={s.c} min={-BOX} max={BOX} step={0.25} format={(x) => planeName(s.axis, x)} onChange={chooseC} />
        </div>
      )}
      {!mystery && show('accumulate') && (
        <div class="group" role="group" aria-label="צבירת חתכים">
          <Toggle label="צברו את החתכים שביקרתם בהם" on={s.accumulate} swatch="var(--accent)" onChange={toggleAcc} />
          {s.accumulate && (
            <button type="button" class="toggle" data-action="clear" onClick={clearVisited}>
              נקו את החתכים
            </button>
          )}
        </div>
      )}
      {mystery && (
        <div class="sf-guess">
          <span class="sf-lab">מה המשטח?</span>
          <div class="group" role="group" aria-label="בחרו את שם המשטח">
            {options.map((id) => (
              <Toggle key={id} label={NAME[id]} on={s.answer === id} onChange={() => answer(id)} />
            ))}
          </div>
          {feedback && (
            <p class="sf-feedback" data-feedback={s.answer === s.surface ? 'ok' : 'no'}>
              {feedback}
            </p>
          )}
        </div>
      )}
      {show('views') && (
        <div class="sf-views">
          <Slider label="סיבוב המבט" value={s.az} min={0} max={359} step={1} format={(x) => `${Math.round(x)}°`} onChange={(x) => apply({ az: wrapAz(x) })} />
          <Slider label="הטיית המבט" value={s.el} min={0} max={85} step={1} format={(x) => `${Math.round(x)}°`} onChange={(x) => apply({ el: clampEl(x) })} />
        </div>
      )}
      {show('views') && <p class="hint hand">גררו את האיור כדי לסובב את המבט.</p>}
    </>
  );

  return (
    <SimShell
      fig={props.id}
      label={`איור חי: משטח במרחב כשלד של חתכים, בהטלה אקסונומטרית, עם מישור חתך. ${describe(s, mystery)} במקלדת: חצים מסובבים את המבט.`}
      canvasRef={c3.canvasRef}
      aspect={1.2}
      live={live}
      tasks={tasks}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      cursor="grab"
      onReset={reset}
      readout={readout}
      controls={controls}
    />
  );
}
