import { useEffect, useState } from 'react'
import { Download, Pencil, Plus } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Measurement, Medication, newId } from '../domain/types'
import { describe, fmtNum } from '../domain/describe'
import { ageText, hhmm } from '../domain/time'
import { View, disconnect, exportBackup, put, restore, syncNow, updateUserName, userName } from '../data/store'
import { Sheet, TypeIcon, useNow, useToast } from '../ui/kit'
import { BabyForm } from './BabyForm'
import { Setup } from './Setup'

type Open = null | 'profile' | 'measure' | { med: Medication | null } | 'github'

export function BabyTab({ v, openMeds, onMedsShown }: { v: View; openMeds?: boolean; onMedsShown?: () => void }) {
  const now = useNow(60_000)
  const [open, setOpen] = useState<Open>(openMeds ? { med: null } : null)
  const toast = useToast()
  const baby = v.baby!
  useEffect(() => { if (openMeds) onMedsShown?.() }, [openMeds, onMedsShown])

  return (
    <>
      <div className="card" style={{ textAlign: 'center', paddingTop: 22 }}>
        <div className="avatar" style={{ width: 96, height: 96, margin: '0 auto 10px' }}>
          {baby.photo ? <img src={baby.photo} alt="" /> : <TypeIcon type="tummy" size={36} />}
        </div>
        <h1 style={{ margin: 0, fontSize: 26 }}>{baby.name}</h1>
        <div className="hint" style={{ margin: '4px 0 12px' }}>
          {ageText(baby.birthDate, now)} · nasceu em {format(parseISO(baby.birthDate), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </div>
        <button className="chip" onClick={() => setOpen('profile')}><Pencil size={14} /> Editar</button>
      </div>

      <h2 className="section">Medidas</h2>
      <div className="list">
        {v.measurements.length === 0 && <div className="empty">Nenhuma medida ainda.</div>}
        {v.measurements.map((m, i) => {
          const prev = v.measurements[i + 1]
          const dw = prev && m.weightG != null && prev.weightG != null ? m.weightG - prev.weightG : null
          return (
            <div key={m.id} className="row">
              <span className="grow">
                <div className="t">{m.weightG != null ? `${fmtNum(m.weightG / 1000)} kg` : '—'} · {m.lengthMm != null ? `${fmtNum(m.lengthMm / 10)} cm` : '—'}</div>
                <div className="d">{format(parseISO(m.measuredAt), 'dd/MM/yyyy')} · {m.source === 'pediatra' ? 'pediatra' : 'em casa'}{dw != null ? ` · ${dw >= 0 ? '+' : ''}${dw} g` : ''}</div>
              </span>
            </div>
          )
        })}
      </div>
      <button className="big-btn soft" style={{ marginTop: 10 }} onClick={() => setOpen('measure')}><Plus size={20} /> Nova medida</button>

      <h2 className="section">Remédios e vitaminas</h2>
      <div className="list">
        {v.medications.length === 0 && <div className="empty">Nenhum cadastrado.</div>}
        {v.medications.map((m) => (
          <button key={m.id} className="row" onClick={() => setOpen({ med: m })}>
            <span className="ico t-medication"><TypeIcon type="medication" size={18} /></span>
            <span className="grow">
              <div className="t">{m.name}{!m.active && ' (pausado)'}</div>
              <div className="d">{m.defaultDose != null ? `${fmtNum(m.defaultDose)} ${m.unit}` : 'dose não definida'}{m.dailyTarget ? ` · ${m.dailyTarget}×/dia` : ''}</div>
            </span>
          </button>
        ))}
      </div>
      <button className="big-btn soft" style={{ marginTop: 10 }} onClick={() => setOpen({ med: null })}><Plus size={20} /> Novo remédio</button>

      <h2 className="section">Sincronização</h2>
      <div className="card">
        <div className="kv"><span>Este celular</span><b>{userName()}</b></div>
        <div className="kv"><span>Modo</span><b>{v.config?.mode === 'github' ? `GitHub · ${v.config.owner}/${v.config.repo}` : 'Só neste aparelho'}</b></div>
        {v.config?.mode === 'github' && (
          <>
            <div className="kv"><span>Situação</span><b>{v.status.state === 'idle' ? 'em dia' : v.status.state === 'syncing' ? 'sincronizando…' : v.status.state === 'offline' ? 'sem internet' : 'erro'}</b></div>
            <div className="kv"><span>Última sincronização</span><b>{v.status.lastSyncAt ? hhmm(v.status.lastSyncAt) : '—'}</b></div>
            <div className="kv"><span>Arquivos aguardando envio</span><b>{v.status.pending}</b></div>
            {v.status.message && <div className="error-box">{v.status.message}</div>}
          </>
        )}
        <div className="chips" style={{ marginTop: 12 }}>
          {v.config?.mode === 'github' && <button className="chip" onClick={() => syncNow()}>Sincronizar agora</button>}
          <button className="chip" onClick={() => setOpen('github')}>{v.config?.mode === 'github' ? 'Trocar token' : 'Conectar ao GitHub'}</button>
          <button className="chip" onClick={() => { const n = prompt('Nome de quem usa este celular', userName()); if (n?.trim()) updateUserName(n) }}>Mudar meu nome</button>
        </div>
      </div>

      <h2 className="section">Lixeira</h2>
      <div className="list">
        {v.trash.length === 0 && <div className="empty">Vazia.</div>}
        {v.trash.slice(0, 20).map((e) => {
          const d = describe(e, now)
          return (
            <div key={e.id} className="row">
              <span className={`ico t-${e.type}`}><TypeIcon type={e.type} size={18} /></span>
              <span className="grow"><div className="t">{d.title}</div><div className="d">{format(e.startedAt, 'dd/MM HH:mm')} · {d.detail}</div></span>
              <button className="chip small" onClick={() => { restore(e); toast('Registro recuperado') }}>Recuperar</button>
            </div>
          )
        })}
      </div>

      <h2 className="section">Backup</h2>
      <button className="big-btn soft" onClick={() => download(`babyttar-backup-${format(now, 'yyyy-MM-dd')}.json`, exportBackup())}>
        <Download size={20} /> Exportar tudo (JSON)
      </button>
      {v.config?.mode === 'local' && <p className="hint">No modo "só neste aparelho", faça backup de vez em quando ou conecte ao GitHub.</p>}
      <button className="big-btn danger" style={{ marginTop: 18 }} onClick={() => {
        if (confirm('Desconectar este celular? Os dados no GitHub continuam lá; neste celular você precisará conectar de novo.')) disconnect()
      }}>Desconectar este celular</button>
      <p className="disclaimer">Babyttar · uso pessoal. Não substitui a orientação do pediatra.</p>

      {open === 'profile' && <Sheet title="Editar bebê" onClose={() => setOpen(null)}><BabyForm baby={baby} onDone={() => setOpen(null)} /></Sheet>}
      {open === 'measure' && <MeasureSheet onClose={() => setOpen(null)} />}
      {open && typeof open === 'object' && <MedSheet med={open.med} onClose={() => setOpen(null)} />}
      {open === 'github' && <Sheet title="Conectar ao GitHub" onClose={() => setOpen(null)}><Setup initialName={userName()} onDone={() => setOpen(null)} /></Sheet>}
    </>
  )
}

function download(name: string, text: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

const num = (s: string) => { const n = parseFloat(s.replace(',', '.')); return isNaN(n) ? null : n }

function MeasureSheet({ onClose }: { onClose: () => void }) {
  const [date, setDate] = useState(format(Date.now(), 'yyyy-MM-dd'))
  const [kg, setKg] = useState('')
  const [cm, setCm] = useState('')
  const [head, setHead] = useState('')
  const [source, setSource] = useState<'home' | 'pediatra'>('pediatra')
  const toast = useToast()
  const w = num(kg), l = num(cm), h = num(head)
  return (
    <Sheet title="Nova medida" onClose={onClose}>
      <div className="field"><div className="label">Data</div><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="grid2">
        <div className="field"><div className="label">Peso (kg)</div><input inputMode="decimal" placeholder="4,350" value={kg} onChange={(e) => setKg(e.target.value)} /></div>
        <div className="field"><div className="label">Comprimento (cm)</div><input inputMode="decimal" placeholder="55,5" value={cm} onChange={(e) => setCm(e.target.value)} /></div>
      </div>
      <div className="field"><div className="label">Perímetro cefálico (cm, opcional)</div><input inputMode="decimal" value={head} onChange={(e) => setHead(e.target.value)} /></div>
      <div className="grid2" style={{ marginBottom: 16 }}>
        <button className={`choice ${source === 'pediatra' ? 'on' : ''}`} onClick={() => setSource('pediatra')}>Pediatra</button>
        <button className={`choice ${source === 'home' ? 'on' : ''}`} onClick={() => setSource('home')}>Em casa</button>
      </div>
      <button className="big-btn primary" disabled={!date || (w == null && l == null)} onClick={() => {
        put<Measurement>({
          col: 'measurement', id: newId(), measuredAt: date,
          weightG: w != null ? Math.round(w * 1000) : null, lengthMm: l != null ? Math.round(l * 10) : null, headMm: h != null ? Math.round(h * 10) : null,
          source, note: null, updatedAt: Date.now(), updatedBy: userName(), deletedAt: null, schemaVersion: 1,
        })
        toast('Medida salva')
        onClose()
      }}>Salvar</button>
    </Sheet>
  )
}

function MedSheet({ med, onClose }: { med: Medication | null; onClose: () => void }) {
  const [name, setName] = useState(med?.name ?? '')
  const [dose, setDose] = useState(med?.defaultDose != null ? String(med.defaultDose).replace('.', ',') : '')
  const [unit, setUnit] = useState(med?.unit ?? 'gotas')
  const [daily, setDaily] = useState<number | null>(med ? med.dailyTarget : 1)
  const [active, setActive] = useState(med?.active ?? true)
  return (
    <Sheet title={med ? 'Editar remédio' : 'Novo remédio'} onClose={onClose}>
      <div className="field"><div className="label">Nome</div><input value={name} placeholder="Vitamina D" onChange={(e) => setName(e.target.value)} /></div>
      <div className="grid2">
        <div className="field"><div className="label">Dose padrão</div><input inputMode="decimal" value={dose} onChange={(e) => setDose(e.target.value)} /></div>
        <div className="field"><div className="label">Unidade</div><input value={unit} onChange={(e) => setUnit(e.target.value)} /></div>
      </div>
      <div className="label">Lembrete no início</div>
      <div className="chips" style={{ marginBottom: 12 }}>
        {[null, 1, 2, 3].map((n) => (
          <button key={String(n)} className={`chip ${daily === n ? 'on' : ''}`} onClick={() => setDaily(n)}>{n ? `${n}×/dia` : 'Sem meta'}</button>
        ))}
      </div>
      {med && (
        <label className="row-inline" style={{ fontWeight: 650, marginBottom: 14 }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} style={{ width: 22, height: 22 }} /> Em uso
        </label>
      )}
      <p className="hint">Use as doses indicadas pelo pediatra.</p>
      <button className="big-btn primary" disabled={!name.trim()} onClick={() => {
        put<Medication>({
          col: 'medication', id: med?.id ?? newId(), name: name.trim(), defaultDose: num(dose), unit: unit.trim() || 'dose', dailyTarget: daily, active,
          updatedAt: Date.now(), updatedBy: userName(), deletedAt: null, schemaVersion: 1,
        })
        onClose()
      }}>Salvar</button>
    </Sheet>
  )
}
