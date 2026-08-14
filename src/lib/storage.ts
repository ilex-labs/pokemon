/**
 * Typed localStorage helpers. Every key must use the `pokemon:` prefix —
 * sibling tools on ilex-labs.com share one origin.
 */

export function getJson<T>(key: string): T | null {
  if (!key.startsWith('pokemon:')) {
    throw new Error(`localStorage key must start with "pokemon:" (got "${key}")`)
  }
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function setJson<T>(key: string, value: T): void {
  if (!key.startsWith('pokemon:')) {
    throw new Error(`localStorage key must start with "pokemon:" (got "${key}")`)
  }
  localStorage.setItem(key, JSON.stringify(value))
}

export function removeJson(key: string): void {
  if (!key.startsWith('pokemon:')) {
    throw new Error(`localStorage key must start with "pokemon:" (got "${key}")`)
  }
  localStorage.removeItem(key)
}
