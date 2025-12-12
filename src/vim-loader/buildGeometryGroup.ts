import * as THREE from 'three';
import { BimGeometry } from './bimGeometry';

export function buildGeometryGroup(bim: BimGeometry): THREE.Group {
  const root = new THREE.Group();

  const vertexCount = bim.VertexX.length;
  const indexCount = bim.IndexBuffer.length;
  const meshCount = bim.MeshVertexOffset.length;
  const matCount = bim.MaterialRed.length;
  const elementCount = bim.ElementMeshIndex.length;
  const transformCount = bim.TransformTX.length;

  console.log({ vertexCount, indexCount, meshCount, matCount, elementCount, transformCount });

  // ---------- 1. Precompute transforms ----------
  const transformMatrices = new Array<THREE.Matrix4>(transformCount);

  const {
    TransformTX,
    TransformTY,
    TransformTZ,
    TransformQX,
    TransformQY,
    TransformQZ,
    TransformQW,
    TransformSX,
    TransformSY,
    TransformSZ,
  } = bim;

  console.time('Computing transforms');
  {
    const tmpPos = new THREE.Vector3();
    const tmpQuat = new THREE.Quaternion();
    const tmpScale = new THREE.Vector3();

    for (let ti = 0; ti < transformCount; ti++) {
      const tx = TransformTX[ti];
      const ty = TransformTY[ti];
      const tz = TransformTZ[ti];
      const sx = TransformSX[ti];
      const sy = TransformSY[ti];
      const sz = TransformSZ[ti];
      const qx = TransformQX[ti];
      const qy = TransformQY[ti];
      const qz = TransformQZ[ti];
      const qw = TransformQW[ti];

      const m = new THREE.Matrix4();
      tmpPos.set(tx, ty, tz);
      tmpQuat.set(qx, qy, qz, qw);
      tmpScale.set(sx, sy, sz);
      m.compose(tmpPos, tmpQuat, tmpScale);
    
      transformMatrices[ti] = m;
    }
  }
  console.timeEnd('Computing transforms');

  // ---------- 2. Build per-mesh BufferGeometries ----------
  const meshGeometries: Array<THREE.BufferGeometry | undefined> =
    new Array(meshCount);

  const {
    VertexX,
    VertexY,
    VertexZ,
    IndexBuffer,
    MeshVertexOffset,
    MeshIndexOffset,
  } = bim;

  console.time('Creating mesh geometries');
  for (let mi = 0; mi < meshCount; mi++) {
    const iStart = MeshIndexOffset[mi];
    const iEnd = mi + 1 < meshCount ? MeshIndexOffset[mi + 1] : indexCount;
    const iCount = iEnd - iStart;

    const vStart = MeshVertexOffset[mi];
    const vEnd = mi + 1 < meshCount ? MeshVertexOffset[mi + 1] : vertexCount;
    const vCount = vEnd - vStart;

    if (iCount === 0 || vCount === 0) continue;

    const indexArray = new Uint32Array(iCount);
    for (let ii = 0; ii < iCount; ii++) {
      indexArray[ii] = IndexBuffer[ii + iStart];
    }

    const vertexMultiplier = 10_000.0;
    const positionArray = new Float32Array(vCount * 3);
    for (let vi = 0; vi < vCount; vi++) {
      positionArray[vi*3+0] = VertexX[vi + vStart] / vertexMultiplier;
      positionArray[vi*3+1] = VertexY[vi + vStart] / vertexMultiplier;
      positionArray[vi*3+2] = VertexZ[vi + vStart] / vertexMultiplier;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
    geom.setIndex(new THREE.BufferAttribute(indexArray, 1));

    meshGeometries[mi] = geom;
  }
  console.timeEnd('Creating mesh geometries');

  // ---------- 3. Material cache ----------
  const materialCache: Array<THREE.MeshStandardMaterial | undefined> =
    new Array(matCount);

  function getMaterial(mi: number): THREE.MeshStandardMaterial {
    const cached = materialCache[mi];
    if (cached) return cached;

    const r = (bim.MaterialRed[mi] ?? 255) / 255;
    const g = (bim.MaterialGreen[mi] ?? 255) / 255;
    const b = (bim.MaterialBlue[mi] ?? 255) / 255;
    const a = (bim.MaterialAlpha[mi] ?? 255) / 255;
    const roughness = (bim.MaterialRoughness[mi] ?? 128) / 255;
    const metalness = (bim.MaterialMetallic[mi] ?? 0) / 255;

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(r, g, b),
      opacity: a,
      flatShading: true,
      transparent: a < 0.999,
      roughness,
      metalness,
      side: THREE.DoubleSide,
    });

    mat.needsUpdate = true;
    materialCache[mi] = mat;
    return mat;
  }

  // ---------- 4. Group elements by (meshIndex, materialIndex) ----------
  console.time('Grouping elements');
  type Bucket = {
    meshIndex: number;
    materialIndex: number;
    elementIndices: number[];
  };

  const buckets = new Map<string, Bucket>();

  for (let ei = 0; ei < elementCount; ei++) {
    const meshIndex = bim.ElementMeshIndex[ei];
    const materialIndex = bim.ElementMaterialIndex[ei];

    if (meshIndex < 0 || meshIndex >= meshCount) continue;
    if (materialIndex < 0 || materialIndex >= matCount) continue;
    if (!meshGeometries[meshIndex]) continue;

    const key = `${meshIndex}|${materialIndex}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { meshIndex, materialIndex, elementIndices: [] };
      buckets.set(key, bucket);
    }
    bucket.elementIndices.push(ei);
  }
  console.timeEnd('Grouping elements');

  // ---------- 5. Prepare static merge data (singletons) ----------
  type StaticEntry = {
    geom: THREE.BufferGeometry;
    transformIndex: number;
    entityIndex: number;
    meshIndex: number;
  };

  // materialIndex -> static entries
  const staticByMaterial = new Map<number, StaticEntry[]>();

  // ---------- 6. Create instanced meshes, collect static entries ----------
  console.time('Creating instanced meshes');

  for (const [, bucket] of buckets) {
    const { meshIndex, materialIndex, elementIndices } = bucket;
    const geom = meshGeometries[meshIndex];
    if (!geom) continue;

    const material = getMaterial(materialIndex);
    const count = elementIndices.length;

    if (count === 1) {
      // Defer creating Mesh; just record for merging
      const ei = elementIndices[0];
      const ti = bim.ElementTransformIndex[ei];
      const entityIndex = bim.ElementEntityIndex[ei] ?? -1;

      let list = staticByMaterial.get(materialIndex);
      if (!list) {
        list = [];
        staticByMaterial.set(materialIndex, list);
      }

      list.push({
        geom,
        transformIndex: ti,
        entityIndex,
        meshIndex,
      });

      continue;
    }

    // Multi-instance: InstancedMesh as before
    const instanced = new THREE.InstancedMesh(geom, material, count);
    instanced.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    for (let i = 0; i < count; i++) {
      const ei = elementIndices[i];
      const ti = bim.ElementTransformIndex[ei];
      instanced.setMatrixAt(i, transformMatrices[ti]);
    }

    instanced.instanceMatrix.needsUpdate = true;
    (instanced.userData as any).meshIndex = meshIndex;
    (instanced.userData as any).materialIndex = materialIndex;

    root.add(instanced);
  }

  console.timeEnd('Creating instanced meshes');

  // ---------- 7. Merge static (singleton) meshes per material, off-scene ----------
  console.time('Merging static meshes by material');

  const identity = new THREE.Matrix4();

  for (const [materialIndex, entries] of staticByMaterial) 
  {
    if (entries.length === 0) continue;

    const material = getMaterial(materialIndex);

    const geomsToMerge: THREE.BufferGeometry[] = [];

    for (const entry of entries) {
      const { geom, transformIndex } = entry;
      const m = transformMatrices[transformIndex];

      // Clone geometry and bake transform into positions
      const cloned = geom.clone();
      if (!m.equals(identity)) {
        cloned.applyMatrix4(m);
      }
      geomsToMerge.push(cloned);
    }

    if (geomsToMerge.length === 0) continue;

    const mergedGeometry = mergeGeometries(geomsToMerge);
    const mergedMesh = new THREE.Mesh(mergedGeometry, material);
    mergedMesh.name = `MergedStatic_Material_${materialIndex}`;

    // If you want per-element picking for static geometry,
    // you can store a parallel array of entity indices here in userData.

    root.add(mergedMesh);
  }

  console.timeEnd('Merging static meshes by material');

  // ---------- 8. Final orientation ----------
  console.log('Converting Z-up to Y-up');
  root.rotation.x = -Math.PI / 2;

  console.log('Completed creating group');
  return root;
}


export function mergeGeometries(
  geometries: Array<THREE.BufferGeometry>
): THREE.BufferGeometry {
  // First pass: count total vertices and indices
  let indexCount = 0;
  let posCount = 0;

  for (let i = 0, l = geometries.length; i < l; i++) {
    const geometry = geometries[i];

    const index = geometry.getIndex();
    const position = geometry.getAttribute('position');

    if (!index) {
      throw new Error('mergeGeometries: geometry has no index buffer');
    }
    if (!position) {
      throw new Error('mergeGeometries: geometry has no position attribute');
    }

    indexCount += index.count;
    posCount += position.count;
  }

  // Allocate merged buffers
  // Assuming positions are vec3 (itemSize = 3)
  const mergedPositions = new Float32Array(posCount * 3);
  const mergedIndices = new Uint32Array(indexCount);

  let indexOffset = 0;      // how many indices we've already written
  let vertexOffset = 0;     // how many vertices we've already written

  // Second pass: copy data
  for (let i = 0, l = geometries.length; i < l; i++) {
    const geometry = geometries[i];

    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const indexAttr = geometry.getIndex() as THREE.BufferAttribute;

    const srcPosArray = posAttr.array as Float32Array | ArrayLike<number>;
    const srcIndexArray = indexAttr.array as Uint16Array | Uint32Array;

    const vertCount = posAttr.count;
    const idxCount = indexAttr.count;

    const posItemSize = posAttr.itemSize; // usually 3

    // --- Copy positions ---
    // We only copy the used segment (0..vertCount*itemSize)
    const srcPosLength = vertCount * posItemSize;
    const dstPosOffset = vertexOffset * posItemSize;

    if ((srcPosArray as any).subarray) {
      // Fast path for typed arrays
      mergedPositions.set(
        (srcPosArray as any).subarray(0, srcPosLength),
        dstPosOffset
      );
    } else {
      // Fallback (rare)
      for (let j = 0; j < srcPosLength; j++) {
        mergedPositions[dstPosOffset + j] = srcPosArray[j];
      }
    }

    // --- Copy indices, with vertex offset ---
    for (let j = 0; j < idxCount; j++) {
      mergedIndices[indexOffset + j] = srcIndexArray[j] + vertexOffset;
    }

    vertexOffset += vertCount;
    indexOffset += idxCount;
  }

  // Build merged geometry
  const mergedGeom = new THREE.BufferGeometry();
  mergedGeom.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3));
  mergedGeom.setIndex(new THREE.BufferAttribute(mergedIndices, 1));

  return mergedGeom;
}
