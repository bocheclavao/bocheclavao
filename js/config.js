// ============================================
// CONFIGURACIÓN GLOBAL DE SUPABASE
// ============================================

const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'tu-anon-key-aqui';

// Verificar que el SDK se cargó correctamente
if (typeof window.supabase === 'undefined') {
    console.error('❌ El SDK de Supabase no se cargó correctamente');
} else {
    console.log('✅ SDK de Supabase cargado correctamente');
}

// Crear cliente de Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Configuración de la app
const APP_CONFIG = {
    NOMBRE: 'Boche Clava\'o',
    VERSION: '1.0.0',
    REDIRECT_AFTER_LOGIN: '../dashboard.html',
    REDIRECT_AFTER_REGISTER: 'login.html'
};

// Hacer supabase disponible globalmente
window.supabaseClient = supabase;
