document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) { 
        console.error('No se pudo obtener el cliente de Supabase'); 
        return; 
    }

    // ========== REFERENCIAS AL DOM ==========
    const containerKyc = document.getElementById('containerKyc');
    const loadingKyc = document.getElementById('loadingKyc');
    const statsBar = document.getElementById('statsBar');
    const pagination = document.getElementById('pagination');
    const resultsInfo = document.getElementById('resultsInfo');
    const resultsInfoText = document.getElementById('resultsInfoText');
    const searchInput = document.getElementById('searchInput');
    const searchType = document.getElementById('searchType');
    const fechaDesde = document.getElementById('fechaDesde');
    const fechaHasta = document.getElementById('fechaHasta');
    const btnBuscar = document.getElementById('btnBuscar');
    const btnLimpiar = document.getElementById('btnLimpiar');
    const btnAplicarFiltro = document.getElementById('btnAplicarFiltro');

    // ========== ESTADO GLOBAL ==========
    let currentPage = 1;
    const itemsPerPage = 20;
    let totalCount = 0;
    let currentSearch = { type: 'user_id', value: '' };
    let currentDates = { desde: null, hasta: null };

    // ========== ESTADÍSTICAS ==========
    async function cargarEstadisticas() {
        try {
            const [pendientes, verificados, rechazados, sinKyc, bloqueados] = await Promise.all([
                db.from('perfiles').select('id', { count: 'exact', head: true }).eq('estado_kyc', 'pendiente'),
                db.from('perfiles').select('id', { count: 'exact', head: true }).eq('estado_kyc', 'verificado'),
                db.from('perfiles').select('id', { count: 'exact', head: true }).eq('estado_kyc', 'rechazado'),
                db.from('perfiles').select('id', { count: 'exact', head: true }).is('estado_kyc', null),
                db.from('perfiles').select('id', { count: 'exact', head: true }).eq('bloqueado', true)
            ]);
            
            statsBar.innerHTML = `
                <div class="stat-box">
                    <div class="number" style="color: #FFA500;">${pendientes.count || 0}</div>
                    <div class="label">Pendientes</div>
                </div>
                <div class="stat-box">
                    <div class="number" style="color: #00ff00;">${verificados.count || 0}</div>
                    <div class="label">Verificados</div>
                </div>
                <div class="stat-box">
                    <div class="number" style="color: #ff4444;">${rechazados.count || 0}</div>
                    <div class="label">Rechazados</div>
                </div>
                <div class="stat-box">
                    <div class="number" style="color: #999;">${sinKyc.count || 0}</div>
                    <div class="label">Sin KYC</div>
                </div>
                <div class="stat-box">
                    <div class="number" style="color: #666;">${bloqueados.count || 0}</div>
                    <div class="label">Bloqueados</div>
                </div>
            `;
        } catch (err) { 
            console.error('Error cargando estadísticas:', err); 
        }
    }

    // ========== CARGAR KYC CON PAGINACIÓN Y FILTROS ==========
    async function cargarSolicitudesKYC() {
        loadingKyc.style.display = 'block';
        containerKyc.innerHTML = '';
        pagination.style.display = 'none';
        resultsInfo.style.display = 'none';
        
        try {
            let query = db.from('perfiles').select('*', { count: 'exact' }).eq('estado_kyc', 'pendiente');
            
            // Aplicar búsqueda por texto
            if (currentSearch.value.trim()) {
                const val = `%${currentSearch.value.trim()}%`;
                if (currentSearch.type === 'user_id') query = query.ilike('user_id', val);
                else if (currentSearch.type === 'numero_documento') query = query.ilike('numero_documento', val);
                else if (currentSearch.type === 'nombre') query = query.ilike('nombre', val);
                else if (currentSearch.type === 'email') query = query.ilike('email', val);
            }
            
            // Aplicar filtro de fechas
            if (currentDates.desde) {
                query = query.gte('ultima_actualizacion', currentDates.desde + 'T00:00:00');
            }
            if (currentDates.hasta) {
                query = query.lte('ultima_actualizacion', currentDates.hasta + 'T23:59:59');
            }
            
            // Paginación
            const from = (currentPage - 1) * itemsPerPage;
            const to = from + itemsPerPage - 1;
            
            const { data: perfiles, count, error } = await query
                .order('ultima_actualizacion', { ascending: false })
                .range(from, to);
            
            loadingKyc.style.display = 'none';
            
            if (error) { 
                containerKyc.innerHTML = `<div class="empty"><i class="fas fa-exclamation-triangle" style="color: #ff4444;"></i>Error: ${error.message}</div>`; 
                return; 
            }
            
            totalCount = count || 0;
            
            // Mostrar info de resultados
            const totalPages = Math.ceil(totalCount / itemsPerPage);
            if (totalCount > 0) {
                resultsInfo.style.display = 'flex';
                resultsInfoText.innerHTML = `
                    <i class="fas fa-list"></i> 
                    Mostrando <strong>${from + 1}-${Math.min(to, totalCount)}</strong> de <strong>${totalCount}</strong> solicitudes 
                    (Página ${currentPage} de ${totalPages})
                `;
            }
            
            if (!perfiles || perfiles.length === 0) { 
                containerKyc.innerHTML = `
                    <div class="empty">
                        <i class="fas fa-check-circle" style="color: #00ff00;"></i>
                        ¡No hay solicitudes pendientes con los filtros aplicados!
                    </div>
                `; 
                return; 
            }
            
            perfiles.forEach(perfil => { 
                containerKyc.appendChild(crearCardKYC(perfil)); 
            });
            
            if (totalPages > 1) {
                renderPagination(totalPages);
                pagination.style.display = 'flex';
            }
            
        } catch (err) { 
            console.error('Error:', err); 
            loadingKyc.style.display = 'none'; 
            containerKyc.innerHTML = `<div class="empty"><i class="fas fa-exclamation-triangle" style="color: #ff4444;"></i>Error al cargar: ${err.message}</div>`;
        }
    }

    // ========== CREAR CARD KYC COLAPSABLE ==========
    function crearCardKYC(perfil) {
        const card = document.createElement('div');
        card.className = 'kyc-card';
        card.id = `kyc-card-${perfil.id}`;
        
        const inicial = (perfil.nombre || 'U').charAt(0).toUpperCase();
        const fechaEnvio = perfil.ultima_actualizacion 
            ? new Date(perfil.ultima_actualizacion).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '---';
        
        card.innerHTML = `
            <!-- HEADER (siempre visible) -->
            <div class="kyc-card-header">
                <div class="kyc-card-main-info">
                    <div class="kyc-avatar">${inicial}</div>
                    <div class="kyc-user-info">
                        <div class="kyc-user-name">${perfil.nombre || 'Sin nombre'}</div>
                        <div class="kyc-user-meta">
                            <span><i class="fas fa-id-badge"></i> ${perfil.user_id || '---'}</span>
                            <span><i class="fas fa-envelope"></i> ${perfil.email || '---'}</span>
                            <span><i class="fas fa-clock"></i> ${fechaEnvio}</span>
                        </div>
                    </div>
                </div>
                <div class="kyc-card-right">
                    <span class="status-badge status-pending">Pendiente</span>
                    <i class="fas fa-chevron-down expand-icon"></i>
                </div>
            </div>
            
            <!-- CONTENIDO EXPANDIBLE -->
            <div class="kyc-card-content">
                <div class="kyc-content-inner">
                    <div class="section-title"><i class="fas fa-user"></i> Información Personal</div>
                    <div class="info-grid">
                        <div class="info-item"><label>Nacionalidad</label><span>${perfil.nacionalidad || '---'}</span></div>
                        <div class="info-item"><label>País</label><span>${perfil.pais || '---'}</span></div>
                        <div class="info-item"><label>Ciudad</label><span>${perfil.ciudad || '---'}</span></div>
                        <div class="info-item"><label>Teléfono</label><span>${perfil.telefono || '---'}</span></div>
                        <div class="info-item"><label>Fecha Nac.</label><span>${perfil.fecha_nacimiento || '---'}</span></div>
                        <div class="info-item"><label>Email</label><span>${perfil.email || '---'}</span></div>
                    </div>
                    
                    <div class="section-title"><i class="fas fa-address-card"></i> Documento</div>
                    <div class="info-grid">
                        <div class="info-item"><label>Tipo</label><span>${perfil.tipo_documento || '---'}</span></div>
                        <div class="info-item"><label>Número</label><span style="color: #FFD700; font-size: 1rem;">${perfil.numero_documento || '---'}</span></div>
                        <div class="info-item"><label>Dirección</label><span>${perfil.direccion || '---'}</span></div>
                    </div>
                    
                    <div class="section-title"><i class="fas fa-images"></i> Documentos Enviados</div>
                    <div class="images-grid">
                        <div class="image-box">
                            <img src="${perfil.documento_frontal_url || 'https://via.placeholder.com/300x200/111/666?text=Sin+Foto'}" data-action="open-image">
                            <p><i class="fas fa-id-card"></i> Documento (Frente)</p>
                        </div>
                        <div class="image-box">
                            <img src="${perfil.documento_trasero_url || 'https://via.placeholder.com/300x200/111/666?text=Sin+Foto'}" data-action="open-image">
                            <p><i class="fas fa-id-card"></i> Documento (Reverso)</p>
                        </div>
                        <div class="image-box">
                            <img src="${perfil.selfie_url || 'https://via.placeholder.com/300x200/111/666?text=Sin+Foto'}" data-action="open-image">
                            <p><i class="fas fa-user-circle"></i> Selfie</p>
                        </div>
                    </div>
                    
                    <div class="kyc-actions">
                        <button class="btn btn-approve" data-action="approve" data-user-id="${perfil.id}">
                            <i class="fas fa-check-circle"></i> Aprobar KYC
                        </button>
                        <button class="btn btn-reject" data-action="reject" data-user-id="${perfil.id}">
                            <i class="fas fa-times-circle"></i> Rechazar KYC
                        </button>
                    </div>
                </div>
            </div>
        `;

        // ========== EVENTOS DE LA CARD ==========
        // Toggle expandir/colapsar
        const header = card.querySelector('.kyc-card-header');
        header.addEventListener('click', () => {
            card.classList.toggle('expanded');
        });

        // Abrir imágenes en nueva pestaña
        card.querySelectorAll('[data-action="open-image"]').forEach(img => {
            img.addEventListener('click', (e) => {
                e.stopPropagation();
                window.open(img.src, '_blank');
            });
        });

        // Botón Aprobar
        card.querySelector('[data-action="approve"]').addEventListener('click', (e) => {
            e.stopPropagation();
            procesarKYC(perfil.id, 'verificado', e.currentTarget);
        });

        // Botón Rechazar
        card.querySelector('[data-action="reject"]').addEventListener('click', (e) => {
            e.stopPropagation();
            procesarKYC(perfil.id, 'rechazado', e.currentTarget);
        });

        return card;
    }

    // ========== PAGINACIÓN ==========
    function renderPagination(totalPages) {
        let html = '';
        
        // Botón anterior
        html += `<button class="page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i>
        </button>`;
        
        // Páginas
        const maxVisible = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        
        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }
        
        if (startPage > 1) {
            html += `<button class="page-btn" data-page="1">1</button>`;
            if (startPage > 2) html += `<span class="page-info">...</span>`;
        }
        
        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) html += `<span class="page-info">...</span>`;
            html += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
        }
        
        // Botón siguiente
        html += `<button class="page-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>
            <i class="fas fa-chevron-right"></i>
        </button>`;
        
        pagination.innerHTML = html;

        // Eventos de paginación
        pagination.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = parseInt(btn.dataset.page);
                if (!isNaN(page) && page !== currentPage) {
                    currentPage = page;
                    cargarSolicitudesKYC();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        });
    }

    // ========== BÚSQUEDA Y FILTROS ==========
    function aplicarBusqueda() {
        currentSearch.type = searchType.value;
        currentSearch.value = searchInput.value.trim();
        currentDates.desde = fechaDesde.value || null;
        currentDates.hasta = fechaHasta.value || null;
        currentPage = 1;
        cargarSolicitudesKYC();
    }

    function limpiarBusqueda() {
        searchInput.value = '';
        fechaDesde.value = '';
        fechaHasta.value = '';
        searchType.value = 'user_id';
        currentSearch = { type: 'user_id', value: '' };
        currentDates = { desde: null, hasta: null };
        currentPage = 1;
        cargarSolicitudesKYC();
    }

    // Eventos de búsqueda
    btnBuscar.addEventListener('click', aplicarBusqueda);
    btnAplicarFiltro.addEventListener('click', aplicarBusqueda);
    btnLimpiar.addEventListener('click', limpiarBusqueda);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') aplicarBusqueda();
    });

    // ========== PROCESAR KYC ==========
    async function procesarKYC(userId, nuevoEstado, buttonElement) {
        const confirmMsg = nuevoEstado === 'verificado' 
            ? '✅ ¿Aprobar este KYC? El usuario podrá acceder a todas las funciones.' 
            : '❌ ¿Rechazar este KYC? Se limpiarán los documentos y el usuario deberá reenviarlos.';
            
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
        
        // Deshabilitar botones temporalmente
        const card = document.getElementById(`kyc-card-${userId}`);
        const buttons = card.querySelectorAll('.btn-approve, .btn-reject');
        buttons.forEach(btn => { 
            btn.disabled = true; 
            btn.style.opacity = '0.5'; 
        });
        
        const { error } = await db.from('perfiles').update(datosActualizar).eq('id', userId);
        
        if (error) { 
            alert('❌ Error: ' + error.message); 
            buttons.forEach(btn => { 
                btn.disabled = false; 
                btn.style.opacity = '1'; 
            });
        } else { 
            alert(`✅ KYC ${nuevoEstado === 'verificado' ? 'APROBADO' : 'RECHAZADO'} exitosamente.`); 
            await cargarEstadisticas(); 
            await cargarSolicitudesKYC(); 
        }
    }

    // ========== INICIALIZAR ==========
    await cargarEstadisticas();
    await cargarSolicitudesKYC();
});
