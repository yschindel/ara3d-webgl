import { m as GLTFLoader } from "./GLTFLoader.19be2259.js";
class GltfLoader {
  async load(source) {
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(
        source,
        (gltf) => {
          const scene = gltf.scene || gltf.scenes[0];
          if (!scene) {
            return reject(new Error("Model contains no scene and cannot be viewed."));
          }
          resolve(scene);
        },
        void 0,
        reject
      );
    });
  }
}
export {
  GltfLoader as G
};
//# sourceMappingURL=gltfLoader.698e660a.js.map
