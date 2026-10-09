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
    const navAvatarContainer = document.getElementById('navAvatarContainer');
    const kycBanner = document.getElementById('kycBanner');
    const kycTitle = document.getElementById('kycTitle');
    const kycMessage = document.getElementById('kycMessage');
    const kycBtn = document.getElementById('kycBtn');
    const cardBochador = document.getElementById('cardBochador');
    const cardPatrocinador = document.getElementById('cardPatrocinador');
    const balanceAmount = document.getElementById('balanceAmount');
    const dropdownUserName = document.getElementById('dropdownUserName');
    const dropdownUserEmail = document.getElementById('dropdownUserEmail');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const menuToggle = document.getElementById('menuToggle');

    let estadoKyc = null;
    let saldoBC = 0;

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

    function generarIdUnico() {
        return 'BC-' + Math.floor(10000000 + Math.random() * 90000000).toString();
    }

    async function cargarOCrearPerfil(user) {
        try {
            const { data: perfil, error } = await db
                .from('perfiles')
                .select('*')
                .eq('id', user.id)
                .single();
            
            if (perfil) return perfil;
            
            if (error && error.code === 'PGRST116') {
                const nuevoPerfil = {
                    id: user.id,
                    user_id: generarIdUnico(),
                    nombre: user.user_metadata?.nombre || user.user_metadata?.full_name || 'Usuario',
                    email: user.email,
                    avatar_url: user.user_metadata?.avatar_url || null,
                    saldo_bc: 0,
                    estado_kyc: null
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
                return creado;
            }
            return null;
        } catch (err) {
            console.error('Error en cargarOCrearPerfil:', err);
            return null;
        }
    }

    async function verificarSiEsAdmin(userId, userEmail) {
        try {
            const { data, error } = await db
                .from('admin_roles')
                .select('es_admin, activo')
                .eq('id', userId)
                .eq('es_admin', true)
                .eq('activo', true)
                .single();

            if (error || !data) return false;
            return true;
        } catch (err) {
            return false;
        }
    }

    function agregarBotonAdmin() {
        if (!dropdownMenu || document.getElementById('adminMenuItem')) return;

        const adminItem = document.createElement('button');
        adminItem.id = 'adminMenuItem';
        adminItem.className = 'dropdown-item';
        adminItem.onclick = function() { window.location.href = 'admin.html'; };
        adminItem.innerHTML = '<i class="fas fa-user-shield"></i><span>Panel Admin</span>';
        
        const divider = dropdownMenu.querySelector('.dropdown-divider');
        if (divider) {
            dropdownMenu.insertBefore(adminItem, divider);
        } else {
            dropdownMenu.appendChild(adminItem);
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

    window.irAPerfil = function() { window.location.href = 'perfil.html'; };
    window.irABilletera = function() { alert('La billetera estará disponible próximamente'); };
    window.irAApuestas = function() { alert('Mis apuestas estará disponible próximamente'); };
    window.irASoporte = function() { alert('Soporte estará disponible próximamente'); };
    window.irAConfiguracion = function() { alert('Configuración estará disponible próximamente'); };
    window.irADepositar = function() { alert('El sistema de depósitos estará disponible próximamente'); };

         async function cargarStreamEnVivo() {
        console.log('🔄 Cargando stream en vivo...');
        try {
            const { data: streamConfig, error } = await db
                .from('config_stream_vivo')
                .select('*')
                .eq('activo', true)
                .single();

            const liveSection = document.getElementById('liveStreamSection');
            const liveBadgeContainer = document.getElementById('liveBadgeContainer');
            const videoPlaceholder = document.getElementById('videoPlaceholder');
            const liveVideo = document.getElementById('liveVideo');
            const liveIframe = document.getElementById('liveIframe');
            const liveInfo = document.getElementById('liveInfo');
            const liveTitle = document.getElementById('liveTitle');
            const liveDescription = document.getElementById('liveDescription');

            if (error || !streamConfig || !streamConfig.activo) {
                console.log('⚠️ No hay stream activo');
                liveSection.classList.remove('active');
                videoPlaceholder.style.display = 'flex';
                liveVideo.style.display = 'none';
                liveIframe.style.display = 'none';
                liveInfo.style.display = 'none';
                liveBadgeContainer.innerHTML = '';
                return;
            }

            console.log('✅ Stream activo encontrado:', streamConfig);

            liveSection.classList.add('active');
            videoPlaceholder.style.display = 'none';
            liveInfo.style.display = 'block';
            liveTitle.textContent = streamConfig.titulo || 'Transmisión en Vivo';
            liveDescription.textContent = streamConfig.descripcion || 'Evento en vivo';

            liveBadgeContainer.innerHTML = `
                <div class="live-badge">
                    <div class="live-dot"></div>
                    EN VIVO
                </div>
                ${streamConfig.espectadores ? `<div class="live-viewers"><i class="fas fa-eye"></i> ${streamConfig.espectadores} espectadores</div>` : ''}
            `;

            // Ocultar ambos primero
            liveVideo.style.display = 'none';
            liveIframe.style.display = 'none';

            // 🛡️ MEJORA: Detectar automáticamente si es YouTube aunque hayan seleccionado HLS por error
            if (streamConfig.url_stream.includes('youtube.com') || streamConfig.url_stream.includes('youtu.be')) {
                console.log('📺 Detectado enlace de YouTube, forzando modo Embed automáticamente');
                liveIframe.style.display = 'block';
                
                let embedUrl = streamConfig.url_stream;
                // Convertir URL de watch/live a embed si es necesario
                if (embedUrl.includes('/live/') || embedUrl.includes('/watch?v=')) {
                    const videoId = embedUrl.split('/live/')[1]?.split('?')[0] || embedUrl.split('v=')[1]?.split('&')[0];
                    if (videoId) {
                        embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
                    }
                }
                liveIframe.src = embedUrl;
                
            } else if (streamConfig.tipo_stream === 'youtube' && streamConfig.url_stream) {
                console.log('📺 Cargando YouTube (configurado):', streamConfig.url_stream);
                liveIframe.style.display = 'block';
                liveIframe.src = streamConfig.url_stream;
                
            } else if (streamConfig.tipo_stream === 'twitch' && streamConfig.url_stream) {
                console.log('🎮 Cargando Twitch:', streamConfig.url_stream);
                liveIframe.style.display = 'block';
                liveIframe.src = streamConfig.url_stream;
                
            } else if (streamConfig.tipo_stream === 'hls' && streamConfig.url_stream) {
                console.log('📡 Cargando HLS:', streamConfig.url_stream);
                liveVideo.style.display = 'block';
                
                if (typeof Hls !== 'undefined' && Hls.isSupported()) {
                    const hls = new Hls();
                    hls.loadSource(streamConfig.url_stream);
                    hls.attachMedia(liveVideo);
                    hls.on(Hls.Events.MANIFEST_PARSED, function() {
                        liveVideo.play().catch(e => console.log('Autoplay bloqueado por el navegador:', e));
                    });
                } else if (liveVideo.canPlayType('application/vnd.apple.mpegurl')) {
                    liveVideo.src = streamConfig.url_stream;
                    liveVideo.addEventListener('loadedmetadata', function() {
                        liveVideo.play().catch(e => console.log('Autoplay bloqueado por el navegador:', e));
                    });
                }
            }

        } catch (err) {
            console.error('❌ Error cargando stream en vivo:', err);
        }
    }
    function actualizarBannerKYC(estado) {
        if (estado === 'verificado') {
            kycBanner.style.display = 'none';
            cardBochador.classList.remove('disabled');
            cardPatrocinador.classList.remove('disabled');
            return;
        }
        
        kycBanner.style.display = 'flex';
        
        if (estado === null || estado === undefined || estado === '') {
            kycBanner.classList.remove('verified', 'rejected');
            kycBanner.style.borderColor = '#FFD700';
            kycTitle.textContent = '⚠️ Verificación KYC Pendiente';
            kycMessage.textContent = 'Para participar como Bochador o Patrocinador, debes completar tu verificación de identidad (KYC). Es rápido y seguro.';
            kycBtn.innerHTML = '<i class="fas fa-user-check"></i> Completar KYC ahora';
            kycBtn.style.pointerEvents = 'auto';
            kycBtn.style.opacity = '1';
            kycBtn.style.background = '';
            kycBtn.onclick = function() { window.location.href = 'perfil.html'; };
            
            cardBochador.classList.add('disabled');
            cardPatrocinador.classList.add('disabled');
            
        } else if (estado === 'pendiente') {
            kycBanner.classList.remove('verified', 'rejected');
            kycBanner.style.borderColor = '#FFA500';
            kycTitle.textContent = '⏳ Verificación KYC en Revisión';
            kycMessage.textContent = 'Tus documentos han sido enviados y están siendo revisados por nuestro equipo. Recibirás una notificación cuando sean aprobados. Este proceso puede tomar hasta 24 horas.';
            kycBtn.innerHTML = '<i class="fas fa-hourglass-half"></i> En Revisión - Espere Aprobación';
            kycBtn.style.pointerEvents = 'none';
            kycBtn.style.opacity = '0.6';
            kycBtn.style.background = '#666';
            kycBtn.onclick = null;
            
            cardBochador.classList.add('disabled');
            cardPatrocinador.classList.add('disabled');
            
        } else if (estado === 'rechazado') {
            kycBanner.classList.add('rejected');
            kycBanner.classList.remove('verified');
            kycTitle.textContent = '❌ Verificación KYC Rechazada';
            kycMessage.textContent = 'Tus documentos no fueron aprobados. Por favor, revisa la información y vuelve a enviarla para ser verificado.';
            kycBtn.innerHTML = '<i class="fas fa-redo"></i> Reintentar Verificación';
            kycBtn.style.pointerEvents = 'auto';
            kycBtn.style.opacity = '1';
            kycBtn.style.background = '';
            kycBtn.onclick = function() { window.location.href = 'perfil.html'; };
            
            cardBochador.classList.add('disabled');
            cardPatrocinador.classList.add('disabled');
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

    function mostrarDatos(user, perfil) {
        const nombre = perfil?.nombre || user.user_metadata?.nombre || user.user_metadata?.full_name || 'Usuario';
        const email = user.email;
        const userId = perfil?.user_id || generarIdUnico();
        const avatarUrl = perfil?.avatar_url || user.user_metadata?.avatar_url;
        const estado = perfil?.estado_kyc || null;
        saldoBC = perfil?.saldo_bc || 0;

        userNameDisplay.textContent = nombre;
        userEmailDisplay.textContent = email;
        
        if (estado === 'verificado') {
            userIdDisplay.innerHTML = `ID: ${userId} <i class="fas fa-check-circle" style="color: #00ff00; margin-left: 8px; font-size: 0.9rem;"></i> <span style="color: #00ff00; font-size: 0.75rem; font-weight: 700; margin-left: 5px;">Verificado</span>`;
        } else {
            userIdDisplay.textContent = `ID: ${userId}`;
        }
        
        dropdownUserName.textContent = nombre;
        dropdownUserEmail.textContent = email;
        balanceAmount.textContent = `${saldoBC.toFixed(2)} BC`;

        if (avatarUrl) {
            avatarImage.src = avatarUrl;
            avatarImage.style.display = 'block';
            avatarPlaceholder.style.display = 'none';
        } else {
            const inicial = nombre.charAt(0).toUpperCase();
            avatarPlaceholder.textContent = inicial;
            avatarPlaceholder.style.display = 'flex';
            avatarImage.style.display = 'none';
        }

        mostrarAvatarNavbar(nombre, avatarUrl);
        actualizarBannerKYC(estado);

        verificarSiEsAdmin(user.id, email).then(esAdmin => {
            if (esAdmin) agregarBotonAdmin();
        });
    }

    window.seleccionarRol = function(rol) {
        if (estadoKyc !== 'verificado') {
            alert('Debes completar y ser aprobado en la verificación KYC antes de poder participar.');
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
            estadoKyc = perfil?.estado_kyc || null;
            mostrarDatos(user, perfil);
            
            // 🎥 Cargar stream en vivo
            await cargarStreamEnVivo();
            
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
