"""
A reader for .NET assembly metadata and IL, enough to answer questions about a
compiled study.

DeepChart ships as a .NET assembly and its behaviour is not documented anywhere
we can read. Matching its volume profile means knowing the constants it actually
uses - the session boundaries a Triple split cuts on, the defaults a dialog
seeds - and those live in IL, not in the settings file (which is encrypted) or
the dialog (which shows only what is currently selected).

This walks: PE header -> CLI header -> metadata root -> the #~ table stream,
then decodes a method body's IL far enough to read its numeric constants. It is
deliberately a READER. It never writes, patches or redistributes anything from
the assembly; it answers "what number does this use" so our own implementation
can be correct.

Usage:
  python scripts/dotnet-metadata.py --strings PATTERN     list matching names
  python scripts/dotnet-metadata.py --methods PATTERN     methods on matching types
  python scripts/dotnet-metadata.py --il TYPE.METHOD      decode one method's IL
"""

import argparse
import struct
import sys

DEFAULT_ASSEMBLY = r"C:\Program Files\Volumetrica Trading\Deepchart\Deepchart.dll"


class Reader:
    def __init__(self, data: bytes, offset: int = 0):
        self.data = data
        self.offset = offset

    def u1(self):
        value = self.data[self.offset]
        self.offset += 1
        return value

    def u2(self):
        value = struct.unpack_from("<H", self.data, self.offset)[0]
        self.offset += 2
        return value

    def u4(self):
        value = struct.unpack_from("<I", self.data, self.offset)[0]
        self.offset += 4
        return value

    def u8(self):
        value = struct.unpack_from("<Q", self.data, self.offset)[0]
        self.offset += 8
        return value


class Assembly:
    def __init__(self, path: str):
        with open(path, "rb") as handle:
            self.data = handle.read()
        self._read_pe()
        self._read_metadata()
        self._read_tables()

    # --- PE ---------------------------------------------------------------
    def _read_pe(self):
        pe_offset = struct.unpack_from("<I", self.data, 0x3C)[0]
        assert self.data[pe_offset:pe_offset + 4] == b"PE\0\0", "not a PE image"
        coff = pe_offset + 4
        machine, section_count = struct.unpack_from("<HH", self.data, coff)
        optional_size = struct.unpack_from("<H", self.data, coff + 16)[0]
        optional = coff + 20
        magic = struct.unpack_from("<H", self.data, optional)[0]
        # PE32 keeps 16 data directories after 96 bytes; PE32+ after 112.
        directories = optional + (96 if magic == 0x10B else 112)

        self.sections = []
        section_table = optional + optional_size
        for index in range(section_count):
            base = section_table + index * 40
            name = self.data[base:base + 8].rstrip(b"\0").decode("ascii", "replace")
            virtual_size, virtual_address, raw_size, raw_pointer = struct.unpack_from(
                "<IIII", self.data, base + 8)
            self.sections.append((name, virtual_address, virtual_size, raw_pointer, raw_size))

        # Data directory 14 is the CLI header.
        cli_rva = struct.unpack_from("<I", self.data, directories + 14 * 8)[0]
        assert cli_rva, "not a managed assembly"
        cli = self.rva_to_offset(cli_rva)
        self.metadata_rva = struct.unpack_from("<I", self.data, cli + 8)[0]

    def rva_to_offset(self, rva: int) -> int:
        for _name, virtual_address, virtual_size, raw_pointer, raw_size in self.sections:
            if virtual_address <= rva < virtual_address + max(virtual_size, raw_size):
                return raw_pointer + (rva - virtual_address)
        raise ValueError(f"rva {rva:#x} is outside every section")

    # --- metadata root ----------------------------------------------------
    def _read_metadata(self):
        base = self.rva_to_offset(self.metadata_rva)
        reader = Reader(self.data, base)
        assert reader.u4() == 0x424A5342, "missing BSJB metadata signature"
        reader.u2(); reader.u2(); reader.u4()          # version numbers, reserved
        version_length = reader.u4()
        reader.offset += version_length
        reader.u2()                                     # flags
        stream_count = reader.u2()

        self.streams = {}
        for _ in range(stream_count):
            stream_offset = reader.u4()
            stream_size = reader.u4()
            name_bytes = bytearray()
            while True:
                byte = reader.u1()
                if byte == 0:
                    break
                name_bytes.append(byte)
            # Stream names are padded to a four byte boundary.
            while (reader.offset - base) % 4:
                reader.offset += 1
            self.streams[name_bytes.decode("ascii")] = (base + stream_offset, stream_size)

    def string_at(self, index: int) -> str:
        base, size = self.streams["#Strings"]
        end = self.data.index(b"\0", base + index)
        return self.data[base + index:end].decode("utf-8", "replace")

    # --- table stream -----------------------------------------------------
    TABLE_NAMES = {0: "Module", 1: "TypeRef", 2: "TypeDef", 4: "Field", 6: "MethodDef",
                   8: "Param", 9: "InterfaceImpl", 10: "MemberRef", 11: "Constant",
                   12: "CustomAttribute", 23: "TypeSpec", 32: "Assembly", 35: "AssemblyRef"}

    def _read_tables(self):
        base, _size = self.streams["#~"]
        reader = Reader(self.data, base)
        reader.u4()                                     # reserved
        reader.u1(); reader.u1()                        # major, minor
        heap_sizes = reader.u1()
        reader.u1()                                     # reserved
        valid = reader.u8()
        reader.u8()                                     # sorted

        self.string_index_size = 4 if heap_sizes & 0x01 else 2
        self.guid_index_size = 4 if heap_sizes & 0x02 else 2
        self.blob_index_size = 4 if heap_sizes & 0x04 else 2

        self.row_counts = {}
        for table in range(64):
            if valid >> table & 1:
                self.row_counts[table] = reader.u4()

        # Only the tables needed to name a method and find its body are decoded.
        # Everything before them still has to be SKIPPED at the right width, so
        # each table's row size is computed whether or not it is read.
        self.rows = {}
        for table in range(64):
            count = self.row_counts.get(table, 0)
            if not count:
                continue
            if table == 2:      # TypeDef
                self.rows[2] = []
                for _ in range(count):
                    flags = reader.u4()
                    name = self._string_index(reader)
                    namespace = self._string_index(reader)
                    extends = self._coded_index(reader, "TypeDefOrRef")
                    field_list = self._table_index(reader, 4)
                    method_list = self._table_index(reader, 6)
                    self.rows[2].append((flags, name, namespace, extends, field_list, method_list))
            elif table == 4:    # Field - enum members live here
                self.rows[4] = []
                for _ in range(count):
                    flags = reader.u2()
                    name = self._string_index(reader)
                    signature = self._blob_index(reader)
                    self.rows[4].append((flags, name, signature))
            elif table == 6:    # MethodDef
                self.rows[6] = []
                for _ in range(count):
                    rva = reader.u4()
                    impl_flags = reader.u2()
                    flags = reader.u2()
                    name = self._string_index(reader)
                    signature = self._blob_index(reader)
                    param_list = self._table_index(reader, 8)
                    self.rows[6].append((rva, impl_flags, flags, name, signature, param_list))
            else:
                reader.offset += count * self._row_size(table)

    def _string_index(self, reader):
        return reader.u4() if self.string_index_size == 4 else reader.u2()

    def _blob_index(self, reader):
        return reader.u4() if self.blob_index_size == 4 else reader.u2()

    def _table_index(self, reader, table):
        return reader.u4() if self.row_counts.get(table, 0) >= 0x10000 else reader.u2()

    CODED = {
        "TypeDefOrRef": ([2, 0, 1, 23], 2),
        "HasConstant": ([4, 8, 32], 2),
        "HasCustomAttribute": ([6, 4, 1, 2, 8, 10, 0, 23, 32, 35], 5),
        "CustomAttributeType": ([0, 0, 10, 6, 0], 3),
        "MemberRefParent": ([2, 0, 1, 6, 23], 3),
        "HasFieldMarshal": ([4, 8], 1),
        "HasDeclSecurity": ([2, 6, 32], 2),
        "HasSemantics": ([20, 17], 1),
        "MethodDefOrRef": ([6, 10], 1),
        "MemberForwarded": ([4, 6], 1),
        "Implementation": ([38, 39, 35], 2),
        "ResolutionScope": ([0, 35, 1, 2], 2),
        "TypeOrMethodDef": ([2, 6], 1),
    }

    def _coded_size(self, kind):
        tables, bits = self.CODED[kind]
        largest = max(self.row_counts.get(table, 0) for table in tables)
        return 4 if largest >= (1 << (16 - bits)) else 2

    def _coded_index(self, reader, kind):
        return reader.u4() if self._coded_size(kind) == 4 else reader.u2()

    def _row_size(self, table):
        s, g, b = self.string_index_size, self.guid_index_size, self.blob_index_size
        idx = lambda t: 4 if self.row_counts.get(t, 0) >= 0x10000 else 2
        cod = self._coded_size
        sizes = {
            0: 2 + s + 3 * g,
            1: cod("ResolutionScope") + 2 * s,
            2: 4 + 2 * s + cod("TypeDefOrRef") + idx(4) + idx(6),
            3: idx(4),
            4: 2 + s + b,
            5: idx(6),
            6: 4 + 2 + 2 + s + b + idx(8),
            7: idx(8),
            8: 2 + 2 + s,
            9: idx(2) + cod("TypeDefOrRef"),
            10: cod("MemberRefParent") + s + b,
            11: 1 + 1 + cod("HasConstant") + b,
            12: cod("HasCustomAttribute") + cod("CustomAttributeType") + b,
            13: cod("HasFieldMarshal") + b,
            14: 2 + cod("HasDeclSecurity") + b,
            15: 2 + 2 + idx(2),
            16: 4 + idx(4),
            17: b,
            18: idx(2),
            19: idx(4),
            20: 2 + 2 + s + b,
            21: idx(20),
            22: 2 + cod("HasSemantics") + idx(20),
            23: b,
            24: idx(6) + cod("MethodDefOrRef"),
            25: idx(2) + cod("MethodDefOrRef") + cod("MethodDefOrRef"),
            26: s,
            27: b,
            28: 2 + cod("MemberForwarded") + s + idx(26),
            29: 4 + idx(4),
            32: 4 + 4 * 2 + 4 + b + 2 * s,
            33: 4,
            34: cod("Implementation") + 4,
            35: 4 * 2 + 4 + b + 2 * s + b,
            36: 4,
            37: cod("Implementation"),
            38: 4 + 4 + s + s + cod("Implementation"),
            39: 4 + 4 + 4 + s + s + cod("Implementation"),
            40: 4 + 2 + 2 + s + idx(2),
            41: 2 + 2 + cod("TypeOrMethodDef") + s,
            42: 2 + 2 + b,
            43: cod("TypeOrMethodDef") + cod("TypeDefOrRef"),
            44: 2 + idx(6) + b,
        }
        if table not in sizes:
            raise NotImplementedError(f"table {table} ({self.TABLE_NAMES.get(table, '?')}) size unknown")
        return sizes[table]

    # --- convenience ------------------------------------------------------
    def types(self):
        for index, (_flags, name, namespace, _extends, _fields, methods) in enumerate(self.rows.get(2, [])):
            yield index, self.string_at(namespace), self.string_at(name), methods

    def fields_of(self, type_index):
        typedefs = self.rows[2]
        start = typedefs[type_index][4]
        end = typedefs[type_index + 1][4] if type_index + 1 < len(typedefs) else len(self.rows.get(4, [])) + 1
        for row in range(start, end):
            if row - 1 >= len(self.rows.get(4, [])):
                break
            _flags, name, _sig = self.rows[4][row - 1]
            yield row, self.string_at(name)

    def methods_of(self, type_index):
        typedefs = self.rows[2]
        start = typedefs[type_index][5]
        end = typedefs[type_index + 1][5] if type_index + 1 < len(typedefs) else len(self.rows[6]) + 1
        for row in range(start, end):
            rva, _impl, flags, name, _sig, _params = self.rows[6][row - 1]
            yield row, self.string_at(name), rva, flags


# --- IL -------------------------------------------------------------------
# Only the opcodes needed to read constants out of a body. Anything else is
# skipped by operand width so the stream stays aligned.
ONE_BYTE = {
    0x16: ("ldc.i4.0", 0), 0x17: ("ldc.i4.1", 0), 0x18: ("ldc.i4.2", 0),
    0x19: ("ldc.i4.3", 0), 0x1A: ("ldc.i4.4", 0), 0x1B: ("ldc.i4.5", 0),
    0x1C: ("ldc.i4.6", 0), 0x1D: ("ldc.i4.7", 0), 0x1E: ("ldc.i4.8", 0),
    0x15: ("ldc.i4.m1", 0),
    0x1F: ("ldc.i4.s", 1), 0x20: ("ldc.i4", 4), 0x21: ("ldc.i8", 8),
    0x22: ("ldc.r4", 4), 0x23: ("ldc.r8", 8),
    0x28: ("call", 4), 0x6F: ("callvirt", 4), 0x73: ("newobj", 4),
    0x72: ("ldstr", 4), 0x7B: ("ldfld", 4), 0x7E: ("ldsfld", 4),
}
# Operand widths for every other single byte opcode, so decoding stays aligned.
WIDTHS = {}
for op in list(range(0x00, 0x0E)) + list(range(0x25, 0x28)) + [0x14] + list(range(0x58, 0x66)) + \
        list(range(0x46, 0x53)) + [0x2A] + list(range(0x67, 0x6E)) + list(range(0x74, 0x7A)):
    WIDTHS.setdefault(op, 0)
for op in [0x0E, 0x0F, 0x10, 0x11, 0x12, 0x13, 0x2B] + list(range(0x2C, 0x38)):
    WIDTHS.setdefault(op, 1)
for op in list(range(0x38, 0x45)) + [0x27]:
    WIDTHS.setdefault(op, 4)
for op in [0x6A, 0x6B, 0x6C, 0x6D, 0x6E, 0x70, 0x71, 0x75, 0x79, 0x7C, 0x7D, 0x7F,
           0x80, 0x81, 0x8C, 0x8D, 0x8F, 0x91, 0xA5, 0xC2, 0xC6, 0xD0]:
    WIDTHS.setdefault(op, 4)


def decode_constants(data: bytes, body_offset: int):
    """Numeric constants pushed by a method body, in order."""
    header = data[body_offset]
    if header & 0x03 == 0x02:                 # tiny format
        code_size = header >> 2
        code_start = body_offset + 1
    else:                                     # fat format
        flags_size = struct.unpack_from("<H", data, body_offset)[0]
        header_size = (flags_size >> 12) * 4
        code_size = struct.unpack_from("<I", data, body_offset + 4)[0]
        code_start = body_offset + header_size

    out = []
    at = code_start
    end = code_start + code_size
    while at < end:
        op = data[at]
        at += 1
        if op == 0xFE:                        # two byte opcodes
            second = data[at]
            at += 1
            at += 0 if second in (0x01, 0x02, 0x03, 0x04, 0x05, 0x0A, 0x0B, 0x0C, 0x0D,
                                  0x0E, 0x0F, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1A,
                                  0x1B, 0x1C, 0x1D, 0x1E) else 4
            continue
        name, width = ONE_BYTE.get(op, (None, WIDTHS.get(op)))
        if width is None:
            # Unknown opcode: stop rather than emit values from a misaligned read.
            break
        if name and name.startswith("ldc"):
            if name.endswith((".0", ".1", ".2", ".3", ".4", ".5", ".6", ".7", ".8")):
                out.append(("i4", int(name[-1])))
            elif name.endswith(".m1"):
                out.append(("i4", -1))
            elif name == "ldc.i4.s":
                out.append(("i4", struct.unpack_from("<b", data, at)[0]))
            elif name == "ldc.i4":
                out.append(("i4", struct.unpack_from("<i", data, at)[0]))
            elif name == "ldc.i8":
                out.append(("i8", struct.unpack_from("<q", data, at)[0]))
            elif name == "ldc.r4":
                out.append(("r4", struct.unpack_from("<f", data, at)[0]))
            elif name == "ldc.r8":
                out.append(("r8", struct.unpack_from("<d", data, at)[0]))
        at += width
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--assembly", default=DEFAULT_ASSEMBLY)
    parser.add_argument("--types", help="list types whose name matches (case-insensitive)")
    parser.add_argument("--methods", help="list methods on types matching this")
    parser.add_argument("--il", help="TYPE.METHOD - decode constants from that method")
    args = parser.parse_args()

    assembly = Assembly(args.assembly)
    print(f"loaded {args.assembly}", file=sys.stderr)
    print(f"types={assembly.row_counts.get(2,0)} methods={assembly.row_counts.get(6,0)}", file=sys.stderr)

    if args.types:
        needle = args.types.lower()
        for _index, namespace, name, _methods in assembly.types():
            if needle in name.lower() or needle in namespace.lower():
                print(f"{namespace}.{name}" if namespace else name)

    if args.methods:
        needle = args.methods.lower()
        for index, namespace, name, _methods in assembly.types():
            if needle not in name.lower() and needle not in namespace.lower():
                continue
            print(f"\n=== {namespace}.{name}" if namespace else f"\n=== {name}")
            for _row, method_name, rva, _flags in assembly.methods_of(index):
                print(f"    {method_name}  rva={rva:#x}")

    if args.il:
        type_needle, _, method_needle = args.il.rpartition(".")
        for index, namespace, name, _methods in assembly.types():
            if type_needle.lower() not in name.lower():
                continue
            for _row, method_name, rva, _flags in assembly.methods_of(index):
                if method_needle.lower() not in method_name.lower() or not rva:
                    continue
                offset = assembly.rva_to_offset(rva)
                values = decode_constants(assembly.data, offset)
                print(f"\n{namespace}.{name}::{method_name}")
                for kind, value in values:
                    print(f"    {kind:<3} {value}")


if __name__ == "__main__":
    main()
