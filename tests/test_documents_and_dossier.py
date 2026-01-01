import unittest
from datetime import date, timedelta

from visa_copilot_ai.dossier import verify_dossier
from visa_copilot_ai.documents import Document, DocumentType, check_documents
from visa_copilot_ai.models import EmploymentStatus, FinancialProfile, TravelPurpose, UserProfile


class TestDocumentsAndDossier(unittest.TestCase):
    def test_passport_expiry_warning(self) -> None:
        soon = date.today() + timedelta(days=30)
        docs = [
            Document(doc_id="p", doc_type=DocumentType.PASSPORT, expires_date=soon),
            Document(doc_id="b", doc_type=DocumentType.BANK_STATEMENT, extracted={"issued_date": date.today().isoformat()}),
        ]
        res = check_documents(docs, visa_type="tourism", destination_region="Schengen")
        self.assertTrue(any(i.code == "PASSPORT_EXPIRY_SOON" for i in res.issues))

    def test_evidence_for_missing_passport_fields(self) -> None:
        docs = [
            Document(doc_id="p", doc_type=DocumentType.PASSPORT, extracted={"expires_date": "2030-01-01"}),
        ]
        res = check_documents(docs, visa_type="tourism", destination_region="Schengen")
        missing_name = [i for i in res.issues if i.code == "PASSPORT_NAME_MISSING"]
        missing_no = [i for i in res.issues if i.code == "PASSPORT_NUMBER_MISSING"]
        self.assertTrue(missing_name and missing_name[0].evidence)
        self.assertTrue(missing_no and missing_no[0].evidence)
        self.assertEqual(missing_name[0].evidence[0].doc_id, "p")
        self.assertEqual(missing_name[0].evidence[0].extracted_key, "full_name")
        self.assertFalse(missing_name[0].evidence[0].present)

    def test_bank_issued_date_unknown_produces_issue_with_evidence(self) -> None:
        docs = [
            Document(doc_id="p", doc_type=DocumentType.PASSPORT, extracted={"expires_date": "2030-01-01", "full_name": "A B"}),
            Document(doc_id="b", doc_type=DocumentType.BANK_STATEMENT, extracted={}),
        ]
        res = check_documents(docs, visa_type="tourism", destination_region="Schengen")
        issue = [i for i in res.issues if i.code == "BANK_STATEMENT_ISSUED_UNKNOWN"]
        self.assertTrue(issue and issue[0].evidence)
        self.assertEqual(issue[0].evidence[0].doc_id, "b")
        self.assertEqual(issue[0].evidence[0].extracted_key, "issued_date")

    def test_name_mismatch_between_passport_and_bank_statement(self) -> None:
        docs = [
            Document(doc_id="p", doc_type=DocumentType.PASSPORT, extracted={"expires_date": "2030-01-01", "full_name": "John Doe"}),
            Document(
                doc_id="b",
                doc_type=DocumentType.BANK_STATEMENT,
                extracted={"issued_date": date.today().isoformat(), "account_holder_name": "Jane Doe"},
            ),
        ]
        res = check_documents(docs, visa_type="tourism", destination_region="Schengen")
        mismatch = [i for i in res.issues if i.code == "NAME_MISMATCH_PASSPORT_BANK"]
        self.assertTrue(mismatch and len(mismatch[0].evidence) >= 2)

    def test_insurance_not_covering_trip(self) -> None:
        docs = [
            Document(doc_id="p", doc_type=DocumentType.PASSPORT, extracted={"expires_date": "2030-01-01"}),
            Document(doc_id="i", doc_type=DocumentType.ITINERARY, extracted={"travel_start_date": "2026-05-01", "travel_end_date": "2026-05-10"}),
            Document(
                doc_id="ins",
                doc_type=DocumentType.TRAVEL_INSURANCE,
                extracted={"coverage_start_date": "2026-05-03", "coverage_end_date": "2026-05-08"},
            ),
        ]
        res = check_documents(docs, visa_type="tourism", destination_region="Schengen")
        self.assertTrue(any(i.code == "INSURANCE_NOT_COVERING_TRIP" for i in res.issues))

    def test_funds_estimate_low_when_balance_too_small_for_duration(self) -> None:
        docs = [
            Document(doc_id="p", doc_type=DocumentType.PASSPORT, extracted={"expires_date": "2030-01-01"}),
            Document(doc_id="i", doc_type=DocumentType.ITINERARY, extracted={"travel_start_date": "2026-05-01", "travel_end_date": "2026-05-10"}),
            Document(doc_id="b", doc_type=DocumentType.BANK_STATEMENT, extracted={"issued_date": date.today().isoformat(), "ending_balance_usd": 200}),
        ]
        res = check_documents(docs, visa_type="tourism", destination_region="Schengen")
        self.assertTrue(any(i.code == "FUNDS_ESTIMATE_LOW" for i in res.issues))

    def test_dossier_readiness_level_not_ready_when_missing_many_docs(self) -> None:
        profile = UserProfile(
            nationality="Maroc",
            age=28,
            profession="Développeur",
            employment_status=EmploymentStatus.EMPLOYED,
            travel_purpose=TravelPurpose.TOURISM,
            travel_history_trips_last_5y=0,
            prior_visa_refusals=0,
            financial_profile=FinancialProfile(monthly_income_usd=1200, savings_usd=500, sponsor_available=False),
        )
        docs = [Document(doc_id="p", doc_type=DocumentType.PASSPORT, extracted={"expires_date": "2030-01-01"})]
        r = verify_dossier(profile, docs, visa_type="Visa visiteur / tourisme", destination_region="Zone Schengen")
        self.assertIn(r.readiness_level, {"not_ready", "almost_ready"})
        self.assertGreaterEqual(len(r.key_risks), 1)


if __name__ == "__main__":
    unittest.main()

