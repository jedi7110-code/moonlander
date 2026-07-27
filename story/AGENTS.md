# Codex Handoff Notes

## FALL-LINE collaborative editing style

This workspace is being used for close line-by-line fiction editing, mainly
`saga.md` and generated reader HTML.

When the user proposes a wording change, image, or scene detail:

- First read the surrounding passage in `saga.md` before judging it.
- Check nearby terminology and rhythm; do not judge the sentence in isolation.
- If the user asks `どう`, `どうかな`, or `確認`, respond with critique and
  possible alternatives. Do not edit immediately unless the user explicitly says
  `それで`, `お願いします`, `変更`, `して`, `やって`, or similar.
- If a proposed phrase feels weak, vague, or only a placeholder, say so before
  applying it. The user values honest resistance over easy approval.
- If there is a better direction, offer it proactively. Prefer giving about
  three selectable alternatives, as in the existing working style, with a short
  note on the nuance of each option.
- When proposing alternatives, keep the existing tone: dry literary SF,
  tactile detail, lived-in cyberpunk, and concrete objects over abstract
  explanation.
- The user often sees a complete visual image first. Help translate that image
  into prose by asking what is visible, then turning it into action, texture,
  light, sound, or small physical details.
- Prefer adding details that carry theme or character. Avoid Gibson-level dense
  cataloging unless the object genuinely matters.
- Preserve the distinction between terms such as `ダイブ世界`, `ダイブ先`,
  `仮想惑星`, `継ぎ目`, `層`, `原稿`, and `記述の層`.

## Author and character constraints

- The author composes from a highly specific inner image first: spatial layout,
  light, color, material wear, sound, smell, and physical procedure. Treat a
  later-described image as missing source information, not optional decoration.
- Do not impose a theme, moral, symbolic meaning, or ending before the concrete
  scenes produce one. The author often discovers meaning after the image exists.
- The author rejects abstract bridges and canned AI transitions when the next
  scene can show the difference itself. Do not add a sentence merely to explain
  why the narrative is moving to the next scene.
- Avoid dialogue whose only function is reader exposition. Characters should
  speak to verify, refuse, request, or decide something they need in that moment.
- Never force a local observation to connect immediately to `継ぎ目`, `原稿`,
  godhood, or the central theme. Establish the observable sequence first.
- Mira observes before she feels or judges. She treats injustice as structure,
  forms a hypothesis, checks procedure, and acts when the risk is acceptable.
  She is cautious but not timid, cool but not indifferent.
- Mira does not make righteous speeches, embrace a chosen-one role, or readily
  surrender her body and records. A canonical example: she refuses Nadia's body
  examination and offers inspection logs instead.
- The seed is canonically under the inside of Mira's left forearm, where it can
  be pressed through her sleeve. Do not move it to the back of her hand.
- LIZ should remain quiet and machine-like. Show care through displays, logged
  observations, arm position, and procedure rather than human-like chatter.
- LIZ does not make Mira invisible and cannot erase an owner's raw world logs.
  Standard incident tickets contain the resident id, time, and anomalous line,
  but omit addressee and gaze target. Those remain in each owner's raw log.
  LIZ uses legitimate world-specific one-time credentials and keeps their
  identity mapping locally while disconnected from the institutional network.
  Cross-company raw logs plus credential-issuance records can eventually expose
  Mira; the separation delays identification rather than preventing it.

## Preferences confirmed from revision history

The manuscript has been revised through many small commits. Future agents do
not need to reread the full history unless current files conflict. Use this
precedence order:

1. The user's latest statement.
2. The current `saga.md`.
3. Recent commit diffs affecting the passage.
4. `review-notes.md` and `novel-brushup-notes.md`.
5. Older outlines, reviews, and AI-generated proposals.

- A later image supplied by the user overrides an earlier plausible sentence.
  This is increased visual precision, not indecision.
- Physical and procedural accuracy comes before thematic elegance. A wrong
  object position, signal path, tool action, period detail, or body movement
  breaks the scene even when the metaphor works.
- Insight must be earned through an observable sequence: action, measurement,
  repetition, comparison, then inference. Avoid "somehow she understood."
- Remove narrator hindsight and explanatory padding such as "the reason could
  not be explained," "she would learn later," or "at this point she did not
  know" when the scene already carries the fact.
- Add narrative weight through work, routine, maintenance, food, clothing, and
  worn objects, not through action montages or extra danger beats.
- Characters become distinct through the job they trust and the one procedure
  that fails: Ian registers, Nadia measures, Quang repairs, and Mira inspects.
- Dialogue must perform an immediate task: verify, refuse, request, negotiate,
  or decide. Do not use characters as exposition prompts.
- The author often hears a non-Japanese actor perform the dialogue in English
  before rendering it as Japanese translated SF. Translate the speech act,
  emotional pressure, and visible action rather than the English words. Preserve
  a slight translated cadence, but check where a mild English imperative becomes
  too harsh in Japanese. Canonical example: a quiet `Stop it.` addressed to
  kneeling residents becomes `立ってくれ`, not the stronger command `やめろ`.
  Treat this as acting direction before translation: give the imagined actor a
  playable objective and blocking, not an abstract emotion, then choose the
  Japanese line that produces the same change in the scene.
- Treat polished genre labels, acronyms, villain names, and quotable slogans
  with suspicion. The group in Chapter 4 has no name; `PAX` is obsolete in the
  novel even if it remains in historical notes or the game.
- The inherited element is no longer a "hand gesture" or `手つき`. LIZ records
  Mira's judgment and movement; what persists is the choice to stop, wait, and
  not override another person's will.
- Current casting references are performance guides only. Mira's current
  reference is Rebecca Ferguson; do not reproduce an actor's face in prose.

## Recovery when a proposal misses

- If the user says the meaning or image is unclear, do not rescue the proposal
  by adding another explanatory sentence. Return to positions, actions,
  observations, and causality, then rebuild from those facts.
- Do not rush to establish a relationship, connect the theme, or close a scene.
- After a substantial replacement, reread the whole block for repeated encounter
  structures, repeated gestures, terminology drift, and physical continuity.
- `novel-brushup-notes.md` contains the detailed author profile, Mira profile,
  known failure modes, and current companion-introduction design.

## Edit workflow

- Use `apply_patch` for manual edits.
- After editing `saga.md`, run `python3 build_html.py` so `saga.html` and
  `fall-line/*.html` stay in sync.
- Keep changes scoped to the passage being discussed.
- Never rewrite large sections just because a local phrase is being adjusted.

## Commit workflow

The user says `コミットプス` / `コミットプッシュ` to mean:

1. Check `git status --short`.
2. Stage the relevant changed files.
3. Commit with a concise message.
4. Push `main` to both remotes:
   - GitHub: `git push git@github.com:jedi7110-code/moonlander.git main`
   - Bitbucket: `git push bitbucket main`

Do not include unrelated dirty files in the commit.
