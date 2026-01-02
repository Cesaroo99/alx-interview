import unittest

from visa_copilot_ai.ocr import _extract_fields_from_text


class TestOcrExtractFields(unittest.TestCase):
    def test_passport_number_extraction(self):
        t = "Passport No: AB1234567\nDate of expiry: 2029-10-01"
        out = _extract_fields_from_text(t)
        self.assertEqual(out.get("passport_number"), "AB1234567")
        self.assertEqual(out.get("expires_date"), "2029-10-01")

    def test_bank_balance_extraction(self):
        t = "Closing balance: 1,234.50"
        out = _extract_fields_from_text(t)
        self.assertTrue(out.get("ending_balance_usd") in (1234.5, 1234.50))


if __name__ == "__main__":
    unittest.main()

