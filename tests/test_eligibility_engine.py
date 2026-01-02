import unittest

from visa_copilot_ai.eligibility_engine import run_visa_eligibility_engine
from visa_copilot_ai.eligibility import _load_rules


class TestEligibilityEngine(unittest.TestCase):
    def test_engine_requires_min_fields(self) -> None:
        out = run_visa_eligibility_engine({}, rules=_load_rules())
        self.assertFalse(out.get("ok"))
        self.assertIn("missing_required", out)

    def test_engine_happy_path(self) -> None:
        out = run_visa_eligibility_engine(
            {
                "identity": {"nationality": "Maroc", "country_of_residence": "Maroc", "age_range": "26–35"},
                "objective": {"purpose": "Tourism", "destinations": ["canada"]},
            },
            rules=_load_rules(),
        )
        self.assertTrue(out.get("ok"))
        self.assertIn("top_visa_options", out)
        self.assertTrue(isinstance(out.get("top_visa_options"), list))
        self.assertIn("profile_strength_score", out)


if __name__ == "__main__":
    unittest.main()

