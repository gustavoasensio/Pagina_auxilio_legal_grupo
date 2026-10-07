// Ping diario a Supabase para que el plan gratuito no pause el proyecto por inactividad.
module.exports = async (req, res) => {
  const U = "https://hfwqpjmbqsjtdyeajhqv.supabase.co/rest/v1/rpc/pas_publico";
  const K = "sb_publishable_bVyhboFI2QwZqvKTOF9Quw_klcuXkdV";
  try {
    const r = await fetch(U, { method: "POST", headers: { apikey: K, "Content-Type": "application/json" }, body: JSON.stringify({ p_codigo: "keepalive00" }) });
    res.status(r.ok ? 200 : 502).json({ ok: r.ok, status: r.status, at: new Date().toISOString() });
  } catch (e) {
    res.status(502).json({ ok: false, error: String(e) });
  }
};
