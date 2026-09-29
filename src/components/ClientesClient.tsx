"use client";

import { useState, useMemo } from "react";
import { Users, Building, Plus, Trash2, Edit2, DollarSign, Check, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function ClientesClient({ clientes, sociedades }: { clientes: any[], sociedades: any[] }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"clientes" | "sociedades">("clientes");
  
  // Modals state
  const [isClienteModalOpen, setIsClienteModalOpen] = useState(false);
  const [isSociedadModalOpen, setIsSociedadModalOpen] = useState(false);
  const [editingClienteId, setEditingClienteId] = useState<string | null>(null);
  const [updatingPagoId, setUpdatingPagoId] = useState<string | null>(null);

  // Forms state
  const [formDataCliente, setFormDataCliente] = useState({
    cliente: "", linea_negocio: "Estudio Contable", tipo_honorario: "Mensual",
    ultima_cobranza_monto: "", ultima_cobranza_periodo: ""
  });
  
  const [formDataSociedad, setFormDataSociedad] = useState({
    sociedad: "", cuit: "", cliente: "", tipo: "SA", balance_mensual: "No"
  });

  const [loading, setLoading] = useState(false);

  // Metricas Clientes
  const metricasClientes = useMemo(() => {
    let estudio = 0, cfo = 0, ambas = 0;
    const porCliente = new Map();
    clientes.forEach(c => {
      if (!porCliente.has(c.cliente)) porCliente.set(c.cliente, new Set());
      porCliente.get(c.cliente).add(c.linea_negocio);
      
      if (c.linea_negocio === "Estudio Contable") estudio++;
      if (c.linea_negocio === "Consultoría CFO") cfo++;
    });
    
    porCliente.forEach(lineas => {
      if (lineas.size > 1) ambas++;
    });
    return { estudio, cfo, ambas };
  }, [clientes]);

  // Handle Cliente Submit
  const handleSaveCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const payload = {
      ...formDataCliente,
      ultima_cobranza_monto: formDataCliente.ultima_cobranza_monto ? Number(formDataCliente.ultima_cobranza_monto) : null
    };

    let error;
    if (editingClienteId) {
      const res = await supabase.from("clientes").update(payload).eq("id", editingClienteId);
      error = res.error;
    } else {
      const res = await supabase.from("clientes").insert([payload]);
      error = res.error;
    }

    setLoading(false);
    if (error) {
      toast.error("Error al guardar cliente: " + error.message);
    } else {
      toast.success(editingClienteId ? "Cliente actualizado" : "Cliente guardado");
      setIsClienteModalOpen(false);
      setEditingClienteId(null);
      setFormDataCliente({ cliente: "", linea_negocio: "Estudio Contable", tipo_honorario: "Mensual", ultima_cobranza_monto: "", ultima_cobranza_periodo: "" });
      router.refresh();
    }
  };

  const openNewCliente = () => {
    setEditingClienteId(null);
    setFormDataCliente({ cliente: "", linea_negocio: "Estudio Contable", tipo_honorario: "Mensual", ultima_cobranza_monto: "", ultima_cobranza_periodo: "" });
    setIsClienteModalOpen(true);
  };

  const openTrabajoEventual = () => {
    setEditingClienteId(null);
    setFormDataCliente({ cliente: "", linea_negocio: "Estudio Contable", tipo_honorario: "Eventual", ultima_cobranza_monto: "", ultima_cobranza_periodo: "" });
    setIsClienteModalOpen(true);
  };

  const openEditCliente = (c: any) => {
    setEditingClienteId(c.id);
    setFormDataCliente({
      cliente: c.cliente,
      linea_negocio: c.linea_negocio,
      tipo_honorario: c.tipo_honorario,
      ultima_cobranza_monto: c.ultima_cobranza_monto || "",
      ultima_cobranza_periodo: c.ultima_cobranza_periodo || "",
    });
    setIsClienteModalOpen(true);
  };

  const togglePagoConfirmado = async (c: any) => {
    if (updatingPagoId === c.id) return;
    setUpdatingPagoId(c.id);
    const newValue = !c.pago_confirmado;
    const { error } = await supabase.from("clientes").update({ pago_confirmado: newValue }).eq("id", c.id);
    if (error) {
      toast.error("Error al actualizar estado de pago: " + error.message);
      setUpdatingPagoId(null);
    } else {
      c.pago_confirmado = newValue; // Optimistic update to prevent flash of old state
      toast.success(newValue ? "Marcado como COBRADO" : "Marcado como PENDIENTE");
      router.refresh();
      setUpdatingPagoId(null);
    }
  };

  // Handle Sociedad Submit
  const handleSaveSociedad = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("sociedades").insert([formDataSociedad]);
    setLoading(false);
    if (error) {
      toast.error("Error al guardar sociedad: " + error.message);
    } else {
      toast.success("Sociedad guardada");
      setIsSociedadModalOpen(false);
      setFormDataSociedad({ sociedad: "", cuit: "", cliente: "", tipo: "SA", balance_mensual: "No" });
      router.refresh();
    }
  };

  // Delete Handlers
  const handleDeleteCliente = async (id: string) => {
    if (!confirm("¿Eliminar este registro de honorario?")) return;
    const { error } = await supabase.from("clientes").delete().eq("id", id);
    if (error) toast.error("Error: " + error.message);
    else { toast.success("Registro eliminado"); router.refresh(); }
  };

  const handleDeleteSociedad = async (id: string) => {
    if (!confirm("¿Eliminar esta sociedad?")) return;
    const { error } = await supabase.from("sociedades").delete().eq("id", id);
    if (error) toast.error("Error: " + error.message);
    else { toast.success("Sociedad eliminada"); router.refresh(); }
  };

  const clientesUnicos = Array.from(new Set(clientes.map(c => c.cliente))).sort();

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-axia-blue">👥 Clientes y Sociedades</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-200">
        <button 
          onClick={() => setActiveTab("clientes")}
          className={`pb-3 px-4 font-bold text-sm transition-colors relative ${activeTab === "clientes" ? "text-axia-blue" : "text-gray-400 hover:text-gray-600"}`}
        >
          <span className="flex items-center gap-2"><Users size={18}/> Clientes y Honorarios</span>
          {activeTab === "clientes" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-axia-blue rounded-t-full"></div>}
        </button>
        <button 
          onClick={() => setActiveTab("sociedades")}
          className={`pb-3 px-4 font-bold text-sm transition-colors relative ${activeTab === "sociedades" ? "text-axia-blue" : "text-gray-400 hover:text-gray-600"}`}
        >
          <span className="flex items-center gap-2"><Building size={18}/> Sociedades (CUIT)</span>
          {activeTab === "sociedades" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-axia-blue rounded-t-full"></div>}
        </button>
      </div>

      {/* Tab 1: Clientes */}
      {activeTab === "clientes" && (
        <div className="animate-in slide-in-from-right-2 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <p className="text-xs font-bold text-axia-gray uppercase tracking-wider">Estudio Contable</p>
              <p className="text-3xl font-bold text-axia-blue mt-1">{metricasClientes.estudio}</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <p className="text-xs font-bold text-axia-gray uppercase tracking-wider">Consultoría CFO</p>
              <p className="text-3xl font-bold text-axia-teal mt-1">{metricasClientes.cfo}</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <p className="text-xs font-bold text-axia-gray uppercase tracking-wider">Ambas líneas</p>
              <p className="text-3xl font-bold text-axia-orange mt-1">{metricasClientes.ambas}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
              <p className="text-sm text-axia-gray font-medium">Un cliente puede tener un honorario distinto por cada línea de negocio.</p>
              <div className="flex gap-2">
                <button onClick={openTrabajoEventual} className="flex items-center gap-2 bg-axia-teal text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-teal-600 transition-colors">
                  <Plus size={16}/> Trabajo Eventual
                </button>
                <button onClick={openNewCliente} className="flex items-center gap-2 bg-axia-blue text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-800 transition-colors">
                  <Plus size={16}/> Agregar Cliente
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-gray-100 text-axia-gray text-[10px] tracking-wider uppercase font-bold">
                    <th className="p-4">Cliente</th>
                    <th className="p-4">Línea de Negocio</th>
                    <th className="p-4">Tipo</th>
                    <th className="p-4 text-right">Honorario Mensual ($)</th>
                    <th className="p-4">Período</th>
                    <th className="p-4 text-center">Pagó?</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-sm">
                  {clientes.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-axia-gray">No hay clientes cargados.</td></tr>
                  ) : clientes.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-4 font-bold text-axia-dark">{c.cliente}</td>
                      <td className="p-4 font-medium text-axia-gray">{c.linea_negocio}</td>
                      <td className="p-4"><span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-bold">{c.tipo_honorario}</span></td>
                      <td className="p-4 font-bold text-emerald-600 text-right">{c.ultima_cobranza_monto ? `$ ${Number(c.ultima_cobranza_monto).toLocaleString("es-AR")}` : "—"}</td>
                      <td className="p-4 text-axia-gray font-medium">{c.ultima_cobranza_periodo || "—"}</td>
                      <td className="p-4 text-center">
                        {(c.tipo_honorario === "Mensual" || c.tipo_honorario === "Eventual") && (
                          <button 
                            onClick={() => togglePagoConfirmado(c)}
                            disabled={updatingPagoId === c.id}
                            className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm transition-colors flex items-center gap-1 mx-auto ${
                              updatingPagoId === c.id ? 'bg-gray-100 text-gray-500 cursor-wait' 
                              : c.pago_confirmado ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                              : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                            }`}
                            title={c.pago_confirmado ? "Marcar como no cobrado" : "Marcar como cobrado"}
                          >
                            {updatingPagoId === c.id ? (
                              <><span className="animate-spin inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full"></span> ...</>
                            ) : c.pago_confirmado ? (
                              <><Check size={12}/> SI</>
                            ) : (
                              <><X size={12}/> NO</>
                            )}
                          </button>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1 opacity-100 transition-opacity">
                          <button onClick={() => openEditCliente(c)} className="p-1 text-axia-blue hover:bg-blue-50 rounded-md transition-colors" title="Editar"><Edit2 size={16}/></button>
                          <button onClick={() => handleDeleteCliente(c.id)} className="p-1 text-rose-500 hover:bg-rose-50 rounded-md transition-colors" title="Eliminar"><Trash2 size={16}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Sociedades */}
      {activeTab === "sociedades" && (
        <div className="animate-in slide-in-from-left-2 duration-300">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
              <p className="text-sm text-axia-gray font-medium">Razones sociales vinculadas al calendario de AFIP.</p>
              <button onClick={() => setIsSociedadModalOpen(true)} className="flex items-center gap-2 bg-axia-blue text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-800 transition-colors">
                <Plus size={16}/> Agregar Sociedad
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-gray-100 text-axia-gray text-[10px] tracking-wider uppercase font-bold">
                    <th className="p-4">Sociedad / Razón Social</th>
                    <th className="p-4">CUIT</th>
                    <th className="p-4">Cliente Padre</th>
                    <th className="p-4">Tipo</th>
                    <th className="p-4">Balance Mensual</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-sm">
                  {sociedades.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-axia-gray">No hay sociedades cargadas.</td></tr>
                  ) : sociedades.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-4 font-bold text-axia-blue">{s.sociedad}</td>
                      <td className="p-4 font-mono text-xs text-axia-dark">{s.cuit || "—"}</td>
                      <td className="p-4 font-medium text-axia-gray">{s.cliente}</td>
                      <td className="p-4"><span className="border border-gray-200 bg-white text-gray-600 px-2 py-0.5 rounded text-xs font-bold">{s.tipo}</span></td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${s.balance_mensual === "Si" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{s.balance_mensual}</span>
                      </td>
                      <td className="p-4 text-right">
                        <button onClick={() => handleDeleteSociedad(s.id)} className="p-1 text-rose-500 hover:bg-rose-50 rounded-md transition-colors opacity-100" title="Eliminar"><Trash2 size={16}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cliente */}
      {isClienteModalOpen && (
        <div className="fixed inset-0 bg-axia-dark/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 p-6">
            <h3 className="text-xl font-bold text-axia-blue mb-6">{editingClienteId ? "Editar Cliente / Honorario" : "Agregar Cliente / Honorario"}</h3>
            <form onSubmit={handleSaveCliente} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-axia-gray mb-1.5">Nombre del Cliente</label>
                <input required autoFocus type="text" value={formDataCliente.cliente} onChange={e => setFormDataCliente({...formDataCliente, cliente: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-axia-gray mb-1.5">Línea de Negocio</label>
                  <select value={formDataCliente.linea_negocio} onChange={e => setFormDataCliente({...formDataCliente, linea_negocio: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm">
                    <option value="Estudio Contable">Estudio Contable</option>
                    <option value="Consultoría CFO">Consultoría CFO</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-axia-gray mb-1.5">Tipo de Honorario</label>
                  <select value={formDataCliente.tipo_honorario} onChange={e => setFormDataCliente({...formDataCliente, tipo_honorario: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm">
                    <option value="Mensual">Mensual</option>
                    <option value="Eventual">Eventual</option>
                    <option value="Interno">Interno</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-axia-gray mb-1.5">Monto ($)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><DollarSign size={16} className="text-gray-400"/></div>
                    <input type="number" min="0" value={formDataCliente.ultima_cobranza_monto} onChange={e => setFormDataCliente({...formDataCliente, ultima_cobranza_monto: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 pl-9 outline-none focus:border-axia-teal bg-white text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-axia-gray mb-1.5">Período (MM/AAAA)</label>
                  <input type="text" placeholder="Ej: 09/2026" value={formDataCliente.ultima_cobranza_periodo} onChange={e => setFormDataCliente({...formDataCliente, ultima_cobranza_periodo: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsClienteModalOpen(false)} className="px-5 py-2 text-axia-gray font-bold hover:bg-gray-50 rounded-lg transition-colors">Cancelar</button>
                <button type="submit" disabled={loading} className="px-6 py-2 bg-axia-blue text-white font-bold rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-50 shadow-sm">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Sociedad */}
      {isSociedadModalOpen && (
        <div className="fixed inset-0 bg-axia-dark/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 p-6">
            <h3 className="text-xl font-bold text-axia-blue mb-6">Agregar Sociedad (CUIT)</h3>
            <form onSubmit={handleSaveSociedad} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-axia-gray mb-1.5">Sociedad / Razón Social</label>
                <input required autoFocus type="text" value={formDataSociedad.sociedad} onChange={e => setFormDataSociedad({...formDataSociedad, sociedad: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-axia-gray mb-1.5">CUIT (solo números)</label>
                  <input type="text" maxLength={11} value={formDataSociedad.cuit} onChange={e => setFormDataSociedad({...formDataSociedad, cuit: e.target.value.replace(/\D/g, '')})} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-axia-gray mb-1.5">Cliente Padre</label>
                  <select required value={formDataSociedad.cliente} onChange={e => setFormDataSociedad({...formDataSociedad, cliente: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm">
                    <option value="">Seleccionar...</option>
                    {clientesUnicos.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-axia-gray mb-1.5">Tipo societario</label>
                  <select value={formDataSociedad.tipo} onChange={e => setFormDataSociedad({...formDataSociedad, tipo: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm">
                    <option value="SA">SA</option>
                    <option value="SRL">SRL</option>
                    <option value="SAS">SAS</option>
                    <option value="SH">SH</option>
                    <option value="Pers. Física">Pers. Física</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-axia-gray mb-1.5">Balance Mensual</label>
                  <select value={formDataSociedad.balance_mensual} onChange={e => setFormDataSociedad({...formDataSociedad, balance_mensual: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm">
                    <option value="No">No</option>
                    <option value="Si">Si</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsSociedadModalOpen(false)} className="px-5 py-2 text-axia-gray font-bold hover:bg-gray-50 rounded-lg transition-colors">Cancelar</button>
                <button type="submit" disabled={loading} className="px-6 py-2 bg-axia-blue text-white font-bold rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-50 shadow-sm">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
