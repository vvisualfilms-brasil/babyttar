// Folhas de registro rápido: 1 toque para começar, no máximo 2–3 para terminar.
import { useState } from 'react'
import { BabyEvent, EventType, Medication } from '../domain/types'
import { TYPE_LABEL, fmtNum } from '../domain/describe'
import { MIN, fmtClock, fmtDuration } from '../domain/time'
import { runningOfType, suggestedSide } from '../domain/stats'
import { breastLive, finish, makeEvent, save, startBreast, startSleep, startTimer, switchSide } from '../data/actions'
import { remove, put } from '../data/store'
import { Sheet, TimeChips, TypeIcon, useNow, useToast } from '../ui/kit'

interface Props { type: EventType; events: BabyEvent[]; medications: Medication[]; onClose: () => void; onRetro: (type: EventType) => void; onManageMeds: () => void }

export function QuickSheet(p: Props) {
  const icon = <div className={`ico t-${p.type}`} style={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center' }}><TypeIcon type={p.type} /></div>
  return (
    <Sheet title={TYPE_LABEL[p.type]} onClose={p.onClose} icon={icon}>
      {p.type === 'sleep' && <SleepQuick {...p} />}
      {p.type === 'feeding' && <FeedingQuick {...p} />}
      {p.type === 'diaper' && <DiaperQuick {...p} />}
      {p.type === 'tummy' && <TummyQuick {...p} />}
      {p.type === 'bath' && <BathQuick {...p} />}
      {p.type === 'medication' && <MedQuick {...p} />}
    </Sheet>
  )
}

/** Desfazer de criação = apagar; de edição = voltar à versão anterior. */
function useSaved() {
  const toast = useToast()
  return (text: string, created: BabyEvent, previous?: BabyEvent) =>
    toast(text, () => (previous ? put({ ...previous }) : remove(created)))
}

function SleepQuick({ events, onClose, onRetro }: Props) {
  const [at, setAt] = useState<number | null>(null)
  const now = useNow()
  const saved = useSaved()
  const running = runningOfType(events, 'sleep')
  if (running) {
    return (
      <>
        <div className="timer-big">{fmtClock(now - running.startedAt)}</div>
        <p className="hint" style={{ textAlign: 'center' }}>Dormindo desde {new Date(running.startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
        <TimeChips value={at} onChange={setAt} label="Acordou" />
        <div style={{ height: 16 }} />
        <button className="big-btn primary" onClick={() => {
          const v = finish(running, at ?? Date.now())
          saved(`Acordou · dormiu ${fmtDuration((v.endedAt ?? 0) - v.startedAt)}`, v, running)
          onClose()
        }}>Acordou</button>
      </>
    )
  }
  return (
    <>
      <TimeChips value={at} onChange={setAt} label="Dormiu" />
      <div style={{ height: 16 }} />
      <button className="big-btn primary" onClick={() => { const v = startSleep(at ?? Date.now()); saved('Sono iniciado', v); onClose() }}>Dormiu</button>
      <button className="big-btn soft" onClick={() => onRetro('sleep')}>Registrar sono passado</button>
    </>
  )
}

function FeedingQuick({ events, onClose }: Props) {
  const now = useNow()
  const saved = useSaved()
  const [at, setAt] = useState<number | null>(null)
  const [mode, setMode] = useState<'start' | 'done' | 'bottle'>('start')
  const [doneSide, setDoneSide] = useState<'left' | 'right' | 'both'>('left')
  const [ml, setMl] = useState(() => {
    const last = events.find((e) => e.type === 'feeding' && e.data.method === 'bottle')
    return last && last.type === 'feeding' && last.data.method === 'bottle' ? last.data.volumeMl : 90
  })
  const [milk, setMilk] = useState<'breast_milk' | 'formula'>(() => {
    const last = events.find((e) => e.type === 'feeding' && e.data.method === 'bottle')
    return last && last.type === 'feeding' && last.data.method === 'bottle' ? last.data.milk : 'breast_milk'
  })
  const running = runningOfType(events, 'feeding')
  const sug = suggestedSide(events)

  if (running && running.type === 'feeding' && running.data.method === 'breast') {
    const d = running.data
    const live = breastLive(d, now)
    return (
      <>
        <div className="timer-big">{fmtClock(now - running.startedAt)}</div>
        <div className="sides">
          <div className={`side ${d.activeSide === 'left' ? 'on' : ''}`}>Esquerdo<b>{fmtClock(live.left * 1000)}</b></div>
          <div className={`side ${d.activeSide === 'right' ? 'on' : ''}`}>Direito<b>{fmtClock(live.right * 1000)}</b></div>
        </div>
        <button className="big-btn soft" onClick={() => switchSide(running)}>
          Trocar para o {d.activeSide === 'left' ? 'direito' : 'esquerdo'}
        </button>
        <button className="big-btn primary" onClick={() => { const v = finish(running, Date.now()); saved(`Mamada salva · ${fmtDuration((v.endedAt ?? 0) - v.startedAt)}`, v, running); onClose() }}>
          Terminar
        </button>
        <button className="big-btn danger" onClick={() => { const v = remove(running); saved('Mamada cancelada', v, running); onClose() }}>Cancelar esta mamada</button>
      </>
    )
  }

  return (
    <>
      <div className="chips" style={{ marginBottom: 6 }}>
        <button className={`chip ${mode === 'start' ? 'on' : ''}`} onClick={() => setMode('start')}>Começar agora</button>
        <button className={`chip ${mode === 'done' ? 'on' : ''}`} onClick={() => setMode('done')}>Já mamou</button>
        <button className={`chip ${mode === 'bottle' ? 'on' : ''}`} onClick={() => setMode('bottle')}>Mamadeira</button>
      </div>

      {mode === 'start' && (
        <>
          <p className="hint">{sug.last ? `Última vez terminou no ${sug.last === 'left' ? 'esquerdo' : 'direito'}. Sugestão: ${sug.next === 'left' ? 'esquerdo' : 'direito'}.` : 'Toque no lado para começar o timer.'}</p>
          <div className="grid2">
            {(['left', 'right'] as const).map((s) => (
              <button key={s} className={`choice ${sug.next === s ? 'on' : ''}`} style={{ padding: '26px 8px' }}
                onClick={() => { const v = startBreast(s, Date.now()); saved('Mamada iniciada', v); onClose() }}>
                {s === 'left' ? 'Esquerdo' : 'Direito'}
                {sug.next === s && <small>sugerido</small>}
              </button>
            ))}
          </div>
          <button className="big-btn soft" style={{ marginTop: 10 }} onClick={() => { const v = startBreast(sug.next, Date.now(), true); saved('Mamada iniciada (ambos)', v); onClose() }}>
            Ambos (começa no {sug.next === 'left' ? 'esquerdo' : 'direito'})
          </button>
        </>
      )}

      {mode === 'done' && (
        <>
          <div className="label">Lado</div>
          <div className="grid3">
            {(['left', 'right', 'both'] as const).map((s) => (
              <button key={s} className={`choice ${doneSide === s ? 'on' : ''}`} onClick={() => setDoneSide(s)}>
                {s === 'left' ? 'Esquerdo' : s === 'right' ? 'Direito' : 'Ambos'}
              </button>
            ))}
          </div>
          <TimeChips value={at} onChange={setAt} label="Terminou" />
          <div className="label">Durou</div>
          <div className="chips">
            {[5, 10, 15, 20, 30].map((m) => (
              <button key={m} className="chip" onClick={() => {
                const end = at ?? Date.now()
                const sec = m * 60
                const left = doneSide === 'left' ? sec : doneSide === 'both' ? sec / 2 : 0
                const right = doneSide === 'right' ? sec : doneSide === 'both' ? sec / 2 : 0
                const endSide = doneSide === 'both' ? null : doneSide
                const v = save(makeEvent('feeding', { method: 'breast', side: doneSide, leftSec: left, rightSec: right, endSide }, end - m * MIN, end))
                saved(`Mamada de ${m} min salva`, v)
                onClose()
              }}>{m} min</button>
            ))}
          </div>
        </>
      )}

      {mode === 'bottle' && (
        <>
          <div className="label">Volume</div>
          <div className="stepper">
            <button onClick={() => setMl(Math.max(0, ml - 10))}>−</button>
            <div className="v">{ml} ml</div>
            <button onClick={() => setMl(ml + 10)}>+</button>
          </div>
          <div className="chips" style={{ justifyContent: 'center', marginTop: 12 }}>
            {[30, 60, 90, 120, 150].map((v) => (
              <button key={v} className={`chip small ${ml === v ? 'on' : ''}`} onClick={() => setMl(v)}>{v}</button>
            ))}
          </div>
          <div className="label">Leite</div>
          <div className="grid2">
            <button className={`choice ${milk === 'breast_milk' ? 'on' : ''}`} onClick={() => setMilk('breast_milk')}>Materno</button>
            <button className={`choice ${milk === 'formula' ? 'on' : ''}`} onClick={() => setMilk('formula')}>Fórmula</button>
          </div>
          <TimeChips value={at} onChange={setAt} />
          <div style={{ height: 16 }} />
          <button className="big-btn primary" disabled={ml <= 0} onClick={() => {
            const t = at ?? Date.now()
            const v = save(makeEvent('feeding', { method: 'bottle', volumeMl: ml, milk }, t, t))
            saved(`Mamadeira ${ml} ml salva`, v)
            onClose()
          }}>Salvar {ml} ml</button>
        </>
      )}
    </>
  )
}

function DiaperQuick({ onClose }: Props) {
  const [at, setAt] = useState<number | null>(null)
  const [count, setCount] = useState(1)
  const saved = useSaved()
  const go = (pee: boolean, poop: boolean) => {
    const v = save(makeEvent('diaper', { pee, poop, poopCount: poop ? count : 0 }, at ?? Date.now()))
    saved(pee && poop ? 'Fralda: xixi + cocô' : poop ? 'Fralda: cocô' : 'Fralda: xixi', v)
    onClose()
  }
  return (
    <>
      <div className="grid3">
        <button className="choice t-diaper" style={{ padding: '26px 6px' }} onClick={() => go(true, false)}>Xixi</button>
        <button className="choice t-diaper" style={{ padding: '26px 6px' }} onClick={() => go(false, true)}>Cocô</button>
        <button className="choice t-diaper" style={{ padding: '26px 6px' }} onClick={() => go(true, true)}>Xixi + cocô</button>
      </div>
      <div className="label">Evacuações nesta troca</div>
      <div className="stepper">
        <button onClick={() => setCount(Math.max(1, count - 1))}>−</button>
        <div className="v">{count}</div>
        <button onClick={() => setCount(count + 1)}>+</button>
      </div>
      <TimeChips value={at} onChange={setAt} />
    </>
  )
}

function TummyQuick({ events, onClose }: Props) {
  const now = useNow()
  const saved = useSaved()
  const [at, setAt] = useState<number | null>(null)
  const running = runningOfType(events, 'tummy')
  if (running) {
    return (
      <>
        <div className="timer-big">{fmtClock(now - running.startedAt)}</div>
        <button className="big-btn primary" onClick={() => { const v = finish(running, Date.now()); saved(`Tummy time · ${fmtDuration((v.endedAt ?? 0) - v.startedAt)}`, v, running); onClose() }}>Terminar</button>
        <button className="big-btn danger" onClick={() => { const v = remove(running); saved('Tummy time cancelado', v, running); onClose() }}>Cancelar</button>
      </>
    )
  }
  return (
    <>
      <button className="big-btn primary" onClick={() => { const v = startTimer('tummy', Date.now()); saved('Tummy time iniciado', v); onClose() }}>Começar agora</button>
      <div className="label">Já fez? Quanto tempo</div>
      <div className="chips">
        {[2, 5, 10, 15].map((m) => (
          <button key={m} className="chip" onClick={() => {
            const end = at ?? Date.now()
            const v = save(makeEvent('tummy', {}, end - m * MIN, end))
            saved(`Tummy time de ${m} min salvo`, v)
            onClose()
          }}>{m} min</button>
        ))}
      </div>
      <TimeChips value={at} onChange={setAt} label="Terminou" />
    </>
  )
}

function BathQuick({ onClose }: Props) {
  const [at, setAt] = useState<number | null>(null)
  const saved = useSaved()
  return (
    <>
      <TimeChips value={at} onChange={setAt} />
      <div style={{ height: 16 }} />
      <button className="big-btn primary" onClick={() => { const v = save(makeEvent('bath', {}, at ?? Date.now())); saved('Banho registrado', v); onClose() }}>Registrar banho</button>
    </>
  )
}

function MedQuick({ medications, onClose, onManageMeds }: Props) {
  const [at, setAt] = useState<number | null>(null)
  const saved = useSaved()
  const active = medications.filter((m) => m.active).sort((a, b) => (b.dailyTarget ? 1 : 0) - (a.dailyTarget ? 1 : 0))
  return (
    <>
      {active.length === 0 && <p className="hint">Nenhum remédio cadastrado ainda.</p>}
      <div style={{ display: 'grid', gap: 10 }}>
        {active.map((m) => (
          <button key={m.id} className="choice t-medication" style={{ flexDirection: 'row', justifyContent: 'space-between', padding: '18px 18px' }} onClick={() => {
            const v = save(makeEvent('medication', { medicationId: m.id, name: m.name, dose: m.defaultDose, unit: m.unit }, at ?? Date.now()))
            saved(`${m.name} registrada`, v)
            onClose()
          }}>
            <span>{m.name}</span>
            <small>{m.defaultDose != null ? `${fmtNum(m.defaultDose)} ${m.unit}` : ''}</small>
          </button>
        ))}
      </div>
      <TimeChips value={at} onChange={setAt} />
      <div style={{ height: 12 }} />
      <button className="big-btn soft" onClick={onManageMeds}>Cadastrar ou editar remédios</button>
      <p className="hint">Para mudar a dose só desta vez, registre e toque no item no histórico.</p>
    </>
  )
}
