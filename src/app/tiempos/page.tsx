import { cookies } from 'next/headers';
import { supabase } from "@/lib/supabase";
import TiemposClient from "@/components/TiemposClient";

export const revalidate = 0;

export default async function TiemposPage() {
  const cookieStore = cookies();
  const role = cookieStore.get('axia_role')?.value;
  const user = cookieStore.get('axia_user')?.value;

  let qTareas = supabase.from("tareas").select("*").in("estado", ["Pendiente", "En Proceso"]).order("fecha_vencimiento", { ascending: true });
  if (role !== "admin" && user) { qTareas = qTareas.eq("responsable", user); }
  const { data: tareas, error: errorTareas } = await qTareas;

  const { data: tiempos, error: errorTiempos } = await supabase
    .from("tiempos_log")
    .select("*")
    .order("fecha_trabajo", { ascending: false });

  const { data: clientesData, error: errorClientes } = await supabase
    .from("clientes")
    .select("cliente, linea_negocio, ultima_cobranza_monto, ultima_cobranza_periodo");

  if (errorTareas || errorTiempos || errorClientes) {
    console.error("Error cargando base de datos:", errorTareas || errorTiempos);
    return <div>Error cargando la base de datos. Verificá la consola.</div>;
  }

  return <TiemposClient tareas={tareas || []} tiempos={tiempos || []} clientesDb={clientesData || []} />;
}
