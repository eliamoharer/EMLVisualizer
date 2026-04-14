import { useMemo, useState } from 'react'
import { CanvasViewport } from './components/CanvasViewport'
import { ControlPanel } from './components/ControlPanel'
import { FocusModeOverlay } from './components/FocusModeOverlay'
import { SearchPanel } from './components/SearchPanel'
import { generateEmlGraph } from './core/eml/generator'
import { compileExpressionToEml, estimateCompileDifficulty } from './core/eml/compiler'
import { exprToLatex, exprToSearchText, parseExpression } from './core/eml/expression'
import {
  inferExpressionDependencies,
  inferExpressionDepth,
  inferExpressionFamily,
} from './core/eml/expressionAnalysis'
import { buildRadialLayout } from './core/layout/radialLayout'
import type { DerivationNode, EmlGraph, Family, GraphEdge } from './core/eml/types'
import { TOGGLEABLE_FAMILIES } from './core/eml/types'
import { buildSearchIndex, querySearchIndex } from './core/search/indexer'
import {
  collectDagHighlight,
  type DagHighlight,
} from './core/search/pathTrace'
import { DEFAULT_CAMERA, type CameraState } from './render/camera'

const DEFAULT_FAMILIES: Record<Family, boolean> = {
  primitive: true,
  core: true,
  arithmetic: true,
  constants: true,
  power: true,
  trigonometric: true,
  hyperbolic: true,
  custom: true,
}

function App() {
  const [depth, setDepth] = useState(8)
  const [familyEnabled, setFamilyEnabled] =
    useState<Record<Family, boolean>>(DEFAULT_FAMILIES)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [camera, setCamera] = useState<CameraState>(DEFAULT_CAMERA)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [customNodes, setCustomNodes] = useState<DerivationNode[]>([])
  const [createError, setCreateError] = useState<string | null>(null)

  const enabledFamilies = useMemo(
    () => TOGGLEABLE_FAMILIES.filter((f) => familyEnabled[f]),
    [familyEnabled],
  )

  const baseGraph = useMemo(
    () => generateEmlGraph({ depth, families: enabledFamilies }),
    [depth, enabledFamilies],
  )

  const graph = useMemo(
    () => mergeCustomNodes(baseGraph, customNodes),
    [baseGraph, customNodes],
  )

  const searchIndex = useMemo(
    () => buildSearchIndex(graph.nodes),
    [graph.nodes],
  )
  const searchResults = useMemo(
    () => querySearchIndex(searchIndex, searchQuery, 18),
    [searchIndex, searchQuery],
  )
  const highlight = useMemo<DagHighlight>(() => {
    if (searchQuery.trim()) {
      if (searchResults.length > 1) {
        return {
          mode: 'multi',
          nodeIds: searchResults.map((entry) => entry.id),
          edgeIds: [],
          targetIds: searchResults.map((entry) => entry.id),
          nodeSteps: {},
          edgeSteps: {},
        }
      }
      if (searchResults.length === 1) {
        return collectDagHighlight(graph, searchResults[0].id)
      }
    }
    if (hoveredNodeId) {
      return collectDagHighlight(graph, hoveredNodeId)
    }
    if (selectedNodeId) {
      return collectDagHighlight(graph, selectedNodeId)
    }
    return { mode: 'none', nodeIds: [], edgeIds: [], targetIds: [], nodeSteps: {}, edgeSteps: {} }
  }, [graph, hoveredNodeId, searchQuery, searchResults, selectedNodeId])

  const selectedNode = useMemo(
    () => graph.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [graph.nodes, selectedNodeId],
  )

  const onToggleFamily = (family: Family) => {
    setFamilyEnabled((cur) => ({ ...cur, [family]: !cur[family] }))
  }

  const onSearchSelect = (nodeId: string) => {
    setSelectedNodeId(nodeId)
    framePath(collectDagHighlight(graph, nodeId).nodeIds, graph, setCamera)
  }

  const onCreateNode = () => {
    try {
      const formula = parseExpression(searchQuery)
      const compact = exprToSearchText(formula)
      const id = `custom-${compact}-${customNodes.length + 1}`
      const family = inferExpressionFamily(formula)
      const node: DerivationNode = {
        id,
        name: compact,
        latex: exprToLatex(formula),
        family,
        depth: inferExpressionDepth(formula),
        isLandmark: true,
        description: 'Custom function created from the search field.',
        dependencies: inferExpressionDependencies(formula),
        aliases: [searchQuery, compact],
        formula,
        emlTree:
          estimateCompileDifficulty(formula) <= 11
            ? compileExpressionToEml(formula)
            : null,
      }
      setCustomNodes((current) => {
        const withoutExisting = current.filter((entry) => entry.id !== id)
        return [...withoutExisting, node]
      })
      setCreateError(null)
      setSelectedNodeId(null)
      setSearchQuery(compact)
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : 'Could not parse that function.',
      )
    }
  }

  return (
    <main className="app-shell">
      <CanvasViewport
        graph={graph}
        camera={camera}
        setCamera={setCamera}
        highlight={highlight}
        selectedNodeId={selectedNodeId}
        onNodeHover={setHoveredNodeId}
        onNodeClick={setSelectedNodeId}
      />
      <ControlPanel
        depth={depth}
        onDepthChange={setDepth}
        familyEnabled={familyEnabled}
        onToggleFamily={onToggleFamily}
      />
      <SearchPanel
        query={searchQuery}
        results={searchResults}
        createError={createError}
        onQueryChange={(value) => {
          setSearchQuery(value)
          setCreateError(null)
        }}
        onSelectNode={onSearchSelect}
        onCreateNode={onCreateNode}
      />
      <FocusModeOverlay
        key={selectedNode?.id ?? 'none'}
        node={selectedNode}
        onClose={() => setSelectedNodeId(null)}
      />
    </main>
  )
}

function framePath(
  path: string[],
  graph: ReturnType<typeof generateEmlGraph>,
  setCamera: React.Dispatch<React.SetStateAction<CameraState>>,
) {
  const pathNodes = graph.nodes.filter((n) => path.includes(n.id))
  if (pathNodes.length === 0) return
  const xs = pathNodes.map((n) => n.x)
  const ys = pathNodes.map((n) => n.y)
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2
  const span = Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
    200,
  )
  const zoom = Math.min(window.innerWidth / (span * 1.8), window.innerHeight / (span * 1.8), 1.8)
  setCamera({ x: cx, y: cy, zoom: Math.max(0.25, zoom) })
}

function mergeCustomNodes(baseGraph: EmlGraph, customNodes: DerivationNode[]): EmlGraph {
  if (customNodes.length === 0) return baseGraph

  const edges: GraphEdge[] = [
    ...baseGraph.edges,
    ...customNodes.flatMap((node) =>
      node.dependencies.map((dependency) => ({
        id: `e-${dependency}-${node.id}`,
        from: dependency,
        to: node.id,
      })),
    ),
  ]
  const nodes = buildRadialLayout([...baseGraph.nodes, ...customNodes], edges)

  return {
    ...baseGraph,
    nodes,
    edges,
  }
}

export default App
