import * as THREE from 'three'
import {
  ActionModifier,
  ActionType,
  Raycaster,
  RaycastResult,
} from './raycaster'

/**
 * Represents an input action with its position and modifiers.
 */
export class InputAction {
  readonly position: THREE.Vector2
  readonly modifier: ActionModifier
  readonly type: ActionType
  private _raycaster: Raycaster

  constructor(
    type: ActionType,
    modifier: ActionModifier,
    position: THREE.Vector2,
    raycaster: Raycaster,
  ) {
    this.type = type
    this.modifier = modifier
    this.position = position
    this._raycaster = raycaster
  }

  private _raycast: RaycastResult | undefined

  get raycaster() {
    return this._raycaster.fromPoint2(this.position)
  }

  get raycast() {
    return (
      this._raycast ?? (this._raycast = this._raycaster.raycast2(this.position))
    )
  }

  get object() {
    // TODO: this will eventually need to connect the `this.raycast.objectId` to an actual object.
    // We need to figure out how to connect objects to raycast without minimial additional complexity.
    // Probably by storing the object in the meshes.
    return undefined;
  }

}