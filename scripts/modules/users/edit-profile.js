import { httpClient } from '../../core/http.js';
import { getAuthenticatedUserId } from '../../core/auth.js';

const REDIRECT_DELAY_MS = 1200;

const elements = {
    loading: document.getElementById('edit-profile-loading'),
    content: document.getElementById('edit-profile-content'),
    messageBox: document.getElementById('edit-profile-message'),
    messageText: document.getElementById('edit-profile-message-text'),
    form: document.getElementById('edit-profile-form'),
    avatarPreview: document.getElementById('edit-avatar-preview'),
    nameInput: document.getElementById('profile-name'),
    biographyInput: document.getElementById('profile-biography'),
    profileImageInput: document.getElementById('profile-image'),
    saveButton: document.getElementById('save-profile-btn'),
    saveSpinner: document.getElementById('save-profile-spinner'),
    saveLabel: document.getElementById('save-profile-label')
};

let authenticatedUserId = null;
let isSubmitting = false;

function showLoading() {
    if (elements.loading) elements.loading.hidden = false;
    if (elements.content) elements.content.hidden = true;
    hideMessage();
}

function showContent() {
    if (elements.loading) elements.loading.hidden = true;
    if (elements.content) elements.content.hidden = false;
}

function hideMessage() {
    if (!elements.messageBox || !elements.messageText) return;
    elements.messageBox.hidden = true;
    elements.messageText.textContent = '';
    elements.messageBox.classList.remove('alert-success', 'alert-warning', 'alert-error');
}

function showMessage(message, type = 'error') {
    if (!elements.messageBox || !elements.messageText) return;

    elements.messageBox.classList.remove('alert-success', 'alert-warning', 'alert-error');

    if (type === 'success') {
        elements.messageBox.classList.add('alert-success');
        elements.messageBox.setAttribute('role', 'status');
        elements.messageBox.setAttribute('aria-live', 'polite');
    } else if (type === 'warning') {
        elements.messageBox.classList.add('alert-warning');
        elements.messageBox.setAttribute('role', 'alert');
        elements.messageBox.setAttribute('aria-live', 'assertive');
    } else {
        elements.messageBox.classList.add('alert-error');
        elements.messageBox.setAttribute('role', 'alert');
        elements.messageBox.setAttribute('aria-live', 'assertive');
    }

    elements.messageText.textContent = message;
    elements.messageBox.hidden = false;
}

function setSubmittingState(submitting) {
    isSubmitting = submitting;

    if (elements.saveButton) {
        elements.saveButton.disabled = submitting;
        elements.saveButton.classList.toggle('is-loading', submitting);
    }

    if (elements.saveSpinner) {
        elements.saveSpinner.hidden = !submitting;
    }

    if (elements.saveLabel) {
        elements.saveLabel.textContent = submitting ? 'Salvando...' : 'Salvar alterações';
    }
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
    placeholder.id = 'edit-avatar-placeholder';
    placeholder.className = 'user-avatar-placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    placeholder.textContent = getInitials(name);
    return placeholder;
}

function renderAvatarPreview(profileImage, name) {
    if (!elements.avatarPreview) return;

    elements.avatarPreview.replaceChildren();

    if (!isValidImageSource(profileImage)) {
        elements.avatarPreview.appendChild(createAvatarPlaceholder(name));
        return;
    }

    const img = document.createElement('img');
    img.className = 'user-avatar-img';
    img.src = profileImage.trim();
    img.alt = name ? `Pré-visualização da foto de ${name}` : 'Pré-visualização da foto de perfil';

    img.addEventListener('error', () => {
        elements.avatarPreview.replaceChildren(createAvatarPlaceholder(name));
    });

    elements.avatarPreview.appendChild(img);
}

function populateForm(user) {
    const name = typeof user.name === 'string' ? user.name : '';
    const biography = typeof user.biography === 'string' ? user.biography : '';
    const profileImage = typeof user.profileImage === 'string' ? user.profileImage : '';

    if (elements.nameInput) {
        elements.nameInput.value = name;
    }

    if (elements.biographyInput) {
        elements.biographyInput.value = biography;
    }

    if (elements.profileImageInput) {
        elements.profileImageInput.value = profileImage;
    }

    renderAvatarPreview(profileImage, name);
}

async function loadCurrentProfile() {
    showLoading();

    const userId = getAuthenticatedUserId();

    if (userId === null || userId === undefined || String(userId).trim() === '') {
        if (elements.loading) elements.loading.hidden = true;
        showMessage(
            'Configuração pendente: não foi possível identificar o usuário autenticado. Faça login novamente ou verifique a configuração de sessão.',
            'warning'
        );
        return;
    }

    authenticatedUserId = String(userId).trim();

    try {
        const encodedId = encodeURIComponent(authenticatedUserId);
        const user = await httpClient.get(`/api/users/${encodedId}`);

        if (!user || typeof user !== 'object') {
            throw new Error('Resposta inválida ao carregar os dados do perfil.');
        }

        populateForm(user);
        showContent();
    } catch (error) {
        if (elements.loading) elements.loading.hidden = true;
        const message = error instanceof Error && error.message
            ? error.message
            : 'Não foi possível carregar os dados atuais do perfil. Tente novamente mais tarde.';
        showMessage(message, 'error');
    }
}

async function handleSubmit(event) {
    event.preventDefault();

    if (isSubmitting) {
        return;
    }

    hideMessage();

    if (!authenticatedUserId) {
        showMessage(
            'Sessão inválida: não foi possível identificar o usuário autenticado.',
            'warning'
        );
        return;
    }

    const name = elements.nameInput ? elements.nameInput.value.trim() : '';
    const rawBiography = elements.biographyInput ? elements.biographyInput.value.trim() : '';
    const rawProfileImage = elements.profileImageInput ? elements.profileImageInput.value.trim() : '';

    if (!name) {
        showMessage('O campo Nome é obrigatório.', 'error');
        if (elements.nameInput) elements.nameInput.focus();
        return;
    }

    if (name.length < 2) {
        showMessage('O nome deve ter pelo menos 2 caracteres.', 'error');
        if (elements.nameInput) elements.nameInput.focus();
        return;
    }

    if (rawProfileImage && !isValidImageSource(rawProfileImage)) {
        showMessage('O endereço da imagem de perfil informado não é válido.', 'error');
        if (elements.profileImageInput) elements.profileImageInput.focus();
        return;
    }

    const payload = {
        name,
        biography: rawBiography || null,
        profileImage: rawProfileImage || null
    };

    setSubmittingState(true);

    try {
        const encodedId = encodeURIComponent(authenticatedUserId);
        await httpClient.patch(`/api/users/${encodedId}`, payload);

        showMessage('Perfil atualizado com sucesso! Redirecionando para o perfil...', 'success');

        window.setTimeout(() => {
            window.location.href = '../profile/index.html';
        }, REDIRECT_DELAY_MS);
    } catch (error) {
        const message = error instanceof Error && error.message
            ? error.message
            : 'Não foi possível salvar as alterações do perfil. Tente novamente.';
        showMessage(message, 'error');
        setSubmittingState(false);
    }
}

function bindEvents() {
    if (elements.form) {
        elements.form.addEventListener('submit', handleSubmit);
    }

    const updatePreview = () => {
        const name = elements.nameInput ? elements.nameInput.value : '';
        const profileImage = elements.profileImageInput ? elements.profileImageInput.value : '';
        renderAvatarPreview(profileImage, name);
    };

    if (elements.profileImageInput) {
        elements.profileImageInput.addEventListener('input', updatePreview);
    }

    if (elements.nameInput) {
        elements.nameInput.addEventListener('input', updatePreview);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    loadCurrentProfile();
});