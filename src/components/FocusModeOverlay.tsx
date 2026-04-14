import { useEffect, useMemo, useRef, useState } from 'react'
import type { PositionedNode } from '../core/eml/types'
import { FAMILY_META } from '../core/eml/families'
import {
  buildDeepCalculatePhases,
  buildSolutionLatexLines,
  compileExpressionToEml,
  emlTreeLeafCount,
  findTreeNode,
} from '../core/eml/compiler'
import { estimateCompileDifficulty } from '../core/eml/compiler'
import { InteractiveEmlExpression } from './InteractiveEmlExpression'
import { MathText } from './MathText'

interface FocusModeOverlayProps {
  node: PositionedNode | null
  onClose: () => void
}

export function FocusModeOverlay({ node, onClose }: FocusModeOverlayProps) {
  const autoTree = useMemo(
    () =>
      node?.emlTree ??
      (node?.formula && estimateCompileDifficulty(node.formula) <= 11
        ? compileExpressionToEml(node.formula, {
            preferWitnessForOne: node.id === 'one',
          })
        : null),
    [node],
  )

  const [resolvedTree, setResolvedTree] = useState(autoTree)
  const [hoveredTreeId, setHoveredTreeId] = useState<string | null>(null)
  const [selectedTreeId, setSelectedTreeId] = useState<string | null>(null)
  const [deepLabel, setDeepLabel] = useState('')
  const [isDeepCalculating, setIsDeepCalculating] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const closeTimerRef = useRef<number | null>(null)

  const hasTextSelection = () => {
    const selection = window.getSelection()
    return Boolean(selection && !selection.isCollapsed && selection.toString().trim())
  }

  const shouldKeepOpen = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false
    return Boolean(target.closest('[data-close-guard="true"]'))
  }

  const requestClose = () => {
    if (isClosing) return
    setIsClosing(true)
    closeTimerRef.current = window.setTimeout(() => {
      onClose()
    }, 150)
  }

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
      }
    }
  }, [])

  if (!node) return null

  const meta = FAMILY_META[node.family]
  const selectedTree =
    resolvedTree && selectedTreeId
      ? findTreeNode(resolvedTree, selectedTreeId)
      : null
  const solutionLines =
    selectedTree && selectedTree.type === 'eml'
      ? buildSolutionLatexLines(selectedTree)
      : []
  const treeLeaves = resolvedTree ? emlTreeLeafCount(resolvedTree) : null

  const deepCalculate = async () => {
    if (!node.formula || isDeepCalculating) return
    setIsDeepCalculating(true)
    for (const phase of buildDeepCalculatePhases()) {
      setDeepLabel(phase.label)
      await new Promise((resolve) => window.setTimeout(resolve, 280))
    }
    const compiled = compileExpressionToEml(node.formula, {
      preferWitnessForOne: node.id === 'one',
    })
    setResolvedTree(compiled)
    setIsDeepCalculating(false)
  }

  return (
    <section
      className={`focus-overlay ${isClosing ? 'focus-overlay-closing' : ''}`}
      onClick={(event) => {
        if (hasTextSelection()) return
        if (shouldKeepOpen(event.target)) return
        requestClose()
      }}
    >
      <button
        type="button"
        className="focus-close-float"
        onClick={(event) => {
          event.stopPropagation()
          requestClose()
        }}
        aria-label="Close focus mode"
      >
        &times;
      </button>
      <div className={`focus-stage ${isClosing ? 'focus-stage-closing' : ''}`}>
        <div className="focus-headline" data-close-guard="true">
          <span className="focus-family-badge" style={{ background: meta.color }}>
            {meta.label}
          </span>
          <div className="focus-function">
            <MathText expression={node.latex} display />
          </div>
          <p className="focus-description">{node.description}</p>
        </div>

        <div className="focus-eml-shell">
          <p className="focus-shell-title">Pure EML form</p>

          {resolvedTree ? (
            <>
              <div
                className="focus-eml-expression"
                data-close-guard="true"
                onWheel={(event) => {
                  const container = event.currentTarget
                  const horizontalDelta = Math.abs(event.deltaX) > 0 ? event.deltaX : event.deltaY
                  if (horizontalDelta === 0) return
                  event.preventDefault()
                  event.stopPropagation()
                  container.scrollLeft += horizontalDelta
                }}
              >
                <InteractiveEmlExpression
                  tree={resolvedTree}
                  hoveredId={hoveredTreeId}
                  selectedId={selectedTreeId}
                  onHover={(id) => {
                    if (selectedTreeId === null) setHoveredTreeId(id)
                  }}
                  onSelect={(id) => {
                    setHoveredTreeId(null)
                    setSelectedTreeId((current) => (current === id ? null : id))
                  }}
                />
              </div>
              <p className="focus-hint">
                Hover to preview a nested subexpression. Click one to pin it and
                generate the symbolic reduction below.
              </p>
              {treeLeaves !== null && treeLeaves > 40 && (
                <p className="focus-meta">Expanded EML leaf count: {treeLeaves}</p>
              )}
            </>
          ) : (
            <div className="focus-deep-calculate">
              <p className="focus-hint">
                This function compiles to a much deeper EML tree.
              </p>
              <button
                type="button"
                className="deep-calc-btn"
                onClick={deepCalculate}
                disabled={isDeepCalculating}
                data-close-guard="true"
              >
                {isDeepCalculating ? 'Deep Calculating…' : 'Deep Calculate'}
              </button>
              {deepLabel ? <p className="focus-meta">{deepLabel}</p> : null}
            </div>
          )}
        </div>

        <div
          className={`focus-solution ${
            solutionLines.length === 0 ? 'focus-solution-empty' : ''
          }`}
          data-close-guard="true"
        >
          <p className="focus-shell-title">Step-by-step reduction</p>
          {solutionLines.length > 0 ? (
            <div className="focus-solution-lines">
              {solutionLines.map((line, index) => (
                <div key={`${line}-${index}`} className="focus-solution-line">
                  <span className="focus-equals">{index === 0 ? '' : '='}</span>
                  <MathText
                    expression={line}
                    display
                    fallbackLabel="Could not render this reduction step."
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="focus-hint">
              Click a non-trivial nested EML subexpression to see its symbolic
              reduction.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
