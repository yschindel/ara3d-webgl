import { G3d } from 'vim-format'
import { MergeArgs } from './geometry'
import { MeshFactory } from './meshFactory'
import { Scene } from './scene'

/**
 * Creates meshes and returns them as a scene from a g3d.
 */
export class SceneFactory
{
  /**
   * Creates a new Scene from a g3d by merging mergeable meshes and instancing instantiable meshes
   */
  static createFromG3d (g3d: G3d): Scene {
    const scene = new Scene()

    // Add instanced geometry
    const shared = this.createFromInstantiableMeshes(g3d)
    scene.merge(shared)

    // Add merged geometry
    scene.merge(
      this.createFromMergeableMeshes(g3d, {
        instances: undefined,
        section: 'opaque',
        transparent: false
      })
    )
    scene.merge(
      this.createFromMergeableMeshes(g3d, {
        instances: undefined,
        section: 'transparent',
        transparent: true
      })
    )

    return scene
  }

  static createFromInstantiableMeshes (g3d: G3d) {
    const meshes = MeshFactory.createInstancedMeshes(g3d)
    const scene = new Scene()
    for (let m = 0; m < meshes.length; m++) {
      scene.addMesh(meshes[m])
    }
    return scene
  }

  /**
   * Creates a Scene from mergeable meshes from the g3d
   */
  static createFromMergeableMeshes (g3d: G3d, args: MergeArgs) {
    const scene = new Scene()
    const mesh = MeshFactory.createMergedMesh(g3d, args)
    if (mesh) scene.addMesh(mesh)
    return scene
  }
}
