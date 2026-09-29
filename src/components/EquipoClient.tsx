"use client";

import { useState } from "react";
import { Users, Plus, Trash2, Edit2, ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function EquipoClient({ equipo }: { equipo: any[] }) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  

  const [formData, setFormData] = useState({
    id: "", nombre: "", rol: "empleado", password: "", tarifa_hora: "0", sueldo_mensual: "0", es_socio: "No"
  });
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);


  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const payload = {
      nombre: formData.nombre,
      rol: formData.rol,
      password: formData.password,
      es_socio: formData.es_socio,
      tarifa_hora: Number(formData.tarifa_hora),
      sueldo_mensual: Number(formData.sueldo_mensual)
    };

    let error;
    if (isEditMode) {
      const res = await supabase.from("equipo").update(payload).eq("id", formData.id);
      error = res.error;
    } else {
      const res = await supabase.from("equipo").insert([payload]);
      error = res.error;
    }

    setLoading(false);
    
    if (error) {
      toast.error("Error: " + error.message);
    } else {
      toast.success(isEditMode ? "Usuario actualizado" : "Usuario creado");
      setIsModalOpen(false);
      setIsEditMode(false);
      setFormData({ id: "", nombre: "", rol: "empleado", password: "", tarifa_hora: "0", sueldo_mensual: "0", es_socio: "No" });
      router.refresh();
    }
  };

  const openEdit = (user: any) => {
    setFormData({
      id: user.id,
      nombre: user.nombre,
      rol: user.rol,
      password: user.password,
      es_socio: user.es_socio,
      tarifa_hora: String(user.tarifa_hora),
      sueldo_mensual: String(user.sueldo_mensual)
    });
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    setLoading(true);
    const { error } = await supabase.from("equipo").delete().eq("id", userToDelete.id);
    setLoading(false);
    if (error) {
      toast.error("Error: " + error.message);
    } else {
      toast.success("Usuario eliminado");
      setUserToDelete(null);
      router.refresh();
    }
  };

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-axia-blue">Gestión del Equipo y Accesos</h1>
        <button onClick={() => { setIsEditMode(false); setFormData({ id: "", nombre: "", rol: "empleado", password: "", tarifa_hora: "0", sueldo_mensual: "0", es_socio: "No" }); setIsModalOpen(true); }} className="flex items-center gap-2 bg-axia-blue text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-800 transition-colors">
          <Plus size={18}/> Nuevo Usuario
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">
        <div className="p-4 border-b border-gray-100 flex items-center gap-3 bg-slate-50">
          <ShieldAlert size={20} className="text-axia-gray" />
          <p className="text-sm text-axia-gray font-medium">Acá controlás quién tiene acceso al sistema y sus costos para Rentabilidad.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-gray-100 text-axia-gray text-[10px] tracking-wider uppercase font-bold">
                <th className="p-4">Nombre</th>
                <th className="p-4">Rol en el sistema</th>
                <th className="p-4">Contraseña</th>
                <th className="p-4">¿Es Socio?</th>
                <th className="p-4 text-right">Tarifa Hora ($)</th>
                <th className="p-4 text-right">Sueldo Mensual ($)</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {equipo.map(e => (
                <tr key={e.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="p-4 font-bold text-axia-dark flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${e.rol === "admin" ? "bg-rose-500" : "bg-emerald-500"}`}></div>
                    {e.nombre}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${e.rol === "admin" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {e.rol}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-xs text-gray-500">{e.password}</td>
                  <td className="p-4 font-medium text-axia-gray">{e.es_socio}</td>
                  <td className="p-4 text-right font-medium text-axia-gray">{Number(e.tarifa_hora).toLocaleString("es-AR")}</td>
                  <td className="p-4 text-right font-medium text-axia-gray">{Number(e.sueldo_mensual).toLocaleString("es-AR")}</td>
                  <td className="p-4 text-right">
                    
                    <div className="flex justify-end gap-2 opacity-100 transition-opacity">
                      <button onClick={() => openEdit(e)} className="p-1 text-axia-blue hover:bg-blue-50 rounded-md transition-colors" title="Editar"><Edit2 size={16}/></button>
                      <button onClick={() => {
                        if (e.rol === "admin" && equipo.filter(u => u.rol === "admin").length === 1) {
                          toast.error("No podés eliminar al único administrador.");
                          return;
                        }
                        setUserToDelete(e);
                      }} className="p-1 text-rose-500 hover:bg-rose-50 rounded-md transition-colors" title="Eliminar"><Trash2 size={16}/></button>
                    </div>

                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-axia-dark/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 p-6">
            <h3 className="text-xl font-bold text-axia-blue mb-6">{isEditMode ? "Editar Usuario" : "Alta de Usuario"}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-axia-gray mb-1.5">Nombre (Usuario)</label>
                  <input required autoFocus type="text" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-axia-gray mb-1.5">Rol de Acceso</label>
                  <select value={formData.rol} onChange={e => setFormData({...formData, rol: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm">
                    <option value="empleado">Empleado</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-axia-gray mb-1.5">Contraseña</label>
                  <input required type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-axia-gray mb-1.5">¿Es Socio?</label>
                  <select value={formData.es_socio} onChange={e => setFormData({...formData, es_socio: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm">
                    <option value="No">No</option>
                    <option value="Si">Si</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-sm font-bold text-axia-gray mb-1.5">Tarifa Hora ($) <span className="font-normal text-[10px]">- Para Costo Std</span></label>
                  <input required type="number" value={formData.tarifa_hora} onChange={e => setFormData({...formData, tarifa_hora: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-axia-gray mb-1.5">Sueldo Mensual ($)</label>
                  <input required type="number" value={formData.sueldo_mensual} onChange={e => setFormData({...formData, sueldo_mensual: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm" />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 text-axia-gray font-bold hover:bg-gray-50 rounded-lg transition-colors">Cancelar</button>
                <button type="submit" disabled={loading} className="px-6 py-2 bg-axia-blue text-white font-bold rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-50 shadow-sm">{isEditMode ? "Actualizar" : "Guardar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 bg-axia-dark/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 p-6 text-center">
            <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-axia-dark mb-2">¿Eliminar usuario?</h3>
            <p className="text-sm text-axia-gray mb-6">Estás a punto de eliminar a <b>{userToDelete.nombre}</b>. Esta persona perderá el acceso al sistema inmediatamente.</p>
            <div className="flex gap-3">
              <button onClick={() => setUserToDelete(null)} disabled={loading} className="flex-1 px-4 py-2 text-axia-gray font-bold bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
              <button onClick={confirmDelete} disabled={loading} className="flex-1 px-4 py-2 bg-rose-500 text-white font-bold rounded-lg hover:bg-rose-600 transition-colors shadow-sm disabled:opacity-50">Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
