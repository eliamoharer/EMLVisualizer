import { describe, expect, it } from 'vitest'
import { collectDagHighlight, tracePathToRoot } from '../pathTrace'
import type { EmlGraph } from '../../eml/types'

describe('tracePathToRoot', () => {
  it('traces derivation path back to root', () => {
    const graph: EmlGraph = {
      rootId: 'one',
      nodes: [],
      edges: [
        { id: 'e1', from: 'one', to: 'e' },
        { id: 'e2', from: 'one', to: 'exp' },
        { id: 'e3', from: 'exp', to: 'ln' },
        { id: 'e4', from: 'ln', to: 'zero' },
      ],
    }
    const path = tracePathToRoot(graph, 'zero')
    expect(path).toEqual(['one', 'exp', 'ln', 'zero'])
  })

  it('returns just root for root id', () => {
    const graph: EmlGraph = { rootId: 'one', nodes: [], edges: [] }
    expect(tracePathToRoot(graph, 'one')).toEqual(['one'])
  })

  it('collects the strict construction ancestry without shortcut branches', () => {
    const graph: EmlGraph = {
      rootId: 'one',
      nodes: [
        { id: 'one', name: '1', latex: '1', family: 'primitive', depth: 0, isLandmark: true, description: '', dependencies: [], aliases: [], formula: null, emlTree: null, x: 0, y: 0, radius: 10 },
        { id: 'x_anchor', name: 'x', latex: 'x', family: 'primitive', depth: 0, isLandmark: true, description: '', dependencies: [], aliases: [], formula: null, emlTree: null, x: 0, y: 0, radius: 10 },
        { id: 'imag', name: 'i', latex: 'i', family: 'constants', depth: 6, isLandmark: false, description: '', dependencies: ['one'], aliases: [], formula: null, emlTree: null, x: 0, y: 0, radius: 10 },
        { id: 'two', name: '2', latex: '2', family: 'constants', depth: 5, isLandmark: false, description: '', dependencies: ['one'], aliases: [], formula: null, emlTree: null, x: 0, y: 0, radius: 10 },
        { id: 'mul', name: 'mul', latex: 'x \\cdot y', family: 'arithmetic', depth: 5, isLandmark: false, description: '', dependencies: ['x_anchor'], aliases: [], formula: null, emlTree: null, x: 0, y: 0, radius: 10 },
        { id: 'neg', name: 'neg', latex: '-x', family: 'arithmetic', depth: 3, isLandmark: false, description: '', dependencies: ['one'], aliases: [], formula: null, emlTree: null, x: 0, y: 0, radius: 10 },
        { id: 'exp', name: 'exp', latex: 'e^x', family: 'core', depth: 1, isLandmark: false, description: '', dependencies: ['one'], aliases: [], formula: null, emlTree: null, x: 0, y: 0, radius: 10 },
        { id: 'add', name: 'add', latex: 'x + y', family: 'arithmetic', depth: 4, isLandmark: false, description: '', dependencies: ['one'], aliases: [], formula: null, emlTree: null, x: 0, y: 0, radius: 10 },
        { id: 'sub', name: 'sub', latex: 'x - y', family: 'arithmetic', depth: 3, isLandmark: false, description: '', dependencies: ['one'], aliases: [], formula: null, emlTree: null, x: 0, y: 0, radius: 10 },
        { id: 'div', name: 'div', latex: '\\frac{x}{y}', family: 'arithmetic', depth: 5, isLandmark: false, description: '', dependencies: ['one'], aliases: [], formula: null, emlTree: null, x: 0, y: 0, radius: 10 },
        { id: 'tan', name: 'tan', latex: '\\tan x', family: 'trigonometric', depth: 8, isLandmark: false, description: '', dependencies: ['imag', 'mul', 'exp', 'neg', 'add', 'sub', 'div', 'two', 'x_anchor'], aliases: [], formula: null, emlTree: null, x: 0, y: 0, radius: 10 },
      ],
      edges: [
        { id: 'e1', from: 'one', to: 'imag' },
        { id: 'e2', from: 'one', to: 'two' },
        { id: 'e3', from: 'x_anchor', to: 'mul' },
        { id: 'e4', from: 'one', to: 'neg' },
        { id: 'e5', from: 'one', to: 'exp' },
        { id: 'e6', from: 'one', to: 'add' },
        { id: 'e7', from: 'one', to: 'sub' },
        { id: 'e8', from: 'one', to: 'div' },
        { id: 'e9', from: 'imag', to: 'tan' },
        { id: 'e10', from: 'mul', to: 'tan' },
        { id: 'e11', from: 'exp', to: 'tan' },
        { id: 'e12', from: 'neg', to: 'tan' },
        { id: 'e13', from: 'add', to: 'tan' },
        { id: 'e14', from: 'sub', to: 'tan' },
        { id: 'e15', from: 'div', to: 'tan' },
        { id: 'e16', from: 'two', to: 'tan' },
      ],
    }

    const highlight = collectDagHighlight(graph, 'tan')
    expect(highlight.nodeIds).toEqual(
      expect.arrayContaining([
        'one',
        'x_anchor',
        'exp',
        'neg',
        'sub',
        'add',
        'div',
        'two',
        'imag',
        'mul',
        'tan',
      ]),
    )
    expect(highlight.nodeIds).toHaveLength(11)
    expect(highlight.nodeIds).not.toContain('cosh')
    expect(highlight.edgeIds).toEqual(
      expect.arrayContaining([
        'e1',
        'e2',
        'e3',
        'e4',
        'e5',
        'e6',
        'e7',
        'e8',
        'e9',
        'e10',
        'e11',
        'e12',
        'e13',
        'e14',
        'e15',
        'e16',
      ]),
    )
    expect(highlight.edgeIds).toHaveLength(16)
  })
})
