import { View } from '../data/store'
import { fmtDuration } from '../domain/time'
import { periodStats } from '../domain/stats'
import { useNow } from '../ui/kit'

const fmt1 = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
const clock = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(Math.round(min % 60)).padStart(2, '0')}`

/** MVP: médias dos últimos 7 dias completos. Gráficos e outros períodos vêm na fase 2. */
export function Reports({ v }: { v: View }) {
  const now = useNow(60_000)
  const p = periodStats(v.events, now, 7, now)
  const prev = periodStats(v.events, now - 7 * 86_400_000, 7, now)
  const diff = (a: number, b: number, f: (n: number) => string) =>
    prev.daysWithData ? (a === b ? 'igual à semana anterior' : `${a > b ? '+' : '−'}${f(Math.abs(a - b))} vs. semana anterior`) : ''

  return (
    <>
      <h1 style={{ fontSize: 26, margin: '8px 4px 4px' }}>Resumo da semana</h1>
      <p className="hint" style={{ margin: '0 4px 14px' }}>
        Últimos 7 dias completos · baseado em {p.daysWithData} de 7 dias com registro
      </p>

      {p.daysWithData === 0 ? (
        <div className="card empty">Ainda não há um dia completo registrado. As médias aparecem a partir de amanhã.</div>
      ) : (
        <div className="card">
          <Line k="Despertar médio" v={p.avg.wakeMinutes != null ? clock(p.avg.wakeMinutes) : '—'} />
          <Line k="Sono por dia" v={fmtDuration(p.avg.sleepMs)} s={diff(p.avg.sleepMs, prev.avg.sleepMs, fmtDuration)} />
          <Line k="Acordado por dia" v={fmtDuration(p.avg.awakeMs)} />
          <Line k="Mamadas por dia" v={fmt1(p.avg.feedings)} s={`${p.totals.feedings} na semana`} />
          <Line k="Evacuações por dia" v={fmt1(p.avg.poops)} s={`${p.totals.poops} na semana`} />
          <Line k="Fraldas por dia" v={fmt1(p.avg.diapers)} s={`${p.totals.diapers} na semana`} />
          <Line k="Tummy time por dia" v={fmtDuration(p.avg.tummyMs)} />
          {p.avg.bottleMl > 0 && <Line k="Mamadeira por dia" v={`${Math.round(p.avg.bottleMl)} ml`} />}
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <b>Em breve (fase 2)</b>
        <p className="note">Gráficos, períodos de 30 dias a todo o histórico, comparação entre períodos, curvas de crescimento da OMS e exportação em PDF/CSV.</p>
      </div>
      <p className="disclaimer">O Babyttar só organiza e descreve os registros. Não faz diagnósticos nem substitui a orientação do pediatra.</p>
    </>
  )
}

function Line({ k, v, s }: { k: string; v: string; s?: string }) {
  return (
    <div className="kv">
      <span>{k}{s && <><br /><small style={{ fontSize: 12 }}>{s}</small></>}</span>
      <b>{v}</b>
    </div>
  )
}
