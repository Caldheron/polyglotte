import { z } from 'zod';
import raw from '../scheduler/config.json';

const Slot = z.object({
  slot: z.string(),
  lang: z.string(),
  minutes: z.number().int().positive(),
  type: z.string()
});
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const Schema = z.object({
  version: z.literal(1),
  langues: z.record(z.object({ nom: z.string(), couleur: z.string(), phase: z.string() })),
  semaine: z.object(Object.fromEntries(JOURS.map((j) => [j, z.array(Slot)])))
}).superRefine((c, ctx) => {
  for (const [jour, slots] of Object.entries(c.semaine))
    for (const s of slots)
      if (!c.langues[s.lang]) ctx.addIssue({ code: 'custom', message: `${jour}: langue inconnue "${s.lang}"` });
});

export const config = Schema.parse(raw); // échoue au démarrage si la config est invalide
export const ORDRE = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
export const jourDe = (date = new Date()) => JOURS[date.getDay()];
export const slotsDu = (jour) => config.semaine[jour].map((s) => ({ ...s, langue: config.langues[s.lang] }));
export const minutesDu = (jour) => config.semaine[jour].reduce((t, s) => t + s.minutes, 0);
export const totalSemaine = () => ORDRE.reduce((t, j) => t + minutesDu(j), 0);
