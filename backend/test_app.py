import pytest
from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

# Matrice de test 3x3 simple
SAMPLE_MATRIX = [
    [9, 2, 7],
    [6, 4, 3],
    [5, 8, 1]
]

def test_init_matrix():
    """Vérifie que l'endpoint /init initialise correctement la matrice (mode min)."""
    payload = {
        "matrix": SAMPLE_MATRIX,
        "mode": "min"
    }
    response = client.post("/init", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "Initialisé"
    assert data["matrix"] == SAMPLE_MATRIX

def test_next_step_without_init():
    """Vérifie que /next renvoie une erreur si la matrice n'a pas été initialisée."""
    # Réinitialiser le Solver à None pour simuler l'absence d'initialisation
    from app import State
    State.solver = None

    response = client.get("/next")
    assert response.status_code == 200
    assert "error" in response.json()

def test_hungarian_solver_full_run():
    """Vérifie la résolution complète pas à pas de l'algorithme Hongrois."""
    # 1. Initialisation
    client.post("/init", json={"matrix": SAMPLE_MATRIX, "mode": "min"})

    # 2. Exécution des étapes jusqu'à la fin
    finished = False
    max_steps = 20  # Sécurité anti-boucle infinie
    steps_count = 0

    while not finished and steps_count < max_steps:
        response = client.get("/next")
        assert response.status_code == 200
        data = response.json()
        finished = data["finished"]
        steps_count += 1

    # 3. Assertions sur le résultat final
    assert finished is True
    assert "assignments" in data
    assert len(data["assignments"]) == 3
    # Coût minimal attendu pour cette matrice : 2 + 3 + 1 = 6
    assert data["total_cost"] == 6.0