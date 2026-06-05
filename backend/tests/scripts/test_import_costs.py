"""Tests del parser de import_costs_from_xlsx.

Solo testea el layer de parseo (sin DB) contra fixtures reales del zip.
La aplicación a DB se valida en dry-run en CI/local antes de --commit.
"""
from __future__ import annotations

from decimal import Decimal
from pathlib import Path

import pytest

from scripts.import_costs_from_xlsx import (
    CONCEPT_MAP,
    GARMENT_MAP,
    SCHOOL_MAP,
    XlsxData,
    classify_size,
    map_concept,
    normalize,
    parse_filename,
    parse_xlsx,
)

FIXTURES = Path(__file__).parent / "fixtures"


# -----------------------------------------------------------------------------
# Unit tests — helpers
# -----------------------------------------------------------------------------

class TestNormalize:
    def test_lowers_and_strips(self):
        assert normalize("  Marquilla Logo  ") == "marquilla logo"

    def test_collapses_spaces(self):
        assert normalize("Tela    Principal") == "tela principal"

    def test_none_returns_empty(self):
        assert normalize(None) == ""


class TestClassifySize:
    @pytest.mark.parametrize("size,expected", [
        ("2", "numeric"),
        ("6", "numeric"),
        ("16", "numeric"),
        ("S", "letters"),
        ("XL", "letters"),
        ("XXL", "letters"),
        ("Todas", "unknown"),
        ("", "unknown"),
    ])
    def test_classification(self, size, expected):
        assert classify_size(size) == expected


class TestParseFilename:
    @pytest.mark.parametrize("filename,expected", [
        ("Colegio_Comfama_Camiseta.xlsx", ("Comfama", "Camiseta")),
        ("Colegio_FHB_Camiseta_Fisica.xlsx", ("FHB", "Camiseta_Fisica")),
        ("Colegio_BuenComienzo_Sudadera.xlsx", ("BuenComienzo", "Sudadera")),
        ("Jomber_Pumarejo_Pinal_Caracas.xlsx", ("Jomber", "Pumarejo_Pinal_Caracas")),
        (" Jomber_Pumarejo_Pinal_Caracas.xlsx", ("Jomber", "Pumarejo_Pinal_Caracas")),
        ("invalid_name.xlsx", (None, None)),
    ])
    def test_parse(self, filename, expected):
        assert parse_filename(filename) == expected


class TestMapConcept:
    def test_simple_concepts(self):
        assert map_concept("corte") == ("tailoring", None)
        assert map_concept("bordado") == ("embroidery", None)
        assert map_concept("marquilla logo") == ("labels", None)

    def test_block_concepts(self):
        assert map_concept("cierre separable numericas") == ("other", "numeric")
        assert map_concept("confeccion tallas letras") == ("tailoring", "letters")

    def test_unknown_concept(self):
        assert map_concept("concepto inventado") == (None, None)


class TestMappings:
    def test_all_school_codes_have_patterns(self):
        for code, patterns in SCHOOL_MAP.items():
            assert patterns, f"school code {code} sin patterns"

    def test_all_garment_codes_have_patterns(self):
        for code, patterns in GARMENT_MAP.items():
            assert patterns, f"garment code {code} sin patterns"

    def test_concept_codes_are_valid_templates(self):
        valid = {"fabric", "tailoring", "embroidery", "collars_cuffs",
                 "labels", "bags", "thread", "other"}
        for concept, template in CONCEPT_MAP.items():
            assert template in valid, f"{concept} mapea a template inválido: {template}"


# -----------------------------------------------------------------------------
# Integration test del parser con fixture real (Comfama Camiseta — canónico)
# -----------------------------------------------------------------------------

class TestParseComfamaCamiseta:
    @pytest.fixture
    def data(self) -> XlsxData:
        return parse_xlsx(FIXTURES / "Colegio_Comfama_Camiseta.xlsx")

    def test_metadata(self, data):
        assert data.filename == "Colegio_Comfama_Camiseta.xlsx"
        assert data.school_code == "Comfama"
        assert data.prenda_code == "Camiseta"

    def test_telas_principal_y_colores(self, data):
        assert len(data.telas) == 2
        principal = next(t for t in data.telas if t.tipo == "principal")
        assert principal.name == "Lacost"
        assert principal.precio_por_metro == Decimal("17900")
        assert principal.row_idx == 4

        colores = next(t for t in data.telas if t.tipo == "colores")
        assert colores.name == "Poli/Lacost"
        assert colores.precio_por_metro == Decimal("11400")

    def test_insumos_mapeados_correctamente(self, data):
        # 7 conceptos en el xlsx, todos mapeables
        assert len(data.insumos) == 7
        templates = {ins.template_code for ins in data.insumos}
        assert "labels" in templates       # Marquilla logo + Talla c/u
        assert "tailoring" in templates    # Confeccion + Corte
        assert "bags" in templates         # Bolsa + cinta
        assert "embroidery" in templates   # Bordado
        assert "other" in templates        # Broche

    def test_sizes_calculadas_y_pendiente(self, data):
        # Tallas 2,4,6,8 con costo calculado + talla 10 Pendiente
        sized = {s.size: s for s in data.sizes}
        assert "2" in sized or "2.0" in sized
        # Pendiente debe estar marcada
        pendientes = [s for s in data.sizes if s.is_pendiente]
        assert len(pendientes) >= 1
        assert any("10" in s.size for s in pendientes)

    def test_costo_tela_calculado(self, data):
        # Talla 2: 60cm de Lacost (17900/m), 2 unidades por corte → costo c/u = (60/100)*17900/2 = 5370
        s2 = next((s for s in data.sizes if s.size in ("2", "2.0")), None)
        assert s2 is not None
        assert s2.costo_unitario == Decimal("5370.00")

    def test_complemento_rib_flat_2300(self, data):
        # Tela complemento RIB es flat 2300 (no por talla)
        assert data.complemento is not None
        assert data.complemento.is_flat is True
        assert data.complemento.flat_amount == Decimal("2300")

    def test_gaps_anotan_talla_pendiente(self, data):
        assert any("pendiente" in g.lower() for g in data.gaps)


# -----------------------------------------------------------------------------
# Test del parser con un xlsx complejo (Pumarejo Chompa — mixed sizes)
# -----------------------------------------------------------------------------

class TestParsePumarejoChompa:
    @pytest.fixture
    def data(self) -> XlsxData:
        return parse_xlsx(FIXTURES / "Colegio_Pumarejo_Chompa.xlsx")

    def test_detects_block_concepts(self, data):
        # Cierre separable numericas + letras → ambos como 'other' con block distinto
        cierres = [ins for ins in data.insumos if "cierre" in ins.concept_norm]
        assert len(cierres) >= 2
        blocks = {ins.applies_to_block for ins in cierres}
        assert "numeric" in blocks
        assert "letters" in blocks

    def test_sizes_include_numeric_and_letters(self, data):
        sizes_all = [s.size for s in data.sizes]
        assert any(s in ("6", "6.0", "8", "8.0", "10", "10.0") for s in sizes_all)
        assert any(s in ("S", "M", "L", "XL", "XXL") for s in sizes_all)
