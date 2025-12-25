import unittest

from visa_copilot_ai.appointments import estimate_costs
from visa_copilot_ai.form_guidance import get_field_guidance
from visa_copilot_ai.models import EmploymentStatus, TravelPurpose, UserProfile
from visa_copilot_ai.refusal import explain_refusal
from visa_copilot_ai.travel_intelligence import generate_travel_plan


class TestOtherModules(unittest.TestCase):
    def test_travel_plan_duration(self) -> None:
        p = UserProfile(
            nationality="Tunisie",
            age=30,
            profession="Comptable",
            employment_status=EmploymentStatus.EMPLOYED,
            travel_purpose=TravelPurpose.TOURISM,
        )
        r = generate_travel_plan(
            p,
            destination="Paris, France",
            start_date="2026-02-10",
            end_date="2026-02-12",
            estimated_budget_usd=300,
        )
        self.assertEqual(r.duration_days, 3)
        self.assertEqual(len(r.itinerary), 3)

    def test_refusal_has_plan_b(self) -> None:
        r = explain_refusal(refusal_reasons=["insufficient_funds"])
        self.assertGreaterEqual(len(r.plan_b_options), 2)
        self.assertTrue(any("financ" in x.lower() for x in r.likely_root_causes))

    def test_estimate_costs_total(self) -> None:
        r = estimate_costs(destination_region="Schengen", visa_type="tourism", currency="EUR", visa_fee=90, service_fee=30)
        self.assertAlmostEqual(r.total, 120.0)

    def test_field_guidance_profession_suggests_profile(self) -> None:
        p = UserProfile(nationality="Maroc", age=28, profession="Développeur", employment_status=EmploymentStatus.EMPLOYED)
        g = get_field_guidance(form_type="generic", field_name="profession", profile=p)
        self.assertEqual(g.suggested_value, "Développeur")


if __name__ == "__main__":
    unittest.main()

