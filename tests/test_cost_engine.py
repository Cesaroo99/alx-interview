import unittest

from visa_copilot_ai.cost_engine import FeeInput, compute_cost_engine


class TestCostEngine(unittest.TestCase):
    def test_partial_input_produces_provisional_total(self):
        r = compute_cost_engine(
            destination_region="Zone Schengen",
            visa_type="Tourisme",
            currency="EUR",
            fees=[
                FeeInput(category="visa_fee", label="Frais visa", amount=90, official=True, optional=False),
                FeeInput(category="service", label="Frais service", amount=None, official=True, optional=False),
                FeeInput(category="insurance", label="Assurance", amount=40, official=False, optional=True),
            ],
        )
        self.assertEqual(r.currency, "EUR")
        self.assertAlmostEqual(r.total_estimated, 130.0)
        self.assertAlmostEqual(r.total_official, 90.0)
        self.assertAlmostEqual(r.total_optional, 40.0)
        self.assertEqual(r.unknown_count, 1)

    def test_duplicate_is_flagged(self):
        r = compute_cost_engine(
            destination_region="USA",
            visa_type="B1/B2",
            currency="USD",
            fees=[
                FeeInput(category="visa_fee", label="Visa fee", amount=185, official=True, optional=False),
                FeeInput(category="visa_fee", label="Visa fee", amount=185, official=True, optional=False),
            ],
        )
        self.assertTrue(any("Doublon" in a.reason for a in r.suspicious_alerts))

    def test_agent_like_label_is_flagged(self):
        r = compute_cost_engine(
            destination_region="Canada",
            visa_type="Visitor",
            currency="USD",
            fees=[
                FeeInput(category="other", label="Agent fee", amount=300, official=False, optional=False),
            ],
        )
        self.assertTrue(any("non officiel" in a.reason.lower() for a in r.suspicious_alerts))


if __name__ == "__main__":
    unittest.main()

