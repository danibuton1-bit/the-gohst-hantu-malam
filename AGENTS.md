<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- Players sign in with an ID card (`profiles.kode_id` + name) through SECURITY DEFINER RPCs, not Cloud Auth; the session is the profile kept in localStorage. Why: the game is intentionally "no email, no password".
- Private chat and friendships are only reachable through SECURITY DEFINER RPCs that check `id + kode_id`; world chat is a public table read limited to the last 24h and pruned on each send. Why: there is no Cloud Auth session to scope RLS by.
- When no player picks the ghost, the room host's client simulates the AI ghost (`BOT_GHOST_ID`) and broadcasts its position like a player. Why: keeps the game serverless and in sync with existing realtime broadcast.
- Character art is SVG strings rendered inline (`CharImg`) with CSS-animated parts (`hm-lid`, `hm-armL/R`, `hm-body`); emotes are CSS classes, not emoji.
- Admin is the first profile, stored in `admin_profiles` (no client access) and checked via the `is_admin(id, kode_id)` RPC. Why: no Cloud Auth; roles must not live on profiles or in localStorage.
- The admin drone spectates via the same `game-<code>` broadcast channel and sends a `drone` event that players' scenes render. Why: no extra server state.
- Maps share one room grid; `applyMap(id)` in game.ts swaps the live `ROOMS/WALLS/DOORS` bindings and scene3d draws per-map atmosphere from `opts.map`; the room's map lives in `rooms.map`. Why: keys, spawns and ghost paths stay valid on every map.
- Solo/partial squads are padded to 4 hunters with `squadBots()` (deterministic ids `bot-mate-N`), simulated by the host and broadcast as normal `pos` events. Why: same serverless pattern as the AI ghost.
- Doors start closed and open only by click/E/tap (`doorOpen` in game.ts, synced via a `door` broadcast; host bots auto-open). Why: user wants click-to-open doors that physically block.
- Hotel floor 2 is the bottom half of the grid rendered FLOOR2_H above floor 1 via scene3d `mkV`; the two lift pads share x/z so one cabin rides a real shaft (synced via `lift` broadcast). Why: keeps 2D logic while showing a real stacked building.
- No 2D Kuyang images anywhere: menus/lobby use `Stage3D`, the jumpscare is the 3D model attached to the camera (`scene.scare`). Why: user wants all ghosts as real 3D.
- There is no room page: `/home` is the squad lobby (remembered in localStorage via `squad-store`), and the match renders inside it; start = captain sets `rooms.countdown_until`, anyone can clear it, captain launches at zero. Why: user wants a Free Fire-style single lobby.
- Admin media lives in the private `game-media` bucket + `media_assets`; uploads go through admin-checked server functions (signed upload URLs), and `BootGate` downloads every file into Cache Storage before any page shows. Why: no Cloud Auth, and lobby video must play from local storage without lag.
