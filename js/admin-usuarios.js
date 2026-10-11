document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) { 
        console.error('No se pudo obtener el cliente de Supabase'); 
        return; 
    }

    // ========== REFERENCIAS AL DOM ==========
    const loadingUsers = document.getElementById('loadingUsers');
    const tableContainer = document.getElementById('tableContainer');
    const usersTableBody = document.getElementById('usersTableBody');
    const emptyState = document.getElementById('emptyState');
    const pagination = document.getElementById('pagination');
    const resultsInfo = document.getElementById('resultsInfo');
    const resultsInfoText = document.getElementById('resultsInfoText');
    const statsBar = document.getElementById('statsBar');
    
    const searchInput = document.getElementById('searchInput');
    const searchType = document.getElementById('searchType');
    const filtroEstadoKyc = document.getElementById('filtroEstadoKyc');
    const filtroBloqueo = document.getElementById('filtroBloqueo');
    const fechaDesde = document.getElementById('fechaDesde');
    const fechaHasta = document.getElementById('fechaHasta');
    
    const btnBuscar = document.getElementById('btnBuscar');
    const btnLimpiar = document.getElementById('btnLimpiar');
    const btnAplicarFiltros = document.getElementById('btnAplicarFiltros');
    const btnExportar = document.getElementById('btnExportar');
    
    const userModal = document.getElementById('userModal');
    const modalBody = document.getElementById('modalBody');
    const btnCerrarModal = document.getElementById('btnCerrarModal');
    
    const coinsModal = document.getElementById('coinsModal');
    const coinsModalBody = document.getElementById('coinsModalBody');
    const btnCerrarCoins = document.getElementById('btnCerrarCoins');

    // ========== ESTADO GLOBAL ==========
    let currentPage = 1;
    const itemsPerPage = 20;
    let totalCount = 0;
    let currentSearch = { type: 'user_id', value: '' };
    let currentFilters = { kyc: '', bloqueo: '', desde: null, hasta: null };
    let usuariosActuales = []; // Para exportar CSV

    // ========== ESTADÍSTICAS ==========
    async function cargarEstadisticas() {
        try {
            const [total, verificados, bloqueados, conSaldo] = await Promise.all([
                db.from('perfiles').select('id', { count: 'exact', head: true }),
                db.from('perfiles').select('id', { count: 'exact', head: true }).eq('estado_kyc', 'verificado'),
                db.from('perfiles').select('id', { count: 'exact', head: true }).eq('bloqueado', true),
                db.from('perfiles').select('saldo_bc').gt('saldo_bc', 0)
            ]);
            
            const totalSaldo = conSaldo.data?.reduce((sum, u) => sum + (u.saldo_bc || 0), 0) || 0;
            
            statsBar.innerHTML = `
                <div class="stat-box">
                    <div class="number">${total.count || 0}</div>
                    <div class="label">Total Usuarios</div>
                </div>
                <div class="stat-box">
                    <div class="number" style="color: #00ff00;">${verificados.count || 0}</div>
                    <div class="label">Verificados</div>
                </div>
                <div class="stat-box">
                    <div class="number" style="color: #ff4444;">${bloqueados.count || 0}</div>
                    <div class="label">Bloqueados</div>
                </div>
                <div class="stat-box">
                    <div class="number" style="color: #FFD700;">${totalSaldo.toFixed(0)}</div>
                    <div class="label">BC en Circulación</div>
                </div>
            `;
        } catch (err) { 
            console.error('Error cargando estadísticas:', err); 
        }
    }

    // ========== CARGAR USUARIOS ==========
    async function cargarUsuarios() {
        loadingUsers.style.display = 'block';
        tableContainer.style.display = 'none';
        emptyState.style.display = 'none';
        pagination.style.display = 'none';
        resultsInfo.style.display = 'none';
        usersTableBody.innerHTML = '';
        
        try {
            let query = db.from('perfiles').select('*', { count: 'exact' });
            
            // Búsqueda por texto
            if (currentSearch.value.trim()) {
                const val = `%${currentSearch.value.trim()}%`;
                if (currentSearch.type === 'user_id') query = query.ilike('user_id', val);
                else if (currentSearch.type === 'numero_documento') query = query.ilike('numero_documento', val);
                else if (currentSearch.type === 'nombre') query = query.ilike('nombre', val);
                else if (currentSearch.type === 'email') query = query.ilike('email', val);
            }
            
            // Filtro por estado KYC
            if (currentFilters.kyc === 'null') {
                query = query.is('estado_kyc', null);
            } else if (currentFilters.kyc) {
                query = query.eq('estado_kyc', currentFilters.kyc);
            }
            
            // Filtro por bloqueo
            if (currentFilters.bloqueo === 'activos') {
                query = query.or('bloqueado.is.null,bloqueado.eq.false');
            } else if (currentFilters.bloqueo === 'bloqueados') {
                query = query.eq('bloqueado', true);
            }
            
            // Filtro por fechas
            if (currentFilters.desde) {
                query = query.gte('fecha_registro', currentFilters.desde + 'T00:00:00');
            }
            if (currentFilters.hasta) {
                query = query.lte('fecha_registro', currentFilters.hasta + 'T23:59:59');
            }
            
            // Paginación
            const from = (currentPage - 1) * itemsPerPage;
            const to = from + itemsPerPage - 1;
            
            const { data: usuarios, count, error } = await query
                .order('fecha_registro', { ascending: false })
                .range(from, to);
            
            loadingUsers.style.display = 'none';
            
            if (error) { 
                emptyState.style.display = 'block';
                emptyState.innerHTML = `<div class="empty"><i class="fas fa-exclamation-triangle" style="color: #ff4444;"></i>Error: ${error.message}</div>`;
                return; 
            }
            
            totalCount = count || 0;
            usuariosActuales = usuarios || [];
            
            // Info de resultados
            const totalPages = Math.ceil(totalCount / itemsPerPage);
            if (totalCount > 0) {
                resultsInfo.style.display = 'flex';
                resultsInfoText.innerHTML = `
                    <i class="fas fa-users"></i> 
                    Mostrando <strong>${from + 1}-${Math.min(to, totalCount)}</strong> de <strong>${totalCount}</strong> usuarios 
                    (Página ${currentPage} de ${totalPages})
                `;
            }
            
            if (!usuarios || usuarios.length === 0) { 
                emptyState.style.display = 'block';
                return; 
            }
            
            // Renderizar tabla
            tableContainer.style.display = 'block';
            usuarios.forEach(u => {
                usersTableBody.appendChild(crearFilaUsuario(u));
            });
            
            if (totalPages > 1) {
                renderPagination(totalPages);
                pagination.style.display = 'flex';
            }
            
        } catch (err) { 
            console.error('Error:', err); 
            loadingUsers.style.display = 'none';
            emptyState.style.display = 'block';
            emptyState.innerHTML = `<div class="empty"><i class="fas fa-exclamation-triangle" style="color: #ff4444;"></i>Error al cargar: ${err.message}</div>`;
        }
    }

    // ========== CREAR FILA DE USUARIO ==========
    function crearFilaUsuario(u) {
        const tr = document.createElement('tr');
        
        // Determinar estado
        let statusClass = 'status-none', statusText = 'SIN KYC';
        if (u.estado_kyc === 'verificado') { statusClass = 'status-verified'; statusText = 'VERIFICADO'; }
        else if (u.estado_kyc === 'rechazado') { statusClass = 'status-rejected'; statusText = 'RECHAZADO'; }
        else if (u.estado_kyc === 'pendiente') { statusClass = 'status-pending'; statusText = 'PENDIENTE'; }
        if (u.bloqueado) { statusClass = 'status-blocked'; statusText = 'BLOQUEADO'; }
        
        const inicial = (u.nombre || 'U').charAt(0).toUpperCase();
        const fechaRegistro = u.fecha_registro 
            ? new Date(u.fecha_registro).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
            : '---';
        
        tr.innerHTML = `
            <td class="user-id-cell">${u.user_id || '---'}</td>
            <td>
                <div class="user-cell">
                    <div class="user-avatar-small">${inicial}</div>
                    <span class="user-name-cell">${u.nombre || 'Sin nombre'}</span>
                </div>
            </td>
            <td class="user-email-cell">${u.email || '---'}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td class="balance-cell">${(u.saldo_bc || 0).toFixed(2)} BC</td>
            <td style="color: #999; font-size: 0.85rem;">${fechaRegistro}</td>
            <td>
                <div class="actions-cell">
                    <button class="action-btn view" data-action="view" data-id="${u.id}" title="Ver perfil">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn coins" data-action="coins" data-id="${u.id}" data-nombre="${u.nombre || 'Usuario'}" data-saldo="${u.saldo_bc || 0}" title="Agregar monedas">
                        <i class="fas fa-coins"></i>
                    </button>
                    ${u.bloqueado 
                        ? `<button class="action-btn unblock" data-action="unblock" data-id="${u.id}" title="Desbloquear"><i class="fas fa-unlock"></i></button>`
                        : `<button class="action-btn block" data-action="block" data-id="${u.id}" title="Bloquear"><i class="fas fa-lock"></i></button>`
                    }
                </div>
            </td>
        `;
        
        // Eventos de la fila
        tr.addEventListener('click', (e) => {
            if (!e.target.closest('.action-btn')) {
                verPerfilUsuario(u.id);
            }
        });
        
        tr.querySelector('[data-action="view"]').addEventListener('click', (e) => {
            e.stopPropagation();
            verPerfilUsuario(u.id);
        });
        
        tr.querySelector('[data-action="coins"]').addEventListener('click', (e) => {
            e.stopPropagation();
            const btn = e.currentTarget;
            abrirModalMonedas(btn.dataset.id, btn.dataset.nombre, parseFloat(btn.dataset.saldo));
        });
        
        const blockBtn = tr.querySelector('[data-action="block"], [data-action="unblock"]');
        if (blockBtn) {
            blockBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const bloquear = e.currentTarget.dataset.action === 'block';
                toggleBloqueo(u.id, bloquear);
            });
        }
        
        return tr;
    }

    // ========== PAGINACIÓN ==========
    function renderPagination(totalPages) {
        let html = '';
        
        html += `<button class="page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i>
        </button>`;
        
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
        
        html += `<button class="page-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>
            <i class="fas fa-chevron-right"></i>
        </button>`;
        
        pagination.innerHTML = html;
        
        pagination.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = parseInt(btn.dataset.page);
                if (!isNaN(page) && page !== currentPage) {
                    currentPage = page;
                    cargarUsuarios();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        });
    }

    // ========== BÚSQUEDA Y FILTROS ==========
    function aplicarBusqueda() {
        currentSearch.type = searchType.value;
        currentSearch.value = searchInput.value.trim();
        currentFilters.kyc = filtroEstadoKyc.value;
        currentFilters.bloqueo = filtroBloqueo.value;
        currentFilters.desde = fechaDesde.value || null;
        currentFilters.hasta = fechaHasta.value || null;
        currentPage = 1;
        cargarUsuarios();
    }

    function limpiarBusqueda() {
        searchInput.value = '';
        searchType.value = 'user_id';
        filtroEstadoKyc.value = '';
        filtroBloqueo.value = '';
        fechaDesde.value = '';
        fechaHasta.value = '';
        currentSearch = { type: 'user_id', value: '' };
        currentFilters = { kyc: '', bloqueo: '', desde: null, hasta: null };
        currentPage = 1;
        cargarUsuarios();
    }

    btnBuscar.addEventListener('click', aplicarBusqueda);
    btnAplicarFiltros.addEventListener('click', aplicarBusqueda);
    btnLimpiar.addEventListener('click', limpiarBusqueda);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') aplicarBusqueda();
    });

    // ========== EXPORTAR CSV ==========
    btnExportar.addEventListener('click', () => {
        if (usuariosActuales.length === 0) {
            alert('No hay usuarios para exportar.');
            return;
        }
        
        let csv = 'ID,Nombre,Email,Estado KYC,Saldo BC,Bloqueado,Fecha Registro\n';
        usuariosActuales.forEach(u => {
            csv += `"${u.user_id || ''}","${u.nombre || ''}","${u.email || ''}","${u.estado_kyc || 'Sin KYC'}",${u.saldo_bc || 0},${u.bloqueado ? 'Sí' : 'No'},"${u.fecha_registro || ''}"\n`;
        });
        
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `usuarios_boche_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    });

    // ========== VER PERFIL DE USUARIO ==========
    async function verPerfilUsuario(userId) {
        modalBody.innerHTML = '<div class="loading"><i class="fas fa-circle-notch fa-spin"></i> Cargando perfil...</div>';
        userModal.classList.add('show');
        
        try {
            const { data: perfil, error } = await db.from('perfiles').select('*').eq('id', userId).single();
            if (error || !perfil) { 
                modalBody.innerHTML = '<div class="empty">Usuario no encontrado.</div>'; 
                return; 
            }
            
            let statusClass = 'status-none', statusText = 'SIN KYC';
            if (perfil.estado_kyc === 'verificado') { statusClass = 'status-verified'; statusText = 'VERIFICADO'; }
            else if (perfil.estado_kyc === 'rechazado') { statusClass = 'status-rejected'; statusText = 'RECHAZADO'; }
            else if (perfil.estado_kyc === 'pendiente') { statusClass = 'status-pending'; statusText = 'PENDIENTE'; }
            if (perfil.bloqueado) { statusClass = 'status-blocked'; statusText = 'BLOQUEADO'; }
            
            modalBody.innerHTML = `
                <div class="info-grid">
                    <div class="info-item"><label>ID Usuario</label><span style="color: #FFD700; font-size: 1.1rem;">${perfil.user_id || '---'}</span></div>
                    <div class="info-item"><label>Estado</label><span class="status-badge ${statusClass}">${statusText}</span></div>
                    <div class="info-item"><label>Saldo BC</label><span style="color: #FFD700; font-size: 1.2rem; font-weight: 800;">${(perfil.saldo_bc || 0).toFixed(2)} BC</span></div>
                    <div class="info-item"><label>Registro</label><span>${perfil.fecha_registro ? new Date(perfil.fecha_registro).toLocaleDateString('es-ES') : '---'}</span></div>
                </div>
                
                <div class="section-title"><i class="fas fa-user"></i> Información Personal</div>
                <div class="info-grid">
                    <div class="info-item"><label>Nombre</label><span>${perfil.nombre || '---'}</span></div>
                    <div class="info-item"><label>Email</label><span>${perfil.email || '---'}</span></div>
                    <div class="info-item"><label>Teléfono</label><span>${perfil.telefono || '---'}</span></div>
                    <div class="info-item"><label>Fecha Nac.</label><span>${perfil.fecha_nacimiento || '---'}</span></div>
                    <div class="info-item"><label>Nacionalidad</label><span>${perfil.nacionalidad || '---'}</span></div>
                </div>
                
                <div class="section-title"><i class="fas fa-map-marker-alt"></i> Dirección</div>
                <div class="info-grid">
                    <div class="info-item"><label>Dirección</label><span>${perfil.direccion || '---'}</span></div>
                    <div class="info-item"><label>Ciudad</label><span>${perfil.ciudad || '---'}</span></div>
                    <div class="info-item"><label>País</label><span>${perfil.pais || '---'}</span></div>
                    <div class="info-item"><label>Código Postal</label><span>${perfil.codigo_postal || '---'}</span></div>
                </div>
                
                <div class="section-title"><i class="fas fa-id-card"></i> Documentos KYC</div>
                <div class="info-grid">
                    <div class="info-item"><label>Tipo Documento</label><span>${perfil.tipo_documento || '---'}</span></div>
                    <div class="info-item"><label>Número</label><span style="color: #FFD700;">${perfil.numero_documento || '---'}</span></div>
                </div>
                
                ${perfil.documento_frontal_url ? `
                    <div class="images-grid">
                        <div class="image-box">
                            <img src="${perfil.documento_frontal_url}" data-action="open-image">
                            <p>Documento (Frente)</p>
                        </div>
                        ${perfil.documento_trasero_url ? `
                            <div class="image-box">
                                <img src="${perfil.documento_trasero_url}" data-action="open-image">
                                <p>Documento (Reverso)</p>
                            </div>
                        ` : ''}
                        ${perfil.selfie_url ? `
                            <div class="image-box">
                                <img src="${perfil.selfie_url}" data-action="open-image">
                                <p>Selfie</p>
                            </div>
                        ` : ''}
                    </div>
                ` : '<p style="color: #666; text-align: center; padding: 15px;">Sin documentos enviados</p>'}
                
                <div class="modal-actions">
                    ${perfil.bloqueado 
                        ? `<button class="btn btn-unblock" data-action="unblock-modal" data-id="${perfil.id}"><i class="fas fa-unlock"></i> Desbloquear</button>`
                        : `<button class="btn btn-block" data-action="block-modal" data-id="${perfil.id}"><i class="fas fa-lock"></i> Bloquear</button>`
                    }
                    <button class="btn btn-coins" data-action="coins-modal" data-id="${perfil.id}" data-nombre="${perfil.nombre || 'Usuario'}" data-saldo="${perfil.saldo_bc || 0}">
                        <i class="fas fa-coins"></i> Agregar BC
                    </button>
                </div>
            `;
            
            // Eventos del modal
            modalBody.querySelectorAll('[data-action="open-image"]').forEach(img => {
                img.addEventListener('click', () => window.open(img.src, '_blank'));
            });
            
            const blockModalBtn = modalBody.querySelector('[data-action="block-modal"], [data-action="unblock-modal"]');
            if (blockModalBtn) {
                blockModalBtn.addEventListener('click', () => {
                    const bloquear = blockModalBtn.dataset.action === 'block-modal';
                    toggleBloqueo(perfil.id, bloquear, true);
                });
            }
            
            const coinsModalBtn = modalBody.querySelector('[data-action="coins-modal"]');
            if (coinsModalBtn) {
                coinsModalBtn.addEventListener('click', () => {
                    userModal.classList.remove('show');
                    abrirModalMonedas(coinsModalBtn.dataset.id, coinsModalBtn.dataset.nombre, parseFloat(coinsModalBtn.dataset.saldo));
                });
            }
            
        } catch (err) { 
            console.error('Error:', err);
            modalBody.innerHTML = '<div class="empty">Error al cargar perfil.</div>'; 
        }
    }

    btnCerrarModal.addEventListener('click', () => userModal.classList.remove('show'));
    userModal.addEventListener('click', (e) => {
        if (e.target === userModal) userModal.classList.remove('show');
    });

    // ========== BLOQUEAR/DESBLOQUEAR ==========
    async function toggleBloqueo(userId, bloquear, desdeModal = false) {
        const msg = bloquear 
            ? '🔒 ¿Bloquear este usuario? No podrá acceder a la plataforma.' 
            : '🔓 ¿Desbloquear este usuario?';
        if (!confirm(msg)) return;
        
        const { error } = await db.from('perfiles').update({ 
            bloqueado: bloquear, 
            motivo_bloqueo: bloquear ? 'Bloqueado por administrador' : null, 
            ultima_actualizacion: new Date().toISOString() 
        }).eq('id', userId);
        
        if (error) { 
            alert('❌ Error: ' + error.message); 
        } else { 
            alert(`✅ Usuario ${bloquear ? 'BLOQUEADO' : 'DESBLOQUEADO'} exitosamente.`); 
            if (desdeModal) userModal.classList.remove('show');
            await cargarEstadisticas();
            await cargarUsuarios(); 
        }
    }

    // ========== MODAL DE MONEDAS ==========
    function abrirModalMonedas(userId, nombre, saldoActual) {
        coinsModalBody.innerHTML = `
            <div style="background: #111; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #333;">
                <p style="margin-bottom: 8px;">Usuario: <strong style="color: #FFD700;">${nombre}</strong></p>
                <p>Saldo actual: <strong style="color: #FFD700; font-size: 1.3rem;">${saldoActual.toFixed(2)} BC</strong></p>
            </div>
            <div class="form-group">
                <label>Cantidad de monedas BC *</label>
                <input type="number" id="cantidadMonedas" min="0.01" step="0.01" placeholder="0.00">
            </div>
            <div class="form-group">
                <label>Motivo (opcional)</label>
                <textarea id="motivoMonedas" rows="3" placeholder="Ej: Bono de bienvenida, premio de torneo..."></textarea>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button class="btn btn-coins" style="flex: 1; justify-content: center;" id="btnConfirmarMonedas">
                    <i class="fas fa-plus-circle"></i> Agregar
                </button>
                <button class="btn btn-clear" style="flex: 1; justify-content: center;" id="btnCancelarMonedas">
                    Cancelar
                </button>
            </div>
        `;
        coinsModal.classList.add('show');
        
        document.getElementById('btnConfirmarMonedas').addEventListener('click', () => {
            agregarMonedas(userId, saldoActual);
        });
        document.getElementById('btnCancelarMonedas').addEventListener('click', () => {
            coinsModal.classList.remove('show');
        });
    }

    btnCerrarCoins.addEventListener('click', () => coinsModal.classList.remove('show'));
    coinsModal.addEventListener('click', (e) => {
        if (e.target === coinsModal) coinsModal.classList.remove('show');
    });

    async function agregarMonedas(userId, saldoActual) {
        const cantidad = parseFloat(document.getElementById('cantidadMonedas').value);
        const motivo = document.getElementById('motivoMonedas').value.trim();
        
        if (isNaN(cantidad) || cantidad <= 0) { 
            alert('⚠️ Ingresa una cantidad válida mayor a 0.'); 
            return; 
        }
        
        const nuevoSaldo = saldoActual + cantidad;
        if (!confirm(`💰 ¿Agregar ${cantidad.toFixed(2)} BC?\n\nNuevo saldo: ${nuevoSaldo.toFixed(2)} BC`)) return;
        
        const { error } = await db.from('perfiles').update({ 
            saldo_bc: nuevoSaldo, 
            notas_admin: motivo ? `${motivo} (+${cantidad.toFixed(2)} BC)` : null, 
            ultima_actualizacion: new Date().toISOString() 
        }).eq('id', userId);
        
        if (error) { 
            alert('❌ Error: ' + error.message); 
        } else { 
            alert(`✅ Agregados ${cantidad.toFixed(2)} BC.\nNuevo saldo: ${nuevoSaldo.toFixed(2)} BC`); 
            coinsModal.classList.remove('show'); 
            await cargarEstadisticas();
            await cargarUsuarios(); 
        }
    }

    // ========== INICIALIZAR ==========
    await cargarEstadisticas();
    await cargarUsuarios();
});
