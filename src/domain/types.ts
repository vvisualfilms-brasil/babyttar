// Formato dos registros originais. Tudo é guardado com este envelope.

export type Col = 'baby' | 'event' | 'medication' | 'measurement'

export interface Base {
  col: Col
  id: string
  updatedAt: number // ms; decide qual versão vale
  updatedBy: string // "Pai", "Mãe"…
  deletedAt: number | null // lixeira
  schemaVersion: 1
}

export interface Baby extends Base {
  col: 'baby'
  name: string
  birthDate: string // AAAA-MM-DD
  sex: 'female' | 'male'
  photo: string | null // data URL comprimida
}

export interface Medication extends Base {
  col: 'medication'
  name: string
  defaultDose: number | null
  unit: string // gotas, ml, mg…
  dailyTarget: number | null // vezes por dia (para o status)
  active: boolean
}

export interface Measurement extends Base {
  col: 'measurement'
  measuredAt: string // AAAA-MM-DD
  weightG: number | null
  lengthMm: number | null
  headMm: number | null
  source: 'home' | 'pediatra'
  note: string | null
}

export type EventType = 'sleep' | 'feeding' | 'diaper' | 'tummy' | 'bath' | 'medication'

export interface SleepData { context: 'nap' | 'night' }
export interface BreastData {
  method: 'breast'
  side: 'left' | 'right' | 'both'
  leftSec: number
  rightSec: number
  activeSide?: 'left' | 'right' | null // só enquanto está em andamento
  segStart?: number | null // início do trecho atual (ms)
  endSide?: 'left' | 'right' | null // lado em que terminou (para sugerir o próximo)
}
export interface BottleData { method: 'bottle'; volumeMl: number; milk: 'breast_milk' | 'formula' }
export type FeedingData = BreastData | BottleData
export interface DiaperData { pee: boolean; poop: boolean; poopCount: number }
export interface MedData { medicationId: string | null; name: string; dose: number | null; unit: string }

interface EventBase extends Base {
  col: 'event'
  startedAt: number
  endedAt: number | null // null = pontual ou em andamento
  note: string | null
  createdBy: string
  createdAt: number
}

export type BabyEvent =
  | (EventBase & { type: 'sleep'; kind: 'interval'; data: SleepData })
  | (EventBase & { type: 'feeding'; kind: 'interval'; data: FeedingData })
  | (EventBase & { type: 'diaper'; kind: 'point'; data: DiaperData })
  | (EventBase & { type: 'tummy'; kind: 'interval'; data: Record<string, never> })
  | (EventBase & { type: 'bath'; kind: 'point'; data: Record<string, never> })
  | (EventBase & { type: 'medication'; kind: 'point'; data: MedData })

export type Rec = Baby | Medication | Measurement | BabyEvent

export const KIND: Record<EventType, 'interval' | 'point'> = {
  sleep: 'interval',
  feeding: 'interval',
  diaper: 'point',
  tummy: 'interval',
  bath: 'point',
  medication: 'point',
}

export const keyOf = (r: Pick<Base, 'col' | 'id'>) => `${r.col}:${r.id}`

export function newId(): string {
  return crypto.randomUUID()
}

/** Evento ainda rodando (timer). */
export const isRunning = (e: BabyEvent) => e.kind === 'interval' && e.endedAt == null
