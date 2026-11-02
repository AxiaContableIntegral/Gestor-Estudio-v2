"use client";

import { useState, useMemo } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import { 
  BarChart3, Clock, Users, Briefcase, Calendar, TrendingUp, AlertTriangle, 
  CheckCircle2, Search, Download, Filter, ArrowUpRight, ArrowDownRight,
  Layers, UserCheck, X, Eye, Sparkles, RefreshCw, FileSpreadsheet
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

interface AnalisisTiemposProps {
  tareas: any[];
  tiempos: any[];
  clientes: any[];
  equipo: any[];
  isAdmin: boolean;
  currentUser?: string;
}

const PALETTE = [
  "#1f4668", // Axia Blue
  "#33838c", // Axia Teal
  "#fd6f2f", // Axia Orange
  "#8b5cf6", // Violet
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#0ea5e9", // Sky
  "#ec4899", // Pink
  "#6366f1", // Indigo
  "#14b8a6", // Teal light
  "#f97316", // Orange deep
  "#64748b", // Slate
];

export default function AnalisisTiemposClient({
  tareas,
  tiempos,
  clientes,
  equipo,
  isAdmin,
  currentUser,
}: AnalisisTiemposProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"clientes" | "tareas" | "categorias" | "equipo" | "tendencia" | "bitacora">("clientes");

  // Filter states
  const [periodoPreset, setPeriodoPreset] = useState<"todos" | "mes_actual" | "mes_anterior" | "custom_mes" | "custom_range">("todos");
  
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;

  const [mesCustom, setMesCustom] = useState(currentMonthStr);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [lineaSel, setLineaSel] = useState("Todas");
  const [clienteSel, setClienteSel] = useState("");
  const [personaSel, setPersonaSel] = useState("");
  const [categoriaSel, setCategoriaSel] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Filter for Tareas tab
  const [filtroDesvio, setFiltroDesvio] = useState<"todos" | "con_desvio" | "eficientes">("todos");

  // Drill-down Modal State
  const [drillDownClient, setDrillDownClient] = useState<string | null>(null);
  const [drillDownTask, setDrillDownTask] = useState<any | null>(null);

  // 1. Data Enrichment
  const tareasMap = useMemo(() => new Map(tareas.map(t => [String(t.id), t])), [tareas]);
  const clientesMap = useMemo(() => new Map(clientes.map(c => [c.cliente, c])), [clientes]);

  const isClienteInterno = (name: string) => {
    if (!name) return false;
    const lower = name.toLowerCase();
    if (lower.includes("interno")) return true;
    const c = clientesMap.get(name);
    return c?.tipo_honorario === "Interno";
  };

  const enrichedTiempos = useMemo(() => {
    return tiempos.map(t => {
      const tar = t.id_tarea ? tareasMap.get(String(t.id_tarea)) : null;
      const cliente = tar?.cliente || t.cliente || "Cliente General";
      const linea_negocio = tar?.linea_negocio || t.linea_negocio || "Sin Línea";
      const categoria = tar?.categoria || "Sin Categoría";
      const descripcion = tar?.descripcion || "—";
      const complejidad = tar?.complejidad || "Media";
      const horas_presupuestadas = Number(tar?.horas_presupuestadas || 0);
      const estado_tarea = tar?.estado || "Sin Estado";
      const esInterno = isClienteInterno(cliente);
      const fecha = t.fecha_trabajo || (t.registrado_en ? t.registrado_en.split("T")[0] : "");

      return {
        ...t,
        id: t.id_registro || t.id,
        horas: Number(t.horas) || 0,
        fecha_trabajo: fecha,
        cliente,
        linea_negocio,
        categoria,
        descripcion,
        complejidad,
        horas_presupuestadas,
        estado_tarea,
        esInterno,
        persona: t.persona || (tar ? tar.responsable : "Sin Asignar")
      };
    });
  }, [tiempos, tareasMap, clientesMap]);

  // Unique options for filters
  const filterOptions = useMemo(() => {
    const clientesSet = new Set<string>();
    const personasSet = new Set<string>();
    const categoriasSet = new Set<string>();

    enrichedTiempos.forEach(t => {
      if (t.cliente) clientesSet.add(t.cliente);
      if (t.persona) personasSet.add(t.persona);
      if (t.categoria) categoriasSet.add(t.categoria);
    });

    return {
      clientes: Array.from(clientesSet).sort(),
      personas: Array.from(personasSet).sort(),
      categorias: Array.from(categoriasSet).sort(),
    };
  }, [enrichedTiempos]);

  // 2. Filter Application
  const filteredTiempos = useMemo(() => {
    return enrichedTiempos.filter(t => {
      // Period filter
      if (periodoPreset === "mes_actual") {
        if (!t.fecha_trabajo?.startsWith(currentMonthStr)) return false;
      } else if (periodoPreset === "mes_anterior") {
        if (!t.fecha_trabajo?.startsWith(prevMonthStr)) return false;
      } else if (periodoPreset === "custom_mes") {
        if (mesCustom && !t.fecha_trabajo?.startsWith(mesCustom)) return false;
      } else if (periodoPreset === "custom_range") {
        if (fechaDesde && t.fecha_trabajo < fechaDesde) return false;
        if (fechaHasta && t.fecha_trabajo > fechaHasta) return false;
      }

      // Line filter
      if (lineaSel !== "Todas" && t.linea_negocio !== lineaSel) return false;

      // Client filter
      if (clienteSel && t.cliente !== clienteSel) return false;

      // Persona filter
      if (personaSel && t.persona !== personaSel) return false;

      // Category filter
      if (categoriaSel && t.categoria !== categoriaSel) return false;

      // Free text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesClient = t.cliente?.toLowerCase().includes(q);
        const matchesDesc = t.descripcion?.toLowerCase().includes(q);
        const matchesCom = t.comentario?.toLowerCase().includes(q);
        const matchesCat = t.categoria?.toLowerCase().includes(q);
        const matchesPerson = t.persona?.toLowerCase().includes(q);
        if (!matchesClient && !matchesDesc && !matchesCom && !matchesCat && !matchesPerson) return false;
      }

      return true;
    });
  }, [
    enrichedTiempos, periodoPreset, currentMonthStr, prevMonthStr, 
    mesCustom, fechaDesde, fechaHasta, lineaSel, clienteSel, 
    personaSel, categoriaSel, searchQuery
  ]);

  // 3. High-level KPIs
  const kpis = useMemo(() => {
    let horasTotales = 0;
    let horasFacturables = 0;
    let horasInternas = 0;
    const workDays = new Set<string>();
    const clientesSet = new Set<string>();
    const tareasSet = new Set<string>();

    const clientHoursMap: Record<string, number> = {};
    const catHoursMap: Record<string, number> = {};
    const personHoursMap: Record<string, number> = {};

    filteredTiempos.forEach(t => {
      const h = t.horas;
      horasTotales += h;
      if (t.esInterno) {
        horasInternas += h;
      } else {
        horasFacturables += h;
      }

      if (t.fecha_trabajo) workDays.add(t.fecha_trabajo);
      if (t.cliente) {
        clientesSet.add(t.cliente);
        clientHoursMap[t.cliente] = (clientHoursMap[t.cliente] || 0) + h;
      }
      if (t.id_tarea) tareasSet.add(String(t.id_tarea));
      if (t.categoria) catHoursMap[t.categoria] = (catHoursMap[t.categoria] || 0) + h;
      if (t.persona) personHoursMap[t.persona] = (personHoursMap[t.persona] || 0) + h;
    });

    const pctFacturable = horasTotales > 0 ? (horasFacturables / horasTotales) * 100 : 0;
    const avgDiario = workDays.size > 0 ? (horasTotales / workDays.size) : 0;

    // Top client
    const sortedClients = Object.entries(clientHoursMap).sort((a, b) => b[1] - a[1]);
    const topClient = sortedClients.length > 0 ? { name: sortedClients[0][0], hs: sortedClients[0][1], pct: (sortedClients[0][1] / (horasTotales || 1)) * 100 } : null;

    // Top category
    const sortedCats = Object.entries(catHoursMap).sort((a, b) => b[1] - a[1]);
    const topCat = sortedCats.length > 0 ? { name: sortedCats[0][0], hs: sortedCats[0][1], pct: (sortedCats[0][1] / (horasTotales || 1)) * 100 } : null;

    // Top person
    const sortedPersons = Object.entries(personHoursMap).sort((a, b) => b[1] - a[1]);
    const topPerson = sortedPersons.length > 0 ? { name: sortedPersons[0][0], hs: sortedPersons[0][1] } : null;

    return {
      horasTotales,
      horasFacturables,
      horasInternas,
      pctFacturable,
      clientesAtendidos: clientesSet.size,
      tareasImpactadas: tareasSet.size,
      diasActivos: workDays.size,
      avgDiario,
      topClient,
      topCat,
      topPerson,
      registrosTotales: filteredTiempos.length,
    };
  }, [filteredTiempos]);

  // 4. Aggregations for Tabs

  // --- TAB 1: Clientes ---
  const clientesData = useMemo(() => {
    const map = new Map<string, {
      cliente: string;
      linea: string;
      horas: number;
      horasFact: number;
      horasInt: number;
      sesiones: number;
      personas: Set<string>;
      tareasIds: Set<string>;
      esInterno: boolean;
      honorario: number;
    }>();

    filteredTiempos.forEach(t => {
      if (!map.has(t.cliente)) {
        const clientDb = clientesMap.get(t.cliente);
        map.set(t.cliente, {
          cliente: t.cliente,
          linea: t.linea_negocio,
          horas: 0,
          horasFact: 0,
          horasInt: 0,
          sesiones: 0,
          personas: new Set(),
          tareasIds: new Set(),
          esInterno: t.esInterno,
          honorario: Number(clientDb?.ultima_cobranza_monto || 0),
        });
      }

      const c = map.get(t.cliente)!;
      c.horas += t.horas;
      if (t.esInterno) c.horasInt += t.horas;
      else c.horasFact += t.horas;
      c.sesiones += 1;
      if (t.persona) c.personas.add(t.persona);
      if (t.id_tarea) c.tareasIds.add(String(t.id_tarea));
    });

    const list = Array.from(map.values()).map(c => {
      const pct = kpis.horasTotales > 0 ? (c.horas / kpis.horasTotales) * 100 : 0;
      const tarifaEfectiva = c.horas > 0 && c.honorario > 0 ? c.honorario / c.horas : null;
      return {
        ...c,
        personasArray: Array.from(c.personas),
        cantidadTareas: c.tareasIds.size,
        pct,
        tarifaEfectiva,
      };
    }).sort((a, b) => b.horas - a.horas);

    // Chart data: Top 12 clients
    const chartTopClients = list.slice(0, 12).map(c => ({
      name: c.cliente.length > 18 ? c.cliente.slice(0, 18) + "…" : c.cliente,
      fullName: c.cliente,
      Horas: Number(c.horas.toFixed(1)),
      linea: c.linea,
    }));

    // Concentration chart: Top 5 vs Resto
    const top5Hours = list.slice(0, 5).reduce((acc, c) => acc + c.horas, 0);
    const restoHours = Math.max(0, kpis.horasTotales - top5Hours);
    const concentrationData = [
      { name: "Top 5 Clientes", value: Number(top5Hours.toFixed(1)), color: "#1f4668" },
      { name: "Resto de Clientes", value: Number(restoHours.toFixed(1)), color: "#33838c" },
    ].filter(d => d.value > 0);

    return { list, chartTopClients, concentrationData };
  }, [filteredTiempos, kpis.horasTotales, clientesMap]);

  // --- TAB 2: Tareas y Desvíos ---
  const tareasData = useMemo(() => {
    const map = new Map<string, {
      id: string;
      cliente: string;
      descripcion: string;
      categoria: string;
      responsable: string;
      linea_negocio: string;
      estado: string;
      horasPresupuestadas: number;
      horasReales: number;
      sesiones: number;
      personas: Set<string>;
    }>();

    filteredTiempos.forEach(t => {
      const idKey = t.id_tarea ? String(t.id_tarea) : `notask-${t.cliente}-${t.categoria}`;
      if (!map.has(idKey)) {
        map.set(idKey, {
          id: idKey,
          cliente: t.cliente,
          descripcion: t.descripcion || "Tarea sin descripción",
          categoria: t.categoria,
          responsable: t.persona || "Sin Asignar",
          linea_negocio: t.linea_negocio,
          estado: t.estado_tarea,
          horasPresupuestadas: t.horas_presupuestadas,
          horasReales: 0,
          sesiones: 0,
          personas: new Set(),
        });
      }

      const tar = map.get(idKey)!;
      tar.horasReales += t.horas;
      tar.sesiones += 1;
      if (t.persona) tar.personas.add(t.persona);
    });

    let list = Array.from(map.values()).map(t => {
      const desvio = t.horasReales - t.horasPresupuestadas;
      const ratio = t.horasPresupuestadas > 0 ? (t.horasReales / t.horasPresupuestadas) * 100 : 0;
      const sobrepasada = t.horasPresupuestadas > 0 && t.horasReales > t.horasPresupuestadas;
      const eficiente = t.horasPresupuestadas > 0 && t.horasReales <= t.horasPresupuestadas;

      return {
        ...t,
        personasArray: Array.from(t.personas),
        desvio,
        ratio,
        sobrepasada,
        eficiente,
      };
    }).sort((a, b) => b.horasReales - a.horasReales);

    // Apply Tab-level filter (desvíos)
    if (filtroDesvio === "con_desvio") {
      list = list.filter(t => t.sobrepasada);
    } else if (filtroDesvio === "eficientes") {
      list = list.filter(t => t.eficiente);
    }

    // Top 8 tasks for comparison chart
    const chartTasks = list
      .filter(t => t.horasPresupuestadas > 0)
      .slice(0, 8)
      .map(t => ({
        name: `${t.cliente.slice(0, 10)} · ${t.categoria.slice(0, 8)}`,
        Presupuestadas: Number(t.horasPresupuestadas.toFixed(1)),
        Reales: Number(t.horasReales.toFixed(1)),
        fullName: `${t.cliente} - ${t.descripcion}`,
      }));

    const totalDesvioExceso = list
      .filter(t => t.desvio > 0 && t.horasPresupuestadas > 0)
      .reduce((acc, t) => acc + t.desvio, 0);

    const tareasConExcesoCount = list.filter(t => t.sobrepasada).length;

    return { list, chartTasks, totalDesvioExceso, tareasConExcesoCount };
  }, [filteredTiempos, filtroDesvio]);

  // --- TAB 3: Categorías ---
  const categoriasData = useMemo(() => {
    const map = new Map<string, {
      categoria: string;
      horas: number;
      clientes: Set<string>;
      tareasIds: Set<string>;
      sesiones: number;
      complejidad: Record<string, number>;
    }>();

    filteredTiempos.forEach(t => {
      const cat = t.categoria || "Sin Categoría";
      if (!map.has(cat)) {
        map.set(cat, {
          categoria: cat,
          horas: 0,
          clientes: new Set(),
          tareasIds: new Set(),
          sesiones: 0,
          complejidad: { Baja: 0, Media: 0, Alta: 0 },
        });
      }

      const c = map.get(cat)!;
      c.horas += t.horas;
      c.sesiones += 1;
      if (t.cliente) c.clientes.add(t.cliente);
      if (t.id_tarea) c.tareasIds.add(String(t.id_tarea));
      const comp = t.complejidad || "Media";
      c.complejidad[comp] = (c.complejidad[comp] || 0) + t.horas;
    });

    const list = Array.from(map.values()).map(c => {
      const pct = kpis.horasTotales > 0 ? (c.horas / kpis.horasTotales) * 100 : 0;
      const avgPorTarea = c.tareasIds.size > 0 ? c.horas / c.tareasIds.size : c.horas;
      return {
        ...c,
        pct,
        avgPorTarea,
        cantidadClientes: c.clientes.size,
        cantidadTareas: c.tareasIds.size,
      };
    }).sort((a, b) => b.horas - a.horas);

    const pieData = list.map((c, i) => ({
      name: c.categoria,
      value: Number(c.horas.toFixed(1)),
      color: PALETTE[i % PALETTE.length],
    }));

    return { list, pieData };
  }, [filteredTiempos, kpis.horasTotales]);

  // --- TAB 4: Equipo ---
  const equipoData = useMemo(() => {
    const map = new Map<string, {
      persona: string;
      horasTotales: number;
      horasFact: number;
      horasInt: number;
      clientes: Map<string, number>;
      tareasIds: Set<string>;
      sesiones: number;
    }>();

    filteredTiempos.forEach(t => {
      const p = t.persona || "Sin Asignar";
      if (!map.has(p)) {
        map.set(p, {
          persona: p,
          horasTotales: 0,
          horasFact: 0,
          horasInt: 0,
          clientes: new Map(),
          tareasIds: new Set(),
          sesiones: 0,
        });
      }

      const item = map.get(p)!;
      item.horasTotales += t.horas;
      if (t.esInterno) item.horasInt += t.horas;
      else item.horasFact += t.horas;
      item.sesiones += 1;
      if (t.id_tarea) item.tareasIds.add(String(t.id_tarea));

      if (t.cliente) {
        item.clientes.set(t.cliente, (item.clientes.get(t.cliente) || 0) + t.horas);
      }
    });

    const list = Array.from(map.values()).map(e => {
      const pctFact = e.horasTotales > 0 ? (e.horasFact / e.horasTotales) * 100 : 0;
      const sortedClientes = Array.from(e.clientes.entries()).sort((a, b) => b[1] - a[1]);
      const topCliente = sortedClientes.length > 0 ? { name: sortedClientes[0][0], hs: sortedClientes[0][1] } : null;

      return {
        ...e,
        pctFact,
        cantidadClientes: e.clientes.size,
        cantidadTareas: e.tareasIds.size,
        topCliente,
        chartBar: {
          name: e.persona,
          Facturable: Number(e.horasFact.toFixed(1)),
          Interno: Number(e.horasInt.toFixed(1)),
          Total: Number(e.horasTotales.toFixed(1)),
        }
      };
    }).sort((a, b) => b.horasTotales - a.horasTotales);

    const chartEquipo = list.map(e => e.chartBar);

    return { list, chartEquipo };
  }, [filteredTiempos]);

  // --- TAB 5: Tendencia Temporal ---
  const tendenciaData = useMemo(() => {
    const dayMap = new Map<string, { fecha: string; total: number; fact: number; int: number }>();

    filteredTiempos.forEach(t => {
      if (!t.fecha_trabajo) return;
      if (!dayMap.has(t.fecha_trabajo)) {
        dayMap.set(t.fecha_trabajo, { fecha: t.fecha_trabajo, total: 0, fact: 0, int: 0 });
      }
      const d = dayMap.get(t.fecha_trabajo)!;
      d.total += t.horas;
      if (t.esInterno) d.int += t.horas;
      else d.fact += t.horas;
    });

    const chartDays = Array.from(dayMap.values())
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map(d => ({
        fecha: d.fecha.slice(5), // MM-DD
        fullFecha: d.fecha,
        Total: Number(d.total.toFixed(1)),
        Facturable: Number(d.fact.toFixed(1)),
        Interno: Number(d.int.toFixed(1)),
      }));

    return { chartDays };
  }, [filteredTiempos]);

  // Reset all filters
  const resetFilters = () => {
    setPeriodoPreset("todos");
    setMesCustom(currentMonthStr);
    setFechaDesde("");
    setFechaHasta("");
    setLineaSel("Todas");
    setClienteSel("");
    setPersonaSel("");
    setCategoriaSel("");
    setSearchQuery("");
  };

  const isAnyFilterActive = periodoPreset !== "todos" || lineaSel !== "Todas" || clienteSel !== "" || personaSel !== "" || categoriaSel !== "" || searchQuery !== "";

  // Export full workbook to Excel
  const exportFullExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Resumen Clientes
    const wsClientes = XLSX.utils.json_to_sheet(clientesData.list.map(c => ({
      "Cliente": c.cliente,
      "Línea": c.linea,
      "Horas Totales": c.horas,
      "Horas Facturables": c.horasFact,
      "Horas Internas": c.horasInt,
      "% del Total": `${c.pct.toFixed(1)}%`,
      "Tareas Involucradas": c.cantidadTareas,
      "Sesiones": c.sesiones,
      "Honorario Mensual": c.honorario || 0,
      "Tarifa Efectiva $/h": c.tarifaEfectiva ? Math.round(c.tarifaEfectiva) : "—",
      "Colaboradores": c.personasArray.join(", "),
    })));
    XLSX.utils.book_append_sheet(wb, wsClientes, "Clientes y Esfuerzo");

    // Sheet 2: Tareas y Desvíos
    const wsTareas = XLSX.utils.json_to_sheet(tareasData.list.map(t => ({
      "Cliente": t.cliente,
      "Tarea / Descripción": t.descripcion,
      "Categoría": t.categoria,
      "Responsable": t.responsable,
      "Línea": t.linea_negocio,
      "Estado": t.estado,
      "Hs Presupuestadas": t.horasPresupuestadas,
      "Hs Reales": t.horasReales,
      "Desvío (Hs)": Number(t.desvio.toFixed(2)),
      "% Consumido": t.horasPresupuestadas > 0 ? `${t.ratio.toFixed(1)}%` : "S/P",
    })));
    XLSX.utils.book_append_sheet(wb, wsTareas, "Tareas y Desvíos");

    // Sheet 3: Categorías
    const wsCats = XLSX.utils.json_to_sheet(categoriasData.list.map(c => ({
      "Categoría": c.categoria,
      "Horas Invertidas": c.horas,
      "% del Total": `${c.pct.toFixed(1)}%`,
      "Cantidad Clientes": c.cantidadClientes,
      "Cantidad Tareas": c.cantidadTareas,
      "Promedio Hs / Tarea": Number(c.avgPorTarea.toFixed(2)),
    })));
    XLSX.utils.book_append_sheet(wb, wsCats, "Categorías");

    // Sheet 4: Equipo
    const wsEquipo = XLSX.utils.json_to_sheet(equipoData.list.map(e => ({
      "Colaborador": e.persona,
      "Horas Totales": e.horasTotales,
      "Horas Clientes": e.horasFact,
      "Horas Internas": e.horasInt,
      "% Facturable": `${e.pctFact.toFixed(1)}%`,
      "Clientes Atendidos": e.cantidadClientes,
      "Tareas Trabajadas": e.cantidadTareas,
      "Cliente Principal": e.topCliente ? `${e.topCliente.name} (${e.topCliente.hs.toFixed(1)}h)` : "—",
    })));
    XLSX.utils.book_append_sheet(wb, wsEquipo, "Equipo");

    // Sheet 5: Bitácora completa
    const wsLog = XLSX.utils.json_to_sheet(filteredTiempos.map(t => ({
      "Fecha": t.fecha_trabajo,
      "Persona": t.persona,
      "Cliente": t.cliente,
      "Línea": t.linea_negocio,
      "Categoría": t.categoria,
      "Descripción Tarea": t.descripcion,
      "Horas": t.horas,
      "Comentario": t.comentario || "",
    })));
    XLSX.utils.book_append_sheet(wb, wsLog, "Bitácora Detallada");

    XLSX.writeFile(wb, `Analisis_Tiempos_Axia_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Reporte completo en Excel generado con éxito");
  };

  // Export CSV of active log
  const exportLogCSV = () => {
    let csv = "Fecha;Persona;Cliente;Linea;Categoria;Tarea;Horas;Comentario\n";
    filteredTiempos.forEach(t => {
      const com = (t.comentario || "").replace(/;/g, ",").replace(/\n/g, " ");
      const desc = (t.descripcion || "").replace(/;/g, ",").replace(/\n/g, " ");
      csv += `${t.fecha_trabajo};${t.persona};${t.cliente};${t.linea_negocio};${t.categoria};${desc};${t.horas};${com}\n`;
    });
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `bitacora_tiempos_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast.success("Bitácora CSV descargada");
  };

  // Drill-down sessions for client modal
  const drillDownClientLogs = useMemo(() => {
    if (!drillDownClient) return [];
    return filteredTiempos.filter(t => t.cliente === drillDownClient);
  }, [drillDownClient, filteredTiempos]);

  return (
    <div className="animate-in fade-in duration-500 pb-20 max-w-7xl mx-auto px-2 sm:px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pt-2">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-axia-blue/10 text-axia-blue rounded-xl">
              <BarChart3 size={28} />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-axia-blue tracking-tight">
                Análisis de Tiempos y Esfuerzo
              </h1>
              <p className="text-xs sm:text-sm text-axia-gray mt-0.5">
                Radiografía detallada de horas invertidas, atención a clientes y rendimiento operativo.
              </p>
            </div>
          </div>
        </div>

        {/* Global Export Buttons */}
        <div className="flex items-center gap-2.5">
          <button 
            onClick={exportFullExcel}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all"
            title="Descargar libro Excel multi-pestaña con todos los análisis"
          >
            <FileSpreadsheet size={18} />
            <span>Exportar Excel Completo</span>
          </button>
          <button 
            onClick={exportLogCSV}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 text-axia-blue border border-gray-200 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all"
            title="Exportar CSV de la bitácora"
          >
            <Download size={16} />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* FILTER PANEL */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 p-4 sm:p-5 mb-6">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2 text-axia-dark font-bold text-sm">
            <Filter size={18} className="text-axia-teal" />
            <span>Filtros Globales</span>
            {isAnyFilterActive && (
              <span className="bg-axia-orange/10 text-axia-orange text-[11px] px-2 py-0.5 rounded-full font-bold">
                Filtros activos
              </span>
            )}
          </div>
          {isAnyFilterActive && (
            <button 
              onClick={resetFilters} 
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1"
            >
              <RefreshCw size={12} /> Limpiar filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Preset Período */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-axia-gray mb-1">
              Período
            </label>
            <select 
              value={periodoPreset} 
              onChange={e => setPeriodoPreset(e.target.value as any)}
              className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-axia-dark outline-none focus:border-axia-teal focus:bg-white transition-colors"
            >
              <option value="todos">Todo el Histórico</option>
              <option value="mes_actual">Este Mes ({currentMonthStr})</option>
              <option value="mes_anterior">Mes Anterior ({prevMonthStr})</option>
              <option value="custom_mes">Elegir un Mes...</option>
              <option value="custom_range">Rango de Fechas...</option>
            </select>
          </div>

          {/* Conditional Date Selectors */}
          {periodoPreset === "custom_mes" ? (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-axia-gray mb-1">
                Mes Específico
              </label>
              <input 
                type="month" 
                value={mesCustom}
                onChange={e => setMesCustom(e.target.value)}
                className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold text-axia-dark outline-none focus:border-axia-teal focus:bg-white"
              />
            </div>
          ) : periodoPreset === "custom_range" ? (
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="block text-[10px] font-bold text-axia-gray uppercase mb-1">Desde</label>
                <input 
                  type="date" 
                  value={fechaDesde} 
                  onChange={e => setFechaDesde(e.target.value)} 
                  className="w-full bg-slate-50 border border-gray-200 rounded-xl p-1.5 text-xs text-axia-dark outline-none focus:border-axia-teal"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-axia-gray uppercase mb-1">Hasta</label>
                <input 
                  type="date" 
                  value={fechaHasta} 
                  onChange={e => setFechaHasta(e.target.value)} 
                  className="w-full bg-slate-50 border border-gray-200 rounded-xl p-1.5 text-xs text-axia-dark outline-none focus:border-axia-teal"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-axia-gray mb-1">
                Línea de Negocio
              </label>
              <select 
                value={lineaSel} 
                onChange={e => setLineaSel(e.target.value)}
                className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-axia-dark outline-none focus:border-axia-teal focus:bg-white"
              >
                <option value="Todas">Todas las Líneas</option>
                <option value="Estudio Contable">Estudio Contable</option>
                <option value="Consultoría CFO">Consultoría CFO</option>
              </select>
            </div>
          )}

          {/* Cliente selector */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-axia-gray mb-1">
              Cliente
            </label>
            <select 
              value={clienteSel} 
              onChange={e => setClienteSel(e.target.value)}
              className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-axia-dark outline-none focus:border-axia-teal focus:bg-white"
            >
              <option value="">Todos los Clientes</option>
              {filterOptions.clientes.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Persona selector */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-axia-gray mb-1">
              Responsable / Colaborador
            </label>
            <select 
              value={personaSel} 
              onChange={e => setPersonaSel(e.target.value)}
              className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-axia-dark outline-none focus:border-axia-teal focus:bg-white"
            >
              <option value="">Todo el Equipo</option>
              {filterOptions.personas.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Categoría selector */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-axia-gray mb-1">
              Categoría de Tarea
            </label>
            <select 
              value={categoriaSel} 
              onChange={e => setCategoriaSel(e.target.value)}
              className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-axia-dark outline-none focus:border-axia-teal focus:bg-white"
            >
              <option value="">Todas las Categorías</option>
              {filterOptions.categorias.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* TOP KPI BANNER */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 mb-7">
        {/* Card 1: Horas Totales */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-axia-gray mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Horas Invertidas</span>
              <span className="p-2 bg-blue-50 text-axia-blue rounded-xl"><Clock size={18} /></span>
            </div>
            <p className="text-3xl font-black text-axia-blue">{kpis.horasTotales.toFixed(1)} <span className="text-sm font-semibold text-axia-gray">hs</span></p>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-emerald-600 font-bold">{kpis.horasFacturables.toFixed(1)} h facturables ({kpis.pctFacturable.toFixed(0)}%)</span>
            <span className="text-slate-400 font-medium">{kpis.horasInternas.toFixed(1)} h int</span>
          </div>
        </div>

        {/* Card 2: Cliente con Mayor Atención */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-axia-gray mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Cliente + Demandante</span>
              <span className="p-2 bg-teal-50 text-axia-teal rounded-xl"><Briefcase size={18} /></span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-axia-dark truncate" title={kpis.topClient?.name || "—"}>
              {kpis.topClient ? kpis.topClient.name : "—"}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-axia-gray flex items-center justify-between">
            <span>{kpis.topClient ? `${kpis.topClient.hs.toFixed(1)} hs insumidas` : "Sin datos"}</span>
            <span className="font-bold text-axia-teal">{kpis.topClient ? `${kpis.topClient.pct.toFixed(0)}% del total` : ""}</span>
          </div>
        </div>

        {/* Card 3: Categoría Líder */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-axia-gray mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Categoría Principal</span>
              <span className="p-2 bg-orange-50 text-axia-orange rounded-xl"><Layers size={18} /></span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-axia-dark truncate" title={kpis.topCat?.name || "—"}>
              {kpis.topCat ? kpis.topCat.name : "—"}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-axia-gray flex items-center justify-between">
            <span>{kpis.topCat ? `${kpis.topCat.hs.toFixed(1)} hs registradas` : "Sin datos"}</span>
            <span className="font-bold text-axia-orange">{kpis.topCat ? `${kpis.topCat.pct.toFixed(0)}% del esfuerzo` : ""}</span>
          </div>
        </div>

        {/* Card 4: Desvío en Tareas */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-axia-gray mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Desvío de Tareas</span>
              <span className="p-2 bg-rose-50 text-rose-600 rounded-xl"><AlertTriangle size={18} /></span>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-rose-600">
              {tareasData.tareasConExcesoCount} <span className="text-sm font-semibold text-axia-gray">con exceso</span>
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-axia-gray flex items-center justify-between">
            <span>Sobrecosto neto:</span>
            <span className="font-bold text-rose-600">+{tareasData.totalDesvioExceso.toFixed(1)} hs s/ pres.</span>
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION BAR */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 p-1.5 mb-6 flex overflow-x-auto gap-1">
        {[
          { id: "clientes", label: "🏢 Clientes & Atención", count: clientesData.list.length },
          { id: "tareas", label: "📋 Tareas & Desvíos", count: tareasData.list.length },
          { id: "categorias", label: "🏷️ Categorías", count: categoriasData.list.length },
          { id: "equipo", label: "👥 Equipo & Carga", count: equipoData.list.length },
          { id: "tendencia", label: "📅 Tendencia Temporal" },
          { id: "bitacora", label: "📜 Bitácora Detallada", count: filteredTiempos.length },
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all ${
                isActive 
                  ? "bg-axia-blue text-white shadow-sm" 
                  : "text-axia-gray hover:bg-slate-100 hover:text-axia-dark"
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT 1: CLIENTES */}
      {activeTab === "clientes" && (
        <div className="space-y-6">
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Bar Chart: Top 12 Clients */}
            <div className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200/80">
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h3 className="text-sm font-bold text-axia-dark uppercase tracking-wide">
                    Top Clientes por Horas Invertidas
                  </h3>
                  <p className="text-xs text-axia-gray">Ranking de atención y dedicación horaria en el período</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-axia-blue rounded-lg">
                  {clientesData.list.length} clientes totales
                </span>
              </div>

              {clientesData.chartTopClients.length === 0 ? (
                <div className="h-[320px] flex items-center justify-center text-axia-gray text-sm">
                  No hay horas registradas para los filtros seleccionados.
                </div>
              ) : (
                <div className="h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={clientesData.chartTopClients} 
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={130} 
                        tick={{ fill: "#334155", fontSize: 11, fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                        formatter={(val: any) => [`${val} hs`, "Horas invertidas"]}
                        labelFormatter={(label) => `Cliente: ${label}`}
                      />
                      <Bar dataKey="Horas" fill="#1f4668" radius={[0, 6, 6, 0]}>
                        {clientesData.chartTopClients.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.linea === "Consultoría CFO" ? "#33838c" : "#1f4668"} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="mt-3 flex items-center justify-center gap-6 text-xs text-axia-gray pt-2 border-t border-gray-100">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#1f4668]"></span> Estudio Contable
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#33838c]"></span> Consultoría CFO
                </span>
              </div>
            </div>

            {/* Concentration Chart */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200/80 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-axia-dark uppercase tracking-wide mb-1">
                  Concentración de Esfuerzo
                </h3>
                <p className="text-xs text-axia-gray mb-4">¿Cuánto tiempo absorben los 5 clientes más demandantes?</p>
                
                {clientesData.concentrationData.length === 0 ? (
                  <div className="h-[230px] flex items-center justify-center text-axia-gray text-sm">
                    Sin datos
                  </div>
                ) : (
                  <div className="h-[230px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={clientesData.concentrationData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={85}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {clientesData.concentrationData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(v: any) => [`${v} hs`, "Horas"]}
                          contentStyle={{ borderRadius: "10px", border: "none" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-3 border-t border-gray-100 text-xs">
                {clientesData.concentrationData.map(c => (
                  <div key={c.name} className="flex justify-between items-center font-medium">
                    <span className="flex items-center gap-2 text-axia-dark">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }}></span>
                      {c.name}
                    </span>
                    <span className="font-bold text-axia-blue">
                      {c.value.toFixed(1)} hs ({kpis.horasTotales > 0 ? ((c.value / kpis.horasTotales) * 100).toFixed(0) : 0}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Detailed Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-50/60">
              <div>
                <h3 className="font-bold text-axia-dark">Detalle de Atención por Cliente</h3>
                <p className="text-xs text-axia-gray">Hacé clic en cualquier cliente para ver la bitácora completa de sesiones y tareas.</p>
              </div>
              <div className="text-xs font-semibold text-axia-gray">
                Total: {clientesData.list.length} clientes analizados
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200 text-axia-gray text-[10px] tracking-wider uppercase font-bold">
                    <th className="p-3.5 w-12 text-center">#</th>
                    <th className="p-3.5">Cliente</th>
                    <th className="p-3.5">Línea</th>
                    <th className="p-3.5 text-center">Hs Invertidas</th>
                    <th className="p-3.5 w-36">% Esfuerzo</th>
                    <th className="p-3.5 text-center">Tareas</th>
                    <th className="p-3.5">Equipo Asignado</th>
                    <th className="p-3.5 text-right">Tarifa Efectiva</th>
                    <th className="p-3.5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {clientesData.list.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-axia-gray">
                        No hay registros para este período.
                      </td>
                    </tr>
                  ) : (
                    clientesData.list.map((c, idx) => (
                      <tr key={c.cliente} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 text-center font-bold text-axia-gray/60">{idx + 1}</td>
                        <td className="p-3.5">
                          <button 
                            onClick={() => setDrillDownClient(c.cliente)}
                            className="font-bold text-axia-blue hover:underline text-left"
                          >
                            {c.cliente}
                          </button>
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            c.linea === "Consultoría CFO" ? "bg-teal-50 text-teal-700" : "bg-blue-50 text-blue-700"
                          }`}>
                            {c.linea}
                          </span>
                        </td>
                        <td className="p-3.5 text-center font-black text-axia-blue">
                          {c.horas.toFixed(1)} <span className="text-xs font-normal text-axia-gray">hs</span>
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div 
                                className="bg-axia-blue h-full rounded-full" 
                                style={{ width: `${Math.min(100, c.pct)}%` }}
                              ></div>
                            </div>
                            <span className="text-xs font-bold text-axia-gray w-10 text-right">
                              {c.pct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="p-3.5 text-center font-medium text-axia-dark">
                          {c.cantidadTareas}
                        </td>
                        <td className="p-3.5">
                          <div className="flex flex-wrap gap-1">
                            {c.personasArray.map(p => (
                              <span key={p} className="bg-slate-100 text-slate-700 text-[11px] font-semibold px-2 py-0.5 rounded-md">
                                {p}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3.5 text-right font-medium text-axia-dark">
                          {c.tarifaEfectiva ? (
                            <span className="font-bold text-emerald-700">
                              ${Math.round(c.tarifaEfectiva).toLocaleString("es-AR")}/h
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => setDrillDownClient(c.cliente)}
                            className="px-2.5 py-1 text-xs font-bold text-axia-blue bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 ml-auto"
                          >
                            <Eye size={14} /> Ver Detalle
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: TAREAS Y DESVÍOS */}
      {activeTab === "tareas" && (
        <div className="space-y-6">
          {/* Subfilter & KPI Header */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200/80">
              <p className="text-xs font-bold text-axia-gray uppercase mb-1">Tareas Analizadas</p>
              <p className="text-2xl font-black text-axia-dark">{tareasData.list.length}</p>
              <p className="text-xs text-axia-gray mt-1">Con horas cargadas en el período</p>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-rose-200 bg-rose-50/20">
              <p className="text-xs font-bold text-rose-700 uppercase mb-1">Tareas con Exceso de Horas</p>
              <p className="text-2xl font-black text-rose-600">{tareasData.tareasConExcesoCount}</p>
              <p className="text-xs text-rose-600 mt-1">+{tareasData.totalDesvioExceso.toFixed(1)} hs insumidas por encima de lo estimado</p>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-200 bg-emerald-50/20">
              <p className="text-xs font-bold text-emerald-700 uppercase mb-1">Filtro de Desvíos</p>
              <div className="flex gap-2 mt-2">
                {[
                  { id: "todos", label: "Todas" },
                  { id: "con_desvio", label: "🔴 Con Exceso" },
                  { id: "eficientes", label: "🟢 Eficientes" },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFiltroDesvio(f.id as any)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                      filtroDesvio === f.id ? "bg-axia-blue text-white shadow-sm" : "bg-slate-100 text-axia-gray hover:bg-slate-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Comparison Chart: Presupuestadas vs Reales */}
          {tareasData.chartTasks.length > 0 && (
            <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200/80">
              <h3 className="text-sm font-bold text-axia-dark uppercase tracking-wide mb-1">
                Comparativa: Horas Presupuestadas vs. Reales Invertidas
              </h3>
              <p className="text-xs text-axia-gray mb-5">Tareas con mayor volumen de horas trabajadas</p>

              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tareasData.chartTasks} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: "#475569", fontSize: 11, fontWeight: 600 }}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                      formatter={(val: any) => [`${val} hs`]}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ""}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                    <Bar dataKey="Presupuestadas" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Reales" fill="#fd6f2f" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100 bg-slate-50/60 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-axia-dark">Listado Detallado de Tareas y Rendimiento</h3>
                <p className="text-xs text-axia-gray">Comparación entre estimación y tiempo real insumido</p>
              </div>
              <span className="text-xs font-semibold text-axia-gray">
                {tareasData.list.length} tareas
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200 text-axia-gray text-[10px] tracking-wider uppercase font-bold">
                    <th className="p-3.5">Cliente</th>
                    <th className="p-3.5">Categoría</th>
                    <th className="p-3.5 min-w-[220px]">Descripción</th>
                    <th className="p-3.5">Responsable</th>
                    <th className="p-3.5 text-center">Hs Presup.</th>
                    <th className="p-3.5 text-center">Hs Reales</th>
                    <th className="p-3.5 text-center">Desvío</th>
                    <th className="p-3.5 w-32">% Consumido</th>
                    <th className="p-3.5 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tareasData.list.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-axia-gray">
                        No hay tareas con estos filtros.
                      </td>
                    </tr>
                  ) : (
                    tareasData.list.map((t) => {
                      const hasBudget = t.horasPresupuestadas > 0;
                      return (
                        <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3.5 font-bold text-axia-blue whitespace-nowrap">
                            {t.cliente}
                          </td>
                          <td className="p-3.5">
                            <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2 py-0.5 rounded-md whitespace-nowrap">
                              {t.categoria}
                            </span>
                          </td>
                          <td className="p-3.5 text-axia-dark">
                            <p className="line-clamp-2 text-xs font-medium" title={t.descripcion}>
                              {t.descripcion}
                            </p>
                          </td>
                          <td className="p-3.5 text-xs font-semibold text-axia-gray whitespace-nowrap">
                            {t.responsable}
                          </td>
                          <td className="p-3.5 text-center font-medium text-slate-500">
                            {hasBudget ? `${t.horasPresupuestadas.toFixed(1)} h` : "—"}
                          </td>
                          <td className="p-3.5 text-center font-bold text-axia-blue">
                            {t.horasReales.toFixed(1)} h
                          </td>
                          <td className="p-3.5 text-center whitespace-nowrap">
                            {!hasBudget ? (
                              <span className="text-gray-400 text-xs">—</span>
                            ) : t.desvio > 0 ? (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200">
                                <ArrowUpRight size={12} /> +{t.desvio.toFixed(1)} h
                              </span>
                            ) : t.desvio < 0 ? (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <ArrowDownRight size={12} /> {t.desvio.toFixed(1)} h
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500 font-bold">Exacto (0)</span>
                            )}
                          </td>
                          <td className="p-3.5">
                            {hasBudget ? (
                              <div className="flex items-center gap-1.5">
                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${
                                      t.ratio > 100 ? "bg-rose-500" : t.ratio > 85 ? "bg-amber-500" : "bg-emerald-500"
                                    }`}
                                    style={{ width: `${Math.min(100, t.ratio)}%` }}
                                  ></div>
                                </div>
                                <span className={`text-[11px] font-bold w-10 text-right ${
                                  t.ratio > 100 ? "text-rose-600" : "text-axia-gray"
                                }`}>
                                  {t.ratio.toFixed(0)}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">Sin Presup.</span>
                            )}
                          </td>
                          <td className="p-3.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              t.estado === "Completada" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                            }`}>
                              {t.estado}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: CATEGORÍAS */}
      {activeTab === "categorias" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Donut Chart: Categorías */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200/80">
              <h3 className="text-sm font-bold text-axia-dark uppercase tracking-wide mb-1">
                Distribución de Horas por Tipo de Tarea
              </h3>
              <p className="text-xs text-axia-gray mb-4">¿En qué categoría de servicio se concentra el trabajo?</p>

              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoriasData.pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {categoriasData.pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(val: any) => [`${val} hs`, "Horas invertidas"]}
                      contentStyle={{ borderRadius: "10px", border: "none" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Categories Ranking Cards */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200/80 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-axia-dark uppercase tracking-wide mb-4">
                  Resumen de Esfuerzo por Categoría
                </h3>

                <div className="space-y-3.5">
                  {categoriasData.list.map((c, idx) => (
                    <div key={c.categoria} className="p-3 bg-slate-50/70 rounded-xl border border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span 
                          className="w-3.5 h-3.5 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: PALETTE[idx % PALETTE.length] }}
                        ></span>
                        <div>
                          <p className="font-bold text-sm text-axia-dark">{c.categoria}</p>
                          <p className="text-xs text-axia-gray">{c.cantidadClientes} clientes · {c.cantidadTareas} tareas</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-sm text-axia-blue">{c.horas.toFixed(1)} hs</p>
                        <p className="text-xs font-semibold text-axia-teal">{c.pct.toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: EQUIPO */}
      {activeTab === "equipo" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart: Facturable vs Interno */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200/80">
              <h3 className="text-sm font-bold text-axia-dark uppercase tracking-wide mb-1">
                Horas por Colaborador (Facturable vs. Interno)
              </h3>
              <p className="text-xs text-axia-gray mb-5">Distribución de tiempo cargado por cada miembro del equipo</p>

              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={equipoData.chartEquipo} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fill: "#334155", fontSize: 12, fontWeight: 700 }} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: "10px", border: "none" }}
                      formatter={(val: any) => [`${val} hs`]}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                    <Bar dataKey="Facturable" fill="#1f4668" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Interno" fill="#fd6f2f" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Cards for each Person */}
            <div className="space-y-4">
              {equipoData.list.map(e => (
                <div key={e.persona} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200/80">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-blue-50 text-axia-blue rounded-xl font-black text-sm">
                        {e.persona.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-base text-axia-dark">{e.persona}</h4>
                        <p className="text-xs text-axia-gray">{e.cantidadClientes} clientes atendidos · {e.cantidadTareas} tareas</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-axia-blue">{e.horasTotales.toFixed(1)} hs</p>
                      <span className="text-xs font-bold text-emerald-600">{e.pctFact.toFixed(0)}% facturable</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex justify-between items-center text-xs text-axia-gray">
                    <span>Cliente principal:</span>
                    <span className="font-bold text-axia-dark">
                      {e.topCliente ? `${e.topCliente.name} (${e.topCliente.hs.toFixed(1)} hs)` : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: TENDENCIA TEMPORAL */}
      {activeTab === "tendencia" && (
        <div className="space-y-6">
          <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200/80">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="text-sm font-bold text-axia-dark uppercase tracking-wide">
                  Evolución Diaria de Horas Invertidas
                </h3>
                <p className="text-xs text-axia-gray">Picos de carga y actividad a lo largo de los días</p>
              </div>
              <div className="text-xs font-bold text-axia-teal bg-teal-50 px-3 py-1 rounded-lg">
                {kpis.diasActivos} días con registros activos
              </div>
            </div>

            {tendenciaData.chartDays.length === 0 ? (
              <div className="h-[320px] flex items-center justify-center text-axia-gray text-sm">
                No hay datos en el rango seleccionado.
              </div>
            ) : (
              <div className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={tendenciaData.chartDays} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1f4668" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#1f4668" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorFact" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#33838c" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#33838c" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="fecha" tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: "10px", border: "none" }}
                      formatter={(val: any) => [`${val} hs`]}
                      labelFormatter={(_, p) => `Fecha: ${p?.[0]?.payload?.fullFecha || ""}`}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                    <Area type="monotone" dataKey="Total" stroke="#1f4668" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTotal)" />
                    <Area type="monotone" dataKey="Facturable" stroke="#33838c" strokeWidth={2} fillOpacity={1} fill="url(#colorFact)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT 6: BITÁCORA DETALLADA */}
      {activeTab === "bitacora" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-100 bg-slate-50/60 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <h3 className="font-bold text-axia-dark">Bitácora Individual de Registros de Tiempo</h3>
              <p className="text-xs text-axia-gray">Registro pormenorizado de cada sesión de trabajo cargada</p>
            </div>

            {/* Live Search Input */}
            <div className="relative min-w-[240px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Buscar por cliente, comentario, tarea..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-axia-dark outline-none focus:border-axia-teal shadow-inner"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")} 
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-axia-gray text-[10px] tracking-wider uppercase font-bold">
                  <th className="p-3.5">Fecha</th>
                  <th className="p-3.5">Persona</th>
                  <th className="p-3.5">Cliente</th>
                  <th className="p-3.5">Categoría</th>
                  <th className="p-3.5 min-w-[200px]">Tarea</th>
                  <th className="p-3.5 text-center">Horas</th>
                  <th className="p-3.5 min-w-[240px]">Comentario / Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTiempos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-axia-gray">
                      No se encontraron registros de tiempo con los filtros actuales.
                    </td>
                  </tr>
                ) : (
                  filteredTiempos.map((t, idx) => (
                    <tr key={t.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-medium text-axia-dark text-xs whitespace-nowrap">
                        {t.fecha_trabajo ? new Date(t.fecha_trabajo + "T00:00:00").toLocaleDateString("es-AR") : "—"}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="font-bold text-xs text-axia-blue bg-blue-50/80 px-2.5 py-1 rounded-md">
                          {t.persona}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-axia-dark whitespace-nowrap">
                        {t.cliente}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2 py-0.5 rounded-md">
                          {t.categoria}
                        </span>
                      </td>
                      <td className="p-3.5 text-xs text-axia-dark font-medium">
                        <p className="line-clamp-2" title={t.descripcion}>
                          {t.descripcion}
                        </p>
                      </td>
                      <td className="p-3.5 text-center font-black text-axia-teal whitespace-nowrap">
                        {t.horas.toFixed(2)} h
                      </td>
                      <td className="p-3.5 text-xs text-axia-gray">
                        {t.comentario || <span className="text-gray-300 italic">Sin comentario</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DRILL-DOWN CLIENT MODAL */}
      {drillDownClient && (
        <div className="fixed inset-0 bg-axia-dark/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col my-8 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-axia-orange uppercase tracking-wider">Detalle del Cliente</span>
                <h3 className="text-2xl font-black text-axia-blue mt-0.5">{drillDownClient}</h3>
                <p className="text-xs text-axia-gray mt-1">
                  Total de horas en el período: <strong>{drillDownClientLogs.reduce((acc, l) => acc + l.horas, 0).toFixed(1)} hs</strong> en {drillDownClientLogs.length} sesiones
                </p>
              </div>
              <button 
                onClick={() => setDrillDownClient(null)}
                className="p-2 text-gray-400 hover:text-axia-orange hover:bg-slate-200/50 rounded-xl transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              <h4 className="font-bold text-sm text-axia-dark uppercase tracking-wider">
                Sesiones de Trabajo Registradas
              </h4>

              <div className="border border-gray-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 text-axia-gray font-bold uppercase border-b border-gray-200">
                    <tr>
                      <th className="p-3">Fecha</th>
                      <th className="p-3">Colaborador</th>
                      <th className="p-3">Categoría</th>
                      <th className="p-3">Tarea</th>
                      <th className="p-3 text-center">Horas</th>
                      <th className="p-3">Comentario</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {drillDownClientLogs.map((log, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-3 font-semibold text-axia-dark whitespace-nowrap">
                          {log.fecha_trabajo ? new Date(log.fecha_trabajo + "T00:00:00").toLocaleDateString("es-AR") : "—"}
                        </td>
                        <td className="p-3 font-bold text-axia-blue whitespace-nowrap">{log.persona}</td>
                        <td className="p-3"><span className="bg-slate-100 px-2 py-0.5 rounded font-semibold">{log.categoria}</span></td>
                        <td className="p-3 font-medium text-axia-dark">{log.descripcion}</td>
                        <td className="p-3 text-center font-black text-axia-teal whitespace-nowrap">{log.horas.toFixed(2)} h</td>
                        <td className="p-3 text-axia-gray">{log.comentario || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setDrillDownClient(null)}
                className="px-5 py-2 font-bold text-sm bg-axia-blue text-white rounded-xl hover:bg-blue-900 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
