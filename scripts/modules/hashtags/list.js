import { httpClient } from '../../core/http.js';

const elements = {
    loading: document.getElementById('hashtag-list-loading'),
    empty: document.getElementById('hashtag-list-empty'),
    content: document.getElementById('hashtag-list-content'),
    list: document.getElementById('hashtag-list'),
    messageBox: document.getElementById('hashtag-list-message'),
    messageText: document.getElementById('hashtag-list-message-text')
};

function hideMessage() {
    if (!elements.messageBox || !elements.messageText) return;
    elements.messageBox.hidden = true;
    elements.messageText.textContent = '';
    elements.messageBox.classList.remove('alert-error', 'alert-warning', 'alert-success');
}

function showError(message) {
    if (!elements.messageBox || !elements.messageText) return;
    elements.messageBox.classList.remove('alert-warning', 'alert-success');
    elements.messageBox.classList.add('alert-error');
    elements.messageText.textContent = message;
    elements.messageBox.hidden = false;
}

function showLoading() {
    if (elements.loading) elements.loading.hidden = false;
    if (elements.empty) elements.empty.hidden = true;
    if (elements.content) elements.content.hidden = true;
    hideMessage();
}

function showEmpty() {
    if (elements.loading) elements.loading.hidden = true;
    if (elements.empty) elements.empty.hidden = false;
    if (elements.content) elements.content.hidden = true;
}

function showContent() {
    if (elements.loading) elements.loading.hidden = true;
    if (elements.empty) elements.empty.hidden = true;
    if (elements.content) elements.content.hidden = false;
}

function hideAllSections() {
    if (elements.loading) elements.loading.hidden = true;
    if (elements.empty) elements.empty.hidden = true;
    if (elements.content) elements.content.hidden = true;
}

function createHashtagItem(hashtag) {
    const item = document.createElement('li');
    item.className = 'hashtag-list-item';

    const tag = document.createElement('span');
    tag.className = 'hashtag-tag';

    if (hashtag?.id !== null && hashtag?.id !== undefined) {
        tag.dataset.hashtagId = String(hashtag.id);
    }

    const label = document.createElement('span');
    label.className = 'hashtag-tag-label';
    label.textContent = typeof hashtag?.name === 'string' ? hashtag.name : '';

    tag.appendChild(label);
    item.appendChild(tag);

    return item;
}

function renderHashtags(hashtags) {
    if (!elements.list) return;

    elements.list.replaceChildren();

    if (hashtags.length === 0) {
        showEmpty();
        return;
    }

    const fragment = document.createDocumentFragment();

    for (const hashtag of hashtags) {
        fragment.appendChild(createHashtagItem(hashtag));
    }

    elements.list.appendChild(fragment);
    showContent();
}

export async function loadHashtags() {
    showLoading();

    try {
        const response = await httpClient.get('/api/hashtags');

        if (!Array.isArray(response)) {
            throw new Error('Resposta inválida ao carregar as hashtags.');
        }

        renderHashtags(response);
    } catch (error) {
        hideAllSections();
        const message =
            error instanceof Error && error.message
                ? error.message
                : 'Não foi possível carregar as hashtags. Tente novamente mais tarde.';
        showError(message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadHashtags();
});