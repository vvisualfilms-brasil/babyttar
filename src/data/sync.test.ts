import { describe, it, expect } from 'vitest'
import { Api, Config, Persisted, SyncEngine } from './sync'
import { GhError } from './github'
import { BabyEvent, Rec } from '../domain/types'

// GitHub falso em memória
function fakeRepo() {
  const files = new Map<string, { sha: string; text: string }>()
  let n = 0
  let online = true
  const api: Api = {
    async listFiles() { if (!online) throw new GhError(0, 'off'); return [...files].map(([path, f]) => ({ path, sha: f.sha })) },
    async readBlob(_c, sha) { for (const f of files.values()) if (f.sha === sha) return f.text; throw new GhError(404, 'x') },
    async readFile(_c, path) { return files.get(path) ?? null },
    async writeFile(_c, path, text, sha) {
      if (!online) throw new GhError(0, 'off')
      const cur = files.get(path)
      if ((cur?.sha ?? null) !== sha) throw new GhError(409, 'conflict')
      const s = `sha${n++}`
      files.set(path, { sha: s, text })
      return s
    },
  }
  return { api, files, setOnline: (v: boolean) => { online = v } }
}
const mem = () => { let p: Persisted | undefined; return { load: async () => p, save: async (x: Persisted) => { p = x } } }
const cfg = (userName: string, device: string): Config => ({ mode: 'github', userName, device, owner: 'o', repo: 'r', token: 't', branch: 'main' })
const ev = (id: string, startedAt: number): BabyEvent => ({
  col: 'event', id, type: 'bath', kind: 'point', startedAt, endedAt: null, data: {}, note: null,
  createdBy: '', createdAt: 0, updatedAt: 0, updatedBy: '', deletedAt: null, schemaVersion: 1,
})
const get = (e: SyncEngine, id: string) => e.records.get(`event:${id}`) as Rec & { startedAt: number; deletedAt: number | null } | undefined

describe('sincronização entre dois celulares', () => {
  it('o que um registra aparece no outro', async () => {
    const gh = fakeRepo()
    const pai = new SyncEngine(cfg('Pai', 'pai-1'), gh.api, mem())
    const mae = new SyncEngine(cfg('Mãe', 'mae-2'), gh.api, mem())
    pai.put(ev('a', 100))
    mae.put(ev('b', 200))
    await pai.sync(); await mae.sync(); await pai.sync()
    expect(get(pai, 'b')).toBeTruthy()
    expect(get(mae, 'a')).toBeTruthy()
    expect([...gh.files.keys()].every((p) => p.startsWith('devices/pai-1/') || p.startsWith('devices/mae-2/'))).toBe(true)
  })

  it('edição do outro responsável vale (versão mais recente) e a anterior fica guardada', async () => {
    const gh = fakeRepo()
    const pai = new SyncEngine(cfg('Pai', 'pai-1'), gh.api, mem())
    const mae = new SyncEngine(cfg('Mãe', 'mae-2'), gh.api, mem())
    pai.put(ev('a', 100), 1000)
    await pai.sync(); await mae.sync()
    mae.put({ ...(get(mae, 'a') as BabyEvent), startedAt: 150 }, 2000)
    await mae.sync(); await pai.sync()
    expect(get(pai, 'a')!.startedAt).toBe(150)
    const paiFile = [...gh.files].find(([p]) => p.startsWith('devices/pai-1/'))![1].text
    expect(paiFile).toContain('"startedAt":100') // versão original preservada
  })

  it('offline: guarda e envia quando a internet volta', async () => {
    const gh = fakeRepo()
    const pai = new SyncEngine(cfg('Pai', 'pai-1'), gh.api, mem())
    gh.setOnline(false)
    pai.put(ev('a', 100))
    await pai.sync()
    expect(pai.status.state).toBe('offline')
    expect(pai.status.pending).toBe(1)
    expect(get(pai, 'a')).toBeTruthy()
    gh.setOnline(true)
    await pai.sync()
    expect(pai.status.state).toBe('idle')
    expect(pai.status.pending).toBe(0)
    expect(gh.files.size).toBe(1)
  })

  it('exclusão sincroniza como lixeira', async () => {
    const gh = fakeRepo()
    const pai = new SyncEngine(cfg('Pai', 'pai-1'), gh.api, mem())
    const mae = new SyncEngine(cfg('Mãe', 'mae-2'), gh.api, mem())
    pai.put(ev('a', 100), 1000); await pai.sync(); await mae.sync()
    mae.put({ ...(get(mae, 'a') as BabyEvent), deletedAt: 5 }, 3000); await mae.sync(); await pai.sync()
    expect(get(pai, 'a')!.deletedAt).toBe(5)
  })

  it('reabrir o app recupera tudo do armazenamento local', async () => {
    const gh = fakeRepo()
    const store = mem()
    const a = new SyncEngine(cfg('Pai', 'pai-1'), gh.api, store)
    a.put(ev('x', 1)); await a.flush()
    const b = new SyncEngine(cfg('Pai', 'pai-1'), gh.api, store)
    await b.load()
    expect(get(b, 'x')).toBeTruthy()
    expect(b.status.pending).toBe(1)
  })
})
