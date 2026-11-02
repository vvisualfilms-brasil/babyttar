// Indicadores calculados a partir dos registros originais. Nada aqui é gravado.
import { BabyEvent, EventType, Medication, isRunning } from './types'
import { HOUR, dayKey, dayStart, daysTouched, nextDayStart, overlap } from './time'

/** Vigílias maiores que isso provavelmente são registro faltando; não contam como "acordado". */
const MAX_AWAKE_GAP = 12 * HOUR

export const endOf = (e: BabyEvent, now: number) => e.endedAt ?? (e.kind === 'interval' ? now : e.startedAt)

export interface DaySummary {
  day: string
  hasRecords: boolean
  feedings: number
  breastFeedings: number
  bottleFeedings: number
  bottleMl: number
  diapers: number
  pees: number
  poops: number // evacuações
  sleepMs: number
  awakeMs: number
  tummyMs: number
  tummySessions: number
  baths: number
  wakeTime: number | null // horário de despertar (ms) ou null
  meds: Record<string, number> // nome → doses
}

const inDay = (ts: number, from: number, to: number) => ts >= from && ts < to

export function daySummary(events: BabyEvent[], dayTs: number, now: number): DaySummary {
  const from = dayStart(dayTs)
  const to = nextDayStart(dayTs)
  const s: DaySummary = {
    day: dayKey(from), hasRecords: false, feedings: 0, breastFeedings: 0, bottleFeedings: 0, bottleMl: 0,
    diapers: 0, pees: 0, poops: 0, sleepMs: 0, awakeMs: 0, tummyMs: 0, tummySessions: 0, baths: 0, wakeTime: null, meds: {},
  }

  for (const e of events) {
    const end = endOf(e, now)
    if (overlap(e.startedAt, Math.max(end, e.startedAt + 1), from, to) > 0) s.hasRecords = true
    const starts = inDay(e.startedAt, from, to)
    switch (e.type) {
      case 'feeding':
        if (!starts) break
        s.feedings++
        if (e.data.method === 'bottle') { s.bottleFeedings++; s.bottleMl += e.data.volumeMl || 0 } else s.breastFeedings++
        break
      case 'diaper':
        if (!starts) break
        s.diapers++
        if (e.data.pee) s.pees++
        if (e.data.poop) s.poops += Math.max(1, e.data.poopCount || 1)
        break
      case 'sleep':
        s.sleepMs += overlap(e.startedAt, end, from, to)
        if (e.endedAt != null && e.data.context === 'night' && e.endedAt >= from + 4 * HOUR && e.endedAt < from + 12 * HOUR) {
          s.wakeTime = Math.max(s.wakeTime ?? 0, e.endedAt)
        }
        break
      case 'tummy':
        s.tummyMs += overlap(e.startedAt, end, from, to)
        if (starts) s.tummySessions++
        break
      case 'bath':
        if (starts) s.baths++
        break
      case 'medication':
        if (starts) s.meds[e.data.name] = (s.meds[e.data.name] ?? 0) + 1
        break
    }
  }
  s.awakeMs = awakeInRange(events, from, Math.min(to, now), now)
  return s
}

/** Tempo acordado = intervalos entre um sono e o próximo (vigílias), recortados no período. */
export function awakeInRange(events: BabyEvent[], from: number, to: number, now: number): number {
  if (to <= from) return 0
  const sleeps = events.filter((e) => e.type === 'sleep').sort((a, b) => a.startedAt - b.startedAt)
  let total = 0
  for (let i = 0; i < sleeps.length; i++) {
    const cur = sleeps[i]
    if (cur.endedAt == null) continue
    const next = sleeps[i + 1]
    const gapEnd = next ? next.startedAt : now
    if (gapEnd - cur.endedAt > MAX_AWAKE_GAP || gapEnd <= cur.endedAt) continue
    total += overlap(cur.endedAt, gapEnd, from, to)
  }
  return total
}

/** Dias (AAAA-MM-DD) que têm pelo menos um registro de qualquer tipo. */
export function recordedDays(events: BabyEvent[], now: number): Set<string> {
  const set = new Set<string>()
  for (const e of events) for (const d of daysTouched(e.startedAt, endOf(e, now))) set.add(d)
  return set
}

export interface PeriodStats {
  nDays: number
  daysWithData: number
  avg: {
    feedings: number
    poops: number
    diapers: number
    sleepMs: number
    awakeMs: number
    tummyMs: number
    bottleMl: number
    wakeMinutes: number | null // minutos desde a meia-noite
  }
  totals: { feedings: number; poops: number; diapers: number; sleepMs: number; tummyMs: number }
}

/**
 * Médias dos `nDays` dias completos antes de `endDayTs` (exclusivo).
 * Dias sem nenhum registro ficam de fora (não contam como zero).
 */
export function periodStats(events: BabyEvent[], endDayTs: number, nDays: number, now: number): PeriodStats {
  const recorded = recordedDays(events, now)
  const days: DaySummary[] = []
  let d = dayStart(endDayTs)
  for (let i = 0; i < nDays; i++) {
    d = dayStart(d - 1)
    if (recorded.has(dayKey(d))) days.push(daySummary(events, d, now))
  }
  const n = days.length
  const sum = (f: (s: DaySummary) => number) => days.reduce((a, s) => a + f(s), 0)
  const avg = (f: (s: DaySummary) => number) => (n ? sum(f) / n : 0)
  const wakes = days.filter((s) => s.wakeTime != null).map((s) => (s.wakeTime! - dayStart(s.wakeTime!)) / 60_000)
  return {
    nDays,
    daysWithData: n,
    avg: {
      feedings: avg((s) => s.feedings),
      poops: avg((s) => s.poops),
      diapers: avg((s) => s.diapers),
      sleepMs: avg((s) => s.sleepMs),
      awakeMs: avg((s) => s.awakeMs),
      tummyMs: avg((s) => s.tummyMs),
      bottleMl: avg((s) => s.bottleMl),
      wakeMinutes: wakes.length ? wakes.reduce((a, b) => a + b, 0) / wakes.length : null,
    },
    totals: {
      feedings: sum((s) => s.feedings),
      poops: sum((s) => s.poops),
      diapers: sum((s) => s.diapers),
      sleepMs: sum((s) => s.sleepMs),
      tummyMs: sum((s) => s.tummyMs),
    },
  }
}

export function lastOfType(events: BabyEvent[], type: EventType): BabyEvent | undefined {
  let best: BabyEvent | undefined
  for (const e of events) if (e.type === type && (!best || e.startedAt > best.startedAt)) best = e
  return best
}

export const runningOfType = (events: BabyEvent[], type: EventType) => events.find((e) => e.type === type && isRunning(e))

export interface MedStatus { med: Medication; givenToday: number; lastAt: number | null; done: boolean }

/** Status de cada remédio com meta diária (ex.: vitamina D 1×/dia). */
export function medStatus(meds: Medication[], events: BabyEvent[], now: number): MedStatus[] {
  const from = dayStart(now)
  const to = nextDayStart(now)
  return meds
    .filter((m) => m.active && m.dailyTarget)
    .map((med) => {
      const doses = events.filter(
        (e) => e.type === 'medication' && (e.data.medicationId === med.id || (!e.data.medicationId && e.data.name === med.name)) && inDay(e.startedAt, from, to),
      )
      const lastAt = doses.length ? Math.max(...doses.map((e) => e.startedAt)) : null
      return { med, givenToday: doses.length, lastAt, done: doses.length >= (med.dailyTarget ?? 1) }
    })
}

/** Lado sugerido para a próxima mamada no peito: o oposto de onde terminou a última. */
export function suggestedSide(events: BabyEvent[]): { last: 'left' | 'right' | null; next: 'left' | 'right' } {
  const breast = events
    .filter((e) => e.type === 'feeding' && e.data.method === 'breast' && e.endedAt != null)
    .sort((a, b) => b.startedAt - a.startedAt)[0]
  if (!breast || breast.type !== 'feeding' || breast.data.method !== 'breast') return { last: null, next: 'left' }
  const d = breast.data
  const last = d.endSide ?? (d.side === 'both' ? null : d.side)
  if (!last) return { last: null, next: 'left' }
  return { last, next: last === 'left' ? 'right' : 'left' }
}
