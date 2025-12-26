import unittest

from visa_copilot_ai.news_ingest import ingest_news


class TestNewsIngest(unittest.TestCase):
    def test_ingest_rss_parses_items(self):
        rss = """<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Example</title>
    <item>
      <title>News A</title>
      <link>https://example.org/a</link>
      <pubDate>2025-12-20T10:00:00Z</pubDate>
    </item>
    <item>
      <title>News B</title>
      <link>https://example.org/b</link>
      <pubDate>2025-12-21T10:00:00Z</pubDate>
    </item>
  </channel>
</rss>
"""

        def fetcher(_url: str) -> str:
            return rss

        sources = [
            {
                "id": "s1",
                "country": "Canada",
                "category": "visa_news",
                "source_name": "Gov",
                "source_url": "https://example.org",
                "feed_url": "https://example.org/rss",
                "source_type": "government",
                "default_tags": ["work"],
            }
        ]
        items, meta = ingest_news(sources=sources, existing_items=[], fetcher=fetcher, max_per_source=10, max_total=100)
        self.assertTrue(meta.ok)
        self.assertEqual(meta.fetched_sources, 1)
        self.assertEqual(len(items), 2)
        self.assertTrue(all(x["country"] == "Canada" for x in items))
        self.assertTrue(all(x["category"] == "visa_news" for x in items))

    def test_ingest_dedups_existing_by_id(self):
        rss = """<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item><title>News A</title><link>https://example.org/a</link><pubDate>2025-12-20T10:00:00Z</pubDate></item>
</channel></rss>
"""

        def fetcher(_url: str) -> str:
            return rss

        sources = [
            {"id": "s1", "country": "Canada", "category": "visa_news", "feed_url": "https://example.org/rss", "source_type": "government"}
        ]

        first_items, _ = ingest_news(sources=sources, existing_items=[], fetcher=fetcher)
        # Run again with existing: should not create duplicates
        second_items, meta2 = ingest_news(sources=sources, existing_items=first_items, fetcher=fetcher)
        self.assertEqual(len(second_items), len(first_items))
        self.assertEqual(meta2.new_items, 0)


if __name__ == "__main__":
    unittest.main()

