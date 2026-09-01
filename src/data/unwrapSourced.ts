/**
 * JSON claim leaves are `{ value, src, note? }`. The engine and UI read
 * unwrapped values. Notes on shiny-odds objects are copied to `sourceNote`.
 */

export type SourcedLeaf<T = unknown> = {
  value: T
  src: string[]
  note?: string
}

export function isSourcedLeaf(node: unknown): node is SourcedLeaf {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return false
  const keys = Object.keys(node)
  if (!keys.includes('value') || !keys.includes('src')) return false
  if (!keys.every((key) => key === 'value' || key === 'src' || key === 'note')) {
    return false
  }
  const { src, note } = node as { src: unknown; note?: unknown }
  if (!Array.isArray(src)) return false
  if (note !== undefined && typeof note !== 'string') return false
  return true
}

export function unwrapSourced<T>(node: T): T {
  return unwrapNode(node) as T
}

function unwrapNode(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(unwrapNode)
  if (isSourcedLeaf(node)) return unwrapNode(node.value)
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {}
    let oddsNote: string | undefined
    for (const [key, child] of Object.entries(node)) {
      if (isSourcedLeaf(child) && child.note) oddsNote = child.note
      const unwrapped = unwrapNode(child)
      if (key === 'masudaMethod' && unwrapped === null) continue
      out[key] = unwrapped
    }
    if (
      oddsNote &&
      typeof out.odds === 'string' &&
      typeof out.approximateEggs === 'number' &&
      out.sourceNote === undefined
    ) {
      out.sourceNote = oddsNote
    }
    return out
  }
  return node
}
