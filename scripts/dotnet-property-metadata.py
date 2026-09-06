"""Search public .NET property metadata and its serialized attributes.

This is a read-only companion to ``dotnet-contracts.py``.  It does not load or
execute the vendor assembly and it deliberately does not inspect method bodies.
It is useful for obfuscated assemblies whose CLR property names are hidden but
whose public UI attributes still carry labels such as ``Smoothing Alpha`` and
numeric bounds.
"""

import argparse
import importlib.util
import json
from pathlib import Path


SPEC = importlib.util.spec_from_file_location(
    "metadata_reader", Path(__file__).with_name("dotnet-metadata.py")
)
metadata = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(metadata)


HAS_CUSTOM_ATTRIBUTE_TABLES = [
    6, 4, 1, 2, 8, 9, 10, 0, 14, 23, 20, 17, 26, 27, 32, 35, 38, 39,
    40, 42, 44, 43,
]


def compressed(data: bytes, offset: int = 0) -> tuple[int, int]:
    first = data[offset]
    if first < 0x80:
        return first, offset + 1
    if first < 0xC0:
        return ((first & 0x3F) << 8) | data[offset + 1], offset + 2
    if first < 0xE0:
        return (
            ((first & 0x1F) << 24)
            | (data[offset + 1] << 16)
            | (data[offset + 2] << 8)
            | data[offset + 3],
            offset + 4,
        )
    raise ValueError("invalid compressed integer")


def blob(assembly, index: int) -> bytes:
    base, size = assembly.streams["#Blob"]
    if not 0 <= index < size:
        raise ValueError("blob index outside heap")
    heap = assembly.data[base:base + size]
    length, start = compressed(heap, index)
    return heap[start:start + length]


def table_start(assembly, table: int) -> int:
    base, _ = assembly.streams["#~"]
    header = base + 24 + 4 * len(assembly.row_counts)
    return header + sum(
        assembly.row_counts.get(index, 0) * row_size(assembly, index)
        for index in range(table)
    )


def row_size(assembly, table: int) -> int:
    # dotnet-metadata.py only needed early tables and intentionally used
    # placeholders for later ones. Correct the ECMA-335 rows required to walk
    # PropertyMap and Property without changing that older IL utility.
    overrides = {
        15: 2 + 4 + (4 if assembly.row_counts.get(2, 0) >= 0x10000 else 2),
        18: (4 if assembly.row_counts.get(2, 0) >= 0x10000 else 2)
            + (4 if assembly.row_counts.get(20, 0) >= 0x10000 else 2),
        20: 2 + assembly.string_index_size
            + (4 if max(assembly.row_counts.get(table, 0) for table in (2, 1, 27)) >= 0x4000 else 2),
        21: (4 if assembly.row_counts.get(2, 0) >= 0x10000 else 2)
            + (4 if assembly.row_counts.get(23, 0) >= 0x10000 else 2),
        23: 2 + assembly.string_index_size + assembly.blob_index_size,
    }
    if table in overrides:
        return overrides[table]
    return assembly._row_size(table)


def table_index(assembly, reader, table: int) -> int:
    return reader.u4() if assembly.row_counts.get(table, 0) >= 0x10000 else reader.u2()


def coded_index(assembly, reader, tables: list[int], bits: int) -> int:
    largest = max(assembly.row_counts.get(table, 0) for table in tables)
    return reader.u4() if largest >= (1 << (16 - bits)) else reader.u2()


def property_rows(assembly):
    reader = metadata.Reader(assembly.data, table_start(assembly, 23))
    rows = []
    for _ in range(assembly.row_counts.get(23, 0)):
        flags = reader.u2()
        name = assembly._string_index(reader)
        signature = assembly._blob_index(reader)
        rows.append({
            "flags": flags,
            "name": assembly.string_at(name),
            "signature": signature,
        })
    return rows


def property_owners(assembly) -> dict[int, str]:
    reader = metadata.Reader(assembly.data, table_start(assembly, 21))
    maps = []
    for _ in range(assembly.row_counts.get(21, 0)):
        parent = table_index(assembly, reader, 2)
        first_property = table_index(assembly, reader, 23)
        maps.append((parent, first_property))

    owners = {}
    property_count = assembly.row_counts.get(23, 0)
    for index, (type_row, first_property) in enumerate(maps):
        end = maps[index + 1][1] if index + 1 < len(maps) else property_count + 1
        typedef = assembly.rows[2][type_row - 1]
        type_name = ".".join(filter(None, (
            assembly.string_at(typedef[2]), assembly.string_at(typedef[1])
        )))
        for property_row in range(first_property, end):
            owners[property_row] = type_name
    return owners


def printable_strings(value: bytes) -> list[str]:
    strings = []
    current = bytearray()
    for byte in value:
        if 32 <= byte <= 126:
            current.append(byte)
        else:
            if len(current) >= 3:
                strings.append(current.decode("utf-8", "replace"))
            current.clear()
    if len(current) >= 3:
        strings.append(current.decode("utf-8", "replace"))
    return strings


def property_attributes(assembly) -> dict[int, list[dict]]:
    reader = metadata.Reader(assembly.data, table_start(assembly, 12))
    result: dict[int, list[dict]] = {}
    for _ in range(assembly.row_counts.get(12, 0)):
        parent = coded_index(assembly, reader, HAS_CUSTOM_ATTRIBUTE_TABLES, 5)
        attribute_type = coded_index(assembly, reader, [0, 0, 10, 6, 0], 3)
        value_index = assembly._blob_index(reader)
        tag, row = parent & 0x1F, parent >> 5
        if tag >= len(HAS_CUSTOM_ATTRIBUTE_TABLES) or HAS_CUSTOM_ATTRIBUTE_TABLES[tag] != 23:
            continue
        value = blob(assembly, value_index)
        result.setdefault(row, []).append({
            "constructorToken": attribute_type,
            "hex": value.hex(),
            "strings": printable_strings(value),
        })
    return result


def search(assembly, needle: str):
    properties = property_rows(assembly)
    owners = property_owners(assembly)
    attributes = property_attributes(assembly)
    lowered = needle.lower()
    output = []
    for row, prop in enumerate(properties, start=1):
        attrs = attributes.get(row, [])
        haystack = " ".join([
            prop["name"], owners.get(row, ""),
            *(text for attr in attrs for text in attr["strings"]),
        ]).lower()
        if lowered not in haystack:
            continue
        output.append({
            "propertyRow": row,
            "owner": owners.get(row),
            "property": prop["name"],
            "signatureHex": blob(assembly, prop["signature"]).hex(),
            "attributes": attrs,
        })
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pattern")
    parser.add_argument("--assembly", default=metadata.DEFAULT_ASSEMBLY)
    args = parser.parse_args()
    print(json.dumps(search(metadata.Assembly(args.assembly), args.pattern), indent=2))
