import { V as Viewer, d as VimLoader } from "./GLTFLoader.19be2259.js";
async function runExample() {
  const viewer = new Viewer();
  const loader = new VimLoader();
  const vim = await loader.load("/ara3d-webgl/residence.vim", console);
  viewer.add(vim);
}
runExample();
//# sourceMappingURL=exampleBasic.e9a52653.js.map
