/* MathClicks — Mental Math Arena settings.
   =========================================
   This is the ONLY file you edit to turn the shared online leaderboard on.

   mode: "local"    → the top-3 board is saved in each student's own browser.
                      Works right now, no setup, no cost. Each device has its
                      own board.

   mode: "supabase" → every student everywhere sees the SAME top-3 board.
                      Needs a free Supabase project (5 minutes, no card).
                      See SETUP-LEADERBOARD.md in this folder for the exact
                      click-by-click steps, then paste your two values below
                      and change mode to "supabase".

   Nothing else in the site needs to change.
*/

window.MATHCLICKS_GAME = {
  leaderboard: {
    mode: "local",

    // Paste from Supabase → Project Settings → Data API
    supabaseUrl: "",   // e.g. "https://abcdefghijkl.supabase.co"
    supabaseKey: "",   // the "anon / public" key (safe to publish)
    table: "mm_scores",
  },

  // How many names the board shows (only the top 3 are asked for initials)
  boardSize: 10,
};
