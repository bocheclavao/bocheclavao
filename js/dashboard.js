document.addEventListener('DOMContentLoaded', async function() {
  const db = window.supabaseClient;
  if (!db) { window.location.href = 'index.html'; return; }
  
  const { data: { session } } = await db.auth.getSession();
  if (!session || !session.user) { window.location.href = 'index.html'; return; }

  // Funciones auxiliares seguras para evitar errores si falta un ID
  const safeSetText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  const safeSetHTML = (id, html) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  };

  try {
    // 1. Obtener perfil del usuario
    const { data: perfil, error } = await db
      .from('perfiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (error || !perfil) throw new Error('No se pudo cargar el perfil.');

    // 2. Procesar y renderizar datos básicos
    const nombre = perfil.nombre || 'Usuario';
    const userId = perfil.user_id || 'N/A';
    const email = session.user.email;
    const balance = typeof perfil.balance === 'number' ? perfil.balance : 0;
    const estadoKyc = perfil.estado_kyc || 'pendiente';

    safeSetText('userNameDisplay', nombre);
    safeSetText('userIdDisplay', `ID: ${userId}`);
    safeSetText('userEmailDisplay', email);
    safeSetText('balanceAmount', `${balance.toFixed(2)} BC`);
    
    // Dropdown del menú de usuario
    safeSetText('dropdownUserName', nombre);
    safeSetText('dropdownUserEmail', email);

    // 3. Renderizar Avatar (Principal y Navbar)
    const avatarUrl = perfil.avatar_url || session.user.user_metadata?.avatar_url;
    const avatarImg = document.getElementById('avatarImage');
    const avatarPlaceholder = document.getElementById('avatarDisplay');
    
    if (avatarImg && avatarPlaceholder) {
      if (avatarUrl) {
        avatarImg.src = avatarUrl;
        avatarImg.style.display = 'block';
        avatarPlaceholder.style.display = 'none';
      } else {
        avatarImg.style.display = 'none';
        avatarPlaceholder.style.display = 'flex';
        avatarPlaceholder.textContent = nombre.charAt(0).toUpperCase();
      }
    }

    // Avatar en la navbar
    const navAvatarContainer = document.getElementById('navAvatarContainer');
    if (navAvatarContainer) {
      if (avatarUrl) {
        navAvatarContainer.innerHTML = `<img src="${avatarUrl}" alt="Avatar" class="user-avatar-small">`;
      } else {
        navAvatarContainer.innerHTML = `<div class="avatar-placeholder-small">${nombre.charAt(0).toUpperCase()}</div>`;
      }
    }

    // 4. Manejar Banner KYC
    const kycBanner = document.getElementById('kycBanner');
    const kycTitle = document.getElementById('kycTitle');
    const kycMessage = document.getElementById('kycMessage');
    
    if (kycBanner) {
      if (estadoKyc !== 'verificado') {
        kycBanner.style.display = 'flex';
        kycBanner.classList.remove('verified');
        if (kycTitle) kycTitle.textContent = 'Verificación KYC Pendiente';
        if (kycMessage) kycMessage.textContent = 'Para participar como Bochador o Patrocinador, debes completar tu verificación de identidad.';
      } else {
        kycBanner.style.display = 'flex';
        kycBanner.classList.add('verified');
        if (kycTitle) kycTitle.textContent = '¡Cuenta Verificada!';
        if (kycMessage) kycMessage.textContent = 'Tu identidad ha sido verificada exitosamente. Ya puedes participar en todos los eventos.';
        const kycBtn = document.getElementById('kycBtn');
        if (kycBtn) {
            kycBtn.innerHTML = '<i class="fas fa-check-circle"></i> Verificado';
            kycBtn.style.pointerEvents = 'none';
            kycBtn.style.opacity = '0.7';
        }
      }
    }

    // 5. 🛡️ PANEL DE ADMIN EN EL MENÚ (Si el usuario es admin)
    const esAdmin = session.user.user_metadata?.role === 'admin' || session.user.user_metadata?.isAdmin === true || perfil.rol === 'admin';
    const dropdownMenu = document.getElementById('dropdownMenu');
    
    if (esAdmin && dropdownMenu) {
      // Buscar si ya existe para no duplicar al recargar
      if (!document.getElementById('adminMenuItem')) {
        const adminItem = document.createElement('button');
        adminItem.id = 'adminMenuItem';
        adminItem.className = 'dropdown-item';
        adminItem.innerHTML = '<i class="fas fa-user-shield"></i><span>Panel de Admin</span>';
        adminItem.onclick = () => { window.location.href = 'admin.html'; }; // Ajusta la ruta si tu panel se llama diferente
        
        // Insertar antes del divisor de cerrar sesión
        const logoutBtn = dropdownMenu.querySelector('.dropdown-item.logout');
        if (logoutBtn && logoutBtn.previousElementSibling) {
          dropdownMenu.insertBefore(adminItem, logoutBtn.previousElementSibling);
        } else {
          dropdownMenu.appendChild(adminItem);
        }
      }
    }

    // 6. Mostrar contenido y ocultar loading (Aquí estaba el error original)
    const loadingState = document.getElementById('loadingState');
    const contentState = document.getElementById('contentState');
    
    if (loadingState) loadingState.style.display = 'none';
    if (contentState) contentState.style.display = 'block';

    // 7. Cargar Transmisión en Vivo
    await cargarTransmisionEnVivo();

    // 8. Cargar Notificaciones (si la función existe en notifications.js)
    if (typeof cargarNotificaciones === 'function') {
      await cargarNotificaciones();
    }

  } catch (err) {
    console.error('Error al cargar el dashboard:', err);
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    const contentState = document.getElementById('contentState');
    
    if (loadingState) loadingState.style.display = 'none';
    if (contentState) contentState.style.display = 'none';
    if (errorState) errorState.style.display = 'flex';
  }

  // ==========================================
  // FUNCIONES DE INTERFAZ Y EVENTOS
  // ==========================================
  
  // Dropdown de usuario
  const menuToggle = document.getElementById('menuToggle');
  const dropdownMenu = document.getElementById('dropdownMenu');
  
  if (menuToggle && dropdownMenu) {
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle('show');
      document.body.classList.toggle('menu-open');
      
      const notificationDropdown = document.getElementById('notificationDropdown');
      if (notificationDropdown) notificationDropdown.classList.remove('show');
    });
  }

  // Dropdown de notificaciones
  const notificationBtn = document.getElementById('notificationBtn');
  const notificationDropdown = document.getElementById('notificationDropdown');
  
  if (notificationBtn && notificationDropdown) {
    notificationBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notificationDropdown.classList.toggle('show');
      document.body.classList.toggle('menu-open');
      
      if (dropdownMenu) dropdownMenu.classList.remove('show');
    });
  }

  // Cerrar dropdowns al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (dropdownMenu && !dropdownMenu.contains(e.target) && e.target !== menuToggle && !menuToggle?.contains(e.target)) {
      dropdownMenu.classList.remove('show');
      document.body.classList.remove('menu-open');
    }
    if (notificationDropdown && !notificationDropdown.contains(e.target) && e.target !== notificationBtn && !notificationBtn?.contains(e.target)) {
      notificationDropdown.classList.remove('show');
      document.body.classList.remove('menu-open');
    }
  });

  // Botones de cierre de paneles móviles
  document.querySelectorAll('.panel-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (dropdownMenu) dropdownMenu.classList.remove('show');
      if (notificationDropdown) notificationDropdown.classList.remove('show');
      document.body.classList.remove('menu-open');
    });
  });

  // ==========================================
  // 📺 TRANSMISIÓN EN VIVO
  // ==========================================
  async function cargarTransmisionEnVivo() {
    try {
      // Ajusta esta consulta a tu tabla real (ej: 'eventos', 'configuracion', 'transmisiones')
      const { data: evento, error } = await db
        .from('eventos') 
        .select('titulo, descripcion, url_video, tipo_video')
        .eq('estado', 'en_vivo')
        .single();

      const liveSection = document.getElementById('liveStreamSection');
      const videoPlaceholder = document.getElementById('videoPlaceholder');
      const liveVideo = document.getElementById('liveVideo');
      const liveIframe = document.getElementById('liveIframe');
      const liveInfo = document.getElementById('liveInfo');
      const liveTitle = document.getElementById('liveTitle');
      const liveDescription = document.getElementById('liveDescription');
      const liveBadgeContainer = document.getElementById('liveBadgeContainer');

      if (evento && evento.url_video) {
        if (liveSection) liveSection.classList.add('active');
        if (videoPlaceholder) videoPlaceholder.style.display = 'none';
        if (liveInfo) liveInfo.style.display = 'block';
        if (liveTitle) liveTitle.textContent = evento.titulo || 'Transmisión en Vivo';
        if (liveDescription) liveDescription.textContent = evento.descripcion || 'Evento en curso';
        
        if (liveBadgeContainer) {
          liveBadgeContainer.innerHTML = '<div class="live-badge"><div class="live-dot"></div> EN VIVO</div>';
        }

        // Soporte para Iframe (YouTube, Twitch, etc.)
        if (evento.tipo_video === 'iframe' || evento.url_video.includes('youtube') || evento.url_video.includes('twitch')) {
          if (liveIframe) {
            liveIframe.src = evento.url_video;
            liveIframe.style.display = 'block';
          }
          if (liveVideo) liveVideo.style.display = 'none';
        } 
        // Soporte para video directo o HLS (m3u8)
        else {
          if (liveVideo) {
            liveVideo.style.display = 'block';
            if (evento.url_video.endsWith('.m3u8') && window.Hls && Hls.isSupported()) {
              const hls = new Hls();
              hls.loadSource(evento.url_video);
              hls.attachMedia(liveVideo);
            } else {
              liveVideo.src = evento.url_video;
            }
          }
          if (liveIframe) liveIframe.style.display = 'none';
        }
      } else {
        // No hay transmisión activa (Estado por defecto)
        if (liveSection) liveSection.classList.remove('active');
        if (videoPlaceholder) videoPlaceholder.style.display = 'flex';
        if (liveInfo) liveInfo.style.display = 'none';
        if (liveBadgeContainer) liveBadgeContainer.innerHTML = '';
        if (liveVideo) { liveVideo.style.display = 'none'; liveVideo.pause(); }
        if (liveIframe) { liveIframe.style.display = 'none'; liveIframe.src = ''; }
      }
    } catch (err) {
      console.warn('No se pudo cargar la transmisión en vivo (verifica el nombre de la tabla en Supabase):', err);
      const videoPlaceholder = document.getElementById('videoPlaceholder');
      if (videoPlaceholder) videoPlaceholder.style.display = 'flex';
    }
  }

  // ==========================================
  // FUNCIONES GLOBALES (Chat, Roles, etc.)
  // ==========================================
  
  window.toggleChat = function() {
    const chatWidget = document.getElementById('chatWidget');
    if (chatWidget) {
      const isVisible = chatWidget.style.display === 'block';
      chatWidget.style.display = isVisible ? 'none' : 'block';
    }
  };

  window.sendMessage = function() {
    const input = document.getElementById('chatInput');
    const messages = document.getElementById('chatMessages');
    if (input && messages && input.value.trim()) {
      const msgDiv = document.createElement('div');
      msgDiv.className = 'msg user';
      msgDiv.textContent = input.value;
      messages.appendChild(msgDiv);
      input.value = '';
      messages.scrollTop = messages.scrollHeight;
      // Aquí iría la lógica para enviar el mensaje a Supabase
    }
  };

  window.handleChatEnter = function(e) {
    if (e.key === 'Enter') window.sendMessage();
  };

  window.cerrarSesion = async function() {
    if (db) {
      await db.auth.signOut();
      window.location.href = 'index.html';
    }
  };

  window.seleccionarRol = function(rol) {
    if (rol === 'bochador') {
      window.location.href = 'dashboard-bochador.html';
    } else if (rol === 'patrocinador') {
      alert('Módulo de Patrocinador próximamente disponible');
    }
  };

  window.marcarTodasLeidas = function(e) {
    if (e) e.stopPropagation();
    const badge = document.getElementById('notificationBadge');
    if (badge) {
      badge.textContent = '0';
      badge.classList.add('hidden');
    }
    alert('Todas las notificaciones marcadas como leídas');
  };

  window.verMasNotificaciones = function() {
    window.location.href = 'mis-apuestas.html'; // Ajusta la ruta según tu proyecto
  };
});
