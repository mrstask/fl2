import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
UI_MATRIX_DOC = ROOT / "docs" / "testing" / "rendering_ui_test_matrix.md"


class TestRenderingUiReadiness(unittest.TestCase):
    def test_ui_matrix_document_exists(self) -> None:
        self.assertTrue(UI_MATRIX_DOC.exists(), f"Missing {UI_MATRIX_DOC}")

    def test_required_test_selectors_declared(self) -> None:
        content = UI_MATRIX_DOC.read_text(encoding="utf-8")
        selectors = (
            '[data-testid="render-canvas"]',
            '[data-testid="fps-counter"]',
            '[data-testid="camera-zoom-value"]',
            '[data-testid="overlay-toggle-path"]',
            '[data-testid="overlay-toggle-los"]',
            '[data-testid="debug-picked-tile"]',
            '[data-testid="debug-picked-entity"]',
        )
        for selector in selectors:
            self.assertIn(selector, content, f"Missing selector contract: {selector}")

    def test_ui_scenarios_cover_all_rendering_steps(self) -> None:
        content = UI_MATRIX_DOC.read_text(encoding="utf-8")
        scenario_ids = re.findall(r"UI-RND-(\d{2})", content)
        self.assertEqual(
            len(set(scenario_ids)),
            10,
            "UI matrix must define exactly 10 unique scenarios (UI-RND-01..10)",
        )

    def test_ui_validation_rules_are_explicit(self) -> None:
        content = UI_MATRIX_DOC.read_text(encoding="utf-8")
        required_sections = (
            "setup preconditions",
            "test actions",
            "expected visual outcomes",
            "measurable assertion",
        )
        for section in required_sections:
            self.assertIn(section, content, f"Missing rule: {section}")


if __name__ == "__main__":
    unittest.main()

