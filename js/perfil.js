document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    
    if (!db) {
        console.error('No se pudo obtener el cliente de Supabase');
        return;
    }

    const loadingState = document.getElementById('loadingState');
    const contentState = document.getElementById('contentState');
    const messageDiv = document.getElementById('message');

    let currentStream = null;
    let currentCameraType = null;
    let faceDetectionReady = false;

    // Datos de países y códigos
    const countries = [
        { code: 'AF', name: 'Afganistán', phone: '+93', flag: '🇦🇫' },
        { code: 'AL', name: 'Albania', phone: '+355', flag: '🇦🇱' },
        { code: 'DE', name: 'Alemania', phone: '+49', flag: '🇩🇪' },
        { code: 'AD', name: 'Andorra', phone: '+376', flag: '🇦🇩' },
        { code: 'AO', name: 'Angola', phone: '+244', flag: '🇦🇴' },
        { code: 'AR', name: 'Argentina', phone: '+54', flag: '🇦🇷' },
        { code: 'AM', name: 'Armenia', phone: '+374', flag: '🇦🇲' },
        { code: 'AU', name: 'Australia', phone: '+61', flag: '🇦🇺' },
        { code: 'AT', name: 'Austria', phone: '+43', flag: '🇦🇹' },
        { code: 'AZ', name: 'Azerbaiyán', phone: '+994', flag: '🇦🇿' },
        { code: 'BS', name: 'Bahamas', phone: '+1-242', flag: '🇧🇸' },
        { code: 'BD', name: 'Bangladés', phone: '+880', flag: '🇧🇩' },
        { code: 'BB', name: 'Barbados', phone: '+1-246', flag: '🇧🇧' },
        { code: 'BE', name: 'Bélgica', phone: '+32', flag: '🇧🇪' },
        { code: 'BZ', name: 'Belice', phone: '+501', flag: '🇧🇿' },
        { code: 'BJ', name: 'Benín', phone: '+229', flag: '🇧🇯' },
        { code: 'BT', name: 'Bután', phone: '+975', flag: '🇧🇹' },
        { code: 'BY', name: 'Bielorrusia', phone: '+375', flag: '🇧🇾' },
        { code: 'BO', name: 'Bolivia', phone: '+591', flag: '🇧🇴' },
        { code: 'BA', name: 'Bosnia y Herzegovina', phone: '+387', flag: '🇦' },
        { code: 'BW', name: 'Botsuana', phone: '+267', flag: '🇧🇼' },
        { code: 'BR', name: 'Brasil', phone: '+55', flag: '🇧🇷' },
        { code: 'BN', name: 'Brunéi', phone: '+673', flag: '🇧🇳' },
        { code: 'BG', name: 'Bulgaria', phone: '+359', flag: '🇧🇬' },
        { code: 'BF', name: 'Burkina Faso', phone: '+226', flag: '🇧🇫' },
        { code: 'BI', name: 'Burundi', phone: '+257', flag: '🇮' },
        { code: 'KH', name: 'Camboya', phone: '+855', flag: '🇰🇭' },
        { code: 'CM', name: 'Camerún', phone: '+237', flag: '🇨🇲' },
        { code: 'CA', name: 'Canadá', phone: '+1', flag: '🇨🇦' },
        { code: 'CV', name: 'Cabo Verde', phone: '+238', flag: '🇨🇻' },
        { code: 'CF', name: 'República Centroafricana', phone: '+236', flag: '🇨🇫' },
        { code: 'TD', name: 'Chad', phone: '+235', flag: '🇹🇩' },
        { code: 'CL', name: 'Chile', phone: '+56', flag: '🇨🇱' },
        { code: 'CN', name: 'China', phone: '+86', flag: '🇳' },
        { code: 'CO', name: 'Colombia', phone: '+57', flag: '🇨🇴' },
        { code: 'KM', name: 'Comoras', phone: '+269', flag: '🇰🇲' },
        { code: 'CG', name: 'Congo', phone: '+242', flag: '🇨🇬' },
        { code: 'CR', name: 'Costa Rica', phone: '+506', flag: '🇨🇷' },
        { code: 'CI', name: 'Costa de Marfil', phone: '+225', flag: '🇨🇮' },
        { code: 'HR', name: 'Croacia', phone: '+385', flag: '🇭🇷' },
        { code: 'CU', name: 'Cuba', phone: '+53', flag: '🇨🇺' },
        { code: 'CY', name: 'Chipre', phone: '+357', flag: '🇨🇾' },
        { code: 'CZ', name: 'República Checa', phone: '+420', flag: '🇨🇿' },
        { code: 'DK', name: 'Dinamarca', phone: '+45', flag: '🇩🇰' },
        { code: 'DJ', name: 'Yibuti', phone: '+253', flag: '🇩🇯' },
        { code: 'DM', name: 'Dominica', phone: '+1-767', flag: '🇩🇲' },
        { code: 'DO', name: 'República Dominicana', phone: '+1-809', flag: '🇩🇴' },
        { code: 'EC', name: 'Ecuador', phone: '+593', flag: '🇪🇨' },
        { code: 'EG', name: 'Egipto', phone: '+20', flag: '🇪🇬' },
        { code: 'SV', name: 'El Salvador', phone: '+503', flag: '🇸🇻' },
        { code: 'GQ', name: 'Guinea Ecuatorial', phone: '+240', flag: '🇬🇶' },
        { code: 'ER', name: 'Eritrea', phone: '+291', flag: '🇪🇷' },
        { code: 'EE', name: 'Estonia', phone: '+372', flag: '🇪🇪' },
        { code: 'ET', name: 'Etiopía', phone: '+251', flag: '🇪🇹' },
        { code: 'FJ', name: 'Fiyi', phone: '+679', flag: '🇫🇯' },
        { code: 'FI', name: 'Finlandia', phone: '+358', flag: '🇫🇮' },
        { code: 'FR', name: 'Francia', phone: '+33', flag: '🇫🇷' },
        { code: 'GA', name: 'Gabón', phone: '+241', flag: '🇦' },
        { code: 'GM', name: 'Gambia', phone: '+220', flag: '🇬🇲' },
        { code: 'GE', name: 'Georgia', phone: '+995', flag: '🇬🇪' },
        { code: 'GH', name: 'Ghana', phone: '+233', flag: '🇬🇭' },
        { code: 'GR', name: 'Grecia', phone: '+30', flag: '🇬🇷' },
        { code: 'GD', name: 'Granada', phone: '+1-473', flag: '🇬🇩' },
        { code: 'GT', name: 'Guatemala', phone: '+502', flag: '🇹' },
        { code: 'GN', name: 'Guinea', phone: '+224', flag: '🇬🇳' },
        { code: 'GW', name: 'Guinea-Bisáu', phone: '+245', flag: '🇬🇼' },
        { code: 'GY', name: 'Guyana', phone: '+592', flag: '🇬🇾' },
        { code: 'HT', name: 'Haití', phone: '+509', flag: '🇭🇹' },
        { code: 'HN', name: 'Honduras', phone: '+504', flag: '🇭' },
        { code: 'HK', name: 'Hong Kong', phone: '+852', flag: '🇭🇰' },
        { code: 'HU', name: 'Hungría', phone: '+36', flag: '🇭🇺' },
        { code: 'IS', name: 'Islandia', phone: '+354', flag: '🇮🇸' },
        { code: 'IN', name: 'India', phone: '+91', flag: '🇮🇳' },
        { code: 'ID', name: 'Indonesia', phone: '+62', flag: '🇮🇩' },
        { code: 'IR', name: 'Irán', phone: '+98', flag: '🇮🇷' },
        { code: 'IQ', name: 'Irak', phone: '+964', flag: '🇮🇶' },
        { code: 'IE', name: 'Irlanda', phone: '+353', flag: '🇪' },
        { code: 'IL', name: 'Israel', phone: '+972', flag: '🇮🇱' },
        { code: 'IT', name: 'Italia', phone: '+39', flag: '🇮🇹' },
        { code: 'JM', name: 'Jamaica', phone: '+1-876', flag: '🇯🇲' },
        { code: 'JP', name: 'Japón', phone: '+81', flag: '🇯🇵' },
        { code: 'JO', name: 'Jordania', phone: '+962', flag: '🇯🇴' },
        { code: 'KZ', name: 'Kazajistán', phone: '+7', flag: '🇰🇿' },
        { code: 'KE', name: 'Kenia', phone: '+254', flag: '🇰🇪' },
        { code: 'KI', name: 'Kiribati', phone: '+686', flag: '🇰🇮' },
        { code: 'KP', name: 'Corea del Norte', phone: '+850', flag: '🇰🇵' },
        { code: 'KR', name: 'Corea del Sur', phone: '+82', flag: '🇰🇷' },
        { code: 'KW', name: 'Kuwait', phone: '+965', flag: '🇰🇼' },
        { code: 'KG', name: 'Kirguistán', phone: '+996', flag: '🇰🇬' },
        { code: 'LA', name: 'Laos', phone: '+856', flag: '🇱🇦' },
        { code: 'LV', name: 'Letonia', phone: '+371', flag: '🇱🇻' },
        { code: 'LB', name: 'Líbano', phone: '+961', flag: '🇱🇧' },
        { code: 'LS', name: 'Lesoto', phone: '+266', flag: '🇸' },
        { code: 'LR', name: 'Liberia', phone: '+231', flag: '🇱🇷' },
        { code: 'LY', name: 'Libia', phone: '+218', flag: '🇱🇾' },
        { code: 'LI', name: 'Liechtenstein', phone: '+423', flag: '🇱🇮' },
        { code: 'LT', name: 'Lituania', phone: '+370', flag: '🇱🇹' },
        { code: 'LU', name: 'Luxemburgo', phone: '+352', flag: '🇱🇺' },
        { code: 'MO', name: 'Macao', phone: '+853', flag: '🇴' },
        { code: 'MK', name: 'Macedonia del Norte', phone: '+389', flag: '🇲🇰' },
        { code: 'MG', name: 'Madagascar', phone: '+261', flag: '🇲🇬' },
        { code: 'MW', name: 'Malaui', phone: '+265', flag: '🇲🇼' },
        { code: 'MY', name: 'Malasia', phone: '+60', flag: '🇲🇾' },
        { code: 'MV', name: 'Maldivas', phone: '+960', flag: '🇲🇻' },
        { code: 'ML', name: 'Malí', phone: '+223', flag: '🇲🇱' },
        { code: 'MT', name: 'Malta', phone: '+356', flag: '🇲🇹' },
        { code: 'MH', name: 'Islas Marshall', phone: '+692', flag: '🇭' },
        { code: 'MR', name: 'Mauritania', phone: '+222', flag: '🇷' },
        { code: 'MU', name: 'Mauricio', phone: '+230', flag: '🇲🇺' },
        { code: 'MX', name: 'México', phone: '+52', flag: '🇲🇽' },
        { code: 'FM', name: 'Micronesia', phone: '+691', flag: '🇫🇲' },
        { code: 'MD', name: 'Moldavia', phone: '+373', flag: '🇲🇩' },
        { code: 'MC', name: 'Mónaco', phone: '+377', flag: '🇲' },
        { code: 'MN', name: 'Mongolia', phone: '+976', flag: '🇳' },
        { code: 'ME', name: 'Montenegro', phone: '+382', flag: '🇪' },
        { code: 'MA', name: 'Marruecos', phone: '+212', flag: '🇲🇦' },
        { code: 'MZ', name: 'Mozambique', phone: '+258', flag: '🇲🇿' },
        { code: 'MM', name: 'Myanmar', phone: '+95', flag: '🇲🇲' },
        { code: 'NA', name: 'Namibia', phone: '+264', flag: '🇳🇦' },
        { code: 'NR', name: 'Nauru', phone: '+674', flag: '🇳🇷' },
        { code: 'NP', name: 'Nepal', phone: '+977', flag: '🇳🇵' },
        { code: 'NL', name: 'Países Bajos', phone: '+31', flag: '🇳🇱' },
        { code: 'NZ', name: 'Nueva Zelanda', phone: '+64', flag: '🇳🇿' },
        { code: 'NI', name: 'Nicaragua', phone: '+505', flag: '🇳🇮' },
        { code: 'NE', name: 'Níger', phone: '+227', flag: '🇳🇪' },
        { code: 'NG', name: 'Nigeria', phone: '+234', flag: '🇳🇬' },
        { code: 'NO', name: 'Noruega', phone: '+47', flag: '🇳🇴' },
        { code: 'OM', name: 'Omán', phone: '+968', flag: '🇴' },
        { code: 'PK', name: 'Pakistán', phone: '+92', flag: '🇵🇰' },
        { code: 'PW', name: 'Palaos', phone: '+680', flag: '🇵🇼' },
        { code: 'PA', name: 'Panamá', phone: '+507', flag: '🇵🇦' },
        { code: 'PG', name: 'Papúa Nueva Guinea', phone: '+675', flag: '🇵🇬' },
        { code: 'PY', name: 'Paraguay', phone: '+595', flag: '🇵🇾' },
        { code: 'PE', name: 'Perú', phone: '+51', flag: '🇵🇪' },
        { code: 'PH', name: 'Filipinas', phone: '+63', flag: '🇵🇭' },
        { code: 'PL', name: 'Polonia', phone: '+48', flag: '🇵🇱' },
        { code: 'PT', name: 'Portugal', phone: '+351', flag: '🇵🇹' },
        { code: 'QA', name: 'Catar', phone: '+974', flag: '🇶🇦' },
        { code: 'RO', name: 'Rumania', phone: '+40', flag: '🇷🇴' },
        { code: 'RU', name: 'Rusia', phone: '+7', flag: '🇷🇺' },
        { code: 'RW', name: 'Ruanda', phone: '+250', flag: '🇷🇼' },
        { code: 'KN', name: 'San Cristóbal y Nieves', phone: '+1-869', flag: '🇰🇳' },
        { code: 'LC', name: 'Santa Lucía', phone: '+1-758', flag: '🇱' },
        { code: 'VC', name: 'San Vicente y las Granadinas', phone: '+1-784', flag: '🇻🇨' },
        { code: 'WS', name: 'Samoa', phone: '+685', flag: '🇼🇸' },
        { code: 'SM', name: 'San Marino', phone: '+378', flag: '🇸🇲' },
        { code: 'ST', name: 'Santo Tomé y Príncipe', phone: '+239', flag: '🇸🇹' },
        { code: 'SA', name: 'Arabia Saudita', phone: '+966', flag: '🇸🇦' },
        { code: 'SN', name: 'Senegal', phone: '+221', flag: '🇸🇳' },
        { code: 'RS', name: 'Serbia', phone: '+381', flag: '🇷🇸' },
        { code: 'SC', name: 'Seychelles', phone: '+248', flag: '🇸🇨' },
        { code: 'SL', name: 'Sierra Leona', phone: '+232', flag: '🇸🇱' },
        { code: 'SG', name: 'Singapur', phone: '+65', flag: '🇸🇬' },
        { code: 'SK', name: 'Eslovaquia', phone: '+421', flag: '🇸🇰' },
        { code: 'SI', name: 'Eslovenia', phone: '+386', flag: '🇸' },
        { code: 'SB', name: 'Islas Salomón', phone: '+677', flag: '🇧' },
        { code: 'SO', name: 'Somalia', phone: '+252', flag: '🇴' },
        { code: 'ZA', name: 'Sudáfrica', phone: '+27', flag: '🇿🇦' },
        { code: 'SS', name: 'Sudán del Sur', phone: '+211', flag: '🇸🇸' },
        { code: 'ES', name: 'España', phone: '+34', flag: '🇪🇸' },
        { code: 'LK', name: 'Sri Lanka', phone: '+94', flag: '🇱🇰' },
        { code: 'SD', name: 'Sudán', phone: '+249', flag: '🇸🇩' },
        { code: 'SR', name: 'Surinam', phone: '+597', flag: '🇸🇷' },
        { code: 'SZ', name: 'Esuatini', phone: '+268', flag: '🇸🇿' },
        { code: 'SE', name: 'Suecia', phone: '+46', flag: '🇸🇪' },
        { code: 'CH', name: 'Suiza', phone: '+41', flag: '🇨🇭' },
        { code: 'SY', name: 'Siria', phone: '+963', flag: '🇸🇾' },
        { code: 'TW', name: 'Taiwán', phone: '+886', flag: '🇹🇼' },
        { code: 'TJ', name: 'Tayikistán', phone: '+992', flag: '🇹🇯' },
        { code: 'TZ', name: 'Tanzania', phone: '+255', flag: '🇹🇿' },
        { code: 'TH', name: 'Tailandia', phone: '+66', flag: '🇭' },
        { code: 'TL', name: 'Timor Oriental', phone: '+670', flag: '🇹🇱' },
        { code: 'TG', name: 'Togo', phone: '+228', flag: '🇹🇬' },
        { code: 'TO', name: 'Tonga', phone: '+676', flag: '🇹🇴' },
        { code: 'TT', name: 'Trinidad y Tobago', phone: '+1-868', flag: '🇹' },
        { code: 'TN', name: 'Túnez', phone: '+216', flag: '🇹🇳' },
        { code: 'TR', name: 'Turquía', phone: '+90', flag: '🇹🇷' },
        { code: 'TM', name: 'Turkmenistán', phone: '+993', flag: '🇹🇲' },
        { code: 'TV', name: 'Tuvalu', phone: '+688', flag: '🇹🇻' },
        { code: 'UG', name: 'Uganda', phone: '+256', flag: '🇺🇬' },
        { code: 'UA', name: 'Ucrania', phone: '+380', flag: '🇺🇦' },
        { code: 'AE', name: 'Emiratos Árabes Unidos', phone: '+971', flag: '🇦🇪' },
        { code: 'GB', name: 'Reino Unido', phone: '+44', flag: '🇬🇧' },
        { code: 'US', name: 'Estados Unidos', phone: '+1', flag: '🇺🇸' },
        { code: 'UY', name: 'Uruguay', phone: '+598', flag: '🇺🇾' },
        { code: 'UZ', name: 'Uzbekistán', phone: '+998', flag: '🇺🇿' },
        { code: 'VU', name: 'Vanuatu', phone: '+678', flag: '🇻🇺' },
        { code: 'VA', name: 'Ciudad del Vaticano', phone: '+379', flag: '🇻🇦' },
        { code: 'VE', name: 'Venezuela', phone: '+58', flag: '🇻🇪' },
        { code: 'VN', name: 'Vietnam', phone: '+84', flag: '🇻🇳' },
        { code: 'YE', name: 'Yemen', phone: '+967', flag: '🇾🇪' },
        { code: 'ZM', name: 'Zambia', phone: '+260', flag: '🇿🇲' },
        { code: 'ZW', name: 'Zimbabue', phone: '+263', flag: '🇿🇼' }
    ];

    function showMessage(text, type) {
        if (messageDiv) {
            messageDiv.textContent = text;
            messageDiv.className = 'message ' + type;
        }
    }

    // Llenar selectores de países
    function llenarSelectoresPaises() {
        const phoneSelect = document.getElementById('phoneCountry');
        const nationalitySelect = document.getElementById('nacionalidad');
        const countrySelect = document.getElementById('pais');

        countries.forEach(country => {
            // Teléfono
            const phoneOption = document.createElement('option');
            phoneOption.value = country.phone;
            phoneOption.textContent = `${country.flag} ${country.phone}`;
            phoneSelect.appendChild(phoneOption);

            // Nacionalidad
            const natOption = document.createElement('option');
            natOption.value = country.name;
            natOption.textContent = `${country.flag} ${country.name}`;
            nationalitySelect.appendChild(natOption);

            // País
            const countryOption = document.createElement('option');
            countryOption.value = country.name;
            countryOption.textContent = `${country.flag} ${country.name}`;
            countrySelect.appendChild(countryOption);
        });
    }

    async function cargarPerfil() {
        try {
            const { data: { user } } = await db.auth.getUser();
            
            if (!user) {
                window.location.href = 'login.html';
                return;
            }

            const { data: perfil, error } = await db
                .from('perfiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) {
                console.error('Error al cargar perfil:', error);
                return;
            }

            // Mostrar datos
            document.getElementById('profileName').textContent = perfil.nombre || 'Usuario';
            document.getElementById('profileId').textContent = `ID: ${perfil.user_id}`;
            document.getElementById('profileEmail').textContent = perfil.email;
            
            const avatarInitial = document.getElementById('avatarInitial');
            const avatarImage = document.getElementById('avatarImage');
            
            if (perfil.avatar_url) {
                avatarImage.src = perfil.avatar_url;
                avatarImage.style.display = 'block';
                avatarInitial.style.display = 'none';
            } else {
                avatarInitial.textContent = (perfil.nombre || 'U').charAt(0).toUpperCase();
                avatarInitial.style.display = 'flex';
                avatarImage.style.display = 'none';
            }

            // Estado KYC
            const kycStatus = document.getElementById('kycStatus');
            if (perfil.estado_kyc === 'verificado') {
                kycStatus.className = 'kyc-status verified';
                kycStatus.innerHTML = '<i class="fas fa-check-circle"></i> KYC Verificado';
            } else if (perfil.estado_kyc === 'rechazado') {
                kycStatus.className = 'kyc-status rejected';
                kycStatus.innerHTML = '<i class="fas fa-times-circle"></i> KYC Rechazado';
            } else {
                kycStatus.className = 'kyc-status pending';
                kycStatus.innerHTML = '<i class="fas fa-clock"></i> KYC Pendiente';
            }

            // Llenar formulario
            document.getElementById('nombre').value = perfil.nombre || '';
            document.getElementById('telefono').value = perfil.telefono || '';
            document.getElementById('fechaNacimiento').value = perfil.fecha_nacimiento || '';
            document.getElementById('nacionalidad').value = perfil.nacionalidad || '';
            document.getElementById('tipoDocumento').value = perfil.tipo_documento || '';
            document.getElementById('numeroDocumento').value = perfil.numero_documento || '';
            document.getElementById('direccion').value = perfil.direccion || '';
            document.getElementById('ciudad').value = perfil.ciudad || '';
            document.getElementById('pais').value = perfil.pais || '';
            document.getElementById('codigoPostal').value = perfil.codigo_postal || '';

            loadingState.style.display = 'none';
            contentState.style.display = 'block';

        } catch (err) {
            console.error('Error:', err);
        }
    }

    // Cámara y captura
    window.openCamera = async function(type) {
        currentCameraType = type;
        const modal = document.getElementById('cameraModal');
        const video = document.getElementById('modalVideo');
        const title = document.getElementById('modalTitle');

        const titles = {
            'docFront': 'Foto del documento (Frente)',
            'docBack': 'Foto del documento (Reverso)',
            'selfie': 'Selfie con detección facial'
        };

        title.textContent = titles[type] || 'Cámara';

        try {
            currentStream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: type === 'selfie' ? 'user' : 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            
            video.srcObject = currentStream;
            modal.classList.add('show');

            if (type === 'selfie') {
                await initFaceDetection();
            }

        } catch (err) {
            console.error('Error al abrir cámara:', err);
            showMessage('No se pudo acceder a la cámara. Verifica los permisos.', 'error');
        }
    };

    window.closeCamera = function() {
        const modal = document.getElementById('cameraModal');
        const video = document.getElementById('modalVideo');
        
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
        }
        
        video.srcObject = null;
        modal.classList.remove('show');
    };

    window.captureFromModal = async function() {
        const video = document.getElementById('modalVideo');
        const canvas = document.getElementById('modalCanvas');
        const ctx = canvas.getContext('2d');

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        const imageData = canvas.toDataURL('image/jpeg', 0.8);

        // Guardar en el campo correspondiente
        const fieldMap = {
            'docFront': { url: 'docFrontalUrl', preview: 'docFrontPreview', btn: 'btnDocFront' },
            'docBack': { url: 'docTraseroUrl', preview: 'docBackPreview', btn: 'btnDocBack' },
            'selfie': { url: 'selfieUrl', preview: 'selfiePreview', btn: 'btnSelfie' }
        };

        const field = fieldMap[currentCameraType];
        if (field) {
            document.getElementById(field.url).value = imageData;
            
            const preview = document.getElementById(field.preview);
            preview.innerHTML = `<img src="${imageData}" alt="Captura">`;
            
            document.getElementById(field.btn).disabled = false;
        }

        closeCamera();
    };

    // Detección facial con Face-API
    async function initFaceDetection() {
        const statusDiv = document.getElementById('faceDetectionStatus');
        statusDiv.className = 'face-detection-status detecting';
        statusDiv.textContent = '⏳ Cargando modelos de IA...';

        try {
            await faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights');
            await faceapi.nets.faceLandmark68Net.loadFromUri('https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights');
            
            faceDetectionReady = true;
            statusDiv.className = 'face-detection-status success';
            statusDiv.textContent = '✅ IA lista. Acerca tu rostro a la cámara.';
            
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 3000);
            
        } catch (err) {
            console.error('Error cargando Face-API:', err);
            statusDiv.className = 'face-detection-status error';
            statusDiv.textContent = '⚠️ No se pudo cargar la IA. Puedes continuar sin detección facial.';
        }
    }

    async function detectFaceInVideo() {
        if (!faceDetectionReady) return false;

        const video = document.getElementById('modalVideo');
        const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions());
        
        return detection !== null;
    }

    window.takePhoto = async function(type) {
        const video = document.getElementById('modalVideo');
        const canvas = document.getElementById('modalCanvas');
        const ctx = canvas.getContext('2d');

        if (type === 'selfie' && faceDetectionReady) {
            const hasFace = await detectFaceInVideo();
            if (!hasFace) {
                showMessage('⚠️ No se detectó un rostro. Por favor, asegúrate de que tu cara sea visible.', 'error');
                return;
            }
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        const imageData = canvas.toDataURL('image/jpeg', 0.8);

        const fieldMap = {
            'docFront': { url: 'docFrontalUrl', preview: 'docFrontPreview', btn: 'btnDocFront' },
            'docBack': { url: 'docTraseroUrl', preview: 'docBackPreview', btn: 'btnDocBack' },
            'selfie': { url: 'selfieUrl', preview: 'selfiePreview', btn: 'btnSelfie' }
        };

        const field = fieldMap[type];
        if (field) {
            document.getElementById(field.url).value = imageData;
            
            const preview = document.getElementById(field.preview);
            preview.innerHTML = `<img src="${imageData}" alt="Captura">`;
            
            document.getElementById(field.btn).disabled = false;
        }

        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
        }
    };

    // Guardar información personal
    const personalForm = document.getElementById('personalForm');
    if (personalForm) {
        personalForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const { data: { user } } = await db.auth.getUser();
            
            const phoneCountry = document.getElementById('phoneCountry').value;
            const telefono = document.getElementById('telefono').value;
            
            const datos = {
                nombre: document.getElementById('nombre').value,
                telefono: phoneCountry + ' ' + telefono,
                fecha_nacimiento: document.getElementById('fechaNacimiento').value,
                nacionalidad: document.getElementById('nacionalidad').value,
                ultima_actualizacion: new Date().toISOString()
            };

            showMessage('Guardando información...', 'info');

            const { error } = await db
                .from('perfiles')
                .update(datos)
                .eq('id', user.id);

            if (error) {
                showMessage('Error al guardar: ' + error.message, 'error');
            } else {
                showMessage('Información guardada exitosamente', 'success');
                document.getElementById('profileName').textContent = datos.nombre;
            }
        });
    }

    // Guardar dirección
    const addressForm = document.getElementById('addressForm');
    if (addressForm) {
        addressForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const { data: { user } } = await db.auth.getUser();
            
            const datos = {
                direccion: document.getElementById('direccion').value,
                ciudad: document.getElementById('ciudad').value,
                pais: document.getElementById('pais').value,
                codigo_postal: document.getElementById('codigoPostal').value,
                ultima_actualizacion: new Date().toISOString()
            };

            showMessage('Guardando dirección...', 'info');

            const { error } = await db
                .from('perfiles')
                .update(datos)
                .eq('id', user.id);

            if (error) {
                showMessage('Error al guardar: ' + error.message, 'error');
            } else {
                showMessage('Dirección guardada exitosamente', 'success');
            }
        });
    }

    // Enviar documentos KYC
    const kycForm = document.getElementById('kycForm');
    if (kycForm) {
        kycForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const { data: { user } } = await db.auth.getUser();
            
            const docFrontal = document.getElementById('docFrontalUrl').value;
            const docTrasero = document.getElementById('docTraseroUrl').value;
            const selfie = document.getElementById('selfieUrl').value;

            if (!docFrontal) {
                showMessage('Por favor, toma una foto del frente de tu documento.', 'error');
                return;
            }

            if (!selfie) {
                showMessage('Por favor, toma una selfie con detección facial.', 'error');
                return;
            }

            const datos = {
                tipo_documento: document.getElementById('tipoDocumento').value,
                numero_documento: document.getElementById('numeroDocumento').value,
                direccion: document.getElementById('direccion').value,
                ciudad: document.getElementById('ciudad').value,
                pais: document.getElementById('pais').value,
                codigo_postal: document.getElementById('codigoPostal').value,
                documento_frontal_url: docFrontal,
                documento_trasero_url: docTrasero || null,
                selfie_url: selfie,
                estado_kyc: 'pendiente',
                ultima_actualizacion: new Date().toISOString()
            };

            showMessage('📤 Enviando documentos para verificación...', 'info');

            const { error } = await db
                .from('perfiles')
                .update(datos)
                .eq('id', user.id);

            if (error) {
                showMessage('Error al enviar: ' + error.message, 'error');
            } else {
                showMessage('✅ Documentos enviados. Tu verificación será revisada pronto. Recibirás una notificación cuando esté lista.', 'success');
                setTimeout(() => {
                    window.location.reload();
                }, 3000);
            }
        });
    }

    // Inicializar
    llenarSelectoresPaises();
    cargarPerfil();
});
