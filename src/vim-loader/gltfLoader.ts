import * as THREE from 'three'
import { GLTFLoader as ThreeGltfLoader } from 'three/examples/jsm/loaders/GLTFLoader'

export class GltfLoader
{
  async load(source: string): Promise<THREE.Group>
  {
    return new Promise((resolve, reject) =>
    {
      const loader = new ThreeGltfLoader();
      loader.load(
        source,
        (gltf) => {
          const scene = gltf.scene || gltf.scenes[0];
          if (!scene) {
            return reject(new Error('Model contains no scene and cannot be viewed.'));
          }
          resolve(scene);
        },
        undefined,
        reject,
      );
    });
  }
}