import { describe, expect, it } from 'vitest'
import { generateEmlGraph } from '../generator'
import { emlTreeToString } from '../compiler'

describe('generateEmlGraph', () => {
  it('produces deterministic output', () => {
    const a = generateEmlGraph({ depth: 5, families: ['core', 'arithmetic', 'constants', 'power', 'trigonometric', 'hyperbolic'] })
    const b = generateEmlGraph({ depth: 5, families: ['core', 'arithmetic', 'constants', 'power', 'trigonometric', 'hyperbolic'] })
    expect(a.nodes.length).toBe(b.nodes.length)
    expect(a.edges.length).toBe(b.edges.length)
    expect(a.rootId).toBe('one')
  })

  it('root is always present', () => {
    const g = generateEmlGraph({ depth: 1, families: ['core'] })
    expect(g.nodes.find((n) => n.id === 'one')).toBeTruthy()
  })

  it('includes a non-trivial pure EML witness for x', () => {
    const g = generateEmlGraph({ depth: 1, families: ['core'] })
    const x = g.nodes.find((n) => n.id === 'x_anchor')
    expect(x).toBeTruthy()
    expect(x!.emlTree).toBeTruthy()
    expect(emlTreeToString(x!.emlTree!)).not.toBe('x')
    expect(emlTreeToString(x!.emlTree!)).toContain('eml(')
  })

  it('e = eml(1,1) appears at depth 1', () => {
    const g = generateEmlGraph({ depth: 1, families: ['core'] })
    const e = g.nodes.find((n) => n.id === 'e')
    expect(e).toBeTruthy()
    expect(e!.depth).toBe(1)
    expect(e!.emlTree).toBeTruthy()
    expect(emlTreeToString(e!.emlTree!)).toBe('eml(1, 1)')
  })

  it('respects depth filter', () => {
    const g = generateEmlGraph({ depth: 2, families: ['core', 'arithmetic'] })
    expect(g.nodes.every((n) => n.depth <= 2)).toBe(true)
  })

  it('keeps the depth-8 graph meaningfully spread out', () => {
    const g = generateEmlGraph({
      depth: 8,
      families: ['core', 'arithmetic', 'constants', 'power', 'trigonometric', 'hyperbolic'],
    })
    const xs = g.nodes.map((node) => node.x)
    const ys = g.nodes.map((node) => node.y)
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(700)
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(500)
  })

  it('places deeper nodes farther from the origin', () => {
    const g = generateEmlGraph({
      depth: 8,
      families: ['core', 'arithmetic', 'constants', 'power', 'trigonometric', 'hyperbolic'],
    })
    const radius = (id: string) => {
      const node = g.nodes.find((entry) => entry.id === id)
      expect(node).toBeTruthy()
      return Math.hypot(node!.x, node!.y)
    }

    expect(radius('e')).toBeLessThan(radius('ln'))
    expect(radius('ln')).toBeLessThan(radius('mul'))
    expect(radius('mul')).toBeLessThan(radius('sinh'))
  })

  it('builds tan from direct strict dependencies, not cosh shortcuts', () => {
    const g = generateEmlGraph({
      depth: 8,
      families: ['core', 'arithmetic', 'constants', 'power', 'trigonometric', 'hyperbolic'],
    })
    const tanParents = g.edges
      .filter((edge) => edge.to === 'tan')
      .map((edge) => edge.from)

    expect(tanParents).toEqual(
      expect.arrayContaining(['imag', 'mul', 'exp', 'neg', 'add', 'sub', 'div', 'two']),
    )
    expect(tanParents).not.toContain('cosh')
    expect(tanParents).not.toContain('sin')
    expect(tanParents).not.toContain('cos')
  })
})
