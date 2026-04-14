import type { Family } from './types'

export interface FamilyMeta {
  key: Family
  label: string
  color: string
  sectorAngle: number
}

export const FAMILY_META: Record<Family, FamilyMeta> = {
  primitive: { key: 'primitive', label: 'Origin', color: '#d4a59a', sectorAngle: -Math.PI / 2 },
  core: { key: 'core', label: 'Exp / Log', color: '#94b8d4', sectorAngle: -Math.PI / 4 },
  arithmetic: { key: 'arithmetic', label: 'Arithmetic', color: '#b0a0c8', sectorAngle: Math.PI / 8 },
  constants: { key: 'constants', label: 'Constants', color: '#c8bc8c', sectorAngle: Math.PI / 3 },
  power: { key: 'power', label: 'Powers', color: '#b4a890', sectorAngle: Math.PI * 0.6 },
  trigonometric: { key: 'trigonometric', label: 'Trigonometry', color: '#c89898', sectorAngle: Math.PI * 0.85 },
  hyperbolic: { key: 'hyperbolic', label: 'Hyperbolic', color: '#88b4b0', sectorAngle: -Math.PI * 0.8 },
  custom: { key: 'custom', label: 'Custom', color: '#9ea7bf', sectorAngle: Math.PI * 0.05 },
}
