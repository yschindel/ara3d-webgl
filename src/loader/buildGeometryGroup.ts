import * as THREE from 'three';
import { BimGeometry } from './bimGeometry';

export function buildGeometryGroup(bim: BimGeometry): THREE.Group 
{
  console.time("Creating geometry group");
  const root = new THREE.Group();

  const vertexCount = bim.VertexX.length;
  const indexCount = bim.IndexBuffer.length;
  const meshCount = bim.MeshVertexOffset.length;
  const matCount = bim.MaterialRed.length;
  const elementCount = bim.ElementMeshIndex.length;
  const transformCount = bim.TransformTX.length;

  console.log({ vertexCount, indexCount, meshCount, matCount, elementCount, transformCount });

  const transformMatrices = computeTransforms(bim);
  const meshGeometries = computeMeshGeometries(bim);
  const materials = computeMaterials(bim);

  // ---------- Group elements by (meshIndex, materialIndex) ----------
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

  // ---------- Prepare static merge data (singletons) ----------
  type StaticEntry = {
    geom: THREE.BufferGeometry;
    transformIndex: number;
    entityIndex: number;
    meshIndex: number;
  };

  // materialIndex -> static entries
  const staticByMaterial = new Map<number, StaticEntry[]>();

  // ---------- Create instanced meshes and collect static entries ----------
  console.time('Creating instanced meshes');

  for (const [, bucket] of buckets) {
    const { meshIndex, materialIndex, elementIndices } = bucket;
    const geom = meshGeometries[meshIndex];
    if (!geom) continue;

    const material = materials[materialIndex];
    const count = elementIndices.length;

    if (count === 1) {
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

    const instanced = new THREE.InstancedMesh(geom, material, count);
    instanced.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    for (let i = 0; i < count; i++) {
      const ei = elementIndices[i];
      const ti = bim.ElementTransformIndex[ei];
      instanced.setMatrixAt(i, transformMatrices[ti]);
    }

    (instanced.userData as any).meshIndex = meshIndex;
    (instanced.userData as any).materialIndex = materialIndex;
    instanced.frustumCulled = false;
    instanced.matrixAutoUpdate = false;
    instanced.matrixWorldNeedsUpdate = false;
    root.add(instanced);
  }

  console.timeEnd('Creating instanced meshes');

  console.time('Merging static meshes by material');
  const identity = new THREE.Matrix4();
  for (const [materialIndex, entries] of staticByMaterial) 
  {
    if (entries.length === 0) 
      continue;

    if (entries.length === 1)
    {
      console.log("Single mesh");
      const { geom, transformIndex } = entries[0];
      const matrix = transformMatrices[transformIndex];
      const material = materials[materialIndex];
      const mesh = new THREE.Mesh(geom, material);
      mesh.matrixWorld = matrix;
      root.add(matrix);
      continue;
    }

    const material = materials[materialIndex];
    const geomsToMerge: THREE.BufferGeometry[] = [];
    for (const entry of entries) {
      const { geom, transformIndex } = entry;
      const m = transformMatrices[transformIndex];
      if (!m.equals(identity)) 
        geom.applyMatrix4(m);
      geomsToMerge.push(geom);
    }

    const mergedGeometry = mergeGeometries(geomsToMerge);
    const mergedMesh = new THREE.Mesh(mergedGeometry, material);
    mergedMesh.name = `MergedStatic_Material_${materialIndex}`;
    root.add(mergedMesh);
  }

  console.timeEnd('Merging static meshes by material');

  // Convert Z-Up to Y-Up 
  root.rotation.x = -Math.PI / 2;

  console.timeEnd("Creating geometry group");
  return root;
}

export function computeTransforms(bim: BimGeometry)
{
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

  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpScale = new THREE.Vector3();
  const transformCount = TransformTX.length;
    
  const matrices = new Array(transformCount);
  
  for (let ti = 0; ti < transformCount; ti++) 
  {
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
  
    matrices[ti] = m;
  }
  return matrices;
}

export function mergeGeometries(
  geometries: Array<THREE.BufferGeometry>
): THREE.BufferGeometry 
{
  // First pass: count total vertices and indices
  let indexCount = 0;
  let posCount = 0;

  for (let i = 0, l = geometries.length; i < l; i++) {
    const geometry = geometries[i];

    const index = geometry.getIndex();
    const position = geometry.getAttribute('position');

    if (!index) throw new Error('mergeGeometries: geometry has no index buffer');
    if (!position) throw new Error('mergeGeometries: geometry has no position attribute');

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

    const srcPosArray = posAttr.array as Float32Array;
    const srcIndexArray = indexAttr.array as Int32Array;

    const vertCount = posAttr.count;
    const idxCount = indexAttr.count;

    const posItemSize = posAttr.itemSize; // usually 3

    // --- Copy positions ---
    // We only copy the used segment (0..vertCount*itemSize)
    const srcPosLength = vertCount * posItemSize;
    const dstPosOffset = vertexOffset * posItemSize;
    mergedPositions.set(srcPosArray.subarray(0, srcPosLength), dstPosOffset);

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

function computeMeshGeometries(bim: BimGeometry): Array<THREE.BufferGeometry>
{
  const meshCount = bim.MeshVertexOffset.length;
  const indexCount = bim.IndexBuffer.length;
  const vertexCount = bim.VertexX.length;
  const meshGeometries: Array<THREE.BufferGeometry> = new Array(meshCount);

  const {
    VertexX,
    VertexY,
    VertexZ,
    IndexBuffer,
    MeshVertexOffset,
    MeshIndexOffset,
  } = bim;

  for (let mi = 0; mi < meshCount; mi++) 
  {
    const iStart = MeshIndexOffset[mi];
    const iEnd = mi + 1 < meshCount ? MeshIndexOffset[mi + 1] : indexCount;
    const iCount = iEnd - iStart;

    const vStart = MeshVertexOffset[mi];
    const vEnd = mi + 1 < meshCount ? MeshVertexOffset[mi + 1] : vertexCount;
    const vCount = vEnd - vStart;

    if (iCount === 0 || vCount === 0) continue;

    const indexArray = IndexBuffer.subarray(iStart, iEnd);

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

  return meshGeometries;
}

function computeMaterials(bim: BimGeometry): Array<THREE.MeshStandardMaterial>
{
  const numMaterials = bim.MaterialAlpha.length;
  const materials = new Array(numMaterials);

  for (let mi=0; mi < numMaterials; mi++)
  {
    const r = bim.MaterialRed[mi] / 255;
    const g = bim.MaterialGreen[mi] / 255;
    const b = bim.MaterialBlue[mi] / 255;
    const a = bim.MaterialAlpha[mi]  / 255;
    const roughness = bim.MaterialRoughness[mi] / 255;
    const metalness = bim.MaterialMetallic[mi] / 255;

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(r, g, b),
      opacity: a,
      flatShading: true,
      transparent: a < 0.999,
      roughness,
      metalness,
      side: THREE.DoubleSide,
    });

    materials[mi] = mat;
  }
  return materials;
}