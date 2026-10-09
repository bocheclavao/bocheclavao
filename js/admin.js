document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) { console.error('No se pudo obtener el cliente de Supabase'); return; }

    const accessDenied = document.getElementById('accessDenied');
    const adminContent = document.getElementById('adminContent');
    const containerKyc = document.getElementById('containerKyc');
    const containerUsers = document.getElementById('containerUsers');
    const loadingKyc = document.getElementById('loadingKyc');
    const loadingUsers = document.getElementById('loadingUsers');
    const kycBadge = document.getElementById('kycBadge');
    const statsBar = document.getElementById('statsBar');
    const pagination = document.getElementById('pagination');

    let currentPage = 1;
    const itemsPerPage = 20;
    let currentSearch = { type: 'email', value: '' };

    async function verificarAccesoAdmin() {
        const { data: { session }, error } = await db.auth.getSession();
        if (error || !session) { mostrarAccesoDenegado(); return false; }
        const { data: { user } } = await db.auth.getUser();
        if (!user) { mostrarAccesoDenegado(); return false; }
        try {
            const { data: adminData, error: adminError } = await db.from('admin_roles').select('es_admin, activo').eq('id', user.id).eq('es_admin', true).eq('activo', true).single();
            if (adminError || !adminData) { mostrarAccesoDenegado(); return false; }
            return true;
        } catch (err) { mostrarAccesoDenegado(); return false; }
    }

    function mostrarAccesoDenegado() {
        adminContent.style.display = 'none';
        accessDenied.style.display = 'block';
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 3000);
    }

    window.cambiarTab = function(tab, btnElement) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        if (btnElement) btnElement.classList.add('active');
        else {
            const tabs = document.querySelectorAll('.tab-btn');
            if (tab === 'kyc') tabs[0].classList.add('active');
            if (tab === 'usuarios') tabs[1].classList.add('active');
            if (tab === 'stream') tabs[2].classList.add('active');
        }
        document.getElementById(`tab-${tab}`).classList.add('active');
        if (tab === 'kyc') { cargarEstadisticas(); cargarSolicitudesKYC(); }
        else if (tab === 'usuarios') cargarUsuarios();
        else if (tab === 'stream') cargarConfigStream();
    };

    async function cargarEstadisticas() {
        try {
            const { data: pendientes } = await db.from('perfiles').select('id', { count: 'exact' }).eq('estado_kyc', 'pendiente');
            const { data: verificados } = await db.from('perfiles').select('id', { count: 'exact' }).eq('estado_kyc', 'verificado');
            const { data: rechazados } = await db.from('perfiles').select('id', { count: 'exact' }).eq('estado_kyc', 'rechazado');
            const { data: sinKyc } = await db.from('perfiles').select('id', { count: 'exact' }).is('estado_kyc', null);
            const { data: bloqueados } = await db.from('perfiles').select('id', { count: 'exact' }).eq('bloqueado', true);
            kycBadge.textContent = pendientes?.length || 0;
            statsBar.innerHTML = `
                <div class="stat-box"><div class="number" style="color: #FFA500;">${pendientes?.length || 0}</div><div class="label">Pendientes KYC</div></div>
                <div class="stat-box"><div class="number" style="color: #00ff00;">${verificados?.length || 0}</div><div class="label">Verificados</div></div>
                <div class="stat-box"><div class="number" style="color: #ff4444;">${rechazados?.length || 0}</div><div class="label">Rechazados</div></div>
                <div class="stat-box"><div class="number" style="color: #999;">${sinKyc?.length || 0}</div><div class="label">Sin KYC</div></div>
                <div class="stat-box"><div class="number" style="color: #666;">${bloqueados?.length || 0}</div><div class="label">Bloqueados</div></div>
            `;
        } catch (err) { console.error('Error cargando estadísticas:', err); }
    }

    async function cargarSolicitudesKYC() {
        loadingKyc.style.display = 'block';
        containerKyc.innerHTML = '';
        try {
            const { data: perfiles, error } = await db.from('perfiles').select('*').eq('estado_kyc', 'pendiente').order('ultima_actualizacion', { ascending: false });
            loadingKyc.style.display = 'none';
            if (error) { containerKyc.innerHTML = `<p class="empty">Error: ${error.message}</p>`; return; }
            if (!perfiles || perfiles.length === 0) { containerKyc.innerHTML = `<p class="empty"><i class="fas fa-check-circle" style="font-size: 3rem; color: #00ff00; margin-bottom: 15px; display: block;"></i>¡No hay solicitudes pendientes!</p>`; return; }
            perfiles.forEach(perfil => { containerKyc.appendChild(crearCardKYC(perfil)); });
        } catch (err) { console.error('Error:', err); loadingKyc.style.display = 'none'; }
    }

    function crearCardKYC(perfil) {
        const card = document.createElement('div');
        card.className = 'user-card';
        card.innerHTML = `
            <div class="user-header">
                <div><div class="user-name">${perfil.nombre || 'Sin nombre'}</div><div class="user-id">ID: ${perfil.user_id} | ${perfil.email}</div></div>
                <div style="text-align: right;"><span class="status-badge status-pending">PENDIENTE</span><div style="color: #FFD700; font-weight: 700; margin-top: 5px;">${perfil.tipo_documento || 'No especificado'}</div><div style="color: #999; font-size: 0.9rem;">${perfil.numero_documento || '---'}</div></div>
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
                <div class="image-box"><img src="${perfil.documento_frontal_url || 'https://via.placeholder.com/300x200?text=Sin+Foto'}" onclick="window.open(this.src)"><p>Documento (Frente)</p></div>
                <div class="image-box"><img src="${perfil.documento_trasero_url || 'https://via.placeholder.com/300x200?text=Sin+Foto'}" onclick="window.open(this.src)"><p>Documento (Reverso)</p></div>
                <div class="image-box"><img src="${perfil.selfie_url || 'https://via.placeholder.com/300x200?text=Sin+Foto'}" onclick="window.open(this.src)"><p>Selfie</p></div>
            </div>
            <div class="actions">
                <button class="btn btn-approve" onclick="procesarKYC('${perfil.id}', 'verificado')"><i class="fas fa-check"></i> Aprobar</button>
                <button class="btn btn-reject" onclick="procesarKYC('${perfil.id}', 'rechazado')"><i class="fas fa-times"></i> Rechazar</button>
            </div>
        `;
        return card;
    }

    window.procesarKYC = async function(userId, nuevoEstado) {
        const confirmMsg = nuevoEstado === 'verificado' ? '¿Aprobar este KYC?' : '¿Rechazar este KYC? Se limpiarán los documentos.';
        if (!confirm(confirmMsg)) return;
        const datosActualizar = { estado_kyc: nuevoEstado, ultima_actualizacion: new Date().toISOString() };
        if (nuevoEstado === 'rechazado') {
            datosActualizar.documento_frontal_url = null;
            datosActualizar.documento_trasero_url = null;
            datosActualizar.selfie_url = null;
        }
        const { error } = await db.from('perfiles').update(datosActualizar).eq('id', userId);
        if (error) { alert('Error: ' + error.message); }
        else { alert(`KYC ${nuevoEstado === 'verificado' ? 'aprobado' : 'rechazado'} exitosamente.`); await cargarEstadisticas(); await cargarSolicitudesKYC(); }
    };

    async function cargarUsuarios() {
        loadingUsers.style.display = 'block';
        containerUsers.innerHTML = '';
        pagination.innerHTML = '';
        try {
            let query = db.from('perfiles').select('*', { count: 'exact' });
            if (currentSearch.value) {
                if (currentSearch.type === 'email') query = query.ilike('email', `%${currentSearch.value}%`);
                else if (currentSearch.type === 'user_id') query = query.ilike('user_id', `%${currentSearch.value}%`);
                else if (currentSearch.type === 'numero_documento') query = query.ilike('numero_documento', `%${currentSearch.value}%`);
                else if (currentSearch.type === 'nombre') query = query.ilike('nombre', `%${currentSearch.value}%`);
            }
            const from = (currentPage - 1) * itemsPerPage;
            const to = from + itemsPerPage - 1;
            const { data: usuarios, count, error } = await query.order('fecha_registro', { ascending: false }).range(from, to);
            loadingUsers.style.display = 'none';
            if (error) { containerUsers.innerHTML = `<p class="empty">Error: ${error.message}</p>`; return; }
            if (!usuarios || usuarios.length === 0) { containerUsers.innerHTML = `<p class="empty">No se encontraron usuarios.</p>`; return; }
            let tableHTML = `<table class="users-table"><thead><tr><th>ID</th><th>Nombre</th><th>Email</th><th>Estado KYC</th><th>Saldo BC</th><th>Acciones</th></tr></thead><tbody>`;
            usuarios.forEach(u => {
                let statusClass = 'status-pending', statusText = 'SIN KYC';
                if (u.estado_kyc === 'verificado') { statusClass = 'status-verified'; statusText = 'VERIFICADO'; }
                else if (u.estado_kyc === 'rechazado') { statusClass = 'status-rejected'; statusText = 'RECHAZADO'; }
                else if (u.estado_kyc === 'pendiente') { statusClass = 'status-pending'; statusText = 'PENDIENTE'; }
                if (u.bloqueado) { statusClass = 'status-blocked'; statusText = 'BLOQUEADO'; }
                tableHTML += `<tr onclick="verPerfilUsuario('${u.id}')"><td>${u.user_id || '---'}</td><td>${u.nombre || '---'}</td><td>${u.email}</td><td><span class="status-badge ${statusClass}">${statusText}</span></td><td style="color: #FFD700; font-weight: 700;">${(u.saldo_bc || 0).toFixed(2)} BC</td><td><button class="btn btn-view" onclick="event.stopPropagation(); verPerfilUsuario('${u.id}')"><i class="fas fa-eye"></i></button></td></tr>`;
            });
            tableHTML += '</tbody></table>';
            containerUsers.innerHTML = tableHTML;
            if (count > itemsPerPage) {
                const totalPages = Math.ceil(count / itemsPerPage);
                let pagHTML = '';
                if (currentPage > 1) pagHTML += `<button class="page-btn" onclick="irAPagina(${currentPage - 1})"><i class="fas fa-chevron-left"></i> Anterior</button>`;
                for (let i = 1; i <= totalPages; i++) {
                    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) pagHTML += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="irAPagina(${i})">${i}</button>`;
                    else if (i === currentPage - 3 || i === currentPage + 3) pagHTML += `<span style="color: #666;">...</span>`;
                }
                if (currentPage < totalPages) pagHTML += `<button class="page-btn" onclick="irAPagina(${currentPage + 1})">Siguiente <i class="fas fa-chevron-right"></i></button>`;
                pagHTML += `<span style="color: #999; margin-left: 15px;">Total: ${count} usuarios</span>`;
                pagination.innerHTML = pagHTML;
            }
        } catch (err) { console.error('Error:', err); loadingUsers.style.display = 'none'; }
    }

    window.irAPagina = function(page) { currentPage = page; cargarUsuarios(); };
    window.buscarUsuarios = function() { currentSearch.type = document.getElementById('searchType').value; currentSearch.value = document.getElementById('searchInput').value.trim(); currentPage = 1; cargarUsuarios(); };
    window.limpiarBusqueda = function() { document.getElementById('searchInput').value = ''; currentSearch = { type: 'email', value: '' }; currentPage = 1; cargarUsuarios(); };
    document.getElementById('searchInput').addEventListener('keypress', function(e) { if (e.key === 'Enter') buscarUsuarios(); });

    window.verPerfilUsuario = async function(userId) {
        const modal = document.getElementById('userModal');
        const modalBody = document.getElementById('modalBody');
        modalBody.innerHTML = '<p class="loading">Cargando...</p>';
        modal.classList.add('show');
        try {
            const { data: perfil, error } = await db.from('perfiles').select('*').eq('id', userId).single();
            if (error || !perfil) { modalBody.innerHTML = '<p class="empty">Usuario no encontrado.</p>'; return; }
            let statusClass = 'status-pending', statusText = 'SIN KYC';
            if (perfil.estado_kyc === 'verificado') { statusClass = 'status-verified'; statusText = 'VERIFICADO'; }
            else if (perfil.estado_kyc === 'rechazado') { statusClass = 'status-rejected'; statusText = 'RECHAZADO'; }
            else if (perfil.estado_kyc === 'pendiente') { statusClass = 'status-pending'; statusText = 'PENDIENTE'; }
            if (perfil.bloqueado) { statusClass = 'status-blocked'; statusText = 'BLOQUEADO'; }
            modalBody.innerHTML = `
                <div class="info-grid" style="margin-bottom: 20px;">
                    <div class="info-item"><label>ID Usuario</label><span style="color: #FFD700;">${perfil.user_id}</span></div>
                    <div class="info-item"><label>Estado KYC</label><span class="status-badge ${statusClass}">${statusText}</span></div>
                    <div class="info-item"><label>Saldo BC</label><span style="color: #FFD700; font-size: 1.2rem;">${(perfil.saldo_bc || 0).toFixed(2)} BC</span></div>
                    <div class="info-item"><label>Registro</label><span>${new Date(perfil.fecha_registro).toLocaleDateString()}</span></div>
                </div>
                <h3 style="color: #FFD700; margin-bottom: 15px;"><i class="fas fa-user"></i> Información Personal</h3>
                <div class="info-grid" style="margin-bottom: 20px;">
                    <div class="info-item"><label>Nombre</label><span>${perfil.nombre || '---'}</span></div>
                    <div class="info-item"><label>Email</label><span>${perfil.email}</span></div>
                    <div class="info-item"><label>Teléfono</label><span>${perfil.telefono || '---'}</span></div>
                    <div class="info-item"><label>Fecha Nac.</label><span>${perfil.fecha_nacimiento || '---'}</span></div>
                    <div class="info-item"><label>Nacionalidad</label><span>${perfil.nacionalidad || '---'}</span></div>
                </div>
                <h3 style="color: #FFD700; margin-bottom: 15px;"><i class="fas fa-map-marker-alt"></i> Dirección</h3>
                <div class="info-grid" style="margin-bottom: 20px;">
                    <div class="info-item"><label>Dirección</label><span>${perfil.direccion || '---'}</span></div>
                    <div class="info-item"><label>Ciudad</label><span>${perfil.ciudad || '---'}</span></div>
                    <div class="info-item"><label>País</label><span>${perfil.pais || '---'}</span></div>
                    <div class="info-item"><label>Código Postal</label><span>${perfil.codigo_postal || '---'}</span></div>
                </div>
                <h3 style="color: #FFD700; margin-bottom: 15px;"><i class="fas fa-id-card"></i> Documentos KYC</h3>
                <div class="info-grid" style="margin-bottom: 20px;">
                    <div class="info-item"><label>Tipo Documento</label><span>${perfil.tipo_documento || '---'}</span></div>
                    <div class="info-item"><label>Número</label><span>${perfil.numero_documento || '---'}</span></div>
                </div>
                ${perfil.documento_frontal_url ? `<div class="images-grid">
                    <div class="image-box"><img src="${perfil.documento_frontal_url}" onclick="window.open(this.src)"><p>Documento (Frente)</p></div>
                    ${perfil.documento_trasero_url ? `<div class="image-box"><img src="${perfil.documento_trasero_url}" onclick="window.open(this.src)"><p>Documento (Reverso)</p></div>` : ''}
                    ${perfil.selfie_url ? `<div class="image-box"><img src="${perfil.selfie_url}" onclick="window.open(this.src)"><p>Selfie</p></div>` : ''}
                </div>` : '<p style="color: #666; text-align: center;">Sin documentos enviados</p>'}
                <div class="actions" style="margin-top: 30px; border-top: 1px solid #333; padding-top: 20px;">
                    ${perfil.bloqueado ? `<button class="btn btn-unblock" onclick="toggleBloqueo('${perfil.id}', false)"><i class="fas fa-unlock"></i> Desbloquear</button>` : `<button class="btn btn-block" onclick="toggleBloqueo('${perfil.id}', true)"><i class="fas fa-lock"></i> Bloquear</button>`}
                    <button class="btn btn-coins" onclick="abrirModalMonedas('${perfil.id}', '${perfil.nombre}', ${perfil.saldo_bc || 0})"><i class="fas fa-coins"></i> Agregar BC</button>
                </div>
            `;
        } catch (err) { modalBody.innerHTML = '<p class="empty">Error al cargar perfil.</p>'; }
    };

    window.cerrarModal = function() { document.getElementById('userModal').classList.remove('show'); };

    window.toggleBloqueo = async function(userId, bloquear) {
        if (!confirm(bloquear ? '¿Bloquear este usuario?' : '¿Desbloquear este usuario?')) return;
        const { error } = await db.from('perfiles').update({ bloqueado: bloquear, motivo_bloqueo: bloquear ? 'Bloqueado por admin' : null, ultima_actualizacion: new Date().toISOString() }).eq('id', userId);
        if (error) { alert('Error: ' + error.message); }
        else { alert(`Usuario ${bloquear ? 'bloqueado' : 'desbloqueado'}.`); await cargarUsuarios(); verPerfilUsuario(userId); }
    };

    window.abrirModalMonedas = function(userId, nombre, saldoActual) {
        const modal = document.getElementById('coinsModal');
        const modalBody = document.getElementById('coinsModalBody');
        modalBody.innerHTML = `
            <p style="margin-bottom: 15px;">Usuario: <strong style="color: #FFD700;">${nombre}</strong></p>
            <p style="margin-bottom: 20px;">Saldo actual: <strong style="color: #FFD700; font-size: 1.3rem;">${saldoActual.toFixed(2)} BC</strong></p>
            <div class="form-group"><label>Cantidad de monedas BC</label><input type="number" id="cantidadMonedas" min="0" step="0.01" placeholder="0.00"></div>
            <div class="form-group"><label>Motivo (opcional)</label><textarea id="motivoMonedas" rows="3" placeholder="Ej: Bono de bienvenida"></textarea></div>
            <div class="actions">
                <button class="btn btn-coins" onclick="agregarMonedas('${userId}', ${saldoActual})"><i class="fas fa-plus"></i> Agregar</button>
                <button class="btn btn-view" onclick="cerrarCoinsModal()">Cancelar</button>
            </div>
        `;
        modal.classList.add('show');
    };

    window.cerrarCoinsModal = function() { document.getElementById('coinsModal').classList.remove('show'); };

    window.agregarMonedas = async function(userId, saldoActual) {
        const cantidad = parseFloat(document.getElementById('cantidadMonedas').value);
        const motivo = document.getElementById('motivoMonedas').value;
        if (isNaN(cantidad) || cantidad <= 0) { alert('Cantidad inválida.'); return; }
        if (!confirm(`¿Agregar ${cantidad.toFixed(2)} BC?\nNuevo saldo: ${(saldoActual + cantidad).toFixed(2)} BC`)) return;
        const nuevoSaldo = saldoActual + cantidad;
        const { error } = await db.from('perfiles').update({ saldo_bc: nuevoSaldo, notas_admin: motivo ? `${motivo} (+${cantidad} BC)` : null, ultima_actualizacion: new Date().toISOString() }).eq('id', userId);
        if (error) { alert('Error: ' + error.message); }
        else { alert(`✅ Agregados ${cantidad.toFixed(2)} BC. Nuevo saldo: ${nuevoSaldo.toFixed(2)} BC`); cerrarCoinsModal(); await cargarUsuarios(); verPerfilUsuario(userId); }
    };

    // ============================================
    // TAB 3: TRANSMISIÓN EN VIVO
    // ============================================
    async function cargarConfigStream() {
        console.log(' Cargando configuración de stream...');
        try {
            const { data: config, error } = await db.from('config_stream_vivo').select('*').eq('id', 1).single();
            
            if (error && error.code !== 'PGRST116') {
                console.error('Error cargando config stream:', error);
                return;
            }

            const streamActivo = document.getElementById('streamActivo');
            const streamStatusText = document.getElementById('streamStatusText');
            const streamTitulo = document.getElementById('streamTitulo');
            const streamDescripcion = document.getElementById('streamDescripcion');
            const streamTipo = document.getElementById('streamTipo');
            const streamUrl = document.getElementById('streamUrl');

            if (config) {
                streamActivo.checked = config.activo;
                streamTitulo.value = config.titulo || '';
                streamDescripcion.value = config.descripcion || '';
                streamTipo.value = config.tipo_stream || 'hls';
                streamUrl.value = config.url_stream || '';
                console.log('✅ Configuración cargada:', config);
            } else {
                console.log('⚠️ No hay configuración, usando valores por defecto');
            }

            streamActivo.addEventListener('change', function() {
                streamStatusText.textContent = this.checked ? 'Activada (EN VIVO)' : 'Desactivada';
                streamStatusText.style.color = this.checked ? '#00ff00' : '#999';
            });
            streamActivo.dispatchEvent(new Event('change'));

        } catch (err) { console.error('Error en cargarConfigStream:', err); }
    }

    // ✅ FUNCIÓN GLOBAL PARA GUARDAR STREAM
    window.guardarConfigStream = async function() {
        console.log('💾 Guardando configuración de stream...');
        const msgDiv = document.getElementById('streamStatusMsg');
        msgDiv.style.display = 'none';
        msgDiv.className = 'stream-status-msg';

        const streamActivo = document.getElementById('streamActivo');
        const streamTitulo = document.getElementById('streamTitulo');
        const streamDescripcion = document.getElementById('streamDescripcion');
        const streamTipo = document.getElementById('streamTipo');
        const streamUrl = document.getElementById('streamUrl');

        const datos = {
            activo: streamActivo.checked,
            titulo: streamTitulo.value.trim(),
            descripcion: streamDescripcion.value.trim(),
            tipo_stream: streamTipo.value,
            url_stream: streamUrl.value.trim(),
            ultima_actualizacion: new Date().toISOString()
        };

        console.log('📝 Datos a guardar:', datos);

        if (!datos.titulo) {
            msgDiv.textContent = '⚠️ El título del evento es obligatorio.';
            msgDiv.classList.add('error');
            return;
        }

        if (datos.activo && !datos.url_stream) {
            msgDiv.textContent = '️ Debes ingresar una URL de stream si activas la transmisión.';
            msgDiv.classList.add('error');
            return;
        }

        try {
            // Intentar actualizar
            const { data: existingData, error: updateError } = await db.from('config_stream_vivo').update(datos).eq('id', 1).select();
            
            if (updateError) {
                console.error('Error al actualizar:', updateError);
                // Si no existe, insertar
                if (updateError.code === 'PGRST116') {
                    datos.id = 1;
                    const { error: insertError } = await db.from('config_stream_vivo').insert(datos);
                    if (insertError) {
                        console.error('Error al insertar:', insertError);
                        throw insertError;
                    }
                    console.log('✅ Configuración insertada');
                } else {
                    throw updateError;
                }
            } else {
                console.log('✅ Configuración actualizada:', existingData);
            }

            msgDiv.textContent = '✅ Configuración de transmisión guardada exitosamente.';
            msgDiv.classList.add('success');
            setTimeout(() => { msgDiv.style.display = 'none'; }, 3000);

        } catch (err) {
            console.error('Error guardando stream:', err);
            msgDiv.textContent = '❌ Error al guardar: ' + err.message;
            msgDiv.classList.add('error');
        }
    };

    // Asignar evento al botón
    const btnGuardarStream = document.getElementById('btnGuardarStream');
    if (btnGuardarStream) {
        btnGuardarStream.addEventListener('click', function() {
            console.log('🔘 Botón de guardar stream clickeado');
            window.guardarConfigStream();
        });
    }

    // ============================================
    // INICIALIZAR
    // ============================================
    const accesoPermitido = await verificarAccesoAdmin();
    if (accesoPermitido) {
        adminContent.style.display = 'block';
        accessDenied.style.display = 'none';
        await cargarEstadisticas();
        await cargarSolicitudesKYC();
    }
});
