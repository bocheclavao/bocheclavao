document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) {
        console.error('No se pudo cargar Supabase');
        return;
    }

    // Verificar sesión de admin
    const { data: { session } } = await db.auth.getSession();
    if (!session || !session.user) {
        window.location.href = 'index.html';
        return;
    }

    // ========== ESTADO GLOBAL ==========
    let cameras = {
        1: { stream: null, recorder: null, chunks: [], active: false },
        2: { stream: null, recorder: null, chunks: [], active: false },
        3: { stream: null, recorder: null, chunks: [], active: false },
        4: { stream: null, recorder: null, chunks: [], active: false }
    };
    let isRecording = false;
    let recordingStartTime = null;
    let recordingTimer = null;
    let lanzamientosSesion = [];
    let currentViewMode = 1;

    // ========== REFERENCIAS AL DOM ==========
    const messageBox = document.getElementById('messageBox');
    const cameraGrid = document.getElementById('cameraGrid');
    const videoGrid = document.getElementById('videoGrid');
    const viewModeSelect = document.getElementById('viewMode');
    const btnStartCameras = document.getElementById('btnStartCameras');
    const btnRecord = document.getElementById('btnRecord');
    const btnStop = document.getElementById('btnStop');
    const btnCapture = document.getElementById('btnCapture');
    const recordingIndicator = document.getElementById('recordingIndicator');
    const recordingTime = document.getElementById('recordingTime');
    const evaluationForm = document.getElementById('evaluationForm');
    const autoDetectCheckbox = document.getElementById('autoDetect');

    // ========== UTILIDADES ==========
    function showMessage(text, type) {
        messageBox.textContent = text;
        messageBox.className = `message ${type}`;
        setTimeout(() => {
            messageBox.style.display = 'none';
        }, 4000);
    }

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // ========== SELECTOR DE MODO DE VISTA ==========
    function updateViewMode(mode) {
        currentViewMode = mode;
        videoGrid.className = `video-grid mode-${mode}`;
        
        // Mostrar/ocultar celdas de video
        for (let i = 1; i <= 4; i++) {
            const cell = videoGrid.querySelector(`[data-camera="${i}"]`);
            if (i <= mode) {
                cell.style.display = 'block';
            } else {
                cell.style.display = 'none';
            }
        }

        // Actualizar botones de modo
        document.querySelectorAll('.view-mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode == mode);
        });

        // Actualizar select
        viewModeSelect.value = mode;
    }

    document.querySelectorAll('.view-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            updateViewMode(parseInt(btn.dataset.mode));
        });
    });

    viewModeSelect.addEventListener('change', (e) => {
        updateViewMode(parseInt(e.target.value));
    });

    // ========== INICIAR CÁMARAS ==========
    btnStartCameras.addEventListener('click', async () => {
        try {
            showMessage('Solicitando acceso a las cámaras...', 'success');

            // Obtener dispositivos de video
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');

            if (videoDevices.length === 0) {
                showMessage('No se encontraron cámaras disponibles', 'error');
                return;
            }

            // Iniciar cámara 1 (siempre)
            await startCamera(1, videoDevices[0]?.deviceId);

            // Iniciar cámaras adicionales según el modo de vista
            if (currentViewMode >= 2 && videoDevices.length >= 2) {
                await startCamera(2, videoDevices[1]?.deviceId);
            }
            if (currentViewMode >= 3 && videoDevices.length >= 3) {
                await startCamera(3, videoDevices[2]?.deviceId);
            }
            if (currentViewMode >= 4 && videoDevices.length >= 4) {
                await startCamera(4, videoDevices[3]?.deviceId);
            }

            btnStartCameras.disabled = true;
            btnRecord.disabled = false;
            btnCapture.disabled = false;

            showMessage(`✅ ${Object.values(cameras).filter(c => c.active).length} cámara(s) iniciada(s) correctamente`, 'success');

        } catch (err) {
            console.error('Error al acceder a las cámaras:', err);
            showMessage('Error: No se pudo acceder a las cámaras. Verifica los permisos.', 'error');
        }
    });

    async function startCamera(cameraNum, deviceId) {
        try {
            const constraints = {
                video: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    facingMode: 'environment'
                },
                audio: false
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            cameras[cameraNum].stream = stream;
            cameras[cameraNum].active = true;

            const video = document.getElementById(`video${cameraNum}`);
            video.srcObject = stream;
            video.style.display = 'block';

            // Ocultar placeholder
            const cell = videoGrid.querySelector(`[data-camera="${cameraNum}"]`);
            const placeholder = cell.querySelector('.video-cell-placeholder');
            if (placeholder) placeholder.style.display = 'none';

            // Actualizar estado
            const status = cell.querySelector('.video-cell-status');
            status.className = 'video-cell-status live';
            status.textContent = 'LIVE';

            cell.classList.add('active');

            // Actualizar slot en el selector
            const slot = cameraGrid.querySelector(`[data-camera="${cameraNum}"]`);
            slot.classList.add('active');
            slot.classList.remove('disabled');
            const slotStatus = slot.querySelector('.camera-slot-status');
            slotStatus.className = 'camera-slot-status';
            slotStatus.textContent = 'ONLINE';

        } catch (err) {
            console.error(`Error iniciando cámara ${cameraNum}:`, err);
            showMessage(`Error al iniciar cámara ${cameraNum}: ${err.message}`, 'error');
        }
    }

    // ========== GRABACIÓN SINCRONIZADA ==========
    btnRecord.addEventListener('click', () => {
        if (isRecording) return;

        // Limpiar chunks anteriores
        Object.values(cameras).forEach(cam => {
            cam.chunks = [];
        });

        // Iniciar grabación en todas las cámaras activas
        Object.entries(cameras).forEach(([num, cam]) => {
            if (cam.active && cam.stream) {
                try {
                    cam.recorder = new MediaRecorder(cam.stream, {
                        mimeType: 'video/webm;codecs=vp9'
                    });

                    cam.recorder.ondataavailable = (e) => {
                        if (e.data.size > 0) {
                            cam.chunks.push(e.data);
                        }
                    };

                    cam.recorder.start();
                } catch (err) {
                    console.error(`Error iniciando grabación en cámara ${num}:`, err);
                }
            }
        });

        isRecording = true;
        recordingStartTime = Date.now();

        // Iniciar timer
        recordingTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
            recordingTime.textContent = formatTime(elapsed);
        }, 1000);

        // Actualizar UI
        recordingIndicator.classList.add('active');
        btnRecord.disabled = true;
        btnStop.disabled = false;
        btnCapture.disabled = true;

        showMessage('🔴 Grabación iniciada en todas las cámaras', 'success');
    });

    btnStop.addEventListener('click', () => {
        if (!isRecording) return;

        // Detener grabación en todas las cámaras
        Object.entries(cameras).forEach(([num, cam]) => {
            if (cam.recorder && cam.recorder.state !== 'inactive') {
                cam.recorder.stop();

                cam.recorder.onstop = () => {
                    const blob = new Blob(cam.chunks, { type: 'video/webm' });
                    const url = URL.createObjectURL(blob);
                    
                    // Mostrar video grabado en la celda correspondiente
                    const video = document.getElementById(`video${num}`);
                    video.src = url;
                    video.controls = true;
                    video.autoplay = false;
                    video.muted = false;
                };
            }
        });

        isRecording = false;
        clearInterval(recordingTimer);

        // Actualizar UI
        recordingIndicator.classList.remove('active');
        recordingTime.textContent = '00:00';
        btnRecord.disabled = false;
        btnStop.disabled = true;
        btnCapture.disabled = false;

        showMessage('✅ Grabación detenida', 'success');
    });

    // ========== CAPTURA DE FRAME ==========
    btnCapture.addEventListener('click', () => {
        const activeCameras = Object.entries(cameras).filter(([num, cam]) => cam.active);
        
        if (activeCameras.length === 0) {
            showMessage('No hay cámaras activas para capturar', 'error');
            return;
        }

        // Capturar frame de la primera cámara activa
        const [cameraNum, cam] = activeCameras[0];
        const video = document.getElementById(`video${cameraNum}`);

        if (!video.videoWidth) {
            showMessage('No se puede capturar el frame', 'error');
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        const dataURL = canvas.toDataURL('image/png');
        console.log(`Frame capturado de cámara ${cameraNum}:`, dataURL.substring(0, 50) + '...');

        showMessage(`📸 Frame capturado de la cámara ${cameraNum}`, 'success');

        // Aquí podrías enviar el frame a la IA para análisis
        if (autoDetectCheckbox.checked) {
            analizarFrameConIA(dataURL, cameraNum);
        }
    });

    // ========== DETECCIÓN ASISTIDA (PLACEHOLDER PARA FASE 2) ==========
    autoDetectCheckbox.addEventListener('change', function() {
        if (this.checked) {
            showMessage('🤖 Detección asistida activada (Beta)', 'success');
            console.log('Sistema de detección asistida iniciado');
            // Aquí cargarías TensorFlow.js y el modelo YOLOv8
        } else {
            showMessage('Detección asistida desactivada', 'success');
        }
    });

    function analizarFrameConIA(dataURL, cameraNum) {
        // PLACEHOLDER: Aquí implementarías TensorFlow.js + YOLOv8
        console.log(`Analizando frame de cámara ${cameraNum} con IA...`);
        
        // Ejemplo de respuesta esperada de la IA:
        // const resultado = {
        //     contacto: 'BC-03',
        //     aproximacion: 'BC-05',
        //     distancia_exacta: 8.5,
        //     trayectoria: 'BC-13',
        //     cuadrante: 'BC-09',
        //     confianza: 0.94
        // };
        // prellenarFormulario(resultado);
    }

    function prellenarFormulario(resultado) {
        // Marcar radio buttons
        if (resultado.contacto) {
            const radio = document.querySelector(`input[name="contacto"][value="${resultado.contacto}"]`);
            if (radio) radio.checked = true;
        }
        if (resultado.aproximacion) {
            const radio = document.querySelector(`input[name="aproximacion"][value="${resultado.aproximacion}"]`);
            if (radio) radio.checked = true;
        }
        if (resultado.distancia_exacta) {
            document.getElementById('distanciaExacta').value = resultado.distancia_exacta;
        }
        if (resultado.cuadrante) {
            const radio = document.querySelector(`input[name="cuadrante"][value="${resultado.cuadrante}"]`);
            if (radio) radio.checked = true;
        }
        if (resultado.trayectoria) {
            const radio = document.querySelector(`input[name="trayectoria"][value="${resultado.trayectoria}"]`);
            if (radio) radio.checked = true;
        }
        if (resultado.direccion) {
            const radio = document.querySelector(`input[name="direccion"][value="${resultado.direccion}"]`);
            if (radio) radio.checked = true;
        }

        showMessage(`🤖 IA sugirió clasificación con ${(resultado.confianza * 100).toFixed(1)}% de confianza`, 'success');
    }

    // ========== ENVÍO DEL FORMULARIO ==========
    evaluationForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(evaluationForm);

        const datosLanzamiento = {
            user_id: session.user.id,
            fecha_hora: new Date().toISOString(),
            contacto: formData.get('contacto'),
            aproximacion: formData.get('aproximacion'),
            distancia_exacta: parseFloat(document.getElementById('distanciaExacta').value) || null,
            cuadrante: formData.get('cuadrante'),
            trayectoria: formData.get('trayectoria'),
            direccion: formData.get('direccion'),
            variables: formData.getAll('variables'),
            distancia_desplazamiento: parseFloat(document.getElementById('distanciaDesplazamiento').value) || null,
            distancia_final: parseFloat(document.getElementById('distanciaFinal').value) || null,
            estado: 'validado'
        };

        try {
            const { data, error } = await db
                .from('lanzamientos')
                .insert([datosLanzamiento])
                .select();

            if (error) throw error;

            lanzamientosSesion.push(datosLanzamiento);
            actualizarEstadisticas();

            showMessage('✅ Lanzamiento registrado exitosamente', 'success');

            // Resetear formulario
            evaluationForm.reset();
            document.getElementById('bc31_valido').checked = true;

        } catch (err) {
            console.error('Error al guardar:', err);
            showMessage('❌ Error al registrar el lanzamiento: ' + err.message, 'error');
        }
    });

    // ========== ACTUALIZAR ESTADÍSTICAS ==========
    function actualizarEstadisticas() {
        const total = lanzamientosSesion.length;
        const boches = lanzamientosSesion.filter(l =>
            l.contacto === 'BC-02' || l.contacto === 'BC-03' || l.contacto === 'BC-04'
        ).length;
        const clavaos = lanzamientosSesion.filter(l => l.contacto === 'BC-03').length;
        const validos = lanzamientosSesion.filter(l =>
            l.variables && l.variables.includes('BC-31')
        ).length;

        let precisionTotal = 0;
        let precisionCount = 0;
        lanzamientosSesion.forEach(l => {
            if (l.distancia_final !== null) {
                const precision = Math.max(0, 100 - (l.distancia_final * 2));
                precisionTotal += precision;
                precisionCount++;
            }
        });

        const precisionPromedio = precisionCount > 0 ? (precisionTotal / precisionCount).toFixed(1) : 0;

        document.getElementById('statTotal').textContent = total;
        document.getElementById('statBoches').textContent = boches;
        document.getElementById('statClavaos').textContent = clavaos;
        document.getElementById('statValidos').textContent = validos;
        document.getElementById('statPrecision').textContent = precisionPromedio + '%';
    }

    // ========== CARGAR ESTADÍSTICAS INICIALES ==========
    async function cargarEstadisticasIniciales() {
        try {
            const { data, error } = await db
                .from('lanzamientos')
                .select('*')
                .eq('user_id', session.user.id)
                .order('fecha_hora', { ascending: false })
                .limit(100);

            if (error) throw error;

            lanzamientosSesion = data || [];
            actualizarEstadisticas();
        } catch (err) {
            console.error('Error al cargar estadísticas:', err);
        }
    }

    // ========== INICIALIZAR ==========
    updateViewMode(1);
    cargarEstadisticasIniciales();
});
