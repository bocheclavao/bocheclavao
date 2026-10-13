document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) { console.error('No se pudo obtener el cliente de Supabase'); return; }

    // ==========================================
    // 1. ESTADO Y CONFIGURACIÓN
    // ==========================================
    let currentPage = 1;
    const itemsPerPage = 20;
    let currentTab = 'depositos';
    let filterStart = null;
    let filterEnd = null;
    let totalRecords = 0;

    // ==========================================
    // 2. VERIFICAR ACCESO ADMIN
    // ==========================================
    async function verificarAccesoAdmin() {
        const { data: { session } } = await db.auth.getSession();
        if (!session || !session.user) { window.location.href = 'index.html'; return false; }
        
        const { data: adminData } = await db.from('admin_roles').select('es_admin, activo').eq('id', session.user.id).eq('es_admin', true).eq('activo', true).single();
        if (!adminData) { 
            alert('Acceso denegado. No tienes permisos de administrador.'); 
            window.location.href = 'dashboard.html'; 
            return false; 
        }
        return true;
    }

    if (!await verificarAccesoAdmin()) return;

    // ==========================================
    // 3. CARGA DE DATOS CON JOINS DIRECTOS
    // ==========================================
    await cargarEstadisticas();
    await cargarTabla(currentTab);

    async function cargarEstadisticas() {
        const { count: countDep } = await db.from('depositos').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente');
        const { count: countRet } = await db.from('retiros').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente');
        
        const { data: depsAprobados } = await db.from('depositos').select('monto_usd').eq('estado', 'aprobado');
        let comisionTotal = 0;
        if (depsAprobados) {
            comisionTotal = depsAprobados.reduce((acc, curr) => acc + ((curr.monto_usd || 0) / 1.003 * 0.003), 0);
        }

        document.getElementById('statDepPendientes').textContent = countDep || 0;
        document.getElementById('statRetPendientes').textContent = countRet || 0;
        document.getElementById('statComision').textContent = '$' + comisionTotal.toFixed(2);
    }

    async function cargarTabla(tab) {
        currentTab = tab;
        currentPage = 1;
        await ejecutarConsulta();
    }

    async function ejecutarConsulta() {
        const tbody = document.getElementById(currentTab === 'depositos' ? 'tablaDepositos' : 'tablaRetiros');
        tbody.innerHTML = '<tr><td colspan="8" class="loading">Cargando datos...</td></tr>';

        try {
            // ==========================================
            // CONSULTA CON JOIN DIRECTO A PERFILES
            // ==========================================
            let query = db.from(currentTab).select(`
                *,
                perfiles!user_id (
                    id,
                    nombre,
                    email,
                    saldo_bc
                )
            `, { count: 'exact' });

            // Aplicar filtros de fecha si existen
            if (filterStart) query = query.gte('created_at', `${filterStart}T00:00:00`);
            if (filterEnd) query = query.lte('created_at', `${filterEnd}T23:59:59`);

            // Paginación
            const start = (currentPage - 1) * itemsPerPage;
            const end = start + itemsPerPage - 1;

            const { data, count, error } = await query.range(start, end).order('id', { ascending: false });

            if (error) {
                console.error('Error en consulta:', error);
                tbody.innerHTML = `<tr><td colspan="8" class="empty-state">Error: ${error.message}</td></tr>`;
                return;
            }

            totalRecords = count || 0;

            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No se encontraron registros.</td></tr>';
                renderizarPaginacion();
                return;
            }

            // Renderizar filas
            tbody.innerHTML = data.map(item => {
                // Extraer datos del perfil desde el JOIN
                const perfil = item.perfiles || {};
                const usuario = perfil.nombre || perfil.email || item.user_id?.substring(0, 8) || 'Desconocido';
                const saldoUsuario = perfil.saldo_bc || 0;
                
                // Formato de Fecha y Hora
                const fechaHora = item.created_at 
                    ? new Date(item.created_at).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) 
                    : 'N/A';
                
                let acciones = '';
                if (item.estado === 'pendiente') {
                    if (currentTab === 'depositos') {
                        acciones = `
                            <button class="action-btn btn-view" onclick='mostrarFichaCompleta("deposito", ${JSON.stringify(item).replace(/'/g, "&#39;")}, ${JSON.stringify(usuario).replace(/'/g, "&#39;")}, ${saldoUsuario})'><i class="fas fa-eye"></i></button>
                            <button class="action-btn btn-approve" onclick="aprobarDeposito('${item.id}', ${item.cantidad_monedas}, '${item.user_id}')"><i class="fas fa-check"></i></button>
                            <button class="action-btn btn-reject" onclick="rechazarDeposito('${item.id}')"><i class="fas fa-times"></i></button>
                        `;
                    } else {
                        acciones = `
                            <button class="action-btn btn-view" onclick='mostrarFichaCompleta("retiro", ${JSON.stringify(item).replace(/'/g, "&#39;")}, ${JSON.stringify(usuario).replace(/'/g, "&#39;")}, ${saldoUsuario})'><i class="fas fa-eye"></i></button>
                            <button class="action-btn btn-approve" onclick="aprobarRetiro('${item.id}')"><i class="fas fa-check"></i></button>
                            <button class="action-btn btn-reject" onclick="rechazarRetiro('${item.id}', ${item.monto_bc}, '${item.user_id}')"><i class="fas fa-undo"></i></button>
                        `;
                    }
                } else {
                    const tipoFicha = currentTab === 'depositos' ? 'deposito' : 'retiro';
                    acciones = `<button class="action-btn btn-view" onclick='mostrarFichaCompleta("${tipoFicha}", ${JSON.stringify(item).replace(/'/g, "&#39;")}, ${JSON.stringify(usuario).replace(/'/g, "&#39;")}, ${saldoUsuario})'><i class="fas fa-eye"></i> Ficha</button>`;
                }

                const montoDisplay = currentTab === 'depositos' 
                    ? `$${(item.monto_usd || 0).toFixed(2)} / Bs. ${(item.monto_bs || 0).toFixed(2)}`
                    : `Bs. ${(item.monto_bs || 0).toFixed(2)}`;

                return `
                    <tr>
                        <td><small>${item.id.substring(0,8)}...</small></td>
                        <td>
                            ${usuario}
                            <br>
                            <small style="color: #FFD700; font-weight: 600;">
                                <i class="fas fa-wallet"></i> ${Number(saldoUsuario).toFixed(2)} BC
                            </small>
                        </td>
                        <td><strong>${item.cantidad_monedas || item.monto_bc} BC</strong></td>
                        <td>${montoDisplay}</td>
                        <td>${(item.metodo_pago || 'N/A').toUpperCase()}</td>
                        <td>${fechaHora}</td>
                        <td><span class="status-badge status-${item.estado}">${item.estado}</span></td>
                        <td>${acciones}</td>
                    </tr>
                `;
            }).join('');

            renderizarPaginacion();

        } catch (err) {
            console.error('Error en ejecutarConsulta:', err);
            tbody.innerHTML = `<tr><td colspan="8" class="empty-state">Error: ${err.message}</td></tr>`;
        }
    }

    function renderizarPaginacion() {
        const totalPages = Math.ceil(totalRecords / itemsPerPage);
        const container = document.getElementById(currentTab === 'depositos' ? 'paginationDepositos' : 'paginationRetiros');
        
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = `
            <button class="page-btn" onclick="irAPagina(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>Anterior</button>
            <span class="page-info">Página ${currentPage} de ${totalPages} (${totalRecords} registros)</span>
            <button class="page-btn" onclick="irAPagina(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Siguiente</button>
        `;
    }

    window.irAPagina = function(page) {
        if (page < 1 || page > Math.ceil(totalRecords / itemsPerPage)) return;
        currentPage = page;
        ejecutarConsulta();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.aplicarFiltro = function() {
        filterStart = document.getElementById('filterStartDate').value || null;
        filterEnd = document.getElementById('filterEndDate').value || null;
        ejecutarConsulta();
    };

    window.limpiarFiltro = function() {
        document.getElementById('filterStartDate').value = '';
        document.getElementById('filterEndDate').value = '';
        filterStart = null;
        filterEnd = null;
        ejecutarConsulta();
    };

    window.cambiarTab = function(tab, event) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.table-container').forEach(t => t.classList.remove('active'));
        if (event && event.target) event.target.classList.add('active');
        document.getElementById(`tab-${tab}`).classList.add('active');
        cargarTabla(tab);
    };

    // ==========================================
    // 4. MODAL FICHA COMPLETA
    // ==========================================
    window.mostrarFichaCompleta = function(tipo, item, usuario, saldoUsuario) {
        document.getElementById('fichaTitulo').textContent = tipo === 'deposito' ? 'Ficha de Depósito' : 'Ficha de Retiro';
        
        const estadoEl = document.getElementById('fichaEstado');
        estadoEl.textContent = item.estado.toUpperCase();
        estadoEl.className = `status-badge status-${item.estado}`;

        const fechaHora = item.created_at ? new Date(item.created_at).toLocaleString('es-VE', { dateStyle: 'full', timeStyle: 'short' }) : 'N/A';

        let html = `
            <div class="ficha-row"><span class="label">ID Transacción:</span><span class="value">${item.id}</span></div>
            <div class="ficha-row"><span class="label">Usuario:</span><span class="value">${usuario}</span></div>
            <div class="ficha-row"><span class="label">Saldo Actual del Usuario:</span><span class="value" style="color: #00ff00; font-weight: 800;">${Number(saldoUsuario).toFixed(2)} BC</span></div>
            <div class="ficha-row"><span class="label">Fecha y Hora:</span><span class="value">${fechaHora}</span></div>
            <div class="ficha-row"><span class="label">Monto en BC:</span><span class="value" style="color: #FFD700;">${item.cantidad_monedas || item.monto_bc} BC</span></div>
            <div class="ficha-row"><span class="label">Método:</span><span class="value">${(item.metodo_pago || 'N/A').toUpperCase()}</span></div>
        `;

        if (tipo === 'deposito') {
            html += `
                <div class="ficha-row"><span class="label">Total USD:</span><span class="value">$${(item.monto_usd || 0).toFixed(2)}</span></div>
                <div class="ficha-row"><span class="label">Total Bs:</span><span class="value">Bs. ${(item.monto_bs || 0).toFixed(2)}</span></div>
                <div class="ficha-row"><span class="label">Tasa BCV Usada:</span><span class="value">${(item.tasa_bcv_usada || 0).toFixed(2)}</span></div>
            `;
        } else {
            html += `
                <div class="ficha-row"><span class="label">Comisión BC:</span><span class="value">-${(item.comision_bc || 0).toFixed(2)} BC</span></div>
                <div class="ficha-row"><span class="label">Monto Neto Bs:</span><span class="value">Bs. ${(item.monto_bs || 0).toFixed(2)}</span></div>
            `;
        }

        if (item.datos_pago && typeof item.datos_pago === 'object') {
            html += `<div style="margin-top: 15px; border-top: 1px solid #333; padding-top: 10px;"><strong style="color: #FFD700; font-size: 0.9rem;">Datos de Pago Proporcionados:</strong></div>`;
            for (const [key, value] of Object.entries(item.datos_pago)) {
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                html += `<div class="ficha-row"><span class="label">${label}:</span><span class="value">${value}</span></div>`;
            }
        }

        document.getElementById('fichaBody').innerHTML = html;

        const imgContainer = document.getElementById('fichaImageContainer');
        if (tipo === 'deposito' && item.comprobante_url && item.comprobante_url !== 'null') {
            document.getElementById('fichaImagen').src = item.comprobante_url;
            document.getElementById('fichaImagen').onclick = () => window.open(item.comprobante_url, '_blank');
            document.getElementById('fichaImagen').style.cursor = 'zoom-in';
            imgContainer.style.display = 'block';
        } else {
            imgContainer.style.display = 'none';
        }

        document.getElementById('modalFicha').classList.add('active');
    };

    window.cerrarModalFicha = function() {
        document.getElementById('modalFicha').classList.remove('active');
    };

    document.getElementById('modalFicha').addEventListener('click', function(e) {
        if (e.target === this) cerrarModalFicha();
    });

    // ==========================================
    // 5. ACCIONES BLINDADAS + CORREOS
    // ==========================================
    window.aprobarDeposito = async function(idDeposito, cantidadBC, userId) {
        if (!confirm(`¿Aprobar este depósito de ${cantidadBC} BC? Se sumará al saldo y se notificará al usuario.`)) return;

        try {
            const { data: userData } = await db.from('perfiles').select('email, nombre, saldo_bc').eq('id', userId).single();
            if (!userData) throw new Error('Usuario no encontrado');

            const { error: errDep } = await db.from('depositos').update({ estado: 'aprobado' }).eq('id', idDeposito);
            if (errDep) throw errDep;

            const nuevoSaldo = (userData.saldo_bc || 0) + Number(cantidadBC);
            const { error: errUpdate } = await db.from('perfiles').update({ saldo_bc: nuevoSaldo }).eq('id', userId);
            if (errUpdate) throw errUpdate;

            try {
                await db.functions.invoke('notificar-transaccion', {
                    body: {
                        email: userData.email,
                        nombre: userData.nombre || 'Usuario',
                        tipo: 'deposito_aprobado',
                        monto: cantidadBC,
                        id: idDeposito
                    }
                });
            } catch (emailErr) {
                console.warn('⚠️ Falló el envío del correo, pero la transacción se aprobó:', emailErr);
            }

            alert('✅ Depósito aprobado, saldo actualizado y correo enviado.');
            await cargarEstadisticas();
            ejecutarConsulta();
        } catch (err) {
            console.error('Error aprobando depósito:', err);
            alert('❌ Error al procesar: ' + err.message);
        }
    };

    window.rechazarDeposito = async function(idDeposito) {
        if (!confirm('¿Rechazar este depósito?')) return;
        try {
            const { error } = await db.from('depositos').update({ estado: 'rechazado' }).eq('id', idDeposito);
            if (error) throw error;
            alert('✅ Depósito rechazado.');
            await cargarEstadisticas();
            ejecutarConsulta();
        } catch (err) {
            alert('❌ Error: ' + err.message);
        }
    };

    window.aprobarRetiro = async function(idRetiro) {
        if (!confirm('¿Confirmar que ya realizaste el pago externo y aprobar este retiro? Se notificará al usuario.')) return;
        
        try {
            const { data: retiroData } = await db.from('retiros').select('user_id, monto_bc').eq('id', idRetiro).single();
            const { data: userData } = await db.from('perfiles').select('email, nombre').eq('id', retiroData.user_id).single();

            const { error } = await db.from('retiros').update({ estado: 'aprobado' }).eq('id', idRetiro);
            if (error) throw error;
            
            try {
                await db.functions.invoke('notificar-transaccion', {
                    body: {
                        email: userData.email,
                        nombre: userData.nombre || 'Usuario',
                        tipo: 'retiro_aprobado',
                        monto: retiroData.monto_bc,
                        id: idRetiro
                    }
                });
            } catch (emailErr) {
                console.warn('⚠️ Falló el envío del correo, pero el retiro se aprobó:', emailErr);
            }

            alert('✅ Retiro marcado como APROBADO y correo enviado.');
            await cargarEstadisticas();
            ejecutarConsulta();
        } catch (err) {
            alert('❌ Error: ' + err.message);
        }
    };

    window.rechazarRetiro = async function(idRetiro, montoBC, userId) {
        if (!confirm(`️ ¿Rechazar este retiro? Se devolverán ${montoBC} BC al saldo del usuario.`)) return;
        
        try {
            const { error: errRet } = await db.from('retiros').update({ estado: 'rechazado' }).eq('id', idRetiro);
            if (errRet) throw errRet;

            const { data: perfil } = await db.from('perfiles').select('saldo_bc').eq('id', userId).single();
            const nuevoSaldo = (perfil.saldo_bc || 0) + Number(montoBC);
            
            const { error: errUpdate } = await db.from('perfiles').update({ saldo_bc: nuevoSaldo }).eq('id', userId);
            if (errUpdate) throw errUpdate;

            alert(`✅ Retiro rechazado y ${montoBC} BC devueltos.`);
            await cargarEstadisticas();
            ejecutarConsulta();
        } catch (err) {
            alert('❌ Error crítico: ' + err.message);
        }
    };
});
