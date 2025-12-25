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

