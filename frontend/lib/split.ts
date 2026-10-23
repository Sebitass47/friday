// How a charge is divided between you and other people.
// The backend stores YOUR part as the expense `amount` and the others' parts as shares,
// so the card is charged amount + shares while every "disponible" calculation only sees your part.

export type SplitMode = 'mine' | 'equal' | 'custom' | 'other'

export interface SplitState {
  mode: SplitMode
  people: string[]                    // selected person ids
  weights: Record<string, number>     // 'equal' mode: relative parts ("yo 2, ella 1"); missing = 1
  amounts: Record<string, number>     // 'custom' mode: exact amount per person
}

export const ME = 'me'

export const emptySplit = (): SplitState => ({ mode: 'mine', people: [], weights: {}, amounts: {} })

export interface SplitResult {
  mine: number
  shares: { person_id: string; amount: number }[]
  error: string | null
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function computeSplit(total: number, s: SplitState): SplitResult {
  if (!(total > 0) || s.mode === 'mine') return { mine: total > 0 ? total : 0, shares: [], error: null }

  if (s.people.length === 0) {
    return { mine: total, shares: [], error: s.mode === 'other' ? 'Elige de quién es' : 'Elige con quién dividir' }
  }

  if (s.mode === 'other') {
    return { mine: 0, shares: [{ person_id: s.people[0], amount: r2(total) }], error: null }
  }

  if (s.mode === 'equal') {
    const w = (id: string) => (s.weights[id] && s.weights[id] > 0 ? s.weights[id] : 1)
    const sum = w(ME) + s.people.reduce((a, id) => a + w(id), 0)
    const shares = s.people.map(id => ({ person_id: id, amount: r2((total * w(id)) / sum) }))
    // Rounding dust goes to you so mine + shares is exactly the total
    const mine = r2(total - shares.reduce((a, x) => a + x.amount, 0))
    return { mine, shares: shares.filter(x => x.amount > 0), error: null }
  }

  const shares = s.people.map(id => ({ person_id: id, amount: r2(s.amounts[id] || 0) })).filter(x => x.amount > 0)
  const mine = r2(total - shares.reduce((a, x) => a + x.amount, 0))
  return { mine, shares, error: mine < 0 ? 'Lo de los demás supera el total' : null }
}

/** Rebuild the picker state from saved shares (editing an existing shared MSI). */
export function splitFromShares(shares: { person_id: string; amount: number }[]): SplitState {
  if (shares.length === 0) return emptySplit()
  return {
    mode: 'custom',
    people: shares.map(s => s.person_id),
    weights: {},
    amounts: Object.fromEntries(shares.map(s => [s.person_id, s.amount])),
  }
}
