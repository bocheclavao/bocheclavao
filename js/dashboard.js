document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    
    if (!db) {
        console.error('❌ No se pudo obtener el cliente de Supabase');
        return;
    }

    // Elementos del DOM
    const loadingState = document.getElementById('loadingState');
    const contentState = document.getElementById('contentState');
    const errorState = document.getElementById('errorState');
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    const userNameDisplay = document.getElementById('userNameDisplay');

    // 1. 🔒 Escuchar cambios de autenticación en tiempo real
    db.auth.onAuthStateChange((event, session) => {
        console.log('Evento de auth:', event);
        
        // Si la sesión se cierra o es invalidada, expulsar al login
        if (event === 'SIGNED_OUT' || !session) {
            console.log('⚠️ Sesión invalidada, redirigiendo al login...');
            window.location.href = 'login.html';
        }
    });

    // 2. 🔒 Asegurar sesión única (Expulsa otros dispositivos)
    async function asegurarSesionUnica() {
        const { data: { session } } = await db.auth.getSession();
        if (session) {
            console.log('🔒 Verificando sesiones en otros dispositivos...');
            await db.auth.signOut({ scope: 'others' });
            console.log('✅ Sesión única asegurada');
        }
    }

    // 3. Proteger la ruta y cargar datos
    async function protegerRuta() {
        const { data: { session }, error } = await db.auth.getSession();
        
        // Si NO hay sesión, mandar al login
        if (!session || error) {
            console.log('⚠️ Sin sesión válida, redirigiendo al login...');
            window.location.href = 'login.html';
            return;
        }

        try {
            // Ejecutar seguridad de sesión única
            await asegurarSesionUnica();

            // Obtener datos del usuario
            const { data: { user }, error: userError } = await db.auth.getUser();
            
            if (userError || !user) {
                throw new Error('No se pudo obtener la información del usuario');
            }

            // Mostrar datos en la pantalla
            const nombre = user.user_metadata?.nombre || 'Usuario';
            const email = user.email;

            userEmailDisplay.textContent = email;
            userNameDisplay.textContent = nombre;
            
            // Ocultar carga y mostrar contenido
            loadingState.style.display = 'none';
            contentState.style.display = 'block';

        } catch (err) {
            console.error('Error al obtener usuario:', err);
            loadingState.style.display = 'none';
            errorState.style.display = 'block';
            
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 3000);
        }
    }

    // Iniciar
    protegerRuta();
});

// Función global para cerrar sesión manualmente
async function cerrarSesion() {
    const db = window.supabaseClient;
    if (!db) return;

    try {
        // 'global' cierra la sesión en TODOS los dispositivos por seguridad
        const { error } = await db.auth.signOut({ scope: 'global' });
        if (error) throw error;
        
        window.location.href = 'login.html';
    } catch (err) {
        console.error('Error al cerrar sesión:', err);
        alert('Hubo un error al cerrar sesión. Inténtalo de nuevo.');
    }
}
