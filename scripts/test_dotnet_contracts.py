"""Synthetic metadata checks; vendor installation not needed by the tests."""
import importlib.util
from pathlib import Path
import struct
from types import SimpleNamespace
import unittest

spec = importlib.util.spec_from_file_location("contracts", Path(__file__).with_name("dotnet-contracts.py"))
contracts = importlib.util.module_from_spec(spec)
spec.loader.exec_module(contracts)


class ContractsTests(unittest.TestCase):
    def test_compressed_integer_boundaries(self):
        for data, expected in [(b"\x00", 0), (b"\x7f", 127), (b"\x80\x80", 128),
                               (b"\xbf\xff", 16383), (b"\xc0\x00\x40\x00", 16384),
                               (b"\xdf\xff\xff\xff", 0x1fffffff)]:
            self.assertEqual(contracts.compressed(data), (expected, len(data)))

    def test_compressed_rejects_truncated_reserved_and_outside(self):
        for data in (b"", b"\x80", b"\xc0\x00", b"\xe0", b"\xff"):
            with self.assertRaises(ValueError):
                contracts.compressed(data)
        with self.assertRaises(ValueError):
            contracts.compressed(b"\x00", 1)
        with self.assertRaises(ValueError):
            contracts.compressed(b"\x00", -1)

    def test_getter_scalar_and_enum_tokens(self):
        self.assertEqual(contracts.getter_type(b"\x20\x00\x08"), {"kind": "int32"})
        self.assertEqual(contracts.getter_type(b"\x00\x00\x0d"), {"kind": "float64"})
        self.assertEqual(contracts.getter_type(b"\x20\x00\x11\x08"), {"kind": "valuetype", "table": 2, "row": 2})
        self.assertEqual(contracts.getter_type(b"\x20\x00\x12\x09"), {"kind": "class", "table": 1, "row": 2})

    def test_unsupported_signatures_fail_without_guessing(self):
        for data in (b"", b"\x30\x00\x08", b"\x20\x01\x08\x08",
                     b"\x20\x00\x11\x00", b"\x20\x00\x11\x07",
                     b"\x20\x00\x08\x00", b"\x20\x00\x1d\x08"):
            with self.assertRaises(ValueError):
                contracts.getter_type(data)

    def test_blob_bounds(self):
        assembly = SimpleNamespace(data=b"\x00\x03abc\x05x", streams={"#Blob": (0, 8)})
        self.assertEqual(contracts.blob(assembly, 1), b"abc")
        for offset in (-1, 8, 5):
            with self.assertRaises(ValueError):
                contracts.blob(assembly, offset)

    def test_constants_preserve_signed_unsigned_and_double(self):
        self.assertEqual(contracts.constant_value(8, struct.pack("<i", -7)), -7)
        self.assertEqual(contracts.constant_value(9, struct.pack("<I", 0xffffffff)), 0xffffffff)
        self.assertEqual(contracts.constant_value(13, struct.pack("<d", .3)), .3)
        for kind, data in [(8, b"\x00"), (14, b"text")]:
            with self.assertRaises(ValueError):
                contracts.constant_value(kind, data)

    def test_typedef_resolution_and_invalid_rows(self):
        assembly = SimpleNamespace(row_counts={2: 1}, rows={2: [(0, 1, 2, 0, 0, 0)]},
                                   string_at=lambda n: {1: "Mode", 2: "Example"}[n])
        self.assertEqual(contracts.resolve_type(assembly, 2, 1), "Example.Mode")
        for row in (0, 2):
            with self.assertRaises(ValueError):
                contracts.resolve_type(assembly, 2, row)

    def test_constant_table_field_vs_parameter_parent(self):
        # One numeric Field literal and one Param default; only the field is
        # eligible as an enum member. Real Constant bytes, not mocked values.
        assembly = SimpleNamespace(row_counts={11: 2}, streams={"#~": (0, 44), "#Blob": (44, 11)},
                                   _row_size=lambda t: 0,
                                   _blob_index=lambda reader: reader.u2())
        first = struct.pack("<BBHH", 8, 0, 4, 1)
        second = struct.pack("<BBHH", 8, 0, 5, 6)
        assembly.data = bytes(28) + first + second + bytes(4) + b"\0\x04" + struct.pack("<i", 7) + b"\x04" + struct.pack("<i", 9)
        self.assertEqual(contracts.field_constants(assembly), {1: 7})

    def test_later_tables_explicitly_outside_tool_scope(self):
        with self.assertRaises(ValueError):
            contracts.early_table_offset(None, 12)


if __name__ == "__main__":
    unittest.main()
