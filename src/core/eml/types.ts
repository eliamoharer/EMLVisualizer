import type { ClassicalExpr } from './expression'

export type Family =
  | 'primitive'
  | 'core'
  | 'arithmetic'
  | 'constants'
  | 'power'
  | 'trigonometric'
  | 'hyperbolic'
  | 'custom'

export const TOGGLEABLE_FAMILIES: Family[] = [
  'core',
  'arithmetic',
  'constants',
  'power',
  'trigonometric',
  'hyperbolic',
]

export type EmlTree =
  | { id: string; type: 'const'; semantic: ClassicalExpr }
  | { id: string; type: 'var'; name: string; semantic: ClassicalExpr }
  | { id: string; type: 'eml'; left: EmlTree; right: EmlTree; semantic: ClassicalExpr }

export interface DerivationNode {
  id: string
  name: string
  latex: string
  family: Family
  depth: number
  isLandmark: boolean
  description: string
  dependencies: string[]
  aliases: string[]
  formula: ClassicalExpr | null
  emlTree: EmlTree | null
}

export interface PositionedNode extends DerivationNode {
  x: number
  y: number
  radius: number
}

export interface GraphEdge {
  id: string
  from: string
  to: string
}

export interface EmlGraph {
  nodes: PositionedNode[]
  edges: GraphEdge[]
  rootId: string
}
