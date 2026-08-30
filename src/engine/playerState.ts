/**
 * Player claims the engine can consume. Absence is unknown, never "does not own."
 * Next concern is a new union member, not a boolean field.
 */
export type PlayerFact = { fact: 'owns-ditto' }

export type PlayerState = readonly PlayerFact[]

export const unknownPlayer: PlayerState = []

export function hasPlayerFact(
  player: PlayerState,
  fact: PlayerFact['fact'],
): boolean {
  return player.some((item) => item.fact === fact)
}
