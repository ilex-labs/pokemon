/**
 * Per-game player facts. Separate from the daycare plan blob so selectGame
 * can wipe the plan without forgetting a Ditto claim.
 */
import type { PlayerFact } from '../engine/playerState'
import { getJson, setJson } from './storage'

export const PLAYER_FACTS_KEY = 'pokemon:player-facts:v1'

function isPlayerFact(value: unknown): value is PlayerFact {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return record.fact === 'owns-ditto' && Object.keys(record).length === 1
}

function readAll(): Record<string, PlayerFact[]> {
  const raw = getJson<unknown>(PLAYER_FACTS_KEY)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const next: Record<string, PlayerFact[]> = {}
  for (const [gameId, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue
    const facts = list.filter(isPlayerFact)
    if (facts.length > 0) next[gameId] = facts
  }
  return next
}

export function readPlayerFacts(gameId: string): PlayerFact[] {
  return readAll()[gameId] ?? []
}

export function writePlayerFacts(gameId: string, facts: PlayerFact[]) {
  const all = readAll()
  if (facts.length === 0) {
    delete all[gameId]
  } else {
    all[gameId] = [...facts]
  }
  setJson(PLAYER_FACTS_KEY, all)
}
