import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class MatrixInput(BaseModel):
    matrix: List[List[float]]
    mode: Optional[str] = "min"
    max_value: Optional[float] = None

class HungarianSolver:
    def __init__(self, matrix: np.ndarray, mode: str = "min", max_value: float = None):
        self.mode = mode # On mémorise le mode pour piloter les sous-étapes
        self.C_orig = np.array(matrix, dtype=float)
        
        # --- GESTION DU PADDING (MATRICE NON CARRÉE) ---
        rows, cols = self.C_orig.shape
        if rows != cols:
            n = max(rows, cols)
            pad_val = 0 if mode == "min" else (max_value if max_value is not None else np.max(self.C_orig))
            padded = np.full((n, n), pad_val, dtype=float)
            padded[:rows, :cols] = self.C_orig
            self.C_orig = padded
            
        self.n = self.C_orig.shape[0]
        
        # Mode Maximisation : Complément par rapport au Maximum (Règle du cours)
        if mode == "max":
            ref_max = max_value if max_value is not None else np.max(self.C_orig)
            self.C = ref_max - self.C_orig
        else:
            self.C = self.C_orig.copy()
            
        self.row_covered = np.zeros(self.n, dtype=bool)
        self.col_covered = np.zeros(self.n, dtype=bool)
        self.marked = np.zeros((self.n, self.n), dtype=int) 
        
        self.row_minimums = None
        self.col_minimums = None
        self.B_bound = 0  
        self.pivot_m = None    
        self.pivot_row = None  
        self.pivot_col = None  
        
        self.row_marked_plus = [False] * self.n
        self.col_marked_plus = [False] * self.n
        
        self.step = 1
        # AJUSTEMENT : En mode max, on commence par une sous-étape dédiée au complément visuel seul
        self.sub_step = "show_complement_pure" if mode == "max" else "show_rows" 
        self.finished = False

    def run_next(self):
        if self.step == 1:
            # Nouvelle sous-étape intermédiaire : sert uniquement de transition pour bloquer l'affichage des minima au premier clic
            if self.sub_step == "show_complement_pure":
                self.sub_step = "show_rows"
                # On ne calcule rien encore, on passe juste le tour visuel pour le frontend
                return

            elif self.sub_step == "show_rows":
                self.row_minimums = self.C.min(axis=1).tolist()
                self.B_bound = sum(self.row_minimums)
                self.sub_step = "sub_rows"
                
            elif self.sub_step == "sub_rows":
                self.C -= np.array(self.row_minimums)[:, np.newaxis]
                self.sub_step = "show_cols"
                
            elif self.sub_step == "show_cols":
                self.col_minimums = self.C.min(axis=0).tolist()
                self.B_bound += sum(self.col_minimums)
                self.sub_step = "sub_cols"
                
            elif self.sub_step == "sub_cols":
                self.C -= np.array(self.col_minimums)[np.newaxis, :]
                self.step = 2
                self.sub_step = "find_zeros"
                
        elif self.step == 2: 
            self.pivot_m = None 
            self.pivot_row = None
            self.pivot_col = None
            
            if self.sub_step == "find_zeros":
                self._find_independent_zeros()
                
            elif self.sub_step == "show_marking":
                self._compute_marking_only()
                
            elif self.sub_step == "show_coverage":
                self._apply_coverage_only()
                
        elif self.step == 3: 
            self._step3()
        elif self.step == 4: 
            self._step4()

    # (Le reste de tes fonctions _find_independent_zeros, _compute_marking_only, _apply_coverage_only, _step3 et _step4 restent strictement identiques...)
    def _find_independent_zeros(self):
        self.marked = np.zeros((self.n, self.n), dtype=int)
        temp_row_cov = np.zeros(self.n, dtype=bool)
        temp_col_cov = np.zeros(self.n, dtype=bool)
        while True:
            min_zeros = self.n + 1
            best_row = -1
            for r in range(self.n):
                if not temp_row_cov[r]:
                    count = np.sum((self.C[r, :] == 0) & (~temp_col_cov))
                    if 0 < count < min_zeros:
                        min_zeros = count
                        best_row = r
            if best_row == -1: break
            best_col = -1
            min_col_zeros = self.n + 1
            for c in range(self.n):
                if self.C[best_row, c] == 0 and not temp_col_cov[c]:
                    col_count = np.sum((self.C[:, c] == 0) & (~temp_row_cov))
                    if col_count < min_col_zeros:
                        min_col_zeros = col_count
                        best_col = c
            self.marked[best_row, best_col] = 1
            temp_row_cov[best_row] = True
            temp_col_cov[best_col] = True
            for i in range(self.n):
                if self.C[best_row, i] == 0 and i != best_col: self.marked[best_row, i] = 2
                if self.C[i, best_col] == 0 and i != best_row: self.marked[i, best_col] = 2
        self.row_covered = np.zeros(self.n, dtype=bool)
        self.col_covered = np.zeros(self.n, dtype=bool)
        self.row_marked_plus = [False] * self.n
        self.col_marked_plus = [False] * self.n
        if np.sum(self.marked == 1) == self.n: self.finished = True
        else: self.sub_step = "show_marking"

    def _compute_marking_only(self):
        marked_rows = set()
        for r in range(self.n):
            if not (1 in self.marked[r, :]) and (2 in self.marked[r, :]): marked_rows.add(r)
        marked_cols = set()
        active_rows = list(marked_rows)
        changed = True
        while changed:
            changed = False
            new_cols = []
            new_rows = []
            for r in active_rows:
                for c in range(self.n):
                    if self.marked[r, c] == 2 and c not in marked_cols:
                        marked_cols.add(c)
                        new_cols.append(c)
                        changed = True
            active_rows = []
            for c in new_cols:
                for r in range(self.n):
                    if self.marked[r, c] == 1 and r not in marked_rows:
                        marked_rows.add(r)
                        new_rows.append(r)
                        changed = True
            active_rows = new_rows
        self.row_marked_plus = [r in marked_rows for r in range(self.n)]
        self.col_marked_plus = [c in marked_cols for c in range(self.n)]
        self.row_covered = np.zeros(self.n, dtype=bool)
        self.col_covered = np.zeros(self.n, dtype=bool)
        self.sub_step = "show_coverage"

    def _apply_coverage_only(self):
        marked_rows = [i for i, val in enumerate(self.row_marked_plus) if val]
        marked_cols = [j for j, val in enumerate(self.col_marked_plus) if val]
        self.row_covered = np.array([r not in marked_rows for r in range(self.n)], dtype=bool)
        self.col_covered = np.array([c in marked_cols for c in range(self.n)], dtype=bool)
        self.step = 3
        self.sub_step = "find_pivot"

    def _step3(self):
        uncovered_mask = np.outer(~self.row_covered, ~self.col_covered)
        if np.any(uncovered_mask):
            m = np.min(self.C[uncovered_mask])
            self.pivot_m = float(m)
            found = False
            for r in range(self.n):
                for c in range(self.n):
                    if not self.row_covered[r] and not self.col_covered[c] and self.C[r, c] == m:
                        self.pivot_row = r
                        self.pivot_col = c
                        found = True
                        break
                if found: break
        else:
            self.pivot_m = None
            self.pivot_row = None
            self.pivot_col = None
        self.step = 4
        self.sub_step = "adjust_matrix"

    def _step4(self):
        uncovered_mask = np.outer(~self.row_covered, ~self.col_covered)
        if not np.any(uncovered_mask) or self.pivot_m is None:
            self.step = 2
            self.sub_step = "find_zeros"
            return
        m = self.pivot_m
        self.C[~self.row_covered, :] -= m
        self.C[:, self.col_covered] += m
        self.B_bound += m
        self.row_covered = np.zeros(self.n, dtype=bool)
        self.col_covered = np.zeros(self.n, dtype=bool)
        self.row_marked_plus = [False] * self.n
        self.col_marked_plus = [False] * self.n
        self.pivot_m = None
        self.pivot_row = None
        self.pivot_col = None
        self.step = 2
        self.sub_step = "find_zeros"

class State:
    solver = None

@app.post("/init")
async def init_matrix(data: MatrixInput):
    State.solver = HungarianSolver(np.array(data.matrix), mode=data.mode, max_value=data.max_value)
    return {"status": "Initialisé", "matrix": State.solver.C.tolist()}

@app.get("/next")
async def next_step():
    if not State.solver: 
        return {"error": "Veuillez initialiser la matrice d'abord."}
    
    s = State.solver
    if not s.finished:
        s.run_next()
    
    assignments = []
    total_cost = 0
    if s.finished:
        for r in range(s.n):
            for c in range(s.n):
                if s.marked[r, c] == 1:
                    cost = float(s.C_orig[r, c])
                    total_cost += cost
                    assignments.append({"worker": r+1, "job": c+1, "cost": cost})

    return {
        "matrix": s.C.tolist(),
        "row_covered": s.row_covered.tolist(),
        "col_covered": s.col_covered.tolist(),
        "marked": s.marked.tolist(),
        "step": s.step,
        "sub_step": s.sub_step,
        "finished": s.finished,
        "assignments": sorted(assignments, key=lambda x: x['worker']),
        "total_cost": total_cost,
        "row_minimums": s.row_minimums,
        "col_minimums": s.col_minimums,
        "B_bound": s.B_bound,
        "pivot_m": s.pivot_m,
        "pivot_row": s.pivot_row,
        "pivot_col": s.pivot_col,
        "row_marked_plus": s.row_marked_plus,
        "col_marked_plus": s.col_marked_plus
    }