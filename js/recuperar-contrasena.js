document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ Script de recuperación cargado');
    
    const messageDiv = document.getElementById('message');
    const emailForm = document.getElementById('emailForm');
    const emailInput = document.getElementById('email');
    const emailError = document.getElementById('emailError');
    const emailErrorText = document.getElementById('emailErrorText');
    const btnEnviarCodigo = document.getElementById('btnEnviarCodigo');
    
    const db = window.supabaseClient;
    let debounceTimer = null;

    if (!db) {
        console.error('❌ No se pudo obtener el cliente de Supabase');
        return;
    }

    function showMessage(text, type) {
        if (messageDiv) {
            messageDiv.textContent = text;
            messageDiv.className = 'message ' + type;
        }
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
                console.warn('No se pudo verificar en tiempo real:', error.message);
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
            console.error('Error en verificación:', err);
        }
    }

    // Enviar enlace de recuperación
    if (emailForm) {
        emailForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = emailInput.value.trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            
            if (!emailRegex.test(email)) {
                showMessage('Por favor, ingresa un correo electrónico válido.', 'error');
                return;
            }
            
            showMessage('Enviando enlace de recuperación...', 'info');
            
            try {
                // Método oficial de Supabase para recuperación de contraseña
                const { data, error } = await db.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + '/html/recuperar-contrasena.html#nueva-contrasena'
                });
                
                if (error) {
                    console.error('Error al enviar enlace:', error);
                    
                    // Traducción de errores al español
                    if (error.message.includes('User not found') || error.message.includes('no user found')) {
                        showMessage('Este correo no está registrado en nuestro sistema.', 'error');
                        emailInput.classList.add('input-error');
                        if (emailError) {
                            emailErrorText.textContent = 'Este correo no está registrado';
                            emailError.style.display = 'flex';
                        }
                    } else if (error.message.includes('For security purposes, you can only request this after')) {
                        showMessage('Por seguridad, debes esperar unos segundos antes de solicitar otro enlace.', 'error');
                    } else if (error.message.includes('rate limit') || error.message.includes('Too many requests')) {
                        showMessage('Demasiados intentos. Por favor, espera un momento antes de intentar de nuevo.', 'error');
                    } else {
                        showMessage('Error: ' + error.message, 'error');
                    }
                    return;
                }
                
                // Éxito: mostrar mensaje y ocultar formulario
                emailForm.style.display = 'none';
                showMessage('✅ Enlace de recuperación enviado. Revisa tu correo (y la carpeta de Spam). Haz clic en el enlace para crear tu nueva contraseña.', 'success');
                
            } catch (err) {
                console.error('Error inesperado:', err);
                showMessage('Error inesperado: ' + err.message, 'error');
            }
        });
    }

    // Detectar si el usuario viene del enlace de recuperación
    if (window.location.hash === '#nueva-contrasena') {
        const step1 = document.getElementById('step1');
        const step3 = document.getElementById('step3');
        
        if (step1 && step3) {
            step1.style.display = 'none';
            step3.style.display = 'block';
        }
    }

    // Validación de nueva contraseña
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

    // Actualizar contraseña
    const passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
        passwordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            if (newPassword !== confirmPassword) {
                showMessage('Las contraseñas no coinciden', 'error');
                return;
            }
            
            if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^a-zA-Z0-9]/.test(newPassword)) {
                showMessage('La contraseña no cumple con los requisitos de seguridad.', 'error');
                return;
            }
            
            showMessage('Actualizando contraseña...', 'info');
            
            try {
                const { data, error } = await db.auth.updateUser({
                    password: newPassword
                });
                
                if (error) {
                    console.error('Error al actualizar contraseña:', error);
                    showMessage('Error al actualizar: ' + error.message, 'error');
                    return;
                }
                
                await db.auth.signOut();
                
                showMessage('✅ Contraseña actualizada exitosamente. Redirigiendo al login...', 'success');
                
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
