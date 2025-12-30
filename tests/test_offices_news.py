import unittest

from visa_copilot_ai.offices import list_offices
from visa_copilot_ai.news import list_news


class TestOfficesAndNews(unittest.TestCase):
    def test_offices_filters_work(self):
        data = {
            "offices": [
                {"id": "1", "type": "embassy", "name": "A", "country": "France", "city": "Paris", "address": "x", "services": ["visa"]},
                {"id": "2", "type": "vfs", "name": "B", "country": "France", "city": "Lyon", "address": "y", "services": ["biometrics"]},
                {"id": "3", "type": "consulate", "name": "C", "country": "Canada", "city": "Paris", "address": "z", "services": ["passport"]},
            ]
        }
        out = list_offices(country="France", data=data)
        self.assertEqual(len(out), 2)
        out2 = list_offices(country="France", city="Paris", service="visa", data=data)
        self.assertEqual(len(out2), 1)
        self.assertEqual(out2[0]["id"], "1")
        out3 = list_offices(office_type="vfs", data=data)
        self.assertEqual(len(out3), 1)
        self.assertEqual(out3[0]["id"], "2")

    def test_news_filters_and_sort(self):
        data = {
            "items": [
                {"id": "a", "category": "visa_news", "country": "Canada", "title": "T1", "published_at": "2025-12-20T10:00:00Z", "status": "published"},
                {"id": "b", "category": "law_change", "country": "Canada", "title": "T2", "published_at": "2025-12-21T10:00:00Z", "status": "published"},
                {"id": "c", "category": "law_change", "country": "France", "title": "T3", "published_at": "2025-12-22T10:00:00Z", "status": "draft"},
            ]
        }
        out = list_news(country="Canada", data=data, limit=10)
        self.assertEqual([x["id"] for x in out], ["b", "a"])  # sorted desc
        out2 = list_news(country="Canada", category="law_change", data=data)
        self.assertEqual(len(out2), 1)
        self.assertEqual(out2[0]["id"], "b")


if __name__ == "__main__":
    unittest.main()

