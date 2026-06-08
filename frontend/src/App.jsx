import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

function App() {
  const [size, setSize] = useState(4);
  const [matrix, setMatrix] = useState([]);
  const [mode, setMode] = useState('min');
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(true);

  const [history, setHistory] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  
  // Sous-étape locale pour le mode maximisation (0: Complément pur, 1: Recherche des minima)
  const [maxSubStep, setMaxSubStep] = useState(0);

  const status = (!isEditing && currentIndex >= 0) ? history[currentIndex] : null;

  // Calculer la valeur maximale d'une matrice
  const getMatrixMaxValue = (mat) => {
    if (!mat || mat.length === 0) return 0;
    return Math.max(...mat.map(row => Math.max(...row)));
  };

  // Règle d'arrondi personnalisée pour la base du complément
  const getComplementBase = (maxValue) => {
    if (maxValue === 0) return 0;
    if (maxValue <= 20) return 20;
    if (maxValue <= 50) return 50;
    return Math.ceil(maxValue / 100) * 100;
  };

  const currentMax = status?.original_matrix ? getMatrixMaxValue(status.original_matrix) : getMatrixMaxValue(matrix);
  const complementBase = getComplementBase(currentMax);

  // Générer la matrice complémentée pure (Borne - Valeur Initiale)
  const getPureComplementMatrix = (origMatrix, base) => {
    return origMatrix.map(row => row.map(val => base - val));
  };

  // Étiquettes de lignes (A, B, C...) et colonnes (a, b, c...)
  const getRowLabel = (index) => String.fromCharCode(65 + index); 
  const getColLabel = (index) => String.fromCharCode(97 + index); 

  useEffect(() => {
    const newMatrix = Array(size).fill(0).map(() => Array(size).fill(0));
    setMatrix(newMatrix);
    setHistory([]);
    setCurrentIndex(-1);
    setMaxSubStep(0);
    setIsEditing(true);
  }, [size]);

  const handleNext = useCallback(async () => {
    if (isEditing || currentIndex === -1) return;

    // Gestion de la transition par sous-étapes en mode MAX
    if (mode === 'max' && currentIndex === 0 && maxSubStep === 0) {
      setMaxSubStep(1);
      return;
    }

    if (currentIndex < history.length - 1) {
      setCurrentIndex(currentIndex + 1);
      return;
    }

    if (status?.finished) return;

    try {
      const res = await axios.get('http://127.0.0.1:8000/next');
      const nextStatus = { ...res.data, original_matrix: status.original_matrix };
      
      setHistory([...history, nextStatus]);
      setCurrentIndex(currentIndex + 1);
    } catch (e) {
      alert("Erreur lors du calcul de l'étape suivante");
    }
  }, [isEditing, currentIndex, history, status, mode, maxSubStep]);

  const handlePrev = useCallback(() => {
    if (isEditing || currentIndex <= 0) return;

    // Gestion du retour en arrière sur la sous-étape en mode MAX
    if (mode === 'max' && currentIndex === 0 && maxSubStep === 1) {
      setMaxSubStep(0);
      return;
    }

    currentIndex = currentIndex - 1;
  }, [isEditing, currentIndex, mode, maxSubStep]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (isEditing || document.activeElement.tagName === 'INPUT') return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isEditing, handleNext, handlePrev]);

  const handleCellKeyDown = (e, r, c) => {
    if (!isEditing) return;

    let nextR = r;
    let nextC = c;

    switch (e.key) {
      case 'ArrowRight':
        if (c < size - 1) nextC = c + 1;
        else if (r < size - 1) { nextR = r + 1; nextC = 0; }
        break;
      case 'ArrowLeft':
        if (c > 0) nextC = c - 1;
        else if (r > 0) { nextR = r - 1; nextC = size - 1; }
        break;
      case 'ArrowDown':
        if (r < size - 1) nextR = r + 1;
        break;
      case 'ArrowUp':
        if (r > 0) nextR = r - 1;
        break;
      case 'Enter':
        e.preventDefault();
        if (c < size - 1) nextC = c + 1;
        else if (r < size - 1) { nextR = r + 1; nextC = 0; }
        break;
      default:
        return;
    }

    if (nextR !== r || nextC !== c) {
      e.preventDefault();
      const nextInput = document.getElementById(`cell-${nextR}-${nextC}`);
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    }
  };

  const handleCellChange = (r, c, value) => {
    if (!isEditing) return;
    const newMatrix = [...matrix];
    newMatrix[r][c] = value === '' ? 0 : Number(value);
    setMatrix(newMatrix);
  };

  const fillRandom = () => {
    const newMatrix = matrix.map(row => row.map(() => Math.floor(Math.random() * 18) + 1));
    setMatrix(newMatrix);
    setHistory([]);
    setCurrentIndex(-1);
    setMaxSubStep(0);
    setIsEditing(true);
  };

  const initAlgo = async () => {
    setLoading(true);
    try {
      const res = await axios.post('http://127.0.0.1:8000/init', { matrix, mode });
      const initialStatus = { ...res.data, original_matrix: JSON.parse(JSON.stringify(matrix)) };
      
      setHistory([initialStatus]);
      setCurrentIndex(0);
      setMaxSubStep(0); 
      setIsEditing(false);
    } catch (e) {
      alert("Erreur : Vérifiez que le serveur FastAPI est lancé.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    const resetMatrix = Array(size).fill(0).map(() => Array(size).fill(0));
    setMatrix(resetMatrix);
    setHistory([]);
    setCurrentIndex(-1);
    setMaxSubStep(0);
    setIsEditing(true);
  };

  const getStepExplanation = () => {
    if (isEditing) {
      return {
        step: "EDIT",
        title: "Mode Édition / Saisie",
        desc: `Saisissez vos coefficients de gains ou de coûts.`
      };
    }
    if (!status) return { step: "0", title: "Prêt", desc: "Prêt à démarrer." };

    switch (status.step) {
      case 1:
        if (mode === 'max') {
          return maxSubStep === 0 
            ? { step: "01-A", title: "Transformation en Coûts", desc: `Soustraction de chaque coefficient de gains à la borne maximale (${complementBase}) pour obtenir la matrice de coûts.` }
            : { step: "01-B", title: "Recherche des Minima", desc: "Identification immédiate des coûts minimums par ligne et par colonne sur la matrice transformée." };
        }
        return {
          step: "01",
          title: "Réduction par ligne et colonne",
          desc: "Recherche immédiate des minimums lignes et colonnes pour initialiser la réduction de la matrice."
        };
      case 2:
        return { step: "02", title: "Couplage maximal", desc: "Sélection exclusive et indépendante des zéros [0]." };
      case 3:
        return { step: "03", title: "Marquage & Couverture", desc: "Tracé du système minimal de lignes couvrant tous les zéros de la matrice." };
      case 4:
        return { step: "04", title: "Pivot d'ajustement", desc: "Identification du pivot m, soustraction aux éléments non couverts et ajout aux intersections." };
      default:
        return { step: "ANLZ", title: "Analyse", desc: "Calcul en cours..." };
    }
  };

  const explanation = getStepExplanation();

  if (matrix.length === 0) return null;

  return (
    <div className="h-screen bg-neutral-50 text-neutral-700 font-sans flex flex-col md:flex-row overflow-hidden antialiased">
      
      {/* STYLE SÉCURISÉ : RESTE LOCALISÉ SUR LA CLASSE .grid-cell-input */}
      <style>{`
        input.grid-cell-input::-webkit-inner-spin-button,
        input.grid-cell-input::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input.grid-cell-input {
          -moz-appearance: textfield;
        }
      `}</style>

      {/* SIDEBAR */}
      <aside className="w-full md:w-80 bg-white border-b md:border-b-0 md:border-r border-neutral-200/80 p-6 flex flex-col justify-between gap-6 shrink-0 overflow-y-auto">
        <div className="space-y-6">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold tracking-tight text-emerald-800">AlgoHongrois</h1>
            <p className="text-[10px] font-mono tracking-widest text-neutral-400 uppercase">Problème d'affectation</p>
          </div>

          <div className="space-y-4 pt-4 border-t border-neutral-100">
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono tracking-wider text-neutral-400 uppercase block">Dimension</label>
              <input 
                type="number" min="2" max="10" value={size} disabled={!isEditing}
                onChange={(e) => setSize(Number(e.target.value))} 
                className="w-full bg-neutral-50 border border-neutral-200 text-neutral-700 font-mono text-sm rounded px-3 py-1.5 outline-none transition disabled:opacity-40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono tracking-wider text-neutral-400 uppercase block">Optimisation</label>
              <select 
                value={mode} disabled={!isEditing} onChange={(e) => setMode(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 text-neutral-700 text-sm rounded px-3 py-1.5 outline-none cursor-pointer disabled:opacity-40 appearance-none"
              >
                <option value="min">Minimisation</option>
                <option value="max">Maximisation</option>
              </select>
            </div>

            {isEditing && (
              <button 
                onClick={fillRandom}
                className="w-full py-2 px-3 bg-white hover:bg-neutral-50 text-neutral-600 rounded border border-neutral-200 text-xs font-mono uppercase tracking-wider transition"
              >
                Matrice aléatoire
              </button>
            )}
          </div>

          <div className="bg-neutral-50 border border-neutral-200/60 rounded p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded bg-emerald-100 text-emerald-800 flex items-center justify-center font-mono text-xs font-bold">{explanation.step}</span>
              <h2 className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 font-bold">{explanation.title}</h2>
            </div>
            <p className="text-xs text-neutral-500 leading-relaxed font-sans pt-1 border-t border-neutral-200/40">{explanation.desc}</p>
          </div>
        </div>

        <div className="space-y-2 pt-4 border-t border-neutral-100">
          {isEditing ? (
            <button onClick={initAlgo} disabled={loading} className="w-full font-mono text-xs uppercase tracking-widest py-3 px-4 rounded transition-all bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">Lancer le calcul</button>
          ) : (
            <>
              <button onClick={() => setIsEditing(true)} className="w-full font-mono text-xs uppercase tracking-widest py-2.5 px-4 rounded transition-all bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100">Modifier / Corriger</button>
              <button onClick={handleReset} className="w-full font-mono text-xs uppercase tracking-widest py-2.5 px-4 rounded transition-all bg-neutral-100 hover:bg-neutral-200 text-neutral-600">Tout réinitialiser</button>
            </>
          )}
        </div>
      </aside>

      {/* ZONE DE TRAVAIL */}
      <main className="flex-1 p-6 md:p-8 flex flex-col gap-5 overflow-y-auto h-full">
        
        <header className="bg-white border border-neutral-200/80 rounded px-5 py-3 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 shrink-0">
          <div className="text-xs font-mono uppercase tracking-wider text-neutral-500 flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${status ? 'bg-amber-500 animate-pulse' : isEditing ? 'bg-emerald-500' : 'bg-neutral-300'}`}></span>
            {isEditing ? "Statut : Mode Saisie" : `Statut : Étape ${status.step} ${mode === 'max' && status.step === 1 ? `(Partie ${maxSubStep === 0 ? 'A' : 'B'})` : ''} [Vue : ${currentIndex + 1}/${history.length}]`}
          </div>
          
          <div className="flex flex-wrap gap-2 text-[10px] font-mono uppercase tracking-wider">
            {mode === 'max' && !isEditing && <span className="px-2 py-0.5 bg-blue-600 text-white rounded font-bold">Complément à {complementBase}</span>}
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 border border-blue-200 rounded font-bold">Zéro obtenu</span>
            <span className="px-2 py-0.5 border border-dashed border-red-300 text-red-700 bg-red-50/30 rounded font-bold">(+) Marque</span>
            <span className="px-2 py-0.5 bg-yellow-300 text-yellow-950 rounded font-bold">Couverture</span>
            <span className="px-2 py-0.5 bg-red-600 text-white rounded font-bold">Pivot</span>
            <span className="px-2 py-0.5 border-2 border-emerald-600 font-extrabold bg-emerald-100 text-emerald-950 rounded">[0] Encadré</span>
            <span className="px-2 py-0.5 text-red-700 border border-red-200 line-through rounded font-bold">0 Barré</span>
          </div>
        </header>

        {/* CONTENEUR DES GRILLES */}
        <div className="bg-white border border-neutral-200/80 rounded p-4 flex flex-col items-center justify-center min-h-[360px] gap-6 shrink-0 overflow-x-hidden">
          {(() => {
            let cellWidth = "w-14";
            let cellHeight = "h-9";
            let minCellSize = "w-9 h-6.5";
            let txtSize = "text-sm";

            if (size >= 6) {
              cellWidth = "w-11";
              cellHeight = "h-8";
              minCellSize = "w-8 h-6 text-[11px]";
              txtSize = "text-xs";
            }
            if (size >= 8) {
              cellWidth = "w-10";
              cellHeight = "h-8";
              minCellSize = "w-7 h-5.5 text-[10px]";
              txtSize = "text-[11px]";
            }

            return (
              <>
                {!isEditing && mode === 'max' && status?.step === 1 ? (
                  
                  /* ÉTAPE 1 EN MODE MAXIMISATION */
                  <div className="flex flex-col lg:flex-row items-center justify-center gap-3 w-full animate-fade-in p-1 max-w-full overflow-hidden">
                    
                    <div className="flex flex-col items-center gap-1 border border-neutral-100 p-2 rounded bg-neutral-50/50 shadow-sm w-full lg:w-auto max-w-full overflow-x-hidden select-none">
                      <span className="text-[9px] font-mono font-bold text-neutral-400 uppercase tracking-widest">Matrice Initiale (Gains)</span>
                      <table className="border-collapse table-fixed">
                        <thead>
                          <tr>
                            <th className="w-6 h-6"></th>
                            {Array.from({ length: size }).map((_, c) => (
                              <th key={c} className={`${cellWidth} ${cellHeight} text-[11px] font-mono font-bold text-neutral-400 text-center lowercase`}>{getColLabel(c)}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {status.original_matrix.map((row, i) => (
                            <tr key={i} className={cellHeight}>
                              <td className="w-6 text-[11px] font-mono font-bold text-neutral-400 text-right pr-1.5 uppercase">{getRowLabel(i)}</td>
                              {row.map((val, j) => (
                                <td key={j} className={`${cellWidth} border border-neutral-200 bg-white text-center font-mono ${txtSize} text-neutral-500 font-medium`}>{val}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-row lg:flex-col items-center justify-center text-center p-1 gap-2 lg:gap-0.5 shrink-0">
                      <div className="bg-blue-600 text-white font-mono text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow-sm">
                        Complément à {complementBase}
                      </div>
                      <div className="text-blue-500 font-black text-lg animate-pulse">
                        <span className="lg:hidden">⬇️</span>
                        <span className="hidden lg:inline">➔</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-1 border border-blue-100 p-2 rounded bg-blue-50/10 shadow-sm w-full lg:w-auto max-w-full overflow-x-hidden select-none">
                      <span className="text-[9px] font-mono font-bold text-blue-700 uppercase tracking-widest">
                        {maxSubStep === 0 ? "Matrice Complémentée Pure" : "Matrice Complémentée & Minima"}
                      </span>
                      <table className="border-collapse table-fixed relative">
                        <thead>
                          <tr>
                            <th className="w-6 h-6"></th>
                            {Array.from({ length: size }).map((_, c) => (
                              <th key={c} className={`${cellWidth} ${cellHeight} text-[11px] font-mono font-bold text-neutral-400 text-center lowercase`}>{getColLabel(c)}</th>
                            ))}
                            {maxSubStep === 1 && status?.row_minimums && <th className="w-10 h-6 text-[9px] font-mono text-red-600 font-bold uppercase text-center">Min. L</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {getPureComplementMatrix(status.original_matrix, complementBase).map((row, i) => (
                            <tr key={i} className={cellHeight}>
                              <td className="w-6 text-[11px] font-mono font-bold text-neutral-400 text-right pr-1.5 uppercase">{getRowLabel(i)}</td>
                              {row.map((pureComplementVal, j) => (
                                <td key={j} className={`${cellWidth} border border-blue-200 bg-white text-center font-mono ${txtSize} font-semibold text-blue-900`}>{pureComplementVal}</td>
                              ))}
                              
                              {maxSubStep === 1 && status?.row_minimums?.[i] !== undefined && (
                                <td className="w-10 text-center pl-1">
                                  <span className={`inline-flex items-center justify-center ${minCellSize} font-mono font-bold rounded bg-red-600 border border-red-700 text-white shadow-sm`}>
                                    {status.row_minimums[i]}
                                  </span>
                                </td>
                              )}
                            </tr>
                          ))}
                          
                          {maxSubStep === 1 && status?.col_minimums && (
                            <tr className={cellHeight}>
                              <td className="text-[9px] font-mono text-red-600 font-bold text-right pr-1.5 uppercase">Min. C</td>
                              {status.col_minimums.map((minColVal, colIdx) => (
                                <td key={colIdx} className="text-center pt-1">
                                  <span className={`inline-flex items-center justify-center ${minCellSize} bg-red-600 border border-red-700 text-white font-mono font-bold rounded shadow-sm`}>
                                    {minColVal}
                                  </span>
                                </td>
                              ))}
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                  </div>
                ) : (
                  
                  /* AFFICHAGE UNIQUE POUR MODE SAISIE ET ÉTAPES (2, 3, 4) */
                  <div className="relative p-2 w-full flex flex-col items-center overflow-x-auto">
                    <table className="border-collapse table-fixed relative z-20">
                      <thead>
                        <tr>
                          <th className="w-16 h-10"></th>
                          {Array.from({ length: size }).map((_, c) => {
                            const isColMarkedPlus = status?.col_marked_plus?.[c];
                            return (
                              <th key={c} className={`${cellWidth} h-10 text-[11px] font-mono font-bold text-neutral-400 text-center relative`}>
                                <div className="w-full h-full flex flex-col items-center justify-end pb-1">
                                  {isColMarkedPlus && <span className="text-red-600 font-mono font-black text-[10px] bg-red-50 px-1 py-0.5 border border-red-200 rounded block absolute top-0">(+)</span>}
                                  <span className="text-neutral-500 font-bold lowercase">{getColLabel(c)}</span>
                                </div>
                              </th>
                            );
                          })}
                          {status?.step === 1 && status?.row_minimums && <th className={`${cellWidth} h-10 text-[9px] font-mono text-neutral-400 uppercase text-center`}>Min. L</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {matrix.map((row, i) => {
                          const isRowCover = status?.row_covered?.[i];
                          const isRowMarkedPlus = status?.row_marked_plus?.[i];

                          return (
                            <tr key={i} className={`relative ${cellHeight}`}>
                              <td className="w-16 text-[11px] font-mono font-bold text-neutral-400 pr-3 text-right uppercase">
                                <div className="flex items-center justify-end gap-1 w-full h-full">
                                  {isRowMarkedPlus && <span className="text-red-600 font-mono font-black text-[10px] bg-red-50 px-1 py-0.5 border border-red-200 rounded">(+)</span>}
                                  <span className="text-neutral-500 font-bold uppercase">{getRowLabel(i)}</span>
                                </div>
                              </td>
                              
                              {row.map((val, j) => {
                                const currentVal = status?.matrix ? status.matrix[i][j] : val;
                                const mark = status?.marked?.[i]?.[j];
                                const isZeroEncadre = currentVal === 0 && mark === 1;
                                const isZeroBarre = currentVal === 0 && mark === 2;
                                const isColCovered = status?.col_covered?.[j];
                                const isCellCovered = isRowCover || isColCovered;
                                const isPivotCell = status?.pivot_row === i && status?.pivot_col === j;
                                const isNewZero = currentVal === 0 && !mark && !isEditing;

                                let cellBgClass = "bg-white text-neutral-600";
                                if (isEditing) {
                                  cellBgClass = "bg-emerald-50/10 focus-within:bg-white text-neutral-700 border-emerald-200/20";
                                } else if (isPivotCell) {
                                  cellBgClass = "bg-red-600 text-white font-black shadow-sm scale-105 z-30";
                                } else if (isCellCovered) {
                                  cellBgClass = "bg-yellow-300 text-yellow-950 font-semibold";
                                } else if (isZeroEncadre) {
                                  cellBgClass = "bg-emerald-500/20 text-emerald-950 font-extrabold";
                                } else if (isNewZero) {
                                  cellBgClass = "bg-blue-50 border-blue-200/60";
                                } else if (isZeroBarre) {
                                  cellBgClass = "bg-neutral-50 text-red-700";
                                }

                                return (
                                  <td key={j} className={`${cellWidth} ${cellHeight} border border-neutral-200 text-center font-mono relative p-0 transition-all duration-200 ${cellBgClass}`}>
                                    <div className="w-full h-full flex items-center justify-center">
                                      <input
                                        id={`cell-${i}-${j}`} 
                                        type="number" 
                                        value={currentVal} 
                                        disabled={!isEditing}
                                        onChange={(e) => handleCellChange(i, j, e.target.value)}
                                        onKeyDown={(e) => handleCellKeyDown(e, i, j)}
                                        className={`grid-cell-input w-full h-full text-center bg-transparent border-0 outline-none p-0 font-mono z-20 relative text-xs focus:ring-0 cursor-default disabled:cursor-default appearance-none
                                          ${isPivotCell ? "text-white font-black" : ""}
                                          ${isZeroEncadre && !isPivotCell ? "border-2 border-emerald-600 font-black text-emerald-950 bg-emerald-100 shadow-sm" : ""} 
                                          ${isZeroBarre ? "text-red-700 line-through font-bold opacity-60" : ""}
                                          ${isNewZero ? "text-blue-600 font-bold bg-blue-100/40" : ""}
                                        `}
                                      />
                                    </div>
                                  </td>
                                );
                              })}

                              {status?.step === 1 && status?.row_minimums?.[i] !== undefined && (
                                <td className={`${cellWidth} text-center align-middle pl-2`}>
                                  <span className={`inline-flex items-center justify-center ${minCellSize} font-mono font-bold rounded shadow-sm border transition-all duration-200
                                    ${!status.col_minimums ? "bg-red-600 border-red-700 text-white" : "bg-neutral-100 border-neutral-200 text-neutral-400"}`}
                                  >
                                    {status.row_minimums[i]}
                                  </span>
                                </td>
                              )}
                            </tr>
                          );
                        })}

                        {status?.step === 1 && status?.col_minimums && (
                          <tr className={cellHeight}>
                            <td className="text-[10px] font-mono text-neutral-400 pr-3 text-right uppercase">Min. C</td>
                            {status.col_minimums.map((minColVal, colIdx) => (
                              <td key={colIdx} className="text-center align-middle pt-1">
                                <span className={`inline-flex items-center justify-center ${minCellSize} bg-red-600 border border-red-700 text-white font-mono font-bold rounded shadow-sm`}>
                                  {minColVal}
                                </span>
                              </td>
                            ))}
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            );
          })()}

          {/* BORNE GLOBALE B */}
          {status?.step === 1 && maxSubStep === 1 && status?.col_minimums && status?.B_bound !== undefined && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-xs font-mono tracking-wide uppercase flex items-center gap-2.5 shadow-sm">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
              Borne Initiale Globale B : <span className="font-bold text-sm bg-white border border-emerald-200 px-2 py-0.5 rounded text-emerald-700">{status.B_bound}</span>
            </div>
          )}

          {/* VISUALISATION DU PIVOT */}
          {status?.step === 4 && status?.pivot_m !== undefined && (
            <div className="w-full max-w-xl p-3 bg-amber-50 border border-amber-200 rounded text-xs font-mono text-neutral-700 space-y-2">
              <div className="font-bold uppercase tracking-wider text-amber-800 text-[11px]">Ajustement par le Pivot m</div>
              <div className="grid grid-cols-2 gap-3 bg-white p-2.5 rounded border border-amber-100">
                <div>
                  <span className="text-[9px] text-neutral-400 uppercase block">Pivot (m)</span>
                  <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">{status.pivot_m}</span>
                </div>
                <div>
                  <span className="text-[9px] text-neutral-400 uppercase block">Nouvelle borne B</span>
                  <span className="text-xs font-bold text-neutral-700 bg-neutral-100 px-1.5 py-0.5 rounded">
                    {status.B_bound} + {status.pivot_m} = {status.B_bound + status.pivot_m}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* BOUTONS DE NAVIGATION */}
          {!isEditing && currentIndex >= 0 && (
            <div className="w-full max-w-md border-t border-neutral-100 pt-4 flex flex-col items-center gap-2">
              <div className="flex items-center gap-3 w-full">
                <button
                  onClick={handlePrev} disabled={currentIndex === 0 && maxSubStep === 0}
                  className="flex-1 py-2 px-4 rounded border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-600 text-xs font-mono uppercase tracking-wider transition disabled:opacity-30"
                >
                  Précédent
                </button>
                <button
                  onClick={handleNext} disabled={status?.finished && currentIndex === history.length - 1}
                  className="flex-1 py-2 px-4 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-mono uppercase tracking-wider transition shadow-sm disabled:bg-neutral-100 disabled:text-neutral-400"
                >
                  {status?.finished && currentIndex === history.length - 1 ? "Terminé" : "Suivant"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SECTION SOLUTION FINALE */}
        {!isEditing && status?.finished && status?.original_matrix && (
          <div className="p-8 bg-white border border-neutral-200/90 rounded-lg space-y-8 shrink-0 transition-all duration-300 shadow-sm animate-fade-in">
            <div className="flex items-center gap-2.5 border-b border-neutral-100 pb-4">
              <span className="w-2 h-2 bg-emerald-600 rounded-sm"></span>
              <h3 className="font-mono text-xs font-bold tracking-widest uppercase text-neutral-500">Analyse Globale &amp; Solution</h3>
            </div>
            
            <div className="flex flex-col lg:flex-row gap-12">
              <div className="flex-1 space-y-6">
                <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400">Affectations Optimales</h4>
                
                <div className="space-y-3">
                  {status.assignments.map((a, idx) => {
                    const rIdx = Number(a.worker) - 1;
                    const cIdx = Number(a.job) - 1;
                    const originalValue = status.original_matrix[rIdx]?.[cIdx] ?? 0;

                    return (
                      <div key={idx} className="p-4 bg-neutral-50/50 border border-neutral-200/60 rounded-md flex justify-between items-center text-sm font-mono transition hover:bg-neutral-50">
                        <span className="text-xs text-neutral-400 font-medium">Affectation {idx + 1}</span>
                        <div className="text-neutral-800 font-semibold tracking-wide">
                          {getRowLabel(rIdx)} <span className="text-emerald-600 mx-2">→</span> {getColLabel(cIdx)} <span className="text-neutral-400 font-normal ml-1">({originalValue})</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-4 border-t border-neutral-100 flex justify-between items-center">
                  <span className="text-xs font-mono uppercase tracking-widest text-neutral-400 font-bold">
                    {mode === 'max' ? "Gain / Profit maximal total" : "Coût total optimal"}
                  </span>
                  <span className="text-xl font-mono font-black bg-emerald-600 text-white px-5 py-2 rounded-md shadow-sm">
                    {status.total_cost}
                  </span>
                </div>
              </div>

              <div className="flex-1 flex flex-col items-start gap-4 p-6 bg-neutral-50 border border-neutral-200/60 rounded-lg">
                <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400">Matrice d'origine de référence</h4>
                <div className="overflow-x-auto w-full py-2">
                  <table className="border-collapse mx-auto">
                    <thead>
                      <tr>
                        <th className="w-10 h-8"></th>
                        {Array.from({ length: size }).map((_, c) => (
                          <th key={c} className="w-12 h-8 font-mono text-[11px] font-bold text-neutral-500 text-center lowercase">{getColLabel(c)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {status.original_matrix.map((origRow, i) => (
                        <tr key={i}>
                          <td className="text-[11px] font-mono font-bold text-neutral-500 pr-3 text-right uppercase h-9">{getRowLabel(i)}</td>
                          {origRow.map((origVal, j) => {
                            const isAssigned = status.assignments.some(
                              a => (Number(a.worker) === i + 1) && (Number(a.job) === j + 1)
                            );
                            return (
                              <td 
                                key={j} 
                                className={`w-12 h-9 border border-neutral-200/80 text-center font-mono text-xs transition-all duration-150
                                  ${isAssigned 
                                    ? "bg-emerald-600 text-white font-bold rounded-sm shadow-inner scale-105" 
                                    : "bg-white text-neutral-400"
                                  }`}
                              >
                                {origVal}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;