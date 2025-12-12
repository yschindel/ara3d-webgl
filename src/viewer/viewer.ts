import * as THREE from 'three'

// internal
import { Settings, getSettings, PartialSettings } from './viewerSettings'
import { Camera } from './camera/camera'
import { Input } from './inputs/input'
import { Environment, IEnvironment } from './environment'
import { GizmoOrbit } from './gizmos/gizmoOrbit'
import { Viewport } from './viewport'
import { Renderer } from './rendering/renderer'

export class Viewer {
  settings: Settings
  renderer: Renderer
  viewport: Viewport
  inputs: Input

  get camera () {
    return this._camera
  }

  get environment () {
    return this._environment as IEnvironment
  }

  private _environment: Environment
  private _camera: Camera
  private _gizmoOrbit: GizmoOrbit
  private _running = false
  private _updateId: number | null = null
  private _clock = new THREE.Clock()
  private _scene = new THREE.Scene()

  constructor (options?: PartialSettings) {
    this.settings = getSettings(options)

    this.viewport = new Viewport(this.settings)
    this._camera = new Camera(this.viewport, this.settings)
    this.renderer = new Renderer(
      this._scene,
      this.viewport,
      this._camera,
      this.settings
    )

    this.inputs = new Input(this)

    if (this.settings.camera.gizmo.enable) {
      this._gizmoOrbit = new GizmoOrbit(
        this.renderer,
        this._camera,
        this.inputs,
        this.settings
      )
    }

    this._environment = new Environment(this.settings)
    this._environment.getObjects().forEach((o) => this.renderer.add(o))

    // Input and Selection
    this.inputs.registerAll()

    // Start Loop
    this.start()
  }

  start () {
    if (this._running) return
    this._running = true
    this._clock.start()
    this.animate()
  }

  stop () {
    this._running = false
    if (this._updateId !== null) {
      cancelAnimationFrame(this._updateId)
      this._updateId = null
    }
  }

  private animate = () => {
    if (!this._running) return

    this._updateId = requestAnimationFrame(this.animate)

    const dt = this._clock.getDelta()
    const camChanged = this._camera.update(dt)

    this.renderer._needsUpdate = this.renderer._needsUpdate || camChanged
    this.renderer.render()
  }


  add (obj: THREE.Object3D, frameCamera = true) {
    console.log("Adding object");
    this.renderer._needsUpdate = true;
    if (!this.renderer.add(obj)) {
      throw new Error("Could not load object")
    }
  }


  clear () {
    this.renderer.clear();
  }

  dispose () {
    cancelAnimationFrame(this._updateId)
    this._environment.dispose()
    this._gizmoOrbit.dispose()
    this.viewport.dispose()
    this.renderer.dispose()
    this.inputs.unregisterAll()
  }
}
