import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AnalisisTiemposClient from "@/components/AnalisisTiemposClient";

import { verifySession } from "@/lib/auth";

export const revalidate = 0;

export default async function AnalisisTiemposPage() {
  const cookieStore = cookies();
  const token = cookieStore.get("axia_session")?.value;
  const session = token ? await verifySession(token) : null;

  if (!session || session.rol !== "admin") {
    redirect("/");
  }

  // Admin gets all data
  const { data: tareas, error: errorTareas } = await supabase.from("tareas").select("*");
  const { data: tiempos, error: errorTiempos } = await supabase.from("tiempos_log").select("*").order("fecha_trabajo", { ascending: false });

  const { data: clientes } = await supabase.from("clientes").select("*");
  const { data: equipo } = await supabase.from("equipo").select("*");

  if (errorTareas || errorTiempos) {
    console.error("Error cargando datos para análisis de tiempos:", errorTareas || errorTiempos);
  }

  return (
    <AnalisisTiemposClient 
      tareas={tareas || []}
      tiempos={tiempos || []}
      clientes={clientes || []}
      equipo={equipo || []}
      isAdmin={session.rol === "admin"}
      currentUser={session.nombre}
    />
  );
}
