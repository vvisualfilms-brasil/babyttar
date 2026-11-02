import { describe, it, expect } from 'vitest'
import { BabyEvent } from './types'
import { daySummary, periodStats, recordedDays, medStatus, suggestedSide, awakeInRange } from './stats'
import { ageText, fmtDuration, HOUR, MIN } from './time'

const t = (s: string) => new Date(s).getTime() // horário local
let n = 0
const base = { col: 'event' as const, updatedAt: 0, updatedBy: 'Pai', deletedAt: null, schemaVersion: 1 as const, note: null, createdBy: 'Pai', createdAt: 0 }
const sleep = (a: string, b: string | null, context: 'nap' | 'night' = 'night'): BabyEvent =>
  ({ ...base, id: `s${n++}`, type: 'sleep', kind: 'interval', startedAt: t(a), endedAt: b ? t(b) : null, data: { context } })
const diaper = (a: string, pee: boolean, poop: boolean, poopCount = 1): BabyEvent =>
  ({ ...base, id: `d${n++}`, type: 'diaper', kind: 'point', startedAt: t(a), endedAt: null, data: { pee, poop, poopCount } })
const bottle = (a: string, ml: number): BabyEvent =>
  ({ ...base, id: `f${n++}`, type: 'feeding', kind: 'interval', startedAt: t(a), endedAt: t(a) + 10 * MIN, data: { method: 'bottle', volumeMl: ml, milk: 'formula' } })

describe('meia-noite', () => {
  it('divide o sono entre os dois dias', () => {
    const ev = [sleep('2026-11-01T22:00', '2026-11-02T03:00')]
    const now = t('2026-11-03T12:00')
    expect(daySummary(ev, t('2026-11-01T12:00'), now).sleepMs).toBe(2 * HOUR)
    expect(daySummary(ev, t('2026-11-02T12:00'), now).sleepMs).toBe(3 * HOUR)
  })
  it('sono em andamento conta até agora', () => {
    const ev = [sleep('2026-11-02T22:00', null)]
    expect(daySummary(ev, t('2026-11-02T12:00'), t('2026-11-02T23:30')).sleepMs).toBe(1.5 * HOUR)
  })
})

describe('dias sem registro', () => {
  it('não entram na média como zero', () => {
    const ev = [
      diaper('2026-11-01T08:00', true, true), diaper('2026-11-01T12:00', true, true),
      // 02/11 sem nada
      diaper('2026-11-03T09:00', true, false),
    ]
    const p = periodStats(ev, t('2026-11-04T10:00'), 7, t('2026-11-04T10:00'))
    expect(p.daysWithData).toBe(2)
    expect(p.avg.diapers).toBe(1.5)
    expect(p.avg.poops).toBe(1) // dia 3 tem registro e zero cocô: conta como zero
  })
  it('sono que atravessa a noite marca os dois dias como registrados', () => {
    const days = recordedDays([sleep('2026-11-01T23:00', '2026-11-02T02:00')], 0)
    expect([...days]).toEqual(['2026-11-01', '2026-11-02'])
  })
})

describe('totais do dia', () => {
  it('conta evacuações, mamadas e volume', () => {
    const ev = [diaper('2026-11-02T08:00', false, true, 2), diaper('2026-11-02T10:00', true, false), bottle('2026-11-02T09:00', 90), bottle('2026-11-02T13:00', 60)]
    const s = daySummary(ev, t('2026-11-02T12:00'), t('2026-11-02T20:00'))
    expect(s.poops).toBe(2)
    expect(s.pees).toBe(1)
    expect(s.diapers).toBe(2)
    expect(s.feedings).toBe(2)
    expect(s.bottleMl).toBe(150)
  })
  it('horário de despertar = fim do sono noturno da manhã', () => {
    const ev = [sleep('2026-11-01T21:00', '2026-11-02T02:00'), sleep('2026-11-02T02:40', '2026-11-02T06:45'), sleep('2026-11-02T09:00', '2026-11-02T10:00', 'nap')]
    expect(daySummary(ev, t('2026-11-02T12:00'), t('2026-11-02T20:00')).wakeTime).toBe(t('2026-11-02T06:45'))
  })
  it('tempo acordado = vigílias entre sonos, ignorando buracos > 12h', () => {
    const ev = [sleep('2026-11-02T06:00', '2026-11-02T07:00'), sleep('2026-11-02T08:30', '2026-11-02T09:00')]
    expect(awakeInRange(ev, t('2026-11-02T00:00'), t('2026-11-02T10:00'), t('2026-11-02T10:00'))).toBe(1.5 * HOUR + 1 * HOUR)
    expect(awakeInRange(ev, t('2026-11-02T00:00'), t('2026-11-03T00:00'), t('2026-11-03T08:00'))).toBe(1.5 * HOUR + 15 * HOUR - 15 * HOUR) // 23h acordado > 12h: ignorado
  })
})

describe('vitamina D e lado da mamada', () => {
  const med = { col: 'medication' as const, id: 'vitd', name: 'Vitamina D', defaultDose: 2, unit: 'gotas', dailyTarget: 1, active: true, updatedAt: 0, updatedBy: 'Pai', deletedAt: null, schemaVersion: 1 as const }
  it('status pendente/ok', () => {
    const dose: BabyEvent = { ...base, id: 'm1', type: 'medication', kind: 'point', startedAt: t('2026-11-02T09:10'), endedAt: null, data: { medicationId: 'vitd', name: 'Vitamina D', dose: 2, unit: 'gotas' } }
    expect(medStatus([med], [], t('2026-11-02T12:00'))[0].done).toBe(false)
    expect(medStatus([med], [dose], t('2026-11-02T12:00'))[0].done).toBe(true)
    expect(medStatus([med], [dose], t('2026-11-03T08:00'))[0].done).toBe(false)
  })
  it('sugere o lado oposto ao que terminou', () => {
    const f: BabyEvent = { ...base, id: 'b', type: 'feeding', kind: 'interval', startedAt: 1, endedAt: 2, data: { method: 'breast', side: 'both', leftSec: 300, rightSec: 200, endSide: 'right' } }
    expect(suggestedSide([f])).toEqual({ last: 'right', next: 'left' })
  })
})

describe('textos', () => {
  it('idade', () => {
    expect(ageText('2026-08-22', t('2026-11-02T10:00'))).toBe('2 meses e 11 dias')
    expect(ageText('2026-10-18', t('2026-11-02T10:00'))).toBe('15 dias')
    expect(ageText('2026-10-02', t('2026-11-02T10:00'))).toBe('1 mês')
    expect(ageText('2024-08-02', t('2026-11-02T10:00'))).toBe('2 anos e 3 meses')
  })
  it('duração', () => {
    expect(fmtDuration(65 * MIN)).toBe('1h 05min')
    expect(fmtDuration(45 * MIN)).toBe('45 min')
  })
})
