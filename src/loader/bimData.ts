import * as THREE from 'three';
import { BimGeometry } from './bimGeometry';
import { Instance } from './buildInstances';
import { BimResolver } from './bimResolver';
import { BimQuery } from './bimQuery';
import { buildGeometry } from './buildGeometryGroup';
import { BimEntities } from './bimEntities';
import { BimParameterTable } from './BimParameterTable';
import { BimParameterDescriptors } from './BimParameterDescriptors';

// Type-safe indexers 
export type EntityIndex = number & { __brand: "EntityIndex" };
export type StringIndex = number & { __brand: "StringIndex" };
export type InstanceIndex = number & { __brand: "InstanceIndex" };
export type DescriptorIndex = number & { __brand: "InstanceIndex" };

// Contains the BIM data loaded from Parquet, and the THREE geometry 
export class BimData 
{
    // Core geometry data (always loaded)
    BimGeometry: BimGeometry;
    Entities: BimEntities;
    Strings: Array<string>;
    ThreeGeometry: THREE.Group;
    Instances: Array<Instance>;
    
    // Query/Resolver are always available
    // They auto-detect if parameters were loaded and adjust behavior accordingly
    // Use Resolver.HasParameters to check if parameter methods will return data
    Resolver: BimResolver;
    Query: BimQuery;
    
    // Parameter data (null when loaded with skipParameters: true)
    Descriptors: BimParameterDescriptors | null = null;
    IntegerParameters: BimParameterTable | null = null;
    StringParameters: BimParameterTable | null = null;
    EntityParameters: BimParameterTable | null = null;
    SingleParameters: BimParameterTable | null = null;
    PointParameters: BimParameterTable | null = null;

    rebuildGeometry(instances: Instance[]): THREE.Group
    {
       return buildGeometry(instances);
    }
}


