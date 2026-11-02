import { Check, CircleAlert } from 'lucide-react'
import { BabyEvent, EventType, isRunning } from '../domain/types'
import { View } from '../data/store'
import { describe, TYPE_LABEL } from '../domain/describe'
import { ageText, fmtAgo, fmtClock, fmtDuration, hhmm } from '../domain/time'
import { daySummary, lastOfType, medStatus } from '../domain/stats'
import { breastLive, finish } from '../data/actions'
import { TypeIcon, useNow, useToast } from '../ui/kit'
import { put } from '../data/store'
import { SyncBadge } from './SyncBadge'

export const QUICK: EventType[] = ['sleep', 'feeding', 'diaper', 'tummy', 'bath', 'medication']

interface Props { v: View; onQuick: (t: EventType) => void; onEdit: (e: BabyEvent) => void; onProfile: () => void }

export function Home({ v, onQuick, onEdit, onProfile }: Props) {
  const now = useNow()
  const baby = v.baby!
  const today = daySummary(v.events, now, now)
  const running = v.events.filter(isRunning)
  const meds = medStatus(v.medications, v.events, now)
  const lastFeed = lastOfType(v.events, 'feeding')
  const lastDiaper = lastOfType(v.events, 'diaper')
  const lastSleep = lastOfType(v.events, 'sleep')
  const sleeping = lastSleep && isRunning(lastSleep)
  const awakeSince = !sleeping && lastSleep?.endedAt ? lastSleep.endedAt : null

  return (
    <>
      <div className="header">
        <button className="avatar" onClick={onProfile} aria-label="Perfil do bebê">
          {baby.photo ? <img src={baby.photo} alt="" /> : <TypeIcon type="tummy" size={26} />}
        </button>
        <div className="grow">
          <h1>{baby.name}</h1>
          <div className="sub">{ageText(baby.birthDate, now)}</div>
        </div>
        <SyncBadge status={v.status} />
      </div>

      {running.map((e) => <RunningCard key={e.id} e={e} now={now} onOpen={() => onQuick(e.type)} />)}

      <div className="quick">
        {QUICK.map((t) => {
          const r = running.find((e) => e.type === t)
          return (
            <button key={t} className={`qbtn t-${t}`} onClick={() => onQuick(t)}>
              <span className="ico"><TypeIcon type={t} /></span>
              {t === 'sleep' && r ? 'Acordou' : TYPE_LABEL[t]}
              {r && <span className="live">{fmtClock(now - r.startedAt)}</span>}
            </button>
          )
        })}
      </div>

      <h2 className="section">Hoje</h2>
      <div className="stats">
        <Stat v={String(today.feedings)} k="mamadas" s={today.bottleMl ? `${today.bottleMl} ml mamadeira` : undefined} />
        <Stat v={String(today.poops)} k="evacuações" />
        <Stat v={String(today.diapers)} k="fraldas" />
        <Stat v={fmtDuration(today.sleepMs)} k="de sono" />
        <Stat v={fmtDuration(today.awakeMs)} k="acordado" />
        <Stat v={fmtDuration(today.tummyMs)} k="tummy time" />
      </div>

      {meds.map((m) => (
        <button key={m.med.id} className={`banner ${m.done ? 'ok' : 'warn'}`} style={{ width: '100%', textAlign: 'left' }} onClick={() => onQuick('medication')}>
          {m.done ? <Check size={22} /> : <CircleAlert size={22} />}
          <span className="grow">{m.med.name}</span>
          <span>{m.done ? `dada às ${hhmm(m.lastAt!)}` : m.givenToday ? `${m.givenToday}/${m.med.dailyTarget} hoje` : 'pendente hoje'}</span>
        </button>
      ))}

      <div className="since">
        <div>Última mamada<b>{lastFeed ? fmtAgo(lastFeed.startedAt, now) : '—'}</b></div>
        <div>Última fralda<b>{lastDiaper ? fmtAgo(lastDiaper.startedAt, now) : '—'}</b></div>
        <div>{sleeping ? 'Dormindo' : 'Acordado'}<b>{sleeping ? fmtDuration(now - lastSleep!.startedAt) : awakeSince ? fmtDuration(now - awakeSince) : '—'}</b></div>
      </div>

      <h2 className="section">Últimas atividades</h2>
      <EventList events={v.events.slice(0, 6)} now={now} onEdit={onEdit} empty="Nada registrado ainda. Toque num botão acima." />
    </>
  )
}

function Stat({ v, k, s }: { v: string; k: string; s?: string }) {
  return <div className="stat"><div className="v">{v}</div><div className="k">{k}</div>{s && <div className="s">{s}</div>}</div>
}

function RunningCard({ e, now, onOpen }: { e: BabyEvent; now: number; onOpen: () => void }) {
  const toast = useToast()
  const label = e.type === 'sleep' ? 'Dormindo' : e.type === 'feeding' ? 'Mamando' : 'Tummy time'
  let extra = ` desde ${hhmm(e.startedAt)}`
  if (e.type === 'feeding' && e.data.method === 'breast') {
    const l = breastLive(e.data, now)
    extra = ` · ${e.data.activeSide === 'left' ? 'esquerdo' : 'direito'} · E ${fmtClock(l.left * 1000)} · D ${fmtClock(l.right * 1000)}`
  }
  return (
    <div className={`running t-${e.type}`}>
      <button className="grow" style={{ textAlign: 'left' }} onClick={onOpen}>
        <div className="lbl">{label}{extra}</div>
        <div className="big">{fmtClock(now - e.startedAt)}</div>
      </button>
      {e.type === 'feeding' ? (
        <button className="pill" onClick={onOpen}>Abrir</button>
      ) : (
        <button className="pill" onClick={() => {
          const v = finish(e, Date.now())
          toast(`${e.type === 'sleep' ? 'Acordou · dormiu' : 'Tummy time ·'} ${fmtDuration((v.endedAt ?? 0) - v.startedAt)}`, () => put({ ...e }))
        }}>{e.type === 'sleep' ? 'Acordou' : 'Terminar'}</button>
      )}
    </div>
  )
}

export function EventList({ events, now, onEdit, empty }: { events: BabyEvent[]; now: number; onEdit: (e: BabyEvent) => void; empty: string }) {
  if (!events.length) return <div className="list"><div className="empty">{empty}</div></div>
  return (
    <div className="list">
      {events.map((e) => {
        const d = describe(e, now)
        return (
          <button key={e.id} className="row" onClick={() => onEdit(e)}>
            <span className={`ico t-${e.type}`}><TypeIcon type={e.type} size={19} /></span>
            <span className="grow">
              <div className="t">{d.title}</div>
              {(d.detail || e.note) && <div className="d">{[d.detail, e.note].filter(Boolean).join(' · ')}</div>}
            </span>
            <span>
              <div className="time">{hhmm(e.startedAt)}{e.kind === 'interval' && e.endedAt && e.endedAt - e.startedAt >= 60_000 ? `–${hhmm(e.endedAt)}` : ''}</div>
              <div className="who">{e.createdBy}</div>
            </span>
          </button>
        )
      })}
    </div>
  )
}
