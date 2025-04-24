import { V as Viewer, n as Vector3, d as VimLoader } from "./GLTFLoader.19be2259.js";
async function runExample() {
  const viewer = new Viewer();
  const loader = new VimLoader();
  viewer.add(await loader.load("/ara3d-webgl/residence.vim", console, { position: new Vector3(-50, 0, -50) }));
  viewer.add(await loader.load("/ara3d-webgl/residence.vim", console, { position: new Vector3(-50, 0, 50) }));
  viewer.add(await loader.load("/ara3d-webgl/residence.vim", console, { position: new Vector3(50, 0, -50) }));
  viewer.add(await loader.load("/ara3d-webgl/residence.vim", console, { position: new Vector3(50, 0, 50) }));
}
runExample();
//# sourceMappingURL=exampleMultiVim.140f7de9.js.map
