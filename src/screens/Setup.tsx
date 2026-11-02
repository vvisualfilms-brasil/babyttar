import { useState } from 'react'
import { setupGithub, setupLocal } from '../data/store'

const ICON = `${import.meta.env.BASE_URL}icon-192.png`

/** Primeira tela: conectar ao repositório de dados no GitHub (ou testar só neste aparelho). */
export function Setup({ initialName = '', onDone }: { initialName?: string; onDone?: () => void }) {
  const [name, setName] = useState(initialName)
  const [repo, setRepo] = useState('')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')

  async function connect() {
    setBusy(true); setError(''); setWarning('')
    try {
      const r = await setupGithub({ userName: name.trim(), repoFull: repo, token })
      if (r.warning) setWarning(r.warning)
      onDone?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const ok = name.trim() && repo.includes('/') && token.trim().length > 20

  return (
    <div className="center-page">
      {!onDone && (
        <>
          <img className="logo" src={ICON} alt="" />
          <h1 className="title-xl">Babyttar</h1>
          <p className="lead">A rotina do bebê em poucos toques,<br />compartilhada entre pai e mãe.</p>
        </>
      )}

      <div className="card">
        <div className="field">
          <div className="label">Quem vai usar este celular?</div>
          <div className="chips" style={{ marginBottom: 10 }}>
            {['Mãe', 'Pai'].map((n) => (
              <button key={n} className={`chip ${name === n ? 'on' : ''}`} onClick={() => setName(n)}>{n}</button>
            ))}
          </div>
          <input placeholder="ou escreva um nome" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="field">
          <div className="label">Repositório de dados (privado)</div>
          <input placeholder="usuario/babyttar-dados" autoCapitalize="off" autoCorrect="off" spellCheck={false} value={repo} onChange={(e) => setRepo(e.target.value)} />
        </div>

        <div className="field">
          <div className="label">Token do GitHub</div>
          <input placeholder="github_pat_…" type="password" autoCapitalize="off" autoCorrect="off" spellCheck={false} value={token} onChange={(e) => setToken(e.target.value)} />
          <p className="note">
            Token "fine-grained" com acesso só a esse repositório e permissão <b>Contents: Read and write</b>.
            Fica guardado apenas neste celular. Passo a passo no arquivo <i>docs/02-Como-publicar-e-instalar.md</i>.
          </p>
        </div>

        {error && <div className="error-box">{error}</div>}
        {warning && <div className="error-box">{warning}</div>}

        <button className="big-btn primary" disabled={!ok || busy} onClick={connect}>
          {busy ? 'Conectando…' : 'Conectar'}
        </button>
      </div>

      {!onDone && (
        <button className="big-btn soft" style={{ marginTop: 14 }} disabled={!name.trim()} onClick={() => setupLocal(name.trim())}>
          Testar só neste aparelho
        </button>
      )}
      {!onDone && <p className="note" style={{ textAlign: 'center', marginTop: 8 }}>Dá para conectar ao GitHub depois, sem perder nada.</p>}
    </div>
  )
}
