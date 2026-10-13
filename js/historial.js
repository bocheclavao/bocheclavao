document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) { window.location.href = 'index.html'; return; }

    // 1. Verificar sesión
    const { data: { session } } = await db.auth.getSession();
    if (!session || !session.user) { window.location.href = 'index.html'; return; }

    // Variables de estado
    let currentPage = 1;
    const itemsPerPage = 20;
    let filterType = 'todos';
    let filterStart = null;
    let filterEnd = null;
    
    let allTransactions = [];
    let filteredTransactions = [];

    // 2. Cargar Perfil y Saldo
    async function cargarPerfil() {
        const { data: perfil, error } = await db.from('perfiles').select('nombre, saldo_bc, user_id').eq('id', session.user.id).single();
        if (error || !perfil) {
            window.location.href = 'dashboard.html';
            return;
        }
        const saldo = perfil.saldo_bc || 0;
        document.getElementById('walletBalance').textContent = `${saldo.toFixed(2)} BC`;
        document.getElementById('walletUserName').textContent = perfil.nombre || session.user.email;
        document.getElementById('walletUserId').textContent = `ID: ${(perfil.user_id || session.user.id).substring(0, 8).toUpperCase()}`;
    }

    // 3. Cargar Transacciones (Depósitos y Retiros)
    async function cargarTransacciones() {
        const tbody = document.getElementById('tablaHistorial');
        tbody.innerHTML = '<tr><td colspan="6" class="loading">Cargando historial...</td></tr>';

        try {
            // Obtener depósitos
            const { data: depositos, error: errDep } = await db
                .from('depositos')
                .select('*')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false });

            // Obtener retiros
            const { data: retiros, error: errRet } = await db
                .from('retiros')
                .select('*')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false });

            if (errDep || errRet) throw new Error('Error al cargar datos de la base de datos');

            // Combinar y estandarizar formato
            allTransactions = [];
            
            if (depositos) {
                depositos.forEach(d => {
                    allTransactions.push({
                        tipo: 'Depósito',
                        fecha: d.created_at,
                        montoBC: d.cantidad_monedas,
                        detalle: `$${(d.monto_usd || 0).toFixed(2)} / Bs. ${(d.monto_bs || 0).toFixed(2)}`,
                        metodo: d.metodo_pago ? d.metodo_pago.toUpperCase() : 'N/A',
                        estado: d.estado
                    });
                });
            }
            
            if (retiros) {
                retiros.forEach(r => {
                    allTransactions.push({
                        tipo: 'Retiro',
                        fecha: r.created_at,
                        montoBC: r.monto_bc,
                        detalle: `Bs. ${(r.monto_bs || 0).toFixed(2)}`,
                        metodo: r.metodo_pago ? r.metodo_pago.toUpperCase() : 'N/A',
                        estado: r.estado
                    });
                });
            }

            // Ordenar por fecha descendente (más reciente primero)
            allTransactions.sort((a, b) => {
                const dateA = new Date(a.fecha || 0).getTime();
                const dateB = new Date(b.fecha || 0).getTime();
                return dateB - dateA;
            });

            aplicarFiltrosYRenderizar();

        } catch (err) {
            console.error('Error:', err);
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Error al cargar el historial. Recarga la página.</td></tr>';
        }
    }

    // 4. Aplicar Filtros y Renderizar
    function aplicarFiltrosYRenderizar() {
        filteredTransactions = [...allTransactions];

        // Filtro por tipo
        if (filterType === 'deposito') {
            filteredTransactions = filteredTransactions.filter(t => t.tipo === 'Depósito');
        } else if (filterType === 'retiro') {
            filteredTransactions = filteredTransactions.filter(t => t.tipo === 'Retiro');
        }

        // Filtro por fecha
        if (filterStart) {
            const startMs = new Date(filterStart + 'T00:00:00').getTime();
            filteredTransactions = filteredTransactions.filter(t => new Date(t.fecha).getTime() >= startMs);
        }
        if (filterEnd) {
            const endMs = new Date(filterEnd + 'T23:59:59').getTime();
            filteredTransactions = filteredTransactions.filter(t => new Date(t.fecha).getTime() <= endMs);
        }

        // Paginación
        const totalRecords = filteredTransactions.length;
        const totalPages = Math.ceil(totalRecords / itemsPerPage) || 1;
        
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;
        
        const startIdx = (currentPage - 1) * itemsPerPage;
        const endIdx = startIdx + itemsPerPage;
        const paginatedData = filteredTransactions.slice(startIdx, endIdx);

        renderizarTabla(paginatedData);
        renderizarPaginacion(totalPages, totalRecords);
    }

    function renderizarTabla(data) {
        const tbody = document.getElementById('tablaHistorial');
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No se encontraron transacciones con estos filtros.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(t => {
            const fecha = t.fecha ? new Date(t.fecha).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A';
            const tipoClass = t.tipo === 'Depósito' ? 'tipo-deposito' : 'tipo-retiro';
            const statusClass = `status-${t.estado}`;
            const icono = t.tipo === 'Depósito' ? '<i class="fas fa-arrow-down"></i>' : '<i class="fas fa-arrow-up"></i>';

            return `
                <tr>
                    <td>${fecha}</td>
                    <td>
                        <span class="tipo-badge ${tipoClass}">
                            ${icono} ${t.tipo}
                        </span>
                    </td>
                    <td><strong>${t.montoBC} BC</strong></td>
                    <td>${t.detalle}</td>
                    <td>${t.metodo}</td>
                    <td><span class="status-badge ${statusClass}">${t.estado}</span></td>
                </tr>
            `;
        }).join('');
    }

    function renderizarPaginacion(totalPages, totalRecords) {
        const container = document.getElementById('paginationContainer');
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = `
            <button class="page-btn" onclick="cambiarPagina(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i> Anterior
            </button>
            <span class="page-info">Página ${currentPage} de ${totalPages} (${totalRecords} registros)</span>
            <button class="page-btn" onclick="cambiarPagina(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
                Siguiente <i class="fas fa-chevron-right"></i>
            </button>
        `;
    }

    // 5. Funciones Globales para los botones
    window.cambiarPagina = function(page) {
        const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage) || 1;
        if (page < 1 || page > totalPages) return;
        currentPage = page;
        aplicarFiltrosYRenderizar();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.aplicarFiltros = function() {
        filterType = document.getElementById('filterType').value;
        filterStart = document.getElementById('filterStart').value || null;
        filterEnd = document.getElementById('filterEnd').value || null;
        currentPage = 1; // Resetear a la primera página al filtrar
        aplicarFiltrosYRenderizar();
    };

    window.limpiarFiltros = function() {
        document.getElementById('filterType').value = 'todos';
        document.getElementById('filterStart').value = '';
        document.getElementById('filterEnd').value = '';
        filterType = 'todos';
        filterStart = null;
        filterEnd = null;
        currentPage = 1;
        aplicarFiltrosYRenderizar();
    };

    // Inicializar
    await cargarPerfil();
    await cargarTransacciones();
});
