# Links and Object References

- **UUID**: 93624424-4c95-4eda-b86a-f1880206739f
- **Name**: links-references
- **Schema URL**: "https://raw.githubusercontent.com/zarr-conventions/links-references/refs/tags/v1/schema.json"
- **Spec URL**: "https://github.com/zarr-conventions/links-references/blob/v1/README.md"
- **Scope**: Array, Group
- **Extension Maturity Classification**: Proposal
- **Owner**: @bendichter

## Description

Zarr has no links and no object references. HDF5 has both, and so do the formats built on it, such as [NWB](https://nwb.org) and MATLAB v7.3. This convention defines how to store them in Zarr attributes:

- **Links**: a named child of a group that is another node, in the same hierarchy or another one.
- **Object reference arrays**: arrays whose elements each identify a node.
- **Reference fields**: fields of a struct array that identify nodes.
- **References in attributes**: attribute values that identify a node.

A reference is stored as the path of its target, so every array stays an ordinary string or struct array. A reader that doesn't know this convention can still read every array and attribute; it just won't resolve links or references.

This is the encoding [hdmf-zarr](https://github.com/hdmf-dev/hdmf-zarr) has written since 0.14, which came out of the [unified convention](https://github.com/NeurodataWithoutBorders/lindi/issues/125) agreed between hdmf-zarr and LINDI. A file written by hdmf-zarr 0.14 conforms once its nodes declare the convention. See [Differences from hdmf-zarr 0.14](#differences-from-hdmf-zarr-014-informative).

- Examples:
  - [Convention metadata only](examples/minimal_example.json)
  - [Group with links](examples/group_with_links.json)
  - [Object reference array](examples/object_reference_array.json)
  - [Struct array with a reference field](examples/struct_reference_fields.json)
  - [Reference in an attribute](examples/attribute_reference.json)
  - [Array of references in an attribute](examples/attribute_reference_array.json)

## Motivation

- **Converting HDF5**: Converting or virtualizing an HDF5 file to Zarr requires somewhere to put its soft links, external links, and object references. Converters either drop them or invent their own encoding, so a reference written by one tool can't be resolved by another.
- **Virtual references**: Tools that build virtual Zarr views of HDF5 files, such as [VirtualiZarr](https://github.com/zarr-developers/VirtualiZarr/issues/1104), can't read object references from the chunks, which hold HDF5 addresses. They have to resolve them at parse time and store the result somewhere. This convention is that place.
- **Existing data**: NWB files written to Zarr with hdmf-zarr already use this encoding. Writing it down as a convention lets other readers, in other languages, resolve them.
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
      "name": "links-references",
      "description": "Links and object references between nodes of Zarr hierarchies"
    }
  ]
}
```

Every node that has a `_LINKS`, `_DTYPE: "object_reference"`, or `_REFERENCE_FIELDS` attribute, or an attribute value that is a reference, MUST declare the convention. The root group SHOULD declare it as well when any node in the hierarchy does, so a reader can tell from the root that it may need to resolve links and references.

## Applicable To

This convention can be used with these parts of the Zarr hierarchy:

- [x] Group
- [x] Array

## Properties

All properties are placed at the root `attributes` level.

These attributes don't use a namespace prefix or a nesting key, which the Zarr Conventions specification recommends. They keep the names hdmf-zarr already writes, so existing files don't have to be rewritten. See [Open Questions](#open-questions).

| Field Name          | Type                                                                                              | Description                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `_LINKS`            | \[[Link Object](#link-object)]                                                                    | Groups only. The links held by the group.                                                                      |
| `_DTYPE`            | string                                                                                            | Arrays only. The value `"object_reference"` marks an [object reference array](#object-reference-arrays).       |
| `_REFERENCE_FIELDS` | \[string]                                                                                         | Struct arrays only. The names of the fields that hold [object references](#reference-fields-of-struct-arrays). |
| any attribute       | [Reference Object](#references-in-attributes) or \[[Reference Object](#references-in-attributes)] | A [reference stored as an attribute value](#references-in-attributes).                                         |

### Identifying a Target

Links and references identify their target with two values:

- `source`: the hierarchy that holds the target. `"."` means this hierarchy. Any other value is a URI reference ([RFC 3986](https://www.rfc-editor.org/rfc/rfc3986)) to the root of another hierarchy, resolved against the root of this one. For example, `"../session-raw.zarr"` names a hierarchy next to this one, and an absolute URL names one anywhere.
- `path`: the absolute path of the target within that hierarchy. It starts with `/`, and `"/"` alone is the root group.

The target is a group or an array, not a link. A link or reference whose target doesn't exist is _dangling_. Readers SHOULD treat a dangling link as absent, and a dangling reference as unresolvable, rather than failing to open the node that holds it.

### Link Object

A link is a child of a group, under the name `name`, that is the target node. It's the counterpart of an HDF5 soft or external link.

| Field Name | Type   | Description                                                                                           |
| ---------- | ------ | ----------------------------------------------------------------------------------------------------- |
| name       | string | **REQUIRED**. The name of the link in the group. It MUST NOT contain `/`.                             |
| source     | string | **REQUIRED**. The hierarchy that holds the target. See [Identifying a Target](#identifying-a-target). |
| path       | string | **REQUIRED**. The absolute path of the target in that hierarchy.                                      |

A group MUST NOT have both a link and a child node with the same name, and its links MUST have distinct names.

```json
"_LINKS": [
  { "name": "device", "source": ".", "path": "/general/devices/probe" }
]
```

An HDF5 object with more than one hard link is reachable by several names. A writer stores it once, under one of its names, and records each other name as a link with `source: "."`.

### Object Reference Arrays

An array whose `_DTYPE` attribute is `"object_reference"` is an array of object references. Each element is the `path` of its target in this hierarchy, as a string. The empty string `""` is a null reference.

The array's data type MUST be a string type: `string` (variable-length UTF-8) or `fixed_length_utf32`.

```json
{
  "node_type": "array",
  "data_type": "string",
  "attributes": { "_DTYPE": "object_reference" }
}
```

Other conventions also use `_DTYPE`, for example to record the data type of the source. This convention gives a meaning only to the value `"object_reference"`; other values are outside its scope.

### Reference Fields of Struct Arrays

An array with a `struct` data type can hold references in some of its fields. Its `_REFERENCE_FIELDS` attribute lists those fields. Each listed field MUST exist in the struct and MUST have a string data type. Its values are paths, as in an [object reference array](#object-reference-arrays), and `""` is a null reference.

```json
"_REFERENCE_FIELDS": ["timeseries"]
```

### References in Attributes

An attribute whose value is a JSON object with the single key `_REFERENCE` is a reference to a node:

| Field Name | Type   | Description                                                                                           |
| ---------- | ------ | ----------------------------------------------------------------------------------------------------- |
| source     | string | **REQUIRED**. The hierarchy that holds the target. See [Identifying a Target](#identifying-a-target). |
| path       | string | **REQUIRED**. The absolute path of the target in that hierarchy.                                      |

```json
"table": {
  "_REFERENCE": { "source": ".", "path": "/general/extracellular_ephys/electrodes" }
}
```

An attribute whose value is a JSON array of such objects is an array of references, the counterpart of an HDF5 attribute of object references.

Any other JSON object in an attribute that has a `_REFERENCE` key is invalid.

## Reading Files That Don't Declare the Convention (Informative)

Conventions apply only to data that declares them. Files written by hdmf-zarr 0.14 use this encoding but don't declare it. Readers that want to open them can apply this convention to any node with these attributes, whether or not it declares the convention.

## Differences from hdmf-zarr 0.14 (Informative)

This convention describes what hdmf-zarr 0.14 writes, with these additions:

- Nodes declare the convention in `zarr_conventions`.
- `""` is a null reference.
- An attribute can hold an array of references. hdmf-zarr writes only single references in attributes.
- `source` is defined as a URI reference, so it can be an absolute URL. hdmf-zarr writes `"."` or a relative file system path.

The Zarr v2 encoding of hdmf-zarr versions before 0.14 (`zarr_link` and `zarr_dtype` attributes) is out of scope.

HDF5 region references are out of scope.

## Open Questions

1. **Attribute names.** Zarr Conventions recommends a namespace prefix (such as `ref:links`) or a single nesting key. Keeping hdmf-zarr's names means existing files only need the declaration. Renaming now, before many Zarr v3 files exist, would follow the recommendation and avoid collisions.
2. **`_DTYPE`.** hdmf-zarr uses `_DTYPE` for the source data type in general, and `"object_reference"` is only one of its values. A dedicated attribute would keep this convention from sharing an attribute with other conventions.
3. **References to other hierarchies from arrays.** Links and attribute references have a `source`, but array elements and reference fields are bare paths, so they can only point within the same hierarchy. The hdmf-zarr documentation anticipates storing objects instead of strings for this case.
4. **One representation.** References are bare path strings in arrays but `_REFERENCE` objects in attributes. One representation would be simpler to implement, at the cost of changing what hdmf-zarr writes.

## Known Implementations

### Libraries and Tools

- **[hdmf-zarr](https://github.com/hdmf-dev/hdmf-zarr)** - Reads and writes NWB and other HDMF files in Zarr
  - Language: Python
  - Status: Production (encoding without the declaration)
  - Maintainer: @oruebel, @rly
  - Since: 0.14

- **[zarrshadow](https://github.com/bendichter/zarrshadow)** - Virtual Zarr views of HDF5 NWB files
  - Language: Python, JavaScript
  - Status: Experimental (encoding without the declaration)
  - Maintainer: @bendichter

### Datasets Using This Convention

None declare it yet. NWB files written with hdmf-zarr 0.14 or later use the encoding.

### Resources

- [hdmf-zarr storage specification](https://hdmf-zarr.readthedocs.io/en/stable/storage.html)
- [Unified convention for LINDI and hdmf-zarr](https://github.com/NeurodataWithoutBorders/lindi/issues/125)
- [VirtualiZarr: object references and variable-length strings in HDFParser](https://github.com/zarr-developers/VirtualiZarr/issues/1104)

_If you implement or use this convention, please add your implementation to this list by submitting a pull request._

## Acknowledgements

The encoding is from hdmf-zarr and the LINDI unified convention. This README is based on the [Zarr conventions template](https://github.com/zarr-conventions/template), itself based on the [STAC extensions template](https://github.com/stac-extensions/template/blob/main/README.md).
