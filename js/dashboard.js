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
    const kycBanner = document.getElementById('kycBanner');
    const kycTitle = document.getElementById('kycTitle');
    const kycMessage = document.getElementById('kycMessage');
    const kycBtn = document.getElementById('kycBtn');
    const cardBochador = document.getElementById('cardBochador');
    const cardPatrocinador = document.getElementById('cardPatrocinador');

    let estadoKyc = 'pendiente';

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
            
            const { data: perfil, error } = await db
                .from('perfiles')
                .select('*')
                .eq('id', user.id)
                .single();
            
            if (perfil) {
                console.log('Perfil encontrado:', perfil.user_id);
                return perfil;
            }
            
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

    // Actualizar banner KYC según estado
    function actualizarBannerKYC(estado) {
        estadoKyc = estado;
        
        if (estado === 'verificado') {
            kycBanner.classList.add('verified');
            kycBanner.classList.remove('rejected');
            kycTitle.textContent = '✅ Verificación KYC Completada';
            kycMessage.textContent = 'Tu identidad ha sido verificada. Ya puedes participar como Bochador o Patrocinador.';
            kycBtn.innerHTML = '<i class="fas fa-check-circle"></i> KYC Verificado';
            kycBtn.style.pointerEvents = 'none';
            kycBtn.style.opacity = '0.7';
            
            // Habilitar tarjetas de rol
            cardBochador.classList.remove('disabled');
            cardPatrocinador.classList.remove('disabled');
            
        } else if (estado === 'rechazado') {
            kycBanner.classList.add('rejected');
            kycBanner.classList.remove('verified');
            kycTitle.textContent = '❌ Verificación KYC Rechazada';
            kycMessage.textContent = 'Tus documentos no fueron aprobados. Por favor, revisa la información y vuelve a intentarlo.';
            kycBtn.innerHTML = '<i class="fas fa-redo"></i> Reintentar KYC';
            kycBtn.style.pointerEvents = 'auto';
            kycBtn.style.opacity = '1';
            
            // Deshabilitar tarjetas de rol
            cardBochador.classList.add('disabled');
            cardPatrocinador.classList.add('disabled');
            
        } else {
            // Pendiente
            kycBanner.classList.remove('verified', 'rejected');
            kycTitle.textContent = '⚠️ Verificación KYC Pendiente';
            kycMessage.textContent = 'Para participar como Bochador o Patrocinador, debes completar tu verificación de identidad (KYC). Es rápido y seguro.';
            kycBtn.innerHTML = '<i class="fas fa-user-check"></i> Completar KYC ahora';
            kycBtn.style.pointerEvents = 'auto';
            kycBtn.style.opacity = '1';
            
            // Deshabilitar tarjetas de rol
            cardBochador.classList.add('disabled');
            cardPatrocinador.classList.add('disabled');
        }
    }

    // Mostrar datos en la pantalla
    function mostrarDatos(user, perfil) {
        const nombre = perfil?.nombre || user.user_metadata?.nombre || user.user_metadata?.full_name || 'Usuario';
        const email = user.email;
        const userId = perfil?.user_id || generarIdUnico();
        const avatarUrl = perfil?.avatar_url || user.user_metadata?.avatar_url;
        const estado = perfil?.estado_kyc || 'pendiente';

        userNameDisplay.textContent = nombre;
        userEmailDisplay.textContent = email;
        userIdDisplay.textContent = `ID: ${userId}`;

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

        // Actualizar banner KYC
        actualizarBannerKYC(estado);
    }

    // Función global para seleccionar rol
    window.seleccionarRol = function(rol) {
        if (estadoKyc !== 'verificado') {
            alert('Debes completar la verificación KYC antes de poder participar. Serás redirigido a tu perfil.');
            window.location.href = 'perfil.html';
            return;
        }
        
        if (rol === 'bochador') {
            window.location.href = 'dashboard-bochador.html';
        } else if (rol === 'patrocinador') {
            window.location.href = 'dashboard-patrocinador.html';
        }
    };

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

            const perfil = await cargarOCrearPerfil(user);
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
