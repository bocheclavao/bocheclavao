document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    let currentUser = null;
    
    if (!db) {
        console.error('No se pudo obtener el cliente de Supabase');
        return;
    }

    // 📌 REFERENCIAS AL DOM
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
    const notificationDropdown = document.getElementById('notificationDropdown');
    const notificationBtn = document.getElementById('notificationBtn');
    const mobileOverlay = document.getElementById('mobileOverlay');

    let estadoKyc = null;
    let saldoBC = 0;

    // ============================================
    // 🚀 1. MENÚS MÓVILES
    // ============================================
    function sacarMenusDelNavbar() {
        if (window.innerWidth <= 768) {
            if (dropdownMenu && dropdownMenu.parentElement !== document.body) {
                document.body.appendChild(dropdownMenu);
            }
            if (notificationDropdown && notificationDropdown.parentElement !== document.body) {
                document.body.appendChild(notificationDropdown);
            }
        }
    }
    sacarMenusDelNavbar();
    window.addEventListener('resize', sacarMenusDelNavbar);

    // ============================================
    // 👤 2. FUNCIONES DE PERFIL
    // ============================================
    function generarIdUnico() { 
        return 'BC-' + Math.floor(10000000 + Math.random() * 90000000).toString(); 
    }

    async function cargarOCrearPerfil(user) {
        try {
            const { data: perfil, error } = await db.from('perfiles').select('*').eq('id', user.id).single();
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
                const { data: creado, error: insertError } = await db.from('perfiles').insert(nuevoPerfil).select().single();
                if (insertError) { console.error('Error al crear perfil:', insertError); return null; }
                return creado;
            }
            return null;
        } catch (err) { console.error('Error en cargarOCrearPerfil:', err); return null; }
    }

    async function verificarSiEsAdmin(userId) {
        try {
            // Intentar primero con la columna 'id'
            let { data, error } = await db.from('admin_roles')
                .select('es_admin, activo')
                .eq('id', userId)
                .eq('es_admin', true)
                .eq('activo', true)
                .maybeSingle();
            
            // Si no encuentra, intentar con 'user_id' (respaldo)
            if (!data) {
                const res2 = await db.from('admin_roles')
                    .select('es_admin, activo')
                    .eq('user_id', userId)
                    .eq('es_admin', true)
                    .eq('activo', true)
                    .maybeSingle();
                data = res2.data;
            }
            
            if (error || !data) return false;
            return true;
        } catch (err) { 
            console.error('Error verificando admin:', err);
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
        if (divider) dropdownMenu.insertBefore(adminItem, divider);
        else dropdownMenu.appendChild(adminItem);
    }

    // ============================================
    // 📱 3. MENÚS MÓVILES (INTERACCIÓN)
    // ============================================
    window.cerrarPanelesMovil = function() {
        if (dropdownMenu) {
            dropdownMenu.classList.remove('show');
            dropdownMenu.style.transform = '';
            dropdownMenu.style.opacity = '';
            dropdownMenu.style.visibility = '';
        }
        if (notificationDropdown) {
            notificationDropdown.classList.remove('show');
            notificationDropdown.style.transform = '';
            notificationDropdown.style.opacity = '';
            notificationDropdown.style.visibility = '';
        }
        if (mobileOverlay) mobileOverlay.classList.remove('active');
        if (menuToggle) menuToggle.classList.remove('active');
        if (notificationBtn) notificationBtn.classList.remove('active');

        document.body.classList.remove('menu-open');
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        
        const scrollY = parseInt(document.body.dataset.scrollPos || '0');
        window.scrollTo(0, scrollY);
    };

    function bloquearScrollFondo() {
        const scrollY = window.scrollY;
        document.body.classList.add('menu-open');
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';
        document.body.style.overflow = 'hidden';
        document.body.dataset.scrollPos = scrollY;
    }

    function forzarVisibilidadMenu(elemento) {
        if (!elemento) return;
        elemento.style.transform = '';
        elemento.style.opacity = '';
        elemento.style.visibility = '';
        elemento.style.display = '';
        void elemento.offsetHeight;
        elemento.classList.add('show');
        setTimeout(() => {
            elemento.style.transform = 'translateY(0) translateZ(0)';
            elemento.style.opacity = '1';
            elemento.style.visibility = 'visible';
            elemento.style.pointerEvents = 'auto';
        }, 10);
    }

    window.toggleMenu = function(event) {
        if (event) { event.preventDefault(); event.stopPropagation(); }
        if (notificationDropdown && notificationDropdown.classList.contains('show')) {
            notificationDropdown.classList.remove('show');
        }
        const isShowing = dropdownMenu.classList.contains('show');
        if (isShowing) { cerrarPanelesMovil(); } 
        else {
            bloquearScrollFondo();
            forzarVisibilidadMenu(dropdownMenu);
            if (menuToggle) menuToggle.classList.add('active');
            if (mobileOverlay) mobileOverlay.classList.add('active');
        }
    };

    window.toggleNotifications = function(event) {
        if (event) { event.preventDefault(); event.stopPropagation(); }
        if (dropdownMenu && dropdownMenu.classList.contains('show')) {
            dropdownMenu.classList.remove('show');
        }
        const isShowing = notificationDropdown.classList.contains('show');
        if (isShowing) { cerrarPanelesMovil(); } 
        else {
            bloquearScrollFondo();
            forzarVisibilidadMenu(notificationDropdown);
            if (notificationBtn) notificationBtn.classList.add('active');
            if (mobileOverlay) mobileOverlay.classList.add('active');
        }
    };

    if (notificationBtn) {
        notificationBtn.onclick = null;
        notificationBtn.addEventListener('click', toggleNotifications);
    }
    if (menuToggle) {
        menuToggle.onclick = null;
        menuToggle.addEventListener('click', toggleMenu);
    }
    
    document.querySelectorAll('.panel-close-btn').forEach(btn => {
        btn.addEventListener('click', window.cerrarPanelesMovil);
    });
    
    if (mobileOverlay) {
        mobileOverlay.addEventListener('click', window.cerrarPanelesMovil);
        mobileOverlay.addEventListener('touchstart', window.cerrarPanelesMovil);
    }

    document.addEventListener('click', function(event) {
        if (window.innerWidth > 768) {
            const menuContainer = document.querySelector('.user-menu-container');
            if (menuContainer && !menuContainer.contains(event.target) && dropdownMenu) {
                dropdownMenu.classList.remove('show');
                if (menuToggle) menuToggle.classList.remove('active');
            }
            const notifContainer = notificationBtn?.parentElement;
            if (notifContainer && !notifContainer.contains(event.target) && notificationDropdown) {
                notificationDropdown.classList.remove('show');
                if (notificationBtn) notificationBtn.classList.remove('active');
            }
        }
    });

    // ============================================
    // 🔗 4. NAVEGACIÓN
    // ============================================
    window.irAPerfil = function() { window.location.href = 'perfil.html'; };
    window.irABilletera = function() { window.location.href = 'billetera.html'; };
    window.irAApuestas = function() { alert('Mis apuestas estará disponible próximamente'); };
    window.irASoporte = function() { alert('Soporte estará disponible próximamente'); };
    window.irAConfiguracion = function() { alert('Configuración estará disponible próximamente'); };

    // ============================================
    // 📺 5. STREAM EN VIVO
    // ============================================
    async function cargarStreamEnVivo() {
        try {
            const { data: streamConfig, error } = await db.from('config_stream_vivo').select('*').eq('activo', true).single();
            const liveSection = document.getElementById('liveStreamSection');
            const liveBadgeContainer = document.getElementById('liveBadgeContainer');
            const videoPlaceholder = document.getElementById('videoPlaceholder');
            const liveVideo = document.getElementById('liveVideo');
            const liveIframe = document.getElementById('liveIframe');
            const liveInfo = document.getElementById('liveInfo');
            const liveTitle = document.getElementById('liveTitle');
            const liveDescription = document.getElementById('liveDescription');

            if (error || !streamConfig || !streamConfig.activo) {
                liveSection.classList.remove('active'); 
                videoPlaceholder.style.display = 'flex';
                liveVideo.style.display = 'none'; 
                liveIframe.style.display = 'none';
                liveInfo.style.display = 'none'; 
                liveBadgeContainer.innerHTML = ''; 
                return;
            }

            liveSection.classList.add('active'); 
            videoPlaceholder.style.display = 'none';
            liveInfo.style.display = 'block'; 
            liveTitle.textContent = streamConfig.titulo || 'Transmisión en Vivo';
            liveDescription.textContent = streamConfig.descripcion || 'Evento en vivo';
            liveBadgeContainer.innerHTML = `<div class="live-badge"><div class="live-dot"></div> EN VIVO</div>${streamConfig.espectadores ? `<div class="live-viewers"><i class="fas fa-eye"></i> ${streamConfig.espectadores} espectadores</div>` : ''}`;
            liveVideo.style.display = 'none'; 
            liveIframe.style.display = 'none';

            if (streamConfig.url_stream.includes('youtube.com') || streamConfig.url_stream.includes('youtu.be')) {
                liveIframe.style.display = 'block'; 
                let embedUrl = streamConfig.url_stream;
                if (embedUrl.includes('/live/') || embedUrl.includes('/watch?v=')) {
                    const videoId = embedUrl.split('/live/')[1]?.split('?')[0] || embedUrl.split('v=')[1]?.split('&')[0];
                    if (videoId) embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
                }
                liveIframe.src = embedUrl;
            } else if (streamConfig.tipo_stream === 'hls' && streamConfig.url_stream) {
                liveVideo.style.display = 'block';
                if (typeof Hls !== 'undefined' && Hls.isSupported()) {
                    const hls = new Hls(); 
                    hls.loadSource(streamConfig.url_stream); 
                    hls.attachMedia(liveVideo);
                    hls.on(Hls.Events.MANIFEST_PARSED, function() { 
                        liveVideo.play().catch(e => console.log('Autoplay bloqueado:', e)); 
                    });
                } else if (liveVideo.canPlayType('application/vnd.apple.mpegurl')) {
                    liveVideo.src = streamConfig.url_stream;
                    liveVideo.addEventListener('loadedmetadata', function() { 
                        liveVideo.play().catch(e => console.log('Autoplay bloqueado:', e)); 
                    });
                }
            } else {
                liveIframe.style.display = 'block'; 
                liveIframe.src = streamConfig.url_stream;
            }
        } catch (err) { console.error('Error cargando stream en vivo:', err); }
    }

    // ============================================
    // 🛡️ 6. KYC Y AVATAR
    // ============================================
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
            kycMessage.textContent = 'Para participar como Bochador o Patrocinador, debes completar tu verificación de identidad (KYC).';
            kycBtn.innerHTML = '<i class="fas fa-user-check"></i> Completar KYC ahora'; 
            kycBtn.style.pointerEvents = 'auto'; 
            kycBtn.style.opacity = '1'; 
            kycBtn.style.background = '';
            kycBtn.onclick = function() { window.location.href = 'perfil.html'; };
            cardBochador.classList.add('disabled'); 
            cardPatrocinador.classList.add('disabled');
        } else if (estado === 'pendiente' || estado === 'revision') {
            kycBanner.classList.remove('verified', 'rejected'); 
            kycBanner.style.borderColor = '#FFA500';
            kycTitle.textContent = '⏳ Verificación KYC en Revisión'; 
            kycMessage.textContent = 'Tus documentos están siendo revisados.';
            kycBtn.innerHTML = '<i class="fas fa-hourglass-half"></i> En Revisión'; 
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
            kycMessage.textContent = 'Tus documentos no fueron aprobados. Vuelve a enviarla.';
            kycBtn.innerHTML = '<i class="fas fa-redo"></i> Reintentar'; 
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
            navAvatarContainer.innerHTML = `<img src="${avatarUrl}" alt="Avatar" class="user-avatar-small">`;
        } else {
            const inicial = (nombre || 'U').charAt(0).toUpperCase();
            navAvatarContainer.innerHTML = `<div class="avatar-placeholder-small">${inicial}</div>`;
        }
    }

    function mostrarDatos(user, perfil) {
        const nombre = perfil?.nombre || user.user_metadata?.nombre || user.user_metadata?.full_name || 'Usuario';
        const email = user.email;
        const userId = perfil?.user_id || generarIdUnico();
        const avatarUrl = perfil?.avatar_url || user.user_metadata?.avatar_url;
        const estado = (perfil?.estado_kyc || '').toString().toLowerCase().trim(); // Normalizado
        saldoBC = perfil?.saldo_bc ?? 0;

        userNameDisplay.textContent = nombre; 
        userEmailDisplay.textContent = email;
        
        // ✅ ESTADO DE VERIFICACIÓN CLARO AL LADO DEL ID
        if (estado === 'verificado') {
            userIdDisplay.innerHTML = `ID: ${userId} <i class="fas fa-check-circle" style="color: #00ff00; margin-left: 8px; font-size: 0.9rem;"></i> <span style="color: #00ff00; font-size: 0.75rem; font-weight: 700; margin-left: 5px;">Verificado</span>`;
        } else if (estado === 'pendiente' || estado === 'revision') {
            userIdDisplay.innerHTML = `ID: ${userId} <i class="fas fa-clock" style="color: #FFA500; margin-left: 8px; font-size: 0.9rem;"></i> <span style="color: #FFA500; font-size: 0.75rem; font-weight: 700; margin-left: 5px;">En Revisión</span>`;
        } else {
            userIdDisplay.innerHTML = `ID: ${userId} <i class="fas fa-exclamation-circle" style="color: #ff4444; margin-left: 8px; font-size: 0.9rem;"></i> <span style="color: #ff4444; font-size: 0.75rem; font-weight: 700; margin-left: 5px;">Pendiente</span>`;
        }
        
        dropdownUserName.textContent = nombre; 
        dropdownUserEmail.textContent = email;
        balanceAmount.textContent = `${parseFloat(saldoBC).toFixed(2)} PP`; // Unificado a PP como solicitaste

        if (avatarUrl) { 
            avatarImage.src = avatarUrl; 
            avatarImage.style.display = 'block'; 
            avatarPlaceholder.style.display = 'none'; 
        } else { 
            avatarPlaceholder.textContent = nombre.charAt(0).toUpperCase(); 
            avatarPlaceholder.style.display = 'flex'; 
            avatarImage.style.display = 'none'; 
        }

        mostrarAvatarNavbar(nombre, avatarUrl);
        
        // ✅ CORRECCIÓN CRÍTICA: Ahora SÍ se llama a la función para mostrar/ocultar el banner
        actualizarBannerKYC(estado);

        verificarSiEsAdmin(user.id).then(esAdmin => { 
            if (esAdmin) agregarBotonAdmin(); 
        });
    }

    window.seleccionarRol = function(rol) {
        if (estadoKyc !== 'verificado') {
            // Usamos el modal profesional en lugar de alert() si está disponible, o alert como fallback
            if (typeof window.mostrarModalKYC === 'function') {
                window.mostrarModalKYC();
            } else {
                alert('Debes completar y ser aprobado en la verificación KYC antes de poder participar.');
            }
            return;
        }
        if (rol === 'bochador') window.location.href = 'dashboard-bochador.html';
        else if (rol === 'patrocinador') window.location.href = 'dashboard-patrocinador.html';
    };

    // ============================================
    // 🔒 7. PROTEGER RUTA (Limpia y optimizada)
    // ============================================
    async function protegerRuta() {
        try {
            const { data: { session }, error: sessionError } = await db.auth.getSession();
            
            if (sessionError) console.error('Error de sesión:', sessionError);

            if (!session || !session.user) { 
                console.warn('⚠️ No hay sesión activa, redirigiendo al login...');
                window.location.href = 'index.html'; 
                return; 
            }

            const user = session.user;
            currentUser = user;

            // 🛡️ VERIFICAR BLOQUEO PERMANENTE
            const { data: perfil, error: perfilError } = await db
                .from('perfiles')
                .select('bloqueado, motivo_bloqueo')
                .eq('id', user.id)
                .maybeSingle();

            if (perfilError) console.warn('⚠️ No se pudo verificar el estado de bloqueo:', perfilError.message);

            if (perfil && perfil.bloqueado === true) {
                console.warn(`🚫 Acceso denegado: Cuenta bloqueada (${user.email})`);
                await db.auth.signOut({ scope: 'global' });
                localStorage.removeItem('session_token');
                
                const motivo = perfil.motivo_bloqueo || 'Violación de las políticas de la plataforma.';
                sessionStorage.setItem('auth_message', `🚫 <strong>TU CUENTA HA SIDO BLOQUEADA PERMANENTEMENTE</strong><br><br>Motivo: ${motivo}<br><br>Contacta a soporte si crees que esto es un error.`);
                sessionStorage.setItem('auth_type', 'error');
                
                window.location.href = 'index.html';
                return; 
            }

            // ✅ CARGA NORMAL DEL DASHBOARD
            const perfilCompleto = await cargarOCrearPerfil(user);
            estadoKyc = (perfilCompleto?.estado_kyc || '').toString().toLowerCase().trim();
            
            mostrarDatos(user, perfilCompleto);
            
            try {
                await cargarStreamEnVivo();
            } catch (streamErr) {
                console.warn('⚠️ Error cargando stream:', streamErr.message);
            }

            if (loadingState) loadingState.style.display = 'none';
            if (contentState) contentState.style.display = 'block';
            
            // Iniciar Realtime después de cargar
            iniciarRealtime();
            
        } catch (err) {
            console.error('❌ Error crítico en la guardia de seguridad:', err);
            if (loadingState) loadingState.style.display = 'none';
            if (errorState) {
                errorState.style.display = 'block';
                errorState.innerHTML = `<i class="fas fa-exclamation-triangle"></i><p>Error al cargar el dashboard. <br><small>${err.message}</small></p>`;
            }
            if (err.message && err.message.toLowerCase().includes('session')) {
                setTimeout(() => { window.location.href = 'index.html'; }, 3000);
            }
        }
    }

    protegerRuta();
});

// ============================================
// 🚪 CERRAR SESIÓN
// ============================================
async function cerrarSesion() {
    const db = window.supabaseClient;
    if (!db) return;
    try {
        const { error } = await db.auth.signOut({ scope: 'global' });
        if (error) throw error;
        localStorage.removeItem('session_token');
        window.location.href = 'index.html';
    } catch (err) {
        console.error('Error al cerrar sesión:', err);
        alert('Hubo un error al cerrar sesión.');
    }
}

// ============================================
// ⚡ 8. SUSCRIPCIÓN EN TIEMPO REAL (SUPABASE)
// ============================================
function iniciarRealtime() {
    if (!currentUser) {
        console.warn('⚠️ No se pudo iniciar Realtime: currentUser es null');
        return;
    }

    // 1. Escuchar cambios en el saldo del usuario
    const channelSaldo = db.channel('saldo_updates')
        .on('postgres_changes', 
            { event: 'UPDATE', schema: 'public', table: 'perfiles', filter: `id=eq.${currentUser.id}` }, 
            (payload) => {
                const nuevoSaldo = payload.new.saldo_bc ?? 0;
                const balanceEl = document.getElementById('balanceAmount');
                if (balanceEl) {
                    balanceEl.textContent = `${parseFloat(nuevoSaldo).toFixed(2)} PP`;
                }
                console.log('💰 Saldo actualizado en tiempo real:', nuevoSaldo);
            }
        )
        .subscribe();

    // 2. Escuchar nuevas notificaciones
    const channelNotif = db.channel('notificaciones_updates')
        .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `user_id=eq.${currentUser.id}` },
            (payload) => {
                console.log('🔔 Nueva notificación recibida:', payload.new);
                // Aquí puedes agregar lógica para actualizar el badge de notificaciones
            }
        )
        .subscribe();
}
