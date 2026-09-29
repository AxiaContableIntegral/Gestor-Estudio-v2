"use client";

import { useState, useMemo } from "react";
import { Clock, CheckCircle2, User, Building, Calendar, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { DollarSign } from "lucide-react";
export default function TiemposClient({ tareas, tiempos, clientesDb }: { tareas: any[], tiempos: any[], clientesDb: any[] }) {
  const router = useRouter();
  const [fResp, setFResp] = useState("");
  const [fCliente, setFCliente] = useState("");
  const [selectedTareaId, setSelectedTareaId] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [loadingCompletar, setLoadingCompletar] = useState(false);
  const [confirmarFin, setConfirmarFin] = useState(false);

  // Time Form
  const [formData, setFormData] = useState({
    fecha_trabajo: new Date().toISOString().split("T")[0],
    horas: "1.0",
    comentario: "",
    persona: "Agustin",
  });

  const responsables = Array.from(new Set(tareas.map(t => t.responsable).filter(Boolean))).sort();
  const clientes = Array.from(new Set(tareas.map(t => t.cliente).filter(Boolean))).sort();

  const tareasFiltradas = useMemo(() => {
    return tareas.filter(t => {
      const matchResp = fResp ? t.responsable === fResp : true;
      const matchCliente = fCliente ? t.cliente === fCliente : true;
      return matchResp && matchCliente;
    });
  }, [tareas, fResp, fCliente]);

  const selectedTarea = useMemo(() => {
    return tareas.find(t => String(t.id) === selectedTareaId);
  }, [tareas, selectedTareaId]);

  const histTarea = useMemo(() => {
    if (!selectedTareaId) return [];
    return tiempos.filter(t => String(t.id_tarea) === selectedTareaId);
  }, [tiempos, selectedTareaId]);

  const horasReales = histTarea.reduce((acc, t) => acc + Number(t.horas), 0);

  const honorarioInfo = useMemo(() => {
    if (!selectedTarea) return null;
    return clientesDb.find(c => c.cliente === selectedTarea.cliente && c.linea_negocio === selectedTarea.linea_negocio);
  }, [clientesDb, selectedTarea]);

  const handleSubmitTiempo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTarea) return;
    setLoading(true);

    const horasNum = parseFloat(formData.horas);
    if (horasNum <= 0) {
      toast.error("Las horas deben ser mayores a 0");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("tiempos_log").insert([
      {
        id_tarea: selectedTarea.id,
        fecha_trabajo: formData.fecha_trabajo,
        horas: horasNum,
        comentario: formData.comentario,
        persona: formData.persona,
        registrado_en: new Date().toISOString(),
      },
    ]);

    if (!error && selectedTarea.estado === "Pendiente") {
      await supabase.from("tareas").update({ estado: "En Proceso" }).eq("id", selectedTarea.id);
    }

    setLoading(false);

    if (error) {
      toast.error("Error al registrar tiempo: " + error.message);
    } else {
      toast.success(`Se registraron ${horasNum} h en la tarea`);
      setFormData(prev => ({ ...prev, comentario: "" }));
      router.refresh();
    }
  };

  const handleCompletar = async () => {
    if (!selectedTarea) return;
    setLoadingCompletar(true);
    const { error } = await supabase.from("tareas")
      .update({ estado: "Completada", fecha_completada: new Date().toISOString() })
      .eq("id", selectedTarea.id);
    
    setLoadingCompletar(false);
    
    if (error) {
      toast.error("Error al completar la tarea: " + error.message);
    } else {
      toast.success("Tarea marcada como Completada");
      setSelectedTareaId("");
      router.refresh();
    }
  };

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-axia-blue">⏱️ Consola de Tiempos</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
        <h2 className="text-lg font-bold text-axia-dark mb-4">Seleccionar Tarea Activa</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1">
            <label className="block text-sm font-bold text-axia-gray mb-1.5">Filtrar por Responsable</label>
            <select value={fResp} onChange={e => setFResp(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm">
              <option value="">Todos</option>
              {responsables.map(r => <option key={String(r)} value={String(r)}>{r}</option>)}
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="block text-sm font-bold text-axia-gray mb-1.5">Filtrar por Cliente</label>
            <select value={fCliente} onChange={e => setFCliente(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm">
              <option value="">Todos</option>
              {clientes.map(c => <option key={String(c)} value={String(c)}>{c}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-axia-gray mb-1.5">Seleccionar Tarea</label>
            <select value={selectedTareaId} onChange={e => setSelectedTareaId(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm font-medium text-axia-dark">
              <option value="">Elegí una tarea pendiente o en proceso...</option>
              {tareasFiltradas.map(t => (
                <option key={t.id} value={t.id}>
                  {t.cliente} · {t.descripcion?.slice(0,60) || t.categoria} (Vence: {t.fecha_vencimiento ? new Date(t.fecha_vencimiento+"T00:00:00").toLocaleDateString("es-AR") : "S/F"})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedTarea && (
        <div className="animate-in slide-in-from-bottom-4 duration-500">
          {/* Tarjetas resumen */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-start gap-4">
              <div className="p-3 bg-blue-50 text-axia-blue rounded-lg"><Building size={24}/></div>
              <div>
                <p className="text-xs font-bold text-axia-gray uppercase tracking-wider">Cliente</p>
                <p className="font-bold text-axia-dark mt-0.5">{selectedTarea.cliente}</p>
                <p className="text-xs text-axia-gray mt-1">{selectedTarea.linea_negocio} {selectedTarea.sociedad ? `· ${selectedTarea.sociedad}` : ""}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-start gap-4">
              <div className="p-3 bg-teal-50 text-axia-teal rounded-lg"><User size={24}/></div>
              <div>
                <p className="text-xs font-bold text-axia-gray uppercase tracking-wider">Responsable</p>
                <p className="font-bold text-axia-dark mt-0.5">{selectedTarea.responsable}</p>
                <p className="text-xs text-axia-gray mt-1">Complejidad: {selectedTarea.complejidad || "—"}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-start gap-4">
              <div className="p-3 bg-orange-50 text-axia-orange rounded-lg"><Clock size={24}/></div>
              <div>
                <p className="text-xs font-bold text-axia-gray uppercase tracking-wider">Horas reales / Presup.</p>
                <p className="font-bold text-axia-dark mt-0.5">{horasReales.toFixed(2)} / {selectedTarea.horas_presupuestadas?.toFixed(2) || "0.00"} h</p>
                <p className={`text-xs mt-1 font-bold ${horasReales > selectedTarea.horas_presupuestadas ? "text-rose-500" : "text-emerald-500"}`}>
                  Desvío: {(horasReales - (selectedTarea.horas_presupuestadas || 0)).toFixed(2)} h
                </p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-start gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle2 size={24}/></div>
              <div>
                <p className="text-xs font-bold text-axia-gray uppercase tracking-wider">Estado Actual</p>
                <p className="font-bold text-axia-dark mt-0.5">{selectedTarea.estado}</p>
                <p className="text-xs text-axia-gray mt-1">{selectedTarea.descripcion}</p>
              </div>
            </div>
                      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-start gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg"><DollarSign size={24}/></div>
              <div>
                <p className="text-xs font-bold text-axia-gray uppercase tracking-wider">Honorario Mensual</p>
                <p className="font-bold text-axia-dark mt-0.5">
                  {honorarioInfo && honorarioInfo.ultima_cobranza_monto ? `$ ${Number(honorarioInfo.ultima_cobranza_monto).toLocaleString("es-AR")}` : "—"}
                </p>
                <p className="text-xs text-axia-gray mt-1">Período: {honorarioInfo?.ultima_cobranza_periodo || "—"}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Formulario Carga */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-axia-blue mb-4">Registrar sesión de trabajo</h3>
                <form onSubmit={handleSubmitTiempo} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-axia-gray mb-1.5">Fecha de trabajo</label>
                      <input required type="date" name="fecha_trabajo" max={new Date().toISOString().split("T")[0]} value={formData.fecha_trabajo} onChange={e => setFormData({...formData, fecha_trabajo: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-axia-gray mb-1.5">Horas invertidas</label>
                      <input required type="number" step="0.25" min="0" name="horas" value={formData.horas} onChange={e => setFormData({...formData, horas: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-bold text-axia-gray mb-1.5">Comentario</label>
                      <input type="text" name="comentario" value={formData.comentario} onChange={e => setFormData({...formData, comentario: e.target.value})} placeholder="Ej: Conciliación bancaria..." className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-axia-gray mb-1.5">¿Quién trabajó?</label>
                      <select name="persona" value={formData.persona} onChange={e => setFormData({...formData, persona: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm">
                        <option value="Agustin">Agustín</option>
                        <option value="Chiara">Chiara</option>
                        <option value="Paula">Paula</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="w-full mt-2 bg-axia-teal text-white py-2.5 rounded-lg font-bold shadow-sm hover:bg-teal-700 transition-colors flex justify-center items-center gap-2">
                    {loading ? "Guardando..." : <><Save size={18}/> Guardar Tiempo</>}
                  </button>
                </form>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-emerald-200 bg-emerald-50/30 p-6">
                <h3 className="text-lg font-bold text-emerald-800 mb-2">Completar Tarea</h3>
                <p className="text-sm text-emerald-700/80 mb-4">Si ya terminaste con esta tarea, marcala como completada. Desaparecerá de esta lista.</p>
                <div className="flex items-center gap-3 mb-4">
                  <input type="checkbox" id="confirmFin" checked={confirmarFin} onChange={e => setConfirmarFin(e.target.checked)} className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500" />
                  <label htmlFor="confirmFin" className="text-sm font-bold text-emerald-800 cursor-pointer">Confirmo que la tarea está terminada</label>
                </div>
                <button onClick={handleCompletar} disabled={!confirmarFin || loadingCompletar} className="w-full bg-emerald-600 text-white py-2.5 rounded-lg font-bold shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  ✅ Completar Tarea Definitivamente
                </button>
              </div>
            </div>

            {/* Historial */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 border-b border-gray-100 bg-slate-50">
                <h3 className="text-lg font-bold text-axia-dark">Historial de Tiempos</h3>
              </div>
              {histTarea.length === 0 ? (
                <div className="p-8 text-center text-axia-gray">
                  <p>Sin registros de tiempo todavía.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white border-b border-gray-100 text-axia-gray text-[10px] tracking-wider uppercase font-bold">
                        <th className="p-4">Fecha</th>
                        <th className="p-4">Persona</th>
                        <th className="p-4">Horas</th>
                        <th className="p-4">Comentario</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-sm">
                      {histTarea.map(h => (
                        <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 font-medium text-axia-dark whitespace-nowrap">
                            {new Date(h.fecha_trabajo+"T00:00:00").toLocaleDateString("es-AR")}
                          </td>
                          <td className="p-4 font-medium text-axia-blue">
                            {h.persona}
                          </td>
                          <td className="p-4 font-bold text-axia-teal">
                            {Number(h.horas).toFixed(2)} h
                          </td>
                          <td className="p-4 text-axia-gray text-xs">
                            {h.comentario || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
