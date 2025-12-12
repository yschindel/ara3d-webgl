export interface BimGeometry 
{
  //========================================
  // Elements table
  //========================================
  
  // Index of the entity associated with each element. Used for looking up meta data. 
  ElementEntityIndex: Int32Array;

  // Indedx of the material associated with each element. 
  ElementMaterialIndex: Int32Array;

  // Index of the mesh associated with each element
  ElementMeshIndex: Int32Array;

  // Index of the transform associated with each element
  ElementTransformIndex: Int32Array;

  //========================================
  // VertexBuffer table
  //========================================
  
  // X values (multiplied by 10,000) in each mesh's local space
  VertexX: Int32Array;

  // Y values (multiplied by 10,000) in each mesh's local space
  VertexY: Int32Array;
  
  // Z values (multiplied by 10,000) in each mesh's local space
  VertexZ: Int32Array;

  //========================================
  // IndexBuffer table
  //========================================
  
  // Each index is local to the corresponding mesh. 
  IndexBuffer: Int32Array;

  //========================================
  // Mesh table
  //========================================
  
  // This offset is added to index to get the actual vertex in the global vertex   
  MeshVertexOffset: Int32Array;

  // The starting index within the index buffer of the current mesh.
  // The number of indices used is defined by subtracting it from the next mesh's starting index
  MeshIndexOffset: Int32Array;

  //========================================
  // Material table (bytes 0–255)
  //========================================
  
  MaterialRed: Uint8Array;
  MaterialGreen: Uint8Array;
  MaterialBlue: Uint8Array;
  MaterialAlpha: Uint8Array;
  MaterialRoughness: Uint8Array;
  MaterialMetallic: Uint8Array;

  //========================================
  // Transform table
  //========================================
  
  TransformTX: Float32Array;
  TransformTY: Float32Array;
  TransformTZ: Float32Array;
  TransformQX: Float32Array;
  TransformQY: Float32Array;
  TransformQZ: Float32Array;
  TransformQW: Float32Array;
  TransformSX: Float32Array;
  TransformSY: Float32Array;
  TransformSZ: Float32Array;
}