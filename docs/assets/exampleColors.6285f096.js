import { V as Viewer, C as Color, d as VimLoader } from "./GLTFLoader.19be2259.js";
async function runExample() {
  const viewer = new Viewer();
  const loader = new VimLoader();
  const vim = await loader.load("/ara3d-webgl/residence.vim", console);
  viewer.add(vim);
  const all = [...vim.getAllObjects()].filter((o) => o.hasMesh);
  const pos = all.map((o) => o.getCenter());
  const minX = Math.min(...pos.map((p) => p.x));
  const minY = Math.min(...pos.map((p) => p.y));
  const minZ = Math.min(...pos.map((p) => p.z));
  const maxX = Math.max(...pos.map((p) => p.x));
  const maxY = Math.max(...pos.map((p) => p.y));
  const maxZ = Math.max(...pos.map((p) => p.z));
  for (let i = 0; i < all.length; i++) {
    all[i].color = new Color(
      (pos[i].x - minX) / (maxX - minX),
      (pos[i].y - minY) / (maxY - minY),
      (pos[i].z - minZ) / (maxZ - minZ)
    );
  }
}
runExample();
//# sourceMappingURL=exampleColors.6285f096.js.map
