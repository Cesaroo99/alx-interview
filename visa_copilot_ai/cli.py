from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from .appointments import appointment_cost_to_dict, estimate_costs
from .diagnostic import diagnostic_to_dict, run_visa_diagnostic
from .dossier import dossier_to_dict, verify_dossier
from .documents import Document, DocumentType
from .form_guidance import field_guidance_to_dict, get_field_guidance
from .models import EmploymentStatus, FinancialProfile, TravelPurpose, UserProfile
from .refusal import explain_refusal, refusal_to_dict
from .security import security_verdict_to_dict, verify_official_url
from .travel_intelligence import generate_travel_plan, travel_plan_to_dict


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

def _parse_documents(data: Any) -> list[Document]:
    if data is None:
        return []
    if not isinstance(data, list):
        raise ValueError("documents doit être une liste.")
    docs: list[Document] = []
    for i, raw in enumerate(data):
        if not isinstance(raw, dict):
            raise ValueError(f"documents[{i}] doit être un objet.")
        dtype = raw.get("doc_type", DocumentType.OTHER.value)
        docs.append(
            Document(
                doc_id=str(raw.get("doc_id", f"doc_{i}")),
                doc_type=DocumentType(str(dtype)),
                filename=str(raw.get("filename", "") or ""),
                issued_date=None,
                expires_date=None,
                extracted=dict(raw.get("extracted", {}) or {}),
                notes=str(raw.get("notes", "") or ""),
            )
        )
    return docs


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)

    # Compat: ancienne forme
    #   python -m visa_copilot_ai --profile ... [--pretty]
    # On la mappe vers: diagnose --profile ...
    if "--profile" in argv and (len(argv) == 0 or (argv and argv[0] not in {"diagnose", "verify-url"})):
        argv = ["diagnose", *argv]

    parser = argparse.ArgumentParser(
        prog="visa-copilot-ai",
        description="Visa Copilot AI — guidance visa-first (diagnostic + anti-scam, sans soumission).",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_diag = sub.add_parser("diagnose", help="Lancer le diagnostic visa-first à partir d'un profil JSON.")
    p_diag.add_argument("--profile", required=True, help="Chemin vers un fichier JSON contenant le profil utilisateur.")
    p_diag.add_argument("--pretty", action="store_true", help="Sortie JSON indentée.")

    p_dossier = sub.add_parser("verify-dossier", help="Vérifier un dossier (profil + documents) et scorer la readiness.")
    p_dossier.add_argument("--input", required=True, help="Chemin vers un JSON {profile:..., documents:[...], visa_type, destination_region}.")
    p_dossier.add_argument("--pretty", action="store_true", help="Sortie JSON indentée.")

    p_trip = sub.add_parser("plan-trip", help="Générer un itinéraire crédible (SIMULATION) pour soutenir le dossier.")
    p_trip.add_argument("--input", required=True, help="Chemin vers un JSON {profile:..., destination, start_date, end_date, estimated_budget_usd}.")
    p_trip.add_argument("--pretty", action="store_true", help="Sortie JSON indentée.")

    p_ref = sub.add_parser("explain-refusal", help="Expliquer un refus et proposer corrections + plan B.")
    p_ref.add_argument("--input", required=True, help="Chemin vers un JSON {refusal_reasons:[...], refusal_letter_text?}.")
    p_ref.add_argument("--pretty", action="store_true", help="Sortie JSON indentée.")

    p_cost = sub.add_parser("estimate-costs", help="Calculer les coûts à partir de montants officiels fournis.")
    p_cost.add_argument("--input", required=True, help="Chemin vers un JSON (visa_fee, service_fee, etc.).")
    p_cost.add_argument("--pretty", action="store_true", help="Sortie JSON indentée.")

    p_field = sub.add_parser("guide-field", help="Aide explicable pour un champ de formulaire (sans soumission).")
    p_field.add_argument("--input", required=True, help="Chemin vers un JSON {profile:..., form_type, field_name, context?}.")
    p_field.add_argument("--pretty", action="store_true", help="Sortie JSON indentée.")

    p_sec = sub.add_parser("verify-url", help="Vérifier une URL (anti-scam / official-only).")
    p_sec.add_argument("--url", required=True, help="URL du portail à vérifier (embassy/gouvernement).")
    p_sec.add_argument("--country", required=False, help="Pays attendu (optionnel) pour contexte/rappel.")
    p_sec.add_argument("--pretty", action="store_true", help="Sortie JSON indentée.")

    args = parser.parse_args(argv)

    try:
        if args.cmd == "diagnose":
            with open(args.profile, "r", encoding="utf-8") as f:
                raw = json.load(f)
            if not isinstance(raw, dict):
                raise ValueError("Le JSON doit être un objet.")
            profile = _parse_profile(raw)
            result = run_visa_diagnostic(profile)
            payload = diagnostic_to_dict(result)
        elif args.cmd == "verify-dossier":
            with open(args.input, "r", encoding="utf-8") as f:
                raw = json.load(f)
            if not isinstance(raw, dict):
                raise ValueError("Le JSON doit être un objet.")
            profile_raw = raw.get("profile")
            if not isinstance(profile_raw, dict):
                raise ValueError("profile doit être un objet.")
            docs = _parse_documents(raw.get("documents"))
            visa_type = str(raw.get("visa_type", "") or "")
            destination_region = str(raw.get("destination_region", "") or "")
            profile = _parse_profile(profile_raw)
            result = verify_dossier(profile, docs, visa_type=visa_type, destination_region=destination_region)
            payload = dossier_to_dict(result)
        elif args.cmd == "plan-trip":
            with open(args.input, "r", encoding="utf-8") as f:
                raw = json.load(f)
            if not isinstance(raw, dict):
                raise ValueError("Le JSON doit être un objet.")
            profile_raw = raw.get("profile")
            if not isinstance(profile_raw, dict):
                raise ValueError("profile doit être un objet.")
            profile = _parse_profile(profile_raw)
            result = generate_travel_plan(
                profile,
                destination=str(raw.get("destination", "") or ""),
                start_date=raw.get("start_date"),
                end_date=raw.get("end_date"),
                estimated_budget_usd=float(raw.get("estimated_budget_usd", 0) or 0),
                mode=str(raw.get("mode", "simulation") or "simulation"),
                anchor_city=raw.get("anchor_city"),
            )
            payload = travel_plan_to_dict(result)
        elif args.cmd == "explain-refusal":
            with open(args.input, "r", encoding="utf-8") as f:
                raw = json.load(f)
            if not isinstance(raw, dict):
                raise ValueError("Le JSON doit être un objet.")
            rr = raw.get("refusal_reasons") or []
            if not isinstance(rr, list):
                raise ValueError("refusal_reasons doit être une liste.")
            result = explain_refusal(refusal_reasons=[str(x) for x in rr], refusal_letter_text=raw.get("refusal_letter_text"))
            payload = refusal_to_dict(result)
        elif args.cmd == "estimate-costs":
            with open(args.input, "r", encoding="utf-8") as f:
                raw = json.load(f)
            if not isinstance(raw, dict):
                raise ValueError("Le JSON doit être un objet.")
            result = estimate_costs(
                destination_region=str(raw.get("destination_region", "") or ""),
                visa_type=str(raw.get("visa_type", "") or ""),
                currency=str(raw.get("currency", "USD") or "USD"),
                visa_fee=raw.get("visa_fee"),
                service_fee=raw.get("service_fee"),
                biometrics_fee=raw.get("biometrics_fee"),
                translation_cost=raw.get("translation_cost"),
                insurance_cost=raw.get("insurance_cost"),
                courier_cost=raw.get("courier_cost"),
            )
            payload = appointment_cost_to_dict(result)
        elif args.cmd == "guide-field":
            with open(args.input, "r", encoding="utf-8") as f:
                raw = json.load(f)
            if not isinstance(raw, dict):
                raise ValueError("Le JSON doit être un objet.")
            profile_raw = raw.get("profile")
            if not isinstance(profile_raw, dict):
                raise ValueError("profile doit être un objet.")
            profile = _parse_profile(profile_raw)
            g = get_field_guidance(
                form_type=str(raw.get("form_type", "") or ""),
                field_name=str(raw.get("field_name", "") or ""),
                profile=profile,
                context=raw.get("context") if isinstance(raw.get("context"), dict) else None,
            )
            payload = field_guidance_to_dict(g)
        elif args.cmd == "verify-url":
            verdict = verify_official_url(args.url, expected_country=args.country)
            payload = security_verdict_to_dict(verdict)
        else:
            raise ValueError("Commande inconnue.")

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

