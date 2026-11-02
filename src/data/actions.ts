// Ações de registro usadas pelas telas.
import { BabyEvent, BreastData, EventType, KIND, newId } from '../domain/types'
import { suggestSleepContext } from '../domain/time'
import { put, userName } from './store'

type DataOf<T extends EventType> = Extract<BabyEvent, { type: T }>['data']

export function makeEvent<T extends EventType>(type: T, data: DataOf<T>, startedAt: number, endedAt: number | null = null): BabyEvent {
  const now = Date.now()
  return {
    col: 'event', id: newId(), type, kind: KIND[type], data, startedAt, endedAt, note: null,
    createdBy: userName(), createdAt: now, updatedAt: now, updatedBy: userName(), deletedAt: null, schemaVersion: 1,
  } as BabyEvent
}

export const save = (e: BabyEvent) => put(e)

export function startSleep(at: number) {
  return put(makeEvent('sleep', { context: suggestSleepContext(at) }, at))
}

export function startTimer(type: 'tummy', at: number) {
  return put(makeEvent(type, {}, at))
}

export function finish(e: BabyEvent, at: number) {
  if (e.type === 'feeding' && e.data.method === 'breast') return put({ ...e, endedAt: at, data: closeBreast(e.data, at) })
  return put({ ...e, endedAt: Math.max(at, e.startedAt) } as BabyEvent)
}

export function startBreast(side: 'left' | 'right', at: number, both = false) {
  const data: BreastData = { method: 'breast', side: both ? 'both' : side, leftSec: 0, rightSec: 0, activeSide: side, segStart: at }
  return put(makeEvent('feeding', data, at))
}

/** Fecha o trecho do lado atual e soma ao total daquele lado. */
function closeSegment(d: BreastData, at: number): BreastData {
  if (!d.activeSide || d.segStart == null) return d
  const sec = Math.max(0, Math.round((at - d.segStart) / 1000))
  return d.activeSide === 'left' ? { ...d, leftSec: d.leftSec + sec } : { ...d, rightSec: d.rightSec + sec }
}

function closeBreast(d: BreastData, at: number): BreastData {
  const c = closeSegment(d, at)
  const side = c.leftSec > 0 && c.rightSec > 0 ? 'both' : c.rightSec > 0 ? 'right' : c.leftSec > 0 ? 'left' : d.side
  return { ...c, side, endSide: d.activeSide ?? null, activeSide: null, segStart: null }
}

export function switchSide(e: BabyEvent, at = Date.now()) {
  if (e.type !== 'feeding' || e.data.method !== 'breast') return e
  const c = closeSegment(e.data, at)
  const next = e.data.activeSide === 'left' ? 'right' : 'left'
  return put({ ...e, data: { ...c, side: 'both', activeSide: next, segStart: at } })
}

/** Segundos de cada lado, contando o trecho em andamento. */
export function breastLive(d: BreastData, now: number) {
  const run = d.activeSide && d.segStart != null ? Math.max(0, (now - d.segStart) / 1000) : 0
  return { left: d.leftSec + (d.activeSide === 'left' ? run : 0), right: d.rightSec + (d.activeSide === 'right' ? run : 0) }
}
