import * as THREE from "three";
import JSZip from "jszip";

import * as arrow from "apache-arrow";
import { BimGeometry } from "./bimGeometry";
import { buildGeometryGroup } from "./buildGeometryGroup";

 import { tableFromIPC } from "apache-arrow";
 import initWasm, {readParquet} from "parquet-wasm";
 

/**
 * Loader that takes a URL to a .ZIP or .BOS file containing BIM Open Schema geometry parquet tables.
 */
export class BimOpenSchemaLoader 
{
  async load(source: string): Promise<THREE.Group> {
    await initWasm();

    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch BOS from ${source}: ${response.status} ${response.statusText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    const bim = await loadBimGeometryFromZip(zip);
    return buildGeometryGroup(bim);
  }
}

type NumericTypedArray =
  | Float32Array
  | Float64Array
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array;

type NumericTypedArrayCtor<T extends NumericTypedArray = NumericTypedArray> = {
  new (length: number): T;
  new (data: ArrayLike<number>): T;
  BYTES_PER_ELEMENT: number;
};

/**
 * Reads the BOS parquet tables from a JSZip archive into a BimGeometry object.
 * Uses parquet-wasm to decode Parquet -> Arrow, then Apache Arrow JS to access columns.
 */
export async function loadBimGeometryFromZip(zip: JSZip): Promise<BimGeometry> {
  // --- helpers for reading parquet from ZIP ---

  function findFileEndingWith(suffix: string): string {
    const lowerSuffix = suffix.toLowerCase();
    const name = Object.keys(zip.files).find((n) =>
      n.toLowerCase().endsWith(lowerSuffix)
    );
    if (!name) throw new Error(`Could not find "${suffix}" in zip archive.`);
    return name;
  }

  function requireColumn<T extends NumericTypedArray>(
    table: any,
    columnName: string,
    ctor: NumericTypedArrayCtor<T>
  ): T {
    const vec = table.getChild(columnName);
    if (!vec) {
      const cols = table.schema.fields.map((f) => f.name).join(", ");
      throw new Error(`Missing column "${columnName}". Available: ${cols}`);
    }

    // For primitive numeric Arrow vectors, `toArray()` is typically a TypedArray.
    const arr = vec.toArray() as unknown;

    // If it's already the right typed array type, keep it.
    if (arr instanceof ctor) return arr as T;

    // Otherwise, copy/convert into the requested typed array.
    // (This is also a convenient place to handle cases like plain JS arrays.)
    return new ctor(arr as ArrayLike<number>);
  }

  async function readParquetTable(
    nameSuffix: string,
    assign: (table: any) => void
  ) {
    const entryName = findFileEndingWith(nameSuffix);

    // parquet-wasm expects Uint8Array
    const parquetBytes = new Uint8Array(
      await zip.files[entryName].async("arraybuffer")
    );

    // Decode Parquet -> Arrow Table (in WASM memory)
    const wasmTable = readParquet(parquetBytes);

    try {
      // Easiest transfer path: Arrow IPC stream -> Arrow JS Table
      const arrowTable = tableFromIPC(wasmTable.intoIPCStream());
      assign(arrowTable);
    } finally {
      // Free WASM-side table memory
      // (Method name depends on version; both are commonly available.)
      (wasmTable as any).free?.();
      (wasmTable as any).dispose?.();
    }
  }

  const bim: Partial<BimGeometry> = {};

  await readParquetTable("Elements.parquet", (t) => {
    bim.ElementEntityIndex = requireColumn(t, "ElementEntityIndex", Int32Array);
    bim.ElementMaterialIndex = requireColumn(t, "ElementMaterialIndex", Int32Array);
    bim.ElementMeshIndex = requireColumn(t, "ElementMeshIndex", Int32Array);
    bim.ElementTransformIndex = requireColumn(t, "ElementTransformIndex", Int32Array);
  });

  await readParquetTable("VertexBuffer.parquet", (t) => {
    bim.VertexBuffer = requireColumn(t, "VertexX", Float32Array);
    // add any other vertex columns you have...
  });

  await readParquetTable("IndexBuffer.parquet", (t) => {
    bim.IndexBuffer = requireColumn(t, "IndexBuffer", Int32Array);
  });

  await readParquetTable("Meshes.parquet", (t) => {
    bim.MeshVertexOffset = requireColumn(t, "MeshVertexOffset", Int32Array);
    bim.MeshIndexOffset = requireColumn(t, "MeshIndexOffset", Int32Array);
  });

  await readParquetTable("Materials.parquet", (t) => {
    bim.MaterialRed = requireColumn(t, "MaterialRed", Uint8Array);
    bim.MaterialGreen = requireColumn(t, "MaterialGreen", Uint8Array);
    bim.MaterialBlue = requireColumn(t, "MaterialBlue", Uint8Array);
    bim.MaterialAlpha = requireColumn(t, "MaterialAlpha", Uint8Array);
  });

  await readParquetTable("Transforms.parquet", (t) => {
    bim.TransformTX = requireColumn(t, "TransformTX", Float32Array);
    bim.TransformTY = requireColumn(t, "TransformTY", Float32Array);
    bim.TransformTZ = requireColumn(t, "TransformTZ", Float32Array);
    bim.TransformQX = requireColumn(t, "TransformQX", Float32Array);
    bim.TransformQY = requireColumn(t, "TransformQY", Float32Array);
    bim.TransformQZ = requireColumn(t, "TransformQZ", Float32Array);
    bim.TransformQW = requireColumn(t, "TransformQW", Float32Array);
    bim.TransformSX = requireColumn(t, "TransformSX", Float32Array);
    bim.TransformSY = requireColumn(t, "TransformSY", Float32Array);
    bim.TransformSZ = requireColumn(t, "TransformSZ", Float32Array);
  });

  return bim as BimGeometry;
}
