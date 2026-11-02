import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { addDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { BabyEvent, EventType } from '../domain/types'
import { View } from '../data/store'
import { TYPE_LABEL } from '../domain/describe'
import { dayKey, dayStart, fmtDuration, fromLocalInput, nextDayStart, overlap } from '../domain/time'
import { daySummary } from '../domain/stats'
import { useNow } from '../ui/kit'
import { EventList, QUICK } from './Home'

interface Props { v: View; onEdit: (e: BabyEvent) => void; onRetro: (dayTs: number) => void }

export function History({ v, onEdit, onRetro }: Props) {
  const now = useNow(30_000)
  const [day, setDay] = useState(() => dayStart(Date.now()))
  const [filter, setFilter] = useState<Set<EventType>>(new Set())
  const isToday = dayKey(day) === dayKey(now)
  const from = day
  const to = nextDayStart(day)
  // Eventos que tocam o dia (inclui sono que começou ontem à noite).
  const ofDay = v.events.filter((e) => {
    const end = e.endedAt ?? (e.kind === 'interval' ? now : e.startedAt)
    return (e.startedAt >= from && e.startedAt < to) || overlap(e.startedAt, end, from, to) > 0
  })
  const shown = filter.size ? ofDay.filter((e) => filter.has(e.type)) : ofDay
  const s = daySummary(v.events, day, now)

  const toggle = (t: EventType) => {
    const n = new Set(filter)
    if (n.has(t)) n.delete(t)
    else n.add(t)
    setFilter(n)
  }

  const label = isToday ? 'Hoje' : dayKey(day) === dayKey(addDays(now, -1).getTime()) ? 'Ontem' : format(day, "EEEE", { locale: ptBR })

  return (
    <>
      <div className="daynav">
        <button className="nav" onClick={() => setDay(dayStart(addDays(day, -1).getTime()))} aria-label="Dia anterior"><ChevronLeft /></button>
        <label className="d" style={{ position: 'relative' }}>
          {label[0].toUpperCase() + label.slice(1)}
          <small>{format(day, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}</small>
          <input type="date" value={dayKey(day)} max={dayKey(now)} onChange={(e) => e.target.value && setDay(dayStart(fromLocalInput(e.target.value + 'T12:00')))}
            style={{ position: 'absolute', inset: 0, opacity: 0 }} aria-label="Escolher dia" />
        </label>
        <button className="nav" disabled={isToday} onClick={() => setDay(dayStart(addDays(day, 1).getTime()))} aria-label="Próximo dia"><ChevronRight /></button>
      </div>

      {s.hasRecords ? (
        <div className="stats" style={{ marginBottom: 14 }}>
          <Mini v={String(s.feedings)} k="mamadas" />
          <Mini v={String(s.poops)} k="evacuações" />
          <Mini v={String(s.diapers)} k="fraldas" />
          <Mini v={fmtDuration(s.sleepMs)} k="sono" />
          <Mini v={fmtDuration(s.tummyMs)} k="tummy" />
          <Mini v={s.baths ? 'sim' : 'não'} k="banho" />
        </div>
      ) : (
        <div className="card empty" style={{ marginBottom: 14 }}>Nenhum registro neste dia. Dias sem registro não entram nas médias.</div>
      )}

      <div className="scroll-x">
        <button className={`chip small ${filter.size === 0 ? 'on' : ''}`} onClick={() => setFilter(new Set())}>Tudo</button>
        {QUICK.map((t) => (
          <button key={t} className={`chip small ${filter.has(t) ? 'on' : ''}`} onClick={() => toggle(t)}>{TYPE_LABEL[t]}</button>
        ))}
      </div>

      <EventList events={shown} now={now} onEdit={onEdit} empty={filter.size ? 'Nada com esse filtro.' : 'Nada registrado.'} />

      <button className="big-btn soft" style={{ marginTop: 14 }} onClick={() => onRetro(day)}>
        <Plus size={20} /> Adicionar registro {isToday ? 'esquecido' : 'neste dia'}
      </button>
    </>
  )
}

function Mini({ v, k }: { v: string; k: string }) {
  return <div className="stat"><div className="v" style={{ fontSize: 19 }}>{v}</div><div className="k">{k}</div></div>
}
