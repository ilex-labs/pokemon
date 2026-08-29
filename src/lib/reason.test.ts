import { describe, expect, it } from 'vitest'
import { formatReason, formatReasons, type Reason } from './reason'

describe('formatReason', () => {
  it('female-species-holder names the offspring species', () => {
    expect(
      formatReason({
        code: 'female-species-holder',
        offspringSpecies: 'Charmander',
      }),
    ).toBe(
      "Female because the female parent determines the offspring's species — eggs hatch as Charmander.",
    )
  })

  it('female-ability-needs-ditto', () => {
    expect(formatReason({ code: 'female-ability-needs-ditto' })).toBe(
      'Female because a male or genderless parent can only pass its ability when paired with Ditto.',
    )
  })

  it('male-external-carrier with one species names it twice', () => {
    expect(
      formatReason({
        code: 'male-external-carrier',
        carrierSpecies: ['FixtureCarrier'],
      }),
    ).toBe(
      'Male because a female FixtureCarrier would produce FixtureCarrier eggs instead.',
    )
  })

  it('male-external-carrier with several species uses a list', () => {
    expect(
      formatReason({
        code: 'male-external-carrier',
        carrierSpecies: ['Salamence', 'Dragapult', 'Gyarados'],
      }),
    ).toBe(
      'Male because a female of that species (Salamence, Dragapult, or Gyarados) would produce its own eggs instead.',
    )
  })

  it('male-egg-move-eligible is the father-passes rule', () => {
    expect(formatReason({ code: 'male-egg-move-eligible' })).toBe(
      'Male because only the father passes egg moves in this game.',
    )
  })

  it('pair-opposite-genders names the pair rule, not the species rule', () => {
    expect(formatReason({ code: 'pair-opposite-genders' })).toBe(
      'The pair needs one female and one male — this arrangement is one valid choice.',
    )
  })

  it('everstone-guaranteed names the nature', () => {
    expect(
      formatReason({ code: 'everstone-guaranteed', nature: 'Timid' }),
    ).toBe('Guarantees the hatch inherits Timid.')
  })

  it('everstone-chance hedges the same nature', () => {
    expect(
      formatReason({ code: 'everstone-chance', nature: 'Timid' }),
    ).toBe('Gives a 50% chance the hatch inherits Timid.')
  })

  it('holder-female-or-ditto names the holder rule, not the item', () => {
    expect(formatReason({ code: 'holder-female-or-ditto' })).toBe(
      'The holder must be a female parent or a Ditto.',
    )
  })

  it('destiny-knot-iv names the inherited counts', () => {
    expect(
      formatReason({
        code: 'destiny-knot-iv',
        baseCountInherited: 3,
        destinyKnotBoostedCount: 5,
      }),
    ).toBe(
      'Serves the IV target — raises inherited IVs from 3 to 5.',
    )
  })

  it('power-item-iv locks one stat', () => {
    expect(formatReason({ code: 'power-item-iv' })).toBe(
      'Serves the IV target — locks one specific parent IV into the hatch.',
    )
  })
})

describe('formatReasons', () => {
  it('composes two male reasons without restating Male because', () => {
    const reasons: Reason[] = [
      {
        code: 'male-external-carrier',
        carrierSpecies: ['FixtureCarrier'],
      },
      { code: 'male-egg-move-eligible' },
    ]
    const sentence = formatReasons(reasons)
    expect(sentence).toBe(
      'Male because a female FixtureCarrier would produce FixtureCarrier eggs instead, and because only the father passes egg moves in this game.',
    )
    expect(sentence.match(/Male because/g)).toEqual(['Male because'])
    expect(sentence).not.toMatch(/and because.*and because/)
  })

  it('composes the list-form carrier the same way', () => {
    const reasons: Reason[] = [
      {
        code: 'male-external-carrier',
        carrierSpecies: ['Salamence', 'Dragapult', 'Gyarados'],
      },
      { code: 'male-egg-move-eligible' },
    ]
    expect(formatReasons(reasons)).toBe(
      'Male because a female of that species (Salamence, Dragapult, or Gyarados) would produce its own eggs instead, and because only the father passes egg moves in this game.',
    )
  })

  it('composes three reasons as a series, not and-because twice', () => {
    const reasons: Reason[] = [
      {
        code: 'male-external-carrier',
        carrierSpecies: ['FixtureCarrier'],
      },
      { code: 'male-egg-move-eligible' },
      {
        code: 'male-external-carrier',
        carrierSpecies: ['Salamence'],
      },
    ]
    const sentence = formatReasons(reasons)
    expect(sentence).toBe(
      'Male because a female FixtureCarrier would produce FixtureCarrier eggs instead, only the father passes egg moves in this game, and a female Salamence would produce Salamence eggs instead.',
    )
    expect(sentence.match(/Male because/g)).toEqual(['Male because'])
    expect(sentence).not.toMatch(/and because.*and because/)
  })
})

describe('formatReason acquisition', () => {
  it('acquire-nature', () => {
    expect(
      formatReason({
        code: 'acquire-nature',
        nature: 'Timid',
        how: 'Keep hunting wild encounters.',
      }),
    ).toBe('Acquire a Timid parent first: Keep hunting wild encounters.')
  })

  it('mints-dont-pass', () => {
    expect(formatReason({ code: 'mints-dont-pass' })).toBe(
      'Nature Mints only change battle stats — a minted Pokémon still passes its original nature. An item that fixes a Pokémon for battle does not fix it for the daycare.',
    )
  })

  it('acquire-hidden-can-pass', () => {
    expect(
      formatReason({
        code: 'acquire-hidden-can-pass',
        ability: 'Solar Power',
        how: 'Catch one with the hidden ability.',
      }),
    ).toBe('Solar Power is a hidden ability — Catch one with the hidden ability.')
  })

  it('acquire-hidden-cannot-pass', () => {
    expect(
      formatReason({
        code: 'acquire-hidden-cannot-pass',
        ability: 'Solar Power',
        how: 'Use an Ability Patch where available.',
      }),
    ).toBe(
      'Solar Power cannot be passed via eggs here. Use an Ability Patch where available.',
    )
  })

  it('acquire-standard-ability', () => {
    expect(
      formatReason({
        code: 'acquire-standard-ability',
        ability: 'Blaze',
        how: 'Catch one in the wild.',
      }),
    ).toBe('Acquire Blaze: Catch one in the wild.')
  })

  it('acquire-egg-move-pair includes passers and need', () => {
    expect(
      formatReason({
        code: 'acquire-egg-move-pair',
        species: 'Charmander',
        moves: ['Dragon Dance'],
        how: 'Catch or hatch one that already knows the move, or copy it at a picnic with a Mirror Herb.',
        passers: ['Salamence', 'Dragapult', 'Gyarados'],
      }),
    ).toBe(
      'Egg moves are not level-up moves for Charmander. Concrete passers in this game: Salamence, Dragapult, Gyarados. Catch or hatch one that already knows the move, or copy it at a picnic with a Mirror Herb. Need: Dragon Dance.',
    )
  })

  it('acquire-egg-move-ditto-alternative', () => {
    expect(
      formatReason({
        code: 'acquire-egg-move-ditto-alternative',
        species: 'Charmander',
        moves: ['Dragon Dance'],
        alternativeName: 'Mirror Herb',
        alternativeHow:
          'Held during a picnic, it copies egg moves from a partner that already knows them.',
        passers: ['Salamence', 'Dragapult', 'Gyarados'],
      }),
    ).toBe(
      'Consolidate Dragon Dance onto Charmander first using Mirror Herb: Held during a picnic, it copies egg moves from a partner that already knows them. Picnic with a partner that already knows the move — in this game that includes Salamence, Dragapult, Gyarados. Ditto only knows Transform and cannot pass egg moves.',
    )
  })

  it('acquire-egg-move-ditto-father-only', () => {
    expect(
      formatReason({
        code: 'acquire-egg-move-ditto-father-only',
        species: 'Charmander',
        moves: ['Dragon Dance'],
      }),
    ).toBe(
      'This route needs a male Charmander that already knows Dragon Dance. In this game that usually means hatching one from the species-pair route first (only the father passes egg moves); there is no separate teach-onto-the-line mechanic. Ditto only knows Transform and cannot pass egg moves.',
    )
  })

  it('acquire-egg-move-ditto-bootstrap', () => {
    expect(
      formatReason({
        code: 'acquire-egg-move-ditto-bootstrap',
        species: 'Charmander',
        moves: ['Dragon Dance'],
      }),
    ).toBe(
      'This route needs a Charmander that already knows Dragon Dance. In this game that usually means getting the moves via the species-pair route first; there is no separate teach-onto-the-line mechanic. Ditto only knows Transform and cannot pass egg moves.',
    )
  })

  it('acquire-ditto strips trailing periods then adds one', () => {
    expect(
      formatReason({
        code: 'acquire-ditto',
        obtainedAt:
          'Wild encounters across Paldea (including outbreaks); also available via picnic eggs from a Ditto parent pair.',
      }),
    ).toBe(
      'Obtain Ditto: Wild encounters across Paldea (including outbreaks); also available via picnic eggs from a Ditto parent pair.',
    )
  })

  it('acquire-masuda is the game how string', () => {
    expect(
      formatReason({
        code: 'acquire-masuda',
        how: 'You may already have one — a Japanese Charmander with an English Ditto would count. Otherwise trade for one, or import from a cartridge saved in another language.',
      }),
    ).toBe(
      'You may already have one — a Japanese Charmander with an English Ditto would count. Otherwise trade for one, or import from a cartridge saved in another language.',
    )
  })

  it('egg-group-unknown', () => {
    expect(
      formatReason({
        code: 'egg-group-unknown',
        species: 'FixtureGhost',
      }),
    ).toBe('no egg-group data is held for FixtureGhost')
  })

  it('egg-group-catalogued-empty', () => {
    expect(
      formatReason({
        code: 'egg-group-catalogued-empty',
        species: 'FixturePasser',
      }),
    ).toBe(
      'FixturePasser is in the catalog but has no egg-group membership recorded',
    )
  })
})

describe('formatReason step flags', () => {
  it('blocked-pair-no-ditto', () => {
    expect(
      formatReason({ code: 'blocked-pair-no-ditto', species: 'Charmander' }),
    ).toBe(
      'No valid pair exists for Charmander — Ditto is unavailable in this game.',
    )
  })

  it('incense-omit-yields-adult', () => {
    expect(
      formatReason({
        code: 'incense-omit-yields-adult',
        adult: 'Marill',
        baby: 'Azurill',
      }),
    ).toBe('Omitting the incense silently yields Marill instead of Azurill.')
  })

  it('acquire-hidden-cannot-pass without how does not restate hidden ability', () => {
    expect(
      formatReason({
        code: 'acquire-hidden-cannot-pass',
        ability: 'Solar Power',
      }),
    ).toBe('Solar Power cannot be passed via eggs here.')
  })

  it('hidden-ability-lower-rate', () => {
    expect(
      formatReason({
        code: 'hidden-ability-lower-rate',
        hiddenOdds: 0.6,
        standardOdds: 0.8,
      }),
    ).toBe(
      'Hidden abilities pass at a lower rate than standard ones (60% per egg vs 80%).',
    )
  })

  it('hyper-no-access is not an effort tier', () => {
    expect(
      formatReason({ code: 'hyper-no-access', level: 50 }),
    ).toBe(
      "Hyper Training doesn't change the IVs a Pokémon passes down, so it suits a finished battler while hatching suits a parent you'll pair from again. A Gold Bottle Cap can max every IV at level 50.",
    )
  })

  it('hyper-effort rare names the gold-cap source', () => {
    expect(
      formatReason({
        code: 'hyper-effort',
        tier: 'rare',
        level: 50,
        goldBottleCap:
          'Accumulators auction listings and rare special rewards',
      }),
    ).toBe(
      "Hyper Training doesn't change the IVs a Pokémon passes down, so it suits a finished battler while hatching suits a parent you'll pair from again. A Gold Bottle Cap maxes every IV at level 50, but Gold Bottle Caps are rare here (Accumulators auction listings and rare special rewards).",
    )
  })

  it('hyper-cannot-make-zero', () => {
    expect(formatReason({ code: 'hyper-cannot-make-zero' })).toBe(
      'Hyper Training only raises IVs and can never produce a 0. A 0 requires a parent that already has 0 in that stat. Hyper Trained parents pass their innate IVs, not the trained ones.',
    )
  })

  it('held-item-conflict appendix is a param', () => {
    expect(
      formatReason({
        code: 'held-item-conflict',
        assigned: ['Everstone', 'Destiny Knot'],
        unassigned: ['a power item'],
        knotVersusPower: true,
      }),
    ).toBe(
      'Only two held-item slots exist (one per parent). Assigned: Everstone, Destiny Knot. Could not also fit: a power item. Destiny Knot spreads five IVs while a power item guarantees one specific stat — which matters more depends on whether you need the spread or a locked stat.',
    )
  })

  it('unknown-species', () => {
    expect(
      formatReason({ code: 'unknown-species', species: 'MissingNo' }),
    ).toBe('No species entry for MissingNo.')
  })
})

describe('formatReason recommend and exclude', () => {
  it('recommend-masuda-ditto-reuse', () => {
    expect(formatReason({ code: 'recommend-masuda-ditto-reuse' })).toBe(
      'A Ditto works with any species, so you can reuse it for other hatches.',
    )
  })

  it('recommend-only-viable-route', () => {
    expect(formatReason({ code: 'recommend-only-viable-route' })).toBe(
      'Only viable pairing route in this game.',
    )
  })

  it('recommend-easier-gender names the uncommon female hunt', () => {
    expect(formatReason({ code: 'recommend-easier-gender' })).toBe(
      "This route needs less hunting for a female parent of a species that's rarely female.",
    )
  })

  it('recommend-start-from-hatch names the consuming pairing', () => {
    expect(
      formatReason({
        code: 'recommend-start-from-hatch',
        laterLabel: 'Ditto pair',
      }),
    ).toBe(
      'Start here — Ditto pair needs a hatch from this route that already knows the egg move.',
    )
  })

  it('requires-hatch-from-route names the supplier and the move', () => {
    expect(
      formatReason({
        code: 'requires-hatch-from-route',
        fromLabels: ['Species pair'],
        moves: ['Dragon Dance'],
      }),
    ).toBe(
      'This pairing is a follow-on — it needs a hatch from Species pair that already knows Dragon Dance.',
    )
  })

  it('requires-hatch-from-route names both suppliers when cost cannot pick one', () => {
    expect(
      formatReason({
        code: 'requires-hatch-from-route',
        fromLabels: ['Same-species pair', 'External carrier'],
        moves: ['FixtureMove'],
      }),
    ).toBe(
      'This pairing is a follow-on — it needs a hatch from Same-species pair or External carrier that already knows FixtureMove.',
    )
  })

  it('incomparable-routes names conflicting egg-move work, not a menu of axes', () => {
    expect(
      formatReason({
        code: 'incomparable-routes',
        gVersusExtra: false,
        left: ['carrier'],
        right: ['consolidated'],
        alternativeName: 'Mirror Herb',
      }),
    ).toBe(
      "These routes aren't comparable — using another species as a carrier and copying the move with Mirror Herb aren't the same kind of work.",
    )
  })

  it('incomparable-routes names the pair and on-the-line passing versus a carrier', () => {
    expect(
      formatReason({
        code: 'incomparable-routes',
        aLabel: 'Same-species pair',
        bLabel: 'External carrier',
        gVersusExtra: false,
        left: ['same-species'],
        right: ['carrier'],
      }),
    ).toBe(
      "Same-species pair and External carrier aren't comparable — passing the move on the line and using another species as a carrier aren't the same kind of work.",
    )
  })

  it('incomparable-routes mentions gender only when it is the conflict', () => {
    expect(
      formatReason({
        code: 'incomparable-routes',
        gVersusExtra: true,
        left: [],
        right: ['masuda'],
      }),
    ).toBe(
      "These routes aren't comparable — a rarer gender hunt and a different-language parent aren't the same kind of cost.",
    )
  })

  it('exclude-pair-hidden-needs-ditto', () => {
    expect(
      formatReason({
        code: 'exclude-pair-hidden-needs-ditto',
        ability: 'Solar Power',
      }),
    ).toBe(
      "Solar Power can't be passed on a species pair — a male or genderless parent only passes its hidden ability when paired with Ditto.",
    )
  })

  it('exclude-pair-ability-needs-ditto', () => {
    expect(
      formatReason({
        code: 'exclude-pair-ability-needs-ditto',
        ability: 'Blaze',
      }),
    ).toBe(
      "Blaze can't be passed on a species pair — a male or genderless parent only passes its ability when paired with Ditto.",
    )
  })

  it('exclude-pair-ditto-only-species', () => {
    expect(
      formatReason({
        code: 'exclude-pair-ditto-only-species',
        species: 'Charmander',
      }),
    ).toBe('Charmander can only pair with Ditto in this game.')
  })
})
