import { cookies } from 'next/headers';
import { supabase } from "@/lib/supabase";
import TareasClient from "@/components/TareasClient";

export const revalidate = 0;

export default async function TareasPage() {
  const cookieStore = cookies();
  const role = cookieStore.get('axia_role')?.value;
  const user = cookieStore.get('axia_user')?.value;

  let query = supabase.from("tareas").select("*").order("fecha_vencimiento", { ascending: true });
  if (role !== "admin" && user) {
    query = query.eq("responsable", user);
  }
  const { data: tareas, error } = await query;

  const { data: clientes, error: errorClientes } = await supabase
    .from("clientes")
    .select("*")
    .order("cliente", { ascending: true });

  const { data: sociedades, error: errorSociedades } = await supabase
    .from("sociedades")
    .select("*")
    .order("sociedad", { ascending: true });

  if (error || errorClientes || errorSociedades) {
    console.error("Error cargando tareas:", error || errorClientes || errorSociedades);
    return <div>Error cargando la base de datos. Verificá la consola.</div>;
  }

  return <TareasClient tareas={tareas || []} dbClientes={clientes || []} dbSociedades={sociedades || []} />;
}
