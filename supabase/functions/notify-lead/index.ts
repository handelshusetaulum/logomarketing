// Supabase Edge Function: notify-lead
// Kaldes af en Database Webhook når der indsættes en række i public.leads.
// Sender en mail til info@logomarketing.dk via Resend – og en kvittering til kunden.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY   = re_xxxxx
//   NOTIFY_TO        = info@logomarketing.dk
//   NOTIFY_FROM      = "LogoMarketing <info@logomarketing.dk>"   (domænet skal være verificeret i Resend)
//   ADMIN_URL        = https://logomarketing.dk/admin.html
//   WEBHOOK_SECRET   = et langt tilfældigt kodeord (sættes også som header på webhooken)

Deno.serve(async (req) => {
  const secret = Deno.env.get("WEBHOOK_SECRET");
  if (secret && req.headers.get("x-webhook-secret") !== secret) {
    return new Response("forbidden", { status: 403 });
  }
  const payload = await req.json().catch(() => null);
  const lead = payload?.record;
  if (!lead) return new Response("no record", { status: 400 });

  const RESEND = Deno.env.get("RESEND_API_KEY");
  const TO = Deno.env.get("NOTIFY_TO") ?? "info@logomarketing.dk";
  const FROM = Deno.env.get("NOTIFY_FROM") ?? "LogoMarketing <info@logomarketing.dk>";
  const ADMIN = Deno.env.get("ADMIN_URL") ?? "https://logomarketing.dk/admin.html";

  const WALLS = ["kun tag", "tag + bagvæg", "bagvæg + 2 halve sidevægge", "bagvæg + 3 halve vægge", "3 hele vægge", "lukket – alle 4 vægge"];
  const kr = (n: number) => new Intl.NumberFormat("da-DK").format(Math.round(n)) + " kr.";
  const tent = lead.tent_qty > 0 ? `${lead.tent_qty} × ${String(lead.tent_size||"3x3").replace("x","×")} m, ${WALLS[Math.max(0, Math.min(5, +lead.tent_walls || 0))]}, ${lead.color||""}` : "Ingen";
  const items = (lead.items||[]).length ? lead.items.join(", ") : "–";

  const adminHtml = `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#15202B;max-width:600px">
      <h2 style="margin:0 0 12px">Ny forespørgsel: ${esc(lead.org)}</h2>
      <table style="border-collapse:collapse;width:100%">
        ${row("Kontakt", `${esc(lead.name)} · <a href="mailto:${esc(lead.email)}">${esc(lead.email)}</a>${lead.phone ? " · " + esc(lead.phone) : ""}`)}
        ${row("Telte", esc(tent))}
        ${row("Andet", esc(items))}
        ${row("Anledning", esc(lead.event_name||"–") + (lead.event_date ? " · " + lead.event_date : ""))}
        ${lead.sponsor ? row("Sponsor på mockup", esc(lead.sponsor)) : ""}
        ${row("Vejledende værdi", kr(lead.est_value||0) + " ekskl. moms")}
        ${row("Logo", lead.logo_path ? "Uploadet ✓ (se admin)" : "Ikke vedhæftet")}
        ${lead.message ? row("Besked", esc(lead.message)) : ""}
      </table>
      <p style="margin-top:18px"><a href="${ADMIN}" style="background:#F26B1D;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:bold">Åbn i admin</a></p>
      <p style="color:#5B6672;font-size:13px">Husk: mockup og tilbud inden 2 hverdage.</p>
    </div>`;

  const customerHtml = `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#15202B;max-width:600px">
      <p>Hej ${esc(lead.name)},</p>
      <p>Tak for jeres forespørgsel. Vi har modtaget den, og I hører fra os inden 2 hverdage med en mockup og et konkret tilbud.</p>
      <p><b>Det, I har bedt om:</b><br>Telte: ${esc(tent)}<br>Andet: ${esc(items)}${lead.event_name ? "<br>Anledning: " + esc(lead.event_name) : ""}</p>
      <p>Har I noget at tilføje – et bedre logo, et andet antal, en dato – så svar bare på denne mail.</p>
      <p>Venlig hilsen<br>Kenneth Storm<br>LogoMarketing · Aulum · 97 47 31 78</p>
    </div>`;

  if (!RESEND) {
    console.warn("RESEND_API_KEY mangler – mail ikke sendt", lead.id);
    return new Response(JSON.stringify({ ok: false, reason: "no api key" }), { status: 200 });
  }

  const send = (to: string, subject: string, html: string, replyTo?: string) =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, reply_to: replyTo }),
    });

  const r1 = await send(TO, `Ny forespørgsel: ${lead.org} – ${tent === "Ingen" ? items : tent}`, adminHtml, lead.email);
  const r2 = await send(lead.email, "Vi har modtaget jeres forespørgsel – LogoMarketing", customerHtml, TO);

  return new Response(JSON.stringify({ ok: r1.ok && r2.ok, admin: r1.status, customer: r2.status }), {
    headers: { "Content-Type": "application/json" },
  });
});

function esc(s: unknown) { return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!)); }
function row(k: string, v: string) { return `<tr><td style="padding:6px 10px 6px 0;color:#5B6672;vertical-align:top;white-space:nowrap">${k}</td><td style="padding:6px 0">${v}</td></tr>`; }
