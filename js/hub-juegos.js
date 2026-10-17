// js/hub-juegos.js
document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    
    if (!db) {
        console.error('No se pudo obtener el cliente de Supabase');
        window.location.href = 'index.html';
        return;
    }

    // Referencias del DOM
    const btnAdmin = document.getElementById('btnAdmin');

    // ============================================
    // 🔐 1. VERIFICAR SESIÓN AL CARGAR
    // ============================================
    const { data: { session } } = await db.auth.getSession();
    
    if (!session || !session.user) {
        window.location.href = 'index.html';
        return;
    }

    // ============================================
    // 🛡️ 2. VERIFICAR SI ES ADMINISTRADOR
    // ============================================
    async function verificarSiEsAdmin(userId) {
        try {
            const { data, error } = await db
                .from('admin_roles')
                .select('es_admin, activo')
                .eq('id', userId)
                .eq('es_admin', true)
                .eq('activo', true)
                .maybeSingle();
            
            if (error || !data) return false;
            return true;
        } catch (err) {
            console.error('Error verificando admin:', err);
            return false;
        }
    }

    const esAdmin = await verificarSiEsAdmin(session.user.id);
    if (esAdmin && btnAdmin) {
        btnAdmin.style.display = 'flex';
    } else if (btnAdmin) {
        btnAdmin.style.display = 'none';
    }

    // ============================================
    // 🚪 3. FUNCIONES GLOBALES (Cerrar sesión y Admin)
    // ============================================
    window.cerrarSesion = async function() {
        if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
            try {
                await db.auth.signOut({ scope: 'global' });
                localStorage.removeItem('session_token');
                window.location.href = 'index.html';
            } catch (err) {
                console.error('Error al cerrar sesión:', err);
                alert('Hubo un error al cerrar sesión.');
            }
        }
    };

    window.irAPanelAdmin = function() {
        window.location.href = 'admin.html';
    };

    console.log('✅ Hub de Juegos cargado correctamente. Usuario:', session.user.email);
});
