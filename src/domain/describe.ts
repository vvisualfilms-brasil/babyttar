// Textos que aparecem na tela para cada registro.
import { BabyEvent, EventType } from './types'
import { fmtDuration } from './time'

export const TYPE_LABEL: Record<EventType, string> = {
  sleep: 'Sono',
  feeding: 'Mamada',
  diaper: 'Fralda',
  tummy: 'Tummy time',
  bath: 'Banho',
  medication: 'Remédio',
}

const SIDE = { left: 'esquerdo', right: 'direito', both: 'ambos os lados' } as const

export function describe(e: BabyEvent, now: number): { title: string; detail: string } {
  const running = e.kind === 'interval' && e.endedAt == null
  const dur = e.kind === 'interval' ? fmtDuration((e.endedAt ?? now) - e.startedAt) : ''
  switch (e.type) {
    case 'sleep':
      return { title: e.data.context === 'night' ? 'Sono noturno' : 'Soneca', detail: running ? `dormindo há ${dur}` : dur }
    case 'feeding': {
      const d = e.data
      if (d.method === 'bottle') return { title: 'Mamadeira', detail: `${d.volumeMl} ml · ${d.milk === 'formula' ? 'fórmula' : 'leite materno'}` }
      const parts: string[] = []
      if (d.leftSec) parts.push(`E ${fmtDuration(d.leftSec * 1000)}`)
      if (d.rightSec) parts.push(`D ${fmtDuration(d.rightSec * 1000)}`)
      return {
        title: `Peito ${SIDE[d.side]}`,
        detail: running ? `mamando há ${dur}` : parts.length > 1 ? parts.join(' · ') : dur,
      }
    }
    case 'diaper': {
      const d = e.data
      const what = d.pee && d.poop ? 'Xixi + cocô' : d.poop ? 'Cocô' : d.pee ? 'Xixi' : 'Seca'
      return { title: 'Fralda', detail: d.poop && d.poopCount > 1 ? `${what} (${d.poopCount} evacuações)` : what }
    }
    case 'tummy':
      return { title: 'Tummy time', detail: running ? `em andamento · ${dur}` : dur }
    case 'bath':
      return { title: 'Banho', detail: '' }
    case 'medication':
      return { title: e.data.name, detail: e.data.dose != null ? `${fmtNum(e.data.dose)} ${e.data.unit}` : '' }
  }
}

export const fmtNum = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
