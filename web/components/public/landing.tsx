'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, ShieldCheck, X } from 'lucide-react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { Counter, EASE_OUT_EXPO, Magnetic, Marquee, Reveal, SplitWords, Stagger, StaggerItem } from '@/components/motion/primitives';
import { OutcomeChip } from '@/components/shared/outcome-chip';
import { Button } from '@/components/ui/button';
import { SmoothScroll } from './smooth-scroll';

const CHIPS = ['CBSE / SCI.10.4.2', 'IB_DP / BIO.2.1', 'IGCSE / 0610.6.2', 'AP / BIO.3.4', 'CBSE / MATH.9.2.1', 'CAMB_LOWER_SEC / 7Bp.03', 'IB_MYP / SCI.C.iii', 'CBSE / SST.8.3.1', 'CAMB_PRIMARY / 5Ss.01'];

const MODULES = [
  { code: 'SETU', name: 'Curriculum spine', copy: 'One concept graph. CBSE, IB, Cambridge and AP outcomes mapped onto it, every link confirmed by a human.', span: 'md:col-span-2' },
  { code: 'PRASHNA', name: 'Items & papers', copy: 'Competency item bank and blueprint-compliant papers, assembled by constraint, not by guessing.', span: '' },
  { code: 'SAARTHI', name: 'Teacher copilot', copy: 'Lesson plans, differentiated worksheets, rubrics and parent messages — always from an outcome, never from a blank box.', span: '' },
  { code: 'DARPAN', name: 'Progress cards', copy: 'Holistic Progress Cards a teacher can actually finish for 40 children, with 360° inputs and guarded narratives.', span: '' },
  { code: 'UDAY', name: 'AI & CT programme', copy: 'The Classes 3–8 mandate delivered and provable: scheme of work, hours ledger, evidence pack.', span: 'md:col-span-2' },
];

const REFUSALS = ['Assign a final grade', 'Score student work for AI use', 'Profile, rank or predict a child', 'Send student PII to any model', 'Reach a student without a teacher’s approval'];

function Steps() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 80%', 'end 40%'] });
  const line = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);
  const steps = [
    { n: '01', t: 'Start from an outcome', c: 'A teacher picks a unit or a learning outcome in a named framework. Generation cannot start from nothing.' },
    { n: '02', t: 'Redact, generate, validate', c: 'Student and guardian PII is replaced with placeholders before the prompt exists. Output is checked against a schema; invalid output never renders.' },
    { n: '03', t: 'A human approves', c: 'The approval card shows the draft beside the teacher’s edit. Nothing is published, printed or assigned without an approvals row — enforced by the database.' },
  ];
  return (
    <div ref={ref} className="relative grid gap-10 md:grid-cols-[1fr_2fr]">
      <div className="md:sticky md:top-28 md:self-start">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">How it works</p>
        <h2 className="mt-3 font-display text-display-lg font-medium tracking-tight">Outsource the doing, not the thinking.</h2>
      </div>
      <ol className="relative flex flex-col gap-10 border-l pl-8">
        {!reduced && <motion.span aria-hidden className="absolute -left-px top-0 w-px bg-primary" style={{ height: line }} />}
        {steps.map((s, i) => (
          <Reveal as="li" key={s.n} delay={i * 0.05}>
            <span className="absolute -left-[5px] mt-2 size-2.5 rounded-full bg-primary ring-4 ring-background" aria-hidden />
            <p className="font-mono text-xs text-muted-foreground">{s.n}</p>
            <h3 className="mt-1 font-display text-2xl font-medium">{s.t}</h3>
            <p className="mt-2 max-w-prose text-muted-foreground">{s.c}</p>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}

export function Landing() {
  const reduced = useReducedMotion();
  return (
    <SmoothScroll>
      <div className="min-h-svh bg-background text-foreground">
        <header className="glass fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between px-5 lg:px-10">
          <Link href="/" className="flex items-center gap-2.5" aria-label="ACHARYA">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <span className="font-display text-[15px] font-semibold">A</span>
            </span>
            <span className="font-display text-lg font-medium tracking-tight">ACHARYA</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex" aria-label="Site">
            <a href="#modules" className="hover:text-foreground">Modules</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#safety" className="hover:text-foreground">Safety</a>
          </nav>
          <Button render={<Link href="/login" />} nativeButton={false} size="sm">
            Sign in
          </Button>
        </header>

        <section className="relative overflow-hidden px-5 pb-16 pt-36 lg:px-10 lg:pt-44">
          <div aria-hidden className="pointer-events-none absolute -top-40 right-[-10%] size-[42rem] rounded-full bg-primary/10 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-52 left-[-10%] size-[36rem] rounded-full bg-navy/10 blur-3xl" />
          <div className="mx-auto max-w-6xl">
            <motion.p initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 text-primary" /> Built for CBSE · IB · Cambridge · AP schools, DPDP-ready
            </motion.p>
            <SplitWords text="Your teachers already use AI. Make it aligned, safe, and approved." className="mt-6 max-w-5xl font-display text-display-xl font-medium tracking-tight" delay={0.1} />
            <motion.p initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.8, ease: EASE_OUT_EXPO }} className="mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              ACHARYA generates aligned drafts, never decisions. Every output ties to a learning outcome, is validated before a human sees it, and waits for a teacher before it reaches a child.
            </motion.p>
            <motion.div initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85, duration: 0.8, ease: EASE_OUT_EXPO }} className="mt-10 flex flex-wrap items-center gap-4">
              <Magnetic strength={0.18}>
                <Button render={<Link href="/login" />} nativeButton={false} size="lg" className="h-12 px-6 shadow-glow">
                  See the demo <ArrowRight className="size-4" />
                </Button>
              </Magnetic>
              <a href="#safety" className="text-sm font-medium text-foreground/80 underline-offset-4 hover:underline">
                What it refuses to do
              </a>
            </motion.div>
          </div>
        </section>

        <div className="border-y bg-card py-4">
          <Marquee duration={44}>
            {CHIPS.map((c) => {
              const [fw, ref] = c.split(' / ');
              return <OutcomeChip key={c} outcome={{ frameworkCode: fw, refCode: ref, statement: 'Outcome-tagged. Click any chip in the app to see every artifact tied to it.' }} />;
            })}
          </Marquee>
        </div>

        <section id="modules" className="px-5 py-24 lg:px-10">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <p className="text-xs font-medium uppercase tracking-wider text-primary">Five modules, one spine</p>
              <h2 className="mt-3 max-w-3xl font-display text-display-lg font-medium tracking-tight">Everything resolves against the confirmed outcome graph.</h2>
            </Reveal>
            <Stagger className="mt-12 grid gap-4 md:grid-cols-3">
              {MODULES.map((m) => (
                <StaggerItem key={m.code} className={m.span}>
                  <motion.article whileHover={reduced ? undefined : { y: -4 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }} className="card-surface group h-full p-6">
                    <p className="font-mono text-xs text-primary">{m.code}</p>
                    <h3 className="mt-2 font-display text-2xl font-medium">{m.name}</h3>
                    <p className="mt-3 text-muted-foreground">{m.copy}</p>
                  </motion.article>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>

        <section id="how" className="border-t bg-card px-5 py-24 lg:px-10">
          <div className="mx-auto max-w-6xl">
            <Steps />
          </div>
        </section>

        <section id="safety" className="px-5 py-24 lg:px-10">
          <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2">
            <Reveal>
              <p className="text-xs font-medium uppercase tracking-wider text-primary">Safety, by construction</p>
              <h2 className="mt-3 font-display text-display-lg font-medium tracking-tight">What ACHARYA refuses to do.</h2>
              <p className="mt-4 text-muted-foreground">Not policies. Database triggers, row-level security, and a gateway that redacts before a prompt exists.</p>
              <dl className="mt-10 grid grid-cols-3 gap-6">
                {[{ v: 0, l: 'PII spans to models' }, { v: 100, l: '% approvals logged' }, { v: 4, l: 'boards from day one' }].map((s) => (
                  <div key={s.l}>
                    <dt className="font-display text-4xl font-medium">
                      <Counter value={s.v} />
                    </dt>
                    <dd className="mt-1 text-sm text-muted-foreground">{s.l}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
            <Stagger className="flex flex-col gap-3">
              {REFUSALS.map((r) => (
                <StaggerItem key={r} className="card-surface flex items-center gap-3 px-5 py-4">
                  <span className="grid size-7 place-items-center rounded-full bg-rejected text-rejected-foreground">
                    <X className="size-4" />
                  </span>
                  <span className="font-medium">{r}</span>
                </StaggerItem>
              ))}
              <StaggerItem className="card-surface flex items-center gap-3 border-approved-foreground/30 px-5 py-4">
                <span className="grid size-7 place-items-center rounded-full bg-approved text-approved-foreground">
                  <Check className="size-4" />
                </span>
                <span className="font-medium">Draft, align, validate — then a teacher decides.</span>
              </StaggerItem>
            </Stagger>
          </div>
        </section>

        <footer className="border-t px-5 py-10 text-sm text-muted-foreground lg:px-10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
            <p>ACHARYA · Demo tenant is fictional. Synthetic data only.</p>
            <p>Data residency: ap-south-1 (Mumbai)</p>
          </div>
        </footer>
      </div>
    </SmoothScroll>
  );
}
