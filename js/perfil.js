document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) { console.error('No se pudo obtener el cliente de Supabase'); return; }

    const loadingState = document.getElementById('loadingState');
    const contentState = document.getElementById('contentState');
    const messageDiv = document.getElementById('message');
    const profileMessageDiv = document.getElementById('profileMessage');
    const submitBtn = document.getElementById('submitBtn');
    const btnSaveProfile = document.getElementById('btnSaveProfile');
    const fechaNacimientoInput = document.getElementById('fechaNacimiento');

    let currentStream = null;
    let currentCameraType = null;
    let faceApiLoaded = false;
    let trackingAnimationId = null;
    let edadValida = false;
    let currentUserId = null;
    let tempAvatarData = null;
    let perfilBloqueado = false;
    let nombreOriginal = '';
    let perfilActual = null; // Para guardar el perfil actual y evitar sobrescribir URLs antiguas

    // 🌍 LISTA DE PAÍSES (Abreviada para el ejemplo, usa tu lista completa)
    const countries = [
        { code: 'VE', name: 'Venezuela', phone: '+58', flag: '🇻🇪' },
        { code: 'CO', name: 'Colombia', phone: '+57', flag: '🇨🇴' },
        { code: 'US', name: 'Estados Unidos', phone: '+1', flag: '🇺🇸' },
        { code: 'MX', name: 'México', phone: '+52', flag: '🇲🇽' },
        { code: 'AR', name: 'Argentina', phone: '+54', flag: '🇦🇷' }
        // ... (Agrega aquí el resto de tu lista de países)
    ];

    // ==========================================
    // FUNCIÓN AUXILIAR: SUBIR BASE64 A SUPABASE STORAGE
    // ==========================================
    async function subirImagenAStorage(base64Data, ruta) {
        if (!base64Data || !base64Data.startsWith('data:')) return base64Data; // Si ya es URL, la devolvemos
        
        try {
            // Convertir Base64 a Blob
            const arr = base64Data.split(',');
            const mime = arr[0].match(/:(.*?);/)[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) { u8arr[n] = bstr.charCodeAt(n); }
            const blob = new Blob([u8arr], { type: mime });

            // Subir a Supabase Storage
            const { error: uploadError } = await db.storage
                .from('kyc_documentos')
                .upload(ruta, blob, { contentType: mime, upsert: true });
                
            if (uploadError) throw uploadError;
            
            // Obtener URL pública
            const { data: urlData } = db.storage.from('kyc_documentos').getPublicUrl(ruta);
            return urlData.publicUrl;
        } catch (err) {
            console.error('Error al subir imagen:', err);
            throw err;
        }
    }

    function showMessage(text, type) {
        if (messageDiv) {
            messageDiv.textContent = text;
            messageDiv.className = 'message ' + type;
            messageDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function showProfileMessage(text, type) {
        if (profileMessageDiv) {
            profileMessageDiv.textContent = text;
            profileMessageDiv.className = 'message ' + type;
            setTimeout(() => { profileMessageDiv.className = 'message'; }, 4000);
        }
    }

    function llenarSelectoresPaises() {
        const phoneSelect = document.getElementById('phoneCountry');
        const nationalitySelect = document.getElementById('nacionalidad');
        const countrySelect = document.getElementById('pais');
        if (!phoneSelect || !nationalitySelect || !countrySelect) return;

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Selecciona un país...';
        [phoneSelect, nationalitySelect, countrySelect].forEach(sel => sel.appendChild(defaultOption.cloneNode(true)));

        countries.forEach(country => {
            const phoneOption = document.createElement('option');
            phoneOption.value = country.phone;
            phoneOption.textContent = `${country.flag} ${country.name} (${country.phone})`;
            phoneSelect.appendChild(phoneOption);

            const natOption = document.createElement('option');
            natOption.value = country.name;
            natOption.textContent = `${country.flag} ${country.name}`;
            nationalitySelect.appendChild(natOption);

            const countryOption = document.createElement('option');
            countryOption.value = country.name;
            countryOption.textContent = `${country.flag} ${country.name}`;
            countrySelect.appendChild(countryOption);
        });
    }

    function validarEdad(fechaNacimiento) {
        const edadDiv = document.getElementById('edadValidationMsg');
        if (!edadDiv) return false;
        const hoy = new Date();
        const fechaNac = new Date(fechaNacimiento);
        if (fechaNac > hoy) {
            edadDiv.className = 'validation-message error';
            edadDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> La fecha de nacimiento no puede ser futura.';
            edadValida = false; return false;
        }
        let edad = hoy.getFullYear() - fechaNac.getFullYear();
        const mes = hoy.getMonth() - fechaNac.getMonth();
        if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) edad--;
        
        if (edad < 18) {
            edadDiv.className = 'validation-message error';
            edadDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Debes ser mayor de edad (18+ años). Tienes ${edad} años.`;
            edadValida = false; return false;
        } else if (edad > 120) {
            edadDiv.className = 'validation-message error';
            edadDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Fecha de nacimiento no válida.';
            edadValida = false; return false;
        } else {
            edadDiv.className = 'validation-message success';
            edadDiv.innerHTML = `<i class="fas fa-check-circle"></i> Edad verificada: ${edad} años ✓`;
            edadValida = true; return true;
        }
    }

    if (fechaNacimientoInput) {
        fechaNacimientoInput.setAttribute('max', new Date().toISOString().split('T')[0]);
        fechaNacimientoInput.addEventListener('change', function() {
            if (this.value) validarEdad(this.value);
            else {
                const edadDiv = document.getElementById('edadValidationMsg');
                if (edadDiv) edadDiv.className = 'validation-message';
                edadValida = false;
            }
        });
    }

    async function preloadFaceModels() {
        const statusDiv = document.getElementById('faceDetectionStatus');
        try {
            const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model';
            await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
            faceApiLoaded = true;
            if (statusDiv) {
                statusDiv.className = 'face-detection-status success';
                statusDiv.textContent = '✅ Sistema de IA listo. Abre la cámara para el rastreo.';
                setTimeout(() => { statusDiv.style.display = 'none'; }, 3000);
            }
        } catch (err) {
            console.error('❌ Error precargando IA:', err);
            if (statusDiv) {
                statusDiv.className = 'face-detection-status error';
                statusDiv.textContent = '⚠️ Error cargando IA. Verifica tu conexión.';
            }
        }
    }

    function setDocStatus(type, state) {
        const map = { docFront: 'docFrontStatus', docBack: 'docBackStatus', selfie: 'selfieStatus' };
        const el = document.getElementById(map[type]);
        if (!el) return;
        if (state === 'ok') { el.className = 'doc-status ok'; el.innerHTML = '<i class="fas fa-check-circle"></i> Cargada'; }
        else if (state === 'missing') { el.className = 'doc-status missing'; el.innerHTML = '<i class="fas fa-times-circle"></i> No cargada'; }
        else if (state === 'optional') { el.className = 'doc-status optional'; el.innerHTML = '<i class="fas fa-minus-circle"></i> No cargada (opcional)'; }
        else if (state === 'pending-save') { el.className = 'doc-status pending-save'; el.innerHTML = '<i class="fas fa-check-circle"></i> Capturada - Se guardará al enviar'; }
    }

    function bloquearCampos(bloquear) {
        perfilBloqueado = bloquear;
        const camposABloquear = [
            'phoneCountry', 'telefono', 'fechaNacimiento', 'nacionalidad',
            'direccion', 'ciudad', 'estadoProvincia', 'pais', 'codigoPostal',
            'tipoDocumento', 'numeroDocumento'
        ];
        camposABloquear.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.disabled = bloquear;
        });
        document.querySelectorAll('[data-camera-btn]').forEach(btn => { btn.disabled = bloquear; });
        ['sectionPersonal', 'sectionDireccion', 'sectionKyc'].forEach(id => {
            const sec = document.getElementById(id);
            if (sec) {
                if (bloquear) { sec.style.opacity = '0.6'; sec.style.pointerEvents = 'none'; sec.classList.add('locked-section'); }
                else { sec.style.opacity = '1'; sec.style.pointerEvents = 'auto'; sec.classList.remove('locked-section'); }
            }
        });
    }

    async function cargarPerfil() {
        try {
            const { data: { user } } = await db.auth.getUser();
            if (!user) { window.location.href = 'index.html'; return; }
            currentUserId = user.id;

            const { data: perfil, error } = await db.from('perfiles').select('*').eq('id', user.id).single();
            if (error) { console.error('Error al cargar perfil:', error); return; }
            
            perfilActual = perfil; // Guardamos el perfil actual para referencia
            nombreOriginal = perfil.nombre || 'Usuario';
            const apodo = perfil.apodo || '';

            const profileApodo = document.getElementById('profileApodo');
            const profileId = document.getElementById('profileId');
            const profileEmail = document.getElementById('profileEmail');
            if (profileApodo) profileApodo.textContent = apodo || nombreOriginal;
            if (profileId) profileId.textContent = `ID: ${perfil.user_id}`;
            if (profileEmail) profileEmail.textContent = perfil.email;

            mostrarAvatar(perfil.avatar_url, nombreOriginal);

            const apodoInput = document.getElementById('apodo');
            if (apodoInput) apodoInput.value = apodo;

            const nombreInput = document.getElementById('nombre');
            if (nombreInput) { nombreInput.value = nombreOriginal; nombreInput.disabled = true; }

            const kycStatus = document.getElementById('kycStatus');
            const estado = perfil.estado_kyc;

            if (!estado || estado === '') {
                if (kycStatus) { kycStatus.className = 'kyc-status pending'; kycStatus.innerHTML = '<i class="fas fa-id-card"></i> Verificación KYC Pendiente'; }
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Guardar Perfil y Enviar KYC'; }
                bloquearCampos(false);
            } else if (estado === 'verificado') {
                if (kycStatus) { kycStatus.className = 'kyc-status verified'; kycStatus.innerHTML = '<i class="fas fa-check-circle"></i> KYC Verificado'; }
                if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> KYC Ya Verificado'; }
                bloquearCampos(true);
            } else if (estado === 'rechazado') {
                if (kycStatus) { kycStatus.className = 'kyc-status rejected'; kycStatus.innerHTML = '<i class="fas fa-times-circle"></i> KYC Rechazado - Puede Reenviar'; }
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Reenviar Documentos'; }
                bloquearCampos(false);
                showMessage('⚠️ Tu KYC fue rechazado. Por favor, corrige la información y reenvía.', 'error');
            } else if (estado === 'pendiente' || estado === 'revision') {
                if (kycStatus) { kycStatus.className = 'kyc-status reviewing'; kycStatus.innerHTML = '<i class="fas fa-hourglass-half"></i> KYC en Revisión'; }
                if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-hourglass-half"></i> En Revisión'; }
                bloquearCampos(true);
                showMessage('⏳ Tus documentos están siendo revisados.', 'info');
            }

            const campos = [
                { id: 'telefono', value: perfil.telefono ? perfil.telefono.split(' ').slice(1).join(' ') : '' },
                { id: 'phoneCountry', value: perfil.telefono ? perfil.telefono.split(' ')[0] : '' },
                { id: 'fechaNacimiento', value: perfil.fecha_nacimiento || '' },
                { id: 'nacionalidad', value: perfil.nacionalidad || '' },
                { id: 'direccion', value: perfil.direccion || '' },
                { id: 'ciudad', value: perfil.ciudad || '' },
                { id: 'estadoProvincia', value: perfil.estado_provincia || '' },
                { id: 'pais', value: perfil.pais || '' },
                { id: 'codigoPostal', value: perfil.codigo_postal || '' },
                { id: 'tipoDocumento', value: perfil.tipo_documento || '' },
                { id: 'numeroDocumento', value: perfil.numero_documento || '' }
            ];
            campos.forEach(c => { const el = document.getElementById(c.id); if (el) el.value = c.value; });

            if (perfil.fecha_nacimiento) validarEdad(perfil.fecha_nacimiento);

            if (perfil.documento_frontal_url) { document.getElementById('docFrontalUrl').value = perfil.documento_frontal_url; setDocStatus('docFront', 'ok'); }
            else setDocStatus('docFront', 'missing');

            if (perfil.documento_trasero_url) { document.getElementById('docTraseroUrl').value = perfil.documento_trasero_url; setDocStatus('docBack', 'ok'); }
            else setDocStatus('docBack', 'optional');

            if (perfil.selfie_url) { document.getElementById('selfieUrl').value = perfil.selfie_url; setDocStatus('selfie', 'ok'); }
            else setDocStatus('selfie', 'missing');

            if (loadingState) loadingState.style.display = 'none';
            if (contentState) contentState.style.display = 'block';

        } catch (err) {
            console.error('Error:', err);
        }
    }

    function mostrarAvatar(avatarUrl, nombre) {
        const avatarInitial = document.getElementById('avatarInitial');
        const avatarImage = document.getElementById('avatarImage');
        if (avatarUrl && !avatarUrl.startsWith('data:')) { // Solo mostrar si es URL real, no base64 temporal
            if (avatarImage) { avatarImage.src = avatarUrl; avatarImage.style.display = 'block'; }
            if (avatarInitial) avatarInitial.style.display = 'none';
        } else if (tempAvatarData) {
            if (avatarImage) { avatarImage.src = tempAvatarData; avatarImage.style.display = 'block'; }
            if (avatarInitial) avatarInitial.style.display = 'none';
        } else {
            if (avatarInitial) { avatarInitial.textContent = (nombre || 'U').charAt(0).toUpperCase(); avatarInitial.style.display = 'flex'; }
            if (avatarImage) avatarImage.style.display = 'none';
        }
    }

    // ========== AVATAR: OPCIONES ==========
    const avatarOptionsModal = document.getElementById('avatarOptionsModal');
    const avatarFileInput = document.getElementById('avatarFileInput');
    const avatarWrapper = document.getElementById('avatarWrapper');

    if (avatarWrapper) {
        avatarWrapper.addEventListener('click', () => {
            tempAvatarData = null;
            if (avatarOptionsModal) avatarOptionsModal.classList.add('show');
        });
    }
    if (document.getElementById('btnAvatarCamera')) {
        document.getElementById('btnAvatarCamera').addEventListener('click', () => {
            if (avatarOptionsModal) avatarOptionsModal.classList.remove('show');
            openCamera('avatar');
        });
    }
    if (document.getElementById('btnAvatarGallery')) {
        document.getElementById('btnAvatarGallery').addEventListener('click', () => {
            if (avatarOptionsModal) avatarOptionsModal.classList.remove('show');
            if (avatarFileInput) avatarFileInput.click();
        });
    }
    if (document.getElementById('btnAvatarCancel')) {
        document.getElementById('btnAvatarCancel').addEventListener('click', () => { 
            if (avatarOptionsModal) avatarOptionsModal.classList.remove('show'); 
        });
    }
    if (avatarFileInput) {
        avatarFileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) { showProfileMessage('⚠️ El archivo debe ser una imagen.', 'error'); return; }
            if (file.size > 5 * 1024 * 1024) { showProfileMessage('⚠️ La imagen es demasiado grande. Máximo 5MB.', 'error'); return; }
            
            const reader = new FileReader();
            reader.onload = function(event) {
                redimensionarImagen(event.target.result, 300, 300, (dataResized) => {
                    tempAvatarData = dataResized;
                    mostrarAvatar(tempAvatarData, nombreOriginal);
                    showProfileMessage('📷 Foto seleccionada. Pulsa "Guardar Cambios" para aplicarla.', 'info');
                });
            };
            reader.readAsDataURL(file);
            avatarFileInput.value = '';
        });
    }

    function redimensionarImagen(dataUrl, maxWidth, maxHeight, callback) {
        const img = new Image();
        img.onload = function() {
            let width = img.width, height = img.height;
            if (width > height) { if (width > maxWidth) { height = Math.round(height * maxWidth / width); width = maxWidth; } }
            else { if (height > maxHeight) { width = Math.round(width * maxHeight / height); height = maxHeight; } }
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = dataUrl;
    }

    // ========== GUARDAR CAMBIOS (Avatar + Apodo) CON STORAGE ==========
    if (btnSaveProfile) {
        btnSaveProfile.addEventListener('click', async () => {
            const apodoInput = document.getElementById('apodo');
            const nuevoApodo = apodoInput ? apodoInput.value.trim() : '';

            if (nuevoApodo.length > 0 && nuevoApodo.length < 2) {
                showProfileMessage('⚠️ El apodo debe tener al menos 2 caracteres.', 'error');
                return;
            }
            if (!tempAvatarData && nuevoApodo === (document.getElementById('profileApodo').textContent)) {
                showProfileMessage('⚠️ No hay cambios para guardar.', 'info');
                return;
            }

            btnSaveProfile.disabled = true;
            btnSaveProfile.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Guardando...';

            try {
                const datosActualizar = { 
                    apodo: nuevoApodo,
                    ultima_actualizacion: new Date().toISOString()
                };
                
                // Si hay nueva imagen, subirla a Storage
                if (tempAvatarData) {
                    const ruta = `${currentUserId}/avatar_${Date.now()}.jpg`;
                    datosActualizar.avatar_url = await subirImagenAStorage(tempAvatarData, ruta);
                }

                const { error } = await db.from('perfiles').update(datosActualizar).eq('id', currentUserId);

                if (error) {
                    showProfileMessage('❌ Error al guardar: ' + error.message, 'error');
                } else {
                    document.getElementById('profileApodo').textContent = nuevoApodo || nombreOriginal;
                    if (tempAvatarData) {
                        mostrarAvatar(datosActualizar.avatar_url, nombreOriginal);
                        tempAvatarData = null; // Limpiar temporal
                    }
                    showProfileMessage('✅ ¡Perfil actualizado correctamente!', 'success');
                }
            } catch (err) {
                showProfileMessage('❌ Error inesperado: ' + err.message, 'error');
            } finally {
                btnSaveProfile.disabled = false;
                btnSaveProfile.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios de Perfil';
            }
        });
    }

    // ========== CÁMARA ==========
    const cameraModal = document.getElementById('cameraModal');
    const modalVideo = document.getElementById('modalVideo');
    const modalCaptureBtn = document.getElementById('modalCaptureBtn');

    window.openCamera = async function(type) {
        currentCameraType = type;
        const title = document.getElementById('modalTitle');
        const errorMsg = document.getElementById('cameraError');
        const titles = { 'docFront': 'Foto del documento (Frente)', 'docBack': 'Foto del documento (Reverso)', 'selfie': 'Selfie con rastreo facial (IA)', 'avatar': 'Foto de perfil' };
        if (title) title.textContent = titles[type] || 'Cámara';
        if (errorMsg) errorMsg.style.display = 'none';
        if (modalCaptureBtn) { 
            modalCaptureBtn.disabled = true; 
            modalCaptureBtn.innerHTML = '<i class="fas fa-camera"></i> Iniciando cámara...'; 
        }

        try {
            currentStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: (type === 'selfie' || type === 'avatar') ? 'user' : 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
            });
            if (modalVideo) modalVideo.srcObject = currentStream;
            if (cameraModal) cameraModal.classList.add('show');
            
            if (modalVideo) {
                modalVideo.onloadeddata = () => {
                    if (type === 'selfie' && faceApiLoaded) startFaceTracking(modalVideo);
                    else if (modalCaptureBtn) { 
                        modalCaptureBtn.disabled = false; 
                        modalCaptureBtn.innerHTML = '<i class="fas fa-camera"></i> Capturar'; 
                    }
                };
            }
        } catch (err) {
            console.error('Error al abrir cámara:', err);
            if (errorMsg) errorMsg.style.display = 'block';
            showMessage('No se pudo acceder a la cámara. Verifica los permisos.', 'error');
        }
    };

    function startFaceTracking(video) {
        const canvas = document.getElementById('faceCanvas');
        const statusDiv = document.getElementById('faceDetectionStatus');
        const detect = async () => {
            if (!currentStream || !cameraModal || !cameraModal.classList.contains('show')) return;
            if (video.readyState < 2) { trackingAnimationId = requestAnimationFrame(detect); return; }
            try {
                const displaySize = { width: video.clientWidth || video.videoWidth, height: video.clientHeight || video.videoHeight };
                if (canvas) faceapi.matchDimensions(canvas, displaySize);
                const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.3 });
                const detection = await faceapi.detectSingleFace(video, options);
                const ctx = canvas ? canvas.getContext('2d') : null;
                if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                if (detection) {
                    const resized = faceapi.resizeResults(detection, displaySize);
                    if (canvas) faceapi.draw.drawDetections(canvas, resized);
                    if (statusDiv) { statusDiv.className = 'face-detection-status success'; statusDiv.textContent = '✅ Rostro humano detectado. ¡Listo para capturar!'; }
                    if (modalCaptureBtn) { 
                        modalCaptureBtn.disabled = false; 
                        modalCaptureBtn.innerHTML = '<i class="fas fa-check-circle"></i> ¡Capturar Selfie!'; 
                        modalCaptureBtn.style.background = '#00ff00'; 
                        modalCaptureBtn.style.color = '#000'; 
                    }
                } else {
                    if (statusDiv) { statusDiv.className = 'face-detection-status detecting'; statusDiv.textContent = '🔍 Buscando rostro... Centra tu cara en el cuadro.'; }
                    if (modalCaptureBtn) { 
                        modalCaptureBtn.disabled = true; 
                        modalCaptureBtn.innerHTML = '<i class="fas fa-camera"></i> Esperando rostro...'; 
                        modalCaptureBtn.style.background = ''; 
                        modalCaptureBtn.style.color = ''; 
                    }
                }
            } catch (err) { console.error('⚠️ Error en detección facial:', err); }
            trackingAnimationId = requestAnimationFrame(detect);
        };
        detect();
    }

    function closeCamera() {
        if (trackingAnimationId) { cancelAnimationFrame(trackingAnimationId); trackingAnimationId = null; }
        const canvas = document.getElementById('faceCanvas');
        const ctx = canvas ? canvas.getContext('2d') : null;
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (currentStream) { currentStream.getTracks().forEach(track => track.stop()); currentStream = null; }
        if (modalVideo) modalVideo.srcObject = null;
        if (cameraModal) cameraModal.classList.remove('show');
    }

    const btnCloseCamera = document.getElementById('btnCloseCamera');
    if (btnCloseCamera) btnCloseCamera.addEventListener('click', closeCamera);

    if (modalCaptureBtn) {
        modalCaptureBtn.addEventListener('click', function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = modalVideo.videoWidth;
            canvas.height = modalVideo.videoHeight;
            ctx.drawImage(modalVideo, 0, 0);
            const imageData = canvas.toDataURL('image/jpeg', 0.8);

            if (currentCameraType === 'avatar') {
                redimensionarImagen(imageData, 300, 300, (dataResized) => {
                    tempAvatarData = dataResized;
                    mostrarAvatar(tempAvatarData, nombreOriginal);
                    showProfileMessage('📷 Foto capturada. Pulsa "Guardar Cambios" para aplicarla.', 'info');
                });
            } else {
                const fieldMap = {
                    'docFront': { url: 'docFrontalUrl', status: 'docFront', required: true },
                    'docBack': { url: 'docTraseroUrl', status: 'docBack', required: false },
                    'selfie': { url: 'selfieUrl', status: 'selfie', required: true }
                };
                const field = fieldMap[currentCameraType];
                if (field) {
                    const inputEl = document.getElementById(field.url);
                    if (inputEl) inputEl.value = imageData; // Se guarda como Base64 temporal, se subirá al enviar el formulario
                    setDocStatus(currentCameraType, 'pending-save');
                }
            }
            closeCamera();
        });
    }

    document.querySelectorAll('[data-camera-btn]').forEach(btn => {
        btn.addEventListener('click', () => { if (!btn.disabled) openCamera(btn.dataset.cameraBtn); });
    });

        // ========== ENVIAR KYC CON MODAL DE TÉRMINOS ==========
    const fullProfileForm = document.getElementById('fullProfileForm');
    const termsModal = document.getElementById('termsModal');
    const termsCheckbox = document.getElementById('termsCheckbox');
    const acceptTermsBtn = document.getElementById('acceptTermsBtn');
    const rejectTermsBtn = document.getElementById('rejectTermsBtn');

    // 1. Interceptamos el envío del formulario
    if (fullProfileForm) {
        fullProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Detenemos el envío real
            
            if (perfilBloqueado) { 
                showMessage('⚠️ No puedes modificar estos datos mientras tu KYC está en revisión o verificado.', 'error'); 
                return; 
            }

            const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
            const fechaNacimiento = val('fechaNacimiento');
            const docFrontal = val('docFrontalUrl');
            const selfie = val('selfieUrl');

            // Validaciones básicas antes de mostrar el modal
            if (!fechaNacimiento) { showMessage('Por favor, selecciona tu fecha de nacimiento.', 'error'); return; }
            if (!edadValida) { showMessage('⚠️ Debes ser mayor de 18 años para registrarte.', 'error'); return; }
            if (!docFrontal) { showMessage('Por favor, toma una foto del frente de tu documento.', 'error'); return; }
            if (!selfie) { showMessage('Por favor, toma una selfie con detección facial.', 'error'); return; }

            // Si todo está bien, mostramos el modal de términos
            termsCheckbox.checked = false; // Resetear checkbox
            acceptTermsBtn.disabled = true; // Deshabilitar botón de aceptar
            if (termsModal) termsModal.classList.add('show');
        });
    }

    // 2. Lógica del Checkbox (Habilitar/Deshabilitar botón)
    if (termsCheckbox && acceptTermsBtn) {
        termsCheckbox.addEventListener('change', function() {
            acceptTermsBtn.disabled = !this.checked;
        });
    }

    // 3. Lógica del Botón Rechazar
    if (rejectTermsBtn && termsModal) {
        rejectTermsBtn.addEventListener('click', () => {
            termsModal.classList.remove('show');
            showMessage('⚠️ Debes aceptar los términos y condiciones para continuar.', 'info');
        });
    }

    // 4. Lógica del Botón Aceptar y Enviar (Aquí va la lógica real de guardado)
    if (acceptTermsBtn) {
        acceptTermsBtn.addEventListener('click', async () => {
            // Ocultar modal
            if (termsModal) termsModal.classList.remove('show');
            
            const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
            
            if (submitBtn) { 
                submitBtn.disabled = true; 
                submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Subiendo documentos...'; 
            }
            showMessage('📤 Procesando imágenes y enviando a verificación...', 'info');

            try {
                // A. Subir imágenes nuevas a Storage (si son Base64)
                const rutaFront = `${currentUserId}/doc_front_${Date.now()}.jpg`;
                const urlFront = await subirImagenAStorage(val('docFrontalUrl'), rutaFront);

                let urlBack = perfilActual.documento_trasero_url;
                const docTrasero = val('docTraseroUrl');
                if (docTrasero && docTrasero.startsWith('data:')) {
                    const rutaBack = `${currentUserId}/doc_back_${Date.now()}.jpg`;
                    urlBack = await subirImagenAStorage(docTrasero, rutaBack);
                }

                const rutaSelfie = `${currentUserId}/selfie_${Date.now()}.jpg`;
                const urlSelfie = await subirImagenAStorage(val('selfieUrl'), rutaSelfie);

                // B. Preparar datos para la BD (Incluyendo la aceptación de términos)
                const datos = {
                    nombre: nombreOriginal,
                    telefono: val('phoneCountry') + ' ' + val('telefono'),
                    fecha_nacimiento: val('fechaNacimiento'),
                    nacionalidad: val('nacionalidad'),
                    direccion: val('direccion'),
                    ciudad: val('ciudad'),
                    estado_provincia: val('estadoProvincia'),
                    pais: val('pais'),
                    codigo_postal: val('codigoPostal'),
                    tipo_documento: val('tipoDocumento'),
                    numero_documento: val('numeroDocumento'),
                    documento_frontal_url: urlFront,
                    documento_trasero_url: urlBack || null,
                    selfie_url: urlSelfie,
                    estado_kyc: 'pendiente',
                    // 🚨 DATOS CRÍTICOS DE CONSENTIMIENTO LEGAL:
                    acepto_terminos: true,
                    fecha_aceptacion_terminos: new Date().toISOString(),
                    ultima_actualizacion: new Date().toISOString()
                };

                if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Guardando en base de datos...';
                
                const { error } = await db.from('perfiles').update(datos).eq('id', currentUserId);
                if (error) throw error;

                showMessage('✅ Perfil guardado, Términos aceptados y KYC enviado. Un administrador revisará tus documentos pronto.', 'success');
                
                // Redirigir al dashboard después de 3 segundos
                setTimeout(() => { window.location.href = 'dashboard.html'; }, 3000);

            } catch (err) {
                console.error('Error al enviar KYC:', err);
                showMessage('❌ Error al procesar: ' + err.message, 'error');
                if (submitBtn) { 
                    submitBtn.disabled = false; 
                    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Guardar Perfil y Enviar KYC'; 
                }
            }
        });
    }
    // Inicialización
    llenarSelectoresPaises();
    preloadFaceModels();
    cargarPerfil();
});
