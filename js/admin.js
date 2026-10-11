document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) { 
        console.error('No se pudo obtener el cliente de Supabase'); 
        return; 
    }

    const accessDenied = document.getElementById('accessDenied');
    const adminContent = document.getElementById('adminContent');
    const kycBadge = document.getElementById('kycBadge');
    const chatBadge = document.getElementById('chatBadge');

    // Verificar acceso de administrador
    async function verificarAccesoAdmin() {
        const { data: { session }, error } = await db.auth.getSession();
        if (error || !session) { 
            mostrarAccesoDenegado(); 
            return false; 
        }
        
        const { data: { user } } = await db.auth.getUser();
        if (!user) { 
            mostrarAccesoDenegado(); 
            return false; 
        }
        
        try {
            const { data: adminData, error: adminError } = await db
                .from('admin_roles')
                .select('es_admin, activo')
                .eq('id', user.id)
                .eq('es_admin', true)
                .eq('activo', true)
                .single();
                
            if (adminError || !adminData) { 
                mostrarAccesoDenegado(); 
                return false; 
            }
            return true;
        } catch (err) { 
            console.error('Error verificando admin:', err);
            mostrarAccesoDenegado(); 
            return false; 
        }
    }

    function mostrarAccesoDenegado() {
        adminContent.style.display = 'none';
        accessDenied.style.display = 'block';
        setTimeout(() => { 
            window.location.href = 'dashboard.html'; 
        }, 3000);
    }

    // Cargar estadísticas para los badges
    async function cargarEstadisticas() {
        try {
            // KYC pendientes
            const { data: kycPendientes } = await db
                .from('perfiles')
                .select('id', { count: 'exact' })
                .eq('estado_kyc', 'pendiente');
            
            if (kycBadge) {
                const count = kycPendientes?.length || 0;
                kycBadge.textContent = `${count} pendiente${count !== 1 ? 's' : ''}`;
            }

            // Mensajes de chat sin leer
            const { data: chatSinLeer } = await db
                .from('mensajes_chat')
                .select('id', { count: 'exact' })
                .eq('leido', false)
                .eq('tipo', 'usuario');
            
            if (chatBadge) {
                const count = chatSinLeer?.length || 0;
                chatBadge.textContent = `${count} mensaje${count !== 1 ? 's' : ''}`;
            }
        } catch (err) {
            console.error('Error cargando estadísticas:', err);
        }
    }

    // Inicializar
    const accesoPermitido = await verificarAccesoAdmin();
    if (accesoPermitido) {
        adminContent.style.display = 'block';
        accessDenied.style.display = 'none';
        await cargarEstadisticas();
    }
});
