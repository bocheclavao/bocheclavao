// ============================================
// CONFIGURACIÓN GLOBAL DE SUPABASE
// ============================================
// ⚠️ IMPORTANTE: Reemplaza con tus credenciales reales
// ============================================

const SUPABASE_CONFIG = {
    URL: 'https://tlssbdbnfbuknbqoboza.supabase.co',
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsc3NiZGJuZmJ1a25icW9ib3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MjEyMjQsImV4cCI6MjEwNjk5NzIyNH0.oN6Sh_lsSGa5ns5qIa2A9yiMLJnKR5lD3x_WygaHjgU'
};

// Crear cliente de Supabase global
const supabase = window.supabase.createClient(
    SUPABASE_CONFIG.URL, 
    SUPABASE_CONFIG.ANON_KEY
);

// Configuración de la app
const APP_CONFIG = {
    NOMBRE: 'Boche Clava\'o',
    VERSION: '1.0.0',
    REDIRECT_AFTER_LOGIN: '../dashboard.html',
    REDIRECT_AFTER_REGISTER: 'login.html'
};
