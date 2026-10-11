document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) { 
        console.error('No se pudo obtener el cliente de Supabase'); 
        return; 
    }

    // ========== REFERENCIAS AL DOM ==========
    const statsBar = document.getElementById('statsBar');
    const streamActivo = document.getElementById('streamActivo');
    const streamStatusText = document.getElementById('streamStatusText');
    const streamTitulo = document.getElementById('streamTitulo');
    const streamDescripcion = document.getElementById('streamDescripcion');
    const streamTipo = document.getElementById('streamTipo');
    const streamUrl = document.getElementById('streamUrl');
    const streamEspectadores = document.getElementById('streamEspectadores');
    const btnGuardarStream = document.getElementById('btnGuardarStream');
    const streamStatusMsg = document.getElementById('streamStatusMsg');
    const urlHint = document.getElementById('urlHint');
    const videoContainer = document.getElementById('videoContainer');
    const videoPlaceholder = document.getElementById('videoPlaceholder');
    const liveVideo = document.getElementById('liveVideo');
    const liveIframe = document.getElementById('liveIframe');
    const btnRefreshPreview = document.getElementById('btnRefreshPreview');
    const previewLiveBadge = document.getElementById('previewLiveBadge');

    let hlsInstance = null;
    let configActual = null;

    // ========== DETECTAR TIPO DE URL ==========
    function detectarTipoUrl(url) {
        if (!url) return null;
        if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
        if (url.includes('twitch.tv')) return 'twitch';
        if (url.includes('.m3u8')) return 'hls';
        return null;
    }

    // ========== CONSTRUIR URL EMBED ==========
    function buildEmbedUrl(url, tipo) {
        if (tipo === 'youtube') {
            let embedUrl = url;
            if (url.includes('/live/')) {
                const videoId = url.split('/live/')[1]?.split('?')[0];
                if (videoId) embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
            } else if (url.includes('/watch?v=')) {
                const videoId = url.split('v=')[1]?.split('&')[0];
                if (videoId) embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
            } else if (url.includes('youtu.be/')) {
                const videoId = url.split('youtu.be/')[1]?.split('?')[0];
                if (videoId) embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
            }
            return embedUrl;
        }
        if (tipo === 'twitch') {
            // Extraer nombre del canal
            let channel = url.replace('https://', '').replace('http://', '').replace('www.', '');
            channel = channel.split('twitch.tv/')[1] || channel;
            channel = channel.split('?')[0].split('/')[0];
            const parent = window.location.hostname || 'localhost';
            return `https://player.twitch.tv/?channel=${channel}&parent=${parent}&muted=true`;
        }
        return url; // hls
    }

    // ========== MOSTRAR HINT DE URL ==========
    function mostrarHintUrl() {
        const url = streamUrl.value.trim();
        const tipo = detectarTipoUrl(url);
        
        if (!url) { urlHint.classList.remove('show'); return; }
        
        if (tipo) {
            // Autoseleccionar tipo
            streamTipo.value = tipo;
            const nombres = { youtube: 'YouTube', twitch: 'Twitch', hls: 'HLS' };
            urlHint.className = 'url-hint show';
            urlHint.innerHTML = `<i class="fas fa-check-circle" style="color: #00ff00;"></i> Detectado: <strong>${nombres[tipo]}</strong>. Se convertirá automáticamente al guardar.`;
        } else {
            urlHint.className = 'url-hint show';
            urlHint.innerHTML = `<i class="fas fa-exclamation-triangle" style="color: #FFA500;"></i> URL no reconocida. Usa formatos de YouTube, Twitch o un .m3u8`;
        }
    }

    // ========== RENDERIZAR ESTADÍSTICAS ==========
    function renderStats(config) {
        const activo = config && config.activo;
        const nombres = { youtube: 'YouTube', twitch: 'Twitch', hls: 'HLS' };
        const ultima = config && config.ultima_actualizacion 
            ? new Date(config.ultima_actualizacion).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
            : '---';
        
        statsBar.innerHTML = `
            <div class="stat-box ${activo ? 'live' : ''}">
                <div class="number">${activo ? 'EN VIVO' : 'OFF'}</div>
                <div class="label">Estado</div>
            </div>
            <div class="stat-box">
                <div class="number" style="font-size: 1.2rem;">${config ? (nombres[config.tipo_stream] || '---') : '---'}</div>
                <div class="label">Tipo de Stream</div>
            </div>
            <div class="stat-box">
                <div class="number">${config && config.espectadores ? config.espectadores : 0}</div>
                <div class="label">Espectadores</div>
            </div>
            <div class="stat-box">
                <div class="number" style="font-size: 1rem;">${ultima}</div>
                <div class="label">Última Actualización</div>
            </div>
        `;
        
        if (previewLiveBadge) {
            previewLiveBadge.innerHTML = activo 
                ? '<span class="live-badge"><span class="live-dot"></span> EN VIVO</span>' 
                : '<span class="offline-badge">OFF</span>';
        }
    }

    // ========== CARGAR CONFIGURACIÓN ==========
    async function cargarConfigStream() {
        try {
            const { data: config, error } = await db.from('config_stream_vivo').select('*').eq('id', 1).single();
            
            if (error && error.code !== 'PGRST116') {
                console.error('Error cargando config:', error);
                renderStats(null);
                return;
            }
            
            configActual = config || null;
            
            if (config) {
                streamActivo.checked = config.activo;
                streamTitulo.value = config.titulo || '';
                streamDescripcion.value = config.descripcion || '';
                streamTipo.value = config.tipo_stream || 'youtube';
                streamUrl.value = config.url_stream || '';
                streamEspectadores.value = config.espectadores || 0;
            }
            
            actualizarTextoEstado();
            renderStats(config);
            
        } catch (err) {
            console.error('Error en cargarConfigStream:', err);
            renderStats(null);
        }
    }

    function actualizarTextoEstado() {
        if (streamActivo.checked) {
            streamStatusText.textContent = 'Activada (EN VIVO)';
            streamStatusText.style.color = '#00ff00';
        } else {
            streamStatusText.textContent = 'Desactivada';
            streamStatusText.style.color = '#999';
        }
    }

    // ========== VISTA PREVIA ==========
    function destruirHls() {
        if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
    }

    function cargarPreview() {
        const url = streamUrl.value.trim();
        const tipo = streamTipo.value;
        
        destruirHls();
        videoPlaceholder.style.display = 'none';
        liveVideo.style.display = 'none';
        liveIframe.style.display = 'none';
        liveIframe.src = '';
        liveVideo.src = '';
        
        if (!url) {
            videoPlaceholder.style.display = 'flex';
            return;
        }
        
        videoContainer.classList.toggle('live-border', streamActivo.checked);
        
        if (tipo === 'youtube' || tipo === 'twitch') {
            liveIframe.style.display = 'block';
            liveIframe.src = buildEmbedUrl(url, tipo);
        } else if (tipo === 'hls') {
            liveVideo.style.display = 'block';
            if (typeof Hls !== 'undefined' && Hls.isSupported()) {
                hlsInstance = new Hls();
                hlsInstance.loadSource(url);
                hlsInstance.attachMedia(liveVideo);
                hlsInstance.on(Hls.Events.MANIFEST_PARSED, function() {
                    liveVideo.play().catch(e => console.log('Autoplay bloqueado:', e));
                });
                hlsInstance.on(Hls.Events.ERROR, function(event, data) {
                    if (data.fatal) {
                        console.error('Error HLS:', data);
                        liveVideo.style.display = 'none';
                        videoPlaceholder.style.display = 'flex';
                        videoPlaceholder.querySelector('p').textContent = 'Error al cargar el stream HLS';
                    }
                });
            } else if (liveVideo.canPlayType('application/vnd.apple.mpegurl')) {
                liveVideo.src = url;
                liveVideo.addEventListener('loadedmetadata', function() {
                    liveVideo.play().catch(e => console.log('Autoplay bloqueado:', e));
                });
            }
        }
    }

    // ========== GUARDAR CONFIGURACIÓN ==========
    async function guardarConfigStream() {
        streamStatusMsg.style.display = 'none';
        streamStatusMsg.className = 'stream-status-msg';
        
        const datos = {
            activo: streamActivo.checked,
            titulo: streamTitulo.value.trim(),
            descripcion: streamDescripcion.value.trim(),
            tipo_stream: streamTipo.value,
            url_stream: streamUrl.value.trim(),
            espectadores: parseInt(streamEspectadores.value) || 0,
            ultima_actualizacion: new Date().toISOString()
        };
        
        if (!datos.titulo) {
            streamStatusMsg.textContent = '⚠️ El título del evento es obligatorio.';
            streamStatusMsg.classList.add('error');
            return;
        }
        if (datos.activo && !datos.url_stream) {
            streamStatusMsg.textContent = '⚠️ Debes ingresar una URL de stream si activas la transmisión.';
            streamStatusMsg.classList.add('error');
            return;
        }
        
        btnGuardarStream.disabled = true;
        btnGuardarStream.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Guardando...';
        
        try {
            const { data, error } = await db.from('config_stream_vivo').update(datos).eq('id', 1).select();
            
            if (error) throw error;
            
            if (!data || data.length === 0) {
                datos.id = 1;
                const { error: insertError } = await db.from('config_stream_vivo').insert(datos);
                if (insertError) throw insertError;
            }
            
            streamStatusMsg.textContent = '✅ Configuración guardada exitosamente. Los usuarios ya ven el cambio.';
            streamStatusMsg.classList.add('success');
            setTimeout(() => { streamStatusMsg.style.display = 'none'; }, 4000);
            
            await cargarConfigStream();
            cargarPreview();
            
        } catch (err) {
            console.error('Error guardando stream:', err);
            streamStatusMsg.textContent = '❌ Error al guardar: ' + err.message;
            streamStatusMsg.classList.add('error');
        } finally {
            btnGuardarStream.disabled = false;
            btnGuardarStream.innerHTML = '<i class="fas fa-save"></i> Guardar y Actualizar Transmisión';
        }
    }

    // ========== EVENTOS ==========
    streamActivo.addEventListener('change', function() {
        actualizarTextoEstado();
        videoContainer.classList.toggle('live-border', this.checked);
    });
    
    streamUrl.addEventListener('input', mostrarHintUrl);
    streamUrl.addEventListener('blur', mostrarHintUrl);
    
    btnGuardarStream.addEventListener('click', guardarConfigStream);
    btnRefreshPreview.addEventListener('click', cargarPreview);

    // ========== INICIALIZAR ==========
    await cargarConfigStream();
});
