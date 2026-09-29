"use client";

import { useState } from "react";
import { CalendarDays, Settings, UploadCloud, FileSpreadsheet, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export default function GenerarClient({ plantillas, sociedades, clientes }: { plantillas: any[], sociedades: any[], clientes: any[] }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"generar" | "plantillas">("generar");
  
  // Plantillas form state
  const [isPlantillaModalOpen, setIsPlantillaModalOpen] = useState(false);
  const [formDataPlantilla, setFormDataPlantilla] = useState({
    obligacion: "", columna_origen: "", categoria: "Impuestos", horas: "1.0", complejidad: "Baja", titulo_calendar: ""
  });
  const [loading, setLoading] = useState(false);

  // Generar state
  const [mesGenerar, setMesGenerar] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1); // Suggests next month
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [responsable, setResponsable] = useState("Agustin");
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [sinEmparejar, setSinEmparejar] = useState<string[]>([]);

  // ---- Plantillas Logic ----
  const handleSavePlantilla = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("plantillas").insert([{
      ...formDataPlantilla, horas: Number(formDataPlantilla.horas)
    }]);
    setLoading(false);
    if (error) toast.error("Error: " + error.message);
    else {
      toast.success("Plantilla guardada");
      setIsPlantillaModalOpen(false);
      setFormDataPlantilla({ obligacion: "", columna_origen: "", categoria: "Impuestos", horas: "1.0", complejidad: "Baja", titulo_calendar: "" });
      router.refresh();
    }
  };

  const handleDeletePlantilla = async (id: string) => {
    if (!confirm("¿Eliminar plantilla?")) return;
    await supabase.from("plantillas").delete().eq("id", id);
    toast.success("Plantilla eliminada");
    router.refresh();
  };

  // ---- Generar Logic ----
  const normalizar = (txt: string) => (txt || "").toString().toLowerCase().trim();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsProcessingFile(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0]; // Assume first sheet or base calendario
      const rawJson = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
      
      const [anioStr, mesStr] = mesGenerar.split("-");
      const anio = parseInt(anioStr);
      const mes = parseInt(mesStr);

      const filas: any[] = [];
      const noEncontrados: string[] = [];

      rawJson.forEach((row: any) => {
        // Find sociedad by exact CUIT or exact Name
        const rowClienteName = normalizar(row["Cliente"] || row["CLIENTE"] || "");
        if (!rowClienteName) return;

        let soc = sociedades.find(s => normalizar(s.sociedad) === rowClienteName);
        if (!soc && row["CUIT"]) {
          soc = sociedades.find(s => s.cuit === String(row["CUIT"]).replace(/\D/g,""));
        }

        if (!soc) {
          if (!noEncontrados.includes(row["Cliente"])) noEncontrados.push(row["Cliente"]);
          return;
        }

        // Check against plantillas
        plantillas.forEach(p => {
          if (p.columna_origen === "Fin_De_Mes") return; // Handled separately
          const cellValue = row[p.columna_origen];
          if (!cellValue) return;

          // Attempt to parse cellValue to Date
          let d: Date | null = null;
          if (typeof cellValue === "number") {
             d = new Date((cellValue - (25567 + 2)) * 86400 * 1000); // Excel date
          } else {
             const parts = String(cellValue).split("/");
             if (parts.length === 3) d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
          }

          if (d && !isNaN(d.getTime())) {
            // Check if matches selected month
            if (d.getFullYear() === anio && (d.getMonth() + 1) === mes) {
              filas.push({
                crear: true,
                sociedad: soc.sociedad,
                cliente: soc.cliente,
                obligacion: p.obligacion,
                categoria: p.categoria,
                fecha_vencimiento: d.toISOString().split("T")[0],
                responsable,
                complejidad: p.complejidad,
                horas_presupuestadas: p.horas
              });
            }
          }
        });
      });

      // Add "Fin de mes" balances
      const lastDay = new Date(anio, mes, 0).toISOString().split("T")[0];
      plantillas.filter(p => p.columna_origen === "Fin_De_Mes").forEach(p => {
        sociedades.filter(s => s.balance_mensual === "Si").forEach(soc => {
          filas.push({
            crear: true,
            sociedad: soc.sociedad,
            cliente: soc.cliente,
            obligacion: p.obligacion,
            categoria: p.categoria,
            fecha_vencimiento: lastDay,
            responsable,
            complejidad: p.complejidad,
            horas_presupuestadas: p.horas
          });
        });
      });

      // Fetch existing tasks to detect Ya_Existe
      const { data: tareasExistentes } = await supabase
        .from("tareas")
        .select("sociedad, obligacion, fecha_vencimiento")
        .gte("fecha_vencimiento", `${anio}-${String(mes).padStart(2,"0")}-01`)
        .lte("fecha_vencimiento", lastDay);

      filas.forEach(f => {
        const existe = tareasExistentes?.some(t => t.sociedad === f.sociedad && t.obligacion === f.obligacion && t.fecha_vencimiento === f.fecha_vencimiento);
        f.ya_existe = existe;
        f.crear = !existe;
      });

      setPreviewData(filas.sort((a,b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento)));
      setSinEmparejar(noEncontrados);
    } catch (err: any) {
      toast.error("Error leyendo archivo: " + err.message);
    } finally {
      setIsProcessingFile(false);
      if (e.target) e.target.value = ""; // reset input
    }
  };

  const handleCreateTasks = async () => {
    const aCrear = previewData.filter(p => p.crear);
    if (aCrear.length === 0) return;
    setLoading(true);

    const payload = aCrear.map(p => {
      // Find line_negocio from clients table or fallback to "Estudio Contable"
      const c = clientes.find(cli => cli.cliente === p.cliente && cli.linea_negocio === "Estudio Contable");
      return {
        cliente: p.cliente,
        sociedad: p.sociedad,
        linea_negocio: c ? c.linea_negocio : "Estudio Contable",
        obligacion: p.obligacion,
        categoria: p.categoria,
        descripcion: `${p.obligacion} - ${p.sociedad}`,
        fecha_vencimiento: p.fecha_vencimiento,
        responsable: p.responsable,
        complejidad: p.complejidad,
        horas_presupuestadas: p.horas_presupuestadas,
        estado: "Pendiente"
      };
    });

    const { error } = await supabase.from("tareas").insert(payload);
    setLoading(false);
    
    if (error) {
      toast.error("Error creando tareas: " + error.message);
    } else {
      toast.success(`Se crearon ${payload.length} tareas exitosamente`);
      setPreviewData([]);
    }
  };

  const toggleCrear = (index: number) => {
    const copy = [...previewData];
    if (!copy[index].ya_existe) {
      copy[index].crear = !copy[index].crear;
      setPreviewData(copy);
    }
  };

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-axia-blue">🗓️ Generar Mes (AFIP)</h1>
      </div>

      <div className="flex gap-4 mb-6 border-b border-gray-200">
        <button onClick={() => setActiveTab("generar")} className={`pb-3 px-4 font-bold text-sm transition-colors relative ${activeTab === "generar" ? "text-axia-blue" : "text-gray-400 hover:text-gray-600"}`}>
          <span className="flex items-center gap-2"><CalendarDays size={18}/> Generar Vencimientos</span>
          {activeTab === "generar" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-axia-blue rounded-t-full"></div>}
        </button>
        <button onClick={() => setActiveTab("plantillas")} className={`pb-3 px-4 font-bold text-sm transition-colors relative ${activeTab === "plantillas" ? "text-axia-blue" : "text-gray-400 hover:text-gray-600"}`}>
          <span className="flex items-center gap-2"><Settings size={18}/> Configurar Plantillas</span>
          {activeTab === "plantillas" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-axia-blue rounded-t-full"></div>}
        </button>
      </div>

      {activeTab === "generar" && (
        <div className="animate-in slide-in-from-right-2 duration-300">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-bold text-axia-gray mb-1.5">Mes a generar</label>
                <input type="month" value={mesGenerar} onChange={e => setMesGenerar(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal font-bold text-axia-dark bg-slate-50" />
              </div>
              <div>
                <label className="block text-sm font-bold text-axia-gray mb-1.5">Responsable por defecto</label>
                <select value={responsable} onChange={e => setResponsable(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white font-medium text-axia-dark">
                  <option value="Agustin">Agustín</option>
                  <option value="Chiara">Chiara</option>
                  <option value="Paula">Paula</option>
                </select>
              </div>
            </div>

            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-axia-teal transition-colors bg-slate-50">
              <FileSpreadsheet size={40} className="mx-auto text-axia-teal mb-3" />
              <p className="text-axia-dark font-bold mb-1">Subir planilla Calendario AFIP</p>
              <p className="text-sm text-axia-gray mb-4">Exportá la hoja "Base Calendario" como .CSV o .XLSX y subila acá.</p>
              <label className="inline-flex cursor-pointer items-center gap-2 bg-axia-blue text-white px-6 py-2.5 rounded-lg font-bold shadow-sm hover:bg-blue-800 transition-colors">
                <UploadCloud size={18}/> {isProcessingFile ? "Procesando..." : "Seleccionar Archivo"}
                <input type="file" accept=".csv, .xlsx, .xls" className="hidden" onChange={handleFileUpload} disabled={isProcessingFile} />
              </label>
            </div>
            {sinEmparejar.length > 0 && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm font-bold text-amber-800 mb-1">⚠️ Cuidado: Sociedades no encontradas</p>
                <p className="text-xs text-amber-700">Las siguientes filas del archivo fueron ignoradas porque no coinciden con ninguna sociedad de tu base de datos: {sinEmparejar.join(", ")}</p>
              </div>
            )}
          </div>

          {previewData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-emerald-200 overflow-hidden">
              <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-emerald-800">Vista Previa</h3>
                  <p className="text-xs text-emerald-700">Se detectaron {previewData.length} tareas. Seleccioná cuáles crear.</p>
                </div>
                <button 
                  onClick={handleCreateTasks} 
                  disabled={loading || previewData.filter(p => p.crear).length === 0}
                  className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-bold shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? "Creando..." : <><CheckCircle2 size={18}/> Crear {previewData.filter(p => p.crear).length} tareas</>}
                </button>
              </div>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-white border-b border-gray-100 shadow-sm z-10">
                    <tr className="text-axia-gray text-[10px] tracking-wider uppercase font-bold">
                      <th className="p-3 w-12 text-center">Crear</th>
                      <th className="p-3">Sociedad</th>
                      <th className="p-3">Obligación</th>
                      <th className="p-3">Vencimiento</th>
                      <th className="p-3">Responsable</th>
                      <th className="p-3">Hs</th>
                      <th className="p-3 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-sm">
                    {previewData.map((p, idx) => (
                      <tr key={idx} className={`hover:bg-slate-50 transition-colors ${p.ya_existe ? "opacity-50 bg-gray-50" : ""}`}>
                        <td className="p-3 text-center">
                          <input type="checkbox" checked={p.crear} onChange={() => toggleCrear(idx)} disabled={p.ya_existe} className="w-4 h-4 text-emerald-600 rounded" />
                        </td>
                        <td className="p-3 font-bold text-axia-dark whitespace-nowrap">{p.sociedad}</td>
                        <td className="p-3 font-medium text-axia-gray">{p.obligacion}</td>
                        <td className="p-3 font-bold text-axia-teal">{p.fecha_vencimiento ? new Date(p.fecha_vencimiento+"T00:00:00").toLocaleDateString("es-AR") : ""}</td>
                        <td className="p-3 text-axia-gray font-medium">{p.responsable}</td>
                        <td className="p-3 text-axia-gray font-medium">{p.horas_presupuestadas}</td>
                        <td className="p-3 text-center">
                          {p.ya_existe ? <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Ya Existe</span> : <span className="text-emerald-600 text-[10px] font-bold uppercase">Nueva</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "plantillas" && (
        <div className="animate-in slide-in-from-left-2 duration-300">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
              <p className="text-sm text-axia-gray font-medium">Acá se configura cómo se interpreta el archivo de AFIP.</p>
              <button onClick={() => setIsPlantillaModalOpen(true)} className="flex items-center gap-2 bg-axia-blue text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-800 transition-colors">
                <Plus size={16}/> Agregar Plantilla
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-gray-100 text-axia-gray text-[10px] tracking-wider uppercase font-bold">
                    <th className="p-4">Obligación (Nombre)</th>
                    <th className="p-4">Columna en CSV</th>
                    <th className="p-4">Categoría</th>
                    <th className="p-4">Compl.</th>
                    <th className="p-4">Hs</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-sm">
                  {plantillas.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-axia-gray">No hay plantillas configuradas.</td></tr>
                  ) : plantillas.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-4 font-bold text-axia-blue">{p.obligacion}</td>
                      <td className="p-4 font-mono text-xs bg-slate-100 text-axia-dark rounded inline-block mt-2">{p.columna_origen}</td>
                      <td className="p-4 text-axia-gray font-medium">{p.categoria}</td>
                      <td className="p-4 text-axia-gray">{p.complejidad}</td>
                      <td className="p-4 font-bold text-axia-teal">{p.horas}</td>
                      <td className="p-4 text-right">
                        <button onClick={() => handleDeletePlantilla(p.id)} className="p-1 text-rose-500 hover:bg-rose-50 rounded-md transition-colors opacity-100" title="Eliminar"><Trash2 size={16}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Plantilla */}
      {isPlantillaModalOpen && (
        <div className="fixed inset-0 bg-axia-dark/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 p-6">
            <h3 className="text-xl font-bold text-axia-blue mb-6">Configurar Plantilla</h3>
            <form onSubmit={handleSavePlantilla} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-axia-gray mb-1.5">Nombre Obligación</label>
                <input required autoFocus type="text" placeholder="Ej: IVA - DDJJ" value={formDataPlantilla.obligacion} onChange={e => setFormDataPlantilla({...formDataPlantilla, obligacion: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm" />
              </div>
              <div>
                <label className="block text-sm font-bold text-axia-gray mb-1.5">Nombre de la Columna en el Excel</label>
                <input required type="text" placeholder="Escribí Fin_De_Mes si es un Balance Mensual" value={formDataPlantilla.columna_origen} onChange={e => setFormDataPlantilla({...formDataPlantilla, columna_origen: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm font-mono" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-axia-gray mb-1.5">Categoría</label>
                  <select value={formDataPlantilla.categoria} onChange={e => setFormDataPlantilla({...formDataPlantilla, categoria: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm">
                    <option value="Impuestos">Impuestos</option>
                    <option value="Contabilidad">Contabilidad</option>
                    <option value="Sueldos">Sueldos</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-axia-gray mb-1.5">Complejidad</label>
                  <select value={formDataPlantilla.complejidad} onChange={e => setFormDataPlantilla({...formDataPlantilla, complejidad: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm">
                    <option value="Baja">Baja</option>
                    <option value="Media">Media</option>
                    <option value="Alta">Alta</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-axia-gray mb-1.5">Horas</label>
                  <input required type="number" step="0.5" value={formDataPlantilla.horas} onChange={e => setFormDataPlantilla({...formDataPlantilla, horas: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:border-axia-teal bg-white text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsPlantillaModalOpen(false)} className="px-5 py-2 text-axia-gray font-bold hover:bg-gray-50 rounded-lg transition-colors">Cancelar</button>
                <button type="submit" disabled={loading} className="px-6 py-2 bg-axia-blue text-white font-bold rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-50 shadow-sm">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
