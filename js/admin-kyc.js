document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) { 
        console.error('No se pudo obtener el cliente de Supabase'); 
        return; 
    }

    const containerKyc = document.getElementById('containerKyc');
    const loadingKyc = document.getElementById('loadingKyc');
    const statsBar = document.getElementById('statsBar');

    // ============================================
    // CARGAR ESTADÍSTICAS (Barra superior)
    // ============================================
    async function cargarEstadisticas() {
        try {
            const { data: pendientes } = await db.from('perfiles').select('id', { count: 'exact' }).eq('estado_kyc', 'pendiente');
            const { data: verificados } = await db.from('perfiles').select('id', { count: 'exact' }).eq('estado_kyc', 'verificado');
            const { data: rechazados } = await db.from('perfiles').select('id', { count: 'exact' }).eq('estado_kyc', 'rechazado');
            const { data: sinKyc } = await db.from('perfiles').select('id', { count: 'exact' }).is('estado_kyc', null);
            const { data: bloqueados } = await db.from('perfiles').select('id', { count: 'exact' }).eq('bloqueado', true);
            
            statsBar.innerHTML = `
                <div class="stat-box">
                    <div class="number" style="color: #FFA500;">${pendientes?.length || 0}</div>
                    <div class="label">Pendientes KYC</div>
                </div>
                <div class="stat-box">
                    <div class="number" style="color: #00ff00;">${verificados?.length || 0}</div>
                    <div class="label">Verificados</div>
                </div>
                <div class="stat-box">
                    <div class="number" style="color: #ff4444;">${rechazados?.length || 0}</div>
                    <div class="label">Rechazados</div>
                </div>
                <div class="stat-box">
                    <div class="number" style="color: #999;">${sinKyc?.length || 0}</div>
                    <div class="label">Sin KYC</div>
                </div>
                <div class="stat-box">
                    <div class="number" style="color: #666;">${bloqueados?.length || 0}</div>
                    <div class="label">Bloqueados</div>
                </div>
            `;
        } catch (err) { 
            console.error('Error cargando estadísticas:', err); 
        }
    }

    // ============================================
    // CARGAR SOLICITUDES KYC PENDIENTES
    // ============================================
    async function cargarSolicitudesKYC() {
        loadingKyc.style.display = 'block';
        containerKyc.innerHTML = '';
        
        try {
            const { data: perfiles, error } = await db
                .from('perfiles')
                .select('*')
                .eq('estado_kyc', 'pendiente')
                .order('ultima_actualizacion', { ascending: false });
                
            loadingKyc.style.display = 'none';
            
            if (error) { 
                containerKyc.innerHTML = `<p class="empty">Error: ${error.message}</p>`; 
                return; 
            }
            
            if (!perfiles || perfiles.length === 0) { 
                containerKyc.innerHTML = `
                    <p class="empty">
                        <i class="fas fa-check-circle" style="font-size: 3rem; color: #00ff00; margin-bottom: 15px; display: block;"></i>
                        ¡No hay solicitudes pendientes!
                    </p>
                `; 
                return; 
            }
            
            perfiles.forEach(perfil => { 
                containerKyc.appendChild(crearCardKYC(perfil)); 
            });
        } catch (err) { 
            console.error('Error:', err); 
            loadingKyc.style.display = 'none'; 
        }
    }

    // ============================================
    // CREAR CARD KYC
    // ============================================
    function crearCardKYC(perfil) {
        const card = document.createElement('div');
        card.className = 'user-card';
        card.innerHTML = `
            <div class="user-header">
                <div>
                    <div class="user-name">${perfil.nombre || 'Sin nombre'}</div>
                    <div class="user-id">ID: ${perfil.user_id} | ${perfil.email}</div>
                </div>
                <div style="text-align: right;">
                    <span class="status-badge status-pending">PENDIENTE</span>
                    <div style="color: #FFD700; font-weight: 700; margin-top: 5px;">${perfil.tipo_documento || 'No especificado'}</div>
                    <div style="color: #999; font-size: 0.9rem;">${perfil.numero_documento || '---'}</div>
                </div>
            </div>
            <div class="info-grid">
                <div class="info-item"><label>Nacionalidad</label><span>${perfil.nacionalidad || '---'}</span></div>
                <div class="info-item"><label>País</label><span>${perfil.pais || '---'}</span></div>
                <div class="info-item"><label>Ciudad</label><span>${perfil.ciudad || '---'}</span></div>
                <div class="info-item"><label>Teléfono</label><span>${perfil.telefono || '---'}</span></div>
                <div class="info-item"><label>Fecha Nac.</label><span>${perfil.fecha_nacimiento || '---'}</span></div>
                <div class="info-item"><label>Enviado</label><span>${perfil.ultima_actualizacion ? new Date(perfil.ultima_actualizacion).toLocaleString() : '---'}</span></div>
            </div>
            <div class="images-grid">
                <div class="image-box">
                    <img src="${perfil.documento_frontal_url || 'https://via.placeholder.com/300x200?text=Sin+Foto'}" onclick="window.open(this.src)">
                    <p>Documento (Frente)</p>
                </div>
                <div class="image-box">
                    <img src="${perfil.documento_trasero_url || 'https://via.placeholder.com/300x200?text=Sin+Foto'}" onclick="window.open(this.src)">
                    <p>Documento (Reverso)</p>
                </div>
                <div class="image-box">
                    <img src="${perfil.selfie_url || 'https://via.placeholder.com/300x200?text=Sin+Foto'}" onclick="window.open(this.src)">
                    <p>Selfie</p>
                </div>
            </div>
            <div class="actions">
                <button class="btn btn-approve" onclick="procesarKYC('${perfil.id}', 'verificado')">
                    <i class="fas fa-check"></i> Aprobar
                </button>
                <button class="btn btn-reject" onclick="procesarKYC('${perfil.id}', 'rechazado')">
                    <i class="fas fa-times"></i> Rechazar
                </button>
            </div>
        `;
        return card;
    }

    // ============================================
    // PROCESAR KYC (Aprobar o Rechazar)
    // ============================================
    window.procesarKYC = async function(userId, nuevoEstado) {
        const confirmMsg = nuevoEstado === 'verificado' 
            ? '¿Aprobar este KYC?' 
            : '¿Rechazar este KYC? Se limpiarán los documentos.';
            
        if (!confirm(confirmMsg)) return;
        
        const datosActualizar = { 
            estado_kyc: nuevoEstado, 
            ultima_actualizacion: new Date().toISOString() 
        };
        
        if (nuevoEstado === 'rechazado') {
            datosActualizar.documento_frontal_url = null;
            datosActualizar.documento_trasero_url = null;
            datosActualizar.selfie_url = null;
        }
        
        const { error } = await db.from('perfiles').update(datosActualizar).eq('id', userId);
        
        if (error) { 
            alert('Error: ' + error.message); 
        } else { 
            alert(`KYC ${nuevoEstado === 'verificado' ? 'aprobado' : 'rechazado'} exitosamente.`); 
            await cargarEstadisticas(); 
            await cargarSolicitudesKYC(); 
        }
    };

    // ============================================
    // INICIALIZAR
    // ============================================
    await cargarEstadisticas();
    await cargarSolicitudesKYC();
});
