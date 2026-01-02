import unittest

from visa_copilot_ai.final_verification import run_final_verification
from visa_copilot_ai.documents import Document, DocumentType
from visa_copilot_ai.models import EmploymentStatus, TravelPurpose, UserProfile


class TestFinalVerification(unittest.TestCase):
    def test_missing_passport_blocks(self):
        profile = UserProfile(
            nationality="Morocco",
            age=30,
            profession="Engineer",
            employment_status=EmploymentStatus.EMPLOYED,
            travel_purpose=TravelPurpose.TOURISM,
            travel_history_trips_last_5y=1,
            prior_visa_refusals=0,
            destination_region_hint="Schengen",
            financial_profile=None,
            notes="",
            country_of_residence="Morocco",
        )
        docs = [Document(doc_id="d1", doc_type=DocumentType.BANK_STATEMENT, filename="bank.pdf", extracted={"issued_date": "2026-01-01"})]
        out = run_final_verification(
            profile=profile,
            destination_region="Zone Schengen",
            visa_type="Visa visiteur / tourisme",
            documents=docs,
            travel_signals={"travel_plan_ready": False, "travel_high_risks": 0},
            cost_signals={"costs_ready": False, "unknown_count": 0, "suspicious_fees_high": 0},
            timeline_signals={"appointment_ready": False, "overlap_conflicts": 0},
            completed_finding_ids=[],
        )
        self.assertEqual(out.readiness_status, "Blocked")
        self.assertTrue(out.counts.get("High", 0) >= 1)


if __name__ == "__main__":
    unittest.main()

