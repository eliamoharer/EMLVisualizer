import { exprNodeCount, type ClassicalExpr } from './expression'
import { inferStrictDependencies } from './construction'
import type { Family } from './types'

const TRIG_OPS = new Set([
  'sin',
  'cos',
  'tan',
  'arcsin',
  'arccos',
  'arctan',
])

const HYPERBOLIC_OPS = new Set([
  'sinh',
  'cosh',
  'tanh',
  'arsinh',
  'arcosh',
  'artanh',
  'sigma',
])

export function expressionUsesVariable(
  expr: ClassicalExpr | null,
  name = 'x',
): boolean {
  if (!expr) return false
  switch (expr.kind) {
    case 'var':
      return expr.name === name
    case 'unary':
      return expressionUsesVariable(expr.arg, name)
    case 'binary':
      return (
        expressionUsesVariable(expr.left, name) ||
        expressionUsesVariable(expr.right, name)
      )
    default:
      return false
  }
}

export function inferExpressionFamily(expr: ClassicalExpr): Family {
  let best: Family = expressionUsesVariable(expr) ? 'arithmetic' : 'constants'
  visit(expr)
  return best

  function upgrade(candidate: Family): void {
    if (familyScore(candidate) > familyScore(best)) {
      best = candidate
    }
  }

  function visit(node: ClassicalExpr): void {
    switch (node.kind) {
      case 'number':
      case 'const':
        upgrade('constants')
        return
      case 'var':
        upgrade('primitive')
        return
      case 'unary':
        if (TRIG_OPS.has(node.op)) upgrade('trigonometric')
        else if (HYPERBOLIC_OPS.has(node.op)) upgrade('hyperbolic')
        else if (node.op === 'sqrt') upgrade('power')
        else if (node.op === 'exp' || node.op === 'ln') upgrade('core')
        else upgrade('arithmetic')
        visit(node.arg)
        return
      case 'binary':
        if (node.op === 'pow') upgrade('power')
        else upgrade('arithmetic')
        visit(node.left)
        visit(node.right)
    }
  }
}

export function inferExpressionDepth(expr: ClassicalExpr): number {
  const family = inferExpressionFamily(expr)
  const base = {
    primitive: 0,
    core: 2,
    arithmetic: 5,
    constants: 5,
    power: 6,
    trigonometric: 8,
    hyperbolic: 8,
    custom: 6,
  }[family]

  const complexityBoost = Math.min(2, Math.floor((exprNodeCount(expr) - 1) / 4))
  return Math.min(8, base + complexityBoost)
}

export function inferExpressionDependencies(expr: ClassicalExpr): string[] {
  return inferStrictDependencies(expr)
}

function familyScore(family: Family): number {
  return {
    primitive: 1,
    constants: 2,
    arithmetic: 3,
    core: 4,
    power: 5,
    hyperbolic: 6,
    trigonometric: 7,
    custom: 0,
  }[family]
}
