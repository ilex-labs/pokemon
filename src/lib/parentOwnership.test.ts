import { describe, expect, it } from 'vitest'
import {
  parentOwnershipKey,
  pruneOwnedParentKeys,
  type ParentOwnershipIdentity,
} from './parentOwnership'

const unconstrainedA: ParentOwnershipIdentity = {
  role: 'A',
  species: ['Charmander'],
}

const timidA: ParentOwnershipIdentity = {
  role: 'A',
  species: ['Charmander'],
  gender: 'female',
  mustHaveNature: 'Timid',
}

const unconstrainedB: ParentOwnershipIdentity = {
  role: 'B',
  species: ['Charmander'],
}

describe('parentOwnershipKey', () => {
  it('role letter alone does not collide across different parents', () => {
    expect(parentOwnershipKey(unconstrainedA)).not.toBe(
      parentOwnershipKey(timidA),
    )
  })

  it('two unconstrained Charmanders stay distinct by role', () => {
    expect(parentOwnershipKey(unconstrainedA)).not.toBe(
      parentOwnershipKey(unconstrainedB),
    )
  })

  it('held-item-only fields are not on the identity type — nature change is enough', () => {
    expect(parentOwnershipKey(unconstrainedA)).toBe(
      parentOwnershipKey({ ...unconstrainedA }),
    )
  })
})

describe('pruneOwnedParentKeys', () => {
  it('drops Parent A after the parent behind A changes nature', () => {
    const owned = [parentOwnershipKey(unconstrainedA)]
    expect(pruneOwnedParentKeys(owned, [timidA, unconstrainedB])).toEqual([])
  })

  it('keeps Parent B when only A’s identity changes', () => {
    const owned = [
      parentOwnershipKey(unconstrainedA),
      parentOwnershipKey(unconstrainedB),
    ]
    expect(pruneOwnedParentKeys(owned, [timidA, unconstrainedB])).toEqual([
      parentOwnershipKey(unconstrainedB),
    ])
  })

  it('drops legacy role-letter keys that are not identity keys', () => {
    expect(
      pruneOwnedParentKeys(['A', 'B'], [unconstrainedA, unconstrainedB]),
    ).toEqual([])
  })
})
