document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) { console.error('No se pudo obtener el cliente de Supabase'); return; }

    // ==========================================
    // 1. VERIFICAR ACCESO ADMIN
    // ==========================================
    async function verificarAccesoAdmin() {
        const { data: { session } } = await db.auth.getSession();
        if (!session) { window.location.href = 'index.html'; return false; }
        
        const { data: { user } } = await db.auth.getUser();
        const { data: adminData } = await db.from('admin_roles').select('es_admin, activo').eq('id', user.id).eq('es_admin', true).eq('activo', true).single();
        
        if (!adminData) { 
            alert('Acceso denegado. No eres administrador.');
            window.location.href = 'dashboard.html'; 
            return false; 
        }
        return true;
    }

    const esAdmin = await verificarAccesoAdmin();
    if (!esAdmin) return;

    // ==========================================
    // 2. CARGAR DATOS INICIALES
    // ==========================================
    await cargarEstadisticas();
    await cargarDepositos();
    await cargarRetiros();

    // ==========================================
    // 3. FUNCIONES DE CARGA
    // ==========================================
    async function cargarEstadisticas() {
        const { count: countDep } = await db.from('depositos').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente');
        const { count: countRet } = await db.from('retiros').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente');
        
        // Calcular comisión acumulada (aproximado de depósitos aprobados)
        const { data: depsAprobados } = await db.from('depositos').select('monto_usd, descuento_aplicado').eq('estado', 'aprobado');
        let comisionTotal = 0;
        if (depsAprobados) {
            comisionTotal = depsAprobados.reduce((acc, curr) => {
                const base = curr.monto_usd / 1.003; // Reverse engineering del total con comisión
                return acc + (base * 0.003);
            }, 0);
        }

        document.getElementById('statDepPendientes').textContent = countDep || 0;
        document.getElementById('statRetPendientes').textContent = countRet || 0;
        document.getElementById('statComision').textContent = '$' + comisionTotal.toFixed(2);
    }

    async function cargarDepositos() {
        const tbody = document.getElementById('tablaDepositos');
        tbody.innerHTML = '<tr><td colspan="8" class="loading">Cargando...</td></tr>';

        const { data, error } = await db
            .from('depositos')
            .select('*, perfiles(nombre, email)')
            .order('created_at', { ascending: false });

        if (error || !data) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Error al cargar datos</td></tr>';
            return;
        }

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No hay depósitos registrados</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(dep => {
            const usuario = dep.perfiles?.nombre || dep.perfiles?.email || 'Desconocido';
            const totalTexto = `$${dep.monto_usd.toFixed(2)} / Bs. ${dep.monto_bs.toFixed(2)}`;
            const fecha = new Date(dep.created_at).toLocaleDateString('es-VE');
            
            let acciones = '';
            if (dep.estado === 'pendiente') {
                acciones = `
                    <button class="action-btn btn-view" onclick="verComprobante('${dep.comprobante_url}', '${usuario}')"><i class="fas fa-eye"></i></button>
                    <button class="action-btn btn-approve" onclick="aprobarDeposito('${dep.id}', ${dep.cantidad_monedas}, '${dep.user_id}')"><i class="fas fa-check"></i></button>
                    <button class="action-btn btn-reject" onclick="rechazarDeposito('${dep.id}')"><i class="fas fa-times"></i></button>
                `;
            } else {
                acciones = `<span style="color: #666; font-size: 0.8rem;">Sin acciones</span>`;
            }

            return `
                <tr>
                    <td><small>${dep.id.substring(0,8)}...</small></td>
                    <td>${usuario}</td>
                    <td><strong>${dep.cantidad_monedas} BC</strong></td>
                    <td>${totalTexto}</td>
                    <td>${dep.metodo_pago.toUpperCase()}</td>
                    <td>${fecha}</td>
                    <td><span class="status-badge status-${dep.estado}">${dep.estado}</span></td>
                    <td>${acciones}</td>
                </tr>
            `;
        }).join('');
    }

    async function cargarRetiros() {
        const tbody = document.getElementById('tablaRetiros');
        tbody.innerHTML = '<tr><td colspan="8" class="loading">Cargando...</td></tr>';

        const { data, error } = await db
            .from('retiros')
            .select('*, perfiles(nombre, email)')
            .order('created_at', { ascending: false });

        if (error || !data) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Error al cargar datos</td></tr>';
            return;
        }

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No hay retiros registrados</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(ret => {
            const usuario = ret.perfiles?.nombre || ret.perfiles?.email || 'Desconocido';
            const fecha = new Date(ret.created_at).toLocaleDateString('es-VE');
            
            let acciones = '';
            if (ret.estado === 'pendiente') {
                acciones = `
                    <button class="action-btn btn-approve" onclick="aprobarRetiro('${ret.id}')"><i class="fas fa-check"></i></button>
                    <button class="action-btn btn-reject" onclick="rechazarRetiro('${ret.id}', ${ret.monto_bc}, '${ret.user_id}')"><i class="fas fa-undo"></i> Devolver</button>
                `;
            } else {
                acciones = `<span style="color: #666; font-size: 0.8rem;">Sin acciones</span>`;
            }

            return `
                <tr>
                    <td><small>${ret.id.substring(0,8)}...</small></td>
                    <td>${usuario}</td>
                    <td><strong>${ret.monto_bc} BC</strong></td>
                    <td>Bs. ${ret.monto_bs.toFixed(2)}</td>
                    <td>${ret.metodo_pago.toUpperCase()}</td>
                    <td>${fecha}</td>
                    <td><span class="status-badge status-${ret.estado}">${ret.estado}</span></td>
                    <td>${acciones}</td>
                </tr>
            `;
        }).join('');
    }

    // ==========================================
    // 4. ACCIONES BLINDADAS (CORE FINANCIERO)
    // ==========================================
    
    window.aprobarDeposito = async function(idDeposito, cantidadBC, userId) {
        if (!confirm(`¿Aprobar este depósito de ${cantidadBC} BC? Se sumará al saldo del usuario.`)) return;

        try {
            // 1. Actualizar estado del depósito
            const { error: errDep } = await db.from('depositos').update({ estado: 'aprobado' }).eq('id', idDeposito);
            if (errDep) throw errDep;

            // 2. SUMAR SALDO AL USUARIO (Lectura fresca + Update)
            const { data: perfil, error: errPerfil } = await db.from('perfiles').select('saldo_bc').eq('id', userId).single();
            if (errPerfil) throw errPerfil;

            const nuevoSaldo = (perfil.saldo_bc || 0) + cantidadBC;
            const { error: errUpdate } = await db.from('perfiles').update({ saldo_bc: nuevoSaldo }).eq('id', userId);
            if (errUpdate) throw errUpdate;

            alert('✅ Depósito aprobado y saldo sumado correctamente.');
            await cargarEstadisticas();
            await cargarDepositos();
        } catch (err) {
            console.error('Error aprobando depósito:', err);
            alert('❌ Error al procesar: ' + err.message);
        }
    };

    window.rechazarDeposito = async function(idDeposito) {
        if (!confirm('¿Rechazar este depósito? El usuario será notificado y no se sumará el saldo.')) return;
        
        try {
            const { error } = await db.from('depositos').update({ estado: 'rechazado' }).eq('id', idDeposito);
            if (error) throw error;
            
            alert('✅ Depósito rechazado.');
            await cargarEstadisticas();
            await cargarDepositos();
        } catch (err) {
            alert('❌ Error: ' + err.message);
        }
    };

    window.aprobarRetiro = async function(idRetiro) {
        if (!confirm('¿Confirmar que ya realizaste el pago externo y aprobar este retiro?')) return;
        
        try {
            const { error } = await db.from('retiros').update({ estado: 'aprobado' }).eq('id', idRetiro);
            if (error) throw error;
            
            alert('✅ Retiro marcado como APROBADO (Pagado).');
            await cargarEstadisticas();
            await cargarRetiros();
        } catch (err) {
            alert('❌ Error: ' + err.message);
        }
    };

    window.rechazarRetiro = async function(idRetiro, montoBC, userId) {
        if (!confirm(`⚠️ ¿Rechazar este retiro?\n\nEl monto de ${montoBC} BC será DEVUELTO automáticamente al saldo del usuario.`)) return;
        
        try {
            // 1. Cambiar estado a rechazado
            const { error: errRet } = await db.from('retiros').update({ estado: 'rechazado' }).eq('id', idRetiro);
            if (errRet) throw errRet;

            // 2. DEVOLVER SALDO AL USUARIO (Lectura fresca + Update)
            const { data: perfil, error: errPerfil } = await db.from('perfiles').select('saldo_bc').eq('id', userId).single();
            if (errPerfil) throw errPerfil;

            const nuevoSaldo = (perfil.saldo_bc || 0) + montoBC;
            const { error: errUpdate } = await db.from('perfiles').update({ saldo_bc: nuevoSaldo }).eq('id', userId);
            if (errUpdate) throw errUpdate;

            alert(`✅ Retiro rechazado y ${montoBC} BC devueltos al usuario.`);
            await cargarEstadisticas();
            await cargarRetiros();
        } catch (err) {
            console.error('Error rechazando retiro:', err);
            alert('❌ Error crítico al devolver saldo: ' + err.message);
        }
    };

    // ==========================================
    // 5. UTILIDADES UI
    // ==========================================
    window.cambiarTab = function(tab) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.table-container').forEach(t => t.classList.remove('active'));
        
        event.target.classList.add('active');
        document.getElementById(`tab-${tab}`).classList.add('active');
    };

    window.verComprobante = function(url, usuario) {
        if (!url) { alert('Este depósito no tiene comprobante adjunto.'); return; }
        document.getElementById('imgComprobante').src = url;
        document.getElementById('infoComprobante').textContent = `Usuario: ${usuario}`;
        document.getElementById('modalComprobante').classList.add('active');
    };

    window.cerrarModal = function() {
        document.getElementById('modalComprobante').classList.remove('active');
    };
});
