import type { EmlTree } from './types'

export function evaluateEml(left: number, right: number): number {
  if (right <= 0) return Number.NaN
  return Math.exp(left) - Math.log(right)
}

export function evaluateEmlTree(
  tree: EmlTree,
  variables: Record<string, number> = {},
): number {
  if (tree.type === 'const') return 1
  if (tree.type === 'var') return variables[tree.name] ?? Number.NaN
  const left = evaluateEmlTree(tree.left, variables)
  const right = evaluateEmlTree(tree.right, variables)
  return evaluateEml(left, right)
}
