"""Read scalar getter types and enum members; never load/execute vendor code.

ECMA-335 II.23.2 signature encoding. Unsupported signatures fail explicitly.
The legacy reader supplies PE/early table data; this tool only addresses tables
0..11 directly, not its incomplete later-table decoder or protected IL bodies.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import struct

spec = importlib.util.spec_from_file_location("metadata_reader", Path(__file__).with_name("dotnet-metadata.py"))
metadata = importlib.util.module_from_spec(spec)
spec.loader.exec_module(metadata)


def compressed(data, offset=0):
    if offset < 0 or offset >= len(data):
        raise ValueError("truncated compressed integer")
    first = data[offset]
    width = 1 if first < 0x80 else 2 if first < 0xC0 else 4 if first < 0xE0 else 0
    if not width or offset + width > len(data):
        raise ValueError("invalid compressed integer")
    mask = {1: 0x7F, 2: 0x3F, 4: 0x1F}[width]
    value = first & mask
    for byte in data[offset + 1:offset + width]:
        value = (value << 8) | byte
    return value, offset + width


def blob(assembly, index):
    base, size = assembly.streams["#Blob"]
    if not 0 <= index < size:
        raise ValueError("blob outside heap")
    heap = assembly.data[base:base + size]
    count, start = compressed(heap, index)
    if start + count > len(heap):
        raise ValueError("truncated blob")
    return heap[start:start + count]


SCALARS = {1: "void", 2: "bool", 3: "char", 4: "int8", 5: "uint8",
           6: "int16", 7: "uint16", 8: "int32", 9: "uint32", 10: "int64",
           11: "uint64", 12: "float32", 13: "float64", 14: "string"}


def getter_type(signature):
    if not signature or signature[0] not in (0, 0x20):
        raise ValueError("unsupported getter calling convention")
    parameters, at = compressed(signature, 1)
    if parameters or at >= len(signature):
        raise ValueError("not a zero-parameter getter")
    kind = signature[at]
    at += 1
    if kind in SCALARS:
        result = {"kind": SCALARS[kind]}
    elif kind in (0x11, 0x12):
        token, at = compressed(signature, at)
        tag, row = token & 3, token >> 2
        if tag == 3 or row == 0:
            raise ValueError("invalid TypeDefOrRefOrSpec token")
        result = {"kind": "valuetype" if kind == 0x11 else "class",
                  "table": (2, 1, 27)[tag], "row": row}
    else:
        raise ValueError(f"unsupported getter element {kind:#x}")
    if at != len(signature):
        raise ValueError("unexpected getter signature tail")
    return result


def early_table_offset(assembly, table):
    if not 0 <= table <= 11:
        raise ValueError("only early metadata tables supported")
    base, _ = assembly.streams["#~"]
    return base + 24 + 4 * len(assembly.row_counts) + sum(
        assembly.row_counts.get(t, 0) * assembly._row_size(t) for t in range(table))


def resolve_type(assembly, table, row):
    if not 1 <= row <= assembly.row_counts.get(table, 0):
        raise ValueError("type token outside table")
    if table == 2:
        _, name, namespace, *_ = assembly.rows[2][row - 1]
    elif table == 1:
        reader = metadata.Reader(assembly.data, early_table_offset(assembly, 1) + (row - 1) * assembly._row_size(1))
        assembly._coded_index(reader, "ResolutionScope")
        name, namespace = assembly._string_index(reader), assembly._string_index(reader)
    else:
        raise ValueError("TypeSpec resolution not supported")
    return ".".join(filter(None, (assembly.string_at(namespace), assembly.string_at(name))))


CONSTANT_FORMATS = {2: "?", 3: "H", 4: "b", 5: "B", 6: "h", 7: "H",
                    8: "i", 9: "I", 10: "q", 11: "Q", 12: "f", 13: "d"}


def constant_value(kind, data):
    fmt = CONSTANT_FORMATS.get(kind)
    if not fmt or len(data) != struct.calcsize("<" + fmt):
        raise ValueError("unsupported or malformed constant")
    return struct.unpack("<" + fmt, data)[0]


def field_constants(assembly):
    reader = metadata.Reader(assembly.data, early_table_offset(assembly, 11))
    result = {}
    # HasConstant targets Field, Param, Property (not Assembly).
    width = 4 if max(assembly.row_counts.get(t, 0) for t in (4, 8, 23)) >= 16384 else 2
    for _ in range(assembly.row_counts.get(11, 0)):
        kind, padding = reader.u1(), reader.u1()
        parent = reader.u4() if width == 4 else reader.u2()
        index = assembly._blob_index(reader)
        if padding:
            raise ValueError("invalid Constant padding")
        if parent & 3 == 0:
            result[parent >> 2] = constant_value(kind, blob(assembly, index))
    return result


def contracts(assembly, needle):
    constants = field_constants(assembly)
    output = []
    for index, namespace, name, _ in assembly.types():
        full_name = ".".join(filter(None, (namespace, name)))
        if needle.lower() not in full_name.lower():
            continue
        settings = []
        for method_row, method, _, flags in assembly.methods_of(index):
            if not method.startswith("get_") or flags & 7 != 6:
                continue
            setting = {"name": method[4:]}
            try:
                signature = blob(assembly, assembly.rows[6][method_row - 1][4])
                value_type = getter_type(signature)
                setting.update(value_type)
                if "table" in value_type:
                    setting["type"] = resolve_type(assembly, value_type["table"], value_type["row"])
                    if value_type["table"] == 2:
                        extends = assembly.rows[2][value_type["row"] - 1][3]
                        parent = resolve_type(assembly, (2, 1, 27)[extends & 3], extends >> 2) if extends and (extends & 3) < 3 else None
                        if parent == "System.Enum":
                            fields = assembly.fields_of(value_type["row"] - 1)
                            setting["literalMembers"] = {n: constants[r] for r, n in fields if r in constants}
            except ValueError as error:
                setting["unresolved"] = str(error)
            settings.append(setting)
        output.append({"type": full_name, "settings": settings})
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("type_pattern")
    parser.add_argument("--assembly", default=metadata.DEFAULT_ASSEMBLY)
    args = parser.parse_args()
    print(json.dumps(contracts(metadata.Assembly(args.assembly), args.type_pattern), indent=2))
