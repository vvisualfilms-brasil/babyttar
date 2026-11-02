import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { Baby, Medication, newId } from '../domain/types'
import { put, userName } from '../data/store'
import { resizePhoto } from '../ui/kit'

/** Cadastro e edição do bebê. No cadastro já oferece a vitamina D. */
export function BabyForm({ baby, onDone }: { baby?: Baby | null; onDone?: () => void }) {
  const [name, setName] = useState(baby?.name ?? '')
  const [birth, setBirth] = useState(baby?.birthDate ?? '')
  const [sex, setSex] = useState<Baby['sex'] | ''>(baby?.sex ?? '')
  const [photo, setPhoto] = useState<string | null>(baby?.photo ?? null)
  const [vitD, setVitD] = useState(!baby)
  const [vitDose, setVitDose] = useState('')
  const [vitUnit, setVitUnit] = useState('gotas')
  const fileRef = useRef<HTMLInputElement>(null)

  const ok = name.trim() && birth && sex

  function save() {
    if (!ok) return
    const now = Date.now()
    put<Baby>({
      col: 'baby', id: baby?.id ?? newId(), name: name.trim(), birthDate: birth, sex: sex as Baby['sex'], photo,
      updatedAt: now, updatedBy: userName(), deletedAt: null, schemaVersion: 1,
    })
    if (!baby && vitD) {
      const dose = parseFloat(vitDose.replace(',', '.'))
      put<Medication>({
        col: 'medication', id: newId(), name: 'Vitamina D', defaultDose: isNaN(dose) ? null : dose, unit: vitUnit, dailyTarget: 1, active: true,
        updatedAt: now, updatedBy: userName(), deletedAt: null, schemaVersion: 1,
      })
    }
    onDone?.()
  }

  return (
    <div>
      {!baby && <h1 className="title-xl" style={{ marginTop: 24 }}>Vamos conhecer o bebê</h1>}
      {!baby && <p className="lead">Isso aparece no topo do app e calcula a idade sozinho.</p>}

      <button onClick={() => fileRef.current?.click()} className="avatar" style={{ width: 104, height: 104, margin: '0 auto 16px', display: 'grid' }} aria-label="Escolher foto">
        {photo ? <img src={photo} alt="" /> : <Camera size={30} />}
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => {
        const f = e.target.files?.[0]
        if (f) setPhoto(await resizePhoto(f))
      }} />

      <div className="field">
        <div className="label">Nome</div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do bebê" />
      </div>
      <div className="field">
        <div className="label">Data de nascimento</div>
        <input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />
      </div>
      <div className="field">
        <div className="label">Sexo</div>
        <div className="grid2">
          <button className={`choice ${sex === 'female' ? 'on' : ''}`} onClick={() => setSex('female')}>Menina</button>
          <button className={`choice ${sex === 'male' ? 'on' : ''}`} onClick={() => setSex('male')}>Menino</button>
        </div>
        <p className="hint">Usado nas curvas de crescimento da OMS.</p>
      </div>

      {!baby && (
        <div className="card" style={{ margin: '8px 0 16px' }}>
          <label className="row-inline" style={{ fontWeight: 650 }}>
            <input type="checkbox" checked={vitD} onChange={(e) => setVitD(e.target.checked)} style={{ width: 22, height: 22 }} />
            Dá vitamina D todo dia
          </label>
          {vitD && (
            <div className="row-inline" style={{ marginTop: 12 }}>
              <input inputMode="decimal" placeholder="Dose (ex. 2)" value={vitDose} onChange={(e) => setVitDose(e.target.value)} />
              <select value={vitUnit} onChange={(e) => setVitUnit(e.target.value)} style={{ width: 130 }}>
                <option>gotas</option><option>ml</option><option>UI</option>
              </select>
            </div>
          )}
          {vitD && <p className="hint">Use a dose que o pediatra indicou. Dá para mudar depois.</p>}
        </div>
      )}

      <button className="big-btn primary" disabled={!ok} onClick={save}>{baby ? 'Salvar' : 'Começar'}</button>
    </div>
  )
}
