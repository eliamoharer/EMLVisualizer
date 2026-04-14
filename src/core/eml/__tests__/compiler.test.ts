import { describe, expect, it } from 'vitest'
import {
  buildSolutionLatexLines,
  compileExpressionToEml,
  emlTreeLeafCount,
  emlTreeToString,
} from '../compiler'
import { exprToSearchText, num, parseExpression } from '../expression'

describe('EML compiler', () => {
  it('parses implicit multiplication in custom expressions', () => {
    const expr = parseExpression('2x+y')
    expect(exprToSearchText(expr)).toBe('2*x+y')
  })

  it('builds the non-trivial witness for one when requested', () => {
    const tree = compileExpressionToEml(num(1), { preferWitnessForOne: true })
    expect(emlTreeToString(tree)).toBe('eml(1, eml(eml(1, eml(1, 1)), 1))')
  })

  it('compiles x^y into a non-trivial EML tree', () => {
    const tree = compileExpressionToEml(parseExpression('x^y'))
    expect(emlTreeLeafCount(tree)).toBeGreaterThan(3)
  })

  it('produces stepwise symbolic lines for eml(1,1)', () => {
    const tree = compileExpressionToEml(parseExpression('e'))
    const lines = buildSolutionLatexLines(tree)
    expect(lines.some((line) => line.includes('\\exp'))).toBe(true)
    expect(lines.some((line) => line.includes('e'))).toBe(true)
  })

  it('reduces the x witness all the way back to x', () => {
    const tree = compileExpressionToEml(parseExpression('x'), {
      preferWitnessForIdentity: true,
    })
    const lines = buildSolutionLatexLines(tree)
    expect(lines.at(-1)).toBe('x')
    expect(lines.some((line) => line.includes('\\ln\\left(x\\right)'))).toBe(true)
  })

  it('keeps cosine semantics on the final reduction line', () => {
    const tree = compileExpressionToEml(parseExpression('cos(x)'))
    const lines = buildSolutionLatexLines(tree)
    expect(lines.at(-1)).toBe('\\cos\\left(x\\right)')
  })
})
