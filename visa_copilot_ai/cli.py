from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from .diagnostic import diagnostic_to_dict, run_visa_diagnostic
from .models import EmploymentStatus, FinancialProfile, TravelPurpose, UserProfile


def _parse_profile(data: dict[str, Any]) -> UserProfile:
    fp_data = data.get("financial_profile")
    fp = None
    if isinstance(fp_data, dict):
        fp = FinancialProfile(
            monthly_income_usd=fp_data.get("monthly_income_usd"),
            savings_usd=fp_data.get("savings_usd"),
            sponsor_available=fp_data.get("sponsor_available"),
        )

    employment_status = data.get("employment_status", EmploymentStatus.OTHER.value)
    travel_purpose = data.get("travel_purpose", TravelPurpose.OTHER.value)

    return UserProfile(
        nationality=str(data.get("nationality", "") or ""),
        age=int(data.get("age", 0) or 0),
        profession=str(data.get("profession", "") or ""),
        employment_status=EmploymentStatus(str(employment_status)),
        travel_purpose=TravelPurpose(str(travel_purpose)),
        travel_history_trips_last_5y=int(data.get("travel_history_trips_last_5y", 0) or 0),
        prior_visa_refusals=int(data.get("prior_visa_refusals", 0) or 0),
        destination_region_hint=data.get("destination_region_hint"),
        financial_profile=fp,
        notes=str(data.get("notes", "") or ""),
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="visa-copilot-ai",
        description="Visa Copilot AI — diagnostic visa-first (guidance, explicable, sans soumission).",
    )
    parser.add_argument(
        "--profile",
        required=True,
        help="Chemin vers un fichier JSON contenant le profil utilisateur.",
    )
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Sortie JSON indentée.",
    )
    args = parser.parse_args(argv)

    try:
        with open(args.profile, "r", encoding="utf-8") as f:
            raw = json.load(f)
        if not isinstance(raw, dict):
            raise ValueError("Le JSON doit être un objet.")
        profile = _parse_profile(raw)
        result = run_visa_diagnostic(profile)
        payload = diagnostic_to_dict(result)
        if args.pretty:
            json.dump(payload, sys.stdout, ensure_ascii=False, indent=2, sort_keys=True)
        else:
            json.dump(payload, sys.stdout, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
        sys.stdout.write("\n")
        return 0
    except Exception as e:  # noqa: BLE001 - CLI tool
        sys.stderr.write(f"Erreur: {e}\n")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

