// Motor de dados: guarda no aparelho, envia/baixa do GitHub e junta tudo.
// Cada celular grava só nos seus próprios arquivos (devices/<celular>/<AAAA-MM>.json).
import { Rec, keyOf } from '../domain/types'
import { GhConfig, GhError, TreeFile, explain } from './github'
import { mergeInto, newer, parseFile, serializeFile } from './merge'

export interface Config {
  mode: 'local' | 'github'
  userName: string
  device: string // ex. "pai-3f9a" (pasta deste celular no repositório)
  owner?: string
  repo?: string
  token?: string
  branch?: string
}

export interface OwnFile { sha: string | null; recs: Record<string, Rec>; dirty: boolean; ver: number }
export interface RemoteFile { sha: string; recs: Rec[] }
export interface Persisted { own: Record<string, OwnFile>; remote: Record<string, RemoteFile> }

export interface Api {
  listFiles(cfg: GhConfig, branch: string): Promise<TreeFile[]>
  readBlob(cfg: GhConfig, sha: string): Promise<string>
  readFile(cfg: GhConfig, path: string): Promise<{ sha: string; text: string } | null>
  writeFile(cfg: GhConfig, path: string, text: string, sha: string | null, message: string): Promise<string>
}

export interface Storage {
  load(): Promise<Persisted | undefined>
  save(p: Persisted): Promise<void>
}

export type SyncState = 'local' | 'idle' | 'syncing' | 'offline' | 'error'
export interface SyncStatus { state: SyncState; message: string; lastSyncAt: number | null; pending: number }

const monthOf = (ts: number) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export class SyncEngine {
  data: Persisted = { own: {}, remote: {} }
  records = new Map<string, Rec>()
  status: SyncStatus = { state: 'local', message: '', lastSyncAt: null, pending: 0 }
  private running: Promise<void> | null = null
  private again = false
  private saveChain: Promise<void> = Promise.resolve()
  onChange: () => void = () => {}

  constructor(public config: Config, private api: Api, private storage: Storage) {
    this.status.state = config.mode === 'github' ? 'idle' : 'local'
  }

  get ownPrefix() { return `devices/${this.config.device}/` }
  private get gh(): GhConfig { return { owner: this.config.owner!, repo: this.config.repo!, token: this.config.token! } }

  async load() {
    const p = await this.storage.load()
    if (p) this.data = p
    this.rebuild()
  }

  private rebuild() {
    const m = new Map<string, Rec>()
    for (const f of Object.values(this.data.own)) mergeInto(m, Object.values(f.recs))
    for (const f of Object.values(this.data.remote)) mergeInto(m, f.recs)
    this.records = m
    this.updatePending()
  }

  private updatePending() {
    this.status = { ...this.status, pending: Object.values(this.data.own).filter((f) => f.dirty).length }
  }

  private persist() {
    const snapshot = this.data
    this.saveChain = this.saveChain.then(() => this.storage.save(snapshot)).catch(() => {})
    return this.saveChain
  }

  private emit() { this.onChange() }

  /** Grava uma nova versão de um registro (criar, editar ou excluir). */
  put(rec: Rec, now = Date.now()): Rec {
    const k = keyOf(rec)
    const prev = this.records.get(k)
    const v = { ...rec, updatedAt: Math.max(now, (prev?.updatedAt ?? 0) + 1), updatedBy: this.config.userName, schemaVersion: 1 } as Rec
    const path = `${this.ownPrefix}${monthOf(now)}.json`
    const f = this.data.own[path] ?? { sha: null, recs: {}, dirty: false, ver: 0 }
    this.data = { ...this.data, own: { ...this.data.own, [path]: { ...f, recs: { ...f.recs, [k]: v }, dirty: true, ver: f.ver + 1 } } }
    if (newer(v, this.records.get(k))) {
      this.records = new Map(this.records)
      this.records.set(k, v)
    }
    this.updatePending()
    this.persist()
    this.emit()
    return v
  }

  /** Sincroniza agora (envia pendentes, depois baixa novidades). Chamadas simultâneas viram uma só. */
  sync(): Promise<void> {
    if (this.config.mode !== 'github') return Promise.resolve()
    if (this.running) { this.again = true; return this.running }
    this.running = (async () => {
      do {
        this.again = false
        this.status = { ...this.status, state: 'syncing', message: '' }
        this.emit()
        try {
          await this.push()
          await this.pull()
          this.status = { ...this.status, state: 'idle', message: '', lastSyncAt: Date.now() }
        } catch (e) {
          const offline = e instanceof GhError && e.status === 0
          this.status = { ...this.status, state: offline ? 'offline' : 'error', message: explain(e) }
        }
        this.updatePending()
        this.emit()
      } while (this.again && this.status.state === 'idle')
    })().finally(() => { this.running = null })
    return this.running
  }

  private async push() {
    for (const [path, f] of Object.entries(this.data.own)) {
      if (!f.dirty) continue
      const ver = f.ver
      let recs = f.recs
      let sha = f.sha
      const msg = `${this.config.userName}: ${Object.keys(recs).length} registro(s)`
      try {
        sha = await this.api.writeFile(this.gh, path, serializeFile(this.config.device, Object.values(recs)), sha, msg)
      } catch (e) {
        if (!(e instanceof GhError) || (e.status !== 409 && e.status !== 422)) throw e
        // O arquivo mudou no GitHub (ex.: app reinstalado com o mesmo nome). Junta e grava de novo.
        const remote = await this.api.readFile(this.gh, path)
        const m = new Map(Object.entries(recs))
        if (remote) mergeInto(m, parseFile(remote.text))
        recs = Object.fromEntries(m)
        sha = await this.api.writeFile(this.gh, path, serializeFile(this.config.device, Object.values(recs)), remote?.sha ?? null, msg)
      }
      const cur = this.data.own[path]
      const stillDirty = cur.ver !== ver
      this.data = {
        ...this.data,
        own: { ...this.data.own, [path]: { ...cur, sha, recs: { ...recs, ...(stillDirty ? cur.recs : {}) }, dirty: stillDirty } },
      }
      this.persist()
    }
  }

  private async pull() {
    const files = (await this.api.listFiles(this.gh, this.config.branch ?? 'main')).filter(
      (f) => f.path.startsWith('devices/') && f.path.endsWith('.json'),
    )
    let changed = false
    for (const file of files) {
      if (file.path.startsWith(this.ownPrefix)) {
        const own = this.data.own[file.path]
        if (own && (own.sha === file.sha || own.dirty)) continue
        const recs = parseFile(await this.api.readBlob(this.gh, file.sha))
        const m = new Map(Object.entries(own?.recs ?? {}))
        mergeInto(m, recs)
        this.data = { ...this.data, own: { ...this.data.own, [file.path]: { sha: file.sha, recs: Object.fromEntries(m), dirty: false, ver: own?.ver ?? 0 } } }
        changed = true
      } else {
        if (this.data.remote[file.path]?.sha === file.sha) continue
        const recs = parseFile(await this.api.readBlob(this.gh, file.sha))
        this.data = { ...this.data, remote: { ...this.data.remote, [file.path]: { sha: file.sha, recs } } }
        changed = true
      }
    }
    if (changed) {
      this.rebuild()
      this.persist()
    }
  }

  /** Passa do modo "só neste aparelho" para o GitHub: tudo o que existe vira pendente de envio. */
  connect(cfg: Config) {
    this.config = cfg
    const own: Record<string, OwnFile> = {}
    for (const [p, f] of Object.entries(this.data.own)) own[p] = { ...f, sha: null, dirty: Object.keys(f.recs).length > 0 }
    this.data = { ...this.data, own }
    this.status = { ...this.status, state: cfg.mode === 'github' ? 'idle' : 'local', message: '' }
    this.updatePending()
    this.persist()
    this.emit()
  }

  flush() { return this.saveChain }
}
