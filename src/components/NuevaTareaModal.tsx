"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function NuevaTareaModal({ onClose, clientes = [], sociedades = [] }: { onClose: () => void, clientes?: any[], sociedades?: any[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    cliente: "",
    linea_negocio: "Estudio Contable",
    sociedad: "",
    categoria: "Impuestos",
    fecha_vencimiento: new Date().toISOString().split("T")[0],
    responsable: "Agustin",
    complejidad: "Baja",
    horas_presupuestadas: "1.0",
    estado: "Pendiente",
    descripcion: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = { ...formData };

    const { error } = await supabase.from("tareas").insert([
      {
        ...payload,
        horas_presupuestadas: parseFloat(formData.horas_presupuestadas),
        origen: "Manual",
      },
    ]);

    setLoading(false);

    if (error) {
      toast.error("Error al guardar la tarea: " + error.message);
    } else {
      toast.success("Tarea creada exitosamente");
      router.refresh();
      onClose();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="fixed inset-0 bg-axia-dark/50 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 my-8">
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-slate-50">
          <h2 className="text-xl font-bold text-axia-blue flex items-center gap-2">➕ Nueva Tarea Manual</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-axia-orange transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8">
          {/* Grilla 3x3 para los 9 campos cortos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5 mb-6">
            
            {/* Fila 1 */}
            <div>
              <label className="block text-sm font-bold text-axia-gray mb-1.5">Cliente</label>
              <select required name="cliente" value={formData.cliente} onChange={handleChange} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm">
                <option value="">Seleccionar cliente...</option>
                {clientes.map(c => (
                  <option key={c.id || c.cliente} value={c.cliente}>{c.cliente}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-axia-gray mb-1.5">Línea de Negocio</label>
              <select name="linea_negocio" value={formData.linea_negocio} onChange={handleChange} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm">
                <option value="Estudio Contable">Estudio Contable</option>
                <option value="Consultoría CFO">Consultoría CFO</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-axia-gray mb-1.5">Sociedad (opcional)</label>
              <select name="sociedad" value={formData.sociedad} onChange={handleChange} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm">
                <option value="">Ninguna</option>
                {sociedades.map(s => (
                  <option key={s.id || s.sociedad} value={s.sociedad}>{s.sociedad}</option>
                ))}
              </select>
            </div>

            {/* Fila 2 */}
            {/* ID se genera solo, se elimina el campo orden */}
            <div>
              <label className="block text-sm font-bold text-axia-gray mb-1.5">Categoría</label>
              <select name="categoria" value={formData.categoria} onChange={handleChange} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm">
                <option value="Impuestos">Impuestos</option>
                <option value="Contabilidad">Contabilidad</option>
                <option value="Sueldos">Sueldos</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-axia-gray mb-1.5">Fecha de vencimiento</label>
              <input required type="date" name="fecha_vencimiento" value={formData.fecha_vencimiento} onChange={handleChange} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-bold text-axia-gray mb-1.5">Responsable</label>
              <select name="responsable" value={formData.responsable} onChange={handleChange} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm">
                <option value="Agustin">Agustín</option>
                <option value="Chiara">Chiara</option>
                <option value="Paula">Paula</option>
              </select>
            </div>

            {/* Fila 3 */}
            <div>
              <label className="block text-sm font-bold text-axia-gray mb-1.5">Complejidad</label>
              <select name="complejidad" value={formData.complejidad} onChange={handleChange} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm">
                <option value="Baja">Baja</option>
                <option value="Media">Media</option>
                <option value="Alta">Alta</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-axia-gray mb-1.5">Horas presupuestadas</label>
              <select required name="horas_presupuestadas" value={formData.horas_presupuestadas} onChange={handleChange} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm">
                {[0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 15, 20].map(h => (
                  <option key={h} value={h}>{h} hs</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-axia-gray mb-1.5">Estado</label>
              <select name="estado" value={formData.estado} onChange={handleChange} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm">
                <option value="Pendiente">Pendiente</option>
                <option value="En Proceso">En Proceso</option>
                <option value="Completada">Completada</option>
              </select>
            </div>
          </div>

          {/* Textarea ocupa todo el ancho abajo */}
          <div>
            <label className="block text-sm font-bold text-axia-gray mb-1.5">Descripción</label>
            <textarea required name="descripcion" value={formData.descripcion} onChange={handleChange} placeholder="Ej: Armado de flujo de caja" rows={4} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm resize-none" />
          </div>

          <div className="pt-6 mt-8 border-t border-gray-100 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-6 py-2.5 text-axia-gray font-bold hover:bg-gray-50 rounded-lg transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="px-8 py-2.5 bg-axia-blue text-white font-bold rounded-lg hover:bg-blue-900 transition-colors disabled:opacity-50 shadow-md">
              {loading ? "Guardando..." : "Guardar tarea"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
