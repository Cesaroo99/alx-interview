import unittest

from visa_copilot_ai.catalogs import load_catalog, list_portals, get_form_template, validate_form_draft


class TestCatalogs(unittest.TestCase):
    def test_portals_catalog_loads_and_filters(self):
        pack = load_catalog("portals.json")
        items = list_portals(data=pack.data, country="uk", provider_type=None, q=None)
        self.assertTrue(any("uk" in (x.get("country") or "") for x in items))

    def test_forms_validate_required(self):
        pack = load_catalog("forms_catalog.json")
        tpl = get_form_template(data=pack.data, form_type="schengen_visa")
        self.assertIsNotNone(tpl)
        out = validate_form_draft(template=tpl, draft_values={"nationality": "morocco"})
        self.assertFalse(out["ok"])
        self.assertTrue(any("Champ requis" in e for e in out["errors"]))


if __name__ == "__main__":
    unittest.main()

