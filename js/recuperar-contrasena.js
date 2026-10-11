document.addEventListener('DOMContentLoaded', function() {
    console.log('📧 Script de recuperación cargado');
    
    const messageDiv = document.getElementById('message');
    const emailForm = document.getElementById('emailForm');
    const passwordForm = document.getElementById('passwordForm');
    const emailInput = document.getElementById('email');
    const emailError = document.getElementById('emailError');
    const emailErrorText = document.getElementById('emailErrorText');
    const btnEnviarCodigo = document.getElementById('btnEnviarCodigo');
    
    const db = window.supabaseClient;
    let debounceTimer = null;
    let isRecoveryMode = false;

    if (!db) {
        console.error('No se pudo obtener el cliente de Supabase');
        return;
    }

    function showMessage(text, type) {
        if (messageDiv) {
            messageDiv.textContent = text;
            messageDiv.className = 'message ' + type;
            if (type === 'success' || type === 'error') {
                setTimeout(() => {
                    messageDiv.className = 'message';
                }, 5000);
            }
        }
    }

    function construirURL(base) {
        const path = window.location.pathname;
        const repoPath = path.substring(0, path.lastIndexOf('/'));
        return window.location.origin + repoPath + base;
    }

    // 👁️ Mostrar/Ocultar contraseña
    window.togglePassword = function(inputId, iconElement) {
        const input = document.getElementById(inputId);
        if (!input || !iconElement) return;
        
        if (input.type === 'password') {
            input.type = 'text';
            iconElement.classList.remove('fa-eye');
            iconElement.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            iconElement.classList.remove('fa-eye-slash');
            iconElement.classList.add('fa-eye');
        }
    };

    // Volver al paso 1
    window.volverAlPaso1 = function() {
        document.getElementById('step1').style.display = 'block';
        document.getElementById('step2').style.display = 'none';
        document.getElementById('step3').style.display = 'none';
        document.getElementById('step4').style.display = 'none';
    };

    // 🎯 Detectar recuperación de contraseña desde enlace de email
    db.auth.onAuthStateChange(async (event, session) => {
        console.log('🔐 Evento de autenticación:', event);
        
        if (event === 'PASSWORD_RECOVERY') {
            console.log('✅ Usuario viene del enlace de recuperación');
            isRecoveryMode = true;
            
            document.getElementById('step1').style.display = 'none';
            document.getElementById('step2').style.display = 'none';
            document.getElementById('step3').style.display = 'block';
            document.getElementById('step4').style.display = 'none';
            
            inicializarRequisitos();
            showMessage('Enlace verificado. Crea tu nueva contraseña.', 'success');
        }
    });

    // Verificar también si ya hay sesión de recuperación (por si el evento no se dispara)
    async function verificarSesionRecuperacion() {
        const { data: { session } } = await db.auth.getSession();
        if (session && window.location.hash.includes('recovery')) {
            console.log('✅ Sesión de recuperación detectada por hash');
            isRecoveryMode = true;
            document.getElementById('step1').style.display = 'none';
            document.getElementById('step3').style.display = 'block';
            inicializarRequisitos();
        }
    }
    verificarSesionRecuperacion();

    // Inicializar requisitos
    function inicializarRequisitos() {
        const ids = ['req-length', 'req-letter', 'req-number', 'req-special'];
        ids.forEach(id => {
            const li = document.getElementById(id);
            if (li) {
                li.classList.remove('req-valid');
                li.classList.add('req-invalid');
                const icon = li.querySelector('i');
                if (icon) icon.className = 'fas fa-circle';
            }
        });
    }

    // Validación visual del email
    if (emailInput) {
        emailInput.addEventListener('input', function() {
            const email = this.value.trim();
            
            emailInput.classList.remove('input-error', 'input-valid');
            if (emailError) emailError.style.display = 'none';
            if (btnEnviarCodigo) btnEnviarCodigo.disabled = false;
            
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email) || email.length < 5) return;
            
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                verificarEmailExiste(email);
            }, 800);
        });
    }

    async function verificarEmailExiste(email) {
        try {
            const { data, error } = await db.rpc('verificar_correo_existente', { p_email: email });
            
            if (error) {
                console.warn('No se pudo verificar email:', error.message);
                // No mostrar error, continuar normalmente
                return;
            }
            
            if (data === true) {
                emailInput.classList.add('input-valid');
                emailInput.classList.remove('input-error');
            } else {
                emailInput.classList.add('input-error');
                emailInput.classList.remove('input-valid');
                if (emailError) {
                    emailErrorText.textContent = 'Este correo no está registrado';
                    emailError.style.display = 'flex';
                }
            }
        } catch (err) {
            console.warn('Error en verificación:', err.message);
        }
    }

    // 📧 Enviar enlace de recuperación
    if (emailForm) {
        emailForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = emailInput.value.trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            
            if (!emailRegex.test(email)) {
                showMessage('Por favor, ingresa un correo electrónico válido.', 'error');
                return;
            }
            
            if (btnEnviarCodigo) {
                btnEnviarCodigo.disabled = true;
                btnEnviarCodigo.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Enviando...';
            }
            
            showMessage('Enviando enlace de recuperación...', 'info');
            
            try {
                const redirectURL = construirURL('/recuperar-contrasena.html');
                console.log('🔗 URL de redirección:', redirectURL);
                
                const { data, error } = await db.auth.resetPasswordForEmail(email, {
                    redirectTo: redirectURL
                });
                
                if (error) {
                    console.error('Error al enviar enlace:', error);
                    
                    if (error.message.includes('User not found') || error.message.includes('no user found')) {
                        showMessage('Este correo no está registrado en nuestro sistema.', 'error');
                        emailInput.classList.add('input-error');
                    } else if (error.message.includes('For security purposes') || error.message.includes('rate limit')) {
                        showMessage('⏱️ Por seguridad, debes esperar 60 segundos antes de solicitar otro enlace.', 'error');
                    } else {
                        showMessage('Error: ' + error.message, 'error');
                    }
                    
                    if (btnEnviarCodigo) {
                        btnEnviarCodigo.disabled = false;
                        btnEnviarCodigo.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar enlace de recuperación';
                    }
                    return;
                }
                
                // Mostrar paso 2 (confirmación de envío)
                document.getElementById('step1').style.display = 'none';
                document.getElementById('step2').style.display = 'block';
                document.getElementById('emailDisplay').textContent = email;
                
                showMessage('✅ Enlace enviado. Revisa tu correo.', 'success');
                
            } catch (err) {
                console.error('Error inesperado:', err);
                showMessage('Error inesperado: ' + err.message, 'error');
                if (btnEnviarCodigo) {
                    btnEnviarCodigo.disabled = false;
                    btnEnviarCodigo.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar enlace de recuperación';
                }
            }
        });
    }

    // Validación en tiempo real de la nueva contraseña
    const newPasswordInput = document.getElementById('newPassword');
    if (newPasswordInput) {
        newPasswordInput.addEventListener('input', function() {
            const val = this.value;
            updateRequirement('req-length', val.length >= 8);
            updateRequirement('req-letter', /[a-zA-Z]/.test(val));
            updateRequirement('req-number', /[0-9]/.test(val));
            updateRequirement('req-special', /[^a-zA-Z0-9]/.test(val));
        });
    }

    function updateRequirement(id, isValid) {
        const li = document.getElementById(id);
        if (!li) return;
        const icon = li.querySelector('i');
        if (isValid) {
            li.classList.remove('req-invalid');
            li.classList.add('req-valid');
            if (icon) icon.className = 'fas fa-check-circle';
        } else {
            li.classList.remove('req-valid');
            li.classList.add('req-invalid');
            if (icon) icon.className = 'fas fa-circle';
        }
    }

 // 🔐 Actualizar contraseña
if (passwordForm) {
    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (newPassword !== confirmPassword) {
            showMessage('Las contraseñas no coinciden', 'error');
            return;
        }
        
        if (newPassword.length < 8) {
            showMessage('La contraseña debe tener al menos 8 caracteres.', 'error');
            return;
        }
        
        if (!/[a-zA-Z]/.test(newPassword)) {
            showMessage('La contraseña debe contener al menos una letra.', 'error');
            return;
        }
        
        if (!/[0-9]/.test(newPassword)) {
            showMessage('La contraseña debe contener al menos un número.', 'error');
            return;
        }
        
        if (!/[^a-zA-Z0-9]/.test(newPassword)) {
            showMessage('La contraseña debe contener al menos un carácter especial.', 'error');
            return;
        }
        
        showMessage('Actualizando contraseña...', 'info');
        
        try {
            const { data, error } = await db.auth.updateUser({
                password: newPassword
            });
            
            if (error) {
                console.error('Error al actualizar contraseña:', error);
                
                // 🌐 TRADUCCIÓN DE MENSAJES DE ERROR AL ESPAÑOL
                let mensajeError = error.message;
                
                if (error.message.includes('different from the old password')) {
                    mensajeError = 'La nueva contraseña debe ser diferente a la actual.';
                } else if (error.message.includes('Password should be at least')) {
                    mensajeError = 'La contraseña debe tener al menos 8 caracteres.';
                } else if (error.message.includes('User not found')) {
                    mensajeError = 'Usuario no encontrado. Por favor, solicita un nuevo enlace.';
                } else if (error.message.includes('invalid_refresh_token') || error.message.includes('expired')) {
                    mensajeError = 'El enlace ha expirado. Por favor, solicita uno nuevo desde el login.';
                } else if (error.message.includes('rate limit')) {
                    mensajeError = 'Demasiados intentos. Por favor, espera un momento.';
                }
                
                showMessage('❌ ' + mensajeError, 'error');
                
                // Si el enlace expiró, ofrecer solicitar uno nuevo
                if (error.message.includes('expired') || error.message.includes('invalid_refresh_token')) {
                    setTimeout(() => {
                        document.getElementById('step3').style.display = 'none';
                        document.getElementById('step1').style.display = 'block';
                    }, 3000);
                }
                
                return;
            }
            
            // Cerrar sesión y mostrar éxito
            await db.auth.signOut();
            
            // Mostrar paso 4 (éxito)
            document.getElementById('step3').style.display = 'none';
            document.getElementById('step4').style.display = 'block';
            
            // Redirigir al login después de 2.5 segundos
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2500);
            
        } catch (err) {
            console.error('Error inesperado:', err);
            showMessage('Error inesperado: ' + err.message, 'error');
        }
    });
}
});
