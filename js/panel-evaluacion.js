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

    // Referencias al DOM
    const videoPreview = document.getElementById('videoPreview');
    const canvasOverlay = document.getElementById('canvasOverlay');
    const btnStartCamera = document.getElementById('btnStartCamera');
    const btnRecord = document.getElementById('btnRecord');
    const btnStop = document.getElementById('btnStop');
    const btnCapture = document.getElementById('btnCapture');
    const evaluationForm = document.getElementById('evaluationForm');
    const messageBox = document.getElementById('messageBox');

    let stream = null;
    let mediaRecorder = null;
    let recordedChunks = [];
    let isRecording = false;
    let lanzamientosSesion = [];

    // ==========================================
    // 1. CONTROL DE CÁMARA
    // ==========================================
    btnStartCamera.addEventListener('click', async function() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'environment'
                },
                audio: false
            });
            videoPreview.srcObject = stream;
            btnStartCamera.disabled = true;
            btnRecord.disabled = false;
            btnCapture.disabled = false;
            showMessage('Cámara iniciada correctamente', 'success');
        } catch (err) {
            console.error('Error al acceder a la cámara:', err);
            showMessage('Error: No se pudo acceder a la cámara. Verifica los permisos.', 'error');
        }
    });

    // ==========================================
    // 2. GRABACIÓN DE VIDEO
    // ==========================================
    btnRecord.addEventListener('click', function() {
        if (!stream) return;
        
        recordedChunks = [];
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9'
        });

        mediaRecorder.ondataavailable = function(e) {
            if (e.data.size > 0) {
                recordedChunks.push(e.data);
            }
        };

        mediaRecorder.onstop = function() {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            videoPreview.src = url;
            videoPreview.controls = true;
            videoPreview.autoplay = false;
        };

        mediaRecorder.start();
        isRecording = true;
        btnRecord.disabled = true;
        btnStop.disabled = false;
        btnCapture.disabled = true;
        showMessage('Grabación iniciada', 'success');
    });

    btnStop.addEventListener('click', function() {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            isRecording = false;
            btnRecord.disabled = false;
            btnStop.disabled = true;
            btnCapture.disabled = false;
            showMessage('Grabación detenida', 'success');
        }
    });

    // ==========================================
    // 3. CAPTURA DE FRAME
    // ==========================================
    btnCapture.addEventListener('click', function() {
        if (!videoPreview.videoWidth) return;

        const canvas = document.createElement('canvas');
        canvas.width = videoPreview.videoWidth;
        canvas.height = videoPreview.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoPreview, 0, 0);

        // Aquí podrías implementar detección de objetos con TensorFlow.js
        // Por ahora, solo mostramos el frame capturado
        const dataURL = canvas.toDataURL('image/png');
        console.log('Frame capturado:', dataURL.substring(0, 50) + '...');
        
        showMessage('Frame capturado para análisis', 'success');
    });

    // ==========================================
    // 4. ENVÍO DEL FORMULARIO
    // ==========================================
    evaluationForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const formData = new FormData(evaluationForm);
        
        // Recopilar datos
        const datosLanzamiento = {
            user_id: session.user.id,
            fecha_hora: new Date().toISOString(),
            
            // A. Contacto
            contacto: formData.get('contacto'),
            
            // B. Aproximación
            aproximacion: formData.get('aproximacion'),
            distancia_exacta: parseFloat(document.getElementById('distanciaExacta').value) || null,
            
            // C. Cuadrante
            cuadrante: formData.get('cuadrante'),
            
            // D. Trayectoria
            trayectoria: formData.get('trayectoria'),
            
            // E. Dirección
            direccion: formData.get('direccion'),
            
            // Variables adicionales
            variables: formData.getAll('variables'),
            
            // Mediciones
            distancia_desplazamiento: parseFloat(document.getElementById('distanciaDesplazamiento').value) || null,
            distancia_final: parseFloat(document.getElementById('distanciaFinal').value) || null,
            
            // Estado
            estado: 'validado'
        };

        try {
            // Guardar en Supabase
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
            
            // Mantener BC-31 marcado por defecto
            document.getElementById('bc31_valido').checked = true;

        } catch (err) {
            console.error('Error al guardar:', err);
            showMessage('❌ Error al registrar el lanzamiento: ' + err.message, 'error');
        }
    });

    // ==========================================
    // 5. ACTUALIZAR ESTADÍSTICAS
    // ==========================================
    function actualizarEstadisticas() {
        const total = lanzamientosSesion.length;
        const boches = lanzamientosSesion.filter(l => 
            l.contacto === 'BC-02' || l.contacto === 'BC-03' || l.contacto === 'BC-04'
        ).length;
        const clavaos = lanzamientosSesion.filter(l => l.contacto === 'BC-03').length;
        const validos = lanzamientosSesion.filter(l => 
            l.variables && l.variables.includes('BC-31')
        ).length;

        // Calcular precisión promedio
        let precisionTotal = 0;
        let precisionCount = 0;
        lanzamientosSesion.forEach(l => {
            if (l.distancia_final !== null) {
                // Invertir: menor distancia = mayor precisión
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

    // ==========================================
    // 6. MENSAJES
    // ==========================================
    function showMessage(text, type) {
        messageBox.textContent = text;
        messageBox.className = `message ${type}`;
        setTimeout(() => {
            messageBox.style.display = 'none';
        }, 4000);
    }

    // ==========================================
    // 7. DETECCIÓN ASISTIDA (BETA)
    // ==========================================
    const autoDetectCheckbox = document.getElementById('autoDetect');
    autoDetectCheckbox.addEventListener('change', function() {
        if (this.checked) {
            showMessage('Detección asistida activada (Beta)', 'success');
            // Aquí implementarías TensorFlow.js o similar
            iniciarDeteccionAsistida();
        } else {
            showMessage('Detección asistida desactivada', 'success');
        }
    });

    function iniciarDeteccionAsistida() {
        // Placeholder para implementación futura con IA
        console.log('Sistema de detección asistida iniciado');
        // Aquí cargarías un modelo de TensorFlow.js
        // Ejemplo: cargar modelo de detección de objetos
    }

    // ==========================================
    // 8. CARGAR ESTADÍSTICAS INICIALES
    // ==========================================
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

    // Inicializar
    cargarEstadisticasIniciales();
});
