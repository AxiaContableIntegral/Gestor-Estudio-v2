import { supabase } from "@/lib/supabase";
import GenerarClient from "@/components/GenerarClient";

export const revalidate = 0;

export default async function GenerarPage() {
  const { data: plantillas, error: errorPlantillas } = await supabase
    .from("plantillas")
    .select("*");

  const { data: sociedades, error: errorSociedades } = await supabase
    .from("sociedades")
    .select("*");

  const { data: clientes, error: errorClientes } = await supabase
    .from("clientes")
    .select("*");

  if (errorPlantillas || errorSociedades || errorClientes) {
    console.error("Error:", errorPlantillas || errorSociedades || errorClientes);
    return <div>Error cargando base de datos. Verificá la consola.</div>;
  }

  return <GenerarClient plantillas={plantillas || []} sociedades={sociedades || []} clientes={clientes || []} />;
}
