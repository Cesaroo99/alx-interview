import unittest

from visa_copilot_ai.refusal import analyze_refusal


class TestRefusalAnalyze(unittest.TestCase):
    def test_extracts_insufficient_funds_from_text(self):
        out = analyze_refusal(
            refusal_letter_text="Your application was refused due to insufficient means of subsistence for the stay.",
            refusal_reasons=None,
            prior_refusals_count=0,
            travel_objective="tourism",
        )
        reasons = [x["reason"] for x in as_dict(out)["A_refusal_summary"]]
        self.assertIn("insufficient_funds", reasons)

    def test_outputs_structure_has_A_B_C(self):
        out = analyze_refusal(
            refusal_letter_text="purpose and conditions of intended stay not reliable",
            refusal_reasons=None,
            prior_refusals_count=2,
            travel_objective="business",
        )
        d = as_dict(out)
        self.assertTrue(len(d["A_refusal_summary"]) >= 1)
        self.assertTrue(len(d["B_corrective_steps"]) >= 1)
        self.assertTrue(len(d["C_plan_b_options"]) >= 1)
        self.assertTrue(len(d["patterns"]) >= 1)
        self.assertIn("Souhaitez-vous", d["final_user_prompt"])


def as_dict(out):
    # local import to avoid circulars
    from visa_copilot_ai.refusal import refusal_decision_support_to_dict

    return refusal_decision_support_to_dict(out)


if __name__ == "__main__":
    unittest.main()

