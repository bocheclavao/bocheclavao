document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) { console.error('No se pudo obtener el cliente de Supabase'); return; }

    const loadingState = document.getElementById('loadingState');
    const contentState = document.getElementById('contentState');
    const messageDiv = document.getElementById('message');
    const submitBtn = document.getElementById('submitBtn');

    let currentStream = null;
    let currentCameraType = null;
    let faceDetectionReady = false;

    const countries = [
        { code: 'CO', name: 'Colombia', phone: '+57', flag: '🇨🇴' },
        { code: 'MX', name: 'México', phone: '+52', flag: '🇲🇽' },
        { code: 'AR', name: 'Argentina', phone: '+54', flag: '🇦🇷' },
        { code: 'ES', name: 'España', phone: '+34', flag: '🇪🇸' },
        { code: 'US', name: 'Estados Unidos', phone: '+1', flag: '🇺🇸' },
        { code: 'PE', name: 'Perú', phone: '+51', flag: '🇵🇪' },
        { code: 'CL', name: 'Chile', phone: '+56', flag: '🇨🇱' },
        { code: 'VE', name: 'Venezuela', phone: '+58', flag: '🇻🇪' },
        { code: 'EC', name: 'Ecuador', phone: '+593', flag: '🇪🇨' },
        { code: 'GT', name: 'Guatemala', phone: '+502', flag: '🇬🇹' },
        { code: 'CU', name: 'Cuba', phone: '+53', flag: '🇨🇺' },
        { code: 'BO', name: 'Bolivia', phone: '+591', flag: '🇧🇴' },
        { code: 'DO', name: 'República Dominicana', phone: '+1-809', flag: '🇩🇴' },
        { code: 'HN', name: 'Honduras', phone: '+504', flag: '🇭🇳' },
        { code: 'PY', name: 'Paraguay', phone: '+595', flag: '🇵🇾' },
        { code: 'SV', name: 'El Salvador', phone: '+503', flag: '🇸🇻' },
        { code: 'NI', name: 'Nicaragua', phone: '+505', flag: '🇳🇮' },
        { code: 'CR', name: 'Costa Rica', phone: '+506', flag: '🇨🇷' },
        { code: 'PA', name: 'Panamá', phone: '+507', flag: '🇵🇦' },
        { code: 'UY', name: 'Uruguay', phone: '+598', flag: '🇺🇾' },
        { code: 'BR', name: 'Brasil', phone: '+55', flag: '🇧🇷' }
        // Se pueden agregar más países aquí
    ];

    function showMessage(text, type) {
        if (messageDiv) {
            messageDiv.textContent = text;
            messageDiv.className = 'message ' + type;
            messageDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function llenarSelectoresPaises() {
        const phoneSelect = document.getElementById('phoneCountry');
        const nationalitySelect = document.getElementById('nacionalidad');
        const countrySelect = document.getElementById('pais');

        countries.forEach(country => {
            const phoneOption = document.createElement('option');
            phoneOption.value = country.phone;
            phoneOption.textContent = `${country.flag} ${country.phone}`;
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

   async function cargarPerfil() {
    try {
        const { data: { user } } = await db.auth.getUser();
        if (!user) { window.location.href = 'login.html'; return; }

        const { data: perfil, error } = await db.from('perfiles').select('*').eq('id', user.id).single();
        if (error) { console.error('Error al cargar perfil:', error); return; }

        document.getElementById('profileName').textContent = perfil.nombre || 'Usuario';
        document.getElementById('profileId').textContent = `ID: ${perfil.user_id}`;
        document.getElementById('profileEmail').textContent = perfil.email;
        
        const avatarInitial = document.getElementById('avatarInitial');
        const avatarImage = document.getElementById('avatarImage');
        if (perfil.avatar_url) {
            avatarImage.src = perfil.avatar_url;
            avatarImage.style.display = 'block';
            avatarInitial.style.display = 'none';
        } else {
            avatarInitial.textContent = (perfil.nombre || 'U').charAt(0).toUpperCase();
            avatarInitial.style.display = 'flex';
            avatarImage.style.display = 'none';
        }

        const kycStatus = document.getElementById('kycStatus');
        const submitBtn = document.getElementById('submitBtn');
        const kycSection = document.querySelector('.form-section:last-of-type'); // Sección KYC

        if (perfil.estado_kyc === 'verificado') {
            kycStatus.className = 'kyc-status verified';
            kycStatus.innerHTML = '<i class="fas fa-check-circle"></i> KYC Verificado';
            
            // Bloquear formulario KYC
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> KYC Ya Verificado';
                submitBtn.style.background = '#00ff00';
            }
            if (kycSection) {
                kycSection.style.opacity = '0.5';
                kycSection.style.pointerEvents = 'none';
            }
            showMessage('✅ Tu identidad ha sido verificada exitosamente.', 'success');
            
        } else if (perfil.estado_kyc === 'rechazado') {
            kycStatus.className = 'kyc-status rejected';
            kycStatus.innerHTML = '<i class="fas fa-times-circle"></i> KYC Rechazado - Puede Reenviar';
            
            // Permitir reenvío - formulario activo
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Reenviar Documentos para Verificación';
                submitBtn.style.background = '';
            }
            if (kycSection) {
                kycSection.style.opacity = '1';
                kycSection.style.pointerEvents = 'auto';
            }
            showMessage('⚠️ Tu KYC fue rechazado. Por favor, corrige la información y reenvía los documentos.', 'error');
            
        } else {
            // Pendiente - EN REVISIÓN
            kycStatus.className = 'kyc-status pending';
            kycStatus.innerHTML = '<i class="fas fa-hourglass-half"></i> KYC en Revisión';
            
            // Bloquear formulario KYC
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-hourglass-half"></i> En Revisión - No puede reenviar';
                submitBtn.style.background = '#666';
            }
            if (kycSection) {
                kycSection.style.opacity = '0.5';
                kycSection.style.pointerEvents = 'none';
            }
            showMessage('⏳ Tus documentos están siendo revisados. Por favor, espera la aprobación del administrador.', 'info');
        }

        // Llenar formulario con datos existentes
        document.getElementById('nombre').value = perfil.nombre || '';
        document.getElementById('telefono').value = perfil.telefono ? perfil.telefono.split(' ').slice(1).join(' ') : '';
        document.getElementById('phoneCountry').value = perfil.telefono ? perfil.telefono.split(' ')[0] : '';
        document.getElementById('fechaNacimiento').value = perfil.fecha_nacimiento || '';
        document.getElementById('nacionalidad').value = perfil.nacionalidad || '';
        document.getElementById('direccion').value = perfil.direccion || '';
        document.getElementById('ciudad').value = perfil.ciudad || '';
        document.getElementById('pais').value = perfil.pais || '';
        document.getElementById('codigoPostal').value = perfil.codigo_postal || '';
        document.getElementById('tipoDocumento').value = perfil.tipo_documento || '';
        document.getElementById('numeroDocumento').value = perfil.numero_documento || '';

        // Si está pendiente o verificado, deshabilitar campos de KYC
        if (perfil.estado_kyc === 'pendiente' || perfil.estado_kyc === 'verificado') {
            const kycInputs = document.querySelectorAll('#tipoDocumento, #numeroDocumento, input[type="hidden"]');
            kycInputs.forEach(input => input.disabled = true);
        }

        loadingState.style.display = 'none';
        contentState.style.display = 'block';

    } catch (err) {
        console.error('Error:', err);
    }
}

    window.openCamera = async function(type) {
        currentCameraType = type;
        const modal = document.getElementById('cameraModal');
        const video = document.getElementById('modalVideo');
        const title = document.getElementById('modalTitle');
        const errorMsg = document.getElementById('cameraError');

        const titles = { 'docFront': 'Foto del documento (Frente)', 'docBack': 'Foto del documento (Reverso)', 'selfie': 'Selfie con detección facial' };
        title.textContent = titles[type] || 'Cámara';
        errorMsg.style.display = 'none';

        try {
            // Restricciones relajadas para funcionar en PC y móvil
            currentStream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: type === 'selfie' ? 'user' : 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            video.srcObject = currentStream;
            modal.classList.add('show');

            if (type === 'selfie') {
                await initFaceDetection();
            }
        } catch (err) {
            console.error('Error al abrir cámara:', err);
            errorMsg.style.display = 'block';
            showMessage('No se pudo acceder a la cámara. Verifica que tu dispositivo tenga cámara y que el navegador tenga permisos.', 'error');
        }
    };

    window.closeCamera = function() {
        const modal = document.getElementById('cameraModal');
        const video = document.getElementById('modalVideo');
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
        }
        video.srcObject = null;
        modal.classList.remove('show');
    };

    window.captureFromModal = async function() {
        const video = document.getElementById('modalVideo');
        const canvas = document.getElementById('modalCanvas');
        const ctx = canvas.getContext('2d');

        if (currentCameraType === 'selfie' && faceDetectionReady) {
            const statusDiv = document.getElementById('faceDetectionStatus');
            statusDiv.className = 'face-detection-status detecting';
            statusDiv.textContent = '🔍 Analizando rostro con IA...';
            
            const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions());
            if (!detection) {
                statusDiv.className = 'face-detection-status error';
                statusDiv.textContent = '⚠️ No se detectó un rostro humano. Por favor, mira directamente a la cámara.';
                return;
            }
            statusDiv.className = 'face-detection-status success';
            statusDiv.textContent = '✅ Rostro humano detectado correctamente.';
            setTimeout(() => { statusDiv.style.display = 'none'; }, 3000);
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg', 0.7); // Comprimido para ahorrar espacio

        const fieldMap = {
            'docFront': { url: 'docFrontalUrl', preview: 'docFrontPreview', btn: 'btnDocFront' },
            'docBack': { url: 'docTraseroUrl', preview: 'docBackPreview', btn: 'btnDocBack' },
            'selfie': { url: 'selfieUrl', preview: 'selfiePreview', btn: 'btnSelfie' }
        };

        const field = fieldMap[currentCameraType];
        if (field) {
            document.getElementById(field.url).value = imageData;
            document.getElementById(field.preview).innerHTML = `<img src="${imageData}" alt="Captura">`;
            document.getElementById(field.btn).disabled = false;
        }
        closeCamera();
    };

    async function initFaceDetection() {
        const statusDiv = document.getElementById('faceDetectionStatus');
        statusDiv.className = 'face-detection-status detecting';
        statusDiv.textContent = '⏳ Cargando modelos de IA para detección facial...';

        try {
            // Usamos un CDN más estable para los pesos de face-api
            const modelUrl = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model';
            await faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl);
            faceDetectionReady = true;
            statusDiv.className = 'face-detection-status success';
            statusDiv.textContent = '✅ IA lista. Asegúrate de que tu rostro sea visible al capturar.';
            setTimeout(() => { statusDiv.style.display = 'none'; }, 4000);
        } catch (err) {
            console.error('Error cargando Face-API:', err);
            statusDiv.className = 'face-detection-status error';
            statusDiv.textContent = '⚠️ No se pudo cargar la IA. Puedes continuar, pero se recomienda una selfie clara.';
        }
    }

    window.takePhoto = window.captureFromModal; // Alias para los botones

    // UNICO BOTÓN DE GUARDADO
    const fullProfileForm = document.getElementById('fullProfileForm');
    if (fullProfileForm) {
        fullProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const { data: { user } } = await db.auth.getUser();
            
            const docFrontal = document.getElementById('docFrontalUrl').value;
            const docTrasero = document.getElementById('docTraseroUrl').value;
            const selfie = document.getElementById('selfieUrl').value;

            if (!docFrontal) { showMessage('Por favor, toma una foto del frente de tu documento.', 'error'); return; }
            if (!selfie) { showMessage('Por favor, toma una selfie con detección facial.', 'error'); return; }

            const phoneCountry = document.getElementById('phoneCountry').value;
            const telefono = document.getElementById('telefono').value;

            const datos = {
                nombre: document.getElementById('nombre').value,
                telefono: phoneCountry + ' ' + telefono,
                fecha_nacimiento: document.getElementById('fechaNacimiento').value,
                nacionalidad: document.getElementById('nacionalidad').value,
                direccion: document.getElementById('direccion').value,
                ciudad: document.getElementById('ciudad').value,
                pais: document.getElementById('pais').value,
                codigo_postal: document.getElementById('codigoPostal').value,
                tipo_documento: document.getElementById('tipoDocumento').value,
                numero_documento: document.getElementById('numeroDocumento').value,
                documento_frontal_url: docFrontal,
                documento_trasero_url: docTrasero || null,
                selfie_url: selfie,
                estado_kyc: 'pendiente',
                ultima_actualizacion: new Date().toISOString()
            };

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Enviando...';
            showMessage('📤 Guardando perfil y enviando documentos para verificación...', 'info');

            const { error } = await db.from('perfiles').update(datos).eq('id', user.id);

            if (error) {
                showMessage('Error al guardar: ' + error.message, 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Guardar Perfil y Enviar KYC';
            } else {
                showMessage('✅ Perfil guardado y KYC enviado. Un administrador revisará tus documentos pronto.', 'success');
                setTimeout(() => { window.location.href = 'dashboard.html'; }, 3000);
            }
        });
    }

    llenarSelectoresPaises();
    cargarPerfil();
});
