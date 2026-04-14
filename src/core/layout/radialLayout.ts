import { expressionUsesVariable } from '../eml/expressionAnalysis'
import { FAMILY_META } from '../eml/families'
import type { DerivationNode, GraphEdge, PositionedNode } from '../eml/types'

const ANCHOR_RADIUS = 92
const ONE_ANCHOR_ANGLE = Math.PI
const X_ANCHOR_ANGLE = 0

export function buildRadialLayout(
  nodes: DerivationNode[],
  edges: GraphEdge[],
): PositionedNode[] {
  const sortedNodes = [...nodes].sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name))
  const parentsById = new Map<string, string[]>()
  for (const edge of edges) {
    const list = parentsById.get(edge.to) ?? []
    list.push(edge.from)
    parentsById.set(edge.to, list)
  }

  const grouped = new Map<string, DerivationNode[]>()
  for (const node of sortedNodes) {
    const key = `${node.family}:${node.depth}`
    const list = grouped.get(key) ?? []
    list.push(node)
    grouped.set(key, list)
  }

  const positions = new Map<
    string,
    {
      x: number
      y: number
      targetX: number
      targetY: number
      targetAngle: number
      targetRadius: number
      fixed: boolean
    }
  >()

  const oneAnchor = polar(ANCHOR_RADIUS, ONE_ANCHOR_ANGLE)
  const xAnchor = polar(ANCHOR_RADIUS, X_ANCHOR_ANGLE)

  for (const node of sortedNodes) {
    if (node.id === 'one') {
      positions.set(node.id, {
        x: oneAnchor.x,
        y: oneAnchor.y,
        targetX: oneAnchor.x,
        targetY: oneAnchor.y,
        targetAngle: ONE_ANCHOR_ANGLE,
        targetRadius: ANCHOR_RADIUS,
        fixed: true,
      })
      continue
    }

    if (node.id === 'x_anchor') {
      positions.set(node.id, {
        x: xAnchor.x,
        y: xAnchor.y,
        targetX: xAnchor.x,
        targetY: xAnchor.y,
        targetAngle: X_ANCHOR_ANGLE,
        targetRadius: ANCHOR_RADIUS,
        fixed: true,
      })
      continue
    }

    const meta = FAMILY_META[node.family]
    const group = grouped.get(`${node.family}:${node.depth}`) ?? [node]
    const index = group.findIndex((entry) => entry.id === node.id)
    const usesX = expressionUsesVariable(node.formula)
    const anchorAngle = usesX ? X_ANCHOR_ANGLE : ONE_ANCHOR_ANGLE
    const familySpread = familySpreadFactor(node.family)
    const spreadAngle =
      group.length === 1
        ? 0
        : ((index / (group.length - 1)) - 0.5) *
          Math.min(0.78, 0.08 * group.length * familySpread)
    const bandOffset = radialBandOffset(index, group.length, node.family)
    const targetAngle = mixAngle(
      meta.sectorAngle + spreadAngle,
      anchorAngle,
      node.depth <= 2 ? 0.08 : 0.04,
    )
    const targetRadius = depthToRadius(node.depth) + bandOffset
    const jitterRadius = ((simpleHash(node.id) % 9) - 4) * 3.5
    const jitterAngle = ((simpleHash(`${node.id}-angle`) % 9) - 4) * 0.012
    const initial = polar(targetRadius + jitterRadius, targetAngle + jitterAngle)

    positions.set(node.id, {
      x: initial.x,
      y: initial.y,
      targetX: polar(targetRadius, targetAngle).x,
      targetY: polar(targetRadius, targetAngle).y,
      targetAngle,
      targetRadius,
      fixed: false,
    })
  }

  const byId = new Map(sortedNodes.map((node) => [node.id, node]))
  const movableIds = sortedNodes
    .filter((node) => node.id !== 'one' && node.id !== 'x_anchor')
    .map((node) => node.id)

  for (let iteration = 0; iteration < 72; iteration += 1) {
    for (const id of movableIds) {
      const position = positions.get(id)
      if (!position) continue
      position.x += (position.targetX - position.x) * 0.12
      position.y += (position.targetY - position.y) * 0.12
    }

    for (let i = 0; i < movableIds.length; i += 1) {
      for (let j = i + 1; j < movableIds.length; j += 1) {
        const aId = movableIds[i]
        const bId = movableIds[j]
        const a = positions.get(aId)
        const b = positions.get(bId)
        const aNode = byId.get(aId)
        const bNode = byId.get(bId)
        if (!a || !b || !aNode || !bNode) continue

        const dx = b.x - a.x
        const dy = b.y - a.y
        const distance = Math.hypot(dx, dy) || 1
        const radiusPadding = visualFootprint(aNode) + visualFootprint(bNode)
        const desired =
          aNode.family === bNode.family
            ? aNode.depth === bNode.depth
              ? radiusPadding + 34 + Math.min(aNode.depth, bNode.depth) * 5 + familyRepulsionBoost(aNode.family)
              : radiusPadding + 20 + familyRepulsionBoost(aNode.family) * 0.45
            : aNode.depth === bNode.depth
              ? radiusPadding + 14
              : radiusPadding + 8
        if (distance >= desired) continue

        const force = (desired - distance) * 0.034
        const ux = dx / distance
        const uy = dy / distance
        a.x -= ux * force
        a.y -= uy * force
        b.x += ux * force
        b.y += uy * force
      }
    }

    for (const id of movableIds) {
      const position = positions.get(id)
      const parents = parentsById.get(id) ?? []
      if (!position || parents.length === 0) continue
      const centroid = parents.reduce(
        (acc, parentId) => {
          const parent = positions.get(parentId)
          if (!parent) return acc
          return { x: acc.x + parent.x, y: acc.y + parent.y }
        },
        { x: 0, y: 0 },
      )
      centroid.x /= parents.length
      centroid.y /= parents.length
      position.x += (centroid.x - position.x) * 0.028
      position.y += (centroid.y - position.y) * 0.028
    }

    for (const id of movableIds) {
      const position = positions.get(id)
      if (!position) continue
      const currentAngle = Math.atan2(position.y, position.x)
      const currentRadius = Math.hypot(position.x, position.y) || 1
      const nextAngle =
        currentAngle + shortestAngle(currentAngle, position.targetAngle) * 0.16
      const nextRadius =
        currentRadius + (position.targetRadius - currentRadius) * 0.22
      position.x = Math.cos(nextAngle) * nextRadius
      position.y = Math.sin(nextAngle) * nextRadius
    }
  }

  return sortedNodes.map((node) => {
    const position = positions.get(node.id) ?? {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      targetAngle: 0,
      targetRadius: 0,
      fixed: false,
    }
    return {
      ...node,
      x: position.x,
      y: position.y,
      radius: nodeRadius(node),
    }
  })
}

function simpleHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export function depthToRadius(depth: number): number {
  if (depth <= 0) return 0
  return 160 + 165 * Math.log2(depth + 1)
}

function nodeRadius(node: DerivationNode): number {
  if (node.id === 'one' || node.id === 'x_anchor') return 20
  const base = node.isLandmark ? 11.5 : 8.7
  const depthBoost = Math.min(node.depth, 8) * (node.isLandmark ? 0.5 : 0.38)
  const familyBoost = node.family === 'power' ? 0.65 : 0
  return base + depthBoost + familyBoost
}

function polar(radius: number, angle: number): { x: number; y: number } {
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  }
}

function mixAngle(from: number, to: number, t: number): number {
  return from + shortestAngle(from, to) * t
}

function shortestAngle(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

function radialBandOffset(
  index: number,
  size: number,
  family: DerivationNode['family'],
): number {
  if (size <= 1) return 0
  const centered = (index / (size - 1)) - 0.5
  const amplitude = family === 'arithmetic' || family === 'hyperbolic' ? 54 : 34
  return centered * amplitude
}

function familySpreadFactor(family: DerivationNode['family']): number {
  if (family === 'arithmetic') return 1.5
  if (family === 'hyperbolic') return 1.7
  return 1
}

function familyRepulsionBoost(family: DerivationNode['family']): number {
  if (family === 'arithmetic') return 18
  if (family === 'hyperbolic') return 22
  return 0
}

function visualFootprint(node: DerivationNode): number {
  return nodeRadius(node) + Math.max(14, node.name.length * 2.2)
}
