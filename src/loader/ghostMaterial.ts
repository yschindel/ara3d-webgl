import * as THREE from 'three';

/**
 * Creates a material that supports per-instance opacity via instanceOpacity attribute.
 * This allows ghosting individual instances within an InstancedMesh.
 */
export function createGhostableMaterial(baseMaterial: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const mat = baseMaterial.clone();
  mat.transparent = true;
  
  mat.onBeforeCompile = (shader) => {
    // Add attribute and varying for instance opacity in vertex shader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
       attribute float instanceOpacity;
       varying float vInstanceOpacity;`
    );
    
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vInstanceOpacity = instanceOpacity;`
    );
    
    // Add varying in fragment shader and multiply alpha
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
       varying float vInstanceOpacity;`
    );
    
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
       gl_FragColor.a *= vInstanceOpacity;`
    );
  };
  
  return mat;
}

