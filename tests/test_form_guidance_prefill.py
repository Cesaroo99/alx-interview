import unittest

from visa_copilot_ai.form_guidance import get_field_guidance
from visa_copilot_ai.models import EmploymentStatus, TravelPurpose, UserProfile


class TestFormGuidancePrefill(unittest.TestCase):
    def test_passport_number_from_context(self):
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
        g = get_field_guidance(form_type="schengen_visa", field_name="passport_number", profile=profile, context={"passport_number": "AB123456"})
        self.assertEqual(g.suggested_value, "AB123456")

    def test_full_name_from_context(self):
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
        g = get_field_guidance(form_type="schengen_visa", field_name="full_name", profile=profile, context={"full_name": "DOE JOHN"})
        self.assertEqual(g.suggested_value, "DOE JOHN")


if __name__ == "__main__":
    unittest.main()

