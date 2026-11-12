// lines.js : what each foe says at each game moment (the "popups map").
// real = a genuine quotation from the author's published work (source given);
// everything else is an original line written in the author's voice.
// A slash " / " marks a verse line break.

export const LINES = {
  twain: {
    intro: 'Tell the truth or trump—but get the trick.',                       // real: Pudd'nhead Wilson (1894), ch. 1 epigraph
    hit: ['That ought to rattle your alphabet a little.', 'Don’t mind me—just trimming your margins.'],
    weak: 'Shucks, it ain’t no use to talk to you.',                           // real: Adventures of Huckleberry Finn (1884), ch. 3
    big: 'My word! Did you swallow an unabridged Webster’s?',
    perfect: 'Few of us can stand prosperity. Another man’s, I mean.',         // real: Following the Equator (1897), ch. 40 epigraph
    close: 'Just shy of the mark—like a steamboat missing the landing.',
    warn: 'Fixin’ to deal you letters that’ll make a preacher cuss.',
    curse: 'We begin to swear before we can talk.',                                 // real: Following the Equator (1897), ch. 31 epigraph
    scramble: 'Shuffling the deck don’t change the luck, friend.',
    low: 'You’re listing worse than a stern-wheeler on a sandbar.',
    life: 'Back from the boneyard? I respect a stubborn customer.',
    beaten: 'If I’d known you spelled like that, I’d have stayed ashore.',
    win: 'Let us endeavor so to live that when we come to die even the undertaker will be sorry.',   // real: Pudd'nhead Wilson (1894), ch. 6 epigraph
  },
  dickinson: {
    intro: 'I’m nobody! Who are you? / Are you nobody, too?',                  // real: Poems, Second Series (1891)
    hit: ['Lest anybody spy the blood / And “You’re hurt” exclaim!',  // real: Poems (1890), "A wounded deer leaps highest"
          'A small—sharp—Granite Syllable—to bruise the Afternoon—'],
    weak: 'A word is dead / When it is said, / Some say.',                          // real: Poems, Third Series (1896), "A Word"
    big: 'Such Thunder—in a Dictionary—I had not thought to hear—',
    perfect: 'Then there’s a pair of us—don’t tell!',                 // real: Poems, Second Series (1891)
    close: 'Almost—is but a Velvet Wall—between the Bee and Clover—',
    warn: 'A Frost—creeps toward your Hive—prepare the Winter Tongue—',
    curse: 'A sting of Z—a thorn of X—no Honey in this Comb—',
    scramble: 'Shaking the Jar—will never turn—a Pebble into Pearl—',
    low: 'The Carriage—waits beside the Gate—and Quietness is near—',
    life: 'You slipped the Alabaster Latch—and stepped back into Noon—',
    beaten: 'Success is counted sweetest / By those who ne’er succeed.',        // real: Poems (1890), "Success"
    win: 'Silence—is the longest Word—and I have spoken it—',
  },
  shelley: {
    intro: 'Beware; for I am fearless, and therefore powerful.',                    // real: Frankenstein, ch. 20
    hit: ['I will keep no terms with my enemies.',                                  // real: Frankenstein, ch. 10
          'I was benevolent and good; misery made me a fiend.'],                    // real: Frankenstein, ch. 10
    weak: 'So frail a spark will never animate a creature.',
    big: 'By heaven—that syllable struck like Alpine lightning!',
    perfect: 'I must confess—there is Promethean fire in that word.',
    close: 'A noble design—marred in the final stitch.',
    warn: 'Man, you shall repent of the injuries you inflict.',                     // real: Frankenstein, ch. 20
    curse: 'Behold my hideous progeny!',
    scramble: 'You rearrange the bones, yet no life stirs within.',
    low: 'Your candle burns low; the Arctic frost closes in.',
    life: 'Another spark! You rise like galvanized clay!',
    beaten: 'I—I have lost everything and cannot begin life anew.',            // real: Frankenstein, Letter 4
    win: 'You, my tyrant and tormentor, shall curse the sun that gazes on your misery.',   // real: Frankenstein, ch. 20
  },
  poe: {
    intro: 'Once upon a midnight dreary, while I pondered, weak and weary,',        // real: The Raven (1845)
    hit: ['Down — still unceasingly — still inevitably down!',             // real: The Pit and the Pendulum (1842)
          'Another stone laid in the wall around your breath!'],
    weak: '’Tis the wind and nothing more!',                                   // real: The Raven (1845)
    big: 'But why will you say that I am mad?',                                     // real: The Tell-Tale Heart (1843)
    perfect: 'True! — nervous — very, very dreadfully nervous I had been and am',   // real: The Tell-Tale Heart (1843)
    close: 'So near to Eldorado—yet your shadow misses the gold!',
    warn: 'It grew louder, I say, louder every moment!',                            // real: The Tell-Tale Heart (1843)
    curse: 'And laugh — but smile no more.',                                   // real: The Haunted Palace, in The Fall of the House of Usher (1839)
    scramble: 'Through a circle that ever returneth in / To the self-same spot,',   // real: The Conqueror Worm (1843)
    low: 'Yet what business had I with hope?',                                      // real: The Pit and the Pendulum (1842)
    life: 'Then a rushing revival of soul and a successful effort to move.',        // real: The Pit and the Pendulum (1842)
    beaten: 'Out — out are the lights — out all!',                         // real: The Conqueror Worm (1843)
    win: 'In pace requiescat!',                                                     // real: The Cask of Amontillado (1846)
  },
};

export const BIG_WORD = 7;      // letters: a word this long draws the "big hit" line
export const LOW_HP = 20;       // health at or below this draws the "nearly dead" line (once per fight)

// Which line (if any) the foe says about the word just played.
export function reactionKey(verdict, wordLength) {
  if (verdict === 'perfect') return 'perfect';
  if (verdict === 'close') return 'close';
  if (wordLength >= BIG_WORD) return 'big';
  if (wordLength <= 3) return 'weak';
  return null;
}

// Which line the foe says on its own turn. `held` = it already reacted to the player's word this turn.
export function foeTurnKey({ lifeUsed, cursed, waveNext, low, held }) {
  if (lifeUsed) return 'life';
  if (cursed) return 'curse';
  if (low) return 'low';
  if (held) return null;         // keep the reaction on screen
  if (waveNext) return 'warn';
  return 'hit';
}
