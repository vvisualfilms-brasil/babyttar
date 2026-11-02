// Edição completa de um registro, e criação de registros retroativos.
import { useState } from 'react'
import { BabyEvent, EventType, Medication } from '../domain/types'
import { TYPE_LABEL } from '../domain/describe'
import { HOUR, MIN, fromLocalInput, nextDayStart, suggestSleepContext, toLocalInput } from '../domain/time'
import { makeEvent, save } from '../data/actions'
import { put, remove } from '../data/store'
import { Sheet, TypeIcon, useToast } from '../ui/kit'

const TYPES: EventType[] = ['sleep', 'feeding', 'diaper', 'tummy', 'bath', 'medication']

/** Valores padrão de um registro retroativo no dia escolhido. */
function draft(type: EventType, dayTs: number, meds: Medication[]): BabyEvent {
  const now = Date.now()
  const end = Math.min(now, nextDayStart(dayTs) - MIN) // dia passado: 23:59; hoje: agora
  const start = type === 'sleep' ? end - HOUR : type === 'feeding' || type === 'tummy' ? end - 15 * MIN : end
  const med = meds.find((m) => m.active)
  switch (type) {
    case 'sleep': return makeEvent('sleep', { context: suggestSleepContext(start) }, start, end)
    case 'feeding': return makeEvent('feeding', { method: 'breast', side: 'left', leftSec: 15 * 60, rightSec: 0 }, start, end)
    case 'diaper': return makeEvent('diaper', { pee: true, poop: false, poopCount: 0 }, start)
    case 'tummy': return makeEvent('tummy', {}, start, end)
    case 'bath': return makeEvent('bath', {}, start)
    case 'medication': return makeEvent('medication', { medicationId: med?.id ?? null, name: med?.name ?? '', dose: med?.defaultDose ?? null, unit: med?.unit ?? 'gotas' }, start)
  }
}

interface Props {
  event?: BabyEvent // editar
  newType?: EventType | null // retroativo (null = escolher)
  dayTs?: number
  events: BabyEvent[]
  medications: Medication[]
  onClose: () => void
}

export function EventEditor(p: Props) {
  const [type, setType] = useState<EventType | null>(p.event?.type ?? p.newType ?? null)
  if (!type) {
    return (
      <Sheet title="Registro retroativo" onClose={p.onClose}>
        <p className="hint">Qual atividade?</p>
        <div className="grid3">
          {TYPES.map((t) => (
            <button key={t} className={`qbtn t-${t}`} onClick={() => setType(t)}>
              <span className="ico"><TypeIcon type={t} /></span>{TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </Sheet>
    )
  }
  return <Form {...p} initial={p.event ?? draft(type, p.dayTs ?? Date.now(), p.medications)} isNew={!p.event} />
}

function Form({ initial, isNew, events, medications, onClose }: Props & { initial: BabyEvent; isNew: boolean }) {
  const [e, setE] = useState<BabyEvent>(initial)
  const [error, setError] = useState('')
  const toast = useToast()
  const set = (patch: Partial<BabyEvent>) => setE({ ...e, ...patch } as BabyEvent)
  const setData = (patch: object) => setE({ ...e, data: { ...e.data, ...patch } } as BabyEvent)

  function submit() {
    const isInterval = e.kind === 'interval'
    if (isInterval && e.endedAt != null && e.endedAt < e.startedAt) return setError('O fim está antes do início.')
    if (e.startedAt > Date.now() + MIN) return setError('O horário está no futuro.')
    if (isInterval && e.endedAt == null) {
      const other = events.find((x) => x.type === e.type && x.endedAt == null && x.id !== e.id)
      if (other) return setError('Já existe um timer desta atividade rodando. Preencha o fim.')
    }
    if (e.type === 'medication' && !e.data.name.trim()) return setError('Escolha o remédio.')
    let out = e
    if (e.type === 'feeding' && e.data.method === 'breast') {
      const d = e.data
      const side = d.leftSec > 0 && d.rightSec > 0 ? 'both' : d.rightSec > 0 ? 'right' : d.leftSec > 0 ? 'left' : d.side
      out = { ...e, data: { ...d, side } }
    }
    if (e.type === 'diaper') out = { ...e, data: { ...e.data, poopCount: e.data.poop ? Math.max(1, e.data.poopCount || 1) : 0 } }
    const v = isNew ? save(out) : put(out)
    toast(isNew ? 'Registro adicionado' : 'Registro atualizado', () => (isNew ? remove(v) : put({ ...initial })))
    onClose()
  }

  function del() {
    if (!confirm('Excluir este registro? Ele vai para a lixeira (dá para recuperar).')) return
    const v = remove(e)
    toast('Registro excluído', () => put({ ...v, deletedAt: null }))
    onClose()
  }

  const timeField = (label: string, value: number | null, onChange: (v: number | null) => void, optional = false) => (
    <div className="field">
      <div className="label">{label}</div>
      <input type="datetime-local" value={value != null ? toLocalInput(value) : ''} onChange={(ev) => onChange(ev.target.value ? fromLocalInput(ev.target.value) : optional ? null : value)} />
      {optional && value == null && <p className="hint">Em andamento.</p>}
    </div>
  )

  return (
    <Sheet title={`${isNew ? 'Novo' : 'Editar'}: ${TYPE_LABEL[e.type]}`} onClose={onClose}
      icon={<div className={`t-${e.type}`} style={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center' }}><TypeIcon type={e.type} /></div>}>
      {e.kind === 'interval' ? (
        <div className="grid2">
          {timeField(e.type === 'sleep' ? 'Dormiu' : 'Início', e.startedAt, (v) => v != null && set({ startedAt: v }))}
          {timeField(e.type === 'sleep' ? 'Acordou' : 'Fim', e.endedAt, (v) => set({ endedAt: v }), !isNew)}
        </div>
      ) : timeField('Horário', e.startedAt, (v) => v != null && set({ startedAt: v }))}

      {e.type === 'sleep' && (
        <div className="grid2">
          <button className={`choice ${e.data.context === 'nap' ? 'on' : ''}`} onClick={() => setData({ context: 'nap' })}>Soneca</button>
          <button className={`choice ${e.data.context === 'night' ? 'on' : ''}`} onClick={() => setData({ context: 'night' })}>Sono noturno</button>
        </div>
      )}

      {e.type === 'feeding' && (
        <>
          <div className="grid2" style={{ marginBottom: 12 }}>
            <button className={`choice ${e.data.method === 'breast' ? 'on' : ''}`} onClick={() => setE({ ...e, data: { method: 'breast', side: 'left', leftSec: 0, rightSec: 0 } } as BabyEvent)}>Peito</button>
            <button className={`choice ${e.data.method === 'bottle' ? 'on' : ''}`} onClick={() => setE({ ...e, data: { method: 'bottle', volumeMl: 90, milk: 'breast_milk' } } as BabyEvent)}>Mamadeira</button>
          </div>
          {e.data.method === 'breast' ? (
            <div className="grid2">
              <div className="field"><div className="label">Esquerdo (min)</div>
                <input inputMode="numeric" value={Math.round(e.data.leftSec / 60) || ''} onChange={(ev) => setData({ leftSec: (parseInt(ev.target.value) || 0) * 60 })} /></div>
              <div className="field"><div className="label">Direito (min)</div>
                <input inputMode="numeric" value={Math.round(e.data.rightSec / 60) || ''} onChange={(ev) => setData({ rightSec: (parseInt(ev.target.value) || 0) * 60 })} /></div>
            </div>
          ) : (
            <>
              <div className="field"><div className="label">Volume (ml)</div>
                <input inputMode="numeric" value={e.data.volumeMl || ''} onChange={(ev) => setData({ volumeMl: parseInt(ev.target.value) || 0 })} /></div>
              <div className="grid2">
                <button className={`choice ${e.data.milk === 'breast_milk' ? 'on' : ''}`} onClick={() => setData({ milk: 'breast_milk' })}>Materno</button>
                <button className={`choice ${e.data.milk === 'formula' ? 'on' : ''}`} onClick={() => setData({ milk: 'formula' })}>Fórmula</button>
              </div>
            </>
          )}
        </>
      )}

      {e.type === 'diaper' && (
        <>
          <div className="grid2">
            <button className={`choice ${e.data.pee ? 'on' : ''}`} onClick={() => setData({ pee: !e.data.pee })}>Xixi</button>
            <button className={`choice ${e.data.poop ? 'on' : ''}`} onClick={() => setData({ poop: !e.data.poop, poopCount: e.data.poop ? 0 : 1 })}>Cocô</button>
          </div>
          {e.data.poop && (
            <>
              <div className="label">Evacuações</div>
              <div className="stepper">
                <button onClick={() => e.type === 'diaper' && setData({ poopCount: Math.max(1, e.data.poopCount - 1) })}>−</button>
                <div className="v">{e.data.poopCount || 1}</div>
                <button onClick={() => e.type === 'diaper' && setData({ poopCount: (e.data.poopCount || 1) + 1 })}>+</button>
              </div>
            </>
          )}
        </>
      )}

      {e.type === 'medication' && (
        <>
          <div className="field"><div className="label">Remédio</div>
            <select value={e.data.medicationId ?? ''} onChange={(ev) => {
              const m = medications.find((x) => x.id === ev.target.value)
              if (m) setData({ medicationId: m.id, name: m.name, dose: m.defaultDose, unit: m.unit })
            }}>
              <option value="" disabled>{e.data.name || 'Escolha…'}</option>
              {medications.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="grid2">
            <div className="field"><div className="label">Dose</div>
              <input inputMode="decimal" value={e.data.dose ?? ''} onChange={(ev) => { const n = parseFloat(ev.target.value.replace(',', '.')); setData({ dose: isNaN(n) ? null : n }) }} /></div>
            <div className="field"><div className="label">Unidade</div>
              <input value={e.data.unit} onChange={(ev) => setData({ unit: ev.target.value })} /></div>
          </div>
        </>
      )}

      <div className="field" style={{ marginTop: 12 }}>
        <div className="label">Observação</div>
        <input value={e.note ?? ''} placeholder="opcional" onChange={(ev) => set({ note: ev.target.value || null })} />
      </div>

      {!isNew && <p className="hint">Registrado por {e.createdBy || '—'}{e.updatedBy && e.updatedBy !== e.createdBy ? ` · editado por ${e.updatedBy}` : ''}</p>}
      {error && <div className="error-box">{error}</div>}
      <button className="big-btn primary" onClick={submit}>Salvar</button>
      {!isNew && <button className="big-btn danger" onClick={del}>Excluir</button>}
    </Sheet>
  )
}
