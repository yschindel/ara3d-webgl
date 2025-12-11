import * as THREE from 'three'

// internal
import { Settings, getSettings, PartialSettings } from './viewerSettings'
import { Camera } from './camera/camera'
import { Input } from './inputs/input'
import { Environment, IEnvironment } from './environment'
import { GizmoOrbit } from './gizmos/gizmoOrbit'
import { RenderScene } from './rendering/renderScene'
import { Viewport } from './viewport'

// loader
import { Vim } from '../vim-loader/vim'
import { Renderer } from './rendering/renderer'
import { GizmoGrid, Materials } from '../index'
import { SignalDispatcher } from 'ste-signals'

/**
 * Viewer and loader for vim files.
 */
export class Viewer {
  settings: Settings
  renderer: Renderer
  viewport: Viewport
  inputs: Input
  grid: GizmoGrid

  get materials() : Materials {
    return Materials.getInstance()
  }

  get camera () {
    return this._camera
  }

  get environment () {
    return this._environment as IEnvironment
  }

  /**
   * Signal dispatched when a new vim is loaded or unloaded.
   */
  get onVimLoaded () {
    return this._onVimLoaded.asEvent()
  }

  private _environment: Environment
  private _camera: Camera
  private _gizmoOrbit: GizmoOrbit

  // State
  private _vims = new Set<Vim>()
  private _onVimLoaded = new SignalDispatcher()
  private _running = false
  private _updateId: number | null = null
  private _clock = new THREE.Clock()

  constructor (options?: PartialSettings) {
    this.settings = getSettings(options)

    const scene = new RenderScene()
    this.viewport = new Viewport(this.settings)
    this._camera = new Camera(scene, this.viewport, this.settings)
    this.renderer = new Renderer(
      scene,
      this.viewport,
      this.materials,
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
    this.materials.applySettings(this.settings.materials)


    this.grid = new GizmoGrid(this.renderer)

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

  addObject (object: THREE.Object3D) {
    console.log("Adding object");
    if (!this.renderer.add(object)) {
      throw new Error("Could not load object")
    }
  }

  add (vim: Vim | THREE.Object3D, frameCamera = true) {
    if (vim instanceof THREE.Object3D)
    {
      this.addObject(vim)
      return
    }

    if (this._vims.has(vim)) {
      throw new Error('Vim cannot be added again, unless removed first.')
    }

    const success = this.renderer.add(vim.scene)
    if (!success) {
      vim.dispose()
      throw new Error('Could not load vim.')
    }
    this._vims.add(vim)

    const box = this.renderer.getBoundingBox()
    if (box) {
      this._environment.adaptToContent(box)
    }

    if (frameCamera) {
      this._camera.do(true).frame('all', this._camera.defaultForward)
      this._camera.save()
    }
  }

  remove (vim: Vim) {
    if (!this._vims.has(vim)) {
      throw new Error('Cannot remove missing vim from viewer.')
    }

    this._vims.add(vim)
    this.renderer.remove(vim.scene)
    vim.dispose()
    this._onVimLoaded.dispatch()
  }

  clear () {
    this._vims.forEach((v) => this.remove(v))
  }

  dispose () {
    cancelAnimationFrame(this._updateId)
    this._environment.dispose()
    this._gizmoOrbit.dispose()
    this.viewport.dispose()
    this.renderer.dispose()
    this.inputs.unregisterAll()
    this._vims.forEach((v) => v?.dispose())
    this.materials.dispose()
  }
}
