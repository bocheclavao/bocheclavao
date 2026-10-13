document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) { console.error('No se pudo obtener el cliente de Supabase'); return; }

    // ==========================================
    // 1. VERIFICAR ACCESO ADMIN (Optimizado)
    // ==========================================
    async function verificarAccesoAdmin() {
        const { data: { session } } = await db.auth.getSession();
        if (!session || !session.user) { 
            window.location.href = 'index.html'; 
            return false; 
        }
        
        // Usamos session.user.id directamente, sin llamar a getUser() de nuevo
        const { data: adminData, error: adminError } = await db
            .from('admin_roles')
            .select('es_admin, activo')
            .eq('id', session.user.id)
            .eq('es_admin', true)
            .eq('activo', true)
            .single();
        
        if (!adminData || adminError) { 
            alert('Acceso denegado. No tienes permisos de administrador.');
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
        
        // CORRECCIÓN 3: Filtrar solo por el mes actual para que coincida con el título
        const hoy = new Date();
        const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString();
        
        const { data: depsAprobados } = await db.from('depositos')
            .select('monto_usd')
            .eq('estado', 'aprobado')
            .gte('created_at', primerDiaMes);
            
        let comisionTotal = 0;
        if (depsAprobados) {
            comisionTotal = depsAprobados.reduce((acc, curr) => {
                const base = (curr.monto_usd || 0) / 1.003; 
                return acc + (base * 0.003);
            }, 0);
        }

        document.getElementById('statDepPendientes').textContent = countDep || 0;
        document.getElementById('statRetPendientes').textContent = countRet || 0;
        document.getElementById('statComision').textContent = '$' + comisionTotal.toFixed(2);
    }

    async function cargarDepositos() {
        const tbody = document.getElementById('tablaDepositos');
        tbody.innerHTML = '<tr><td colspan="8" class="loading">Cargando depósitos...</td></tr>';

        const { data: depositos, error: errDep } = await db.from('depositos').select('*').order('created_at', { ascending: false });
        if (errDep || !depositos) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Error al cargar datos.</td></tr>';
            return;
        }

        if (depositos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No hay depósitos registrados</td></tr>';
            return;
        }

        const userIds = [...new Set(depositos.map(d => d.user_id))];
        const { data: perfiles } = await db.from('perfiles').select('id, nombre, email').in('id', userIds);
        
        const userMap = {};
        if (perfiles) {
            perfiles.forEach(p => { userMap[p.id] = p.nombre || p.email || 'Usuario Desconocido'; });
        }

        tbody.innerHTML = depositos.map(dep => {
            const usuario = userMap[dep.user_id] || 'Usuario Desconocido';
            
            // CORRECCIÓN 2: Proteger contra valores nulos con || 0
            const montoUsd = dep.monto_usd || 0;
            const montoBs = dep.monto_bs || 0;
            const totalTexto = `$${montoUsd.toFixed(2)} / Bs. ${montoBs.toFixed(2)}`;
            const fecha = new Date(dep.created_at).toLocaleDateString('es-VE');
            
            let acciones = '';
            if (dep.estado === 'pendiente') {
                // CORRECCIÓN 1: Usar JSON.stringify para escapar comillas en el nombre del usuario
                acciones = `
                    <button class="action-btn btn-view" onclick="verComprobante('${dep.comprobante_url || ''}', ${JSON.stringify(usuario)})"><i class="fas fa-eye"></i></button>
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
        tbody.innerHTML = '<tr><td colspan="8" class="loading">Cargando retiros...</td></tr>';

        const { data: retiros, error: errRet } = await db.from('retiros').select('*').order('created_at', { ascending: false });
        if (errRet || !retiros) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Error al cargar datos.</td></tr>';
            return;
        }

        if (retiros.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No hay retiros registrados</td></tr>';
            return;
        }

        const userIds = [...new Set(retiros.map(r => r.user_id))];
        const { data: perfiles } = await db.from('perfiles').select('id, nombre, email').in('id', userIds);
        
        const userMap = {};
        if (perfiles) {
            perfiles.forEach(p => { userMap[p.id] = p.nombre || p.email || 'Usuario Desconocido'; });
        }

        tbody.innerHTML = retiros.map(ret => {
            const usuario = userMap[ret.user_id] || 'Usuario Desconocido';
            const fecha = new Date(ret.created_at).toLocaleDateString('es-VE');
            const montoBs = ret.monto_bs || 0; // CORRECCIÓN 2
            
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
                    <td>Bs. ${montoBs.toFixed(2)}</td>
                    <td>${ret.metodo_pago.toUpperCase()}</td>
                    <td>${fecha}</td>
                    <td><span class="status-badge status-${ret.estado}">${ret.estado}</span></td>
                    <td>${acciones}</td>
                </tr>
            `;
        }).join('');
    }

    // ==========================================
    // 4. ACCIONES BLINDADAS
    // ==========================================
    window.aprobarDeposito = async function(idDeposito, cantidadBC, userId) {
        if (!confirm(`¿Aprobar este depósito de ${cantidadBC} BC? Se sumará al saldo del usuario.`)) return;

        try {
            const { error: errDep } = await db.from('depositos').update({ estado: 'aprobado' }).eq('id', idDeposito);
            if (errDep) throw errDep;

            const { data: perfil, error: errPerfil } = await db.from('perfiles').select('saldo_bc').eq('id', userId).single();
            if (errPerfil || !perfil) throw new Error('Usuario no encontrado');

            const nuevoSaldo = (perfil.saldo_bc || 0) + Number(cantidadBC);
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
            const { error: errRet } = await db.from('retiros').update({ estado: 'rechazado' }).eq('id', idRetiro);
            if (errRet) throw errRet;

            const { data: perfil, error: errPerfil } = await db.from('perfiles').select('saldo_bc').eq('id', userId).single();
            if (errPerfil || !perfil) throw new Error('Usuario no encontrado');

            const nuevoSaldo = (perfil.saldo_bc || 0) + Number(montoBC);
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
    // CORRECCIÓN 4: Recibir 'event' como parámetro explícito
    window.cambiarTab = function(tab, event) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.table-container').forEach(t => t.classList.remove('active'));
        
        if (event && event.target) {
            event.target.classList.add('active');
        }
        document.getElementById(`tab-${tab}`).classList.add('active');
    };

    window.verComprobante = function(url, usuario) {
        if (!url || url === 'null' || url === 'undefined') { 
            alert('Este depósito no tiene comprobante adjunto.'); 
            return; 
        }
        document.getElementById('imgComprobante').src = url;
        document.getElementById('infoComprobante').textContent = `Usuario: ${usuario}`;
        document.getElementById('modalComprobante').classList.add('active');
    };

    window.cerrarModal = function() {
        document.getElementById('modalComprobante').classList.remove('active');
    };

    // Extra: Cerrar modal al hacer clic fuera de la imagen
    document.getElementById('modalComprobante').addEventListener('click', function(e) {
        if (e.target === this) cerrarModal();
    });
});
