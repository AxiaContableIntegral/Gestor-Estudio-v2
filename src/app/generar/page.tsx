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

  // Tareas generadas por importación (origen null) para poder anular una subida
  const { data: tareasImportadas, error: errorTareas } = await supabase
    .from("tareas")
    .select("id, fecha_creacion, fecha_vencimiento, estado")
    .is("origen", null);

  const { data: tiempos } = await supabase.from("tiempos_log").select("id_tarea");

  if (errorPlantillas || errorSociedades || errorClientes || errorTareas) {
    console.error("Error:", errorPlantillas || errorSociedades || errorClientes || errorTareas);
    return <div>Error cargando base de datos. Verificá la consola.</div>;
  }

  return (
    <GenerarClient
      plantillas={plantillas || []}
      sociedades={sociedades || []}
      clientes={clientes || []}
      tareasImportadas={tareasImportadas || []}
      tiempos={tiempos || []}
    />
  );
}
