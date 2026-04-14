import type { EmlTree } from '../core/eml/types'

interface InteractiveEmlExpressionProps {
  tree: EmlTree
  hoveredId: string | null
  selectedId: string | null
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
}

export function InteractiveEmlExpression({
  tree,
  hoveredId,
  selectedId,
  onHover,
  onSelect,
}: InteractiveEmlExpressionProps) {
  return (
    <span className="interactive-eml-root" onMouseLeave={() => onHover(null)}>
      {renderTree(tree, hoveredId, selectedId, onHover, onSelect)}
    </span>
  )
}

function renderTree(
  tree: EmlTree,
  hoveredId: string | null,
  selectedId: string | null,
  onHover: (id: string | null) => void,
  onSelect: (id: string) => void,
) {
  const highlighted = hoveredId === tree.id || selectedId === tree.id
  const classes = [
    'interactive-eml-node',
    tree.type === 'eml' ? 'interactive-eml-branch' : 'interactive-eml-leaf',
    highlighted ? 'interactive-eml-highlighted' : '',
    selectedId === tree.id ? 'interactive-eml-selected' : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (tree.type === 'const') {
    return (
      <button
        type="button"
        className={classes}
        onMouseEnter={() => onHover(tree.id)}
        onMouseMove={(event) => {
          event.stopPropagation()
          onHover(tree.id)
        }}
        onClick={(event) => {
          event.stopPropagation()
          onSelect(tree.id)
        }}
      >
        1
      </button>
    )
  }

  if (tree.type === 'var') {
    return (
      <button
        type="button"
        className={classes}
        onMouseEnter={() => onHover(tree.id)}
        onMouseMove={(event) => {
          event.stopPropagation()
          onHover(tree.id)
        }}
        onClick={(event) => {
          event.stopPropagation()
          onSelect(tree.id)
        }}
      >
        {tree.name}
      </button>
    )
  }

  return (
    <span
      className={classes}
      onMouseEnter={() => onHover(tree.id)}
      onMouseMove={(event) => {
        event.stopPropagation()
        onHover(tree.id)
      }}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(tree.id)
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(tree.id)
        }
      }}
    >
      <span className="interactive-eml-token">eml</span>
      <span className="interactive-eml-punct">(</span>
      {renderTree(tree.left, hoveredId, selectedId, onHover, onSelect)}
      <span className="interactive-eml-punct">, </span>
      {renderTree(tree.right, hoveredId, selectedId, onHover, onSelect)}
      <span className="interactive-eml-punct">)</span>
    </span>
  )
}
