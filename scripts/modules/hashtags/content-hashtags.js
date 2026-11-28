import { httpClient } from '../../core/http.js';
import { getAuthenticatedUserId } from '../../core/auth.js';

const elements = {
    section: document.getElementById('content-hashtags-section'),
    form: document.getElementById('content-hashtags-form'),
    input: document.getElementById('content-hashtag-input'),
    submitButton: document.getElementById('content-hashtag-submit'),
    messageBox: document.getElementById('content-hashtags-message'),
    messageText: document.getElementById('content-hashtags-message-text'),
    loading: document.getElementById('content-hashtags-loading'),
    empty: document.getElementById('content-hashtags-empty'),
    list: document.getElementById('content-hashtags-list')
};

let currentContentId = null;
let currentHashtags = [];
let isAdding = false;
const removingHashtagIds = new Set();

function getContentIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('contentId') || params.get('id');
    return id && id.trim() ? id.trim() : null;
}

function getTrustedUserId() {
    const userId = getAuthenticatedUserId();
    if (userId === null || userId === undefined || String(userId).trim() === '') {
        return null;
    }
    return String(userId).trim();
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

function showLoading() {
    if (elements.loading) elements.loading.hidden = false;
    if (elements.empty) elements.empty.hidden = true;
    if (elements.list) elements.list.hidden = true;
}

function showEmpty() {
    if (elements.loading) elements.loading.hidden = true;
    if (elements.empty) elements.empty.hidden = false;
    if (elements.list) elements.list.hidden = true;
}

function showList() {
    if (elements.loading) elements.loading.hidden = true;
    if (elements.empty) elements.empty.hidden = true;
    if (elements.list) elements.list.hidden = false;
}

function setFormDisabled(disabled) {
    if (elements.input) {
        elements.input.disabled = disabled;
    }
    if (elements.submitButton) {
        elements.submitButton.disabled = disabled;
    }
}

function setAddingState(submitting) {
    isAdding = submitting;
    if (elements.submitButton) {
        elements.submitButton.disabled = submitting;
    }
    if (elements.input) {
        elements.input.disabled = submitting;
    }
}

function extractHashtagsFromContent(content) {
    if (!content || typeof content !== 'object') {
        return [];
    }
    return Array.isArray(content.hashtags) ? content.hashtags : [];
}

function createRemovableHashtagItem(hashtag) {
    const item = document.createElement('li');
    item.className = 'hashtag-list-item';

    const tag = document.createElement('span');
    tag.className = 'hashtag-tag hashtag-tag--removable';

    const hashtagId =
        hashtag?.id !== null && hashtag?.id !== undefined ? String(hashtag.id) : '';
    const hashtagName = typeof hashtag?.name === 'string' ? hashtag.name : '';

    if (hashtagId) {
        tag.dataset.hashtagId = hashtagId;
    }

    const label = document.createElement('span');
    label.className = 'hashtag-tag-label';
    label.textContent = hashtagName;

    tag.appendChild(label);

    if (hashtagId) {
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'hashtag-remove-btn';
        removeButton.setAttribute(
            'aria-label',
            hashtagName ? `Remover hashtag ${hashtagName}` : 'Remover hashtag'
        );
        removeButton.textContent = '×';
        removeButton.disabled = removingHashtagIds.has(hashtagId);

        removeButton.addEventListener('click', () => {
            handleRemoveHashtag(hashtagId, hashtagName, removeButton);
        });

        tag.appendChild(removeButton);
    }

    item.appendChild(tag);
    return item;
}

function renderHashtags(hashtags) {
    currentHashtags = Array.isArray(hashtags) ? hashtags : [];

    if (!elements.list) return;

    elements.list.replaceChildren();

    if (currentHashtags.length === 0) {
        showEmpty();
        return;
    }

    const fragment = document.createDocumentFragment();

    for (const hashtag of currentHashtags) {
        fragment.appendChild(createRemovableHashtagItem(hashtag));
    }

    elements.list.appendChild(fragment);
    showList();
}

export async function loadContentHashtags() {
    if (!currentContentId) {
        if (elements.loading) elements.loading.hidden = true;
        setFormDisabled(true);
        showMessage('Conteúdo não identificado na URL.', 'error');
        return;
    }

    showLoading();

    try {
        const encodedContentId = encodeURIComponent(currentContentId);
        const content = await httpClient.get(`/api/contents/${encodedContentId}`);

        if (!content || typeof content !== 'object') {
            throw new Error('Resposta inválida ao carregar as hashtags do conteúdo.');
        }

        const hashtags = extractHashtagsFromContent(content);
        renderHashtags(hashtags);
    } catch (error) {
        if (elements.loading) elements.loading.hidden = true;
        if (elements.empty) elements.empty.hidden = true;
        if (elements.list) elements.list.hidden = true;

        const message =
            error instanceof Error && error.message
                ? error.message
                : 'Não foi possível carregar as hashtags do conteúdo.';
        showMessage(message, 'error');
    }
}

async function handleAddHashtag(event) {
    event.preventDefault();

    if (isAdding) {
        return;
    }

    hideMessage();

    if (!currentContentId) {
        showMessage('Conteúdo não identificado na URL.', 'error');
        return;
    }

    const tag = elements.input ? elements.input.value.trim() : '';

    if (!tag) {
        showMessage('Informe o nome da hashtag para associar ao conteúdo.', 'error');
        if (elements.input) elements.input.focus();
        return;
    }

    const userId = getTrustedUserId();

    if (!userId) {
        showMessage(
            'Não foi possível identificar o usuário autenticado. Faça login novamente para associar hashtags.',
            'warning'
        );
        return;
    }

    setAddingState(true);

    try {
        const encodedContentId = encodeURIComponent(currentContentId);
        const params = new URLSearchParams({ tag });

        const response = await httpClient.post(
            `/api/contents/${encodedContentId}/hashtags?${params.toString()}`,
            null,
            {
                headers: {
                    'X-User-Id': userId
                }
            }
        );

        if (elements.input) {
            elements.input.value = '';
        }

        if (response && typeof response === 'object' && Array.isArray(response.hashtags)) {
            renderHashtags(response.hashtags);
        } else {
            await loadContentHashtags();
        }

        showMessage('Hashtag associada com sucesso.', 'success');
    } catch (error) {
        const message =
            error instanceof Error && error.message
                ? error.message
                : 'Não foi possível associar a hashtag ao conteúdo.';
        showMessage(message, 'error');
    } finally {
        setAddingState(false);
    }
}

async function handleRemoveHashtag(hashtagId, hashtagName, buttonElement) {
    if (!hashtagId || removingHashtagIds.has(hashtagId)) {
        return;
    }

    hideMessage();

    if (!currentContentId) {
        showMessage('Conteúdo não identificado na URL.', 'error');
        return;
    }

    const userId = getTrustedUserId();

    if (!userId) {
        showMessage(
            'Não foi possível identificar o usuário autenticado. Faça login novamente para remover hashtags.',
            'warning'
        );
        return;
    }

    removingHashtagIds.add(hashtagId);
    if (buttonElement) {
        buttonElement.disabled = true;
    }

    try {
        const encodedContentId = encodeURIComponent(currentContentId);
        const encodedHashtagId = encodeURIComponent(hashtagId);

        const response = await httpClient.delete(
            `/api/contents/${encodedContentId}/hashtags/${encodedHashtagId}`,
            {
                headers: {
                    'X-User-Id': userId
                }
            }
        );

        if (response && typeof response === 'object' && Array.isArray(response.hashtags)) {
            renderHashtags(response.hashtags);
        } else {
            const updated = currentHashtags.filter(
                (item) => String(item?.id) !== hashtagId
            );
            renderHashtags(updated);
        }

        const successText = hashtagName
            ? `Hashtag "${hashtagName}" removida com sucesso.`
            : 'Hashtag removida com sucesso.';
        showMessage(successText, 'success');
    } catch (error) {
        if (buttonElement) {
            buttonElement.disabled = false;
        }

        const message =
            error instanceof Error && error.message
                ? error.message
                : 'Não foi possível remover a hashtag do conteúdo.';
        showMessage(message, 'error');
    } finally {
        removingHashtagIds.delete(hashtagId);
    }
}

export function initContentHashtags(contentIdOverride = null) {
    currentContentId =
        contentIdOverride && String(contentIdOverride).trim()
            ? String(contentIdOverride).trim()
            : getContentIdFromUrl();

    if (elements.form) {
        elements.form.addEventListener('submit', handleAddHashtag);
    }

    loadContentHashtags();
}

document.addEventListener('DOMContentLoaded', () => {
    if (elements.section || elements.list || elements.form) {
        initContentHashtags();
    }
});