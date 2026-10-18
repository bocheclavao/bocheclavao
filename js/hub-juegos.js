document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) { window.location.href = 'index.html'; return; }

    const btnAdmin = document.getElementById('btnAdmin');
    let sessionCheckActive = false;
    let sessionCheckInterval = null;

    const { data: { session } } = await db.auth.getSession();
    if (!session || !session.user) { window.location.href = 'index.html'; return; }

    const { data: perfilBloqueo } = await db
        .from('perfiles')
        .select('bloqueado, motivo_bloqueo')
        .eq('id', session.user.id)
        .maybeSingle();

    if (perfilBloqueo && perfilBloqueo.bloqueado === true) {
        await db.auth.signOut();
        sessionStorage.setItem('auth_message', `🚫 <strong>TU CUENTA HA SIDO BLOQUEADA PERMANENTEMENTE</strong><br><br>Motivo: ${perfilBloqueo.motivo_bloqueo || 'Violación de políticas.'}`);
        sessionStorage.setItem('auth_type', 'error');
        window.location.href = 'index.html';
        return;
    }

    const { data: checkData } = await db.rpc('check_login_attempt', { p_email: session.user.email, p_action: 'check' });
    if (checkData && checkData.allowed === false) {
        await db.auth.signOut();
        sessionStorage.setItem('auth_message', `🚫 Tu cuenta está suspendida temporalmente por múltiples intentos fallidos.`);
        sessionStorage.setItem('auth_type', 'error');
        window.location.href = 'index.html';
        return;
    }

    const { data: perfil, error: perfilError } = await db
        .from('perfiles')
        .select('bloqueado, motivo_bloqueo, saldo_bc, estado_kyc, user_id, nombre, avatar_url')
        .eq('id', session.user.id)
        .maybeSingle();

    if (perfilError) console.warn('🐛 Error cargando perfil:', perfilError);

    const estadoKycRaw = perfil?.estado_kyc;
    const estadoKyc = (!estadoKycRaw || String(estadoKycRaw).toLowerCase().trim() === 'null' || String(estadoKycRaw).trim() === '') 
        ? '' 
        : String(estadoKycRaw).toLowerCase().trim();
    
    console.log('🔍 [DEBUG] estado_kyc RAW:', estadoKycRaw, '→ PROCESADO:', estadoKyc);

    const nombre = perfil?.nombre || session.user.user_metadata?.nombre || session.user.user_metadata?.full_name || 'Usuario';
    const email = session.user.email;
    const userId = perfil?.user_id || 'ID no disponible';
    const avatarUrl = perfil?.avatar_url || session.user.user_metadata?.avatar_url || '../img/moneda.png';

    document.getElementById('hubUserAvatar').src = avatarUrl;
    document.getElementById('hubUserName').textContent = nombre;
    document.getElementById('hubUserEmail').textContent = email;

    let kycBadgeHtml = `<i class="fas fa-exclamation-circle" style="color: #ff4444; margin-left: 8px; font-size: 0.9rem;"></i> <span style="color: #ff4444; font-size: 0.75rem; font-weight: 700; margin-left: 5px;">Pendiente</span>`;
    
    if (estadoKyc === 'verificado') {
        kycBadgeHtml = `<i class="fas fa-check-circle" style="color: #00ff00; margin-left: 8px; font-size: 0.9rem;"></i> <span style="color: #00ff00; font-size: 0.75rem; font-weight: 700; margin-left: 5px;">Verificado</span>`;
    } else if (estadoKyc === 'revision' || estadoKyc === 'pendiente') {
        kycBadgeHtml = `<i class="fas fa-clock" style="color: #FFA500; margin-left: 8px; font-size: 0.9rem;"></i> <span style="color: #FFA500; font-size: 0.75rem; font-weight: 700; margin-left: 5px;">En Revisión</span>`;
    }
    
    document.getElementById('hubUserId').innerHTML = `ID: ${userId} ${kycBadgeHtml}`;

    const saldo = perfil?.saldo_bc ?? 0;
    document.getElementById('hubBalanceAmount').textContent = `${parseFloat(saldo).toFixed(2)} PP`;

    const kycBanner = document.getElementById('hubKycBanner');
    const kycTitle = document.getElementById('hubKycTitle');
    const kycMessage = document.getElementById('hubKycMessage');
    const kycBtn = document.getElementById('hubKycBtn');

    if (kycBanner) {
  
        if (estadoKyc === '' || estadoKyc === 'pendiente') {
            kycBanner.style.display = 'flex';
            kycBanner.className = 'kyc-banner';
            kycTitle.textContent = '⚠️ Verificación KYC Pendiente';
            kycMessage.textContent = 'Para participar en cualquier juego, debes completar tu verificación de identidad (KYC). Es rápido y seguro.';
            kycBtn.innerHTML = '<i class="fas fa-user-check"></i> Completar KYC ahora';
            kycBtn.style.pointerEvents = 'auto';
            kycBtn.style.opacity = '1';
            kycBtn.href = 'perfil.html';
            
        } else if (estadoKyc === 'revision') {
            kycBanner.style.display = 'flex';
            kycBanner.className = 'kyc-banner';
            kycBanner.style.borderColor = '#FFA500';
            kycTitle.textContent = '⏳ Verificación KYC en Revisión';
            kycMessage.textContent = 'Tus documentos están siendo revisados por nuestro equipo. Te notificaremos cuando esté listo.';
            kycBtn.innerHTML = '<i class="fas fa-hourglass-half"></i> En Revisión';
            kycBtn.style.pointerEvents = 'none';
            kycBtn.style.opacity = '0.6';
            
        } else if (estadoKyc === 'rechazado') {
            kycBanner.style.display = 'flex';
            kycBanner.className = 'kyc-banner rejected';
            kycTitle.textContent = '❌ Verificación KYC Rechazada';
            kycMessage.textContent = 'Tus documentos no fueron aprobados. Por favor, vuelve a enviarlos correctamente.';
            kycBtn.innerHTML = '<i class="fas fa-redo"></i> Reintentar';
            kycBtn.style.pointerEvents = 'auto';
            kycBtn.style.opacity = '1';
            kycBtn.href = 'perfil.html';
            
        } else if (estadoKyc === 'verificado') {
            kycBanner.style.display = 'none';
        }
    }

    let { data: adminData } = await db
        .from('admin_roles')
        .select('es_admin, activo')
        .eq('id', session.user.id)
        .maybeSingle();

    if (!adminData) {
        const resultado2 = await db.from('admin_roles').select('es_admin, activo').eq('user_id', session.user.id).maybeSingle();
        adminData = resultado2.data;
    }

    if (adminData && adminData.es_admin === true && adminData.activo === true) {
        btnAdmin.style.display = 'flex';
    } else {
        btnAdmin.style.display = 'none';
    }

    async function registrarMiSesion() {
        try {
            const token = session.access_token;
            localStorage.setItem('session_token', token);
            await db.from('active_sessions').upsert({ 
                user_id: session.user.id, session_token: token, last_active: new Date().toISOString(), device_info: navigator.userAgent.substring(0, 200) 
            });
        } catch (e) { console.warn('⚠️ No se pudo registrar sesión:', e.message); }
    }

    async function verificarSesionActiva() {
        if (sessionCheckActive || !session) return;
        sessionCheckActive = true;
        try {
            const miToken = localStorage.getItem('session_token');
            const { data } = await db.from('active_sessions').select('session_token').eq('user_id', session.user.id).maybeSingle();
            if (data && data.session_token !== miToken) {
                mostrarAlertaSesionDuplicada();
                if (sessionCheckInterval) { clearInterval(sessionCheckInterval); sessionCheckInterval = null; }
            }
        } catch (err) { console.error('Error verificando sesión:', err); }
        finally { sessionCheckActive = false; }
    }

    function mostrarAlertaSesionDuplicada() {
        let modal = document.getElementById('duplicateSessionModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'duplicateSessionModal';
            modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.95); z-index: 999999; justify-content: center; align-items: center; padding: 20px;';
            modal.innerHTML = `<div style="background: #1a1a1a; border: 2px solid #ff0000; border-radius: 16px; padding: 40px 30px; max-width: 450px; width: 100%; text-align: center;"><h2 style="color: #ff0000; margin-bottom: 15px;">⚠️ Sesión Duplicada</h2><p style="color: #ccc; margin-bottom: 25px;">Se ha iniciado sesión en otro dispositivo.</p><button id="closeSessionBtn" style="width: 100%; padding: 14px; background: #ff0000; color: #fff; border: none; border-radius: 8px; font-weight: 700; cursor: pointer;">Cerrar Sesión Ahora</button></div>`;
            document.body.appendChild(modal);
            document.getElementById('closeSessionBtn').addEventListener('click', async () => {
                await db.auth.signOut({ scope: 'global' });
                localStorage.removeItem('session_token');
                window.location.href = 'index.html';
            });
        }
        setTimeout(async () => {
            await db.auth.signOut({ scope: 'global' });
            localStorage.removeItem('session_token');
            window.location.href = 'index.html';
        }, 8000);
    }

    await registrarMiSesion();
    await verificarSesionActiva();
    sessionCheckInterval = setInterval(verificarSesionActiva, 5000);

    window.cerrarSesion = async function() {
        if (confirm('¿Cerrar sesión?')) {
            if (sessionCheckInterval) clearInterval(sessionCheckInterval);
            await db.auth.signOut({ scope: 'global' });
            localStorage.removeItem('session_token');
            window.location.href = 'index.html';
        }
    };

    window.irAPanelAdmin = function() { window.location.href = 'admin.html'; };

    window.toggleChat = function() {
        const chatWindow = document.getElementById('chatWindow');
        chatWindow.style.display = chatWindow.style.display === 'flex' ? 'none' : 'flex';
    };

    window.sendChatMessage = function() {
        const input = document.getElementById('chatInput');
        const messages = document.getElementById('chatMessages');
        if (input.value.trim() !== '') {
            const msgDiv = document.createElement('div');
            msgDiv.className = 'msg user';
            msgDiv.textContent = input.value;
            messages.appendChild(msgDiv);
            input.value = '';
            messages.scrollTop = messages.scrollHeight;
            setTimeout(() => {
                const replyDiv = document.createElement('div');
                replyDiv.className = 'msg admin';
                replyDiv.textContent = 'Gracias por tu mensaje. Un agente te atenderá pronto.';
                messages.appendChild(replyDiv);
                messages.scrollTop = messages.scrollHeight;
            }, 1000);
        }
    };

    console.log('✅ Hub de Juegos cargado correctamente.');
});
