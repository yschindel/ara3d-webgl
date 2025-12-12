import * as THREE from 'three'
import { Viewport } from '../viewport'
import { Camera } from '../camera/camera'
import { Settings } from '../viewerSettings'

export class Renderer
{
  renderer: THREE.WebGLRenderer
  antialias: boolean = true

  private _scene: THREE.Scene
  private _viewport: Viewport
  private _camera: Camera
  public _needsUpdate: boolean

  constructor (
    scene: THREE.Scene,
    viewport: Viewport,
    camera: Camera,
    settings: Settings
  ) {
    this._viewport = viewport
    this._scene = scene
    this._camera = camera

    // Higher performance trades quality for performance
    const highPerformance = false; 

    this.renderer = highPerformance 
      ? new THREE.WebGLRenderer({
        canvas: viewport.canvas,
        antialias: false,
        precision: 'lowp',
        alpha: true,
        stencil: false,
        powerPreference: 'high-performance',
        logarithmicDepthBuffer: false,
      }) 
      : new THREE.WebGLRenderer({
        canvas: viewport.canvas,
        antialias: true,
        precision: 'highp', 
        alpha: true,
        stencil: false,
        powerPreference: 'high-performance',
        logarithmicDepthBuffer: true
      })

    this.fitViewport()
    this._viewport.onResize.subscribe(() => this.fitViewport())
    this._camera.onValueChanged.sub(() => {
      this._needsUpdate = true
    })
    this.background = settings.background.color
  }

  dispose () {
    this.clear()
    this.renderer.clear()
    this.renderer.forceContextLoss()
    this.renderer.dispose()
  }

  get background () {
    return this._scene.background
  }

  set background (color: THREE.Color | THREE.Texture) {
    this._scene.background = color
    this._needsUpdate = true
  }

  render ()
  {
    const needsRender =
      this._needsUpdate ||
      this._camera.hasMoved

    if (!needsRender) {
      // absolutely nothing to do this frame
      return
    }

    this.renderer.render(this._scene, this._camera.camPerspective.camera);
  }

  add (target: THREE.Object3D)
  {
    this._scene.add(target)
    this._needsUpdate = true
    return true
  }

  remove (target: THREE.Object3D) {
    this._scene.remove(target)
    this._needsUpdate = true
  }

 clear () {
    this._scene.clear()
    this._needsUpdate = true
  }

  private _lastSize = new THREE.Vector2();

  private fitViewport = () => {
    console.log("Fitting to viewport")
    const size = this._viewport.getParentSize()

    // avoid thrashing if you get multiple resize events with the same values.
    if (size.x === this._lastSize.x && size.y === this._lastSize.y) {
      return
    }
    this._lastSize.copy(size);

    // TEMP: optimization
    const maxPixelRatio = 1.5; // could be 1.5
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio))
    //this.renderer.setPixelRatio(window.devicePixelRatio)
    
    this.renderer.setSize(size.x, size.y)
    this._needsUpdate = true
  }
}
