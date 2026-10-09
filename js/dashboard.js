document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    
    if (!db) {
        console.error('No se pudo obtener el cliente de Supabase');
        return;
    }

    const loadingState = document.getElementById('loadingState');
    const contentState = document.getElementById('contentState');
    const errorState = document.getElementById('errorState');
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    const userNameDisplay = document.getElementById('userNameDisplay');
    const userIdDisplay = document.getElementById('userIdDisplay');
    const avatarImage = document.getElementById('avatarImage');
    const avatarPlaceholder = document.getElementById('avatarDisplay');
    const navAvatar = document.getElementById('navAvatar');

    // Escuchar cambios de autenticación
    db.auth.onAuthStateChange((event, session) => {
        console.log('Evento de auth:', event);
        
        if (event === 'SIGNED_OUT' || !session) {
            console.log('Sesión invalidada, redirigiendo...');
            window.location.href = 'login.html';
        }
    });

    // Asegurar sesión única
    async function asegurarSesionUnica() {
        const { data: { session } } = await db.auth.getSession();
        if (session) {
            console.log('Verificando sesiones en otros dispositivos...');
            await db.auth.signOut({ scope: 'others' });
        }
    }

    // Generar ID único de 8 dígitos
    function generarIdUnico() {
        return 'BC-' + Math.floor(10000000 + Math.random() * 90000000).toString();
    }

    // Cargar o crear perfil
    async function cargarOCrearPerfil(user) {
        try {
            console.log('Buscando perfil de:', user.email);
            
            // Intentar obtener el perfil existente
            const { data: perfil, error } = await db
                .from('perfiles')
                .select('*')
                .eq('id', user.id)
                .single();
            
            // Si existe, retornarlo
            if (perfil) {
                console.log('Perfil encontrado:', perfil.user_id);
                return perfil;
            }
            
            // Si no existe (error PGRST116 = no rows), crear uno nuevo
            if (error && error.code === 'PGRST116') {
                console.log('Perfil no existe, creando uno nuevo...');
                
                const nuevoPerfil = {
                    id: user.id,
                    user_id: generarIdUnico(),
                    nombre: user.user_metadata?.nombre || user.user_metadata?.full_name || 'Usuario',
                    email: user.email,
                    avatar_url: user.user_metadata?.avatar_url || null
                };
                
                const { data: creado, error: insertError } = await db
                    .from('perfiles')
                    .insert(nuevoPerfil)
                    .select()
                    .single();
                
                if (insertError) {
                    console.error('Error al crear perfil:', insertError);
                    return null;
                }
                
                console.log('Perfil creado con ID:', creado.user_id);
                return creado;
            }
            
            console.error('Error inesperado:', error);
            return null;
            
        } catch (err) {
            console.error('Error en cargarOCrearPerfil:', err);
            return null;
        }
    }

    // Mostrar datos en la pantalla
    function mostrarDatos(user, perfil) {
        const nombre = perfil?.nombre || user.user_metadata?.nombre || user.user_metadata?.full_name || 'Usuario';
        const email = user.email;
        const userId = perfil?.user_id || generarIdUnico();
        const avatarUrl = perfil?.avatar_url || user.user_metadata?.avatar_url;

        // Actualizar textos
        userNameDisplay.textContent = nombre;
        userEmailDisplay.textContent = email;
        userIdDisplay.textContent = `ID: ${userId}`;

        // Mostrar avatar
        if (avatarUrl) {
            avatarImage.src = avatarUrl;
            avatarImage.style.display = 'block';
            avatarPlaceholder.style.display = 'none';
            
            navAvatar.src = avatarUrl;
            navAvatar.style.display = 'block';
        } else {
            const inicial = nombre.charAt(0).toUpperCase();
            avatarPlaceholder.textContent = inicial;
            avatarPlaceholder.style.display = 'flex';
            avatarImage.style.display = 'none';
            navAvatar.style.display = 'none';
        }
    }

    async function protegerRuta() {
        const { data: { session }, error } = await db.auth.getSession();
        
        if (!session || error) {
            console.log('Sin sesión válida, redirigiendo...');
            window.location.href = 'login.html';
            return;
        }

        try {
            await asegurarSesionUnica();

            const { data: { user }, error: userError } = await db.auth.getUser();
            
            if (userError || !user) {
                throw new Error('No se pudo obtener la información del usuario');
            }

            // Cargar o crear perfil
            const perfil = await cargarOCrearPerfil(user);

            // Mostrar datos
            mostrarDatos(user, perfil);
            
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

    protegerRuta();
});

// Cerrar sesión
async function cerrarSesion() {
    const db = window.supabaseClient;
    if (!db) return;

    try {
        const { error } = await db.auth.signOut({ scope: 'global' });
        if (error) throw error;
        
        window.location.href = 'login.html';
    } catch (err) {
        console.error('Error al cerrar sesión:', err);
        alert('Hubo un error al cerrar sesión.');
    }
}
