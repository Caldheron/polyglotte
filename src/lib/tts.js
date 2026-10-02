// Lecture audio par la synthèse vocale du téléphone (qualité selon les voix installées).
const VOIX = { es: 'es-ES', zh: 'zh-CN', ja: 'ja-JP' };
export const peutParler = () => typeof speechSynthesis !== 'undefined';
export function parler(texte, lang) {
  if (!peutParler()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texte);
  u.lang = VOIX[lang] ?? lang; u.rate = 0.9;
  speechSynthesis.speak(u);
}
