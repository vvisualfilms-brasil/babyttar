import { useCallback, useState } from 'react'
import { ChartColumn, History as HistoryIcon, House, Plus, User } from 'lucide-react'
import { BabyEvent, EventType } from './domain/types'
import { TYPE_LABEL } from './domain/describe'
import { useView } from './data/store'
import { Sheet, ToastProvider, TypeIcon } from './ui/kit'
import { Setup } from './screens/Setup'
import { BabyForm } from './screens/BabyForm'
import { Home, QUICK } from './screens/Home'
import { History } from './screens/History'
import { Reports } from './screens/Reports'
import { BabyTab } from './screens/BabyTab'
import { QuickSheet } from './screens/QuickSheets'
import { EventEditor } from './screens/EventEditor'

type Tab = 'home' | 'history' | 'reports' | 'baby'
type Overlay =
  | null
  | { kind: 'picker' }
  | { kind: 'quick'; type: EventType }
  | { kind: 'edit'; event: BabyEvent }
  | { kind: 'new'; type: EventType | null; dayTs: number }

export default function App() {
  return <ToastProvider><Main /></ToastProvider>
}

function Main() {
  const v = useView()
  const [tab, setTab] = useState<Tab>('home')
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [openMeds, setOpenMeds] = useState(false)
  const close = () => setOverlay(null)
  const medsShown = useCallback(() => setOpenMeds(false), [])

  if (!v.ready) return null
  if (!v.config) return <div className="app"><Setup /></div>
  if (!v.baby) {
    return (
      <div className="app">
        {v.status.state === 'syncing' ? <div className="center-page"><p className="lead">Buscando dados no GitHub…</p></div> : <BabyForm />}
      </div>
    )
  }

  // Abre a edição sempre com a versão mais recente do registro.
  const latest = (e: BabyEvent) => v.events.find((x) => x.id === e.id) ?? e

  return (
    <div className="app">
      {tab === 'home' && <Home v={v} onQuick={(type) => setOverlay({ kind: 'quick', type })} onEdit={(e) => setOverlay({ kind: 'edit', event: e })} onProfile={() => setTab('baby')} />}
      {tab === 'history' && <History v={v} onEdit={(e) => setOverlay({ kind: 'edit', event: e })} onRetro={(dayTs) => setOverlay({ kind: 'new', type: null, dayTs })} />}
      {tab === 'reports' && <Reports v={v} />}
      {tab === 'baby' && <BabyTab v={v} openMeds={openMeds} onMedsShown={medsShown} />}

      <nav className="tabbar">
        <div className="in">
          <TabBtn on={tab === 'home'} label="Início" icon={<House size={22} />} onClick={() => setTab('home')} />
          <TabBtn on={tab === 'history'} label="Histórico" icon={<HistoryIcon size={22} />} onClick={() => setTab('history')} />
          <button className="plus" aria-label="Registrar" onClick={() => setOverlay({ kind: 'picker' })}><Plus size={30} /></button>
          <TabBtn on={tab === 'reports'} label="Relatórios" icon={<ChartColumn size={22} />} onClick={() => setTab('reports')} />
          <TabBtn on={tab === 'baby'} label="Bebê" icon={<User size={22} />} onClick={() => setTab('baby')} />
        </div>
      </nav>

      {overlay?.kind === 'picker' && (
        <Sheet title="Registrar" onClose={close}>
          <div className="quick">
            {QUICK.map((t) => (
              <button key={t} className={`qbtn t-${t}`} onClick={() => setOverlay({ kind: 'quick', type: t })}>
                <span className="ico"><TypeIcon type={t} /></span>{TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          <button className="big-btn soft" style={{ marginTop: 14 }} onClick={() => setOverlay({ kind: 'new', type: null, dayTs: Date.now() })}>Registro de outro horário/dia</button>
        </Sheet>
      )}
      {overlay?.kind === 'quick' && (
        <QuickSheet type={overlay.type} events={v.events} medications={v.medications} onClose={close}
          onRetro={(type) => setOverlay({ kind: 'new', type, dayTs: Date.now() })}
          onManageMeds={() => { close(); setOpenMeds(true); setTab('baby') }} />
      )}
      {overlay?.kind === 'edit' && <EventEditor event={latest(overlay.event)} events={v.events} medications={v.medications} onClose={close} />}
      {overlay?.kind === 'new' && <EventEditor newType={overlay.type} dayTs={overlay.dayTs} events={v.events} medications={v.medications} onClose={close} />}
    </div>
  )
}

function TabBtn({ on, label, icon, onClick }: { on: boolean; label: string; icon: React.ReactNode; onClick: () => void }) {
  return <button className={`tab ${on ? 'on' : ''}`} onClick={onClick}>{icon}{label}</button>
}
