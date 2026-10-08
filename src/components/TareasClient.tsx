"use client";

import { useState, useMemo } from "react";
import { CheckCircle2, Clock, MoreHorizontal, Download, AlertCircle, CalendarClock, Filter, Edit2, Trash2 } from "lucide-react";
import { NuevaTareaModal } from "@/components/NuevaTareaModal";
import { EditarTareaModal } from "@/components/EditarTareaModal";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export default function TareasClient({ tareas, dbClientes = [], dbSociedades = [], tiempos = [] }: { tareas: any[], dbClientes?: any[], dbSociedades?: any[], tiempos?: any[] }) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<any>(null);
  const [taskToDelete, setTaskToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Filtros
  const [fMes, setFMes] = useState("");
  const [fLinea, setFLinea] = useState("");
  const [fCliente, setFCliente] = useState("");
  const [fResp, setFResp] = useState("");
  const [fEstado, setFEstado] = useState("");

  const clientes = Array.from(new Set(tareas.map(t => t.cliente).filter(Boolean))).sort();
  const responsables = Array.from(new Set(tareas.map(t => t.responsable).filter(Boolean))).sort();
  const lineas = ["Estudio Contable", "Consultoría CFO"];
  const estados = ["Pendiente", "En Proceso", "Completada"];

  const calcularAlerta = (vencimiento: string | null, estado: string) => {
    if (estado === "Completada") return { text: "✅ Completada", color: "text-emerald-600 bg-emerald-50", type: "OK" };
    if (!vencimiento) return { text: "⚪ Sin fecha", color: "text-gray-500 bg-gray-100", type: "SIN" };
    
    const hoy = new Date();
    hoy.setHours(0,0,0,0);
    const v = new Date(vencimiento);
    v.setMinutes(v.getMinutes() + v.getTimezoneOffset());
    
    const diffTime = v.getTime() - hoy.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: "🔴 Vencida", color: "text-rose-700 bg-rose-50 border border-rose-200", type: "VENCIDA" };
    if (diffDays <= 3) return { text: "🟡 Próxima", color: "text-amber-700 bg-amber-50 border border-amber-200", type: "PROXIMA" };
    return { text: "🟢 En plazo", color: "text-emerald-700 bg-emerald-50 border border-emerald-200", type: "PLAZO" };
  };

  const tareasFiltradas = useMemo(() => {
    return tareas.filter(t => {
      const matchCliente = fCliente ? t.cliente === fCliente : true;
      const matchLinea = fLinea ? t.linea_negocio === fLinea : true;
      const matchResp = fResp ? t.responsable === fResp : true;
      const matchEstado = fEstado ? t.estado === fEstado : true;
      
      let matchMes = true;
      if (fMes && t.fecha_vencimiento) {
        const [y, m] = t.fecha_vencimiento.split("-");
        matchMes = `${m}/${y}` === fMes;
      } else if (fMes && !t.fecha_vencimiento) {
        matchMes = false;
      }

    return matchCliente && matchLinea && matchResp && matchEstado && matchMes;
    });
  }, [tareas, fCliente, fLinea, fResp, fEstado, fMes]);

  const horasPorTarea = useMemo(() => {
    const sum: Record<string, number> = {};
    tiempos.forEach(t => {
      if (t.id_tarea) {
        sum[t.id_tarea] = (sum[t.id_tarea] || 0) + Number(t.horas || 0);
      }
    });
    return sum;
  }, [tiempos]);

  const metrics = useMemo(() => {
    let vencidas = 0, proximas = 0, plazo = 0, hs = 0;
    tareasFiltradas.forEach(t => {
      const alerta = calcularAlerta(t.fecha_vencimiento, t.estado);
      if (alerta.type === "VENCIDA") vencidas++;
      if (alerta.type === "PROXIMA") proximas++;
      if (alerta.type === "PLAZO") plazo++;
      hs += Number(t.horas_presupuestadas || 0);
    });
    return { vencidas, proximas, plazo, hs };
  }, [tareasFiltradas]);

  // ELIMINAR
  const confirmDelete = async () => {
    if (!taskToDelete) return;
    setIsDeleting(true);
    const { error } = await supabase.from("tareas").delete().eq("id", taskToDelete.id);
    setIsDeleting(false);
    if (error) {
      toast.error("Error al eliminar: " + error.message);
    } else {
      toast.success("Tarea eliminada");
      setTaskToDelete(null);
      router.refresh();
    }
  };

  // EXPORTAR
  const dataAExportar = tareasFiltradas.map(t => ({
    "Alerta": calcularAlerta(t.fecha_vencimiento, t.estado).text,
    "Vencimiento": t.fecha_vencimiento ? new Date(t.fecha_vencimiento + "T00:00:00").toLocaleDateString("es-AR") : "",
    "Cliente": t.cliente,
    "Sociedad": t.sociedad || "",
    "Línea": t.linea_negocio,
    "Categoría": t.categoria,
    "Descripción": t.descripcion,
    "Responsable": t.responsable,
    "Horas": t.horas_presupuestadas,
    "Estado": t.estado
  }));

  const exportarExcel = () => {
    const ws = XLSX.utils.json_to_sheet(dataAExportar);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tareas");
    XLSX.writeFile(wb, `tareas_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportarCSV = () => {
    const ws = XLSX.utils.json_to_sheet(dataAExportar);
    const csv = XLSX.utils.sheet_to_csv(ws, { FS: ";" });
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `tareas_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-axia-blue">Tareas y Vencimientos</h1>
        <div className="flex gap-3">
          <button onClick={exportarExcel} className="flex items-center gap-2 bg-white text-emerald-700 px-4 py-2 rounded-lg font-bold shadow-sm border border-emerald-200 hover:bg-emerald-50 transition-colors">
            <Download size={18} /> Excel
          </button>
          <button onClick={exportarCSV} className="flex items-center gap-2 bg-white text-axia-blue px-4 py-2 rounded-lg font-bold shadow-sm border border-blue-200 hover:bg-blue-50 transition-colors">
            <Download size={18} /> CSV
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-axia-orange text-white px-5 py-2 rounded-lg font-bold shadow-sm hover:bg-orange-600 transition-colors"
          >
            + Nueva Tarea manual
          </button>
        </div>
      </div>

      {/* Metricas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-axia-blue">
          <p className="text-xs text-axia-gray font-bold uppercase tracking-wider">En vista</p>
          <p className="text-2xl font-bold text-axia-dark mt-1">{tareasFiltradas.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-rose-500">
          <p className="text-xs text-axia-gray font-bold uppercase tracking-wider flex items-center gap-1"><AlertCircle size={14}/> Vencidas</p>
          <p className="text-2xl font-bold text-rose-600 mt-1">{metrics.vencidas}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-amber-500">
          <p className="text-xs text-axia-gray font-bold uppercase tracking-wider flex items-center gap-1"><CalendarClock size={14}/> Vencen ≤ 3 días</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{metrics.proximas}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-emerald-500">
          <p className="text-xs text-axia-gray font-bold uppercase tracking-wider flex items-center gap-1"><CheckCircle2 size={14}/> En plazo</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{metrics.plazo}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-axia-teal">
          <p className="text-xs text-axia-gray font-bold uppercase tracking-wider">Hs presupuestadas</p>
          <p className="text-2xl font-bold text-axia-dark mt-1">{metrics.hs.toFixed(1)} h</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-6 flex flex-col md:flex-row gap-4 border border-gray-100">
        <div className="flex items-center text-axia-gray pl-2 pr-4 border-r border-gray-100">
          <Filter size={20} />
        </div>
        <select value={fMes} onChange={e => setFMes(e.target.value)} className="flex-1 bg-transparent text-sm outline-none font-medium text-axia-dark">
          <option value="">Todos los meses</option>
          <option value="09/2026">09/2026</option>
          <option value="10/2026">10/2026</option>
        </select>
        <select value={fLinea} onChange={e => setFLinea(e.target.value)} className="flex-1 bg-transparent text-sm outline-none font-medium text-axia-dark border-l border-gray-100 pl-4">
          <option value="">Todas las líneas</option>
          {lineas.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={fCliente} onChange={e => setFCliente(e.target.value)} className="flex-1 bg-transparent text-sm outline-none font-medium text-axia-dark border-l border-gray-100 pl-4">
          <option value="">Todos los clientes</option>
          {clientes.map(c => <option key={String(c)} value={String(c)}>{c}</option>)}
        </select>
        <select value={fResp} onChange={e => setFResp(e.target.value)} className="flex-1 bg-transparent text-sm outline-none font-medium text-axia-dark border-l border-gray-100 pl-4">
          <option value="">Todos los responsables</option>
          {responsables.map(r => <option key={String(r)} value={String(r)}>{r}</option>)}
        </select>
        <select value={fEstado} onChange={e => setFEstado(e.target.value)} className="flex-1 bg-transparent text-sm outline-none font-medium text-axia-dark border-l border-gray-100 pl-4">
          <option value="">Todos los estados</option>
          {estados.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-100 text-axia-gray text-xs tracking-wider uppercase font-bold">
                <th className="p-3 w-20">Alerta</th>
                <th className="p-3">Vto.</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Línea</th>
                <th className="p-3">Categoría</th>
                <th className="p-3 min-w-[200px]">Descripción</th>
                <th className="p-3">Resp.</th>
                <th className="p-3">Hs Presup.</th>
                <th className="p-3">Hs Carg.</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {!tareasFiltradas || tareasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-axia-gray">
                    No se encontraron tareas con estos filtros.
                  </td>
                </tr>
              ) : (
                tareasFiltradas.map((tarea) => {
                  const alerta = calcularAlerta(tarea.fecha_vencimiento, tarea.estado);
                  
                  return (
                  <tr key={tarea.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-[11px] font-bold shadow-sm whitespace-nowrap ${alerta.color}`}>
                        {alerta.text}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-axia-dark whitespace-nowrap text-sm">
                      {tarea.fecha_vencimiento ? new Date(tarea.fecha_vencimiento + "T00:00:00").toLocaleDateString("es-AR") : "—"}
                    </td>
                    <td className="p-3 font-bold text-axia-blue text-sm whitespace-nowrap">
                      {tarea.cliente}
                    </td>
                    <td className="p-3 text-axia-gray text-sm whitespace-nowrap">
                      {tarea.linea_negocio}
                    </td>
                    <td className="p-3 font-semibold text-axia-dark text-sm">
                      {tarea.categoria || "—"}
                    </td>
                    <td className="p-3 text-axia-gray text-xs">
                      <div className="line-clamp-2" title={tarea.descripcion}>{tarea.descripcion?.startsWith("[Orden: ") ? tarea.descripcion.substring(tarea.descripcion.indexOf("]") + 1).trim() : (tarea.descripcion || "—")}</div>
                    </td>
                    <td className="p-3 text-sm">
                      <span className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap">
                        {tarea.responsable || "—"}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-axia-gray text-sm">
                      {tarea.horas_presupuestadas || 0}
                    </td>
                    <td className="p-3 font-medium text-axia-blue text-sm">
                      {(horasPorTarea[tarea.id] || 0).toFixed(1)}
                    </td>
                    <td className="p-3 text-sm">
                      <span className="font-semibold text-axia-dark text-[11px] uppercase tracking-wider">{tarea.estado}</span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1 opacity-100 transition-opacity">
                        <button onClick={() => setTaskToEdit(tarea)} className="p-1 text-axia-blue hover:bg-blue-50 rounded-md transition-colors" title="Editar">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => setTaskToDelete(tarea)} className="p-1 text-rose-500 hover:bg-rose-50 rounded-md transition-colors" title="Eliminar">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )})
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && <NuevaTareaModal onClose={() => setIsModalOpen(false)} clientes={dbClientes} sociedades={dbSociedades} />}
      
      {taskToEdit && <EditarTareaModal tarea={taskToEdit} onClose={() => setTaskToEdit(null)} />}

      {taskToDelete && (
        <div className="fixed inset-0 bg-axia-dark/50 flex items-center justify-center z-[60] backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 p-6">
            <h3 className="text-xl font-bold text-axia-dark mb-2">Eliminar Tarea</h3>
            <p className="text-axia-gray mb-6">
              ¿Estás seguro de que querés eliminar la tarea de <strong>{taskToDelete.cliente}</strong>?<br/><br/>Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setTaskToDelete(null)}
                className="px-5 py-2.5 text-axia-gray font-bold hover:bg-gray-50 rounded-lg transition-colors"
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDelete}
                className="px-5 py-2.5 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                disabled={isDeleting}
              >
                {isDeleting ? "Eliminando..." : <><Trash2 size={18}/> Eliminar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}