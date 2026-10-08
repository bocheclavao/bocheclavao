// ============================================
// CONFIGURACIÓN GLOBAL DE SUPABASE
// ============================================

// ⚠️ REEMPLAZA ESTOS VALORES CON LOS TUYOS
const SUPABASE_URL = 'https://tlssbdbnfbuknbqoboza.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsc3NiZGJuZmJ1a25icW9ib3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MjEyMjQsImV4cCI6MjEwNjk5NzIyNH0.oN6Sh_lsSGa5ns5qIa2A9yiMLJnKR5lD3x_WygaHjgU';

// Verificar que el SDK se cargó correctamente
if (typeof window.supabase === 'undefined') {
    console.error('❌ El SDK de Supabase no se cargó correctamente');
} else {
    console.log('✅ SDK de Supabase cargado correctamente');
}

// Crear cliente de Supabase (Nombre diferente para evitar conflictos)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Configuración de la app
const APP_CONFIG = {
    NOMBRE: 'Boche Clava\'o',
    VERSION: '1.0.0',
    // Como estamos en la carpeta html/, redirigimos a dashboard.html en la misma carpeta
    REDIRECT_AFTER_LOGIN: 'dashboard.html',
    REDIRECT_AFTER_REGISTER: 'login.html'
};

// Hacer el cliente disponible globalmente para otros archivos
window.supabaseClient = supabaseClient;
