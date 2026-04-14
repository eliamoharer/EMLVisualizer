export interface CameraState {
  x: number
  y: number
  zoom: number
}

export const DEFAULT_CAMERA: CameraState = {
  x: 0,
  y: 0,
  zoom: 0.78,
}

export function worldToScreen(
  worldX: number,
  worldY: number,
  camera: CameraState,
  width: number,
  height: number,
): [number, number] {
  return [
    (worldX - camera.x) * camera.zoom + width / 2,
    (worldY - camera.y) * camera.zoom + height / 2,
  ]
}

export function screenToWorld(
  screenX: number,
  screenY: number,
  camera: CameraState,
  width: number,
  height: number,
): [number, number] {
  return [
    (screenX - width / 2) / camera.zoom + camera.x,
    (screenY - height / 2) / camera.zoom + camera.y,
  ]
}
