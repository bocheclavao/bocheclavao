// ============================================
// 🔔 SISTEMA DE NOTIFICACIONES + MENÚ MÓVIL
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // Carrusel infinito
    const track = document.getElementById('eventsCarouselTrack');
    if (track) {
        const slides = track.innerHTML;
        track.innerHTML = slides + slides; 
    }
    
    cargarNotificaciones();
    setupGlobalListeners();
});

const notificacionesEjemplo = [
    { id: 1, tipo: 'win', titulo: '¡Ganaste el Torneo Regional!', mensaje: 'El evento "Copa Norte 2024" ha finalizado. Quedaste en 1er lugar y ganaste +50 BC.', tiempo: 'Hace 5 minutos', leida: false },
    { id: 2, tipo: 'lose', titulo: 'Evento finalizado - Desafío Semanal', mensaje: 'No clasificaste al Desafío Semanal. ¡Sigue practicando para la próxima!', tiempo: 'Hace 2 horas', leida: false },
    { id: 3, tipo: 'info', titulo: 'Nuevo evento disponible', mensaje: 'Se ha abierto la inscripción para el "Torneo Nacional 2024". ¡No te quedes fuera!', tiempo: 'Hace 1 día', leida: false },
    { id: 4, tipo: 'win', titulo: '¡Victoria en Liga de Elite!', mensaje: 'Ganaste contra "El Minga" López. +25 BC añadidos a tu saldo.', tiempo: 'Hace 2 días', leida: true },
    { id: 5, tipo: 'info', titulo: 'Actualización de ranking', mensaje: 'Tu ranking nacional subió al puesto #12. ¡Sigue así!', tiempo: 'Hace 3 días', leida: true }
];

let notificaciones = [...notificacionesEjemplo];

function cargarNotificaciones() {
    const list = document.getElementById('notificationList');
    const badge = document.getElementById('notificationBadge');
    
    const mostrar = notificaciones.slice(0, 5);
    const noLeidas = notificaciones.filter(n => !n.leida).length;
    
    if (badge) {
        badge.textContent = noLeidas;
        badge.classList.toggle('hidden', noLeidas === 0);
    }
    
    if (!list) return;
    
    if (mostrar.length === 0) {
        list.innerHTML = `<div class="notification-empty"><i class="fas fa-bell-slash"></i><p>No tienes notificaciones</p></div>`;
        return;
    }
    
    list.innerHTML = mostrar.map(n => `
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

// Función centralizada para cerrar todo
function cerrarTodo() {
    const overlay = document.getElementById('mobileOverlay');
    const notif = document.getElementById('notificationDropdown');
    const user = document.getElementById('dropdownMenu');
    const btnNotif = document.getElementById('notificationBtn');
    const btnMenu = document.getElementById('menuToggle');
    
    if (overlay) overlay.classList.remove('active');
    if (notif) notif.classList.remove('show');
    if (user) user.classList.remove('show');
    if (btnNotif) btnNotif.classList.remove('active');
    if (btnMenu) btnMenu.classList.remove('active');
}

// Toggle Notificaciones
window.toggleNotifications = function(e) {
    if (e) e.stopPropagation();
    
    const notif = document.getElementById('notificationDropdown');
    const user = document.getElementById('dropdownMenu');
    const overlay = document.getElementById('mobileOverlay');
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        // Comportamiento Bottom Sheet en móvil
        const isOpen = notif.classList.contains('show');
        
        if (isOpen) {
            cerrarTodo();
        } else {
            user.classList.remove('show'); // Cerrar menú usuario si está abierto
            notif.classList.add('show');
            if (overlay) overlay.classList.add('active');
        }
    } else {
        // Dropdown normal en escritorio
        const isOpen = notif.classList.contains('show');
        
        // Cerrar menú usuario
        user.classList.remove('show');
        document.getElementById('menuToggle')?.classList.remove('active');
        
        // Toggle notificaciones
        notif.classList.toggle('show', !isOpen);
        document.getElementById('notificationBtn')?.classList.toggle('active', !isOpen);
    }
};

// Toggle Menú Usuario
window.toggleMenu = function(e) {
    if (e) e.stopPropagation();
    
    const user = document.getElementById('dropdownMenu');
    const notif = document.getElementById('notificationDropdown');
    const overlay = document.getElementById('mobileOverlay');
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        const isOpen = user.classList.contains('show');
        
        if (isOpen) {
            cerrarTodo();
        } else {
            notif.classList.remove('show'); // Cerrar notificaciones si están abiertas
            user.classList.add('show');
            if (overlay) overlay.classList.add('active');
        }
    } else {
        const isOpen = user.classList.contains('show');
        
        // Cerrar notificaciones
        notif.classList.remove('show');
        document.getElementById('notificationBtn')?.classList.remove('active');
        
        // Toggle menú usuario
        user.classList.toggle('show', !isOpen);
        document.getElementById('menuToggle')?.classList.toggle('active', !isOpen);
    }
};

// Listeners globales
function setupGlobalListeners() {
    // 1. Cerrar al tocar el overlay
    const overlay = document.getElementById('mobileOverlay');
    if (overlay) {
        overlay.addEventListener('click', cerrarTodo);
    }
    
    // 2. Cerrar al tocar fuera de los menús (solo móvil)
    document.addEventListener('click', function(e) {
        if (window.innerWidth > 768) return;
        
        const notif = document.getElementById('notificationDropdown');
        const user = document.getElementById('dropdownMenu');
        const btnNotif = document.getElementById('notificationBtn');
        const btnMenu = document.getElementById('menuToggle');
        
        const clickedInsideNotif = notif && notif.contains(e.target);
        const clickedInsideUser = user && user.contains(e.target);
        const clickedBtnNotif = btnNotif && btnNotif.contains(e.target);
        const clickedBtnMenu = btnMenu && btnMenu.contains(e.target);
        
        // Si tocó fuera de todo, cerrar
        if (!clickedInsideNotif && !clickedInsideUser && !clickedBtnNotif && !clickedBtnMenu) {
            cerrarTodo();
        }
    });
    
    // 3. Cerrar al cambiar orientación o redimensionar
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            cerrarTodo();
        }
    });
}

window.marcarLeida = function(id) {
    const n = notificaciones.find(x => x.id === id);
    if (n) { n.leida = true; cargarNotificaciones(); }
};

window.marcarTodasLeidas = function(e) {
    e.stopPropagation();
    notificaciones.forEach(n => n.leida = true);
    cargarNotificaciones();
};

window.verMasNotificaciones = function() {
    alert('🚧 El módulo "Mis Apuestas" estará disponible próximamente.');
};
