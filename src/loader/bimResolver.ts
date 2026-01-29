import { BimData, StringIndex, EntityIndex, InstanceIndex, DescriptorIndex } from './bimData';
import { BimEntities } from './bimEntities';
import { BimGeometry } from './bimGeometry';
import { BimParameterDescriptors } from './BimParameterDescriptors';
import { BimParameterTable } from './BimParameterTable';
import { Instance } from './buildInstances';

// This class helps us efficiently look up data based on indices and a type-safe way. 

export type Parameter = { Name: string, Value: any }

export class BimResolver 
{
    constructor(readonly Data: BimData) 
    {
        this.Entities = Data.Entities;
        this.Strings = Data.Strings;
        this.BimGeometry = Data.BimGeometry;
        this.InstanceCount = this.BimGeometry.InstanceEntityIndex.length;
        this.EntityCount = this.Entities.Category.length;
        this.Descriptors = Data.Descriptors;
        this.DescriptorCount = this.Descriptors?.Name?.length ?? 0;
        
        // Auto-detect if parameters are available and process them
        // When loaded with skipParameters: true, these will be null
        this.ParameterMap = new Map<EntityIndex, Array<Parameter>>();
        
        if (Data.Descriptors && Data.IntegerParameters) {
            console.time("Computing parameters");
            this.ProcessParameters(Data.IntegerParameters);
            this.ProcessParameters(Data.SingleParameters);
            this.ProcessParameters(Data.StringParameters);
            this.ProcessParameters(Data.EntityParameters);
            console.timeEnd("Computing parameters");
        }
    }

    GetVal(rawVal: number, descType: number): any
    {
        if (descType == 3) return this.Strings[rawVal];
        if (descType == 2) {
            if (rawVal >= 0)
                return this.GetEntityName(rawVal as EntityIndex);
            return ""; 
        }
        return rawVal;
    }

    ProcessParameters(table: BimParameterTable | null)
    {
        if (!table?.Value) return;
        
        for (let i=0; i < table.Value.length; i++)
        {
            let descIndex = table.Descriptor[i];
            let entityIndex = table.Entity[i];
            let rawVal = table.Value[i];
            if (descIndex < 0) continue;
            let nameIndex = this.Descriptors.Name[descIndex];
            let descType = this.Descriptors.Type[descIndex];
            let Value = this.GetVal(rawVal, descType);
            let Name = this.Strings[nameIndex];
            let param = { Name, Value } as Parameter;
            let tmp = this.ParameterMap.get(entityIndex);
            if (tmp === undefined)
            {
                this.ParameterMap.set(entityIndex, [param]);
            }
            else
            {
                tmp.push(param);
            }
        }
    }

    readonly Descriptors: BimParameterDescriptors | null;
    readonly Strings: Array<string>;
    readonly Entities: BimEntities;
    readonly InstanceCount: number;
    readonly EntityCount: number;
    readonly BimGeometry: BimGeometry;
    readonly DescriptorCount: number;
    
    readonly ParameterMap: Map<EntityIndex, Array<Parameter>>;
    
    /** Returns true if parameters were loaded and processed */
    get HasParameters(): boolean { return this.DescriptorCount > 0; }

    GetString(stringIndex: StringIndex): string { return this.Strings[stringIndex]; }

    GetEntityName(i: EntityIndex): string { return this.GetString(this.Entities.Name[i]); }
    GetEntityCategory(i: EntityIndex): EntityIndex { return this.Entities.Category[i]; }
    GetEntityCategoryName(i: EntityIndex): string { return this.GetEntityName(this.GetEntityCategory(i)); }
    GetEntityType(i: EntityIndex): EntityIndex { return this.Entities.Type[i]; }
    GetEntityTypeName(i: EntityIndex): string { return this.GetEntityName(this.GetEntityType(i)); }
    GetEntityDocument(i: EntityIndex): EntityIndex { return this.Entities.Type[i]; }
    GetEntityDocumentName(i: EntityIndex): string { return this.GetEntityName(this.GetEntityDocument(i)); }
    GetEntityParameters(i: EntityIndex): Array<Parameter> | undefined { return this.ParameterMap.get(i); }

    GetInstanceName(i: Instance): string { return this.GetEntityName(i.entity); }
    GetInstanceCategoryName(i: Instance): string { return this.GetEntityCategoryName(i.entity); }
    GetInstanceTypeName(i: Instance): string { return this.GetEntityTypeName(i.entity); }
    GetInstanceDocumentName(i: Instance): string { return this.GetEntityDocumentName(i.entity); }
    GetInstanceGlobalId(i: Instance): string { return this.GetString(this.Entities.GlobalId[i.entity]); }
    GetInstanceParameters(i: Instance): Array<Parameter> | undefined { return this.GetEntityParameters(i.entity); }

    // =======================================================================
    // DESCRIPTOR AND PARAMETER METHODS
    // =======================================================================

    // Descriptor methods - return null/0 if parameters weren't loaded
    GetDescriptorName(i: DescriptorIndex): string | null { return this.Descriptors ? this.GetString(this.Descriptors.Name[i]) : null; }
    GetDescriptorType(i: DescriptorIndex): number { return this.Descriptors?.Type[i] ?? 0; }
    GetDescriptorGroup(i: DescriptorIndex): string | null { return this.Descriptors ? this.GetString(this.Descriptors.Group[i]) : null; }
    GetDescriptorUnits(i: DescriptorIndex): string | null { return this.Descriptors ? this.GetString(this.Descriptors.Units[i]) : null; }

    *EntityIndices(): Iterable<EntityIndex> { for (let i = 0; i < this.EntityCount; i++) yield i as EntityIndex; }
    *InstanceIndices(): Iterable<InstanceIndex> { for (let i = 0; i < this.InstanceCount; i++) yield i as InstanceIndex; }
    *DescriptorIndices(): Iterable<DescriptorIndex> { for (let i = 0; i < this.DescriptorCount; i++) yield i as DescriptorIndex; }

    first<T>(iterable: Iterable<T>, predicate: (value: T) => boolean, _default: T): T {
        for (const value of iterable) 
            if (predicate(value)) return value;
        return _default;
    }

    FindDescriptor(name: string): DescriptorIndex { 
        if (!this.Descriptors) return -1 as DescriptorIndex;
        return this.first(this.DescriptorIndices(), i => this.GetDescriptorName(i) == name, -1 as DescriptorIndex); 
    }
}
