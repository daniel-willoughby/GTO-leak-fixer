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
  // ---- postflop vocabulary ----
  'board texture': 'What the community cards look like, dry or wet, high or low, paired, connected, one suit or two. It decides who the flop favours and how to bet.',
  'dry board': 'A disconnected, unsuited flop with few draws (like A-8-3 rainbow). It favours the raiser, so you can c-bet small and often.',
  'wet board': 'A connected or suited flop with lots of draws (like 9-8-7 two-tone). It hits the caller more, so you bet more selectively and larger.',
  'range advantage': 'Having more of the strong hands on a given board than your opponent does. It lets you bet often and put them under pressure.',
  polarized: 'A betting range split into strong value hands and bluffs, with the medium hands checking. Polarised ranges use bigger sizes.',
  'thin value': 'Betting a medium-strength made hand to get called by slightly worse, a small edge, so you size small.',
  barrel: 'Continuing to bet on the next street after you bet the previous one. A second bet is a double barrel, a third a triple barrel.',
  donk: 'Leading into the previous street’s aggressor (betting before the player who bet last street can act). Correct only on a few boards that favour you.',
  blocker: 'Holding a card that makes a key opponent hand less likely, e.g. holding an ace blocks their strong aces, so you can bluff more credibly.',
  'fold equity': 'The extra value a bet gains from the chance your opponent folds. It is why semi-bluffs and pressure bets work.',
  'top pair': 'Pairing the highest card on the board with one of your hole cards. A solid one-pair hand with real showdown value.',
  overpair: 'A pocket pair higher than every board card (like QQ on a J-7-3 flop). Usually a strong value hand.',
  set: 'Three of a kind made with a pocket pair plus one matching board card. Very strong and well disguised.',
  'showdown value': 'A hand good enough to win at showdown sometimes without betting, so you check to keep weaker hands in or control the pot.',
  'equity denial': 'Betting to make hands with outs fold now, denying them the chance to draw out on you. A big reason to c-bet on dry boards.',
}

/** Core strategic principles, the "why behind the why". Bodies use [term]
 *  markers so beginners can tap the jargon. Shown on the Learn tab. */
export const PRINCIPLES: { title: string; body: string }[] = [
  {
    title: 'Position is power',
    body: 'Acting last is the single biggest edge in poker. [In position] you see what your opponent does before you decide, so you can play more hands profitably. Open wider on the [button], tighter [under the gun].',
  },
  {
    title: 'Aggression has two ways to win',
    body: 'Betting wins when your opponent folds *and* when they call with a worse hand. Checking only wins at showdown. That [fold equity] is why a [c-bet] and a [semi-bluff] are so powerful, passive play leaves money on the table.',
  },
  {
    title: 'Think in ranges, not hands',
    body: 'You never know exactly what your opponent has, only their [range], the set of hands they would play this way. Good decisions come from beating their whole range, not from reading one specific hand.',
  },
  {
    title: 'Know who the board favours',
    body: 'Before you bet, ask who has the [range advantage]. A [dry board] like A-8-3 hardly changes the raiser’s edge, so c-bet wide and small. A [wet board] like 9-8-7 hits the caller, so bet selectively and larger.',
  },
  {
    title: 'Polarise big, merge small',
    body: 'Big bets are for [polarized] ranges, your strongest [value] hands and your [bluff]s. Small bets are for wide, merged ranges taking [thin value] and [equity denial]. Let your size match your purpose.',
  },
  {
    title: 'Defend wide, fold the bottom',
    body: 'Facing a steal or a small [c-bet] you usually get a price to continue, so over-folding is a common leak, defend wide. But not everything: the truly weak hands with no [equity] still go in the muck.',
  },
  {
    title: 'Bluff with equity, and with blockers',
    body: 'A [semi-bluff], betting a [draw], beats a pure bluff because you can also win by hitting. And a [blocker] (holding a card that makes their strong hands less likely) makes your bluffs more credible.',
  },
  {
    title: 'Discipline beats fancy play',
    body: 'Most money is won by folding your trash and value-betting your good hands relentlessly, not by hero calls and big bluffs. Tight, aggressive, and patient is the winning baseline, fix the leaks before chasing the flair.',
  },
]

/** Look a term up case-insensitively. Returns null if unknown. */
export function lookupTerm(term: string): string | null {
  return GLOSSARY[term.trim().toLowerCase()] ?? null
}
