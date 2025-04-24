// Links files to generate package type exports
export * as THREE from 'three'
export * as Format from 'vim-format'

export * from './viewer/viewer'
export * from './vim-loader/geometryUtils'
export * from './viewer/gizmos/gizmoGrid'
export type { PointerMode, InputScheme } from './viewer/inputs/input'
export { DefaultInputScheme, KEYS } from './viewer/inputs/input'
export * from './viewer/viewerSettings'
export {
  RaycastResult as HitTestResult,
  InputAction
} from './viewer/raycaster'

export * from './vim-loader/geometryUtils'
export * from './vim-loader/vimLoader'
export * from './materials/vimMaterials'
export * from './vim-loader/meshFactory'
export * from './vim-loader/vimObject'
export * from './scene/scene'
export * from './vim-loader/vim'
export { GltfLoader } from './vim-loader/gltfLoader'
