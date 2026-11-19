// Quotes from physicians and surgeons, each tied to a specific work.
// Popular quotes that can't be traced to their supposed author are deliberately left out.
export const QUOTES = [
  { q: 'Live neither in the past nor in the future, but let each day’s work absorb your entire energies, and satisfy your wildest ambition.', who: 'Sir William Osler', src: '“A Way of Life”, address at Yale, 1913' },
  { q: 'To study the phenomena of disease without books is to sail an uncharted sea, while to study books without patients is not to go to sea at all.', who: 'Sir William Osler', src: '“Books and Men”, 1901' },
  { q: 'In the physician or surgeon no quality takes rank with imperturbability.', who: 'Sir William Osler', src: '“Aequanimitas”, valedictory address, 1889' },
  { q: 'The Master-Word is Work.', who: 'Sir William Osler', src: '“The Master-Word in Medicine”, 1903' },
  { q: 'Medicine is a science of uncertainty and an art of probability.', who: 'Sir William Osler', src: 'Sir William Osler: Aphorisms, ed. W. B. Bean, 1950' },
  { q: 'Life is short, the art long, opportunity fleeting, experiment treacherous, judgement difficult.', who: 'Hippocrates', src: 'Aphorisms, I.1 (translation)' },
  { q: 'As to diseases, make a habit of two things: to help, or at least to do no harm.', who: 'Hippocrates', src: 'Epidemics, Book I (translation)' },
  { q: 'Declare the past, diagnose the present, foretell the future.', who: 'Hippocrates', src: 'Epidemics, Book I (translation)' },
  { q: 'Where there is love of man, there is also love of the art.', who: 'Hippocratic Corpus', src: 'Precepts, ch. 6 (translation)' },
  { q: 'One who knows only the texts but is unskilled in practice is bewildered at the bedside, like a coward on the battlefield.', who: 'Sushruta', src: 'Sushruta Samhita, Sutrasthana 3 (translation)' },
  { q: 'A physician who fails to enter the body of the patient with the lamp of knowledge and understanding can never treat diseases.', who: 'Charaka', src: 'Charaka Samhita, Vimanasthana 4 (translation)' },
  { q: 'I dressed him, and God healed him.', who: 'Ambroise Paré', src: 'Journeys in Diverse Places, 16th century (translation)' },
  { q: 'All things are poison, and nothing is without poison; the dose alone makes a thing not a poison.', who: 'Paracelsus', src: 'Third Defence, 1538 (translation)' },
  { q: 'Medicine is a social science, and politics is nothing else but medicine on a large scale.', who: 'Rudolf Virchow', src: 'Die medizinische Reform, 1848 (translation)' },
  { q: 'The secret of the care of the patient is in caring for the patient.', who: 'Francis W. Peabody', src: '“The Care of the Patient”, JAMA, 1927' },
  { q: 'Better is possible. It does not take genius. It takes diligence. It takes moral clarity. It takes ingenuity. And above all, it takes a willingness to try.', who: 'Atul Gawande', src: 'Better: A Surgeon’s Notes on Performance, 2007' },
  { q: 'Under conditions of complexity, not only are checklists a help, they are required for success.', who: 'Atul Gawande', src: 'The Checklist Manifesto, 2009' },
  { q: 'Our ultimate goal, after all, is not a good death but a good life to the very end.', who: 'Atul Gawande', src: 'Being Mortal, 2014' },
  { q: 'You can’t ever reach perfection, but you can believe in an asymptote toward which you are ceaselessly striving.', who: 'Paul Kalanithi', src: 'When Breath Becomes Air, 2016' },
  { q: 'Even if I’m dying, until I actually die, I am still living.', who: 'Paul Kalanithi', src: 'When Breath Becomes Air, 2016' },
];

const dayNo = () => Math.floor(Date.now() / 864e5 - new Date().getTimezoneOffset() / 1440);
// One quote a day; tapping moves to the next one for the rest of that day.
export function quoteIndex(ui) {
  const d = dayNo();
  const extra = ui.quote?.d === d ? ui.quote.n : 0;
  return ((d * 7 + extra) % QUOTES.length + QUOTES.length) % QUOTES.length;
}
export function nextQuote(ui) {
  const d = dayNo();
  ui.quote = { d, n: (ui.quote?.d === d ? ui.quote.n : 0) + 1 };
}
