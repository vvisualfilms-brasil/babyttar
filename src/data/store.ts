// Estado global do app: configuração, registros já juntados e status da sincronização.
import { useSyncExternalStore } from 'react'
import { get, set } from 'idb-keyval'
import { Baby, BabyEvent, Measurement, Medication, Rec, newId } from '../domain/types'
import * as gh from './github'
import { Config, Persisted, SyncEngine, SyncStatus } from './sync'

const CONFIG_KEY = 'babyttar.config'
const DATA_KEY = 'babyttar.data'
const POLL_MS = 30_000

export interface View {
  ready: boolean
  config: Config | null
  baby: Baby | null
  events: BabyEvent[] // ativos, mais recentes primeiro
  trash: BabyEvent[]
  medications: Medication[]
  measurements: Measurement[]
  status: SyncStatus
}

let engine: SyncEngine | null = null
let view: View = {
  ready: false, config: null, baby: null, events: [], trash: [], medications: [], measurements: [],
  status: { state: 'local', message: '', lastSyncAt: null, pending: 0 },
}
const listeners = new Set<() => void>()

function loadConfig(): Config | null {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY) ?? 'null') } catch { return null }
}
function saveConfig(c: Config | null) {
  if (c) localStorage.setItem(CONFIG_KEY, JSON.stringify(c))
  else localStorage.removeItem(CONFIG_KEY)
}

function recompute() {
  const recs = engine ? [...engine.records.values()] : []
  const events: BabyEvent[] = []
  const trash: BabyEvent[] = []
  const medications: Medication[] = []
  const measurements: Measurement[] = []
  let baby: Baby | null = null
  for (const r of recs) {
    if (r.col === 'event') (r.deletedAt ? trash : events).push(r)
    else if (r.deletedAt) continue
    else if (r.col === 'medication') medications.push(r)
    else if (r.col === 'measurement') measurements.push(r)
    else if (r.col === 'baby' && (!baby || r.updatedAt > baby.updatedAt)) baby = r
  }
  events.sort((a, b) => b.startedAt - a.startedAt)
  trash.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
  medications.sort((a, b) => a.name.localeCompare(b.name))
  measurements.sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))
  view = { ready: true, config: engine?.config ?? null, baby, events, trash, medications, measurements, status: engine?.status ?? view.status }
  listeners.forEach((l) => l())
}

const storage = {
  load: () => get<Persisted>(DATA_KEY),
  save: (p: Persisted) => set(DATA_KEY, p),
}

function startEngine(cfg: Config) {
  engine = new SyncEngine(cfg, gh, storage)
  engine.onChange = recompute
}

export async function init() {
  try { await navigator.storage?.persist?.() } catch { /* opcional */ }
  const cfg = loadConfig()
  if (cfg) {
    startEngine(cfg)
    await engine!.load()
  }
  recompute()
  syncNow()
  setInterval(() => { if (document.visibilityState === 'visible') syncNow() }, POLL_MS)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow() })
  window.addEventListener('online', () => syncNow())
}

export const syncNow = () => engine?.sync()

export function useView(): View {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => view)
}

// ── Configuração ──────────────────────────────────────────────

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'celular'

export function setupLocal(userName: string) {
  const cfg: Config = { mode: 'local', userName, device: `${slug(userName)}-${newId().slice(0, 4)}` }
  saveConfig(cfg)
  startEngine(cfg)
  recompute()
}

/** Valida o acesso ao repositório e conecta. Lança erro com mensagem amigável. */
export async function setupGithub(input: { userName: string; repoFull: string; token: string }): Promise<{ warning?: string }> {
  const [owner, repo] = input.repoFull.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').split('/')
  if (!owner || !repo) throw new Error('Escreva o repositório como usuario/babyttar-dados')
  const ghc = { owner, repo, token: input.token.trim() }
  let info
  try { info = await gh.repoInfo(ghc) } catch (e) { throw new Error(gh.explain(e)) }
  if (!info.canPush) throw new Error('O token só tem permissão de leitura. Ele precisa de "Contents: Read and write".')
  const device = engine?.config.device ?? `${slug(input.userName)}-${newId().slice(0, 4)}`
  const cfg: Config = { mode: 'github', userName: input.userName.trim(), device, owner, repo, token: ghc.token, branch: info.defaultBranch }
  saveConfig(cfg)
  if (engine) engine.connect(cfg)
  else { startEngine(cfg); await engine!.load() }
  recompute()
  await engine!.sync()
  return info.private ? {} : { warning: 'Atenção: esse repositório é PÚBLICO. Deixe-o privado em Settings → General → Danger Zone.' }
}

export function updateUserName(name: string) {
  if (!engine) return
  engine.config = { ...engine.config, userName: name.trim() }
  saveConfig(engine.config)
  recompute()
}

export function disconnect() {
  saveConfig(null)
  engine = null
  recompute()
}

// ── Registros ─────────────────────────────────────────────────

export function put<T extends Rec>(rec: T): T {
  if (!engine) throw new Error('App não configurado')
  const v = engine.put(rec) as T
  engine.sync()
  return v
}

export const userName = () => engine?.config.userName ?? ''

export function remove<T extends Rec>(rec: T): T {
  return put({ ...rec, deletedAt: Date.now() })
}
export function restore<T extends Rec>(rec: T): T {
  return put({ ...rec, deletedAt: null })
}

export function exportBackup(): string {
  return JSON.stringify({ exportedAt: new Date().toISOString(), records: engine ? [...engine.records.values()] : [] }, null, 1)
}
