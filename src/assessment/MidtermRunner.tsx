/**
 * The midterm (מבחן אמצע, chapters 1–8). Three phases in one island:
 *   intro   - the rules, the paper (א, ב, ג…), the timer (on by default);
 *   running - five exam questions; answer boxes for the auto-graded parts, a draft box for the open
 *             parts (the solution is written on paper, as in a written exam); no hints, no feedback;
 *   grading - the auto-graded parts are graded at once; each open part opens its model solution and
 *             rubric for self-assessment. The grade is the sum of the four best question scores.
 *
 * Attempts are recorded with kind 'test': the auto parts on submission, each open part when its
 * self-check is finished (OpenPart records it).
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { AutoPart, ExamQuestion, Part } from '~/content.config';
import { recordAttempt } from '~/progress/store';
import { grade, probesOf, type Verdict } from './check';
import { isOpen, partId, partQuestion, type Simple } from './exam';
import { lessonOfObjective } from './ids';
import { MIDTERM_BLOCKS, MIDTERM_COUNTED, MIDTERM_MINUTES, midtermGrade, midtermPlace, paperLetter } from './midterm';
import type { MidtermPaper } from './midterm-bank';
import OpenPart from './OpenPart';
import { emptyDraft, toAnswer, AnswerArea, type Draft } from './QuestionCard';
import './question.css';

interface Props {
  papers: MidtermPaper[];
  lessons: Record<string, { title: string; href: string }>;
  misconceptions: Record<string, { title: string; truth: string; href: string; label: string }>;
  meHref: string;
  homeHref: string;
}

interface AutoResult {
  answered: boolean;
  verdict: Verdict | null;
  earned: number;
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  return `${h}:${m}:${String(s % 60).padStart(2, '0')}`;
};

const blockTitle = (q: ExamQuestion) => MIDTERM_BLOCKS.find((b) => b.k === midtermPlace(q.id)?.block)?.title ?? '';
const round1 = (x: number) => Math.round(x * 10) / 10;

export default function MidtermRunner({ papers, lessons, misconceptions, meHref, homeHref }: Props) {
  const [phase, setPhase] = useState<'intro' | 'running' | 'grading'>('intro');
  const [paperNo, setPaperNo] = useState(papers[0]?.paper ?? 1);
  const [timed, setTimed] = useState(true);
  const [minutes, setMinutes] = useState(MIDTERM_MINUTES);
  // answers live in refs while the test runs: typing re-renders one answer box, never the whole paper
  const drafts = useRef<Record<string, Draft>>({});
  const notes = useRef<Record<string, string>>({});
  const [deadline, setDeadline] = useState<number | null>(null);
  const [auto, setAuto] = useState<Record<string, AutoResult>>({});
  const [open, setOpen] = useState<Record<string, number>>({});
  const submitRef = useRef<() => void>(() => {});

  // ?paper=2 chooses a paper (a link from elsewhere, or a test)
  useEffect(() => {
    const p = Number(new URLSearchParams(location.search).get('paper'));
    if (papers.some((x) => x.paper === p)) setPaperNo(p);
  }, []);

  const paper = papers.find((p) => p.paper === paperNo) ?? papers[0];
  const questions = paper?.questions ?? [];
  const autoParts = (q: ExamQuestion) => q.parts.filter((p): p is AutoPart => !isOpen(p));

  const start = () => {
    const d: Record<string, Draft> = {};
    for (const q of questions) for (const p of autoParts(q)) d[partId(q, p)] = emptyDraft(partQuestion(q, p));
    drafts.current = d;
    notes.current = {};
    setAuto({});
    setOpen({});
    setDeadline(timed ? Date.now() + minutes * 60_000 : null);
    setPhase('running');
    window.scrollTo(0, 0);
  };

  const submit = () => {
    const rs: Record<string, AutoResult> = {};
    for (const q of questions) {
      for (const p of autoParts(q)) {
        const pq = partQuestion(q, p);
        const a = toAnswer(drafts.current[pq.id], pq);
        const ready = a !== null && !('error' in a);
        const verdict = ready ? grade(pq, a) : null;
        const correct = verdict?.correct === true;
        recordAttempt({
          qid: pq.id,
          lesson: null,
          kind: 'test',
          objectives: p.objectives,
          probes: probesOf(pq),
          misconception: verdict?.misconception ?? null,
          correct,
          confident: null,
          hints: 0,
        });
        rs[pq.id] = { answered: ready, verdict, earned: correct ? p.points : 0 };
      }
    }
    setAuto(rs);
    setDeadline(null);
    setPhase('grading');
    window.scrollTo(0, 0);
  };
  submitRef.current = submit;

  if (!paper) return <p>מבחן האמצע עוד לא מוכן.</p>;

  /* ------------------------------------------------------------------ intro */
  if (phase === 'intro') {
    return (
      <div class="test-intro" data-phase="intro">
        <ul class="p-path">
          <li>
            <strong>חמש שאלות</strong>, אחת מכל חלק של החומר, <span class="ltr">25</span> נקודות כל אחת. עונים על{' '}
            <strong>ארבע</strong>: הציון הוא סכום ארבע השאלות הטובות, מתוך <span class="ltr">100</span>.
          </li>
          <li>
            סעיף עם תיבת תשובה נבדק אוטומטית בהגשה. סעיף של <strong>פתרון מלא</strong> כותבים על דף, כמו במבחן בכתב (או בתיבת
            הטיוטה). אחרי ההגשה משווים לפתרון לדוגמה ומסמנים במחוון מה עשיתם נכון.
          </li>
          <li>
            תשובה מספרית: עדיף ערך מדויק (<bdi dir="ltr">3π/8</bdi>, <bdi dir="ltr">2√10/3</bdi>, <bdi dir="ltr">ln 2</bdi>), והוא
            תמיד מתקבל; מספר עשרוני צריך 4 ספרות משמעותיות לפחות. נוסחה: מקלידים רק את הביטוי (בלי <bdi dir="ltr">y =</bdi>),
            וכל צורה שקולה מתקבלת.
          </li>
          <li>אין רמזים ואין משוב עד ההגשה.</li>
        </ul>
        <fieldset class="test-options">
          <legend>גרסה</legend>
          {papers.map((p) => (
            <label key={p.paper}>
              <input type="radio" name="mid-paper" checked={p.paper === paperNo} onChange={() => setPaperNo(p.paper)} />
              גרסה {paperLetter(p.paper)}
            </label>
          ))}
        </fieldset>
        <div class="test-options">
          <label>
            <input type="checkbox" checked={timed} onChange={(e) => setTimed((e.target as HTMLInputElement).checked)} />
            מבחן עם שעון
          </label>
          {timed && (
            <label>
              משך המבחן בדקות
              <input
                type="number"
                min={30}
                max={300}
                value={minutes}
                onInput={(e) => setMinutes(Math.min(300, Math.max(30, Number((e.target as HTMLInputElement).value) || MIDTERM_MINUTES)))}
              />
            </label>
          )}
          <p class="p-note">
            <span class="ltr">{MIDTERM_MINUTES}</span> דקות הן הצעה: הסילבוס לא קובע את אורך מבחן האמצע. השאלות מקוריות, בסגנון
            מבחן במתמטיקה שימושית 1, ולא נלקחו ממבחן אמיתי. אם השעון נגמר, המבחן מוגש כפי שהוא.
          </p>
        </div>
        <div class="p-links">
          <button type="button" class="btn primary" onClick={start}>
            התחלת המבחן
          </button>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ running */
  if (phase === 'running') {
    return (
      <div class="test-run" data-phase="running" data-paper={paper.paper}>
        <div class="test-bar">
          <span>גרסה {paperLetter(paper.paper)} · עונים על ארבע מתוך חמש</span>
          {deadline !== null && <Clock deadline={deadline} onExpire={() => submitRef.current()} />}
          <button type="button" class="btn primary" onClick={submit}>
            הגשת המבחן
          </button>
        </div>
        {questions.map((q, i) => (
          <article key={q.id} class="exam mid-q" data-qid={q.id} data-type="exam">
            <QuestionHead q={q} i={i} />
            <ol class="exam-parts">
              {q.parts.map((p) => {
                const id = partId(q, p);
                return (
                  <li key={p.label} class="b-part" data-part={p.label}>
                    <PartHead p={p} />
                    <div class={`qcard ${isOpen(p) ? 'open-part' : ''}`} data-qid={id} data-type={p.type}>
                      <div class="q-prompt" dangerouslySetInnerHTML={{ __html: p.prompt }} />
                      {isOpen(p) ? (
                        <label class="open-write">
                          <span class="open-write-label">פתרון מלא: כתבו על דף, או כאן (לא חובה).</span>
                          <textarea
                            rows={4}
                            spellcheck={false}
                            onInput={(e) => (notes.current[id] = (e.target as HTMLTextAreaElement).value)}
                          />
                        </label>
                      ) : (
                        <AutoAnswer q={partQuestion(q, p)} store={drafts.current} />
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </article>
        ))}
        <div class="p-links">
          <button type="button" class="btn primary" onClick={submit}>
            הגשת המבחן
          </button>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ grading */
  const earnedOf = (q: ExamQuestion, p: Part): number | null => {
    const id = partId(q, p);
    return isOpen(p) ? (open[id] ?? null) : (auto[id]?.earned ?? 0);
  };
  const scores = questions.map((q) => round1(q.parts.reduce((s, p) => s + (earnedOf(q, p) ?? 0), 0)));
  const { grade: total, counted } = midtermGrade(scores);
  const waiting = questions.flatMap((q) => q.parts.filter((p) => isOpen(p) && open[partId(q, p)] === undefined)).length;

  // what to review: a part that lost points (an open part only once it is self-checked)
  const weak = questions.flatMap((q) =>
    q.parts.filter((p) => {
      const e = earnedOf(q, p);
      return e !== null && e < p.points;
    }),
  );
  const review = [...new Set(weak.flatMap((p) => p.objectives.map(lessonOfObjective)).filter((l): l is string => !!l && !!lessons[l]))].sort(
    (a, b) => a.localeCompare(b, 'en', { numeric: true }),
  );
  const found = [...new Set(Object.values(auto).flatMap((r) => (r.verdict && !r.verdict.correct && r.verdict.misconception ? [r.verdict.misconception] : [])))];

  return (
    <div class="test-report" data-phase="grading" data-paper={paper.paper}>
      <div class="test-score" role="status" aria-live="polite">
        <strong class="ltr" data-testid="grade">
          {total}/100
        </strong>
        <span>
          גרסה {paperLetter(paper.paper)}. נספרות {MIDTERM_COUNTED} השאלות הטובות: {counted.map((i) => i + 1).join(', ')}.
          {waiting > 0 && <> עוד {waiting} סעיפים של פתרון מלא מחכים לבדיקה עצמית שלכם למטה, והציון יעלה כשתבדקו אותם.</>}
        </span>
      </div>

      <section>
        <h2>ניקוד לפי שאלה</h2>
        <div class="table-scroll">
          <table class="report-table">
            <thead>
              <tr>
                <th scope="col">שאלה</th>
                <th scope="col">נושא</th>
                <th scope="col">ניקוד</th>
                <th scope="col">נספרת</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q, i) => (
                <tr key={q.id} data-qid={q.id}>
                  <td>
                    <a href={`#mid-${i + 1}`}>שאלה {i + 1}</a>
                  </td>
                  <td>{blockTitle(q)}</td>
                  <td>
                    <span class="ltr" data-testid="q-score">
                      {scores[i]}/25
                    </span>
                  </td>
                  <td>{counted.includes(i) ? 'כן' : 'לא'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section class="report-review">
        <h2>בדיקת המבחן</h2>
        <p>הסעיפים עם תיבת תשובה כבר נבדקו. בכל סעיף של פתרון מלא: קראו את הפתרון לדוגמה, סמנו במחוון מה עשיתם נכון, ולחצו "סיימתי את הבדיקה".</p>
        {questions.map((q, i) => (
          <article key={q.id} id={`mid-${i + 1}`} class="exam mid-q" data-qid={q.id} data-type="exam">
            <QuestionHead q={q} i={i} score={scores[i]} />
            <ol class="exam-parts">
              {q.parts.map((p) => {
                const id = partId(q, p);
                if (isOpen(p)) {
                  return (
                    <li key={p.label} class="b-part" data-part={p.label}>
                      <PartHead p={p} />
                      <OpenPart q={q} part={p} kind="test" written={notes.current[id] ?? ''} onScored={(e) => setOpen((s) => ({ ...s, [id]: e }))} />
                    </li>
                  );
                }
                const pq = partQuestion(q, p);
                const r = auto[id];
                const ok = r?.verdict?.correct === true;
                return (
                  <li key={p.label} class="b-part" data-part={p.label}>
                    <PartHead p={p} />
                    <div class={`qcard ${ok ? 'is-right' : 'is-wrong'}`} data-qid={id} data-type={p.type}>
                      <div class="q-prompt" dangerouslySetInnerHTML={{ __html: p.prompt }} />
                      <AnswerArea q={pq} draft={drafts.current[id] ?? emptyDraft(pq)} setDraft={() => {}} locked verdict={r?.verdict ?? null} />
                      <div class={`q-feedback ${ok ? 'ok' : 'bad'}`} role="status">
                        <p class="q-verdict">
                          {ok ? 'נכון' : r?.answered ? 'לא נכון' : 'לא נענה'} · <span class="ltr">{r?.earned ?? 0}</span> מתוך{' '}
                          <span class="ltr">{p.points}</span> נקודות
                        </p>
                        {r?.verdict?.feedback.filter(Boolean).map((f, k) => <p key={k} dangerouslySetInnerHTML={{ __html: f }} />)}
                      </div>
                      {!ok && pq.explanation && (
                        <div class="q-explanation">
                          <p class="kicker">הסבר</p>
                          <div dangerouslySetInnerHTML={{ __html: pq.explanation }} />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </article>
        ))}
      </section>

      <section>
        <h2>טעויות מושגיות שזוהו</h2>
        {found.length === 0 ? (
          <p>לא זוהתה בתשובות שנבדקו אוטומטית טעות מושגית מוכרת.</p>
        ) : (
          <ul class="report-list">
            {found.map((id) => {
              const m = misconceptions[id];
              return (
                <li key={id}>
                  <strong>{m?.title ?? id}</strong>
                  {m && <p dangerouslySetInnerHTML={{ __html: m.truth }} />}
                  {m && (
                    <a href={m.href} class="btn">
                      {m.label}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2>מה כדאי לחזור עליו</h2>
        {review.length === 0 ? (
          <p>{waiting > 0 ? 'אחרי שתבדקו את הסעיפים הפתוחים, יופיעו כאן השיעורים שכדאי לחזור עליהם.' : 'לא איבדתם נקודות באף סעיף. כל הכבוד.'}</p>
        ) : (
          <ul class="report-list">
            {review.map((l) => (
              <li key={l}>
                <a href={lessons[l].href}>
                  שיעור <span class="ltr">{l}</span> {lessons[l].title}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div class="p-links">
        <button
          type="button"
          class="btn primary"
          onClick={() => {
            setPhase('intro');
            window.scrollTo(0, 0);
          }}
        >
          גרסה אחרת
        </button>
        <a class="btn" href={meHref}>
          המסלול שלי
        </a>
        <a class="btn" href={homeHref}>
          לתוכן העניינים
        </a>
      </div>
    </div>
  );
}

/** The time left, ticking on its own: the paper does not re-render every second. Submits when time is up. */
function Clock({ deadline, onExpire }: { deadline: number; onExpire: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= deadline) onExpire();
    }, 1000);
    return () => clearInterval(id);
  }, [deadline]);
  const left = deadline - now;
  return (
    <span class={`test-timer ${left < 5 * 60_000 ? 'low' : ''}`} role="timer" aria-label="הזמן שנשאר">
      <span class="ltr">{mmss(left)}</span>
    </span>
  );
}

/** One answer box with its own state, mirrored into the runner's store for grading on submission. */
function AutoAnswer({ q, store }: { q: Simple; store: Record<string, Draft> }) {
  const [draft, setDraft] = useState<Draft>(() => store[q.id] ?? emptyDraft(q));
  return (
    <AnswerArea
      q={q}
      draft={draft}
      setDraft={(d) => {
        store[q.id] = d;
        setDraft(d);
      }}
      locked={false}
      verdict={null}
    />
  );
}

function QuestionHead({ q, i, score }: { q: ExamQuestion; i: number; score?: number }) {
  return (
    <header class="exam-head">
      <div class="q-meta">
        <span class="q-num">שאלה {i + 1}</span>
        <span class="chip">{blockTitle(q)}</span>
        <span class="chip">
          {score === undefined ? (
            <>
              <span class="ltr">25</span> נקודות
            </>
          ) : (
            <>
              <span class="ltr">{score}</span> מתוך <span class="ltr">25</span>
            </>
          )}
        </span>
      </div>
      <h3>{q.title}</h3>
      <div class="q-prompt" dangerouslySetInnerHTML={{ __html: q.prompt }} />
      {q.diagram && (
        <figure class="exam-diagram">
          <div class="ltr-space" role="img" aria-label={q.diagramAlt} dangerouslySetInnerHTML={{ __html: q.diagram }} />
        </figure>
      )}
    </header>
  );
}

function PartHead({ p }: { p: Part }) {
  return (
    <h4 class="b-part-head">
      סעיף {p.label}
      <span class="chip">
        <span class="ltr">{p.points}</span> נקודות
      </span>
      {isOpen(p) && <span class="chip">פתרון מלא</span>}
    </h4>
  );
}
