import unittest

from visa_copilot_ai.eligibility import EligibilityUserProfile, LanguageEvidence, evaluate_visa_eligibility


class TestEligibility(unittest.TestCase):
    def test_returns_ai_reasoning(self) -> None:
        user = EligibilityUserProfile(
            age=28,
            nationality="Maroc",
            destination_country="canada",
            education_level="bachelor",
            field_of_study="Informatique",
            years_experience=3,
            marital_status="single",
            language=LanguageEvidence(band=6, exam="IELTS"),
            financial_capacity_usd=6000,
            sponsor_available=False,
            travel_history_trips_last_5y=2,
            prior_visa_refusals=0,
        )
        res = evaluate_visa_eligibility(user, country="canada")
        self.assertGreaterEqual(len(res), 1)
        self.assertTrue(isinstance(res[0].ai, dict))
        self.assertEqual(res[0].ai.get("mode"), "ai_rules_reasoner")

    def test_color_mapping_bounds(self) -> None:
        user = EligibilityUserProfile(
            age=28,
            nationality="Maroc",
            destination_country="default",
            education_level="none",
            years_experience=0,
            language=LanguageEvidence(band=0, exam="self"),
            financial_capacity_usd=0,
            sponsor_available=False,
            travel_history_trips_last_5y=0,
            prior_visa_refusals=2,
        )
        res = evaluate_visa_eligibility(user, country="default")
        self.assertIn(res[0].color, {"green", "orange", "red"})


if __name__ == "__main__":
    unittest.main()

