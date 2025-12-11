import * as THREE from 'three';
import JSZip from 'jszip';
import { parquetRead, parquetMetadataAsync, parquetSchema, ColumnData, parquetReadObjects, ParquetReadOptions } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';
import { BimGeometry } from './bimGeometry';
import { buildGeometryGroup } from './buildGeometryGroup';

/**
 * Loader that takes a URL to a .ZIP or .BOS file containing BIM Open Schema geometry parquet tables:
 */
export class BimOpenSchemaLoader {
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
export async function loadBimGeometryFromZip(zip: JSZip): Promise<BimGeometry> {
  
  // --- helpers for reading parquet from ZIP ---

  function findFileEndingWith(suffix: string): string {
    const lowerSuffix = suffix.toLowerCase();
    const name = Object.keys(zip.files).find((n) =>
      n.toLowerCase().endsWith(lowerSuffix)
    );
    if (!name) {
      throw new Error(`Could not find "${suffix}" in zip archive.`);
    }
    return name;
  }

  async function readParquetTable(nameSuffix: string, bimObject: any) {
    const entryName = findFileEndingWith(nameSuffix);
    const file = await zip.files[entryName].async('arraybuffer');
    const metadata = await parquetMetadataAsync(file);
    // NOTE: this is a workaround for the number of rows in the row_group not being specified 
    metadata.row_groups[0].num_rows = metadata.num_rows;
    await parquetRead({file, compressors, metadata, onChunk(chunk: ColumnData) {
      bimObject[chunk.columnName] = chunk.columnData;
    }});
  }

  const bim = {}
  await readParquetTable('Elements.parquet', bim);
  await readParquetTable('VertexBuffer.parquet', bim);
  await readParquetTable('IndexBuffer.parquet', bim);
  await readParquetTable('Meshes.parquet', bim);
  await readParquetTable('Materials.parquet', bim);
  await readParquetTable('Transforms.parquet', bim);  
  return bim as BimGeometry;
}


