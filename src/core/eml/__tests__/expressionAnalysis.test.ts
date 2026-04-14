import { describe, expect, it } from 'vitest'
import { parseExpression } from '../expression'
import {
  inferExpressionDependencies,
  inferExpressionDepth,
  inferExpressionFamily,
} from '../expressionAnalysis'

describe('expressionAnalysis', () => {
  it('classifies custom expressions by their highest family', () => {
    expect(inferExpressionFamily(parseExpression('3'))).toBe('constants')
    expect(inferExpressionFamily(parseExpression('x + 3'))).toBe('arithmetic')
    expect(inferExpressionFamily(parseExpression('sin(x) + x + 3'))).toBe(
      'trigonometric',
    )
  })

  it('caps inferred depth at the requested derivation range', () => {
    expect(inferExpressionDepth(parseExpression('3'))).toBe(5)
    expect(inferExpressionDepth(parseExpression('sin(x) + x + 3'))).toBe(8)
  })

  it('collects built-in derivation dependencies for custom formulas', () => {
    const dependencies = inferExpressionDependencies(parseExpression('sin(x) + x + 3'))
    expect(dependencies).toEqual(
      expect.arrayContaining([
        'sub',
        'neg',
        'div',
        'exp',
        'mul',
        'imag',
        'x_anchor',
        'one',
        'two',
      ]),
    )
    expect(dependencies).not.toContain('sin')
    expect(dependencies).not.toEqual(['one', 'x_anchor'])
  })
})
