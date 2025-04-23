import * as THREE from 'three'
import { Mesh } from './mesh'
import { SignalDispatcher } from 'ste-signals'
import { SubMesh } from './subMesh'

/**
 * A Scene regroups many Meshes
 * It tracks the global bounding box as Meshes are added
 * It keeps a map from instance indices to Meshes and vice versa
 */
export class Scene {
  meshes: Mesh[] = []
  private _matrix = new THREE.Matrix4()
  private _updated: boolean = false
  private _outlineCount: number = 0

  private _boundingBox: THREE.Box3
  private _instanceToMeshes: Map<number, SubMesh[]> = new Map()
  private _materialOverride: THREE.Material | undefined

  private _onUpdate = new SignalDispatcher()
  get onUpdate () {
    return this._onUpdate.asEvent()
  }

  get updated () {
    return this._updated
  }

  set updated (value: boolean) {
    this._updated = this._updated || value
  }

  hasOutline () {
    return this._outlineCount > 0
  }

  addOutline () {
    this._outlineCount++
    this.updated = true
  }

  removeOutline () {
    this._outlineCount--
    this.updated = true
  }

  clearUpdateFlag () {
    this._updated = false
  }

  /**
   * Returns the scene bounding box. Returns undefined if scene is empty.
   */
  getBoundingBox (target: THREE.Box3 = new THREE.Box3()) {
    return this._boundingBox ? target.copy(this._boundingBox) : undefined
  }

  /**
   * Returns the THREE.Mesh in which this instance is represented along with index
   * For merged mesh, index refers to submesh index
   * For instanced mesh, index refers to instance index.
   */
  getMeshFromInstance (instance: number) { return this._instanceToMeshes.get(instance) }

  /**
   * Applies given transform matrix to all Meshes and bounding box.
   */
  applyMatrix4 (matrix: THREE.Matrix4) {
    for (let m = 0; m < this.meshes.length; m++) {
      this.meshes[m].mesh.matrixAutoUpdate = false
      this.meshes[m].mesh.matrix.copy(matrix)
    }

    // Revert previous matrix
    this._boundingBox?.applyMatrix4(this._matrix.invert())
    this._matrix.copy(matrix)
    this._boundingBox?.applyMatrix4(this._matrix)
  }

   /**
   * Add an instanced mesh to the Scene and recomputes fields as needed.
   * param mesh Is expected to have:
   * userData.instances = number[] (indices of the g3d instances that went into creating the mesh)
   * userData.boxes = THREE.Box3[] (bounding box of each instance)
   */
  addMesh (mesh: Mesh) {
    const subs = mesh.getSubMeshes()
    subs.forEach((s) => {
      const set = this._instanceToMeshes.get(s.instance) ?? []
      set.push(s)
      this._instanceToMeshes.set(s.instance, set)
    })

    this.updateBox(mesh.boundingBox)
    this.meshes.push(mesh)
    this.updated = true
    return this
  }

  private updateBox (box: THREE.Box3) {
    if (box !== undefined) {
      const b = box.clone().applyMatrix4(this._matrix)
      this._boundingBox = this._boundingBox?.union(b) ?? b
    }
    this._onUpdate.dispatch()
  }

  /**
   * Adds the content of other Scene to this Scene and recomputes fields as needed.
   */
  merge (other: Scene) {
    if (!other) return this
    other.meshes.forEach((mesh) => this.meshes.push(mesh))
    other._instanceToMeshes.forEach((meshes, instance) => {
      const set = this._instanceToMeshes.get(instance) ?? []
      meshes.forEach((m) => set.push(m))
      this._instanceToMeshes.set(instance, set)
    })

    if (other._boundingBox) {
      this._boundingBox =
        this._boundingBox?.union(other._boundingBox) ??
        other._boundingBox.clone()
    }

    this.updated = true
    return this
  }

  /**
   * Gets the current material override or undefined if none.
   */
  get materialOverride () {
    return this._materialOverride
  }

  /**
   * Sets and apply a material override to the scene, undefined will remove override.
   */
  set materialOverride (value: THREE.Material | undefined) {
    if (this._materialOverride === value) return
    this.updated = true
    this._materialOverride = value
    this.meshes.forEach((m) => m.setOverrideMaterial(value))
  }

  /**
   * Disposes of all resources.
   */
  dispose () {
    for (let i = 0; i < this.meshes.length; i++) {
      this.meshes[i].mesh.geometry.dispose()
    }
    this.meshes.length = 0
    this._instanceToMeshes.clear()
  }
}
