import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { EmlGraph } from '../core/eml/types'
import { useCanvasInteraction } from '../hooks/useCanvasInteraction'
import type { DagHighlight } from '../core/search/pathTrace'
import type { CameraState } from '../render/camera'
import { renderGraph } from '../render/graphRenderer'

interface CanvasViewportProps {
  graph: EmlGraph
  camera: CameraState
  setCamera: Dispatch<SetStateAction<CameraState>>
  highlight: DagHighlight
  selectedNodeId: string | null
  onNodeHover: (nodeId: string | null) => void
  onNodeClick: (nodeId: string) => void
}

export function CanvasViewport({
  graph,
  camera,
  setCamera,
  highlight,
  selectedNodeId,
  onNodeHover,
  onNodeClick,
}: CanvasViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [viewportSize, setViewportSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }))
  const { handlers, hoveredNodeId } = useCanvasInteraction(
    camera,
    setCamera,
    graph.nodes,
    onNodeClick,
  )

  useEffect(() => {
    const resize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    onNodeHover(hoveredNodeId)
  }, [hoveredNodeId, onNodeHover])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = viewportSize.width * dpr
    canvas.height = viewportSize.height * dpr
    canvas.style.width = `${viewportSize.width}px`
    canvas.style.height = `${viewportSize.height}px`
  }, [viewportSize])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    renderGraph(ctx, graph, camera, highlight, selectedNodeId, hoveredNodeId)
  }, [camera, graph, highlight, selectedNodeId, hoveredNodeId, viewportSize])

  return (
    <canvas
      ref={canvasRef}
      className="canvas-viewport"
      style={{ cursor: hoveredNodeId ? 'pointer' : 'grab' }}
      {...handlers}
      aria-label="EML derivation graph"
    />
  )
}
