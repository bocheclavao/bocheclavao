document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    
    if (!db) {
        console.error('No se pudo obtener el cliente de Supabase');
        return;
    }

    const loadingState = document.getElementById('loadingState');
    const contentState = document.getElementById('contentState');
    const balanceAmount = document.getElementById('balanceAmount');
    const saldoDisplay = document.getElementById('saldoDisplay');
    const dropdownUserName = document.getElementById('dropdownUserName');
    const dropdownUserEmail = document.getElementById('dropdownUserEmail');
    const navAvatarContainer = document.getElementById('navAvatarContainer');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const menuToggle = document.getElementById('menuToggle');
    const statApuestas = document.getElementById('statApuestas');
    const statBochadores = document.getElementById('statBochadores');
    const statRendimiento = document.getElementById('statRendimiento');

    let saldoBC = 0;
    let estadisticas = null;

    db.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
            window.location.href = 'login.html';
        }
    });

    async function asegurarSesionUnica() {
        const { data: { session } } = await db.auth.getSession();
        if (session) {
            await db.auth.signOut({ scope: 'others' });
        }
    }

    async function cargarPerfil(user) {
        try {
            const { data: perfil, error } = await db
                .from('perfiles')
                .select('*')
                .eq('id', user.id)
                .single();
            
            if (error || !perfil) {
                console.error('Error al cargar perfil:', error);
                return null;
            }
            
            return perfil;
        } catch (err) {
            console.error('Error en cargarPerfil:', err);
            return null;
        }
    }

    async function cargarOCrearEstadisticas(user) {
        try {
            console.log('🔍 Buscando estadísticas de patrocinador para:', user.id);
            
            const { data: stats, error } = await db
                .from('estadisticas_patrocinador')
                .select('*')
                .eq('id', user.id)
                .single();
            
            if (stats) {
                console.log('✅ Estadísticas encontradas:', stats);
                return stats;
            }
            
            if (error && error.code === 'PGRST116') {
                console.log('⚠️ Estadísticas no existen, creando nuevas con valores en 0...');
                
                const nuevasStats = {
                    id: user.id,
                    user_id: null,
                    apuestas_activas: 0,
                    bochadores_apoyados: 0,
                    rendimiento_actual: 0,
                    total_invertido: 0,
                    total_ganado: 0,
                    total_perdido: 0,
                    victorias: 0,
                    derrotas: 0,
                    nivel: 'principiante'
                };
                
                const { data: creada, error: insertError } = await db
                    .from('estadisticas_patrocinador')
                    .insert(nuevasStats)
                    .select()
                    .single();
                
                if (insertError) {
                    console.error('❌ Error al crear estadísticas:', insertError);
                    return null;
                }
                
                console.log('✅ Estadísticas creadas:', creada);
                return creada;
            }
            
            console.error('❌ Error inesperado:', error);
            return null;
        } catch (err) {
            console.error('❌ Error en cargarOCrearEstadisticas:', err);
            return null;
        }
    }

    function mostrarAvatarNavbar(nombre, avatarUrl) {
        if (avatarUrl) {
            navAvatarContainer.innerHTML = `<img src="${avatarUrl}" alt="Avatar" class="user-avatar-small" onclick="toggleMenu()">`;
        } else {
            const inicial = (nombre || 'U').charAt(0).toUpperCase();
            navAvatarContainer.innerHTML = `<div class="avatar-placeholder-small" onclick="toggleMenu()">${inicial}</div>`;
        }
    }

    window.toggleMenu = function() {
        dropdownMenu.classList.toggle('show');
        menuToggle.classList.toggle('active');
    };

    document.addEventListener('click', function(event) {
        const menuContainer = document.querySelector('.user-menu-container');
        if (!menuContainer.contains(event.target)) {
            dropdownMenu.classList.remove('show');
            menuToggle.classList.remove('active');
        }
    });

    window.depositar = function() {
        alert(' El sistema de depósitos estará disponible próximamente. Podrás agregar monedas BC a tu billetera.');
    };

    async function protegerRuta() {
        const { data: { session }, error } = await db.auth.getSession();
        
        if (!session || error) {
            window.location.href = 'login.html';
            return;
        }

        try {
            await asegurarSesionUnica();

            const { data: { user }, error: userError } = await db.auth.getUser();
            
            if (userError || !user) {
                throw new Error('No se pudo obtener la información del usuario');
            }

            const perfil = await cargarPerfil(user);
            
            if (!perfil || perfil.estado_kyc !== 'verificado') {
                alert('Debes tener tu KYC verificado para acceder al Dashboard del Patrocinador.');
                window.location.href = 'perfil.html';
                return;
            }

            const nombre = perfil.nombre || user.user_metadata?.nombre || user.user_metadata?.full_name || 'Usuario';
            const email = user.email;
            saldoBC = perfil.saldo_bc || 0;

            dropdownUserName.textContent = nombre;
            dropdownUserEmail.textContent = email;
            balanceAmount.textContent = `${saldoBC.toFixed(2)} BC`;
            saldoDisplay.textContent = `$${saldoBC.toFixed(2)}`;

            const avatarUrl = perfil.avatar_url || user.user_metadata?.avatar_url;
            mostrarAvatarNavbar(nombre, avatarUrl);

            const stats = await cargarOCrearEstadisticas(user);
            estadisticas = stats;

            if (stats) {
                statApuestas.textContent = stats.apuestas_activas;
                statBochadores.textContent = stats.bochadores_apoyados;
                
                const rendimiento = stats.rendimiento_actual;
                const signo = rendimiento >= 0 ? '+' : '';
                statRendimiento.textContent = `${signo}${rendimiento.toFixed(1)}%`;
                
                if (rendimiento >= 0) {
                    statRendimiento.classList.add('positive');
                } else {
                    statRendimiento.classList.remove('positive');
                }
            }

            loadingState.style.display = 'none';
            contentState.style.display = 'block';

        } catch (err) {
            console.error('Error al obtener usuario:', err);
            loadingState.style.display = 'none';
            alert('Error al cargar el dashboard. Intenta de nuevo.');
            window.location.href = 'dashboard.html';
        }
    }

    protegerRuta();
});

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
