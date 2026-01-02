import unittest

from visa_copilot_ai.models import EmploymentStatus, TravelPurpose, UserProfile
from visa_copilot_ai.procedure_timeline import generate_procedure_timeline


class TestProcedureTimeline(unittest.TestCase):
    def test_blocking_logic(self):
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
        out = generate_procedure_timeline(
            profile=profile,
            destination_region="Zone Schengen",
            visa_type="Visa visiteur / tourisme",
            document_types_present=[],
            dossier_ready=False,
            travel_plan_ready=False,
            costs_ready=False,
            appointment_ready=False,
            submission_started=False,
            manual_completed_step_ids=[],
        )
        # Itinerary should be blocked if docs not ready
        itin = [s for s in out.steps if s.id == "itinerary"][0]
        self.assertEqual(itin.status, "Blocked")


if __name__ == "__main__":
    unittest.main()

