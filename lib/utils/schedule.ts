// Échéancier prévisionnel d'une facture (jalons ATTENDUS, pas encore reçus).
// Stocké dans le champ `notes` de la facture (aucune colonne dédiée en base),
// via un marqueur, pour ne pas polluer la note lisible.

export interface ScheduleItem {
  label: string;      // ex: "Acompte", "Solde"
  amount: number;     // montant attendu (FCFA)
  dueDate: string;    // date limite attendue (ISO yyyy-mm-dd)
}

// Statut d'un jalon calculé à partir des paiements réellement encaissés.
export interface ScheduleItemStatus extends ScheduleItem {
  received: number;               // part couverte par les encaissements
  status: "recu" | "partiel" | "attente";
}

// Marqueur sur une ligne dédiée. JSON.stringify ne produit pas de saut de
// ligne, donc l'échéancier tient sur une seule ligne, facile à isoler.
const MARK = "@@SCHED@@";

/** Retourne la note débarrassée du marqueur d'échéancier (partie lisible). */
export function stripSchedule(notes: string | null | undefined): string {
  if (!notes) return "";
  const start = notes.indexOf(MARK);
  if (start === -1) return notes.trim();
  // Retire le marqueur et sa ligne (jusqu'au prochain saut de ligne).
  const after = notes.indexOf("\n", start);
  const before = notes.slice(0, start).replace(/\n+$/, "");
  const rest = after === -1 ? "" : notes.slice(after + 1);
  return (before + (rest ? "\n" + rest : "")).trim();
}

/** Encode l'échéancier dans la note (remplace un éventuel marqueur existant). */
export function encodeSchedule(baseNote: string | null | undefined, items: ScheduleItem[]): string {
  const clean = stripSchedule(baseNote);
  if (!items || items.length === 0) return clean;
  const marker = `${MARK}${JSON.stringify(items)}`;
  return clean ? `${clean}\n${marker}` : marker;
}

/** Décode l'échéancier depuis la note (tableau vide si absent/invalide). */
export function decodeSchedule(notes: string | null | undefined): ScheduleItem[] {
  if (!notes) return [];
  const start = notes.indexOf(MARK);
  if (start === -1) return [];
  const jsonStart = start + MARK.length;
  const lineEnd = notes.indexOf("\n", jsonStart);
  const json = lineEnd === -1 ? notes.slice(jsonStart) : notes.slice(jsonStart, lineEnd);
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((it) => it && typeof it.amount === "number")
      .map((it) => ({
        label: String(it.label || "Jalon"),
        amount: Math.round(Number(it.amount) || 0),
        dueDate: String(it.dueDate || ""),
      }));
  } catch {
    return [];
  }
}

/**
 * Ventile le total encaissé sur les jalons, dans l'ordre, et déduit le statut
 * de chacun (reçu / partiel / en attente).
 */
export function computeScheduleStatus(items: ScheduleItem[], totalPaid: number): ScheduleItemStatus[] {
  let remaining = Math.max(0, totalPaid);
  return items.map((it) => {
    const received = Math.min(remaining, it.amount);
    remaining -= received;
    const status: ScheduleItemStatus["status"] =
      received >= it.amount && it.amount > 0 ? "recu" : received > 0 ? "partiel" : "attente";
    return { ...it, received, status };
  });
}
