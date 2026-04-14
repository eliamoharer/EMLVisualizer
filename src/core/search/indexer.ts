import type { PositionedNode } from '../eml/types'

export interface SearchEntry {
  id: string
  label: string
  family: string
  terms: string[]
}

export interface SearchIndex {
  entries: SearchEntry[]
}

export function buildSearchIndex(nodes: PositionedNode[]): SearchIndex {
  const entries = nodes.map((node) => ({
    id: node.id,
    label: node.isLandmark ? `${node.name}  —  ${node.description}` : node.name,
    family: node.family,
    terms: normalizeTerms([
      node.name,
      node.latex,
      node.description,
      ...node.aliases,
    ]),
  }))
  return { entries }
}

export function querySearchIndex(
  index: SearchIndex,
  term: string,
  limit = 14,
): SearchEntry[] {
  const normalized = normalizeSearchTerm(term)
  if (!normalized) return []
  return index.entries
    .filter((entry) => entry.terms.some((value) => value.includes(normalized)))
    .sort((a, b) => scoreEntry(b, normalized) - scoreEntry(a, normalized))
    .slice(0, limit)
}

function normalizeTerms(values: string[]): string[] {
  return Array.from(new Set(values.map(normalizeSearchTerm).filter(Boolean)))
}

function normalizeSearchTerm(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('π', 'pi')
    .replaceAll('×', '*')
    .replaceAll('·', '*')
    .replaceAll('−', '-')
    .replaceAll('√', 'sqrt')
    .replaceAll('ʸ', '^y')
    .replace(/\s+/g, '')
}

function scoreEntry(entry: SearchEntry, term: string): number {
  let score = 0
  for (const value of entry.terms) {
    if (value === term) score += 100
    else if (value.startsWith(term)) score += 40
    else if (value.includes(term)) score += 10
  }
  return score
}
