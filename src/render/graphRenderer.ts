import type { EmlGraph } from '../core/eml/types'
import { depthToRadius } from '../core/layout/radialLayout'
import type { DagHighlight } from '../core/search/pathTrace'
import { FAMILY_META } from '../core/eml/families'
import type { CameraState } from './camera'
import { worldToScreen } from './camera'

const BG = '#f8f5f0'
const RING_COLOR = 'rgba(156, 146, 134, 0.26)'
const EDGE_DEFAULT = 'rgba(132, 122, 112, 0.46)'
const LABEL_COLOR = '#3a3535'
const SECTOR_LABEL = 'rgba(98, 92, 86, 0.72)'

export function renderGraph(
  ctx: CanvasRenderingContext2D,
  graph: EmlGraph,
  camera: CameraState,
  highlight: DagHighlight,
  selectedNodeId: string | null,
  hoveredNodeId: string | null,
): void {
  const width = ctx.canvas.clientWidth || ctx.canvas.width
  const height = ctx.canvas.clientHeight || ctx.canvas.height
  ctx.clearRect(0, 0, width, height)

  // Cream background
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, width, height)

  const [cx, cy] = worldToScreen(0, 0, camera, width, height)
  const highlightedNodes = new Set(highlight.nodeIds)
  const highlightedEdges = new Set(highlight.edgeIds)
  const dimRest = highlight.mode !== 'none'
  const maxHighlightedStep = Math.max(
    ...highlight.edgeIds.map((id) => highlight.edgeSteps[id] ?? 0),
    1,
  )

  // Concentric depth rings
  const maxDepth = Math.max(...graph.nodes.map((n) => n.depth), 1)
  ctx.strokeStyle = RING_COLOR
  ctx.lineWidth = 1
  for (let d = 1; d <= maxDepth; d++) {
    const r = depthToRadius(d) * camera.zoom
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Family sector labels
  ctx.save()
  ctx.font = `italic ${Math.max(13, 14 * camera.zoom)}px "STIX Two Text", Georgia, serif`
  ctx.fillStyle = SECTOR_LABEL
  ctx.textAlign = 'center'
  const visibleFamilies = new Set(graph.nodes.map((node) => node.family))
  for (const meta of Object.values(FAMILY_META)) {
    if (meta.key === 'primitive' || !visibleFamilies.has(meta.key)) continue
    const labelDist = depthToRadius(maxDepth) + 150
    const lx = labelDist * Math.cos(meta.sectorAngle)
    const ly = labelDist * Math.sin(meta.sectorAngle)
    const [sx, sy] = worldToScreen(lx, ly, camera, width, height)
    ctx.fillText(meta.label, sx, sy)
  }
  ctx.restore()

  // Edges — default
  for (const edge of graph.edges) {
    const from = graph.nodes.find((n) => n.id === edge.from)
    const to = graph.nodes.find((n) => n.id === edge.to)
    if (!from || !to) continue
    const strong = highlightedEdges.has(edge.id)
    if (strong) continue
    drawCurvedEdge(
      ctx,
      from.x,
      from.y,
      to.x,
      to.y,
      camera,
      width,
      height,
      dimRest ? 'rgba(132, 122, 112, 0.12)' : EDGE_DEFAULT,
      dimRest ? 0.75 : 1.05,
    )
  }

  // Edges — highlighted
  for (const edge of graph.edges) {
    const from = graph.nodes.find((n) => n.id === edge.from)
    const to = graph.nodes.find((n) => n.id === edge.to)
    if (!from || !to) continue
    const strong = highlightedEdges.has(edge.id)
    if (!strong) continue
    const edgeStep = highlight.edgeSteps[edge.id] ?? 0
    const normalized = maxHighlightedStep <= 1 ? 1 : edgeStep / maxHighlightedStep
    drawCurvedEdge(
      ctx,
      from.x,
      from.y,
      to.x,
      to.y,
      camera,
      width,
      height,
      orangeGradient(normalized),
      1.15 + normalized * 1.35,
    )
  }

  // Nodes
  for (const node of graph.nodes) {
    const [x, y] = worldToScreen(node.x, node.y, camera, width, height)
    const r = Math.max(node.radius * camera.zoom, 5)
    const meta = FAMILY_META[node.family]
    const selected = selectedNodeId === node.id
    const hovered = hoveredNodeId === node.id
    const onPath = highlightedNodes.has(node.id)
    const faded = dimRest && !onPath && !selected && !hovered

    // Shadow
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.10)'
    ctx.shadowBlur = 6
    ctx.shadowOffsetY = 2
    ctx.globalAlpha = faded ? 0.16 : 1

    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)

    if (selected) {
      ctx.fillStyle = '#f0d890'
    } else if (onPath) {
      const nodeStep = highlight.nodeSteps[node.id] ?? maxHighlightedStep
      const normalized = maxHighlightedStep <= 1 ? 1 : nodeStep / maxHighlightedStep
      ctx.fillStyle = blendColor(meta.color, orangeGradient(normalized), 0.58)
    } else {
      ctx.fillStyle = meta.color
    }
    ctx.fill()

    // Landmark glow
    if (node.isLandmark) {
      ctx.shadowColor = meta.color
      ctx.shadowBlur = 14
      ctx.shadowOffsetY = 0
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    // Hover ring
    if (hovered) {
      ctx.beginPath()
      ctx.arc(x, y, r + 3, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(58, 53, 53, 0.35)'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    // Label
    if (node.isLandmark || selected || hovered || onPath || camera.zoom > 0.72) {
      const fontSize = Math.max(11, Math.min(15, 7.5 + r * 0.24))
      ctx.font = `${fontSize}px "STIX Two Text", Georgia, serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      const label = getCanvasLabel(node.latex, node.name)
      const labelY = y + r + 5
      ctx.lineWidth = 4
      ctx.strokeStyle = faded ? 'rgba(248, 245, 240, 0.3)' : 'rgba(248, 245, 240, 0.92)'
      ctx.strokeText(label, x, labelY)
      ctx.fillStyle = faded ? 'rgba(58, 53, 53, 0.24)' : LABEL_COLOR
      ctx.fillText(label, x, labelY)
    }
  }
}

function drawCurvedEdge(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  camera: CameraState,
  width: number, height: number,
  color: string,
  lineWidth: number,
) {
  const [sx1, sy1] = worldToScreen(x1, y1, camera, width, height)
  const [sx2, sy2] = worldToScreen(x2, y2, camera, width, height)
  const mx = (sx1 + sx2) / 2
  const my = (sy1 + sy2) / 2
  const dx = sx2 - sx1
  const dy = sy2 - sy1
  const nx = -dy * 0.12
  const ny = dx * 0.12

  ctx.beginPath()
  ctx.moveTo(sx1, sy1)
  ctx.quadraticCurveTo(mx + nx, my + ny, sx2, sy2)
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.stroke()
}

function orangeGradient(t: number): string {
  const clamped = Math.min(Math.max(t, 0), 1)
  const start = { r: 246, g: 196, b: 126 }
  const end = { r: 165, g: 84, b: 19 }
  const r = Math.round(start.r + (end.r - start.r) * clamped)
  const g = Math.round(start.g + (end.g - start.g) * clamped)
  const b = Math.round(start.b + (end.b - start.b) * clamped)
  return `rgb(${r}, ${g}, ${b})`
}

function blendColor(colorA: string, colorB: string, t: number): string {
  const a = parseCssColor(colorA)
  const b = parseCssColor(colorB)
  const mix = Math.min(Math.max(t, 0), 1)
  return `rgb(${Math.round(a.r + (b.r - a.r) * mix)}, ${Math.round(
    a.g + (b.g - a.g) * mix,
  )}, ${Math.round(a.b + (b.b - a.b) * mix)})`
}

function parseCssColor(color: string): { r: number; g: number; b: number } {
  if (color.startsWith('#')) {
    return {
      r: parseInt(color.slice(1, 3), 16),
      g: parseInt(color.slice(3, 5), 16),
      b: parseInt(color.slice(5, 7), 16),
    }
  }
  const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (match) {
    return {
      r: Number(match[1]),
      g: Number(match[2]),
      b: Number(match[3]),
    }
  }
  return { r: 192, g: 144, b: 96 }
}

function getCanvasLabel(latex: string, fallback: string): string {
  return latex
    .replace(/\\pi/g, 'π')
    .replace(/\\sigma/g, 'σ')
    .replace(/\\sqrt\{x\}/g, '√x')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\frac\{1\}\{x\}/g, '1/x')
    .replace(/\\frac\{x\}\{y\}/g, 'x/y')
    .replace(/\\frac\{\\pi\}\{2\}/g, 'π/2')
    .replace(/\\operatorname\{([^}]+)\}\s*([a-z])/g, '$1($2)')
    .replace(/\\sin\s*x/g, 'sin(x)')
    .replace(/\\cos\s*x/g, 'cos(x)')
    .replace(/\\tan\s*x/g, 'tan(x)')
    .replace(/\\sinh\s*x/g, 'sinh(x)')
    .replace(/\\cosh\s*x/g, 'cosh(x)')
    .replace(/\\tanh\s*x/g, 'tanh(x)')
    .replace(/x\^2/g, 'x²')
    .replace(/x\^y/g, 'xʸ')
    .replace(/\\cdot/g, '·')
    .replace(/\\left\(/g, '(')
    .replace(/\\right\)/g, ')')
    .replace(/\\/g, '')
    .trim() || fallback
}
