// ============================================================
//  LogoMarketing – konfiguration
//  Udfyld de to værdier fra Supabase → Project Settings → API.
//  "anon"-nøglen er lavet til at ligge offentligt i browseren –
//  sikkerheden ligger i databasens RLS-regler (se supabase/schema.sql).
// ============================================================
window.LM_CONFIG = {
  SUPABASE_URL: "https://cfbiljsxzwiymlefbkfy.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmYmlsanN4endpeW1sZWZia2Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwODAwNzksImV4cCI6MjEwNTY1NjA3OX0.UJstSvmBqHbeU3iP2-pJiE2Pzz0oHxHMCFoJqsUBL5U",
  ADMIN_EMAIL: "info@logomarketing.dk",
};


// ============================================================
//  Teltpriser (ekskl. moms) – ret her, så slår det igennem på
//  sitet, i formularen, i tilbud i admin og i kundens ordreside.
//  tent_walls i databasen gemmer variant-nummeret (0–5).
// ============================================================
window.LM_TENT = {
  variants: [
    { id: 0, short: "Kun tag",   name: "Kun tag" },
    { id: 1, short: "Bagvæg",    name: "Tag + bagvæg" },
    { id: 2, short: "+ 2 halve", name: "Bagvæg + 2 halve sidevægge" },
    { id: 3, short: "+ 3 halve", name: "Bagvæg + 3 halve vægge", hidden: true }, // findes ikke hos fabrikken – skjult, id bevaret
    { id: 4, short: "3 vægge",   name: "3 hele vægge (bag + 2 sider)" },
    { id: 5, short: "Lukket",    name: "Lukket – alle 4 vægge" }
  ],
  prices: {
    "3x3": [4999, 5999, 6799, 6999, 7299, 7999],
    "3x6": [7999, 8999, 9999, 10499, 10999, 11999]
  },
  price: function (size, v) { var P = this.prices[size] || this.prices["3x3"]; var i = Math.max(0, Math.min(5, +v || 0)); return P[i]; },
  label: function (v) { var x = this.variants[Math.max(0, Math.min(5, +v || 0))]; return x ? x.name : ""; }
};

(function () {
  if (window.supabase && window.LM_CONFIG.SUPABASE_URL.indexOf("DIT-PROJEKT") === -1) {
    window.LM_SUPABASE = window.supabase.createClient(window.LM_CONFIG.SUPABASE_URL, window.LM_CONFIG.SUPABASE_ANON_KEY);
  } else {
    console.warn("LogoMarketing: Supabase er ikke konfigureret endnu – ret assets/js/config.js");
  }
})();
