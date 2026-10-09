document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ Script de recuperación cargado');
    
    const messageDiv = document.getElementById('message');
    const emailForm = document.getElementById('emailForm');
    const otpForm = document.getElementById('otpForm');
    const passwordForm = document.getElementById('passwordForm');
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    const emailDisplay = document.getElementById('emailDisplay');
    const otpInput = document.getElementById('otpCode');
    const emailInput = document.getElementById('email');
    const emailError = document.getElementById('emailError');
    const emailErrorText = document.getElementById('emailErrorText');
    const btnEnviarCodigo = document.getElementById('btnEnviarCodigo');
    const newPasswordInput = document.getElementById('newPassword');
    
    const db = window.supabaseClient;
    let emailRecuperacion = '';
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

    // 1. Función global para el ojito
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

    // 2. Validación en tiempo real de la nueva contraseña
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

    // 3. Validación visual del email (solo para UX, no bloquea el envío)
    if (emailInput) {
        emailInput.addEventListener('input', function() {
            const email = this.value.trim();
            
            // Limpiar estado visual
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
                console.warn('No se pudo verificar en tiempo real (RPC):', error.message);
                return; // No bloqueamos, dejamos que signInWithOtp lo valide
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

    // 4. PASO 1: Enviar código OTP (La validación real la hace Supabase)
    if (emailForm) {
        emailForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = emailInput.value.trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            
            if (!emailRegex.test(email)) {
                showMessage('Por favor, ingresa un correo electrónico válido.', 'error');
                return;
            }
            
            showMessage('Enviando código de verificación...', 'info');
            
            try {
                // shouldCreateUser: false asegura que NO cree cuentas nuevas, solo envía OTP a existentes
                const { data, error } = await db.auth.signInWithOtp({
                    email: email,
                    options: {
                        shouldCreateUser: false
                    }
                });
                
                if (error) {
                    console.error('Error al enviar código:', error);
                    
                    // 🌐 TRADUCCIÓN DE ERRORES DE SUPABASE AL ESPAÑOL
                    if (error.message.includes('User not found') || error.message.includes('no user found')) {
                        showMessage('Este correo no está registrado en nuestro sistema.', 'error');
                        emailInput.classList.add('input-error');
                        if (emailError) {
                            emailErrorText.textContent = 'Este correo no está registrado';
                            emailError.style.display = 'flex';
                        }
                    } else if (error.message.includes('For security purposes, you can only request this after')) {
                        showMessage('Por seguridad, debes esperar unos segundos antes de solicitar otro código.', 'error');
                    } else if (error.message.includes('rate limit') || error.message.includes('Too many requests')) {
                        showMessage('Demasiados intentos. Por favor, espera un momento antes de intentar de nuevo.', 'error');
                    } else {
                        showMessage('Error: ' + error.message, 'error');
                    }
                    return;
                }
                
                // Si llega aquí, el correo existe y el código se envió correctamente
                emailRecuperacion = email;
                emailDisplay.textContent = email;
                
                step1.style.display = 'none';
                step2.style.display = 'block';
                showMessage('Código de 6 dígitos enviado. Revisa tu correo (y la carpeta de Spam).', 'success');
                
                setTimeout(() => otpInput.focus(), 100);
                
            } catch (err) {
                console.error('Error inesperado:', err);
                showMessage('Error inesperado: ' + err.message, 'error');
            }
        });
    }

    // 5. PASO 2: Verificar código OTP
    if (otpForm) {
        otpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const code = otpInput.value.trim();
            
            if (code.length !== 6) {
                showMessage('El código debe tener 6 dígitos', 'error');
                return;
            }
            
            showMessage('Verificando código...', 'info');
            
            try {
                // ⚠️ IMPORTANTE: type: 'recovery' es el estándar para restablecer contraseñas
                const { data, error } = await db.auth.verifyOtp({
                    email: emailRecuperacion,
                    token: code,
                    type: 'recovery'
                });
                
                if (error) {
                    console.error('Error al verificar código:', error);
                    
                    if (error.message.includes('Token has expired') || error.message.includes('expired')) {
                        showMessage('El código ha expirado. Solicita uno nuevo.', 'error');
                    } else if (error.message.includes('Invalid token') || error.message.includes('invalid')) {
                        showMessage('Código inválido. Verifica los dígitos e intenta de nuevo.', 'error');
                    } else {
                        showMessage('Error: ' + error.message, 'error');
                    }
                    return;
                }
                
                console.log('✅ Código de recuperación verificado, sesión temporal abierta');
                
                // Si la verificación fue exitosa, pasar al paso 3
                step2.style.display = 'none';
                step3.style.display = 'block';
                showMessage('Código verificado. Ahora crea tu nueva contraseña.', 'success');
                
            } catch (err) {
                console.error('Error inesperado:', err);
                showMessage('Error inesperado: ' + err.message, 'error');
            }
        });
    }

    // 6. PASO 3: Actualizar contraseña
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
                
                // Cerrar sesión para que el usuario inicie limpiamente con la nueva contraseña
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

    // Función para volver al paso 1
    window.volverAlPaso1 = function() {
        step2.style.display = 'none';
        step1.style.display = 'block';
        if (otpInput) otpInput.value = '';
        showMessage('', 'info');
    };
});
