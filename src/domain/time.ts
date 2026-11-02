// Datas e durações. Os dias são recortados no fuso do aparelho.
import { addDays, differenceInDays, differenceInMonths, addMonths, format, startOfDay, parseISO } from 'date-fns'

export const MIN = 60_000
export const HOUR = 60 * MIN

export const dayStart = (ts: number) => startOfDay(ts).getTime()
export const nextDayStart = (ts: number) => addDays(startOfDay(ts), 1).getTime()
export const dayKey = (ts: number) => format(ts, 'yyyy-MM-dd')
export const dayFromKey = (key: string) => parseISO(key).getTime()
export const hhmm = (ts: number) => format(ts, 'HH:mm')

/** Quanto do intervalo [start, end) cai dentro de [from, to). Base do cálculo que atravessa a meia-noite. */
export function overlap(start: number, end: number, from: number, to: number): number {
  return Math.max(0, Math.min(end, to) - Math.max(start, from))
}

/** Lista as chaves de dia (AAAA-MM-DD) que o intervalo toca. */
export function daysTouched(start: number, end: number): string[] {
  const out: string[] = []
  let d = dayStart(start)
  const last = end > start ? end - 1 : start
  while (d <= last) {
    out.push(dayKey(d))
    d = nextDayStart(d)
  }
  return out
}

/** "1h 05min", "45 min", "0 min" */
export function fmtDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / MIN))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m} min`
  return `${h}h ${String(m).padStart(2, '0')}min`
}

/** Versão curta para timers: "1:05:09" ou "12:09" */
export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

/** "agora", "há 5 min", "há 2h05" */
export function fmtAgo(ts: number, now: number): string {
  const min = Math.floor((now - ts) / MIN)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 48) return `há ${h}h${String(min % 60).padStart(2, '0')}`
  return `há ${Math.floor(h / 24)} dias`
}

/** Idade em meses e dias: "2 meses e 11 dias", "15 dias", "1 ano e 3 meses". */
export function ageText(birthDate: string, now: number): string {
  const birth = parseISO(birthDate)
  if (now < birth.getTime()) return 'ainda não nasceu'
  const months = differenceInMonths(now, birth)
  const days = differenceInDays(now, addMonths(birth, months))
  const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`
  if (months === 0) return plural(days, 'dia', 'dias')
  if (months < 24) {
    const m = plural(months, 'mês', 'meses')
    return days ? `${m} e ${plural(days, 'dia', 'dias')}` : m
  }
  const y = Math.floor(months / 12)
  const rm = months % 12
  const ys = plural(y, 'ano', 'anos')
  return rm ? `${ys} e ${plural(rm, 'mês', 'meses')}` : ys
}

/** Para campos <input type="datetime-local"> */
export const toLocalInput = (ts: number) => format(ts, "yyyy-MM-dd'T'HH:mm")
export const fromLocalInput = (s: string) => new Date(s).getTime()

/** Sugere soneca ou sono noturno pelo horário de início. */
export function suggestSleepContext(start: number): 'nap' | 'night' {
  const h = new Date(start).getHours()
  return h >= 19 || h < 5 ? 'night' : 'nap'
}
