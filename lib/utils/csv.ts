// Utilitaires CSV partagés : export (téléchargement) et import (parsing robuste)

/** Échappe une valeur pour insertion dans une cellule CSV. */
function escapeCell(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  // Toujours entourer de guillemets et doubler les guillemets internes.
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Construit une chaîne CSV à partir d'en-têtes et de lignes d'objets.
 * `columns` définit l'ordre et l'en-tête affiché de chaque colonne.
 */
export function buildCsv<T extends Record<string, unknown>>(
  columns: { key: keyof T; header: string }[],
  rows: T[]
): string {
  // Point-virgule : séparateur attendu par Excel en configuration française,
  // pour que le fichier s'ouvre directement en colonnes (l'import détecte
  // automatiquement virgule ou point-virgule de toute façon).
  const sep = ";";
  const headerLine = columns.map((c) => escapeCell(c.header)).join(sep);
  const dataLines = rows.map((row) =>
    columns.map((c) => escapeCell(row[c.key])).join(sep)
  );
  // BOM UTF-8 pour qu'Excel ouvre correctement les accents.
  return "﻿" + [headerLine, ...dataLines].join("\r\n");
}

/** Déclenche le téléchargement d'un fichier CSV côté navigateur. */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parse un texte CSV en tableau d'objets, en utilisant la première ligne
 * comme en-têtes. Gère les guillemets, virgules internes, sauts de ligne
 * échappés et le BOM UTF-8.
 */
export function parseCsv(text: string): Record<string, string>[] {
  // Retire un éventuel BOM.
  const clean = text.replace(/^﻿/, "");

  // Détecte le séparateur : virgule, point-virgule (Excel FR) ou tabulation.
  // On compte sur la 1re ligne (hors guillemets) et on prend le plus fréquent.
  const firstLine = clean.split(/\r?\n/, 1)[0] || "";
  const countOutsideQuotes = (sep: string) => {
    let n = 0, q = false;
    for (const c of firstLine) {
      if (c === '"') q = !q;
      else if (c === sep && !q) n++;
    }
    return n;
  };
  const candidates: [string, number][] = [
    [",", countOutsideQuotes(",")],
    [";", countOutsideQuotes(";")],
    ["\t", countOutsideQuotes("\t")],
  ];
  candidates.sort((a, b) => b[1] - a[1]);
  const delimiter = candidates[0][1] > 0 ? candidates[0][0] : ",";

  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++; // saute le guillemet échappé
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      // Fin de ligne : ignore le \n d'un couple \r\n.
      if (char === "\r" && next === "\n") i++;
      row.push(field);
      field = "";
      // N'ajoute pas les lignes entièrement vides.
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  // Dernier champ / dernière ligne sans saut final.
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((c) => c.trim() !== "")) rows.push(row);
  }

  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (cells[idx] ?? "").trim();
    });
    return obj;
  });
}
