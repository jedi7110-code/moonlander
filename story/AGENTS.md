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
