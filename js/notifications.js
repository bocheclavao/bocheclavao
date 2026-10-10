// ============================================
// 🔔 SISTEMA DE NOTIFICACIONES - Boche Clava'o
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // 🎠 Inicializar carrusel infinito
    const track = document.getElementById('eventsCarouselTrack');
    if (track) {
        const slides = track.innerHTML;
        track.innerHTML = slides + slides; 
    }
    
    // 🔔 Cargar notificaciones
    cargarNotificaciones();
});

// Notificaciones de ejemplo (eventos terminados)
const notificacionesEjemplo = [
    {
        id: 1,
        tipo: 'win',
        titulo: '¡Ganaste el Torneo Regional!',
        mensaje: 'El evento "Copa Norte 2024" ha finalizado. Quedaste en 1er lugar y ganaste +50 BC.',
        tiempo: 'Hace 5 minutos',
        leida: false
    },
    {
        id: 2,
        tipo: 'lose',
        titulo: 'Evento finalizado - Desafío Semanal',
        mensaje: 'No clasificaste al Desafío Semanal. ¡Sigue practicando para la próxima!',
        tiempo: 'Hace 2 horas',
        leida: false
    },
    {
        id: 3,
        tipo: 'info',
        titulo: 'Nuevo evento disponible',
        mensaje: 'Se ha abierto la inscripción para el "Torneo Nacional 2024". ¡No te quedes fuera!',
        tiempo: 'Hace 1 día',
        leida: false
    },
    {
        id: 4,
        tipo: 'win',
        titulo: '¡Victoria en Liga de Elite!',
        mensaje: 'Ganaste contra "El Minga" López. +25 BC añadidos a tu saldo.',
        tiempo: 'Hace 2 días',
        leida: true
    },
    {
        id: 5,
        tipo: 'info',
        titulo: 'Actualización de ranking',
        mensaje: 'Tu ranking nacional subió al puesto #12. ¡Sigue así!',
        tiempo: 'Hace 3 días',
        leida: true
    },
    {
        id: 6,
        tipo: 'lose',
        titulo: 'Derrota en Copa Amistad',
        mensaje: 'Perdiste contra "El Trueno" Ramírez. Analiza tu estrategia para la próxima.',
        tiempo: 'Hace 5 días',
        leida: true
    },
    {
        id: 7,
        tipo: 'win',
        titulo: '¡Bono de bienvenida recibido!',
        mensaje: 'Has recibido 10 BC de bono por completar tu KYC. ¡A disfrutar!',
        tiempo: 'Hace 1 semana',
        leida: true
    }
];

let notificaciones = [...notificacionesEjemplo];

function cargarNotificaciones() {
    const list = document.getElementById('notificationList');
    const badge = document.getElementById('notificationBadge');
    
    // Mostrar solo las primeras 5
    const notificacionesMostrar = notificaciones.slice(0, 5);
    
    // Actualizar badge con las no leídas
    const noLeidas = notificaciones.filter(n => !n.leida).length;
    badge.textContent = noLeidas;
    if (noLeidas > 0) {
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
    
    // Renderizar lista
    if (notificacionesMostrar.length === 0) {
        list.innerHTML = `
            <div class="notification-empty">
                <i class="fas fa-bell-slash"></i>
                <p>No tienes notificaciones</p>
            </div>
        `;
        return;
    }
    
    list.innerHTML = notificacionesMostrar.map(n => `
        <div class="notification-item ${n.leida ? '' : 'unread'}" onclick="marcarLeida(${n.id})">
            <div class="notification-icon ${n.tipo}">
                <i class="fas fa-${n.tipo === 'win' ? 'trophy' : n.tipo === 'lose' ? 'times' : 'info'}"></i>
            </div>
            <div class="notification-content">
                <div class="notification-title">${n.titulo}</div>
                <div class="notification-message">${n.mensaje}</div>
                <div class="notification-time"><i class="fas fa-clock"></i> ${n.tiempo}</div>
            </div>
        </div>
    `).join('');
}

function toggleNotifications() {
    const dropdown = document.getElementById('notificationDropdown');
    const btn = document.getElementById('notificationBtn');
    dropdown.classList.toggle('show');
    btn.classList.toggle('active');
    
    // Cerrar menú de usuario si está abierto
    const userMenu = document.getElementById('dropdownMenu');
    if (userMenu) userMenu.classList.remove('show');
}

function marcarLeida(id) {
    const notif = notificaciones.find(n => n.id === id);
    if (notif) {
        notif.leida = true;
        cargarNotificaciones();
    }
}

function marcarTodasLeidas(event) {
    event.stopPropagation();
    notificaciones.forEach(n => n.leida = true);
    cargarNotificaciones();
}

function verMasNotificaciones() {
    alert('🚧 El módulo "Mis Apuestas" estará disponible próximamente. Aquí verás el historial completo de todos tus eventos y resultados.');
}

// Cerrar dropdowns al hacer clic fuera
document.addEventListener('click', function(event) {
    const notifContainer = document.querySelector('.notification-btn')?.parentElement;
    const menuContainer = document.querySelector('.user-menu-container');
    
    if (notifContainer && !notifContainer.contains(event.target)) {
        const notifDropdown = document.getElementById('notificationDropdown');
        const notifBtn = document.getElementById('notificationBtn');
        if (notifDropdown) notifDropdown.classList.remove('show');
        if (notifBtn) notifBtn.classList.remove('active');
    }
    
    if (menuContainer && !menuContainer.contains(event.target)) {
        const dropdownMenu = document.getElementById('dropdownMenu');
        const menuToggle = document.getElementById('menuToggle');
        if (dropdownMenu) dropdownMenu.classList.remove('show');
        if (menuToggle) menuToggle.classList.remove('active');
    }
});
