// Plain-language definitions for beginner mode. Keys are lowercase; the
// GlossaryText component lowercases the marker text before looking a term up,
// so authoring copy can use any casing inside [brackets] (e.g. [RFI], [Open]).

export const GLOSSARY: Record<string, string> = {
  rfi: 'Raise First In. Everyone before you folded, so you are first into the pot. The right move is to raise or fold, never just call.',
  open: 'To open (open-raise) is to be the first player to raise into an unopened pot.',
  limp: 'Just calling the big blind instead of raising. It is almost always a leak in modern poker.',
  raise: 'Putting in more chips than the current bet, forcing others to match it to stay in the hand.',
  call: 'Matching the current bet to stay in the hand without raising.',
  fold: 'Giving up your hand and forfeiting any chips you have already put in.',
  check: 'Passing the action without betting, keeping your hand alive for free.',
  blinds: 'Forced bets posted before the cards are dealt: the small blind and the big blind. They give players something to fight over.',
  'big blind': 'The forced bet two seats left of the dealer, and the last player to act before the flop. Often abbreviated BB.',
  'small blind': 'The forced half-bet one seat left of the dealer. You act second-to-last preflop but first after the flop.',
  button: 'The dealer position. You act last on every street after the flop, which is the most profitable seat at the table.',
  cutoff: 'The seat just to the right of the button. A late, strong position where you can open many hands.',
  hijack: 'The seat just to the right of the cutoff. A middle position, opened tighter than the cutoff.',
  'under the gun': 'The first seat to act before the flop, with everyone still to come behind you. You need strong hands here.',
  position: 'Where you sit relative to the dealer button. Acting later means more information and more profitable hands.',
  'in position': 'Acting after your opponent on each street after the flop. A big advantage because you see what they do first.',
  'out of position': 'Acting before your opponent after the flop, so you must decide without seeing what they do.',
  steal: 'Raising from a late seat with a wide range mainly to win the blinds uncontested.',
  range: 'The full set of hands you would play a certain way in a spot, not just the one hand you happen to hold.',
  '3-bet': 'The third bet in a sequence: a re-raise of someone who already raised. Used for value and as a pressure bluff.',
  '4-bet': 'A re-raise of a 3-bet. Usually a very strong hand or a bold bluff.',
  squeeze: 'Re-raising after one player has raised and at least one other has called, to win the dead money and isolate.',
  'cold-call': 'Calling a raise when you have not yet put money in the pot this hand.',
  'c-bet': 'Continuation bet. Betting the flop after you were the player who raised before the flop.',
  value: 'Betting a strong hand to get called by worse hands, so you win more chips.',
  bluff: 'Betting or raising a weak hand to make a better hand fold.',
  'semi-bluff': 'Betting a drawing hand that is weak now but can improve. You can win by making them fold or by hitting your draw.',
  draw: 'A hand that is not yet made but can become strong, like four cards to a flush or straight.',
  equity: 'Your share of the pot based on how often your hand wins if all cards were dealt out.',
  'pot odds': 'The price you are getting to call: the size of the bet compared to the size of the pot.',
  gto: 'Game Theory Optimal. A balanced strategy that cannot be exploited, used as the benchmark answer in this trainer.',
  broadway: 'Any card ten or higher (T, J, Q, K, A). Two broadway cards make a strong starting hand.',
  'suited connector': 'Two cards of the same suit that are next to each other in rank, like 8-7 suited. Good for making straights and flushes.',
}

/** Look a term up case-insensitively. Returns null if unknown. */
export function lookupTerm(term: string): string | null {
  return GLOSSARY[term.trim().toLowerCase()] ?? null
}
