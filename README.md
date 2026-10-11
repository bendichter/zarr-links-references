# Links and Object References

> **Draft for discussion** in [hdmf-dev/hdmf-zarr#410](https://github.com/hdmf-dev/hdmf-zarr/issues/410). The UUID is final, but the schema and spec URLs are placeholders until the convention has a permanent home. The [first draft](https://github.com/bendichter/zarr-links-references/tree/v0-hdmf-zarr-0.14), which describes exactly what hdmf-zarr 0.14 writes, is tagged `v0-hdmf-zarr-0.14`.

- **UUID**: 93624424-4c95-4eda-b86a-f1880206739f
- **Name**: links_references
- **Schema URL**: "https://raw.githubusercontent.com/zarr-conventions/links-references/refs/tags/v1/schema.json"
- **Spec URL**: "https://github.com/zarr-conventions/links-references/blob/v1/README.md"
- **Scope**: Array, Group
- **Extension Maturity Classification**: Proposal
- **Owner**: @bendichter

## Description

Zarr has no links and no object references. HDF5 has both, and so do the formats built on it, such as [NWB](https://nwb.org) and MATLAB v7.3. This convention defines two things that existing conventions don't:

- **Links**: named children of a group that are other nodes, in the same store or another one. They're the counterpart of HDF5 soft and external links.
- **Object reference arrays**: arrays whose elements, or some of whose struct fields, each identify a node.

It builds on the [`ref` convention](https://github.com/R-CF/zarr_convention_ref) for identifying a target. A reference stored as an attribute value is a plain `ref` object and needs nothing from this convention.

A reference array stores the path of each target as a string, so every array stays an ordinary string or struct array. A reader that doesn't know this convention can still read every array; it just won't resolve links or references.

- Examples:
  - [Convention metadata only](examples/minimal_example.json)
  - [Group with links](examples/group_with_links.json)
  - [Object reference array](examples/object_reference_array.json)
  - [Struct array with a reference field](examples/struct_reference_fields.json)

## Motivation

- **Converting HDF5**: Converting or virtualizing an HDF5 file to Zarr requires somewhere to put its soft links, external links, and object references. Converters either drop them or invent their own encoding, so a reference written by one tool can't be resolved by another.
- **Virtual references**: Tools that build virtual Zarr views of HDF5 files, such as [VirtualiZarr](https://github.com/zarr-developers/VirtualiZarr/issues/1104), can't read object references from the chunks, which hold HDF5 addresses. They have to resolve them at parse time and store the result somewhere. This convention is that place.
- **Existing data**: NWB files written to Zarr with [hdmf-zarr](https://github.com/hdmf-dev/hdmf-zarr) already store links and references, in an encoding close to this one. See [Differences from hdmf-zarr 0.14](#differences-from-hdmf-zarr-014-informative).
- **Composability**: The convention is independent of any data model. Conventions for a data model, such as HDMF, can build on it.

## Convention Registration

The convention must be registered in `zarr_conventions`:

```json
{
  "zarr_conventions": [
    {
      "uuid": "93624424-4c95-4eda-b86a-f1880206739f",
      "schema_url": "https://raw.githubusercontent.com/zarr-conventions/links-references/refs/tags/v1/schema.json",
      "spec_url": "https://github.com/zarr-conventions/links-references/blob/v1/README.md",
      "name": "links_references",
      "description": "Links and object references between nodes of Zarr hierarchies"
    }
  ]
}
```

Every node that has a `links_references` attribute MUST declare the convention. A group with links MUST also declare the `ref` convention, since its link targets are `ref` objects. The root group SHOULD declare both conventions when any node in the hierarchy uses them, so a reader can tell from the root that it may need to resolve links and references.

## Applicable To

This convention can be used with these parts of the Zarr hierarchy:

- [x] Group
- [x] Array

## Properties

All properties are nested under a single `links_references` key at the root `attributes` level.

**Convention metadata name**: `links_references`

| Field Name       | Type                                                | Description                                      |
| ---------------- | --------------------------------------------------- | ------------------------------------------------ |
| links_references | [Links References Object](#links-references-object) | **REQUIRED**. The properties of this convention. |

### Links References Object

| Field Name | Type                                 | Description                                                                                     |
| ---------- | ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| links      | Map\<string, [`ref` object](#links)> | Groups only. The links held by the group, by name.                                              |
| references | `true` \| \[string]                  | Arrays only. Which elements or struct fields are [object references](#object-reference-arrays). |

The object MUST have at least one of these fields.

### Links

`links` maps the name of each link to its target, as a `ref` convention object (`{"ref": {...}}`). The `ref` object MUST NOT have an `attribute` field, since a link's target is a whole node.

```json
{
  "zarr_conventions": [
    {
      "name": "links_references",
      "uuid": "93624424-4c95-4eda-b86a-f1880206739f"
    },
    { "name": "ref", "uuid": "d89b30cf-ed8c-43d5-9a16-b492f0cd8786" }
  ],
  "links_references": {
    "links": {
      "device": { "ref": { "node": "../../devices/probe" } },
      "raw": {
        "ref": {
          "uri": "../sub-01_raw.nwb.zarr",
          "node": "/acquisition/ElectricalSeries"
        }
      }
    }
  }
}
```

Following the `ref` convention, a target in the same store has no `uri`, and its `node` is a path relative to the group that holds the link. In this example the group is `/general/extracellular_ephys/g`, so `"../../devices/probe"` is `/general/devices/probe`. A target in another store has a `uri`, and its `node` is an absolute path in that store.

A link name MUST NOT contain `/`, and a group MUST NOT have both a link and a child node with the same name. A link targets a group or an array, not another link. A link whose target doesn't exist is _dangling_. Readers SHOULD treat a dangling link as absent, rather than failing to open the group.

An HDF5 object with more than one hard link is reachable by several names. A writer stores it once, under one of its names, and records each other name as a link.

### Object Reference Arrays

`references` marks an array whose values identify nodes:

- `true`: each element is an object reference. The array's data type MUST be a string type, `string` (variable-length UTF-8) or `fixed_length_utf32`.
- a list of field names: the array has a `struct` data type, and each listed field is an object reference. Each listed field MUST exist in the struct and MUST have a string data type.

Each reference is the path of its target in the same store, relative to the array, with the same rules as the `node` of a `ref` object without a `uri`: `..` is the array's parent group. For example, the `group` column of an electrodes table at `/general/extracellular_ephys/electrodes/group` refers to `/general/extracellular_ephys/g` as `"../../g"`. All paths are relative, in reference arrays as in links and `ref` objects, so a hierarchy stays valid when it's opened from a subpath or stored inside a larger store. The empty string `""` is a null reference.

```json
{
  "node_type": "array",
  "data_type": "string",
  "attributes": {
    "zarr_conventions": [
      {
        "name": "links_references",
        "uuid": "93624424-4c95-4eda-b86a-f1880206739f"
      }
    ],
    "links_references": { "references": true }
  }
}
```

```json
"links_references": { "references": ["timeseries"] }
```

## References in Attributes (Informative)

A reference stored as an attribute value is a `ref` convention object, and needs nothing from this convention. For example, an array at `/acquisition/es/electrodes` that refers to a table:

```json
{
  "zarr_conventions": [
    { "name": "ref", "uuid": "d89b30cf-ed8c-43d5-9a16-b492f0cd8786" }
  ],
  "table": {
    "ref": { "node": "../../../general/extracellular_ephys/electrodes" }
  }
}
```

## Differences from hdmf-zarr 0.14 (Informative)

hdmf-zarr 0.14 stores the same information with different attributes, and with absolute paths. Reference arrays hold the same targets, as paths relative to the array in place of absolute ones.

| hdmf-zarr 0.14                                                                                | This convention                                                                       |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `"_LINKS": [{"name": "device", "source": ".", "path": "/general/devices/probe"}]`             | `"links_references": {"links": {"device": {"ref": {"node": "../../devices/probe"}}}}` |
| `"source": "../other.nwb.zarr"` in a link                                                     | `"uri": "../other.nwb.zarr"` in its `ref` object                                      |
| `"_DTYPE": "object_reference"`, with elements like `"/general/extracellular_ephys/g"`         | `"links_references": {"references": true}`, with elements like `"../../g"`            |
| `"_REFERENCE_FIELDS": ["timeseries"]`                                                         | `"links_references": {"references": ["timeseries"]}`                                  |
| `"table": {"_REFERENCE": {"source": ".", "path": "/general/extracellular_ephys/electrodes"}}` | `"table": {"ref": {"node": "../../../general/extracellular_ephys/electrodes"}}`       |

hdmf-zarr also writes `_DTYPE` on every other array, where it repeats the Zarr `data_type`. It's outside this convention.

Conventions apply only to data that declares them, so files written by hdmf-zarr 0.14 don't conform. A reader that wants to open them can read the 0.14 attributes as well.

The Zarr v2 encoding of hdmf-zarr versions before 0.14 (`zarr_link` and `zarr_dtype` attributes) and HDF5 region references are out of scope.

## Open Questions

1. **References to other stores from arrays.** Array elements are bare paths, so they can only point within the same store.
2. **Arrays of references in attributes.** HDF5 allows an attribute holding several object references. `ref` doesn't say whether a list of `ref` objects is one.
3. **The name of the key.** `links_references` is a placeholder.
4. **Declaring `ref`.** A group with links declares `ref`, since its targets are `ref` objects. [R-CF/zarr_convention_ref#4](https://github.com/R-CF/zarr_convention_ref/issues/4) asks whether a convention that nests `ref` objects should declare `ref` as well. This draft will follow what is decided there.

## Known Implementations

### Libraries and Tools

None yet. [hdmf-zarr](https://github.com/hdmf-dev/hdmf-zarr) and [zarrshadow](https://github.com/bendichter/zarrshadow) write the earlier encoding described in [Differences from hdmf-zarr 0.14](#differences-from-hdmf-zarr-014-informative).

### Datasets Using This Convention

None yet.

### Resources

- [hdmf-zarr storage specification](https://hdmf-zarr.readthedocs.io/en/stable/storage.html)
- [`ref` convention](https://github.com/R-CF/zarr_convention_ref)
- [Unified convention for LINDI and hdmf-zarr](https://github.com/NeurodataWithoutBorders/lindi/issues/125)
- [VirtualiZarr: object references and variable-length strings in HDFParser](https://github.com/zarr-developers/VirtualiZarr/issues/1104)

_If you implement or use this convention, please add your implementation to this list by submitting a pull request._

## Acknowledgements

The encoding is adapted from hdmf-zarr and the LINDI unified convention. This README is based on the [Zarr conventions template](https://github.com/zarr-conventions/template), itself based on the [STAC extensions template](https://github.com/stac-extensions/template/blob/main/README.md).
