import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import RentabilidadClient from "@/components/RentabilidadClient";

import { verifySession } from "@/lib/auth";

export const revalidate = 0;

export default async function RentabilidadPage() {
  const cookieStore = cookies();
  const token = cookieStore.get("axia_session")?.value;
  const session = token ? await verifySession(token) : null;

  const isAgustin = session?.nombre === "Agustín" || session?.nombre === "Agustin";
  if (!session || session.rol !== "admin" || !isAgustin) {
    redirect("/"); 
  }

  // Fetch all required data
  const { data: clientes } = await supabase.from("clientes").select("*");
  const { data: tareas } = await supabase.from("tareas").select("*");
  const { data: equipo } = await supabase.from("equipo").select("*");
  const { data: tiempos } = await supabase.from("tiempos_log").select("*");
  const { data: costos } = await supabase.from("gastos").select("*");
  const { data: parametros } = await supabase.from("parametros").select("*");
  const { data: cobranzas_unicas } = await supabase.from("cobranzas_unicas").select("*");
  const { data: cobros } = await supabase.from("cobros").select("*");
  const { data: cierres } = await supabase.from("cierres").select("*");

  return (
    <RentabilidadClient 
      clientes={clientes || []} 
      tareas={tareas || []}
      equipo={equipo || []} 
      tiempos={tiempos || []} 
      costos={costos || []}
      parametros={parametros || []}
      cobranzas_unicas={cobranzas_unicas || []}
      cobros={cobros || []}
      cierres={cierres || []}
    />
  );
}
