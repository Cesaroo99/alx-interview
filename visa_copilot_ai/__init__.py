"""
Visa Copilot AI

Ce dépôt contient un noyau de logique "visa-first" (diagnostic + scoring explicable).

Important :
- Le logiciel ne remplace pas une ambassade.
- Il ne soumet aucune demande à la place de l'utilisateur.
- Il ne contourne aucun portail officiel.
"""

from .diagnostic import run_visa_diagnostic  # noqa: F401
from .models import UserProfile  # noqa: F401

