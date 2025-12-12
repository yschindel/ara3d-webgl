import * as THREE from 'three';
import JSZip from 'jszip';
import { parquetRead, parquetMetadataAsync, parquetSchema, ColumnData, parquetReadObjects, ParquetReadOptions } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';
import { BimGeometry } from './bimGeometry';
import { buildGeometryGroup } from './buildGeometryGroup';

/**
 * Loader that takes a URL to a .ZIP or .BOS file containing BIM Open Schema geometry parquet tables:
 */
export class BimOpenSchemaLoader 
{
  async load(source: string): Promise<THREE.Group> {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to fetch BOS from ${source}: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const bim = await loadBimGeometryFromZip(zip);
    return buildGeometryGroup(bim);
  }
}

/**
 * Reads the BOS parquet tables from a JSZip archive into a BimGeometry object.
 * This is the same idea as the previous browser version, just using package imports.
 */
export async function loadBimGeometryFromZip(zip: JSZip): Promise<BimGeometry> 
{
  // Find the file in the zip archive
  function findFileEndingWith(suffix: string): string {
    const lowerSuffix = suffix.toLowerCase();
    const name = Object.keys(zip.files).find((n) =>
      n.toLowerCase().endsWith(lowerSuffix));
    if (!name) 
      throw new Error(`Could not find "${suffix}" in zip archive.`);
    return name;
  }

  // Read the table, and put the columns directly
  async function readParquetTable(name: string, bimObject: any, ctor: any) {
    console.time(name);
    const entryName = findFileEndingWith(name);
    const file = await zip.files[entryName].async('arraybuffer');
    const metadata = await parquetMetadataAsync(file);
    await parquetRead({file, compressors, metadata, onChunk(chunk: ColumnData) {
      let data = chunk.columnData;
      console.log(chunk.columnName, data.constructor.name);
      bimObject[chunk.columnName] = ctor ? new ctor(data) : ctor;
    }});
    console.timeEnd(name);
  }

  const bim = {}
  await readParquetTable('Elements.parquet', bim, Int32Array);
  await readParquetTable('VertexBuffer.parquet', bim, Int32Array);
  await readParquetTable('IndexBuffer.parquet', bim, Int32Array);
  await readParquetTable('Meshes.parquet', bim, Int32Array);
  await readParquetTable('Materials.parquet', bim, Uint8Array);
  await readParquetTable('Transforms.parquet', bim, Float32Array);  
  return bim as BimGeometry;
}


