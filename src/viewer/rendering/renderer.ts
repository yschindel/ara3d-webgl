import * as THREE from 'three'
import { Scene } from '../../scene/scene'
import { Viewport } from '../viewport'
import { RenderScene } from './renderScene'
import { VimMaterials } from '../../materials/vimMaterials'
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer'

import { Camera } from '../camera/camera'
import { RenderingSection } from './renderingSection'
import { RenderingComposer } from './renderingComposer'
import { Settings } from '../viewerSettings'

export class Renderer
{
  renderer: THREE.WebGLRenderer
  textRenderer: CSS2DRenderer
  section: RenderingSection

  antialias: boolean = true

  private _scene: RenderScene
  private _viewport: Viewport
  private _camera: Camera
  private _composer: RenderingComposer
  private _materials: VimMaterials
  private _renderText: boolean | undefined
  private _needsUpdate: boolean

  get needsUpdate () {
    return this._needsUpdate
  }

  set needsUpdate (value: boolean) {
    this._needsUpdate = this._needsUpdate || value
  }

  constructor (
    scene: RenderScene,
    viewport: Viewport,
    materials: VimMaterials,
    camera: Camera,
    settings: Settings
  ) {
    this._viewport = viewport
    this._scene = scene
    this._materials = materials
    this._camera = camera

    this.renderer = new THREE.WebGLRenderer({
      canvas: viewport.canvas,
      antialias: true,
      precision: 'highp', // 'lowp', 'mediump', 'highp'
      alpha: true,
      stencil: false,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true
    })

    this.textRenderer = this._viewport.createTextRenderer()
    this.textEnabled = false

    this._composer = new RenderingComposer(
      this.renderer,
      scene,
      viewport,
      camera
    )
    this._composer.onDemand = settings.rendering.onDemand

    this.section = new RenderingSection(this, this._materials)

    this.fitViewport()
    this._viewport.onResize.subscribe(() => this.fitViewport())
    this._camera.onValueChanged.sub(() => {
      this._composer.camera = this._camera.three
      this.needsUpdate = true
    })
    this._materials.onUpdate.sub(() => (this.needsUpdate = true))
    this.background = settings.background.color
  }

  dispose () {
    this.clear()

    this.renderer.clear()
    this.renderer.forceContextLoss()
    this.renderer.dispose()
    this._composer.dispose()
  }

  get background () {
    return this._scene.scene.background
  }

  set background (color: THREE.Color | THREE.Texture) {
    this._scene.scene.background = color
    this.needsUpdate = true
  }

  get textEnabled () {
    return this._renderText ?? false
  }

  set textEnabled (value: boolean) {
    if (value === this._renderText) return
    this.needsUpdate = true
    this._renderText = value
    this.textRenderer.domElement.style.display = value ? 'block' : 'none'
  }

  getBoundingBox (target: THREE.Box3 = new THREE.Box3()) {
    return this._scene.getBoundingBox(target)
  }

  render ()
  {
    this._composer.outlines = this._scene.hasOutline()

    this._composer.render(
      this.needsUpdate,
      this.antialias && !this._camera.hasMoved
    )
    this._needsUpdate = false

    if (this.textEnabled) {
      this.textRenderer.render(this._scene.scene, this._camera.three)
    }

    this._scene.clearUpdateFlags()
  }

  add (target: Scene | THREE.Object3D)
  {
    this._scene.add(target)
    this._needsUpdate = true
    return true
  }

  remove (target: Scene | THREE.Object3D) {
    this._scene.remove(target)
    this._needsUpdate = true
  }

 clear () {
    this._scene.clear()
    this._needsUpdate = true
  }

  get samples () {
    return this._composer.samples
  }

  set samples (value: number) {
    this._composer.samples = value
  }

  private fitViewport = () => {
    const size = this._viewport.getParentSize()
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(size.x, size.y)
    this._composer.setSize(size.x, size.y)
    this.textRenderer.setSize(size.x, size.y)
    this.needsUpdate = true
  }
}
