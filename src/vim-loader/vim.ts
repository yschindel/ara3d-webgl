import * as THREE from 'three'
import { VimDocument, G3d, VimHeader } from 'vim-format'
import { Scene } from '../scene/scene'
import { VimObject } from './vimObject'
import {
  ElementMapping,
  ElementNoMapping
} from './elementMapping'
import { SubMesh } from '../scene/subMesh'
import { Matrix4 } from 'three'

/**
 * Container for the built three meshes and the vim data from which it was built.
 * Dispenses Objects for high level scene manipulation
 */
export class Vim {
  header: VimHeader
  source: string | undefined
  readonly document: VimDocument
  readonly g3d: G3d | undefined
  readonly transform: Matrix4

  scene: Scene
  private _elementToObject: Map<number, VimObject> = new Map<number, VimObject>()
  private _map: ElementMapping | ElementNoMapping

  constructor (
    header: VimHeader | undefined,
    document: VimDocument,
    g3d: G3d | undefined,
    scene: Scene,
    transform: Matrix4,
    map: ElementMapping | ElementNoMapping
  ) {
    this.header = header
    this.document = document
    this.g3d = g3d
    this.scene = scene
    this.transform = transform
    this.scene.applyMatrix4(transform);
    this._map = map ?? new ElementNoMapping()
  }

  dispose () {
    this.scene.dispose()
  }

  getMatrix () {
    return this.transform
  }

  getVimObjectFromInstance (instance: number) {
    const element = this._map?.getElementFromInstance(instance)
    if (!element) return
    return this.getObjectFromElement(element)
  }

  getObjectsFromElementId (id: number) {
    const elements = this._map.getElementsFromElementId(id)
    return elements
      ?.map((e) => this.getObjectFromElement(e))
      .filter((o): o is VimObject => o !== undefined)
  }

  getObjectFromElement (element: number): VimObject | undefined {
    if (!this.hasElement(element)) return

    if (this._elementToObject.has(element)) {
      return this._elementToObject.get(element)
    }

    const instances = this.getInstancesFromElement(element)
    const meshes = this.getMeshesFromInstances(instances)

    const result = new VimObject(this, element, instances, meshes)
    this._elementToObject.set(element, result)
    return result
  }

  /**
   * Returns an array with all vim objects strictly contained in given box.
   */
  getObjectsInBox (box: THREE.Box3) {
    const result: VimObject[] = []

    for (const obj of this.getAllObjects()) {
      const b = obj.getBoundingBox()
      if (!b) continue
      if (box.containsBox(b)) {
        result.push(obj)
      }
    }
    return result
  }

  /**
   * Enumerates all objects of the vim
   */
  * getAllObjects () {
    for (const e of this.getAllElements()) {
      const obj = this.getObjectFromElement(e)
      if (obj) yield obj
    }
  }

  private getMeshesFromElement (element: number) {
    const instances = this.getInstancesFromElement(element)
    if (!instances) return
    return this.getMeshesFromInstances(instances)
  }

  /**
   * Returns true if element exists in the vim.
   */
  hasElement (element: number) {
    return this._map.hasElement(element)
  }

  /**
   * Returns all element indices of the vim
   */
  getAllElements () {
    return this._map.getAllElements()
  }

  /**
   * Returns instance indices associated with vim element index
   * @param element vim element index
   */
  getInstancesFromElement (element: number): number[] | undefined {
    return this._map.getInstancesFromElement(element)
  }

  /**
   * Returns the element index associated with the g3d instance index.
   * @param instance g3d instance index
   * @returns element index or undefined if not found
   */
  getElementFromInstance (instance: number) {
    return this._map.getElementFromInstance(instance)
  }

  /**
   * Returns element id from element index
   * @param element element index
   */
  getElementId (element: number) {
    return this._map.getElementId(element)
  }

  private getMeshesFromInstances (instances: number[] | undefined) {
    if (!instances?.length) return

    const meshes: SubMesh[] = []
    for (let i = 0; i < instances.length; i++) {
      const instance = instances[i]
      if (instance < 0) continue
      const submeshes = this.scene.getMeshFromInstance(instance)
      submeshes?.forEach((s) => meshes.push(s))
    }
    if (meshes.length === 0) return
    return meshes
  }
}
