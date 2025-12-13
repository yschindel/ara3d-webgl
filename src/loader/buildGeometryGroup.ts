import * as THREE from 'three';
import { BimGeometry } from './bimGeometry';

type InstanceGroup = {
  meshIndex: number;
  materialIndex: number;
  instanceIndices: number[];
};

export function buildGeometry(bim: BimGeometry): THREE.Group 
{
  console.time("Building geometry");
  const root = new THREE.Group();

  const vertexCount = bim.VertexX.length;
  const indexCount = bim.IndexBuffer.length;
  const meshCount = bim.MeshVertexOffset.length;
  const materialCount = bim.MaterialRed.length;
  const instanceCount = bim.InstanceMeshIndex.length;
  const transformCount = bim.TransformTX.length;

  console.log({ vertexCount, indexCount, meshCount, materialCount, instanceCount, transformCount });

  const transforms = computeTransforms(bim);
  const geometries = computeMeshGeometries(bim);
  const materials = computeMaterials(bim);
  const instanceGroups = groupInstances(bim);
  console.log("Created %d instance groups", instanceGroups.length)
  const materialGroups = gatherSingleInstancesByMaterial(instanceGroups);
  console.log("Created %d material groups", Array.from(materialGroups.keys()).length);
  const instancedMeshes = createInstances(bim, geometries, materials, transforms, instanceGroups);
  console.log("Created %d instanced meshes", instancedMeshes.length);
  const nonInstancedMeshes = createMergedAndSingleMeshes(bim, geometries, materials, transforms, materialGroups); 
  console.log("Create %d merged meshes", nonInstancedMeshes.length);

  let polyCount = 0;
  for (const im of instancedMeshes)
  {
    polyCount += (im.geometry.index.count / 3) * im.count; 
    root.add(im);
  }

  for (const nim of nonInstancedMeshes)
  {
    polyCount += nim.geometry.index.count / 3; 
    root.add(nim);
  }

  console.log("Total polygon count = %d", polyCount);

  // Convert Z-Up to Y-Up 
  root.rotation.x = -Math.PI / 2;

  console.timeEnd("Building geometry");
  return root;
}

export function createMergedAndSingleMeshes(
  bim: BimGeometry, 
  geometries: Array<THREE.BufferGeometry>, 
  materials: Array<THREE.Material>, 
  transforms: Array<THREE.Matrix4>, 
  materialGroups: Map<number, number[]>)
  : Array<THREE.Mesh>
{
  const identity = new THREE.Matrix4();
  const r: THREE.Mesh[] = [];
  
  for (const [materialIndex, entries] of materialGroups) 
  {
    if (!entries || entries.length === 0) 
      continue;

    const material = materials[materialIndex];

    if (entries.length === 1) {
      const ii = entries[0];
      const meshIndex = bim.InstanceMeshIndex[ii];
      const transformIndex = bim.InstanceTransformIndex[ii];
      const geom = geometries[meshIndex];
      const matrix = transforms[transformIndex];
      const mesh = new THREE.Mesh(geom, material);
      mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(matrix); 
      r.push(mesh);
      continue;
    }

    const geomsToMerge: THREE.BufferGeometry[] = [];

    for (const ii of entries) {
      const meshIndex = bim.InstanceMeshIndex[ii];
      const transformIndex = bim.InstanceTransformIndex[ii];
      const geom = geometries[meshIndex];
      const matrix = transforms[transformIndex];
      if (!matrix.equals(identity)) {
        geom.applyMatrix4(matrix);
      }
      geomsToMerge.push(geom);
    }

    const mergedGeometry = mergeGeometries(geomsToMerge);
    const mergedMesh = new THREE.Mesh(mergedGeometry, material);
    mergedMesh.name = `MergedStatic_Material_${materialIndex}`;
    r.push(mergedMesh);
  }

  return r;
}

export function computeTransforms(bim: BimGeometry)
{
  const {
    TransformTX, TransformTY, TransformTZ,
    TransformQX, TransformQY, TransformQZ, TransformQW,
    TransformSX, TransformSY, TransformSZ,
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
    indexCount += index.count;
    posCount += position.count;
  }

  // Allocated data structures 
  const mergedPositions = new Float32Array(posCount * 3);
  const mergedIndices = new Uint32Array(indexCount);

  let indexOffset = 0;      
  let vertexOffset = 0;

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

function groupInstances(bim: BimGeometry): Array<InstanceGroup>
{
  const instanceCount = bim.InstanceEntityIndex.length;
  const instanceGroupMap = new Map<string, InstanceGroup>();
  for (let ii = 0; ii < instanceCount; ii++) {
    const meshIndex = bim.InstanceMeshIndex[ii];
    const materialIndex = bim.InstanceMaterialIndex[ii];
    const key = `${meshIndex}|${materialIndex}`;
    let group = instanceGroupMap.get(key);
    if (!group) {
      group = { meshIndex, materialIndex, instanceIndices: [ii] };
      instanceGroupMap.set(key, group);
    }
    else {
      group.instanceIndices.push(ii);
    }
  }
  return Array.from(instanceGroupMap.values());
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

export function gatherSingleInstancesByMaterial(instanceGroups: Array<InstanceGroup>)
  : Map<number, number[]>
{
  const r = new Map<number, number[]>();
  for (const group of instanceGroups) {
    const { materialIndex, instanceIndices } = group;
    if (instanceIndices.length === 1) {
      const ei = instanceIndices[0];
      let list = r.get(materialIndex);
      if (!list) {
        list = [];
        r.set(materialIndex, list);
      }
      list.push(ei);
    }
  }
  return r;
}

export function createInstances(
  bim: BimGeometry, 
  geometries: Array<THREE.BufferGeometry>, 
  materials: Array<THREE.Material>, 
  transforms: Array<THREE.Matrix4>, 
  instanceGroups: Array<InstanceGroup>
)
    : Array<THREE.InstancedMesh>
{
  const r = new Array<THREE.InstancedMesh>();
  for (const group of instanceGroups) {
    const { meshIndex, materialIndex, instanceIndices } = group;
    const count = instanceIndices.length;
   
    if (count <= 1)
      continue;

    const geom = geometries[meshIndex];
    const material = materials[materialIndex];
 
    const instanced = new THREE.InstancedMesh(geom, material, count);
    instanced.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    for (let i = 0; i < count; i++) {
      const ei = instanceIndices[i];
      const ti = bim.InstanceTransformIndex[ei];
      instanced.setMatrixAt(i, transforms[ti]);
    }

    (instanced.userData as any).meshIndex = meshIndex;
    (instanced.userData as any).materialIndex = materialIndex;
    instanced.frustumCulled = false;
    instanced.matrixAutoUpdate = false;
    instanced.matrixWorldNeedsUpdate = false;
    r.push(instanced);
  }
  return r;
}