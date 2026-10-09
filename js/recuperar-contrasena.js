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
    let emailExiste = false;
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

    // 3. Validación en tiempo real del email (verifica que exista)
    if (emailInput) {
        emailInput.addEventListener('input', function() {
            const email = this.value.trim();
            
            // Limpiar estado
            emailInput.classList.remove('input-error', 'input-valid');
            if (emailError) emailError.style.display = 'none';
            emailExiste = false;
            if (btnEnviarCodigo) btnEnviarCodigo.disabled = false;
            
            // Validar formato
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email) || email.length < 5) {
                return;
            }
            
            // Debounce
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                verificarEmailExiste(email);
            }, 800);
        });
    }

    async function verificarEmailExiste(email) {
        try {
            console.log('🔍 Verificando correo:', email);
            
            const { data, error } = await db
                .rpc('verificar_correo_existente', { p_email: email });
            
            if (error) {
                console.error('Error al verificar email:', error);
                return;
            }
            
            console.log('📩 Respuesta (existe):', data);
            
            if (data === true) {
                emailExiste = true;
                emailInput.classList.add('input-valid');
                emailInput.classList.remove('input-error');
                if (emailError) emailError.style.display = 'none';
                if (btnEnviarCodigo) btnEnviarCodigo.disabled = false;
            } else {
                emailExiste = false;
                emailInput.classList.add('input-error');
                emailInput.classList.remove('input-valid');
                if (emailError) {
                    emailErrorText.textContent = 'Este correo no está registrado';
                    emailError.style.display = 'flex';
                }
                if (btnEnviarCodigo) btnEnviarCodigo.disabled = true;
            }
        } catch (err) {
            console.error('Error inesperado:', err);
        }
    }

    // 4. PASO 1: Enviar código OTP al correo
    if (emailForm) {
        emailForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = emailInput.value.trim();
            
            if (!emailExiste) {
                showMessage('Este correo no está registrado en nuestro sistema.', 'error');
                return;
            }
            
            showMessage('Enviando código de verificación...', 'info');
            
            try {
                // Enviar código OTP de recuperación
                const { data, error } = await db.auth.signInWithOtp({
                    email: email,
                    options: {
                        shouldCreateUser: false
                    }
                });
                
                if (error) {
                    console.error('Error al enviar código:', error);
                    showMessage('Error al enviar el código: ' + error.message, 'error');
                    return;
                }
                
                emailRecuperacion = email;
                emailDisplay.textContent = email;
                
                step1.style.display = 'none';
                step2.style.display = 'block';
                showMessage('Código de 6 dígitos enviado. Revisa tu correo (y Spam).', 'success');
                
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
                const { data, error } = await db.auth.verifyOtp({
                    email: emailRecuperacion,
                    token: code,
                    type: 'email'
                });
                
                if (error) {
                    console.error('Error al verificar código:', error);
                    showMessage('Código inválido o expirado: ' + error.message, 'error');
                    return;
                }
                
                console.log('✅ Código verificado, sesión abierta:', data);
                
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
            
            if (newPassword.length < 8) {
                showMessage('La contraseña debe tener al menos 8 caracteres', 'error');
                return;
            }
            if (!/[a-zA-Z]/.test(newPassword)) {
                showMessage('La contraseña debe tener al menos una letra', 'error');
                return;
            }
            if (!/[0-9]/.test(newPassword)) {
                showMessage('La contraseña debe tener al menos un número', 'error');
                return;
            }
            if (!/[^a-zA-Z0-9]/.test(newPassword)) {
                showMessage('La contraseña debe tener al menos un carácter especial', 'error');
                return;
            }
            
            showMessage('Actualizando contraseña...', 'info');
            
            try {
                // Actualizar la contraseña del usuario autenticado
                const { data, error } = await db.auth.updateUser({
                    password: newPassword
                });
                
                if (error) {
                    console.error('Error al actualizar contraseña:', error);
                    showMessage('Error al actualizar: ' + error.message, 'error');
                    return;
                }
                
                console.log('✅ Contraseña actualizada:', data);
                
                // Cerrar sesión para que el usuario inicie con la nueva contraseña
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
