// Acesso ao repositório privado de dados pela API do GitHub.

export interface GhConfig { owner: string; repo: string; token: string }

export class GhError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

const API = 'https://api.github.com'

async function gh(cfg: GhConfig, path: string, init: RequestInit = {}): Promise<any> {
  let res: Response
  try {
    res = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}${path}`, {
      ...init,
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${cfg.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
  } catch {
    throw new GhError(0, 'Sem conexão')
  }
  if (!res.ok) {
    let msg = res.statusText
    try { msg = (await res.json()).message ?? msg } catch { /* sem corpo */ }
    throw new GhError(res.status, msg)
  }
  return res.status === 204 ? null : res.json()
}

export function explain(err: unknown): string {
  if (err instanceof GhError) {
    if (err.status === 0) return 'Sem internet. Os registros ficam guardados e serão enviados depois.'
    if (err.status === 401) return 'Token inválido ou vencido. Cole um token novo em Bebê → Sincronização.'
    if (err.status === 403) return 'O token não tem permissão de gravar (Contents: Read and write) ou o limite da API foi atingido.'
    if (err.status === 404) return 'Repositório não encontrado. Confira o nome e se o token tem acesso a ele.'
    return `Erro do GitHub (${err.status}): ${err.message}`
  }
  return String(err)
}

export async function repoInfo(cfg: GhConfig): Promise<{ defaultBranch: string; private: boolean; canPush: boolean }> {
  const r = await gh(cfg, '')
  return { defaultBranch: r.default_branch, private: r.private, canPush: !!r.permissions?.push }
}

export interface TreeFile { path: string; sha: string }

/** Lista todos os arquivos do repositório (1 chamada). Repositório vazio → lista vazia. */
export async function listFiles(cfg: GhConfig, branch: string): Promise<TreeFile[]> {
  try {
    const t = await gh(cfg, `/git/trees/${encodeURIComponent(branch)}?recursive=1`)
    return (t.tree as any[]).filter((x) => x.type === 'blob').map((x) => ({ path: x.path, sha: x.sha }))
  } catch (e) {
    if (e instanceof GhError && (e.status === 409 || e.status === 404)) {
      // 409 = repositório vazio. 404 pode ser branch ainda inexistente; confere o repositório.
      if (e.status === 404) await repoInfo(cfg)
      return []
    }
    throw e
  }
}

export async function readBlob(cfg: GhConfig, sha: string): Promise<string> {
  const b = await gh(cfg, `/git/blobs/${sha}`)
  return decodeB64(b.content)
}

export async function readFile(cfg: GhConfig, path: string): Promise<{ sha: string; text: string } | null> {
  try {
    const f = await gh(cfg, `/contents/${path}`)
    return { sha: f.sha, text: decodeB64(f.content) }
  } catch (e) {
    if (e instanceof GhError && e.status === 404) return null
    throw e
  }
}

/** Cria ou atualiza um arquivo. Devolve o novo sha. Lança 409/422 se o sha estiver desatualizado. */
export async function writeFile(cfg: GhConfig, path: string, text: string, sha: string | null, message: string): Promise<string> {
  const r = await gh(cfg, `/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({ message, content: encodeB64(text), ...(sha ? { sha } : {}) }),
  })
  return r.content.sha
}

function encodeB64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
function decodeB64(b64: string): string {
  const bin = atob(b64.replace(/\n/g, ''))
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}
