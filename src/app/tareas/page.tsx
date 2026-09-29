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

  if (error) {
    console.error("Error cargando tareas:", error);
    return <div>Error cargando la base de datos. Verificá la consola.</div>;
  }

  return <TareasClient tareas={tareas || []} />;
}
