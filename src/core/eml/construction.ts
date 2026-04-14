import {
  binary,
  constExpr,
  num,
  unary,
  type BinaryOp,
  type ClassicalExpr,
  type UnaryOp,
} from './expression'

const LOW_LEVEL_UNARY = new Set<UnaryOp>(['exp', 'ln', 'neg', 'sqrt'])
const LOW_LEVEL_BINARY = new Set<BinaryOp>(['add', 'sub', 'mul', 'div', 'pow'])

export function expandSemanticShortcuts(expression: ClassicalExpr): ClassicalExpr {
  switch (expression.kind) {
    case 'number':
    case 'const':
    case 'var':
      return expression
    case 'binary':
      return binary(
        expression.op,
        expandSemanticShortcuts(expression.left),
        expandSemanticShortcuts(expression.right),
      )
    case 'unary': {
      const arg = expandSemanticShortcuts(expression.arg)
      switch (expression.op) {
        case 'exp':
        case 'ln':
        case 'neg':
        case 'sqrt':
          return unary(expression.op, arg)
        case 'sinh':
          return expandSemanticShortcuts(
            binary(
              'div',
              binary(
                'sub',
                unary('exp', arg),
                unary('exp', unary('neg', arg)),
              ),
              num(2),
            ),
          )
        case 'cosh':
          return expandSemanticShortcuts(
            binary(
              'div',
              binary(
                'add',
                unary('exp', arg),
                unary('exp', unary('neg', arg)),
              ),
              num(2),
            ),
          )
        case 'tanh':
          return expandSemanticShortcuts(
            binary('div', unary('sinh', arg), unary('cosh', arg)),
          )
        case 'cos': {
          const ix = binary('mul', constExpr('i'), arg)
          return expandSemanticShortcuts(
            binary(
              'div',
              binary(
                'add',
                unary('exp', ix),
                unary('exp', unary('neg', ix)),
              ),
              num(2),
            ),
          )
        }
        case 'sin': {
          const ix = binary('mul', constExpr('i'), arg)
          return expandSemanticShortcuts(
            binary(
              'div',
              binary(
                'sub',
                unary('exp', ix),
                unary('exp', unary('neg', ix)),
              ),
              binary('mul', num(2), constExpr('i')),
            ),
          )
        }
        case 'tan':
          return expandSemanticShortcuts(
            binary('div', unary('sin', arg), unary('cos', arg)),
          )
        case 'arsinh':
          return expandSemanticShortcuts(
            unary(
              'ln',
              binary(
                'add',
                arg,
                unary(
                  'sqrt',
                  binary('add', num(1), binary('pow', arg, num(2))),
                ),
              ),
            ),
          )
        case 'arcosh':
          return expandSemanticShortcuts(
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
          )
        case 'artanh':
          return expandSemanticShortcuts(
            binary(
              'div',
              binary(
                'sub',
                unary('ln', binary('add', num(1), arg)),
                unary('ln', binary('sub', num(1), arg)),
              ),
              num(2),
            ),
          )
        case 'arcsin':
          return expandSemanticShortcuts(
            binary(
              'mul',
              unary('neg', constExpr('i')),
              unary(
                'ln',
                binary(
                  'add',
                  binary('mul', constExpr('i'), arg),
                  unary(
                    'sqrt',
                    binary('sub', num(1), binary('pow', arg, num(2))),
                  ),
                ),
              ),
            ),
          )
        case 'arccos':
          return expandSemanticShortcuts(
            binary(
              'mul',
              unary('neg', constExpr('i')),
              unary(
                'ln',
                binary(
                  'add',
                  arg,
                  binary(
                    'mul',
                    constExpr('i'),
                    unary(
                      'sqrt',
                      binary('sub', num(1), binary('pow', arg, num(2))),
                    ),
                  ),
                ),
              ),
            ),
          )
        case 'arctan':
          return expandSemanticShortcuts(
            binary(
              'div',
              binary(
                'mul',
                constExpr('i'),
                binary(
                  'sub',
                  unary(
                    'ln',
                    binary('sub', num(1), binary('mul', constExpr('i'), arg)),
                  ),
                  unary(
                    'ln',
                    binary('add', num(1), binary('mul', constExpr('i'), arg)),
                  ),
                ),
              ),
              num(2),
            ),
          )
      }
    }
  }
}

export function constantConstructionExpression(name: 'pi' | 'i'): ClassicalExpr {
  if (name === 'pi') {
    return unary(
      'sqrt',
      unary(
        'neg',
        binary('pow', unary('ln', num(-1)), num(2)),
      ),
    )
  }

  return binary(
    'div',
    unary('neg', unary('ln', num(-1))),
    constExpr('pi'),
  )
}

export function inferStrictDependencies(
  expression: ClassicalExpr | null,
): string[] {
  if (!expression) return []

  const dependencies = new Set<string>()
  const expanded = expandSemanticShortcuts(expression)

  if (usesMacroRoot(expression)) {
    collectMacroRoot(expression, expanded, dependencies)
  } else {
    collectNested(expanded, dependencies)
  }

  return Array.from(dependencies)
}

function usesMacroRoot(expression: ClassicalExpr): boolean {
  if (expression.kind === 'number' || expression.kind === 'const' || expression.kind === 'var') {
    return true
  }
  if (expression.kind === 'unary') {
    return LOW_LEVEL_UNARY.has(expression.op)
  }
  return LOW_LEVEL_BINARY.has(expression.op)
}

function collectMacroRoot(
  original: ClassicalExpr,
  expanded: ClassicalExpr,
  dependencies: Set<string>,
): void {
  switch (original.kind) {
    case 'number':
      collectRootNumber(original.value, dependencies)
      return
    case 'const':
      if (original.name === 'e') {
        dependencies.add('one')
      } else {
        collectNested(constantConstructionExpression(original.name), dependencies)
      }
      return
    case 'var':
      return
    case 'unary':
      if (original.op === 'exp') {
        dependencies.add('one')
        if (expanded.kind === 'unary') collectNested(expanded.arg, dependencies)
        return
      }
      if (original.op === 'ln') {
        dependencies.add('one')
        dependencies.add('exp')
        if (expanded.kind === 'unary') collectNested(expanded.arg, dependencies)
        return
      }
      if (original.op === 'neg') {
        dependencies.add('sub')
        dependencies.add('zero')
        if (expanded.kind === 'unary') collectNested(expanded.arg, dependencies)
        return
      }
      if (original.op === 'sqrt') {
        dependencies.add('exp')
        dependencies.add('ln')
        dependencies.add('div')
        dependencies.add('two')
        if (expanded.kind === 'unary') collectNested(expanded.arg, dependencies)
      }
      return
    case 'binary':
      if (original.op === 'add') {
        dependencies.add('sub')
        dependencies.add('neg')
      } else if (original.op === 'sub') {
        dependencies.add('ln')
        dependencies.add('exp')
      } else if (original.op === 'mul') {
        dependencies.add('exp')
        dependencies.add('ln')
        dependencies.add('add')
      } else if (original.op === 'div') {
        dependencies.add('mul')
        dependencies.add('exp')
        dependencies.add('neg')
        dependencies.add('ln')
      } else if (original.op === 'pow') {
        if (original.right.kind === 'number' && original.right.value === 2) {
          dependencies.add('mul')
        } else {
          dependencies.add('exp')
          dependencies.add('mul')
          dependencies.add('ln')
        }
      }
      if (expanded.kind === 'binary') {
        collectNested(expanded.left, dependencies)
        collectNested(expanded.right, dependencies)
      }
  }
}

function collectNested(expression: ClassicalExpr, dependencies: Set<string>): void {
  switch (expression.kind) {
    case 'number':
      collectNestedNumber(expression.value, dependencies)
      return
    case 'const':
      dependencies.add(
        expression.name === 'i'
          ? 'imag'
          : expression.name === 'pi'
            ? 'pi'
            : 'e',
      )
      return
    case 'var':
      dependencies.add('x_anchor')
      return
    case 'unary':
      dependencies.add(expression.op)
      collectNested(expression.arg, dependencies)
      return
    case 'binary':
      dependencies.add(
        expression.op === 'pow' &&
          expression.right.kind === 'number' &&
          expression.right.value === 2
          ? 'sq'
          : expression.op,
      )
      collectNested(expression.left, dependencies)
      collectNested(expression.right, dependencies)
  }
}

function collectRootNumber(value: number, dependencies: Set<string>): void {
  if (value === 1) return
  if (value === 0) {
    dependencies.add('ln')
    dependencies.add('one')
    return
  }
  if (value === 2) {
    dependencies.add('add')
    dependencies.add('one')
    return
  }
  if (value === -1) {
    dependencies.add('sub')
    dependencies.add('zero')
    dependencies.add('one')
    return
  }
  if (Number.isInteger(value) && value > 2) {
    dependencies.add('add')
    dependencies.add('one')
    dependencies.add('two')
    return
  }
  if (Number.isInteger(value) && value < -1) {
    dependencies.add('sub')
    dependencies.add('neg_one')
    return
  }
  if (value === 0.5) {
    dependencies.add('div')
    dependencies.add('one')
    dependencies.add('two')
    return
  }
  dependencies.add('one')
}

function collectNestedNumber(value: number, dependencies: Set<string>): void {
  if (value === 1) {
    dependencies.add('one')
  } else if (value === 0) {
    dependencies.add('zero')
  } else if (value === 2) {
    dependencies.add('two')
  } else if (value === -1) {
    dependencies.add('neg_one')
  } else if (Number.isInteger(value) && value > 2) {
    dependencies.add('add')
    dependencies.add('two')
    dependencies.add('one')
  } else if (Number.isInteger(value) && value < -1) {
    dependencies.add('sub')
    dependencies.add('neg_one')
  } else if (value === 0.5) {
    dependencies.add('div')
    dependencies.add('one')
    dependencies.add('two')
  } else {
    dependencies.add('one')
  }
}
