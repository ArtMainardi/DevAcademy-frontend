import { httpClient } from '../../core/http.js';
import { getAuthenticatedUserId } from '../../core/auth.js';

const elements = {
    loading: document.getElementById('profile-loading'),
    errorBox: document.getElementById('profile-error'),
    errorMessage: document.getElementById('profile-error-message'),
    content: document.getElementById('profile-content'),
    avatarContainer: document.querySelector('.user-avatar'),
    name: document.getElementById('user-name'),
    statusBadge: document.getElementById('user-status-badge'),
    email: document.getElementById('user-email'),
    biography: document.getElementById('user-biography'),
    createdAt: document.getElementById('user-created-at'),
    updatedAt: document.getElementById('user-updated-at')
};

function showLoading() {
    if (elements.loading) elements.loading.hidden = false;
    if (elements.content) elements.content.hidden = true;
    if (elements.errorBox) elements.errorBox.hidden = true;
}

function showMessage(message, type = 'error') {
    if (elements.loading) elements.loading.hidden = true;
    if (elements.content) elements.content.hidden = true;

    if (!elements.errorBox || !elements.errorMessage) return;

    elements.errorBox.classList.remove('alert-error', 'alert-warning', 'alert-success');
    elements.errorBox.classList.add(type === 'warning' ? 'alert-warning' : 'alert-error');
    elements.errorMessage.textContent = message;
    elements.errorBox.hidden = false;
}

function showContent() {
    if (elements.loading) elements.loading.hidden = true;
    if (elements.errorBox) elements.errorBox.hidden = true;
    if (elements.content) elements.content.hidden = false;
}

function formatDatePtBR(dateValue) {
    if (!dateValue) return 'Não informado';

    const parsedDate = new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) {
        return 'Não informado';
    }

    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'long',
        timeStyle: 'short'
    }).format(parsedDate);
}

function getInitials(name) {
    if (typeof name !== 'string' || !name.trim()) {
        return 'U';
    }

    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function isValidImageSource(src) {
    if (typeof src !== 'string') return false;
    const trimmed = src.trim();
    if (!trimmed) return false;

    const lower = trimmed.toLowerCase();
    if (lower.startsWith('javascript:') || lower.startsWith('data:')) {
        return false;
    }

    return true;
}

function createAvatarPlaceholder(name) {
    const placeholder = document.createElement('span');
    placeholder.id = 'user-avatar-placeholder';
    placeholder.className = 'user-avatar-placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    placeholder.textContent = getInitials(name);
    return placeholder;
}

function renderAvatar(profileImage, name) {
    if (!elements.avatarContainer) return;

    elements.avatarContainer.replaceChildren();

    if (!isValidImageSource(profileImage)) {
        elements.avatarContainer.appendChild(createAvatarPlaceholder(name));
        return;
    }

    const img = document.createElement('img');
    img.id = 'user-avatar-img';
    img.className = 'user-avatar-img';
    img.src = profileImage.trim();
    img.alt = name ? `Foto de perfil de ${name}` : 'Foto de perfil do usuário';

    img.addEventListener('error', () => {
        elements.avatarContainer.replaceChildren(createAvatarPlaceholder(name));
    });

    elements.avatarContainer.appendChild(img);
}

function renderStatusBadge(active) {
    if (!elements.statusBadge) return;

    if (typeof active !== 'boolean') {
        elements.statusBadge.hidden = true;
        return;
    }

    elements.statusBadge.classList.remove(
        'user-status-badge--active',
        'user-status-badge--inactive'
    );

    if (active) {
        elements.statusBadge.classList.add('user-status-badge--active');
        elements.statusBadge.textContent = 'Conta ativa';
    } else {
        elements.statusBadge.classList.add('user-status-badge--inactive');
        elements.statusBadge.textContent = 'Conta inativa';
    }

    elements.statusBadge.hidden = false;
}

function renderProfile(user) {
    const safeName = typeof user.name === 'string' && user.name.trim()
        ? user.name.trim()
        : 'Usuário sem nome';

    const safeEmail = typeof user.email === 'string' && user.email.trim()
        ? user.email.trim()
        : 'E-mail não informado';

    const hasBiography = typeof user.biography === 'string' && user.biography.trim().length > 0;

    renderAvatar(user.profileImage, safeName);
    renderStatusBadge(user.active);

    if (elements.name) {
        elements.name.textContent = safeName;
    }

    if (elements.email) {
        elements.email.textContent = safeEmail;
    }

    if (elements.biography) {
        elements.biography.textContent = hasBiography
            ? user.biography.trim()
            : 'Nenhuma biografia cadastrada.';
        elements.biography.classList.toggle('user-bio-text--empty', !hasBiography);
    }

    if (elements.createdAt) {
        elements.createdAt.textContent = formatDatePtBR(user.createdAt);
    }

    if (elements.updatedAt) {
        elements.updatedAt.textContent = formatDatePtBR(user.updatedAt);
    }

    showContent();
}

async function loadUserProfile() {
    showLoading();

    const userId = getAuthenticatedUserId();

    if (userId === null || userId === undefined || String(userId).trim() === '') {
        showMessage(
            'Configuração pendente: não foi possível identificar o usuário autenticado. Faça login novamente ou verifique a configuração de sessão.',
            'warning'
        );
        return;
    }

    try {
        const encodedId = encodeURIComponent(String(userId).trim());
        const user = await httpClient.get(`/api/users/${encodedId}`);

        if (!user || typeof user !== 'object') {
            throw new Error('Resposta inválida ao carregar o perfil.');
        }

        renderProfile(user);
    } catch (error) {
        const message = error instanceof Error && error.message
            ? error.message
            : 'Não foi possível carregar os dados do perfil. Tente novamente mais tarde.';

        showMessage(message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', loadUserProfile);
