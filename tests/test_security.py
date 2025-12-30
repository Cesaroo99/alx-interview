import unittest

from visa_copilot_ai.security import verify_official_url


class TestSecurityModule(unittest.TestCase):
    def test_https_gov_domain_lowish_risk(self) -> None:
        v = verify_official_url("https://travel.state.gov/")
        self.assertEqual(v.scheme, "https")
        self.assertIn("state.gov", v.hostname)
        self.assertIn(v.risk_level, {"low", "medium"})

    def test_http_increases_risk(self) -> None:
        v = verify_official_url("http://example.com")
        self.assertEqual(v.risk_level, "high")

    def test_shortener_is_high_risk(self) -> None:
        v = verify_official_url("https://bit.ly/whatever")
        self.assertEqual(v.risk_level, "high")
        self.assertTrue(any("raccourci" in r.lower() for r in v.reasons))

    def test_punycode_flagged(self) -> None:
        v = verify_official_url("https://xn--example-9d0b.com")
        self.assertEqual(v.risk_level, "high")
        self.assertTrue(any("punycode" in r.lower() or "idn" in r.lower() for r in v.reasons))


if __name__ == "__main__":
    unittest.main()

