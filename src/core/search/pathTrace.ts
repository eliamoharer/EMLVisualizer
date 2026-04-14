import type { EmlGraph } from '../eml/types'

export function tracePathToRoot(graph: EmlGraph, targetId: string): string[] {
  const parentMap = new Map<string, string>()
  for (const edge of graph.edges) {
    if (!parentMap.has(edge.to)) {
      parentMap.set(edge.to, edge.from)
    }
  }

  const path: string[] = []
  let current: string | undefined = targetId
  while (current) {
    path.push(current)
    if (current === graph.rootId) break
    current = parentMap.get(current)
  }
  return path.reverse()
}

export interface DagHighlight {
  mode: 'none' | 'multi' | 'dag'
  nodeIds: string[]
  edgeIds: string[]
  targetIds: string[]
  nodeSteps: Record<string, number>
  edgeSteps: Record<string, number>
}

export function collectDagHighlight(graph: EmlGraph, targetId: string): DagHighlight {
  const incoming = new Map<string, Array<{ id: string; from: string }>>()
  for (const edge of graph.edges) {
    const list = incoming.get(edge.to) ?? []
    list.push({ id: edge.id, from: edge.from })
    incoming.set(edge.to, list)
  }

  const nodeSet = new Set<string>()
  const edgeSet = new Set<string>()
  const stack = [targetId]

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || nodeSet.has(current)) continue
    nodeSet.add(current)
    for (const parent of incoming.get(current) ?? []) {
      edgeSet.add(parent.id)
      stack.push(parent.from)
    }
  }

  const nodeIds = Array.from(nodeSet).sort(
    (a, b) => (nodeDepth(graph, a) - nodeDepth(graph, b)) || a.localeCompare(b),
  )
  const edgeIds = Array.from(edgeSet).sort((a, b) => {
    const aEdge = graph.edges.find((edge) => edge.id === a)
    const bEdge = graph.edges.find((edge) => edge.id === b)
    if (!aEdge || !bEdge) return a.localeCompare(b)
    const stepDelta = nodeDepth(graph, aEdge.to) - nodeDepth(graph, bEdge.to)
    return stepDelta || a.localeCompare(b)
  })

  const nodeSteps = buildNodeSteps(nodeIds, incoming)
  const edgeSteps = buildEdgeSteps(graph, edgeIds, nodeSteps)

  return {
    mode: 'dag',
    nodeIds,
    edgeIds,
    targetIds: [targetId],
    nodeSteps,
    edgeSteps,
  }
}

function nodeDepth(graph: EmlGraph, id: string): number {
  return graph.nodes.find((node) => node.id === id)?.depth ?? 0
}

function buildNodeSteps(
  nodeIds: string[],
  incoming: Map<string, Array<{ id: string; from: string }>>,
): Record<string, number> {
  const nodeSet = new Set(nodeIds)
  const steps: Record<string, number> = {}
  for (const id of nodeIds) resolve(id)
  return steps

  function resolve(id: string): number {
    if (typeof steps[id] === 'number') return steps[id]
    const parents = (incoming.get(id) ?? []).filter((edge) => nodeSet.has(edge.from))
    if (parents.length === 0) {
      steps[id] = 0
      return 0
    }
    const value = Math.max(...parents.map((edge) => resolve(edge.from) + 1))
    steps[id] = value
    return value
  }
}

function buildEdgeSteps(
  graph: EmlGraph,
  edgeIds: string[],
  nodeSteps: Record<string, number>,
): Record<string, number> {
  const steps: Record<string, number> = {}
  for (const id of edgeIds) {
    const edge = graph.edges.find((candidate) => candidate.id === id)
    if (!edge) continue
    steps[id] = nodeSteps[edge.to] ?? 0
  }
  return steps
}
