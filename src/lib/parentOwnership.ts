/**
 * Identity for the parent-header "I already have this" checklist.
 * Role letter alone goes stale when the parent behind it changes.
 * Held items and how-to-get copy are not the parent — omit them.
 */

export type ParentOwnershipIdentity = {
  role: 'A' | 'B'
  species: string[]
  gender?: 'male' | 'female'
  mustKnow?: string[]
  mustHaveAbility?: string
  mustHaveNature?: string
  mustOriginateFromDifferentLanguage?: boolean
}

const UNIT = '\u001f'

export function parentOwnershipKey(parent: ParentOwnershipIdentity): string {
  return [
    parent.role,
    parent.species.join(UNIT),
    parent.gender ?? '',
    parent.mustHaveNature ?? '',
    parent.mustHaveAbility ?? '',
    (parent.mustKnow ?? []).join(UNIT),
    parent.mustOriginateFromDifferentLanguage ? '1' : '0',
  ].join(UNIT)
}

export function pruneOwnedParentKeys(
  owned: string[],
  parents: ParentOwnershipIdentity[],
): string[] {
  const valid = new Set(parents.map(parentOwnershipKey))
  return owned.filter((key) => valid.has(key))
}
