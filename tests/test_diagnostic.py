import unittest
from dataclasses import replace

from visa_copilot_ai.diagnostic import run_visa_diagnostic
from visa_copilot_ai.models import EmploymentStatus, FinancialProfile, TravelPurpose, UserProfile


class TestVisaDiagnostic(unittest.TestCase):
    def test_refusals_increase_risk(self) -> None:
        base = UserProfile(
            nationality="Maroc",
            age=30,
            profession="Ingénieur",
            employment_status=EmploymentStatus.EMPLOYED,
            travel_purpose=TravelPurpose.TOURISM,
            travel_history_trips_last_5y=3,
            prior_visa_refusals=0,
            financial_profile=FinancialProfile(monthly_income_usd=1500, savings_usd=3000, sponsor_available=False),
        )
        with_refusal = replace(base, prior_visa_refusals=1)
        r1 = run_visa_diagnostic(base)
        r2 = run_visa_diagnostic(with_refusal)
        self.assertLess(r1.refusal_risk_score, r2.refusal_risk_score)
        self.assertTrue(any("refus" in s.lower() for s in r2.key_risks))

    def test_no_travel_history_increases_risk(self) -> None:
        p0 = UserProfile(
            nationality="Cameroun",
            age=26,
            profession="Comptable",
            employment_status=EmploymentStatus.EMPLOYED,
            travel_purpose=TravelPurpose.TOURISM,
            travel_history_trips_last_5y=0,
            prior_visa_refusals=0,
            financial_profile=FinancialProfile(monthly_income_usd=1200, savings_usd=2500, sponsor_available=False),
        )
        p6 = replace(p0, travel_history_trips_last_5y=6)
        r0 = run_visa_diagnostic(p0)
        r6 = run_visa_diagnostic(p6)
        self.assertGreater(r0.refusal_risk_score, r6.refusal_risk_score)

    def test_disclaimers_and_anti_scam_always_present(self) -> None:
        p = UserProfile(nationality="", age=0, profession="")
        r = run_visa_diagnostic(p)
        self.assertGreaterEqual(len(r.disclaimers), 2)
        self.assertGreaterEqual(len(r.anti_scam_warnings), 2)

    def test_recommended_visa_type_matches_purpose(self) -> None:
        p = UserProfile(
            nationality="Tunisie",
            age=22,
            profession="Étudiant",
            employment_status=EmploymentStatus.STUDENT,
            travel_purpose=TravelPurpose.STUDY,
            travel_history_trips_last_5y=1,
            prior_visa_refusals=0,
        )
        r = run_visa_diagnostic(p)
        labels = [x.label.lower() for x in r.recommended_visa_types]
        self.assertTrue(any("étudiant" in s for s in labels))


if __name__ == "__main__":
    unittest.main()

