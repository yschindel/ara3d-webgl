import * as THREE from 'three'
import { Intersection } from 'three'
import { Mesh } from '../scene/mesh'
import { RenderScene } from './rendering/renderScene'
import { Viewport } from './viewport'
import { Camera } from './camera/camera'
import { Renderer } from './rendering/renderer'
import { SubMesh } from '../scene/subMesh'

/**
 * Type alias for THREE intersection array
 */
export type ThreeIntersectionList = THREE.Intersection<
  THREE.Object3D<THREE.Event>
>[]

export type ActionType = 'main' | 'double' | 'idle'
export type ActionModifier = 'none' | 'shift' | 'ctrl'

export class RaycastResult {
  intersections: ThreeIntersectionList

  constructor (intersections: ThreeIntersectionList) {
    this.intersections = intersections
  }

  static getObjectIdFromHit (hit: THREE.Intersection): number {
    if (!hit) return -1
    const mesh = hit.object.userData.mesh as Mesh
    if (!mesh) return -1
    const subMesh = mesh.merged
      ? mesh.getSubMeshFromFace(hit.faceIndex)
      : mesh.getSubMesh(hit.instanceId)
    if (!subMesh) return -1
    if (subMesh instanceof SubMesh) {
      const parent = subMesh.mesh
      return parent.instances[subMesh.index]
    }
    return -1
  }

  // Convenience functions and mnemonics
  get firstHit(): Intersection {
    return this.intersections[0]
  }

  get objectId(): number {
    return RaycastResult.getObjectIdFromHit(this.firstHit)
  }

  get isHit (): boolean {
    return !!this.firstHit
  }

  get distance () {
    return this.firstHit?.distance
  }

  get position () {
    return this.firstHit?.point
  }

  get threeId () {
    return this.firstHit?.object?.id
  }

  get faceIndex () {
    return this.firstHit?.faceIndex
  }
}

export class Raycaster {
  private _viewport: Viewport
  private _camera: Camera
  private _scene: RenderScene
  private _renderer: Renderer

  private _raycaster = new THREE.Raycaster()

  constructor (
    viewport: Viewport,
    camera: Camera,
    scene: RenderScene,
    renderer: Renderer
  ) {
    this._viewport = viewport
    this._camera = camera
    this._scene = scene
    this._renderer = renderer
  }

  /**
   * Raycast projecting a ray from camera position to screen position
   */
  raycast2 (position: THREE.Vector2) {
    this._raycaster = this.fromPoint2(position, this._raycaster)
    let hits = this._raycaster.intersectObjects(this._scene.scene.children)
    hits = this.filterHits(hits)
    return new RaycastResult(hits)
  }

  private filterHits (hits: ThreeIntersectionList) {
    return this._renderer.section.active
      ? hits.filter((i) => this._renderer.section.box.containsPoint(i.point))
      : hits
  }

  /**
   * Raycast projecting a ray from camera position to world position
   */
  raycast3 (position: THREE.Vector3) {
    this._raycaster = this.fromPoint3(position, this._raycaster)
    let hits = this._raycaster.intersectObjects(this._scene.scene.children)
    hits = this.filterHits(hits)
    return new RaycastResult(hits)
  }

  /**
   * Raycast projecting a ray from camera center
   */
  raycastForward () {
    return this.raycast3(this._camera.target)
  }

  /**
   * Returns a THREE.Raycaster projecting a ray from camera position to screen position
   */
  fromPoint2 (
    position: THREE.Vector2,
    target: THREE.Raycaster = new THREE.Raycaster()
  ) {
    const size = this._viewport.getSize()
    const x = (position.x / size.x) * 2 - 1
    const y = -(position.y / size.y) * 2 + 1
    target.setFromCamera(new THREE.Vector2(x, y), this._camera.three)
    return target
  }

  /**
   * Returns a THREE.Raycaster projecting a ray from camera position to world position
   */
  fromPoint3 (
    position: THREE.Vector3,
    target: THREE.Raycaster = new THREE.Raycaster()
  ) {
    const direction = position.clone().sub(this._camera.position).normalize()

    target.set(this._camera.position, direction)
    return target
  }
}

