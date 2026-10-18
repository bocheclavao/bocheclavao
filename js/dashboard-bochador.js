document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) {
        window.location.href = 'index.html';
        return;
    }

    const { data: { session } } = await db.auth.getSession();
    if (!session || !session.user) {
        window.location.href = 'index.html';
        return;
    }

    // Diccionario de banderas (puedes expandirlo)
    const banderas = {
        'Venezuela': '🇻🇪', 'Colombia': '🇨🇴', 'México': '🇲🇽', 
        'Argentina': '🇦🇷', 'España': '🇪🇸', 'Estados Unidos': '🇺🇸',
        'Perú': '🇵🇪', 'Chile': '🇨🇱', 'Ecuador': '🇪🇨', 'Panamá': '🇵🇦'
    };

    try {
        // 1. Obtener datos del perfil
        const { data: perfil, error } = await db
            .from('perfiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

        if (error || !perfil) {
            throw new Error('No se pudo cargar el perfil.');
        }

        // 2. Procesar datos
        const nombre = perfil.nombre_completo || perfil.nombre || 'Bochador';
        const nacionalidad = perfil.nacionalidad || 'Venezuela';
        const bandera = banderas[nacionalidad] || '🏳️';
        const mano = perfil.mano_habil || 'Diestro';
        const peso = perfil.peso ? `${perfil.peso} kg` : 'Pendiente';
        const estatura = perfil.estatura ? `${perfil.estatura} cm` : 'Pendiente';
        const brazo = perfil.longitud_brazo ? `${perfil.longitud_brazo} cm` : 'Pendiente';
        const sexo = perfil.sexo || 'Pendiente';
        const telefono = perfil.telefono || 'Pendiente';
        
        // Calcular edad
        let edad = 'Pendiente';
        if (perfil.fecha_nacimiento) {
            const hoy = new Date();
            const nacimiento = new Date(perfil.fecha_nacimiento);
            let edadCalc = hoy.getFullYear() - nacimiento.getFullYear();
            const mes = hoy.getMonth() - nacimiento.getMonth();
            if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
                edadCalc--;
            }
            edad = `${edadCalc} años`;
        }

        const partidos = perfil.partidos_jugados || 0;
        const aciertos = perfil.porcentaje_aciertos ? `${perfil.porcentaje_aciertos}%` : '0%';
        const categoria = perfil.categoria || 'F';
        const estado = perfil.estado_clasificacion || 'No clasificado';
        
        // Formatear últimos 3 partidos
        let ultimosPartidos = 'Sin registros';
        if (perfil.ultimos_3_partidos && Array.isArray(perfil.ultimos_3_partidos) && perfil.ultimos_3_partidos.length > 0) {
            ultimosPartidos = perfil.ultimos_3_partidos.slice(0, 3).map(f => 
                new Date(f).toLocaleDateString('es-VE')
            ).join(', ');
        }

        const avatarUrl = perfil.avatar_url || session.user.user_metadata?.avatar_url;

        // 3. Renderizar HTML
        const mainContent = document.getElementById('mainContent');
        const statusClass = estado === 'No clasificado' ? 'status-no-cls' : 'status-cls';
        const avatarHTML = avatarUrl 
            ? `<img src="${avatarUrl}" alt="Foto" class="profile-photo">` 
            : `<i class="fas fa-user profile-photo-placeholder"></i>`;

        mainContent.innerHTML = `
            <div class="profile-header">
                <div class="status-badge ${statusClass}">
                    <i class="fas fa-${estado === 'No clasificado' ? 'clock' : 'check-circle'}"></i> ${estado}
                </div>
                <div class="profile-photo-container">
                    ${avatarHTML}
                </div>
                <div class="profile-name">${nombre}</div>
                <div class="profile-id">ID: ${perfil.user_id || 'N/A'}</div>
            </div>

            <div class="data-grid">
                <!-- Datos Personales -->
                <div class="data-card">
                    <div class="data-card-title"><i class="fas fa-id-card"></i> Datos Personales</div>
                    <div class="data-row">
                        <span class="data-label">Nacionalidad</span>
                        <span class="data-value"><span class="flag-icon">${bandera}</span> ${nacionalidad}</span>
                    </div>
                    <div class="data-row">
                        <span class="data-label">Sexo</span>
                        <span class="data-value">${sexo} <i class="fas fa-lock locked-icon"></i></span>
                    </div>
                    <div class="data-row">
                        <span class="data-label">Fecha de Nacimiento</span>
                        <span class="data-value">${perfil.fecha_nacimiento ? new Date(perfil.fecha_nacimiento).toLocaleDateString('es-VE') : 'Pendiente'} <i class="fas fa-lock locked-icon"></i></span>
                    </div>
                    <div class="data-row">
                        <span class="data-label">Edad</span>
                        <span class="data-value">${edad}</span>
                    </div>
                    <div class="data-row">
                        <span class="data-label">Teléfono</span>
                        <span class="data-value">${telefono} <i class="fas fa-lock locked-icon"></i></span>
                    </div>
                </div>

                <!-- Datos Físicos -->
                <div class="data-card">
                    <div class="data-card-title"><i class="fas fa-ruler-combined"></i> Datos Físicos</div>
                    <div class="data-row">
                        <span class="data-label">Mano Hábil</span>
                        <span class="data-value">${mano} <i class="fas fa-lock locked-icon"></i></span>
                    </div>
                    <div class="data-row">
                        <span class="data-label">Peso</span>
                        <span class="data-value">${peso} <i class="fas fa-lock locked-icon"></i></span>
                    </div>
                    <div class="data-row">
                        <span class="data-label">Estatura</span>
                        <span class="data-value">${estatura} <i class="fas fa-lock locked-icon"></i></span>
                    </div>
                    <div class="data-row">
                        <span class="data-label">Longitud de Brazo</span>
                        <span class="data-value">${brazo} <i class="fas fa-lock locked-icon"></i></span>
                    </div>
                </div>

                <!-- Rendimiento y Clasificación -->
                <div class="data-card">
                    <div class="data-card-title"><i class="fas fa-trophy"></i> Rendimiento</div>
                    <div class="data-row">
                        <span class="data-label">Categoría Actual</span>
                        <span class="data-value"><span class="category-highlight">${categoria}</span> <i class="fas fa-lock locked-icon"></i></span>
                    </div>
                    <div class="data-row">
                        <span class="data-label">Partidos Jugados</span>
                        <span class="data-value">${partidos} <i class="fas fa-lock locked-icon"></i></span>
                    </div>
                    <div class="data-row">
                        <span class="data-label">Porcentaje de Aciertos</span>
                        <span class="data-value" style="color: var(--dorado);">${aciertos} <i class="fas fa-lock locked-icon"></i></span>
                    </div>
                    <div class="data-row" style="flex-direction: column; align-items: flex-start; gap: 8px;">
                        <span class="data-label">Últimos 3 Partidos</span>
                        <span class="data-value" style="font-size: 0.85rem; color: var(--gris-texto); text-align: left;">${ultimosPartidos} <i class="fas fa-lock locked-icon" style="margin-left: auto;"></i></span>
                    </div>
                </div>
            </div>

            <div style="text-align: center; margin-top: 30px; padding: 20px; background: rgba(255, 215, 0, 0.05); border: 1px dashed var(--dorado); border-radius: 12px;">
                <i class="fas fa-info-circle" style="color: var(--dorado); margin-right: 8px;"></i>
                <span style="color: var(--gris-texto); font-size: 0.9rem;">
                    Estos datos son gestionados exclusivamente por el evaluador oficial durante la prueba de clasificación. 
                    Una vez evaluado, tu categoría y estadísticas se actualizarán automáticamente.
                </span>
            </div>
        `;

    } catch (err) {
        console.error('Error:', err);
        document.getElementById('mainContent').innerHTML = `
            <div class="loading-state" style="color: var(--rojo);">
                <i class="fas fa-exclamation-triangle fa-2x"></i>
                <p style="margin-top: 15px;">Error al cargar la ficha. Por favor, intenta de nuevo.</p>
            </div>
        `;
    }
});
