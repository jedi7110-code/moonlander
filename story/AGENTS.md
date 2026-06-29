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
