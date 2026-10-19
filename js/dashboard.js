document.addEventListener('DOMContentLoaded', async function() {
  const db = window.supabaseClient;
  if (!db) { window.location.href = 'index.html'; return; }
  
  const { data: { session } } = await db.auth.getSession();
  if (!session || !session.user) { window.location.href = 'index.html'; return; }

  // Funciones auxiliares seguras
  const safeSetText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  try {
    // 1. Obtener perfil del usuario
    const { data: perfil, error } = await db
      .from('perfiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (error || !perfil) throw new Error('No se pudo cargar el perfil.');

    // 2. Procesar datos
    const nombre = perfil.nombre || 'Usuario';
    const userId = perfil.user_id || 'N/A';
    const email = session.user.email;
    const balance = perfil.balance || 0;
    const estadoKyc = perfil.estado_kyc || 'pendiente';

    // 3. Renderizar Avatar
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

    // 4. Actualizar textos en el HTML
    safeSetText('userNameDisplay', nombre);
    safeSetText('userIdDisplay', `ID: ${userId}`);
    safeSetText('userEmailDisplay', email);
    safeSetText('balanceAmount', `${balance.toFixed(2)} BC`);

    // 5. Manejar banner KYC
    const kycBanner = document.getElementById('kycBanner');
    if (kycBanner) {
      if (estadoKyc !== 'verificado') {
        kycBanner.style.display = 'flex';
        kycBanner.classList.remove('verified');
      } else {
        kycBanner.style.display = 'none';
      }
    }

    // 6. Mostrar contenido y ocultar loading
    const loadingState = document.getElementById('loadingState');
    const contentState = document.getElementById('contentState');
    
    if (loadingState) loadingState.style.display = 'none';
    if (contentState) contentState.style.display = 'block';

    // 7. Cargar notificaciones si existe la función
    if (typeof cargarNotificaciones === 'function') {
      await cargarNotificaciones();
    }

  } catch (err) {
    console.error('Error al cargar el dashboard:', err);
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    
    if (loadingState) loadingState.style.display = 'none';
    if (errorState) errorState.style.display = 'flex';
  }

  // ==========================================
  // FUNCIONES DE INTERFAZ (Dropdowns, Chat, etc.)
  // ==========================================
  
  // Dropdown de usuario
  const menuToggle = document.getElementById('menuToggle');
  const dropdownMenu = document.getElementById('dropdownMenu');
  
  if (menuToggle && dropdownMenu) {
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle('show');
      document.body.classList.toggle('menu-open');
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
    });
  }

  // Cerrar dropdowns al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (dropdownMenu && !dropdownMenu.contains(e.target) && e.target !== menuToggle) {
      dropdownMenu.classList.remove('show');
      document.body.classList.remove('menu-open');
    }
    if (notificationDropdown && !notificationDropdown.contains(e.target) && e.target !== notificationBtn) {
      notificationDropdown.classList.remove('show');
      document.body.classList.remove('menu-open');
    }
  });

  // Chat
  window.toggleChat = function() {
    const chatWidget = document.getElementById('chatWidget');
    if (chatWidget) {
      chatWidget.style.display = chatWidget.style.display === 'none' ? 'block' : 'none';
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
    }
  };

  window.handleChatEnter = function(e) {
    if (e.key === 'Enter') sendMessage();
  };

  // Cerrar sesión
  window.cerrarSesion = async function() {
    if (db) {
      await db.auth.signOut();
      window.location.href = 'index.html';
    }
  };

  // Selección de rol
  window.seleccionarRol = function(rol) {
    console.log('Rol seleccionado:', rol);
    if (rol === 'bochador') {
      window.location.href = 'dashboard-bochador.html';
    } else if (rol === 'patrocinador') {
      alert('Módulo de Patrocinador próximamente disponible');
    }
  };

  // Marcar notificaciones como leídas
  window.marcarTodasLeidas = function(e) {
    e.stopPropagation();
    const badge = document.getElementById('notificationBadge');
    if (badge) {
      badge.textContent = '0';
      badge.classList.add('hidden');
    }
    alert('Todas las notificaciones marcadas como leídas');
  };

  window.verMasNotificaciones = function() {
    alert('Próximamente: Historial de apuestas');
  };
});
