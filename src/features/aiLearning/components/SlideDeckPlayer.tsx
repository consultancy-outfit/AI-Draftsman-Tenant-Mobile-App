import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, Share, StyleSheet, Text, TouchableOpacity, View, type GestureResponderEvent } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui';

import type { ViewMilestone, ViewMilestoneTracker } from '../aiLearning.logic';
import type { AiShortDeck, AiShortSummary, AiSlide } from '../aiLearning.types';
import {
  HOLD_MS,
  askOptionState,
  countUpText,
  deckAccent,
  deckFraction,
  isDeckEnd,
  kindLabel,
  nextSlideIndex,
  parseCountable,
  pollThanks,
  prevSlideIndex,
  quizScore,
  scoreLine,
  segmentFill,
  slideDuration,
  statArrow,
  swipeDirection,
  tapZone,
  tryItLabel,
  waitsForAnswer,
} from '../slideDeck.logic';

const FALLBACK_ACCENT = '#C8622A';
/** Narration longer than the recorded duration still plays out; this is the grace before the timer gives up on it. */
const AUDIO_GRACE_S = 4;
/** Finger travel (px) past which a touch is a swipe, not a press-and-hold. */
const MOVE_SLOP = 10;

interface SlideDeckPlayerProps {
  short: AiShortSummary & { deck: AiShortDeck };
  current: boolean;
  tracker: ViewMilestoneTracker;
  onMilestone: (shortId: string, milestone: ViewMilestone, positionS: number) => void;
}

/** A touch on a control inside a slide must not also count as a tap-zone / swipe on the deck. */
function Interactive({ children, style }: { children: ReactNode; style?: object }) {
  const stop = (e: GestureResponderEvent) => e.stopPropagation();
  return (
    <View style={style} onTouchStart={stop} onTouchEnd={stop} onTouchMove={stop}>
      {children}
    </View>
  );
}

/**
 * A slide-deck short rendered as a story: one narrated card per slide.
 * Tap the left third for back, the rest for forward; swipe sideways to page;
 * press and hold to pause. Quiz and poll slides hold the deck until answered.
 * Nothing is stored: answers and the score live in this component only.
 */
export function SlideDeckPlayer({ short, current, tracker, onMilestone }: SlideDeckPlayerProps) {
  const insets = useSafeAreaInsets();
  const { deck } = short;
  const slides = deck.slides;
  const accent = deckAccent(deck.accent, FALLBACK_ACCENT);

  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [held, setHeld] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [width, setWidth] = useState(0);
  const slide = slides[Math.min(index, slides.length - 1)] as AiSlide;
  const answered = Boolean(answers[slide.id]);
  const waiting = waitsForAnswer(slide, answered);
  const running = current && !held && !waiting;

  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didHold = useRef(false);

  const go = useCallback(
    (dir: 'next' | 'prev') => {
      setElapsed(0);
      setIndex((i) => (dir === 'next' ? nextSlideIndex(i, slides.length) : prevSlideIndex(i)));
    },
    [slides.length],
  );

  /* Narration: one player per slide; it recreates when the slide's source changes. */
  const audio = useAudioPlayer(slide.audioUrl ? { uri: slide.audioUrl } : null);
  const audioStatus = useAudioPlayerStatus(audio);
  useEffect(() => {
    if (!slide.audioUrl) return;
    if (running) audio.play();
    else audio.pause();
  }, [running, audio, slide.audioUrl]);

  /* The clock behind the progress bar. */
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((e) => e + 0.1), 100);
    return () => clearInterval(id);
  }, [running]);

  /* Auto-advance: narration finished, or (no audio / audio failed) the slide's own duration is up. */
  const limit = slideDuration(slide) + (slide.audioUrl ? AUDIO_GRACE_S : 0);
  useEffect(() => {
    if (!running || isDeckEnd(index, slides.length)) return;
    if ((slide.audioUrl && audioStatus.didJustFinish) || (!slide.audioUrl && elapsed >= slideDuration(slide)) || elapsed >= limit) {
      go('next');
    }
  }, [running, elapsed, audioStatus.didJustFinish, slide, limit, index, slides.length, go]);

  /* View milestones: the call-to-action slide counts as the end. */
  useEffect(() => {
    if (!current) return;
    const ended = isDeckEnd(index, slides.length);
    const fresh = tracker.take(short.id, deckFraction(slides, index, elapsed), ended);
    const top = fresh[fresh.length - 1];
    if (top) onMilestone(short.id, top, 0);
  }, [current, index, elapsed, slides, short.id, tracker, onMilestone]);

  /* Scrolled away: stop talking. */
  useEffect(() => {
    if (!current) setHeld(false);
  }, [current]);

  const onTouchStart = (e: GestureResponderEvent) => {
    const { pageX, pageY } = e.nativeEvent;
    touch.current = { x: pageX, y: pageY, t: Date.now() };
    didHold.current = false;
    holdTimer.current = setTimeout(() => {
      didHold.current = true;
      setHeld(true);
    }, HOLD_MS);
  };
  /* A finger that moves is a swipe or a scroll, never a press-and-hold. */
  const onTouchMove = (e: GestureResponderEvent) => {
    const start = touch.current;
    if (!start || !holdTimer.current) return;
    const { pageX, pageY } = e.nativeEvent;
    if (Math.abs(pageX - start.x) > MOVE_SLOP || Math.abs(pageY - start.y) > MOVE_SLOP) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };
  /* The feed took the gesture (vertical scroll): drop the hold, or the deck would stay paused. */
  const onTouchCancel = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    touch.current = null;
    didHold.current = false;
    setHeld(false);
  };
  const onTouchEnd = (e: GestureResponderEvent) => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    if (didHold.current) {
      setHeld(false);
      return;
    }
    const { pageX, pageY, locationX } = e.nativeEvent;
    const swipe = swipeDirection(pageX - start.x, pageY - start.y);
    if (swipe) {
      if (swipe === 'next' && waiting) return;
      go(swipe);
      return;
    }
    const zone = tapZone(locationX, width);
    if (zone === 'next' && waiting) return;
    go(zone);
  };

  const quiz = useMemo(() => quizScore(slides, answers), [slides, answers]);
  const last = isDeckEnd(index, slides.length);

  return (
    <View
      style={[styles.root, { backgroundColor: '#14110F' }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
    >
      <View style={styles.segments}>
        {slides.map((s, i) => {
          const fill = segmentFill(i, index, elapsed / slideDuration(s));
          return (
            <View key={s.id} style={styles.segment}>
              <View style={{ width: `${fill * 100}%`, height: '100%', backgroundColor: '#fff' }} />
            </View>
          );
        })}
      </View>

      {/* The pager runs to the screen's bottom edge: keep text clear of an iPhone's home indicator. */}
      <View style={[styles.body, { paddingBottom: 24 + insets.bottom }]}>
        {kindLabel(slide.kind) ? (
          <View style={[styles.badge, { backgroundColor: accent }]}>
            <Text style={styles.badgeText}>{kindLabel(slide.kind)}</Text>
          </View>
        ) : null}
        <Text style={styles.heading}>{slide.heading}</Text>
        <SlideBody
          slide={slide}
          accent={accent}
          answer={answers[slide.id] ?? null}
          onAnswer={(id) => setAnswers((a) => ({ ...a, [slide.id]: id }))}
          score={last ? scoreLine(quiz) : null}
          shortTitle={short.title}
        />
      </View>

      {held ? (
        <View style={styles.pausedBadge} pointerEvents="none">
          <Icon name="pause" size={18} color="#fff" />
        </View>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Slide bodies                                                               */
/* -------------------------------------------------------------------------- */

interface SlideBodyProps {
  slide: AiSlide;
  accent: string;
  answer: string | null;
  onAnswer: (optionId: string) => void;
  score: string | null;
  shortTitle: string;
}

function SlideBody({ slide, accent, answer, onAnswer, score, shortTitle }: SlideBodyProps) {
  const body = slide.body ? <Text style={styles.text}>{slide.body}</Text> : null;

  switch (slide.kind) {
    case 'stat':
      return (
        <>
          {slide.stat ? <StatBlock stat={slide.stat} accent={accent} /> : null}
          {body}
        </>
      );
    case 'compare':
      return (
        <>
          {body}
          <View style={{ gap: 10 }}>
            {(slide.rows ?? []).map((r, i) => (
              <StatBlock key={`${r.label}-${i}`} stat={r} accent={accent} compact />
            ))}
          </View>
        </>
      );
    case 'facts':
      return (
        <>
          {body}
          <FactCards facts={slide.facts ?? []} accent={accent} />
        </>
      );
    case 'roles':
      return (
        <>
          {body}
          <RoleChips roles={slide.roles ?? []} accent={accent} />
        </>
      );
    case 'tryit':
      return (
        <>
          {body}
          <TryIt prompt={slide.prompt ?? ''} model={slide.model} accent={accent} />
        </>
      );
    case 'quiz':
    case 'poll':
      return (
        <>
          {slide.question ? <Text style={[styles.text, { fontWeight: '600', color: '#fff' }]}>{slide.question}</Text> : null}
          <View style={{ gap: 8 }}>
            {(slide.options ?? []).map((o) => {
              const state = askOptionState(slide, answer, o.id);
              const bg =
                state === 'correct' ? 'rgba(46,160,90,0.35)' : state === 'wrong' ? 'rgba(200,60,60,0.35)' : 'rgba(255,255,255,0.1)';
              return (
                <Interactive key={o.id}>
                  <TouchableOpacity
                    disabled={Boolean(answer)}
                    onPress={() => onAnswer(o.id)}
                    accessibilityRole="button"
                    style={[styles.option, { backgroundColor: bg, opacity: state === 'muted' ? 0.5 : 1, borderColor: state === 'idle' ? 'rgba(255,255,255,0.25)' : 'transparent' }]}
                  >
                    <Text style={styles.optionText}>{o.text}</Text>
                  </TouchableOpacity>
                </Interactive>
              );
            })}
          </View>
          {answer && slide.kind === 'quiz' && slide.explanation ? <Text style={styles.text}>{slide.explanation}</Text> : null}
          {answer && slide.kind === 'poll' ? <Text style={styles.text}>{pollThanks(slide, answer)}</Text> : null}
          {!answer ? <Text style={styles.hint}>Pick an answer to continue</Text> : null}
        </>
      );
    case 'cta':
      return (
        <>
          {body}
          {score ? <Text style={[styles.text, { color: '#fff', fontWeight: '700' }]}>{score}</Text> : null}
          <Interactive>
            <TouchableOpacity
              onPress={() => void Share.share({ message: `${shortTitle} — an AI update short from AIDraftsMan` })}
              accessibilityRole="button"
              style={[styles.cta, { backgroundColor: accent }]}
            >
              <Icon name="share" size={18} color="#fff" />
              <Text style={styles.ctaText}>Share</Text>
            </TouchableOpacity>
          </Interactive>
        </>
      );
    default:
      /* headline, why, who, and any kind this client does not know yet. */
      return body;
  }
}

function StatBlock({ stat, accent, compact = false }: { stat: NonNullable<AiSlide['stat']>; accent: string; compact?: boolean }) {
  const target = useMemo(() => parseCountable(stat.after), [stat.after]);
  const [progress, setProgress] = useState(target ? 0 : 1);
  useEffect(() => {
    if (!target || compact) {
      setProgress(1);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / 700);
      setProgress(p);
      if (p >= 1) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
  }, [target, compact]);
  const shown = target && !compact ? countUpText(target, progress) : stat.after;
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{stat.label}</Text>
      <View style={styles.statRow}>
        {stat.before ? <Text style={styles.statBefore}>{stat.before}</Text> : null}
        <Text style={[styles.statArrow, { color: accent }]}>{statArrow(stat)}</Text>
        <Text style={[styles.statAfter, compact && { fontSize: 20 }]}>{shown}</Text>
      </View>
    </View>
  );
}

function FactCards({ facts, accent }: { facts: Array<{ label: string; value: string }>; accent: string }) {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  return (
    <View style={styles.wrap}>
      {facts.map((f, i) => (
        <Interactive key={`${f.label}-${i}`} style={styles.half}>
          <TouchableOpacity onPress={() => setOpen((o) => ({ ...o, [i]: !o[i] }))} accessibilityRole="button" style={[styles.fact, open[i] && { backgroundColor: accent }]}>
            <Text style={styles.factLabel}>{f.label}</Text>
            <Text style={styles.factValue}>{open[i] ? f.value : 'Tap to reveal'}</Text>
          </TouchableOpacity>
        </Interactive>
      ))}
    </View>
  );
}

function RoleChips({ roles, accent }: { roles: Array<{ role: string; why: string }>; accent: string }) {
  const [active, setActive] = useState<number | null>(null);
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.wrap}>
        {roles.map((r, i) => (
          <Interactive key={`${r.role}-${i}`}>
            <TouchableOpacity
              onPress={() => setActive((a) => (a === i ? null : i))}
              accessibilityRole="button"
              style={[styles.chip, active === i && { backgroundColor: accent, borderColor: accent }]}
            >
              <Text style={styles.chipText}>{r.role}</Text>
            </TouchableOpacity>
          </Interactive>
        ))}
      </View>
      {active !== null && roles[active] ? <Text style={styles.text}>{roles[active]?.why}</Text> : null}
    </View>
  );
}

function TryIt({ prompt, model, accent }: { prompt: string; model: string | null | undefined; accent: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.hint}>{tryItLabel(model)}</Text>
      <ScrollView style={styles.promptBox} nestedScrollEnabled>
        <Text style={styles.prompt}>{prompt}</Text>
      </ScrollView>
      <Interactive>
        <TouchableOpacity
          onPress={() => {
            void Clipboard.setStringAsync(prompt).then(() => setCopied(true));
          }}
          accessibilityRole="button"
          style={[styles.cta, { backgroundColor: accent }]}
        >
          <Icon name={copied ? 'check' : 'content-copy'} size={18} color="#fff" />
          <Text style={styles.ctaText}>{copied ? 'Copied' : 'Copy prompt'}</Text>
        </TouchableOpacity>
      </Interactive>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  segments: { flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingTop: 12 },
  segment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  body: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  heading: { color: '#fff', fontSize: 28, lineHeight: 34, fontWeight: '800' },
  text: { color: 'rgba(255,255,255,0.88)', fontSize: 17, lineHeight: 25 },
  hint: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  stat: { gap: 6 },
  statLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600' },
  statRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  statBefore: { color: 'rgba(255,255,255,0.55)', fontSize: 20, textDecorationLine: 'line-through' },
  statArrow: { fontSize: 24, fontWeight: '800' },
  statAfter: { color: '#fff', fontSize: 38, fontWeight: '800' },
  option: { padding: 14, borderRadius: 14, borderWidth: 1 },
  optionText: { color: '#fff', fontSize: 16 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 999 },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  half: { width: '47%' },
  fact: { padding: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', gap: 4, minHeight: 78 },
  factLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600' },
  factValue: { color: '#fff', fontSize: 16, fontWeight: '700' },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  chipText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  promptBox: { maxHeight: 180, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)' },
  prompt: { color: '#fff', fontSize: 14, lineHeight: 20 },
  pausedBadge: { position: 'absolute', top: 28, right: 16, padding: 6, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.5)' },
});
