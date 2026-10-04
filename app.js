/* YEW shared */
var sb = null;
if (typeof SUPABASE_URL !== "undefined" && SUPABASE_URL.indexOf("REPLACE") !== 0) {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  // config not filled in yet — stub that surfaces a friendly message
  sb = {
    from: function () {
      return {
        select: function () { return Promise.resolve({ data: [], error: { message: "not configured" } }); },
        insert: function () { return { select: function () { return Promise.resolve({ data: [], error: { message: "not configured" } }); } }; },
        single: function () { return Promise.resolve({ data: null }); },
        eq: function () { return this; }, order: function () { return this; },
        limit: function () { return this; }, in: function () { return this; }
      };
    }
  };
  window.addEventListener("DOMContentLoaded", function () {
    var n = document.getElementById("audit-note");
    if (n) n.textContent = "Site is in setup mode — connect Supabase to go live.";
  });
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
