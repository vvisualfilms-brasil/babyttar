// Junta as versões vindas de todos os celulares: para cada registro vale a mais recente.
import { Rec, keyOf } from '../domain/types'

export const newer = (a: Rec, b: Rec | undefined) =>
  !b || a.updatedAt > b.updatedAt || (a.updatedAt === b.updatedAt && a.updatedBy > b.updatedBy)

export function mergeInto(target: Map<string, Rec>, recs: Iterable<Rec>) {
  for (const r of recs) {
    if (!r || !r.col || !r.id) continue
    const k = keyOf(r)
    if (newer(r, target.get(k))) target.set(k, r)
  }
  return target
}

/** Formato do arquivo mensal de cada celular: um registro por linha (fica legível no histórico do git). */
export function serializeFile(device: string, recs: Rec[]): string {
  const sorted = [...recs].sort((a, b) => a.updatedAt - b.updatedAt)
  return `{"format":"babyttar/1","device":${JSON.stringify(device)},"records":[\n${sorted.map((r) => JSON.stringify(r)).join(',\n')}\n]}\n`
}

export function parseFile(text: string): Rec[] {
  try {
    const j = JSON.parse(text)
    return Array.isArray(j.records) ? j.records : []
  } catch {
    return []
  }
}
