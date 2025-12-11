
export interface BimGeometry 
{
  // Elements table
  // Index of the entity associated with each element. Used for looking up meta data. 
  ElementEntityIndex: number[];
  // Indedx of the material associated with each element. 
  ElementMaterialIndex: number[];
  // Index of the mesh associated with each element
  ElementMeshIndex: number[];
  // Index of the transform associated with each element
  ElementTransformIndex: number[];

  // VertexBuffer table
  // X values of vertices in global data buffer
  VertexX: number[];
  // Y  values of vertices in global data buffer
  VertexY: number[];
  // Z values of vertices in global data buffer
  VertexZ: number[];

  // IndexBuffer table
  // Each index is local to the corresponding mesh. 
  IndexBuffer: number[];

  // Mesh table
  // This offset is added to index to get the actual vertex in the global vertex   
  MeshVertexOffset: number[];
  // The starting index within the index buffer of the current mesh.
  // The number of indices used is defined by subtracting it from the next mesh's starting index
  MeshIndexOffset: number[];

  // Material table (bytes 0–255)
  MaterialRed: number[];
  MaterialGreen: number[];
  MaterialBlue: number[];
  MaterialAlpha: number[];
  MaterialRoughness: number[];
  MaterialMetallic: number[];

  // Transform table
  TransformTX: number[];
  TransformTY: number[];
  TransformTZ: number[];
  TransformQX: number[];
  TransformQY: number[];
  TransformQZ: number[];
  TransformQW: number[];
  TransformSX: number[];
  TransformSY: number[];
  TransformSZ: number[];
}