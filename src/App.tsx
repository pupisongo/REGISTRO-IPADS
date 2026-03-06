import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, GraduationCap, Tablet, Download, BarChart3, History, Settings, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Constants ---
const BLOQUES = [
  "1° Bloque (07:30 - 08:15)",
  "2° Bloque (08:15 - 09:00)",
  "3° Bloque (09:00 - 09:45)",
  "Receso (09:45 - 10:15)",
  "4° Bloque (10:15 - 11:00)",
  "5° Bloque (11:00 - 11:45)",
  "6° Bloque (11:45 - 12:30)",
  "7° Bloque (12:30 - 13:15)",
  "8° Bloque (13:15 - 14:00)"
];

const INSTITUTIONAL_COLORS = {
  primary: '#003366', // Kepler Blue
  secondary: '#28a745', // Kepler Green
  accent: '#dc3545', // Kepler Red
  gold: '#f1c40f',    // Kepler Gold (accent from logo/site)
  bg: '#f8fafc',
  white: '#ffffff'
};

// --- Components ---

const StatCard = ({ label, value, icon: Icon }: any) => (
  <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-white/20 shadow-sm flex items-center gap-4">
    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
      <Icon size={20} />
    </div>
    <div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-slate-900">{value}</p>
    </div>
  </div>
);

export default function App() {
  const [fecha, setFecha] = useState(new Date().toLocaleDateString('en-CA'));
  const [bloque, setBloque] = useState(BLOQUES[0]);
  const [docente, setDocente] = useState('');
  const [curso, setCurso] = useState('');
  const [novedades, setNovedades] = useState('');
  const [selectedIpads, setSelectedIpads] = useState<number[]>([]);
  const [reservedIpads, setReservedIpads] = useState<{ipad_id: number, bloque_horario: string}[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [bgUrl, setBgUrl] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);

  // Filters for history
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchAvailability();
    fetchReservations();
    fetchSettings();
  }, [fecha]);

  useEffect(() => {
    // Stats are no longer displayed but we might keep the fetch if needed for other logic
    // or just remove it if it's purely for the removed stats section.
    // fetchStats(); 
  }, [filterMonth, filterYear]);

  const fetchSettings = async () => {
    const res = await fetch('/api/settings/background');
    const data = await res.json();
    setBgUrl(data.url);
  };

  const fetchAvailability = async () => {
    const res = await fetch(`/api/availability?fecha=${fecha}`);
    const data = await res.json();
    setReservedIpads(data.reserved || []);
  };

  const fetchStats = async () => {
    const res = await fetch(`/api/stats?month=${filterMonth}&year=${filterYear}`);
    const data = await res.json();
    setStats(data);
  };

  const fetchReservations = async () => {
    const res = await fetch(`/api/reservations`);
    const data = await res.json();
    setReservations(data);
  };

  const handleReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIpads.length === 0 || !docente) {
      setMessage({ type: 'error', text: 'Selecciona al menos un iPad y completa el nombre del docente' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipad_ids: selectedIpads,
          fecha,
          bloque_horario: bloque,
          docente,
          curso
        })
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'Reserva confirmada exitosamente' });
        setSelectedIpads([]);
        setDocente('');
        setCurso('');
        setNovedades('');
        setShowModal(false);
        fetchAvailability();
        fetchStats();
        fetchReservations();
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al reservar' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error de conexión' });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleReturn = async (overrideData?: { ids: number[], fecha: string, docente: string, curso: string, bloque: string }) => {
    const ids = overrideData ? overrideData.ids : selectedIpads;
    const f = overrideData ? overrideData.fecha : fecha;
    const d = overrideData ? overrideData.docente : docente;
    const c = overrideData ? overrideData.curso : curso;
    const b = overrideData ? overrideData.bloque : bloque;

    if (ids.length === 0) {
      setMessage({ type: 'error', text: 'Selecciona los iPads que deseas devolver' });
      return;
    }

    // Only confirm if returning from the grid selection (not from history button)
    if (!overrideData) {
      const confirmReturn = window.confirm(`¿Estás seguro de que deseas devolver ${ids.length} iPad(s)?`);
      if (!confirmReturn) return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipad_ids: ids,
          fecha: f,
          docente: d,
          curso: c,
          novedades: overrideData ? 'Devolución desde historial' : novedades,
          bloque_horario: b
        })
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'iPads devueltos exitosamente' });
        
        // Clear selection and inputs
        setSelectedIpads([]);
        setDocente('');
        setCurso('');
        setNovedades('');
        setShowReturnModal(false);
        
        // Refresh data
        fetchAvailability();
        fetchReservations();
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al devolver' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error de conexión' });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleExport = () => {
    window.location.href = `/api/export/month/${filterMonth}/${filterYear}`;
  };

  const changeBg = async () => {
    const newUrl = prompt('Ingresa la URL de la nueva imagen de fondo:', bgUrl);
    if (newUrl) {
      await fetch('/api/settings/background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl })
      });
      setBgUrl(newUrl);
    }
  };

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-fixed font-sans text-slate-900"
      style={{ backgroundImage: `url(${bgUrl})` }}
    >
      <div className="min-h-screen bg-slate-900/40 backdrop-blur-[2px] p-4 md:p-8">
        
        {/* Header */}
        <header className="max-w-7xl mx-auto mb-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 w-full lg:w-auto">
            <div className="bg-white/95 backdrop-blur-md px-6 py-4 rounded-2xl shadow-xl border border-white/20 flex-1 md:flex-none">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-3">
                <div className="w-8 h-8 bg-[#003366] rounded-lg flex items-center justify-center text-white">
                  <Tablet size={20} />
                </div>
                SISTEMA DE RESERVA <span className="text-[#003366]">iPADS</span>
              </h1>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Unidad Educativa Johannes Kepler</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="bg-white/95 backdrop-blur-md px-4 py-2 rounded-xl shadow-lg border border-white/20 flex items-center gap-2">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Periodo Reporte</span>
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-slate-400" />
                    <select 
                      value={filterMonth} 
                      onChange={(e) => setFilterMonth(parseInt(e.target.value))}
                      className="bg-transparent text-sm font-bold outline-none cursor-pointer"
                    >
                      {Array.from({length: 12}, (_, i) => (
                        <option key={i+1} value={i+1}>{new Date(2000, i).toLocaleString('es', {month: 'long'})}</option>
                      ))}
                    </select>
                    <select 
                      value={filterYear} 
                      onChange={(e) => setFilterYear(parseInt(e.target.value))}
                      className="bg-transparent text-sm font-bold outline-none cursor-pointer border-l border-slate-200 pl-2"
                    >
                      {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={changeBg}
                  className="bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-lg border border-white/20 hover:bg-white transition-colors group"
                  title="Configuración de fondo"
                >
                  <Settings size={20} className="text-slate-600 group-hover:rotate-90 transition-transform duration-500" />
                </button>
                <button 
                  onClick={handleExport}
                  className="bg-[#003366] text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 font-bold hover:bg-blue-900 transition-all active:scale-95 border border-white/10"
                >
                  <Download size={18} />
                  DESCARGAR REPORTE
                </button>
              </div>
            </div>
          </div>

          {/* Logo Section */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-white/20 self-end lg:self-center"
          >
            <img 
              src="https://www.jkepler.edu.ec/wp-content/uploads/2022/08/logo-web-jk-2022.png" 
              alt="Johannes Kepler Logo" 
              className="h-12 md:h-16 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </header>

        <main className="max-w-7xl mx-auto flex flex-col gap-8">
          
          {/* CUADRÍCULA de iPads */}
          <section className="bg-white/85 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl border border-white/30 relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700">
                  <Tablet size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Disponibilidad de Dispositivos</h2>
                  <p className="text-xs text-slate-500 font-medium">Selecciona los iPads y presiona ACEPTAR para reservar</p>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#28a745]" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Disponible</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#dc3545]" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Reservado</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      const allReserved = selectedIpads.every(id => reservedIpads.some(r => r.ipad_id === id));
                      if (allReserved) setShowReturnModal(true);
                      else setMessage({ type: 'error', text: 'Solo puedes devolver iPads que ya están reservados' });
                    }}
                    disabled={selectedIpads.length === 0 || !selectedIpads.every(id => reservedIpads.some(r => r.ipad_id === id))}
                    className="bg-[#dc3545] text-white px-6 py-3 rounded-xl font-black text-sm shadow-lg shadow-red-200/50 hover:bg-red-600 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    DEVOLVER ({selectedIpads.filter(id => reservedIpads.some(r => r.ipad_id === id)).length})
                  </button>
                  <button 
                    onClick={() => {
                      const allAvailable = selectedIpads.every(id => !reservedIpads.some(r => r.ipad_id === id));
                      if (allAvailable) setShowModal(true);
                      else setMessage({ type: 'error', text: 'No puedes reservar un equipo que ya está reservado' });
                    }}
                    disabled={selectedIpads.length === 0 || !selectedIpads.every(id => !reservedIpads.some(r => r.ipad_id === id))}
                    className="bg-[#28a745] text-white px-8 py-3 rounded-xl font-black text-sm shadow-lg shadow-green-200/50 hover:bg-green-600 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    ACEPTAR ({selectedIpads.filter(id => !reservedIpads.some(r => r.ipad_id === id)).length})
                  </button>
                </div>
              </div>
            </div>

            <div className="mb-6 flex items-center justify-between">
              <div className="bg-green-50 px-4 py-2 rounded-xl border border-green-100 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-600" />
                <span className="text-xs font-black text-green-700 uppercase tracking-wider">
                  {60 - reservedIpads.length} iPads Disponibles Hoy
                </span>
              </div>
              
              <AnimatePresence>
                {message && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className={`px-4 py-2 rounded-xl flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}
                  >
                    {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span className="font-bold text-xs">{message.text}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {/* iPads Negras 1-30 */}
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 ml-1">Ipads Negras (1-30)</h3>
                <div className="grid grid-cols-5 sm:grid-cols-6 gap-3">
                  {Array.from({ length: 30 }, (_, i) => i + 1).map(id => {
                    const isReserved = reservedIpads.some(r => r.ipad_id === id);
                    const isSelected = selectedIpads.includes(id);
                    
                    return (
                      <button
                        key={id}
                        onClick={() => {
                          setSelectedIpads(prev => {
                            if (prev.includes(id)) return prev.filter(x => x !== id);
                            
                            const hasReservedInSelection = prev.some(sid => reservedIpads.some(r => r.ipad_id === sid));
                            const hasAvailableInSelection = prev.some(sid => !reservedIpads.some(r => r.ipad_id === sid));
                            
                            if (isReserved && hasAvailableInSelection) {
                              setMessage({ type: 'error', text: 'No puedes mezclar iPads disponibles y reservados' });
                              setTimeout(() => setMessage(null), 3000);
                              return prev;
                            }
                            if (!isReserved && hasReservedInSelection) {
                              setMessage({ type: 'error', text: 'No puedes mezclar iPads disponibles y reservados' });
                              setTimeout(() => setMessage(null), 3000);
                              return prev;
                            }
                            return [...prev, id];
                          });
                        }}
                        className={`
                          aspect-square rounded-xl flex items-center justify-center text-sm font-black transition-all relative
                          ${isReserved ? 
                            (isSelected ? 'bg-red-600 text-white ring-4 ring-red-200 scale-110 z-10' : 'bg-[#dc3545] text-white opacity-80') : 
                            (isSelected ? 'bg-blue-600 text-white ring-4 ring-blue-200 scale-110 z-10' : 'bg-[#28a745] text-white hover:scale-105 hover:shadow-lg active:scale-95')
                          }
                        `}
                      >
                        {id}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* iPads Verdes 31-60 */}
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 ml-1">Ipads Verdes (31-60)</h3>
                <div className="grid grid-cols-5 sm:grid-cols-6 gap-3">
                  {Array.from({ length: 30 }, (_, i) => i + 31).map(id => {
                    const isReserved = reservedIpads.some(r => r.ipad_id === id);
                    const isSelected = selectedIpads.includes(id);
                    
                    return (
                      <button
                        key={id}
                        onClick={() => {
                          setSelectedIpads(prev => {
                            if (prev.includes(id)) return prev.filter(x => x !== id);
                            
                            const hasReservedInSelection = prev.some(sid => reservedIpads.some(r => r.ipad_id === sid));
                            const hasAvailableInSelection = prev.some(sid => !reservedIpads.some(r => r.ipad_id === sid));
                            
                            if (isReserved && hasAvailableInSelection) {
                              setMessage({ type: 'error', text: 'No puedes mezclar iPads disponibles y reservados' });
                              setTimeout(() => setMessage(null), 3000);
                              return prev;
                            }
                            if (!isReserved && hasReservedInSelection) {
                              setMessage({ type: 'error', text: 'No puedes mezclar iPads disponibles y reservados' });
                              setTimeout(() => setMessage(null), 3000);
                              return prev;
                            }
                            return [...prev, id];
                          });
                        }}
                        className={`
                          aspect-square rounded-xl flex items-center justify-center text-sm font-black transition-all relative
                          ${isReserved ? 
                            (isSelected ? 'bg-red-600 text-white ring-4 ring-red-200 scale-110 z-10' : 'bg-[#dc3545] text-white opacity-80') : 
                            (isSelected ? 'bg-blue-600 text-white ring-4 ring-blue-200 scale-110 z-10' : 'bg-[#28a745] text-white hover:scale-105 hover:shadow-lg active:scale-95')
                          }
                        `}
                      >
                        {id}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* MÓDULO: Histórico */}
          <section className="lg:col-span-2 bg-white/95 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl border border-white/30 mb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
                  <History size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Historial Completo</h2>
                  <p className="text-xs text-slate-500 font-medium">Registro permanente de todas las reservas y devoluciones</p>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-3">
                {/* Filters removed from here as they are now in the header for reports */}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    <th className="px-6 py-3">Tipo</th>
                    <th className="px-6 py-3">iPads</th>
                    <th className="px-6 py-3">Fecha de Uso</th>
                    <th className="px-6 py-3">Docente</th>
                    <th className="px-6 py-3">Curso</th>
                    <th className="px-6 py-3">Novedades</th>
                    <th className="px-6 py-3">Registro</th>
                    <th className="px-6 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.length > 0 ? reservations.map((res) => (
                    <tr key={res.id} className="bg-slate-50 hover:bg-white hover:shadow-md transition-all group">
                      <td className="px-6 py-4 rounded-l-2xl">
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black ${res.tipo === 'RESERVA' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                          {res.tipo}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {res.ipads.split(',').map((id: string) => (
                            <span key={id} className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold">#{id.trim()}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-700">{res.fecha}</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{res.bloque_horario}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-sm">{res.docente}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{res.curso || '—'}</td>
                      <td className="px-6 py-4 text-xs text-slate-500 max-w-[200px] truncate" title={res.novedades}>
                        {res.novedades || '—'}
                      </td>
                      <td className="px-6 py-4 text-[10px] text-slate-400 font-mono">
                        {new Date(res.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 rounded-r-2xl text-right">
                        {res.tipo === 'RESERVA' && (
                          <button
                            onClick={() => handleReturn({
                              ids: res.ipads.split(',').map((id: string) => parseInt(id.trim())),
                              fecha: res.fecha,
                              docente: res.docente,
                              curso: res.curso,
                              bloque: res.bloque_horario
                            })}
                            className="bg-[#28a745] text-white px-3 py-1.5 rounded-lg text-[10px] font-black hover:bg-green-600 transition-all active:scale-95 flex items-center gap-1 ml-auto"
                          >
                            <History size={12} />
                            DEVOLVER
                          </button>
                        )}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic font-medium">
                        No hay reservas registradas para este periodo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="mt-8 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">
              <span>Mostrando {reservations.length} resultados</span>
              <div className="flex gap-2">
                <button className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30" disabled><ChevronLeft size={16} /></button>
                <button className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30" disabled><ChevronRight size={16} /></button>
              </div>
            </div>
          </section>
        </main>

        <footer className="max-w-7xl mx-auto py-12 text-center">
          <p className="text-white/60 text-xs font-bold uppercase tracking-[0.3em]">
            &copy; 2026 UNIDAD EDUCATIVA JOHANNES KEPLER • DEPARTAMENTO DE TECNOLOGÍA
          </p>
        </footer>
      </div>

      {/* MODAL DE RESERVA */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20"
            >
              <div className="bg-[#003366] p-8 text-white">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                    <Tablet size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">Completar Reserva</h2>
                    <p className="text-xs font-bold opacity-70 uppercase tracking-widest">
                      {selectedIpads.length} Dispositivos Seleccionados
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleReserve} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Fecha de Uso</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="date" 
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Bloque Horario</label>
                  <div className="relative">
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <select 
                      value={bloque}
                      onChange={(e) => setBloque(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold appearance-none"
                      required
                    >
                      {BLOQUES.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Docente Responsable</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Nombres y Apellidos"
                      value={docente}
                      onChange={(e) => setDocente(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Curso / Grado</label>
                  <div className="relative">
                    <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Ej: 10mo de Básica A"
                      value={curso}
                      onChange={(e) => setCurso(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
                      required
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-6 py-4 rounded-2xl font-black text-slate-500 hover:bg-slate-100 transition-all uppercase tracking-widest text-xs"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-[2] bg-[#28a745] text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-green-200/50 hover:bg-green-600 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {loading ? 'PROCESANDO...' : 'CONFIRMAR'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE DEVOLUCIÓN */}
      <AnimatePresence>
        {showReturnModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReturnModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20"
            >
              <div className="bg-[#dc3545] p-8 text-white">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                    <History size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">Devolver Equipos</h2>
                    <p className="text-xs font-bold opacity-70 uppercase tracking-widest">
                      {selectedIpads.length} Dispositivos a Liberar
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleReturn(); }} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Fecha de Devolución</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="date" 
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Docente que entrega</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Nombres y Apellidos"
                      value={docente}
                      onChange={(e) => setDocente(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Novedades / Estado de los equipos</label>
                  <textarea 
                    placeholder="¿Algún problema con los iPads devueltos?"
                    value={novedades}
                    onChange={(e) => setNovedades(e.target.value)}
                    className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold min-h-[100px] resize-none"
                  />
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setShowReturnModal(false)}
                    className="flex-1 px-6 py-4 rounded-2xl font-black text-slate-500 hover:bg-slate-100 transition-all uppercase tracking-widest text-xs"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-[2] bg-[#dc3545] text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-red-200/50 hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {loading ? 'PROCESANDO...' : 'DEVOLVER'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
