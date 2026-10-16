document.addEventListener('DOMContentLoaded', function() {
    const messageDiv = document.getElementById('message');
    const loginForm = document.getElementById('loginForm');
    const submitBtn = document.getElementById('submitBtn');
    const db = window.supabaseClient;
    
    if (!db) {
        console.error('No se pudo obtener el cliente de Supabase');
        showMessage('Error: No se pudo conectar con el servidor', 'error');
        return;
    }

    function construirURL(base) {
        const path = window.location.pathname;
        const repoPath = path.substring(0, path.lastIndexOf('/'));
        return window.location.origin + repoPath + base;
    }

    function showMessage(text, type) {
        if (messageDiv) {
            messageDiv.textContent = text;
            messageDiv.className = 'message ' + type;
            messageDiv.style.display = 'block';
        }
    }

    function clearMessage() {
        if (messageDiv) {
            messageDiv.textContent = '';
            messageDiv.className = 'message';
            messageDiv.style.display = 'none';
        }
    }

    window.togglePasswordVisibility = function() {
        const passwordInput = document.getElementById('password');
        const icon = document.querySelector('.toggle-password');
        if (!passwordInput || !icon) return;
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            passwordInput.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    };

    function resetButton() {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Ingresar';
        }
    }

    // ============================================
    // 🔐 LOGIN CON EMAIL CONTRASEA (100% BLINDADO)
    // ============================================
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value.trim().toLowerCase();
            const password = document.getElementById('password').value;
            
            if (!email || !password) {
                showMessage('Por favor, completa todos los campos.', 'error');
                return;
            }

            // 🚨 PASO 0: Verificar si el correo está en la lista de bloqueo permanente
            // Usamos .maybeSingle() para evitar errores si el usuario NO está bloqueado (0 filas)
            const { data: banned, error: banError } = await db
                .from('lista_bloqueo')
                .select('email')
                .eq('email', email)
                .maybeSingle();

            if (banError && banError.code !== 'PGRST116') {
                console.error('Error verificando lista de bloqueo:', banError);
            }

            if (banned) {
                showMessage('❌ Esta cuenta ha sido eliminada permanentemente y no puede acceder al sistema.', 'error');
                resetButton();
                return; // Detiene la ejecución, NO intenta hacer login
            }
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Verificando...';
            showMessage('Iniciando sesión...', 'info');
            
            try {
                // PASO 1: ¿El correo existe?
                const { data: existeData, error: existeError } = await db.rpc('check_email_exists', { p_email: email });
                
                if (existeError) console.error('Error verificando correo:', existeError);
                
                if (existeData !== true) {
                    showMessage('❌ Este correo no está registrado en nuestro sistema.', 'error');
                    resetButton();
                    return;
                }

                // PASO 2: ¿Está suspendido temporalmente?
                const { data: preCheck, error: preError } = await db.rpc('check_login_attempt', { p_email: email, p_success: false });
                
                if (preError) console.error('Error pre-check:', preError);
                
                if (preCheck && preCheck.allowed === false) {
                    const hasta = preCheck.blocked_until 
                        ? new Date(preCheck.blocked_until).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                        : 'varias horas';
                    showMessage(`🚫 Cuenta suspendida hasta: ${hasta}`, 'error');
                    resetButton();
                    return;
                }

                // PASO 3: Intentar login con Supabase Auth
                const { data, error: authError } = await db.auth.signInWithPassword({ email: email, password: password });
                
                if (authError) {
                    // PASO 4: Registrar intento fallido
                    const { data: attemptData, error: rpcError } = await db.rpc('check_login_attempt', { p_email: email, p_success: false });
                    
                    if (rpcError) console.error('Error registrando intento:', rpcError);

                    if (attemptData && attemptData.allowed === false) {
                        const hasta = attemptData.blocked_until 
                            ? new Date(attemptData.blocked_until).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                            : 'varias horas';
                        showMessage(`🚫 Cuenta suspendida hasta: ${hasta}`, 'error');
                    } else {
                        const intentos = (attemptData && attemptData.attempts) ? attemptData.attempts : 1;
                        const restantes = Math.max(0, 5 - intentos);
                        showMessage(`❌ Contraseña incorrecta. Te quedan ${restantes} intento(s).`, 'error');
                    }
                    
                    resetButton();
                    return;
                }
                
                // PASO 5: Login exitoso -> Resetear contador
                try {
                    await db.rpc('check_login_attempt', { p_email: email, p_success: true });
                } catch (rpcErr) {
                    console.warn('No se pudo resetear contador:', rpcErr.message || rpcErr);
                }

                if (data.user && !data.user.email_confirmed_at) {
                    await db.auth.signOut();
                    showMessage('Debes confirmar tu correo antes de iniciar sesión.', 'error');
                    resetButton();
                    return;
                }
                
                if (data.user) {
                    try {
                        const sessionToken = Date.now().toString(36) + Math.random().toString(36).substr(2);
                        await db.from('active_sessions').upsert({
                            user_id: data.user.id,
                            session_token: sessionToken,
                            last_active: new Date().toISOString(),
                            device_info: navigator.userAgent.substring(0, 200)
                        });
                        localStorage.setItem('session_token', sessionToken);
                    } catch (sessionErr) {
                        console.error('Error registrando sesión:', sessionErr);
                    }
                }

                try {
                    await db.auth.signOut({ scope: 'others' });
                } catch (e) {
                    // Ignorar error si no hay otras sesiones
                }
                
                showMessage('¡Inicio de sesión exitoso! Redirigiendo...', 'success');
                setTimeout(() => {
                    const redirectUrl = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.REDIRECT_AFTER_LOGIN) 
                        ? APP_CONFIG.REDIRECT_AFTER_LOGIN 
                        : 'hub-juegos.html'; // 👈 REDIRECCIÓN CORRECTA
                    window.location.href = redirectUrl;
                }, 1500);
                
            } catch (err) {
                console.error('Error inesperado:', err);
                showMessage('Error inesperado: ' + err.message, 'error');
                resetButton();
            }
        });
    }

    // ============================================
    // 🔐 LOGIN CON GOOGLE
    // ============================================
    window.loginWithGoogle = async function() {
        showMessage('Conectando con Google...', 'info');
        try {
            const redirectURL = construirURL('/hub-juegos.html'); // 👈 REDIRECCIÓN CORRECTA
            const { data, error } = await db.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: redirectURL, queryParams: { access_type: 'offline', prompt: 'consent' } }
            });
            if (error) {
                let mensajeError = error.message;
                if (error.message.includes('already registered') || error.message.includes('already exists')) {
                    mensajeError = 'Este correo ya está registrado con otro método.';
                } else if (error.message.includes('For security purposes')) {
                    const match = error.message.match(/after (\d+) seconds?/);
                    mensajeError = `⏱️ Por seguridad, espera ${match ? match[1] : '60'} segundos antes de intentar de nuevo.`;
                }
                showMessage(mensajeError, 'error');
            }
        } catch (err) {
            showMessage('Error inesperado: ' + err.message, 'error');
        }
    };

    // ============================================
    // 🔄 FLUJO DE RECUPERACIÓN
    // ============================================
    window.mostrarRecuperacion = function(event) {
        if (event) event.preventDefault();
        clearMessage();
        if (loginForm) loginForm.style.display = 'none';
        document.querySelectorAll('.forgot-password, .divider, .btn-google, .register-link').forEach(el => { if(el) el.style.display = 'none'; });
        document.getElementById('recoveryStep1').style.display = 'block';
        document.getElementById('recoveryStep2').style.display = 'none';
    };
    
    window.volverAlLogin = function(event) {
        if (event) event.preventDefault();
        clearMessage();
        if (loginForm) loginForm.style.display = 'block';
        document.querySelectorAll('.forgot-password, .divider, .btn-google, .register-link').forEach(el => { if(el) el.style.display = 'block'; });
        document.getElementById('recoveryStep1').style.display = 'none';
        document.getElementById('recoveryStep2').style.display = 'none';
    };
    
    window.volverAlRecoveryStep1 = function(event) {
        if (event) event.preventDefault();
        clearMessage();
        document.getElementById('recoveryStep1').style.display = 'block';
        document.getElementById('recoveryStep2').style.display = 'none';
    };
    
    const recoveryForm = document.getElementById('recoveryForm');
    if (recoveryForm) {
        recoveryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('recoveryEmail').value.trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            
            if (!emailRegex.test(email)) {
                showMessage('Por favor, ingresa un correo electrónico válido.', 'error');
                return;
            }
            
            showMessage('Enviando enlace de recuperación...', 'info');
            
            try {
                const redirectURL = construirURL('/recuperar-contrasena.html');
                const { data, error } = await db.auth.resetPasswordForEmail(email, { redirectTo: redirectURL });
                
                if (error) {
                    let mensajeError = error.message;
                    if (error.message.includes('User not found') || error.message.includes('no user found')) {
                        mensajeError = 'Este correo no está registrado en nuestro sistema.';
                    } else if (error.message.includes('For security purposes') || error.message.includes('rate limit')) {
                        const match = error.message.match(/after (\d+) seconds?/);
                        mensajeError = `⏱️ Por seguridad, espera ${match ? match[1] : '60'} segundos antes de solicitar otro enlace.`;
                    }
                    showMessage(mensajeError, 'error');
                    return;
                }
                
                document.getElementById('recoveryStep1').style.display = 'none';
                document.getElementById('recoveryStep2').style.display = 'block';
                document.getElementById('recoveryEmailDisplay').textContent = email;
                showMessage('✅ Enlace enviado. Revisa tu correo.', 'success');
                
            } catch (err) {
                showMessage('Error inesperado: ' + err.message, 'error');
            }
        });
    }

       // ============================================
    // 🛡️ VERIFICAR SESIÓN ACTIVA Y BLOQUEO (Funciona para Google y Email)
    // ============================================
    async function checkSession() {
        try {
            const { data: { session } } = await db.auth.getSession();
            
            if (session && session.user) {
                // 1. Consultar si el usuario está bloqueado en la tabla 'perfiles'
                // Nota: session.user.id es el UUID, que coincide con la columna 'id' de tu tabla perfiles
                const { data: perfil, error: perfilError } = await db
                    .from('perfiles')
                    .select('bloqueado, motivo_bloqueo')
                    .eq('id', session.user.id) 
                    .single();

          if (perfil && perfil.bloqueado === true) {
    await db.auth.signOut();
    
    const motivo = perfil.motivo_bloqueo || 'Violación de las políticas de la plataforma';
    
    // Mensaje con formato HTML profesional
    const mensajeHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 10px;">
            <i class="fas fa-shield-alt" style="font-size: 2.5rem; color: #ff4444; margin-bottom: 5px;"></i>
            <strong style="font-size: 1.2rem; color: #ff4444; letter-spacing: 1px;">ACCESO DENEGADO</strong>
            <p style="margin: 0; font-size: 0.95rem; line-height: 1.5; color: #ffffff; text-align: center;">
                Tu cuenta ha sido suspendida por el administrador del sistema.<br>
                <strong style="color: #FFD700;">Motivo:</strong> ${motivo}
            </p>
            <p style="margin: 10px 0 0 0; font-size: 0.8rem; color: #999; text-align: center; border-top: 1px solid #333; padding-top: 10px; width: 100%;">
                Si crees que esto es un error, por favor contacta a nuestro equipo de soporte.
            </p>
        </div>
    `;
    
    sessionStorage.setItem('auth_message', mensajeHTML);
    sessionStorage.setItem('auth_type', 'error');
    window.location.reload();
    return;
}

                // 3. Si NO está bloqueado, proceder con la redirección normal
                const redirectUrl = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.REDIRECT_AFTER_LOGIN) 
                    ? APP_CONFIG.REDIRECT_AFTER_LOGIN 
                    : 'hub-juegos.html'; // O 'dashboard.html', según tu flujo
                
                // Evitar recargas infinitas si ya estamos en la página de destino
                if (!window.location.href.includes(redirectUrl)) {
                    window.location.href = redirectUrl;
                }
            }
        } catch (err) {
            console.warn('No se pudo verificar la sesión:', err);
        }
    }
    
    // Ejecutar la verificación al cargar la página
    checkSession();

    // ============================================
    // 📩 MOSTRAR MENSAJE DE EXPULSIÓN O BLOQUEO SI EXISTE
    // ============================================
    const logoutReason = sessionStorage.getItem('auth_message');
    const logoutType = sessionStorage.getItem('auth_type') || 'info';
    
    if (logoutReason) {
        showMessage(logoutReason, logoutType);
        
        // Ocultar el formulario de login si está bloqueado para que no intente ingresar de nuevo
        if (logoutType === 'error' && logoutReason.includes('BLOQUEADA')) {
            const loginForm = document.getElementById('loginForm');
            const googleBtn = document.querySelector('.btn-google');
            const recoveryLink = document.querySelector('.forgot-password');
            
            if (loginForm) loginForm.style.display = 'none';
            if (googleBtn) googleBtn.style.display = 'none';
            if (recoveryLink) recoveryLink.style.display = 'none';
        }
        
        // Limpiar el mensaje para que no aparezca en futuras visitas si ya se resolvió
        sessionStorage.removeItem('auth_message');
        sessionStorage.removeItem('auth_type');
    }
});
