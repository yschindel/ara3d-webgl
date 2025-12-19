import * as THREE from 'three';

type InstanceRef =
  | { kind: 'instanced'; mesh: THREE.InstancedMesh; subIndex: number }
  | { kind: 'mesh'; mesh: THREE.Mesh };

/**
 * Controller for ghosting/isolation of BIM elements by GlobalId.
 * Allows focusing on specific elements while ghosting all others.
 */
export class BimGhostController {
  private root: THREE.Group;
  private globalIdToEntityIndex: Map<string, number>;
  private entityToInstances: Map<number, InstanceRef[]>;

  constructor(root: THREE.Group) {
    this.root = root;
    this.globalIdToEntityIndex = (root.userData as any).globalIdToEntityIndex ?? new Map();
    this.entityToInstances = (root.userData as any).entityToInstances ?? new Map();
  }

  /**
   * Isolate elements: show these at full opacity, ghost everything else.
   * @param globalIds Array of GlobalIds to keep at full opacity
   * @param ghostOpacity Opacity for ghosted elements (default 0.1)
   */
  isolate(globalIds: string[], ghostOpacity = 0.1): void {
    const focusedEntities = new Set<number>();
    
    // Convert GlobalIds to EntityIndices
    for (const globalId of globalIds) {
      const entityIndex = this.globalIdToEntityIndex.get(globalId);
      if (entityIndex !== undefined) {
        focusedEntities.add(entityIndex);
      }
    }

    // Update all meshes
    this.root.traverse(obj => {
      if (obj instanceof THREE.InstancedMesh) {
        const entityIndices = (obj.userData as any).entityIndices as Int32Array | undefined;
        if (!entityIndices) return;

        const opacityAttr = obj.geometry.getAttribute('instanceOpacity') as THREE.InstancedBufferAttribute | null;
        if (!opacityAttr) return;

        for (let i = 0; i < entityIndices.length; i++) {
          const entityIndex = entityIndices[i];
          const opacity = focusedEntities.has(entityIndex) ? 1.0 : ghostOpacity;
          opacityAttr.setX(i, opacity);
        }
        opacityAttr.needsUpdate = true;
      } else if (obj instanceof THREE.Mesh) {
        const entityIndex = (obj.userData as any).entityIndex as number | undefined;
        if (entityIndex === undefined) return;

        const focused = focusedEntities.has(entityIndex);
        const material = obj.material as THREE.Material;
        material.opacity = focused ? 1.0 : ghostOpacity;
        material.transparent = true;
      }
    });
  }

  /**
   * Clear isolation: show all elements at full opacity.
   */
  clearIsolation(): void {
    this.root.traverse(obj => {
      if (obj instanceof THREE.InstancedMesh) {
        const opacityAttr = obj.geometry.getAttribute('instanceOpacity') as THREE.InstancedBufferAttribute | null;
        if (!opacityAttr) return;

        for (let i = 0; i < opacityAttr.count; i++) {
          opacityAttr.setX(i, 1.0);
        }
        opacityAttr.needsUpdate = true;
      } else if (obj instanceof THREE.Mesh) {
        const material = obj.material as THREE.Material;
        material.opacity = 1.0;
      }
    });
  }
}

