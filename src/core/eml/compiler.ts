import {
  binary,
  constExpr,
  exprNodeCount,
  simplifyExprDeep,
  exprToLatex,
  exprToSearchText,
  num,
  simplifyExprSteps,
  unary,
  varExpr,
  type BinaryOp,
  type ClassicalExpr,
  type UnaryOp,
} from './expression'
import {
  constantConstructionExpression,
  expandSemanticShortcuts,
} from './construction'
import type { EmlTree } from './types'

interface CompileContext {
  nextId: number
}

export interface DeepCalculateStatus {
  label: string
  progress: number
}

export function compileExpressionToEml(
  expression: ClassicalExpr,
  options: { preferWitnessForOne?: boolean; preferWitnessForIdentity?: boolean } = {},
): EmlTree {
  const ctx: CompileContext = { nextId: 0 }
  if (options.preferWitnessForOne && isLiteralOne(expression)) {
    return buildOneWitness(ctx)
  }
  if (options.preferWitnessForIdentity && isLiteralX(expression)) {
    return buildXWitness(ctx)
  }
  return compile(expression, ctx)
}

export function estimateCompileDifficulty(expression: ClassicalExpr): number {
  return exprNodeCount(expression) + countHeavyOps(expression) * 12
}

export function emlTreeToString(tree: EmlTree): string {
  if (tree.type === 'const') return '1'
  if (tree.type === 'var') return tree.name
  return `eml(${emlTreeToString(tree.left)}, ${emlTreeToString(tree.right)})`
}

export function emlTreeToLatex(tree: EmlTree): string {
  if (tree.type === 'const') return '1'
  if (tree.type === 'var') return tree.name
  return `\\operatorname{eml}\\!\\left(${emlTreeToLatex(tree.left)},\\, ${emlTreeToLatex(tree.right)}\\right)`
}

export function emlTreeLeafCount(tree: EmlTree): number {
  if (tree.type === 'const' || tree.type === 'var') return 1
  return emlTreeLeafCount(tree.left) + emlTreeLeafCount(tree.right)
}

export function findTreeNode(tree: EmlTree, id: string): EmlTree | null {
  if (tree.id === id) return tree
  if (tree.type !== 'eml') return null
  return findTreeNode(tree.left, id) ?? findTreeNode(tree.right, id)
}

export function buildDirectExpansion(tree: EmlTree): ClassicalExpr {
  if (tree.type === 'const') return num(1)
  if (tree.type === 'var') return varExpr(tree.name)
  return binary(
    'sub',
    unary('exp', tree.left.semantic),
    unary('ln', tree.right.semantic),
  )
}

export function buildSolutionLatexLines(tree: EmlTree): string[] {
  if (tree.type !== 'eml') {
    return dedupeLines([emlTreeToLatex(tree), exprToLatex(tree.semantic)])
  }

  const expansion = buildDirectExpansion(tree)
  const operandSimplified =
    expansion.kind === 'binary'
      ? {
          ...expansion,
          left: simplifyExprDeep(expansion.left),
          right: simplifyExprDeep(expansion.right),
        }
      : simplifyExprDeep(expansion)
  const simplified = simplifyExprSteps(operandSimplified, 10)
  const lines = [
    emlTreeToLatex(tree),
    exprToLatex(expansion),
    ...simplified.map((expr) => exprToLatex(expr)),
  ]
  const finalSemantic = exprToLatex(tree.semantic)
  if (!lines.includes(finalSemantic)) {
    lines.push(finalSemantic)
  }
  return dedupeLines(lines)
}

export function buildDeepCalculatePhases(): DeepCalculateStatus[] {
  return [
    { label: 'Searching witness identities', progress: 0.2 },
    { label: 'Expanding classical formulas into EML macros', progress: 0.52 },
    { label: 'Compiling to a pure EML tree', progress: 0.78 },
    { label: 'Verifying simplification path', progress: 1 },
  ]
}

export function exprAliases(expression: ClassicalExpr): string[] {
  const raw = exprToSearchText(expression)
  return [raw, raw.replaceAll('*', ''), raw.replaceAll(' ', ''), exprToLatex(expression)]
}

function compile(expression: ClassicalExpr, ctx: CompileContext): EmlTree {
  switch (expression.kind) {
    case 'number':
      return compileNumber(expression.value, ctx)
    case 'const':
      return compileNamedConst(expression.name, ctx)
    case 'var':
      return makeVar(expression.name, expression, ctx)
    case 'unary':
      return compileUnary(expression.op, expression.arg, expression, ctx)
    case 'binary':
      return compileBinary(expression.op, expression.left, expression.right, expression, ctx)
  }
}

function compileNumber(value: number, ctx: CompileContext): EmlTree {
  if (value === 1) return makeConst(num(1), ctx)
  if (value === 0) return lnTree(makeConst(num(1), ctx), num(0), ctx)
  if (value === -1) return subTree(compileNumber(0, ctx), makeConst(num(1), ctx), num(-1), ctx)

  if (Number.isInteger(value) && value > 1) {
    let result = makeConst(num(1), ctx)
    for (let i = 1; i < value; i += 1) {
      result = addTree(result, makeConst(num(1), ctx), num(i + 1), ctx)
    }
    return result
  }

  if (Number.isInteger(value) && value < -1) {
    return subTree(compileNumber(0, ctx), compileNumber(Math.abs(value), ctx), num(value), ctx)
  }

  if (value === 0.5) {
    return divTree(makeConst(num(1), ctx), compileNumber(2, ctx), num(0.5), ctx)
  }

  throw new Error(`Unsupported numeric literal "${value}" in EML compiler`)
}

function compileNamedConst(name: 'e' | 'pi' | 'i', ctx: CompileContext): EmlTree {
  if (name === 'e') {
    return emlNode(
      makeConst(num(1), ctx),
      makeConst(num(1), ctx),
      constExpr('e'),
      ctx,
    )
  }

  if (name === 'pi') {
    return withSemantic(
      compile(constantConstructionExpression('pi'), ctx),
      constExpr('pi'),
    )
  }

  return withSemantic(
    compile(constantConstructionExpression('i'), ctx),
    constExpr('i'),
  )
}

function compileUnary(
  op: UnaryOp,
  arg: ClassicalExpr,
  semantic: ClassicalExpr,
  ctx: CompileContext,
): EmlTree {
  switch (op) {
    case 'exp':
      return expTree(compile(arg, ctx), semantic, ctx)
    case 'ln':
      return lnTree(compile(arg, ctx), semantic, ctx)
    case 'neg':
      return subTree(compileNumber(0, ctx), compile(arg, ctx), semantic, ctx)
    case 'sqrt':
      return expTree(
        divTree(lnTree(compile(arg, ctx), unary('ln', arg), ctx), compileNumber(2, ctx), binary('div', unary('ln', arg), num(2)), ctx),
        semantic,
        ctx,
      )
    case 'sinh':
      return divTree(
        subTree(
          expTree(compile(arg, ctx), unary('exp', arg), ctx),
          expTree(compile(unary('neg', arg), ctx), unary('exp', unary('neg', arg)), ctx),
          binary('sub', unary('exp', arg), unary('exp', unary('neg', arg))),
          ctx,
        ),
        compileNumber(2, ctx),
        semantic,
        ctx,
      )
    case 'cosh':
      return divTree(
        addTree(
          expTree(compile(arg, ctx), unary('exp', arg), ctx),
          expTree(compile(unary('neg', arg), ctx), unary('exp', unary('neg', arg)), ctx),
          binary('add', unary('exp', arg), unary('exp', unary('neg', arg))),
          ctx,
        ),
        compileNumber(2, ctx),
        semantic,
        ctx,
      )
    case 'tanh':
      return withSemantic(compile(expandSemanticShortcuts(semantic), ctx), semantic)
    case 'cos':
      return withSemantic(compile(expandSemanticShortcuts(semantic), ctx), semantic)
    case 'sin':
      return withSemantic(compile(expandSemanticShortcuts(semantic), ctx), semantic)
    case 'tan':
      return withSemantic(compile(expandSemanticShortcuts(semantic), ctx), semantic)
    case 'arsinh':
      return withSemantic(
        compile(
          unary(
            'ln',
            binary(
              'add',
              arg,
              unary('sqrt', binary('add', num(1), binary('pow', arg, num(2)))),
            ),
          ),
          ctx,
        ),
        semantic,
      )
    case 'arcosh':
      return withSemantic(
        compile(
          unary(
            'ln',
            binary(
              'add',
              arg,
              binary(
                'mul',
                unary('sqrt', binary('sub', arg, num(1))),
                unary('sqrt', binary('add', arg, num(1))),
              ),
            ),
          ),
          ctx,
        ),
        semantic,
      )
    case 'artanh':
      return withSemantic(
        compile(
          binary(
            'div',
            binary(
              'sub',
              unary('ln', binary('add', num(1), arg)),
              unary('ln', binary('sub', num(1), arg)),
            ),
            num(2),
          ),
          ctx,
        ),
        semantic,
      )
    case 'arcsin':
      return withSemantic(
        compile(
          binary(
            'mul',
            unary('neg', constExpr('i')),
            unary(
              'ln',
              binary(
                'add',
                binary('mul', constExpr('i'), arg),
                unary('sqrt', binary('sub', num(1), binary('pow', arg, num(2)))),
              ),
            ),
          ),
          ctx,
        ),
        semantic,
      )
    case 'arccos':
      return withSemantic(compile(expandSemanticShortcuts(semantic), ctx), semantic)
    case 'arctan':
      return withSemantic(
        compile(
          binary(
            'div',
            binary(
              'mul',
              constExpr('i'),
              binary(
                'sub',
                unary('ln', binary('sub', num(1), binary('mul', constExpr('i'), arg))),
                unary('ln', binary('add', num(1), binary('mul', constExpr('i'), arg))),
              ),
            ),
            num(2),
          ),
          ctx,
        ),
        semantic,
      )
    default:
      throw new Error(`Unsupported unary operator "${op}"`)
  }
}

function compileBinary(
  op: BinaryOp,
  left: ClassicalExpr,
  right: ClassicalExpr,
  semantic: ClassicalExpr,
  ctx: CompileContext,
): EmlTree {
  switch (op) {
    case 'sub':
      return subTree(compile(left, ctx), compile(right, ctx), semantic, ctx)
    case 'add':
      return addTree(compile(left, ctx), compile(right, ctx), semantic, ctx)
    case 'mul':
      return mulTree(compile(left, ctx), compile(right, ctx), semantic, ctx)
    case 'div':
      return divTree(compile(left, ctx), compile(right, ctx), semantic, ctx)
    case 'pow':
      return expTree(
        mulTree(compile(right, ctx), lnTree(compile(left, ctx), unary('ln', left), ctx), binary('mul', right, unary('ln', left)), ctx),
        semantic,
        ctx,
      )
    default:
      throw new Error(`Unsupported binary operator "${op}"`)
  }
}

function subTree(
  left: EmlTree,
  right: EmlTree,
  semantic: ClassicalExpr,
  ctx: CompileContext,
): EmlTree {
  return emlNode(lnTree(left, unary('ln', left.semantic), ctx), expTree(right, unary('exp', right.semantic), ctx), semantic, ctx)
}

function addTree(
  left: EmlTree,
  right: EmlTree,
  semantic: ClassicalExpr,
  ctx: CompileContext,
): EmlTree {
  return subTree(left, subTree(compileNumber(0, ctx), right, unary('neg', right.semantic), ctx), semantic, ctx)
}

function mulTree(
  left: EmlTree,
  right: EmlTree,
  semantic: ClassicalExpr,
  ctx: CompileContext,
): EmlTree {
  return expTree(
    addTree(
      lnTree(left, unary('ln', left.semantic), ctx),
      lnTree(right, unary('ln', right.semantic), ctx),
      binary('add', unary('ln', left.semantic), unary('ln', right.semantic)),
      ctx,
    ),
    semantic,
    ctx,
  )
}

function divTree(
  left: EmlTree,
  right: EmlTree,
  semantic: ClassicalExpr,
  ctx: CompileContext,
): EmlTree {
  return mulTree(
    left,
    expTree(
      subTree(compileNumber(0, ctx), lnTree(right, unary('ln', right.semantic), ctx), unary('neg', unary('ln', right.semantic)), ctx),
      unary('exp', unary('neg', unary('ln', right.semantic))),
      ctx,
    ),
    semantic,
    ctx,
  )
}

function expTree(arg: EmlTree, semantic: ClassicalExpr, ctx: CompileContext): EmlTree {
  return emlNode(arg, makeConst(num(1), ctx), semantic, ctx)
}

function lnTree(arg: EmlTree, semantic: ClassicalExpr, ctx: CompileContext): EmlTree {
  return emlNode(
    makeConst(num(1), ctx),
    expTree(emlNode(makeConst(num(1), ctx), arg, binary('sub', constExpr('e'), unary('ln', arg.semantic)), ctx), unary('exp', binary('sub', constExpr('e'), unary('ln', arg.semantic))), ctx),
    semantic,
    ctx,
  )
}

function buildOneWitness(ctx: CompileContext): EmlTree {
  const one = makeConst(num(1), ctx)
  const e = emlNode(makeConst(num(1), ctx), makeConst(num(1), ctx), constExpr('e'), ctx)
  const inner = emlNode(
    makeConst(num(1), ctx),
    e,
    binary('sub', constExpr('e'), num(1)),
    ctx,
  )
  const right = emlNode(
    inner,
    makeConst(num(1), ctx),
    unary('exp', binary('sub', constExpr('e'), num(1))),
    ctx,
  )
  return emlNode(one, right, num(1), ctx)
}

function buildXWitness(ctx: CompileContext): EmlTree {
  const x = makeVar('x', varExpr('x'), ctx)
  const lnX = lnTree(x, unary('ln', varExpr('x')), ctx)
  return expTree(lnX, varExpr('x'), ctx)
}

function emlNode(
  left: EmlTree,
  right: EmlTree,
  semantic: ClassicalExpr,
  ctx: CompileContext,
): EmlTree {
  return {
    id: `eml-${ctx.nextId++}`,
    type: 'eml',
    left,
    right,
    semantic,
  }
}

function makeConst(semantic: ClassicalExpr, ctx: CompileContext): EmlTree {
  return {
    id: `eml-${ctx.nextId++}`,
    type: 'const',
    semantic,
  }
}

function makeVar(name: string, semantic: ClassicalExpr, ctx: CompileContext): EmlTree {
  return {
    id: `eml-${ctx.nextId++}`,
    type: 'var',
    name,
    semantic,
  }
}

function withSemantic(tree: EmlTree, semantic: ClassicalExpr): EmlTree {
  return { ...tree, semantic }
}

function isLiteralOne(expression: ClassicalExpr): boolean {
  return expression.kind === 'number' && expression.value === 1
}

function isLiteralX(expression: ClassicalExpr): boolean {
  return expression.kind === 'var' && expression.name === 'x'
}

function countHeavyOps(expression: ClassicalExpr): number {
  if (expression.kind === 'unary') {
    return (isHeavyUnary(expression.op) ? 1 : 0) + countHeavyOps(expression.arg)
  }
  if (expression.kind === 'binary') {
    return countHeavyOps(expression.left) + countHeavyOps(expression.right)
  }
  return 0
}

function isHeavyUnary(op: string): boolean {
  return [
    'sin',
    'cos',
    'tan',
    'sinh',
    'cosh',
    'tanh',
    'arsinh',
    'arcosh',
    'artanh',
    'arcsin',
    'arccos',
    'arctan',
  ].includes(op)
}

function dedupeLines(lines: string[]): string[] {
  const out: string[] = []
  for (const line of lines) {
    if (out[out.length - 1] !== line) out.push(line)
  }
  return out
}
