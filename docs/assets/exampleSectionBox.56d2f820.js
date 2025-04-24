import { V as Viewer, d as VimLoader } from "./GLTFLoader.19be2259.js";
async function runExample() {
  const viewer = new Viewer();
  const loader = new VimLoader();
  const vim = await loader.load("/ara3d-webgl/residence.vim", console);
  viewer.add(vim);
  viewer.sectionBox.clip = true;
  viewer.sectionBox.interactive = true;
  viewer.sectionBox.visible = true;
  const vimObjects = [
    ...vim.getObjectsFromElementId(183470),
    ...vim.getObjectsFromElementId(201739)
  ];
  viewer.selection.select(vimObjects);
  const bbox = viewer.selection.getBoundingBox();
  viewer.sectionBox.fitBox(bbox);
  viewer.selection.clear();
}
runExample();
//# sourceMappingURL=exampleSectionBox.56d2f820.js.map
