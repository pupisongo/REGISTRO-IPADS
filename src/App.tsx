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
  bg: '#f8fafc'
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
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [bloque, setBloque] = useState(BLOQUES[0]);
  const [docente, setDocente] = useState('');
  const [curso, setCurso] = useState('');
  const [selectedIpad, setSelectedIpad] = useState<number | null>(null);
  const [reservedIpads, setReservedIpads] = useState<number[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [bgUrl, setBgUrl] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Filters for history
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchAvailability();
    fetchStats();
    fetchReservations();
    fetchSettings();
  }, [fecha, bloque]);

  useEffect(() => {
    fetchReservations();
    fetchStats();
  }, [filterMonth, filterYear]);

  const fetchSettings = async () => {
    const res = await fetch('/api/settings/background');
    const data = await res.json();
    setBgUrl(data.url);
  };

  const fetchAvailability = async () => {
    const res = await fetch(`/api/availability?fecha=${fecha}&bloque=${encodeURIComponent(bloque)}`);
    const data = await res.json();
    setReservedIpads(data.reserved || []);
  };

  const fetchStats = async () => {
    const res = await fetch(`/api/stats?month=${filterMonth}&year=${filterYear}`);
    const data = await res.json();
    setStats(data);
  };

  const fetchReservations = async () => {
    const res = await fetch(`/api/reservations?month=${filterMonth}&year=${filterYear}`);
    const data = await res.json();
    setReservations(data);
  };

  const handleReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIpad || !docente) {
      setMessage({ type: 'error', text: 'Selecciona un iPad y completa el nombre del docente' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipad_id: selectedIpad,
          fecha,
          bloque_horario: bloque,
          docente,
          curso
        })
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'Reserva confirmada exitosamente' });
        setSelectedIpad(null);
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
        <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="bg-white/90 backdrop-blur-md px-6 py-3 rounded-2xl shadow-xl border border-white/20">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-3">
              <div className="w-8 h-8 bg-[#003366] rounded-lg flex items-center justify-center text-white">
                <Tablet size={20} />
              </div>
              SISTEMA DE RESERVA <span className="text-[#003366]">iPADS</span>
            </h1>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Unidad Educativa Johannes Kepler</p>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={changeBg}
              className="bg-white/90 backdrop-blur-md p-3 rounded-xl shadow-lg border border-white/20 hover:bg-white transition-colors"
              title="Cambiar fondo"
            >
              <Settings size={20} className="text-slate-600" />
            </button>
            <button 
              onClick={handleExport}
              className="bg-[#003366] text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 font-bold hover:bg-blue-900 transition-all active:scale-95"
            >
              <Download size={18} />
              REPORTE EXCEL
            </button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* CUADRANTE 1: Formulario */}
          <section className="bg-white/85 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl border border-white/30 flex flex-col gap-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
                <Calendar size={20} />
              </div>
              <h2 className="text-xl font-bold tracking-tight">Nueva Reserva</h2>
            </div>

            <form onSubmit={handleReserve} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Fecha</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="date" 
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
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
                    className="w-full pl-12 pr-4 py-3 bg-white/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium appearance-none"
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
                    placeholder="Nombre completo"
                    value={docente}
                    onChange={(e) => setDocente(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
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
                    placeholder="Ej: 10mo A"
                    value={curso}
                    onChange={(e) => setCurso(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                  />
                </div>
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">iPad Seleccionado</label>
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${selectedIpad ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                    {selectedIpad || '?'}
                  </div>
                  <p className="text-sm text-slate-500 italic">
                    {selectedIpad ? 'iPad listo para reservar.' : 'Haz click en un iPad de la cuadrícula inferior.'}
                  </p>
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading || !selectedIpad}
                className="md:col-span-2 mt-2 bg-[#28a745] text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-green-200/50 hover:bg-green-600 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {loading ? 'PROCESANDO...' : 'CONFIRMAR RESERVA'}
              </button>
            </form>

            <AnimatePresence>
              {message && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}
                >
                  {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                  <span className="font-bold text-sm">{message.text}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* CUADRANTE 2: Estadísticas */}
          <section className="bg-white/85 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl border border-white/30 flex flex-col gap-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700">
                  <BarChart3 size={20} />
                </div>
                <h2 className="text-xl font-bold tracking-tight">Estadísticas del Mes</h2>
              </div>
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <select 
                  value={filterMonth} 
                  onChange={(e) => setFilterMonth(parseInt(e.target.value))}
                  className="bg-transparent text-xs font-bold px-2 py-1 outline-none"
                >
                  {Array.from({length: 12}, (_, i) => (
                    <option key={i+1} value={i+1}>{new Date(2000, i).toLocaleString('es', {month: 'long'})}</option>
                  ))}
                </select>
                <select 
                  value={filterYear} 
                  onChange={(e) => setFilterYear(parseInt(e.target.value))}
                  className="bg-transparent text-xs font-bold px-2 py-1 outline-none"
                >
                  {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatCard label="Total Reservas" value={stats?.total || 0} icon={History} />
              <StatCard label="iPad más usado" value={stats?.ipadMasUsado || 'N/A'} icon={Tablet} />
              <StatCard label="Día con más uso" value={stats?.diaMasDemanda || 'N/A'} icon={Calendar} />
              <StatCard label="Bloque preferido" value={stats?.bloqueMasReservado?.split(' ')[0] || 'N/A'} icon={Clock} />
            </div>

            <div className="mt-4 p-6 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl text-white shadow-xl">
              <h3 className="text-sm font-bold uppercase tracking-widest opacity-80 mb-4">Ocupación General</h3>
              <div className="flex items-end gap-4">
                <span className="text-5xl font-black">{Math.min(100, Math.round(((stats?.total || 0) / (20 * 8 * 60)) * 10000) / 100)}%</span>
                <p className="text-xs font-medium mb-2 opacity-90">del total de slots mensuales disponibles</p>
              </div>
              <div className="mt-6 w-full h-3 bg-white/20 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, ((stats?.total || 0) / (20 * 8 * 60)) * 100)}%` }}
                  className="h-full bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                />
              </div>
            </div>
          </section>

          {/* CUADRANTE 3 & 4: Cuadrícula de iPads */}
          <section className="lg:col-span-2 bg-white/85 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl border border-white/30">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700">
                  <Tablet size={20} />
                </div>
                <h2 className="text-xl font-bold tracking-tight">Disponibilidad de Dispositivos</h2>
              </div>
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {/* iPads 1-30 */}
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 ml-1">Lote A (1-30)</h3>
                <div className="grid grid-cols-5 sm:grid-cols-6 gap-3">
                  {Array.from({ length: 30 }, (_, i) => i + 1).map(id => {
                    const isReserved = reservedIpads.includes(id);
                    const isSelected = selectedIpad === id;
                    return (
                      <button
                        key={id}
                        disabled={isReserved}
                        onClick={() => setSelectedIpad(id)}
                        className={`
                          aspect-square rounded-xl flex items-center justify-center text-sm font-black transition-all
                          ${isReserved ? 'bg-[#dc3545] text-white cursor-not-allowed opacity-80' : 
                            isSelected ? 'bg-blue-600 text-white ring-4 ring-blue-200 scale-110' : 
                            'bg-[#28a745] text-white hover:scale-105 hover:shadow-lg active:scale-95'}
                        `}
                      >
                        {id}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* iPads 31-60 */}
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 ml-1">Lote B (31-60)</h3>
                <div className="grid grid-cols-5 sm:grid-cols-6 gap-3">
                  {Array.from({ length: 30 }, (_, i) => i + 31).map(id => {
                    const isReserved = reservedIpads.includes(id);
                    const isSelected = selectedIpad === id;
                    return (
                      <button
                        key={id}
                        disabled={isReserved}
                        onClick={() => setSelectedIpad(id)}
                        className={`
                          aspect-square rounded-xl flex items-center justify-center text-sm font-black transition-all
                          ${isReserved ? 'bg-[#dc3545] text-white cursor-not-allowed opacity-80' : 
                            isSelected ? 'bg-blue-600 text-white ring-4 ring-blue-200 scale-110' : 
                            'bg-[#28a745] text-white hover:scale-105 hover:shadow-lg active:scale-95'}
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
                  <h2 className="text-xl font-bold tracking-tight">Historial de Reservas</h2>
                  <p className="text-xs text-slate-500 font-medium">Visualiza y filtra todas las actividades registradas</p>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-2">
                  <Calendar size={14} className="text-slate-400" />
                  <select 
                    value={filterMonth} 
                    onChange={(e) => setFilterMonth(parseInt(e.target.value))}
                    className="bg-transparent text-xs font-bold outline-none"
                  >
                    {Array.from({length: 12}, (_, i) => (
                      <option key={i+1} value={i+1}>{new Date(2000, i).toLocaleString('es', {month: 'long'})}</option>
                    ))}
                  </select>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">AÑO</span>
                  <select 
                    value={filterYear} 
                    onChange={(e) => setFilterYear(parseInt(e.target.value))}
                    className="bg-transparent text-xs font-bold outline-none"
                  >
                    {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    <th className="px-6 py-3">Fecha</th>
                    <th className="px-6 py-3">Bloque</th>
                    <th className="px-6 py-3">iPad</th>
                    <th className="px-6 py-3">Docente</th>
                    <th className="px-6 py-3">Curso</th>
                    <th className="px-6 py-3">Registro</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.length > 0 ? reservations.map((res) => (
                    <tr key={res.id} className="bg-slate-50 hover:bg-white hover:shadow-md transition-all group">
                      <td className="px-6 py-4 rounded-l-2xl font-bold text-sm text-slate-700">{res.fecha}</td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-500">{res.bloque_horario.split(' ')[0]}</td>
                      <td className="px-6 py-4">
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-xs font-black">#{res.ipad_id}</span>
                      </td>
                      <td className="px-6 py-4 font-bold text-sm">{res.docente}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{res.curso || '—'}</td>
                      <td className="px-6 py-4 rounded-r-2xl text-[10px] text-slate-400 font-mono">
                        {new Date(res.timestamp).toLocaleString()}
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
    </div>
  );
}
