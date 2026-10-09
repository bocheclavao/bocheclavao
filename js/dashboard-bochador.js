document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    
    if (!db) {
        console.error('No se pudo obtener el cliente de Supabase');
        return;
    }

    const loadingState = document.getElementById('loadingState');
    const contentState = document.getElementById('contentState');
    const balanceAmount = document.getElementById('balanceAmount');
    const dropdownUserName = document.getElementById('dropdownUserName');
    const dropdownUserEmail = document.getElementById('dropdownUserEmail');
    const navAvatarContainer = document.getElementById('navAvatarContainer');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const menuToggle = document.getElementById('menuToggle');
    const profileName = document.getElementById('profileName');
    const profileFlag = document.getElementById('profileFlag');
    const rankingNumber = document.getElementById('rankingNumber');
    const statPrecision = document.getElementById('statPrecision');
    const statLanzamientos = document.getElementById('statLanzamientos');
    const statBoches = document.getElementById('statBoches');
    const statEventos = document.getElementById('statEventos');
    const statVictorias = document.getElementById('statVictorias');
    const statDerrotas = document.getElementById('statDerrotas');
    const profileAvatarContainer = document.getElementById('profileAvatarContainer');

    let saldoBC = 0;
    let estadisticas = null;

    // Mapeo de países a banderas
    const countryFlags = {
        'Colombia': '🇨🇴',
        'México': '🇲🇽',
        'Argentina': '🇦🇷',
        'España': '🇪🇸',
        'Estados Unidos': '🇺',
        'Perú': '🇪',
        'Chile': '🇨🇱',
        'Venezuela': '🇻🇪',
        'Ecuador': '🇪🇨',
        'Guatemala': '🇬',
        'Cuba': '🇺',
        'Bolivia': '🇧🇴',
        'República Dominicana': '🇩🇴',
        'Honduras': '🇭🇳',
        'Paraguay': '🇵🇾',
        'El Salvador': '🇸',
        'Nicaragua': '🇮',
        'Costa Rica': '🇨🇷',
        'Panamá': '🇵',
        'Uruguay': '🇺🇾',
        'Brasil': '🇷'
    };

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
            console.log('🔍 Buscando estadísticas para:', user.id);
            
            const { data: stats, error } = await db
                .from('estadisticas_bochador')
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
                    precision_promedio: 0,
                    lanzamientos_oficiales: 0,
                    boches_clavao: 0,
                    eventos_disputados: 0,
                    victorias: 0,
                    derrotas: 0,
                    empates: 0,
                    puntos_totales: 0,
                    ranking_nacional: 0,
                    nivel: 'principiante'
                };
                
                const { data: creada, error: insertError } = await db
                    .from('estadisticas_bochador')
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

    function mostrarAvatarPerfil(nombre, avatarUrl) {
        if (avatarUrl) {
            profileAvatarContainer.innerHTML = `<img src="${avatarUrl}" alt="Avatar" class="profile-avatar-large">`;
        } else {
            const inicial = (nombre || 'U').charAt(0).toUpperCase();
            profileAvatarContainer.innerHTML = `<div class="profile-avatar-placeholder">${inicial}</div>`;
        }
    }

    function obtenerBandera(pais) {
        return countryFlags[pais] || '🏳️';
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

    window.verRanking = function() {
        alert('🚧 El ranking nacional estará disponible próximamente. ¡Mantente atento!');
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
                alert('Debes tener tu KYC verificado para acceder al Dashboard del Bochador.');
                window.location.href = 'perfil.html';
                return;
            }

            const nombre = perfil.nombre || user.user_metadata?.nombre || user.user_metadata?.full_name || 'Usuario';
            const email = user.email;
            saldoBC = perfil.saldo_bc || 0;
            const nacionalidad = perfil.nacionalidad || '';

            profileName.textContent = nombre;
            dropdownUserName.textContent = nombre;
            dropdownUserEmail.textContent = email;
            balanceAmount.textContent = `${saldoBC.toFixed(2)} BC`;

            const avatarUrl = perfil.avatar_url || user.user_metadata?.avatar_url;
            mostrarAvatarNavbar(nombre, avatarUrl);
            mostrarAvatarPerfil(nombre, avatarUrl);

            profileFlag.textContent = obtenerBandera(nacionalidad);

            const stats = await cargarOCrearEstadisticas(user);
            estadisticas = stats;

            if (stats) {
                rankingNumber.textContent = stats.ranking_nacional > 0 ? `#${stats.ranking_nacional}` : '#--';
                statPrecision.textContent = `${stats.precision_promedio.toFixed(2)}%`;
                statLanzamientos.textContent = stats.lanzamientos_oficiales.toLocaleString();
                statBoches.textContent = stats.boches_clavao.toLocaleString();
                statEventos.textContent = stats.eventos_disputados.toLocaleString();
                statVictorias.textContent = stats.victorias.toLocaleString();
                statDerrotas.textContent = stats.derrotas.toLocaleString();
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
