export type UnaryOp =
  | 'exp'
  | 'ln'
  | 'neg'
  | 'sqrt'
  | 'sin'
  | 'cos'
  | 'tan'
  | 'sinh'
  | 'cosh'
  | 'tanh'
  | 'arsinh'
  | 'arcosh'
  | 'artanh'
  | 'arcsin'
  | 'arccos'
  | 'arctan'

export type BinaryOp = 'add' | 'sub' | 'mul' | 'div' | 'pow'

export type ClassicalExpr =
  | { kind: 'number'; value: number }
  | { kind: 'const'; name: 'e' | 'pi' | 'i' }
  | { kind: 'var'; name: string }
  | { kind: 'unary'; op: UnaryOp; arg: ClassicalExpr }
  | { kind: 'binary'; op: BinaryOp; left: ClassicalExpr; right: ClassicalExpr }

type Token =
  | { type: 'number'; value: number; raw: string }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' | '^' | '(' | ')' | ',' }

const FUNCTION_NAMES = new Set<UnaryOp>([
  'exp',
  'ln',
  'sqrt',
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
  'neg',
])

export const num = (value: number): ClassicalExpr => ({ kind: 'number', value })
export const constExpr = (name: 'e' | 'pi' | 'i'): ClassicalExpr => ({
  kind: 'const',
  name,
})
export const varExpr = (name: string): ClassicalExpr => ({ kind: 'var', name })
export const unary = (op: UnaryOp, arg: ClassicalExpr): ClassicalExpr => ({
  kind: 'unary',
  op,
  arg,
})
export const binary = (
  op: BinaryOp,
  left: ClassicalExpr,
  right: ClassicalExpr,
): ClassicalExpr => ({
  kind: 'binary',
  op,
  left,
  right,
})

export function parseExpression(input: string): ClassicalExpr {
  const tokens = insertImplicitMultiplication(tokenize(normalizeInput(input)))
  let index = 0

  const peek = () => tokens[index]
  const consume = () => tokens[index++]

  const parsePrimary = (): ClassicalExpr => {
    const token = consume()
    if (!token) {
      throw new Error('Unexpected end of expression')
    }

    if (token.type === 'number') {
      return num(token.value)
    }

    if (token.type === 'ident') {
      const name = token.value
      if (peek()?.type === 'op' && peek()?.value === '(' && FUNCTION_NAMES.has(name as UnaryOp)) {
        consume()
        const arg = parseExpr(0)
        expect(')')
        return unary(name as UnaryOp, arg)
      }
      if (name === 'e') return constExpr('e')
      if (name === 'pi') return constExpr('pi')
      if (name === 'i') return constExpr('i')
      return varExpr(name)
    }

    if (token.type === 'op' && token.value === '(') {
      const expr = parseExpr(0)
      expect(')')
      return expr
    }

    if (token.type === 'op' && token.value === '-') {
      return unary('neg', parseExpr(3))
    }

    throw new Error(`Unexpected token ${renderToken(token)}`)
  }

  const precedence = (token?: Token): number => {
    if (!token || token.type !== 'op') return -1
    switch (token.value) {
      case '+':
      case '-':
        return 1
      case '*':
      case '/':
        return 2
      case '^':
        return 4
      default:
        return -1
    }
  }

  const parseExpr = (minPrec: number): ClassicalExpr => {
    let left = parsePrimary()
    while (true) {
      const op = peek()
      const prec = precedence(op)
      if (prec < minPrec) break
      consume()
      const nextMin = op?.type === 'op' && op.value === '^' ? prec : prec + 1
      const right = parseExpr(nextMin)
      left = binary(opToBinary(op), left, right)
    }
    return left
  }

  const expect = (value: ')' | ',') => {
    const token = consume()
    if (!token || token.type !== 'op' || token.value !== value) {
      throw new Error(`Expected "${value}"`)
    }
  }

  const expr = parseExpr(0)
  if (index < tokens.length) {
    throw new Error(`Unexpected token ${renderToken(tokens[index])}`)
  }
  return expr
}

export function exprToLatex(expr: ClassicalExpr): string {
  switch (expr.kind) {
    case 'number':
      return formatNumber(expr.value)
    case 'const':
      return expr.name === 'pi' ? '\\pi' : expr.name
    case 'var':
      return expr.name
    case 'unary':
      return unaryToLatex(expr.op, expr.arg)
    case 'binary':
      return binaryToLatex(expr.op, expr.left, expr.right)
  }
}

export function exprToSearchText(expr: ClassicalExpr): string {
  switch (expr.kind) {
    case 'number':
      return formatNumber(expr.value)
    case 'const':
      return expr.name === 'pi' ? 'pi' : expr.name
    case 'var':
      return expr.name
    case 'unary':
      return `${expr.op}(${exprToSearchText(expr.arg)})`
    case 'binary': {
      const opText: Record<BinaryOp, string> = {
        add: '+',
        sub: '-',
        mul: '*',
        div: '/',
        pow: '^',
      }
      return `${wrapText(expr.left)}${opText[expr.op]}${wrapText(expr.right)}`
    }
  }
}

export function simplifyExprSteps(expr: ClassicalExpr, maxSteps = 10): ClassicalExpr[] {
  const steps: ClassicalExpr[] = [expr]
  let current = expr
  for (let i = 0; i < maxSteps; i += 1) {
    const next = simplifyExprDeep(current)
    if (serializeExpr(next) === serializeExpr(current)) break
    steps.push(next)
    current = next
  }
  return dedupeExprs(steps)
}

export function simplifyExprDeep(expr: ClassicalExpr): ClassicalExpr {
  if (expr.kind === 'unary') {
    return simplifyExprOnce({ ...expr, arg: simplifyExprDeep(expr.arg) })
  }
  if (expr.kind === 'binary') {
    return simplifyExprOnce({
      ...expr,
      left: simplifyExprDeep(expr.left),
      right: simplifyExprDeep(expr.right),
    })
  }
  return simplifyExprOnce(expr)
}

export function exprNodeCount(expr: ClassicalExpr): number {
  if (expr.kind === 'number' || expr.kind === 'const' || expr.kind === 'var') {
    return 1
  }
  if (expr.kind === 'unary') {
    return 1 + exprNodeCount(expr.arg)
  }
  return 1 + exprNodeCount(expr.left) + exprNodeCount(expr.right)
}

export function serializeExpr(expr: ClassicalExpr): string {
  switch (expr.kind) {
    case 'number':
      return `n:${expr.value}`
    case 'const':
      return `c:${expr.name}`
    case 'var':
      return `v:${expr.name}`
    case 'unary':
      return `u:${expr.op}(${serializeExpr(expr.arg)})`
    case 'binary':
      return `b:${expr.op}(${serializeExpr(expr.left)},${serializeExpr(expr.right)})`
  }
}

function simplifyExprOnce(expr: ClassicalExpr): ClassicalExpr {
  if (expr.kind === 'unary') {
    if (expr.op === 'neg') {
      if (expr.arg.kind === 'number') return num(-expr.arg.value)
      if (expr.arg.kind === 'unary' && expr.arg.op === 'neg') return expr.arg.arg
    }
    if (expr.op === 'ln' && isNumber(expr.arg, 1)) return num(0)
    if (expr.op === 'ln' && expr.arg.kind === 'unary' && expr.arg.op === 'exp') {
      return expr.arg.arg
    }
    if (expr.op === 'exp') {
      if (expr.arg.kind === 'unary' && expr.arg.op === 'ln') return expr.arg.arg
      if (isNumber(expr.arg, 0)) return num(1)
      if (isNumber(expr.arg, 1)) return constExpr('e')
      return binary('pow', constExpr('e'), expr.arg)
    }
    if (expr.op === 'sqrt' && isNumber(expr.arg, 1)) return num(1)
    return expr
  }

  if (expr.kind !== 'binary') return expr

  const { op, left, right } = expr
  const leftValue = left.kind === 'number' ? left.value : null
  const rightValue = right.kind === 'number' ? right.value : null

  if (op === 'add') {
    if (isNumber(left, 0)) return right
    if (isNumber(right, 0)) return left
    if (leftValue !== null && rightValue !== null) {
      return num(leftValue + rightValue)
    }
  }

  if (op === 'sub') {
    if (isNumber(right, 0)) return left
    if (serializeExpr(left) === serializeExpr(right)) return num(0)
    if (leftValue !== null && rightValue !== null) {
      return num(leftValue - rightValue)
    }
  }

  if (op === 'mul') {
    if (isNumber(left, 0) || isNumber(right, 0)) return num(0)
    if (isNumber(left, 1)) return right
    if (isNumber(right, 1)) return left
    if (leftValue !== null && rightValue !== null) {
      return num(leftValue * rightValue)
    }
  }

  if (op === 'div') {
    if (isNumber(left, 0)) return num(0)
    if (isNumber(right, 1)) return left
    if (leftValue !== null && rightValue !== null && rightValue !== 0) {
      return num(leftValue / rightValue)
    }
  }

  if (op === 'pow') {
    if (isNumber(right, 0)) return num(1)
    if (isNumber(right, 1)) return left
    if (isNumber(left, 1)) return num(1)
    if (isConst(left, 'e') && isNumber(right, 1)) return constExpr('e')
    if (isConst(left, 'e') && right.kind === 'unary' && right.op === 'ln') {
      return right.arg
    }
    if (leftValue !== null && rightValue !== null) {
      return num(leftValue ** rightValue)
    }
  }

  return expr
}

function unaryToLatex(op: UnaryOp, arg: ClassicalExpr): string {
  const value = exprToLatex(arg)
  switch (op) {
    case 'exp':
      return `\\exp\\left(${value}\\right)`
    case 'ln':
      return `\\ln\\left(${value}\\right)`
    case 'neg':
      return `-\\left(${value}\\right)`
    case 'sqrt':
      return `\\sqrt{${value}}`
    case 'arsinh':
    case 'arcosh':
    case 'artanh':
      return `\\operatorname{${op}}\\left(${value}\\right)`
    default:
      return `\\${op}\\left(${value}\\right)`
  }
}

function binaryToLatex(op: BinaryOp, left: ClassicalExpr, right: ClassicalExpr): string {
  const l = wrapLatex(left)
  const r = wrapLatex(right)
  switch (op) {
    case 'add':
      return `${l} + ${r}`
    case 'sub':
      return `${l} - ${r}`
    case 'mul':
      return `${l} \\cdot ${r}`
    case 'div':
      return `\\frac{${exprToLatex(left)}}{${exprToLatex(right)}}`
    case 'pow':
      return `${l}^{${exprToLatex(right)}}`
  }
}

function wrapLatex(expr: ClassicalExpr): string {
  if (expr.kind === 'binary' && (expr.op === 'add' || expr.op === 'sub')) {
    return `\\left(${exprToLatex(expr)}\\right)`
  }
  return exprToLatex(expr)
}

function wrapText(expr: ClassicalExpr): string {
  if (expr.kind === 'binary' && (expr.op === 'add' || expr.op === 'sub')) {
    return `(${exprToSearchText(expr)})`
  }
  return exprToSearchText(expr)
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toString()
}

function normalizeInput(input: string): string {
  return input
    .trim()
    .replace(/π/g, 'pi')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/²/g, '^2')
    .replace(/ʸ/g, '^y')
    .replace(/\s+/g, ' ')
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < input.length) {
    const char = input[i]
    if (char === ' ') {
      i += 1
      continue
    }
    if (/[0-9.]/.test(char)) {
      let j = i + 1
      while (j < input.length && /[0-9.]/.test(input[j])) j += 1
      const raw = input.slice(i, j)
      tokens.push({ type: 'number', value: Number(raw), raw })
      i = j
      continue
    }
    if (/[a-zA-Z]/.test(char)) {
      let j = i + 1
      while (j < input.length && /[a-zA-Z]/.test(input[j])) j += 1
      tokens.push({ type: 'ident', value: input.slice(i, j).toLowerCase() })
      i = j
      continue
    }
    if ('+-*/^(),'.includes(char)) {
      tokens.push({
        type: 'op',
        value: char as '+' | '-' | '*' | '/' | '^' | '(' | ')' | ',',
      })
      i += 1
      continue
    }
    throw new Error(`Unsupported character "${char}"`)
  }
  return tokens
}

function insertImplicitMultiplication(tokens: Token[]): Token[] {
  const out: Token[] = []
  for (let i = 0; i < tokens.length; i += 1) {
    const current = tokens[i]
    const next = tokens[i + 1]
    out.push(current)
    if (!next) continue

    const currentEndsValue =
      current.type === 'number' ||
      current.type === 'ident' ||
      (current.type === 'op' && current.value === ')')
    const nextStartsValue =
      next.type === 'number' ||
      next.type === 'ident' ||
      (next.type === 'op' && next.value === '(')

    const currentIsFunction =
      current.type === 'ident' && FUNCTION_NAMES.has(current.value as UnaryOp)
    if (currentEndsValue && nextStartsValue && !currentIsFunction) {
      if (!(current.type === 'ident' && next.type === 'op' && next.value === '(')) {
        out.push({ type: 'op', value: '*' })
      }
    }
  }
  return out
}

function opToBinary(token?: Token): BinaryOp {
  if (!token || token.type !== 'op') {
    throw new Error('Expected operator')
  }
  switch (token.value) {
    case '+':
      return 'add'
    case '-':
      return 'sub'
    case '*':
      return 'mul'
    case '/':
      return 'div'
    case '^':
      return 'pow'
    default:
      throw new Error(`Unexpected binary operator ${token.value}`)
  }
}

function renderToken(token?: Token): string {
  if (!token) return 'end of input'
  if (token.type === 'number') return token.raw
  return token.value
}

function isNumber(expr: ClassicalExpr, value: number): expr is { kind: 'number'; value: number } {
  return expr.kind === 'number' && expr.value === value
}

function isConst(expr: ClassicalExpr, name: 'e' | 'pi' | 'i'): boolean {
  return expr.kind === 'const' && expr.name === name
}

function dedupeExprs(expressions: ClassicalExpr[]): ClassicalExpr[] {
  const seen = new Set<string>()
  return expressions.filter((expr) => {
    const key = serializeExpr(expr)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
