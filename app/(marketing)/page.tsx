'use client';

import { useState, useEffect, useLayoutEffect, useRef, useCallback, Fragment } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// ── Types ────────────────────────────────────────────────────────────────────

interface TaskItem { title: string; when: string; dur: string; pri: 'P1'|'P2'|'P3'; done: boolean; }
interface CalEvent { d: number; s: number; len: number; type: 'brand'|'busy'|'focus'; label: string; m: string; brand?: boolean; }
interface WeekChip { k: 'b'|'f'|'m'|'u'; t: string; n: string; }
interface Plugin { ico: string; name: string; desc: string; on: boolean; }
interface Theme { n: string; bg: string; fg: string; a: string; active: boolean; }

// ── Static data ───────────────────────────────────────────────────────────────

const DEFAULT_TASKS: TaskItem[] = [
  { title: 'Review Q2 roadmap doc',        when: 'Thu 14:00', dur: '45m', pri: 'P1', done: false },
  { title: 'Ping Alex with roadmap edits', when: 'Fri 09:30', dur: '15m', pri: 'P2', done: false },
  { title: 'Design handoff → Sarah',       when: 'Tue 10:00', dur: '30m', pri: 'P1', done: false },
  { title: 'Prep investor slides',         when: 'Wed 15:00', dur: '90m', pri: 'P1', done: false },
  { title: 'Renew domain',                 when: 'Mon 09:15', dur: '10m', pri: 'P3', done: true  },
];

const INITIAL_CAL_EVENTS: CalEvent[] = [
  { d:0, s:9,   len:1,   type:'busy',  label:'Standup',       m:'09:00' },
  { d:0, s:11,  len:2,   type:'focus', label:'Deep work',     m:'11:00' },
  { d:1, s:10,  len:1,   type:'brand', label:'Design → Sarah',m:'10:00', brand:true },
  { d:1, s:14,  len:1,   type:'busy',  label:'1:1 Alex',      m:'14:00' },
  { d:2, s:15,  len:1.5, type:'brand', label:'Prep slides',   m:'15:00', brand:true },
  { d:2, s:9,   len:1,   type:'busy',  label:'Standup',       m:'09:00' },
  { d:3, s:9,   len:1,   type:'busy',  label:'Standup',       m:'09:00' },
  { d:3, s:14,  len:1,   type:'brand', label:'Review Q2 doc', m:'14:00', brand:true },
  { d:3, s:16,  len:1,   type:'focus', label:'Investor prep', m:'16:00' },
  { d:4, s:9,   len:0.5, type:'brand', label:'Ping Alex',     m:'09:30', brand:true },
  { d:4, s:11,  len:2,   type:'focus', label:'Ship',          m:'11:00' },
];

const INITIAL_WEEK: WeekChip[][] = [
  [{ k:'b', t:'09:00', n:'Standup' },      { k:'u', t:'11:00', n:'Q2 Roadmap' }],
  [{ k:'b', t:'10:00', n:'Design review' },{ k:'f', t:'14:00', n:'Focus block' }],
  [{ k:'b', t:'09:00', n:'Standup' },      { k:'u', t:'15:00', n:'Investor slides' }, { k:'m', t:'17:00', n:'Admin' }],
  [{ k:'b', t:'09:00', n:'Standup' },      { k:'f', t:'11:00', n:'Deep work' },        { k:'b', t:'14:00', n:'1:1 Alex' }],
  [{ k:'b', t:'09:30', n:'Ping Alex' },    { k:'f', t:'11:00', n:'Ship' }],
];
const WEEK_LABELS = ['MON 20','TUE 21','WED 22','THU 23','FRI 24'];

const INITIAL_PLUGINS: Plugin[] = [
  { ico:'A', name:'Anthropic Claude',  desc:'extractor · default', on:true  },
  { ico:'O', name:'OpenAI GPT-4o',     desc:'extractor · fallback', on:false },
  { ico:'L', name:'Ollama (local)',    desc:'extractor · offline',  on:true  },
  { ico:'S', name:'Slack ingress',     desc:'scratchpad source',    on:false },
  { ico:'W', name:'Webhook sink',      desc:'scheduler hook',       on:true  },
];

const INITIAL_THEMES: Theme[] = [
  { n:'Midnight', bg:'#08090a', fg:'#f7f8f8', a:'#7170ff', active:true  },
  { n:'Pyre',     bg:'#0d0708', fg:'#fef2f2', a:'#ff7a59', active:false },
  { n:'Moss',     bg:'#070a08', fg:'#f0f7f1', a:'#4ade80', active:false },
  { n:'Paper',    bg:'#f7f6f3', fg:'#1a1a1a', a:'#1a1a1a', active:false },
  { n:'Neon',     bg:'#0a0a0a', fg:'#f5f5f5', a:'#d4ff00', active:false },
  { n:'Rose',     bg:'#120a0e', fg:'#fdf4f6', a:'#ff79c6', active:false },
  { n:'Sand',     bg:'#1a1612', fg:'#f5efe5', a:'#e2b873', active:false },
  { n:'Ion',      bg:'#08090a', fg:'#e0f2ff', a:'#38bdf8', active:false },
];

const BYOM_MODELS = [
  { n:'Anthropic · Claude Haiku 4.5', status:'ACTIVE',  active:true  },
  { n:'OpenAI · gpt-4o-mini',         status:'READY',   active:false },
  { n:'Ollama · llama3.1:8b',         status:'LOCAL',   active:false },
];

const LATENCY_VALS = [0.22, 0.31, 0.38, 0.42, 0.48, 0.55, 0.61, 0.72, 0.88, 1.15];

const SOW_SLOTS = ['Mon 10:00','Tue 13:30','Tue 16:00','Wed 09:30'];

const HERO_PHRASES = [
  'finally intelligent.',
  'self-scheduling.',
  'aware of urgency.',
  'paste-driven.',
  'built to be broken.',
];

const CAL_DAYS = ['MON','TUE','WED','THU','FRI'];
const CAL_HOURS = [9,10,11,12,13,14,15,16,17];

// ── Utilities ────────────────────────────────────────────────────────────────

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c] ?? c));
}

// ── Shared components ────────────────────────────────────────────────────────

function BentoCell({ children, className = '', style }: { children?: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
    e.currentTarget.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
  }, []);
  return <div className={`cell ${className}`} style={style} onMouseMove={handleMouseMove}>{children}</div>;
}

function Corners() {
  return (
    <>
      <span className="corner tl" /><span className="corner tr" />
      <span className="corner bl" /><span className="corner br" />
    </>
  );
}

// ── Scratchpad demo ───────────────────────────────────────────────────────────

const DEFAULT_PAD_TEXT = `hey - can you review the q2 roadmap doc before friday and then ping me with edits. also sarah needs the design handoff by tuesday 10am, and we need to prep slides for the investor meeting thursday afternoon. don't forget to renew domain.`;

function ScratchpadDemo() {
  const [tasks, setTasks] = useState<TaskItem[]>(DEFAULT_TASKS);
  const [extracting, setExtracting] = useState(false);
  const padRef = useRef<HTMLTextAreaElement>(null);

  const extract = useCallback(async () => {
    const text = padRef.current?.value.trim();
    if (!text || extracting) return;
    setExtracting(true);
    await new Promise(r => setTimeout(r, 900));
    setTasks(DEFAULT_TASKS.map(t => ({ ...t, done: false })));
    setExtracting(false);
  }, [extracting]);

  const toggleDone = useCallback((i: number) => {
    setTasks(prev => prev.map((t, idx) => idx === i ? { ...t, done: !t.done } : t));
  }, []);

  return (
    <div className="mock" style={{ border: 0, borderRadius: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="chrome">
        <span className="dot" style={{ background: '#ff5f57' }} />
        <span className="dot" style={{ background: '#febc2e' }} />
        <span className="dot" style={{ background: '#28c840' }} />
        <span className="addr mono">kairos.app / inbox</span>
      </div>
      <div className="pad">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>scratchpad</span>
          <span className="pulse-dot" />
          <span className="mono" style={{ fontSize: 11, color: 'var(--success)', marginLeft: 'auto' }}>model: claude-haiku-4-5</span>
        </div>
        <textarea ref={padRef} defaultValue={DEFAULT_PAD_TEXT} spellCheck={false}
          onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); extract(); } }} />
        <div className="pad-bar">
          <span className="hint mono">press <span className="kbd">⌘</span> <span className="kbd">↵</span> to extract</span>
          <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 13 }}
            onClick={extract} disabled={extracting}>
            {extracting ? <><span className="pulse-dot" style={{ marginRight: 8 }} />extracting…</> : 'Extract tasks'}
          </button>
        </div>
      </div>
      <div className="tasks" style={{ flex: 1 }}>
        <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
          <span>extracted · {tasks.length} tasks</span>
          <span style={{ color: 'var(--success)' }}>● scheduled</span>
        </div>
        {tasks.map((t, i) => (
          <div key={i} className={`task fade-in${t.done ? ' done' : ''}`} style={{ animationDelay: `${i * 60}ms` }} onClick={() => toggleDone(i)}>
            <span className="chk" />
            <span className="t-text" dangerouslySetInnerHTML={{ __html: escapeHtml(t.title) }} />
            <span className={`t-pri ${t.pri.toLowerCase()}`}>{t.pri}</span>
            <span className="t-meta">{t.when} · {t.dur}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Calendar demo ─────────────────────────────────────────────────────────────

function CalendarDemo() {
  const [events, setEvents] = useState<CalEvent[]>(INITIAL_CAL_EVENTS);
  const [reoptimizing, setReoptimizing] = useState(false);

  const reoptimize = useCallback(async () => {
    if (reoptimizing) return;
    setReoptimizing(true);
    await new Promise(r => setTimeout(r, 420));
    const newEvents = events.map(e => {
      if (!e.brand) return e;
      const d = Math.floor(Math.random() * 5);
      const h = 9 + Math.floor(Math.random() * 8);
      return { ...e, d, s: h, m: String(h).padStart(2, '0') + ':00' };
    });
    setEvents(newEvents);
    setReoptimizing(false);
  }, [events, reoptimizing]);

  return (
    <div className="mock" style={{ border: 0, borderRadius: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="chrome">
        <span className="dot" /><span className="dot" /><span className="dot" />
        <span className="addr mono">this week · 5 days · 9–18h</span>
      </div>
      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--b-sub)', background: 'var(--panel)' }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>auto-scheduled</span>
        <span className="pulse-dot green" />
        <button className="btn btn-ghost" style={{ marginLeft: 'auto', fontSize: 12, padding: '5px 10px' }} onClick={reoptimize} disabled={reoptimizing}>
          ↻ Re-optimize
        </button>
      </div>
      <div className="cal" style={{ flex: 1 }}>
        <div className="hdr" />
        {CAL_DAYS.map(d => <div key={d} className="hdr">{d}</div>)}
        {CAL_HOURS.map(h => (
          <Fragment key={h}>
            <div className="hr">{String(h).padStart(2, '0')}:00</div>
            {[0,1,2,3,4].map(d => (
              <div key={d} className="slot">
                {events.filter(e => e.d === d && Math.floor(e.s) === h).map((e, i) => (
                  <div key={i} className={`evt ${e.type}`}
                    style={{ top: `${(e.s - Math.floor(e.s)) * 34}px`, height: `${e.len * 34 - 4}px` }}>
                    <span className="m">{e.m}</span>
                    {e.label}
                  </div>
                ))}
              </div>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

// ── Week optimizer demo ───────────────────────────────────────────────────────

function WeekOptimizerDemo() {
  const [week, setWeek] = useState<WeekChip[][]>(INITIAL_WEEK);

  const reoptimize = useCallback(() => {
    const allItems = week.flat();
    const urgent = allItems.filter(x => x.k === 'u' || x.k === 'f');
    const fixed  = allItems.filter(x => x.k === 'b' || x.k === 'm');
    const next: WeekChip[][] = Array.from({ length: 5 }, () => []);
    fixed.forEach(x => { const d = Math.floor(Math.random() * 5); next[d].push(x); });
    urgent.forEach(x => {
      let min = 0;
      next.forEach((day, i) => { if (day.length < next[min].length) min = i; });
      next[min].push({ ...x, t: ['09:30','11:00','13:30','15:00','16:00'][Math.floor(Math.random() * 5)] });
    });
    next.forEach(d => d.sort((a, b) => a.t.localeCompare(b.t)));
    setWeek(next);
  }, [week]);

  return (
    <>
      <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={reoptimize}>↻ Re-optimize demo week</button>
      <div className="week">
        {week.map((day, i) => (
          <div key={i} className="day">
            <div className="d-hd"><span>{WEEK_LABELS[i]}</span><span>{day.length}</span></div>
            {day.map((c, j) => (
              <div key={j} className={`chip ${c.k}`} style={{ animationDelay: `${j * 40}ms` }}>
                <span className="tm">{c.t}</span>{c.n}
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

// ── Plugins demo ──────────────────────────────────────────────────────────────

function PluginsDemo() {
  const [plugins, setPlugins] = useState<Plugin[]>(INITIAL_PLUGINS);
  const toggle = useCallback((i: number) => {
    setPlugins(prev => prev.map((p, idx) => idx === i ? { ...p, on: !p.on } : p));
  }, []);
  return (
    <div className="plugin-list">
      {plugins.map((p, i) => (
        <div key={i} className="plugin">
          <span className="ico">{p.ico}</span>
          <div>
            <div className="p-name">{p.name}</div>
            <div className="p-desc">{p.desc}</div>
          </div>
          <div className={`switch${p.on ? ' on' : ''}`} onClick={() => toggle(i)} />
        </div>
      ))}
    </div>
  );
}

// ── Themes demo ───────────────────────────────────────────────────────────────

function ThemesDemo() {
  const [themes, setThemes] = useState<Theme[]>(INITIAL_THEMES);
  const select = useCallback((i: number) => {
    setThemes(prev => prev.map((t, idx) => ({ ...t, active: idx === i })));
  }, []);
  return (
    <div className="themes">
      {themes.map((t, i) => (
        <div key={i} className={`swatch${t.active ? ' active' : ''}`} style={{ background: t.bg }} onClick={() => select(i)}>
          <div className="strips">
            <div className="bars">
              <div className="bar" style={{ background: t.fg, opacity: .6 }} />
              <div className="bar" style={{ background: t.a }} />
              <div className="bar" style={{ background: t.fg, opacity: .25, height: '30%' }} />
            </div>
            <div style={{ background: t.a, height: 4, borderRadius: 2, opacity: .8 }} />
          </div>
          <span className="label">{t.n}</span>
        </div>
      ))}
    </div>
  );
}

// ── BYOM demo ────────────────────────────────────────────────────────────────

function BYOMDemo() {
  return (
    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {BYOM_MODELS.map((m, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--b-def)', borderRadius: 6, padding: '9px 11px', background: '#0a0b0c' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.active ? 'var(--success)' : '#3a3c42', flexShrink: 0 }} />
          <span className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>{m.n}</span>
          <span className="mono" style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--subtle)' }}>{m.status}</span>
        </div>
      ))}
    </div>
  );
}

// ── Latency demo ──────────────────────────────────────────────────────────────

function LatencyDemo() {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 64 }}>
        {LATENCY_VALS.map((v, i) => {
          const h = 14 + (1 - Math.abs(i - 4) / 5) * 44;
          return (
            <div key={i} style={{ flex: 1, background: i === 3 ? 'var(--accent)' : '#28282c', height: h, borderRadius: '2px 2px 0 0' }} title={`${v}s`} />
          );
        })}
      </div>
      <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--subtle)', marginTop: 6 }}>
        <span>0.2s</span><span>p50 0.42s</span><span>1.2s</span>
      </div>
    </div>
  );
}

// ── Schedule-on-write demo ────────────────────────────────────────────────────

function SOWDemo() {
  const [input, setInput] = useState('Review PR #142');

  const pick = SOW_SLOTS[Math.floor((input.length * 7919) % SOW_SLOTS.length)];

  return (
    <div style={{ marginTop: 14, border: '1px solid var(--b-def)', borderRadius: 6, background: '#0a0b0c', overflow: 'hidden' }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--b-sub)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>NEW TASK</span>
        <input value={input} onChange={e => setInput(e.target.value)}
          style={{ flex: 1, background: 'transparent', border: 0, outline: 'none', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13 }} />
      </div>
      <div className="mono" style={{ padding: 12, fontSize: 11, color: 'var(--muted)', lineHeight: 1.7 }}>
        <div>→ parsing &quot;{input || '(empty)'}&quot;...</div>
        <div>→ duration inferred: <span style={{ color: 'var(--text2)' }}>30m</span></div>
        <div>→ scanning free/busy...</div>
        <div>→ next open slot: <span style={{ color: 'var(--accent)' }}>{input.trim() ? pick : '—'}</span></div>
        {input.trim() && <div style={{ color: 'var(--success)' }}>✓ scheduled</div>}
      </div>
    </div>
  );
}

// ── Beta form ─────────────────────────────────────────────────────────────────

function BetaForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle'|'success'|'error'>('idle');
  const [reserved, setReserved] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setReserved(email);
    setEmail('');
    setStatus('success');
  }

  return (
    <div className="beta">
      <Corners />
      <div className="spots">
        <div>beta seats</div>
        <div><b>247</b> / 500 open</div>
        <div style={{ marginTop: 6 }}>cohort closes may 15</div>
      </div>
      <span className="clupai-chip" style={{ marginBottom: 16, display: 'inline-block' }}>CLUPAI EARLY ACCESS PROGRAM</span>
      <h3>Play with the beta.<br />Break it. Tell us how.</h3>
      <p>Kairos is in open beta. Drop your email and we&apos;ll send you a seat—usually within a day. No usage limits, no paywall. In exchange: tell us what broke, what felt great, what should ship next.</p>
      {status === 'idle' ? (
        <form onSubmit={submit}>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required />
          <button type="submit" className="btn btn-primary">Request access →</button>
        </form>
      ) : null}
      <div className="tick">
        <span style={{ color: 'var(--accent)' }}>■</span>
        <span>By joining, you agree to occasional build-log emails. No marketing. We&apos;ll never share your address. Unsubscribe with one click. This site is a Clupai studio project.</span>
      </div>
      {status === 'success' && (
        <div className="status">✓ seat reserved for {reserved} — check your inbox within 24h.</div>
      )}
    </div>
  );
}

// ── Main landing page ─────────────────────────────────────────────────────────

export default function LandingPage() {
  const navRef    = useRef<HTMLElement>(null);
  const heroRef   = useRef<HTMLElement>(null);
  const heroRotRef = useRef<HTMLElement>(null);
  const statsRef  = useRef<HTMLDivElement>(null);
  const auroraRef = useRef<HTMLDivElement>(null);
  const pageRef   = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Nav scroll state
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Hero typewriter
  useEffect(() => {
    const el = heroRotRef.current;
    if (!el) return;
    let alive = true;
    let i = 0;

    async function typePhrase(target: string) {
      if (!el) return;
      for (let k = el.textContent!.length; k >= 0; k--) {
        if (!alive) return;
        el.textContent = el.textContent!.slice(0, k);
        await new Promise(r => setTimeout(r, 22));
      }
      for (let k = 0; k <= target.length; k++) {
        if (!alive) return;
        el.textContent = target.slice(0, k);
        await new Promise(r => setTimeout(r, 38));
      }
    }

    (async function loop() {
      while (alive) {
        await new Promise(r => setTimeout(r, 2800));
        i = (i + 1) % HERO_PHRASES.length;
        await typePhrase(HERO_PHRASES[i]);
      }
    })();

    return () => { alive = false; };
  }, []);

  // Aurora parallax
  useEffect(() => {
    const orbs = auroraRef.current?.querySelectorAll<HTMLElement>('.orb');
    if (!orbs?.length) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        orbs.forEach((o, i) => { o.style.translate = `0 ${y * (0.15 + i * 0.08)}px`; });
        ticking = false;
      });
      ticking = true;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll reveal animations
  useLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      // ── Initial hidden states (runs before first paint) ──────────────────
      gsap.set('.section-head h2',   { opacity: 0, y: 44 });
      gsap.set('.section-head .meta',{ opacity: 0, y: 26 });
      gsap.set('.step',              { opacity: 0, y: 60 });
      gsap.set('#feat-bento .cell',  { opacity: 0, y: 52, scale: 0.96 });
      gsap.set('#hero-bento .cell',  { opacity: 0, y: 52 });
      gsap.set('.stats .s',          { opacity: 0, y: 36 });
      gsap.set('.deploy > div',      { opacity: 0, y: 44 });
      gsap.set('.stack',             { opacity: 0, y: 22 });
      gsap.set('.beta',              { opacity: 0, y: 48 });
      gsap.set('.cols > div',        { opacity: 0, y: 34 });
      gsap.set('.legal',             { opacity: 0 });

      // ── Section headings (h2 then .meta, offset overlap) ─────────────────
      gsap.utils.toArray<HTMLElement>('.section-head').forEach((el) => {
        const h2   = el.querySelector('h2');
        const meta = el.querySelector('.meta');
        const tl = gsap.timeline({
          scrollTrigger: { trigger: el, start: 'top 82%', once: true },
        });
        if (h2)   tl.to(h2,   { opacity: 1, y: 0, duration: 0.8,  ease: 'power3.out' });
        if (meta) tl.to(meta, { opacity: 1, y: 0, duration: 0.65, ease: 'power2.out' }, '-=0.5');
      });

      // ── Hero bento cells ─────────────────────────────────────────────────
      ScrollTrigger.batch('#hero-bento .cell', {
        onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, stagger: 0.2, duration: 0.9, ease: 'power3.out' }),
        start: 'top 90%',
        once: true,
      });

      // ── How it works steps ───────────────────────────────────────────────
      ScrollTrigger.batch('.step', {
        onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, stagger: 0.18, duration: 0.85, ease: 'power3.out' }),
        start: 'top 85%',
        once: true,
      });

      // ── Feature bento cells ──────────────────────────────────────────────
      ScrollTrigger.batch('#feat-bento .cell', {
        onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, scale: 1, stagger: 0.11, duration: 0.8, ease: 'power3.out' }),
        start: 'top 90%',
        once: true,
      });

      // ── Stats ─────────────────────────────────────────────────────────────
      ScrollTrigger.batch('.stats .s', {
        onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, stagger: 0.14, duration: 0.75, ease: 'power2.out' }),
        start: 'top 85%',
        once: true,
      });

      // ── Deploy terminals ──────────────────────────────────────────────────
      ScrollTrigger.batch('.deploy > div', {
        onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, stagger: 0.24, duration: 0.9, ease: 'power3.out' }),
        start: 'top 85%',
        once: true,
      });

      // ── Stack chips ───────────────────────────────────────────────────────
      gsap.to('.stack', {
        opacity: 1, y: 0, duration: 0.7, ease: 'power2.out',
        scrollTrigger: { trigger: '.stack', start: 'top 88%', once: true },
      });

      // ── Beta form ─────────────────────────────────────────────────────────
      gsap.to('.beta', {
        opacity: 1, y: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: '.beta', start: 'top 82%', once: true },
      });

      // ── Footer columns ────────────────────────────────────────────────────
      ScrollTrigger.batch('.cols > div', {
        onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, stagger: 0.13, duration: 0.7, ease: 'power2.out' }),
        start: 'top 92%',
        once: true,
      });

      gsap.to('.legal', {
        opacity: 1, duration: 0.6, ease: 'power1.out',
        scrollTrigger: { trigger: '.legal', start: 'top 95%', once: true },
      });
    }, pageRef);

    return () => ctx.revert();
  }, []);

  // Stats count-up
  useEffect(() => {
    const container = statsRef.current;
    if (!container) return;
    const els = container.querySelectorAll<HTMLElement>('.n');
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target as HTMLElement;
        const final = el.textContent ?? '';
        const num = parseFloat(final);
        if (!isNaN(num)) {
          const suffix = final.replace(/^[\d.]+/, '');
          const dur = 1200; const start = performance.now();
          function tick(t: number) {
            const p = Math.min((t - start) / dur, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            const v = num * eased;
            el.textContent = (num % 1 === 0 ? Math.floor(v) : v.toFixed(2)) + suffix;
            if (p < 1) requestAnimationFrame(tick);
            else el.textContent = final;
          }
          requestAnimationFrame(tick);
        }
        io.unobserve(el);
      });
    }, { threshold: .5 });
    els.forEach(s => io.observe(s));
    return () => io.disconnect();
  }, []);

  // KBD blink hint
  useEffect(() => {
    const id = setInterval(() => {
      document.querySelectorAll<HTMLElement>('.pad .kbd').forEach(k => {
        k.style.background = 'rgba(113,112,255,.2)';
        k.style.borderColor = 'rgba(113,112,255,.5)';
      });
      setTimeout(() => {
        document.querySelectorAll<HTMLElement>('.pad .kbd').forEach(k => {
          k.style.background = '';
          k.style.borderColor = '';
        });
      }, 220);
    }, 4200);
    return () => clearInterval(id);
  }, []);

  // Magnetic CTA buttons
  const onMagMove = useCallback((e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) / (r.width / 2);
    const y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    e.currentTarget.style.transform = `translate(${x * 4}px, ${y * 3}px)`;
  }, []);
  const onMagLeave = useCallback((e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    e.currentTarget.style.transform = '';
  }, []);

  return (
    <div className="landing" ref={pageRef}>
      {/* Background */}
      <div className="aurora" ref={auroraRef}>
        <div className="orb o1" /><div className="orb o2" /><div className="orb o3" />
      </div>
      <div className="gridlines" />
      <div className="noise" />

      {/* ── Nav ──────────────────────────────────────────────────── */}
      <nav className="top" ref={navRef}>
        <div className="wrap inner">
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <a href="#" className="brandmark"><span>Kairos</span></a>
            <span className="clupai-chip nav-desktop-chip">a Clupai studio app</span>
          </div>
          <div className="navlinks" style={{ marginLeft: 'auto' }}>
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#deploy">Deploy</a>
            <a href="#beta">Beta</a>
            <a href="/docs">Docs</a>
            <a href="https://github.com/clupai8o0/kairos" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
          </div>
          <div className="nav-right">
            <span className="pill-beta">● BETA 0.3.1</span>
            <a href="#beta" className="btn btn-primary nav-desktop-cta" onMouseMove={onMagMove} onMouseLeave={onMagLeave}>Join beta</a>
            <button
              className={`nav-hamburger${menuOpen ? ' open' : ''}`}
              onClick={() => setMenuOpen(o => !o)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            >
              <span /><span /><span />
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="mobile-nav-panel">
            <a href="#how"      className="mobile-nav-link" onClick={() => setMenuOpen(false)}>How it works</a>
            <a href="#features" className="mobile-nav-link" onClick={() => setMenuOpen(false)}>Features</a>
            <a href="#deploy"   className="mobile-nav-link" onClick={() => setMenuOpen(false)}>Deploy</a>
            <a href="#beta"     className="mobile-nav-link" onClick={() => setMenuOpen(false)}>Beta</a>
            <a href="/docs"     className="mobile-nav-link" onClick={() => setMenuOpen(false)}>Docs</a>
            <a href="https://github.com/clupai8o0/kairos" target="_blank" rel="noopener noreferrer" className="mobile-nav-link" onClick={() => setMenuOpen(false)}>GitHub ↗</a>
            <a href="#beta" className="btn btn-primary mobile-nav-cta" onClick={() => setMenuOpen(false)}>Join beta →</a>
          </div>
        )}
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="hero" id="hero" ref={heroRef} data-center="1">
        <div className="wrap">
          <div className="hero-meta">
            <div className="hero-meta-inner">
              <span className="dot" />
              <span>OPEN BETA · APR 19 2026</span>
              <span style={{ color: 'var(--subtle)' }}>{'//'}</span>
              <span>v0.3.1-beta · commit 8fa2c91</span>
              <span style={{ color: 'var(--subtle)' }}>{'//'}</span>
              <span>MIT · self-hostable</span>
            </div>
          </div>
          <h1>
            Your calendar,<br />
            <em ref={heroRotRef as React.RefObject<HTMLElement>}>finally intelligent.</em>
            <span className="slash blink">_</span>
          </h1>
          <p className="sub">
            Paste anything—notes, emails, Slack threads. Kairos extracts the tasks and drops them into the next open slot on your Google Calendar. Re-optimizes your whole week in one click.
          </p>
          <div className="hero-cta">
            <a href="#beta" className="btn btn-primary" onMouseMove={onMagMove} onMouseLeave={onMagLeave}>Join the beta →</a>
            <a href="#deploy" className="btn btn-ghost">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1L15 14H1L8 1Z" fill="currentColor"/></svg>
              Deploy to Vercel
            </a>
            <a href="#deploy" className="btn btn-ghost">Self-host with Docker</a>
            <span className="mono-note">no credit card · 247 seats open</span>
          </div>

          {/* Hero bento */}
          <div className="bento" id="hero-bento">
            {/* Scratchpad */}
            <BentoCell className="c-7" style={{ padding: 0, minHeight: 460 }}>
              <Corners />
              <span className="coord tl mono">[01 / 04]</span>
              <span className="coord tr mono">scratchpad.tsx</span>
              <ScratchpadDemo />
            </BentoCell>

            {/* Calendar */}
            <BentoCell className="c-5" style={{ padding: 0, minHeight: 460 }}>
              <Corners />
              <span className="coord tl mono">[02 / 04]</span>
              <span className="coord tr mono">schedule.tsx</span>
              <CalendarDemo />
            </BentoCell>
          </div>

          {/* Marquee */}
          <div className="marquee">
            <div className="marquee-track">
              {[1,2].map(rep => (
                <Fragment key={rep}>
                  <span className="star">★</span><span>built for operators</span>
                  <span className="star">★</span><span>GDPR-safe — your data, your server</span>
                  <span className="star">★</span><span>works with OpenAI · Anthropic · Ollama</span>
                  <span className="star">★</span><span>247 beta seats remaining</span>
                  <span className="star">★</span><span>Clupai marketplace · 2026</span>
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section id="how">
        <div className="wrap">
          <div className="section-head">
            <h2>Three steps. Ten seconds.</h2>
            <div className="meta">§ 01 — core loop<br />paste → extract → schedule</div>
          </div>
          <div className="flow">
            <div className="step">
              <span className="num mono">STEP 01</span>
              <h4>Paste anything</h4>
              <p>Meeting notes. Slack threads. Voice-to-text ramble. Kairos doesn&apos;t care about format.</p>
              <div style={{ position: 'relative', height: 160, marginTop: 14 }}>
                <svg viewBox="0 0 260 140" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                  <rect x="20" y="20" width="220" height="100" fill="#0a0b0c" stroke="rgba(255,255,255,.08)" rx="6"/>
                  <text className="node" x="30" y="42">hey can you review</text>
                  <text className="node" x="30" y="58">the q2 roadmap doc</text>
                  <text className="node" x="30" y="74">by friday and ping me</text>
                  <text className="node" x="30" y="90">when you&apos;re done</text>
                  <rect x="30" y="96" width="6" height="12" fill="var(--accent)">
                    <animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite"/>
                  </rect>
                </svg>
              </div>
              <span className="arrow" />
            </div>
            <div className="step">
              <span className="num mono">STEP 02</span>
              <h4>AI extracts tasks</h4>
              <p>Titles, deadlines, priorities, duration estimates—inferred from context.</p>
              <div style={{ position: 'relative', height: 160, marginTop: 14 }}>
                <svg viewBox="0 0 260 140" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                  <path d="M20 30 Q 130 10, 240 30" stroke="var(--accent)" fill="none" strokeWidth="1" strokeDasharray="3 3"/>
                  <circle cx="20" cy="30" r="4" fill="var(--accent)"/>
                  <circle cx="240" cy="30" r="4" fill="var(--accent)"/>
                  <rect x="70" y="50" width="120" height="24" rx="4" fill="#0a0b0c" stroke="rgba(255,255,255,.08)"/>
                  <text className="node" x="130" y="66" textAnchor="middle" fill="var(--text2)">task · P1 · 45m</text>
                  <rect x="70" y="82" width="120" height="24" rx="4" fill="#0a0b0c" stroke="rgba(255,255,255,.08)"/>
                  <text className="node" x="130" y="98" textAnchor="middle" fill="var(--text2)">task · P2 · 15m</text>
                </svg>
              </div>
              <span className="arrow" />
            </div>
            <div className="step">
              <span className="num mono">STEP 03</span>
              <h4>Scheduled on write</h4>
              <p>Each task lands in the next open slot that respects your busy time and deadlines.</p>
              <div style={{ position: 'relative', height: 160, marginTop: 14 }}>
                <svg viewBox="0 0 260 140" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                  <g stroke="rgba(255,255,255,.08)" fill="#0a0b0c">
                    <rect x="10" y="30" width="46" height="90" rx="3"/>
                    <rect x="62" y="30" width="46" height="90" rx="3"/>
                    <rect x="114" y="30" width="46" height="90" rx="3"/>
                    <rect x="166" y="30" width="46" height="90" rx="3"/>
                    <rect x="218" y="30" width="32" height="90" rx="3"/>
                  </g>
                  <rect x="14" y="38" width="38" height="14" rx="2" fill="#28282c"/>
                  <rect x="66" y="54" width="38" height="16" rx="2" fill="var(--brand)">
                    <animate attributeName="y" values="54;50;54" dur="2s" repeatCount="indefinite"/>
                  </rect>
                  <rect x="118" y="72" width="38" height="20" rx="2" fill="var(--success)"/>
                  <rect x="170" y="44" width="38" height="14" rx="2" fill="#28282c"/>
                  <rect x="170" y="62" width="38" height="18" rx="2" fill="var(--brand)"/>
                  <text className="node" x="18" y="22">M</text><text className="node" x="70" y="22">T</text>
                  <text className="node" x="122" y="22">W</text><text className="node" x="174" y="22">T</text>
                  <text className="node" x="222" y="22">F</text>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features bento ───────────────────────────────────────── */}
      <section id="features">
        <div className="wrap">
          <div className="section-head">
            <h2>Six parts. One brain.</h2>
            <div className="meta">§ 02 — feature surface<br />interactive demos below</div>
          </div>
          <div className="bento" id="feat-bento">
            {/* Re-optimizer */}
            <BentoCell className="c-7" style={{ minHeight: 340 }}>
              <Corners />
              <span className="idx mono">FEAT 01</span>
              <span className="tag">schedule engine</span>
              <h3>Full-week re-optimize</h3>
              <p>Press once. Deadlines, urgency, meetings, focus blocks—Kairos solves the whole week as a constraint problem and writes the result back to Google Calendar.</p>
              <WeekOptimizerDemo />
            </BentoCell>

            {/* Plugins */}
            <BentoCell className="c-5" style={{ minHeight: 340 }}>
              <Corners />
              <span className="idx mono">FEAT 02</span>
              <span className="tag">extensibility</span>
              <h3>Plugin-first core</h3>
              <p>Swap the AI source. Add scratchpad parsers. Intercept scheduling. Ship as an npm module.</p>
              <PluginsDemo />
            </BentoCell>

            {/* Themes */}
            <BentoCell className="c-4" style={{ minHeight: 280 }}>
              <Corners />
              <span className="idx mono">FEAT 03</span>
              <span className="tag">marketplace</span>
              <h3>Theme packs</h3>
              <p>Community-built visual packs. Click to preview.</p>
              <ThemesDemo />
            </BentoCell>

            {/* BYOM */}
            <BentoCell className="c-4" style={{ minHeight: 280 }}>
              <Corners />
              <span className="idx mono">FEAT 04</span>
              <span className="tag">BYO model</span>
              <h3>Your model, your keys</h3>
              <p>OpenAI, Anthropic, or Ollama on your own box. Zero lock-in.</p>
              <BYOMDemo />
            </BentoCell>

            {/* Latency */}
            <BentoCell className="c-4" style={{ minHeight: 280 }}>
              <Corners />
              <span className="idx mono">FEAT 05</span>
              <span className="tag">performance</span>
              <h3>Extraction latency</h3>
              <p>p50 under a second on Haiku 4.5.</p>
              <LatencyDemo />
            </BentoCell>

            {/* Schedule on write */}
            <BentoCell className="c-6" style={{ minHeight: 260 }}>
              <Corners />
              <span className="idx mono">FEAT 06</span>
              <span className="tag">live behavior</span>
              <h3>Schedule-on-write</h3>
              <p>Type a task, watch it land. No save button, no &quot;add to calendar&quot; modal.</p>
              <SOWDemo />
            </BentoCell>

            {/* Self-host */}
            <BentoCell className="c-6" style={{ minHeight: 260 }}>
              <Corners />
              <span className="idx mono">FEAT 07</span>
              <span className="tag">ops</span>
              <h3>Self-host in 30 seconds</h3>
              <p>One Docker command. Or one-click deploy to Vercel. Everything is in your Postgres.</p>
              <pre className="mono" style={{ background: '#050506', border: '1px solid var(--b-def)', borderRadius: 6, padding: 12, margin: '14px 0 0', fontSize: 12, color: '#cdd3dd', overflowX: 'auto' }}>
                <span style={{ color: 'var(--accent)' }}>$</span>{' '}docker run -p 3000:3000 <span style={{ color: '#ffb86c' }}>ghcr.io/clupai/kairos:latest</span>
              </pre>
            </BentoCell>
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────── */}
      <section>
        <div className="wrap">
          <div className="stats" ref={statsRef}>
            <div className="s"><div className="n">247</div><div className="l">beta seats open</div></div>
            <div className="s"><div className="n">0.42s</div><div className="l">p50 extract latency</div></div>
            <div className="s"><div className="n">12kb</div><div className="l">plugin sdk gzipped</div></div>
            <div className="s"><div className="n">MIT</div><div className="l">open-source license</div></div>
          </div>
        </div>
      </section>

      {/* ── Deploy ───────────────────────────────────────────────── */}
      <section id="deploy">
        <div className="wrap">
          <div className="section-head">
            <h2>Deploy it your way.</h2>
            <div className="meta">§ 03 — shipping<br />vercel · docker · bare metal</div>
          </div>
          <div className="deploy">
            <div style={{ position: 'relative' }}>
              <span className="coord tl mono">vercel.sh</span>
              <div className="terminal" style={{ marginTop: 20 }}>
                <div className="t-top"><span className="d"/><span className="d"/><span className="d"/></div>
                <pre>
                  <span className="cmnt"># 1-click deploy — auto-configures Postgres + GCal OAuth{'\n'}</span>
                  <span className="prom">→</span>{' vercel deploy '}<span className="kw">--template</span>{' '}<span className="str">clupai/kairos{'\n\n'}</span>
                  <span className="cmnt"># env vars prompted:{'\n'}</span>
                  {'  '}<span className="kw">ANTHROPIC_API_KEY</span>{'='}<span className="str">{'sk-ant-...\n'}</span>
                  {'  '}<span className="kw">GOOGLE_OAUTH_ID</span>{'='}<span className="str">{'...\n'}</span>
                  {'  '}<span className="kw">DATABASE_URL</span>{'='}<span className="str">{'<auto>\n\n'}</span>
                  <span className="cmnt"># ✓ live at kairos-you.vercel.app in 34s</span>
                </pre>
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <span className="coord tl mono">docker</span>
              <div className="terminal" style={{ marginTop: 20 }}>
                <div className="t-top"><span className="d"/><span className="d"/><span className="d"/></div>
                <pre>
                  <span className="cmnt"># Self-host — keeps your data on your box{'\n'}</span>
                  <span className="prom">$</span>{' curl '}<span className="str">https://get.kairos.app</span>{' | sh\n\n'}
                  <span className="cmnt"># or manual:{'\n'}</span>
                  <span className="prom">$</span>{' docker run '}<span className="kw">-p</span>{' 3000:3000 \\\n'}
                  {'    '}<span className="kw">-v</span>{' '}<span className="str">./data:/app/data</span>{' \\\n'}
                  {'    '}<span className="kw">-e</span>{' '}<span className="str">{'ANTHROPIC_API_KEY=$KEY\n'}</span>
                  {'    ghcr.io/clupai/kairos:latest\n\n'}
                  <span className="cmnt"># ✓ open http://localhost:3000</span>
                </pre>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 24 }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>built on</span>
            <div className="stack">
              {['Next.js 16','React 19','Postgres 16','Drizzle ORM','Google Calendar API','Anthropic','OpenAI','Ollama','Tailwind 4','GSAP'].map(s => (
                <span key={s} className="s"><span className="sq"/>{s}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Beta CTA ─────────────────────────────────────────────── */}
      <section id="beta">
        <div className="wrap">
          <BetaForm />
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer>
        <div className="wrap">
          <div className="cols">
            <div>
              <div className="brandmark" style={{ marginBottom: 10 }}><span>Kairos</span></div>
              <p style={{ maxWidth: 360, margin: 0, lineHeight: 1.5 }}>
                A scheduling app that treats your calendar as a constraint problem, not a list. Built by{' '}
                <a href="#" style={{ color: 'var(--text2)', borderBottom: '1px solid var(--b-def)' }}>Clupai</a>.
              </p>
              <div className="mono" style={{ fontSize: 11, color: 'var(--subtle)', marginTop: 14 }}>kairos · greek · &quot;the opportune moment&quot;</div>
            </div>
            <div>
              <h5>Product</h5>
              <a href="#features">Features</a>
              <a href="#how">How it works</a>
              <a href="#deploy">Deploy</a>
              <a href="#">Changelog</a>
              <a href="#">Roadmap</a>
            </div>
            <div>
              <h5>Open source</h5>
              <a href="https://github.com/clupai8o0/kairos" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
              <a href="#">MIT license</a>
              <a href="/docs">Contributing</a>
              <a href="#">Plugin SDK</a>
            </div>
            <div>
              <h5>Clupai</h5>
              <a href="#">Marketplace</a>
              <a href="#">Other apps</a>
              <a href="#">About</a>
              <a href="#">Contact</a>
            </div>
          </div>
          <div className="legal">
            <div>© 2026 Clupai. Kairos is an open-source project.</div>
            <div className="mono">kairos/landing · build 1a4f91 · apr 19 2026</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
