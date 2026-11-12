# Gemini prompts for the author portraits

Make each author's two pictures in ONE Gemini chat, calm first, so the cross
picture is an edit of the calm one and the face stays the same.

Then cut each download out of its background and shrink it for the game:

    python3 tools/cutout.py ~/Downloads/<the download>.jpeg art/twain-normal.webp
    python3 tools/cutout.py ~/Downloads/<the download>.jpeg art/twain-cross.webp

# Mark Twain

## 1. Normal

Create a square 1:1 cartoon caricature portrait of the author Mark Twain as an
older man, head and shoulders, facing the viewer, centred, with his head
filling most of the frame.

Look: wild cloud of white hair, enormous bushy white eyebrows, a huge white
walrus mustache that hides his mouth, white three-piece suit, black bow tie, a
lit cigar in the corner of his mouth with a thin curl of smoke.

Expression: amused and sly, one eyebrow raised, a twinkle in his eye, as if he
is about to deliver a punchline.

Style: bold flat-colour cartoon with thick dark outlines and simple shapes,
like a modern editorial caricature or a mobile-game character portrait.
Exaggerate the hair, eyebrows and mustache. It must read clearly when shrunk
to the size of a thumbnail (about 140 pixels), so keep details big and few.

Background: one flat, solid dark plum colour (#261f2b), no gradient, no
texture, no scenery.

Do not include any text, letters, signature, watermark, border or frame.
Draw an original caricature; do not copy any specific photograph or painting.

## 2. Cross (send as a follow-up in the same chat)

Now draw the exact same character again: same art style, same colours, same
outline weight, same framing, same size, same flat dark plum background
(#261f2b). Change only his expression and the cigar:

He is furious in a comic way. His eyebrows crash down into a deep V, his eyes
narrow to a glare, his cheeks turn red, his big mustache droops at both ends,
and his cigar is snapped in half and bent. Two small puffs of steam rise beside
his head.

Still no text, signature, watermark, border or frame.

## Tips

- If the second picture drifts (different face shape or style), reply:
  "Keep everything identical to the first image except the expression and cigar."
- If the background is not flat, reply: "Make the background one flat solid
  colour, #261f2b, nothing else."
- Square pictures of about 1024 x 1024 are plenty.

# Emily Dickinson

Run these in the SAME Gemini chat as the Twain pictures, so it copies its own
style. (New chat? Attach art/twain-normal.webp first and say "match this style".)

## 1. Calm

In exactly the same art style as the Mark Twain portraits you just made (bold
flat-colour cartoon caricature, thick dark outlines, same framing and size,
same flat dark plum background), create a square 1:1 caricature portrait of
the poet Emily Dickinson, head and shoulders, facing the viewer, centred, with
her head filling most of the frame.

Look: bright chestnut-auburn hair parted exactly in the middle and pulled back
smooth into a low bun, very large solemn dark eyes, pale face, slender neck, a
plain white dress with a high collar and a small dark ribbon at the throat.
She holds one small white daisy up beside her face.

Expression: quiet, secretive and a little amused, a tiny closed-mouth smile,
as if she knows something you do not.

It must read clearly when shrunk to a thumbnail (about 140 pixels), so keep
details big and few. Background: one flat, solid dark plum colour, no
gradient, no texture, no scenery. No text, letters, signature, watermark,
border or frame. Draw an original caricature; do not copy any specific
photograph or painting.

## 2. Cross (follow-up in the same chat)

Now draw the exact same character again: same art style, same colours, same
outline weight, same framing, same size, same flat dark plum background.
Change only her expression and the daisy:

She is deeply affronted in a prim, comic way. Her chin lifts, her lips press
into a thin tight line, one eyebrow arches very high, her eyes slide sideways
in a cold glare, and a small pink flush of indignation shows on her cheeks.
Her head is turned very slightly away from the viewer. The daisy has wilted
and droops over, with one petal falling.

Still no text, signature, watermark, border or frame.
