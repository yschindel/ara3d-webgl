import * as THREE from 'three';
import { BimGeometry } from './bimGeometry'; 
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function buildGeometryGroup(bim: BimGeometry): THREE.Group 
{
    const root = new THREE.Group();

    const vertexCount = bim.VertexX.length;
    const indexCount = bim.IndexBuffer.length;
    const meshCount = bim.MeshVertexOffset.length;
    const matCount = bim.MaterialRed.length;
    const elementCount = bim.ElementMeshIndex.length;
    const transformCount = bim.TransformTX.length;

    console.log({ vertexCount, indexCount, meshCount, matCount, elementCount, transformCount });

    const transformMatrices = new Array(transformCount);
    
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

    function computeTransforms() 
    {
        const identity = new THREE.Matrix4;
        const tmpPos = new THREE.Vector3;
        const tmpQuat = new THREE.Quaternion;
        const tmpScale = new THREE.Vector3;
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

            const isIdentity =
                tx === 0 && ty === 0 && tz === 0 &&
                sx === 1 && sy === 1 && sz === 1 &&
                qx === 0 && qy === 0 && qz === 0 && qw === 1;    

            const m = new THREE.Matrix4();
            if (!isIdentity) 
            {
                tmpPos.set(tx, ty, tz);
                tmpQuat.set(qx, qy, qz, qw);
                tmpScale.set(sx, sy, sz);
                m.compose(tmpPos, tmpQuat, tmpScale);
            }
            
            transformMatrices[ti] = m; 
        }
    }

    console.log("Computing transforms");
    computeTransforms();

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
        
    console.log("Creating mesh geometries");
    for (let mi = 0; mi < meshCount; mi++) 
    {
        const iStart = MeshIndexOffset[mi];
        const iEnd = mi + 1 < meshCount ? MeshIndexOffset[mi + 1] : indexCount;
        const iCount = iEnd - iStart;

        const vStart = MeshVertexOffset[mi];
        const vEnd = mi + 1 < meshCount ? MeshVertexOffset[mi + 1] : vertexCount;
        const vCount = vEnd - vStart;

        if (iCount == 0 || vCount == 0)
            continue;

        // Localized indices for this mesh
        const indexArray = new Uint32Array(iCount);
        for (let ii = 0; ii < iCount; ii++) {
            indexArray[ii] = IndexBuffer[ii + iStart];
        }

        // Build a per-mesh local position buffer
        const positionArray = new Float32Array(vCount * 3);
        for (let vi = 0; vi < vCount; vi++) {
            positionArray[vi * 3 + 0] = VertexX[vi + vStart];
            positionArray[vi * 3 + 1] = VertexY[vi + vStart];
            positionArray[vi * 3 + 2] = VertexZ[vi + vStart];
        }

        const posBuffer = new THREE.BufferAttribute(positionArray, 3);
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', posBuffer);
        geom.setIndex(new THREE.BufferAttribute(indexArray, 1));
        meshGeometries[mi] = geom;
    }

    console.log("Creating materials");
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
            side: THREE.FrontSide,
            });

        mat.needsUpdate = true;
        materialCache[mi] = mat;
        return mat;
    }

    console.log("Grouping elements by meshIndex, materialIndex");
    type Bucket = {
        meshIndex: number;
        materialIndex: number;
        transformIndex: number;
        elementIndices: number[];
    };

    const buckets = new Map<string, Bucket>();

    for (let ei = 0; ei < elementCount; ei++) {
        const meshIndex = bim.ElementMeshIndex[ei];
        const materialIndex = bim.ElementMaterialIndex[ei];
        const transformIndex = bim.ElementTransformIndex[ei];

        // Skip invalid indices
        if (meshIndex < 0 || meshIndex >= meshCount) continue;
        if (materialIndex < 0 || materialIndex >= matCount) continue;
        if (!meshGeometries[meshIndex]) continue;

        const key = `${meshIndex}|${materialIndex}`;
        let bucket = buckets.get(key);
        if (!bucket) {
        bucket = { meshIndex, materialIndex, transformIndex, elementIndices: [] };
            buckets.set(key, bucket);
        }
        bucket.elementIndices.push(ei);
    }

    console.log("Creating instanced meshes");
        
    for (const [, bucket] of buckets) {
        const { meshIndex, materialIndex, elementIndices } = bucket;

        const geom = meshGeometries[meshIndex];
        if (!geom) continue;

        const material = getMaterial(materialIndex);
        const count = elementIndices.length;

        if (count === 1) 
        {
            const ei = elementIndices[0];
            const ti = bim.ElementTransformIndex[ei];
            const matrix = transformMatrices[ti];
            const mesh = new THREE.Mesh(geom, material);
            mesh.applyMatrix4(matrix);
            (mesh.userData as any).entityIndex = bim.ElementEntityIndex[ei] ?? -1;
            (mesh.userData as any).meshIndex = meshIndex;
            (mesh.userData as any).materialIndex = materialIndex;
            root.add(mesh);
            continue;
        }

        const instanced = new THREE.InstancedMesh(geom, material, count);
        instanced.instanceMatrix.setUsage(THREE.StaticDrawUsage);

        for (let i = 0; i < count; i++) {
            const ei = elementIndices[i];
            const ti = bim.ElementTransformIndex[ei];
            const matrix = new THREE.Matrix4().copy(transformMatrices[ti]);        
            instanced.setMatrixAt(i, matrix);
        }

        instanced.instanceMatrix.needsUpdate = true;
        (instanced.userData as any).meshIndex = meshIndex;
        (instanced.userData as any).materialIndex = materialIndex;

        root.add(instanced);
    }

    console.log("Converting Z-up to Y-up");
    root.rotation.x = -Math.PI / 2;

    console.log("Merging non-instanced meshes by material");
    mergeStaticMeshesByMaterial(root);

    console.log("Completed creating group");
    return root;
}

/**
 * Merge non-instanced THREE.Mesh children of `root` that share exactly
 * the same material instance into larger static meshes.
 *
 * - Skips InstancedMesh.
 * - Skips meshes with multi-materials (material is an array).
 * - Skips meshes with userData.noMerge === true.
 *
 * Result: fewer draw calls & less scene graph overhead for static geometry.
 */
export function mergeStaticMeshesByMaterial(root: THREE.Group): void {
    // Ensure world matrices are valid
    root.updateWorldMatrix(true, true);

    type MaterialGroup = {
        material: THREE.Material;
        meshes: THREE.Mesh[];
    };

    const groups = new Map<string, MaterialGroup>();

    // Collect candidate meshes
    root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;

        // Only plain Mesh, not InstancedMesh
        if (!(mesh as any).isMesh || (mesh as any).isInstancedMesh) return;
        if (!mesh.geometry) return;
        if (Array.isArray(mesh.material)) return; // skip multi-materials
        if (mesh.userData?.noMerge) return;       // user opt-out

        const material = mesh.material as THREE.Material;
        const key = material.uuid;

        let group = groups.get(key);
        if (!group) {
            group = { material, meshes: [] };
            groups.set(key, group);
        }

        group.meshes.push(mesh);
    });

    if (groups.size === 0) 
        return;

    const rootWorldMatrix = new THREE.Matrix4().copy(root.matrixWorld);
    const rootWorldMatrixInv = new THREE.Matrix4().copy(rootWorldMatrix).invert();
    const meshesToRemove: THREE.Object3D[] = [];

    for (const [, group] of groups) {
        const { material, meshes } = group;

    if (meshes.length <= 1) {
        // Nothing to merge for this material
        continue;
    }

    const geometries: THREE.BufferGeometry[] = [];

    for (const mesh of meshes) {
        const geom = mesh.geometry as THREE.BufferGeometry;
        const cloned = geom.clone();

        // Bring geometry into root-local space
        const worldMatrix = new THREE.Matrix4().copy(mesh.matrixWorld);
        worldMatrix.premultiply(rootWorldMatrixInv);
        cloned.applyMatrix4(worldMatrix);

        geometries.push(cloned);
        meshesToRemove.push(mesh);
    }

    const mergedGeometry = mergeBufferGeometries(geometries, false);
    if (!mergedGeometry) continue;

    mergedGeometry.computeBoundingSphere();
    mergedGeometry.computeBoundingBox();

    const mergedMesh = new THREE.Mesh(mergedGeometry, material);
    mergedMesh.name = `Merged_${material.uuid}`;
    root.add(mergedMesh);
    } 

    // Remove originals after we’re done traversing
    for (const m of meshesToRemove) {
        if (m.parent) {
            m.parent.remove(m);
        }
    }
}
