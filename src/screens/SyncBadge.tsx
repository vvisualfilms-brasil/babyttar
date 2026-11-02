import { Cloud, CloudOff, RefreshCw, Smartphone } from 'lucide-react'
import { SyncStatus } from '../data/sync'
import { syncNow } from '../data/store'

export function SyncBadge({ status }: { status: SyncStatus }) {
  const { state, pending } = status
  if (state === 'local') return <span className="sync"><Smartphone size={14} /> só aqui</span>
  const icon = state === 'syncing' ? <RefreshCw size={14} /> : state === 'offline' || state === 'error' ? <CloudOff size={14} /> : <Cloud size={14} />
  const text = state === 'syncing' ? 'sincronizando' : state === 'offline' ? `offline${pending ? ` · ${pending}` : ''}` : state === 'error' ? 'erro' : pending ? 'enviando' : 'em dia'
  return (
    <button className={`sync ${state === 'error' ? 'error' : ''}`} onClick={() => { syncNow(); if (status.message) alert(status.message) }} title={status.message}>
      {icon} {text}
    </button>
  )
}
