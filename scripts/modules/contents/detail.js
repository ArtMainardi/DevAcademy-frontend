import { apiClient } from "../../core/api-client.js";

/* =========================================================
   DETALHE DO CONTEÚDO
   Endpoint: GET /api/contents/{id}

   Autorização: o front-end só decide o que MOSTRAR. Quem
   autoriza editar, ver histórico ou excluir é sempre o backend,
   que pode recusar qualquer chamada mesmo com o botão visível.
   ========================================================= */

const ENDPOINT = "/api/contents";
const EXPLORE_PAGE = "../explore/index.html";
const EDIT_PAGE = "../edit/index.html";
const HISTORY_PAGE = "../history/index.html";
const SITE_NAME = "DevAcademy";

/* Formato aceito para o ID: número inteiro ou UUID.
   O contrato não define o tipo do ID. Se for só numérico, use /^\d{1,19}$/. */
const ID_PATTERN =
    /^(\d{1,19}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric"
});

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
});

const elements = {
    region: document.querySelector("#detail-region"),
    loading: document.querySelector("#detail-loading"),
    error: document.querySelector("#detail-error"),
    errorText: document.querySelector("#detail-error-text"),
    retry: document.querySelector("#detail-retry"),
    notFound: document.querySelector("#detail-not-found"),
    article: document.querySelector("#detail-article"),

    statusWrapper: document.querySelector("#detail-status-wrapper"),
    title: document.querySelector("#detail-title"),
    author: document.querySelector("#detail-author"),
    created: document.querySelector("#detail-created"),
    updatedItem: document.querySelector("#detail-updated-item"),
    updated: document.querySelector("#detail-updated"),
    versionItem: document.querySelector("#detail-version-item"),
    version: document.querySelector("#detail-version"),
    tags: document.querySelector("#detail-tags"),
    tagTemplate: document.querySelector("#detail-tag-template"),
    body: document.querySelector("#detail-body"),

    footer: document.querySelector("#detail-footer"),
    edit: document.querySelector("#detail-edit"),
    history: document.querySelector("#detail-history"),
    deleteButton: document.querySelector("#detail-delete"),
    deleteConfirm: document.querySelector("#detail-delete-confirm"),
    deleteConfirmButton: document.querySelector("#detail-delete-confirm-button"),
    deleteCancel: document.querySelector("#detail-delete-cancel"),
    actionError: document.querySelector("#detail-action-error")
};

const state = {
    id: null,
    currentUserId: null,
    requestId: 0,
    isDeleting: false
};

/* ---------------------------------------------------------
   Estados da tela
   --------------------------------------------------------- */
function showState(name) {
    const panels = {
        loading: elements.loading,
        error: elements.error,
        "not-found": elements.notFound,
        article: elements.article
    };

    for (const [key, panel] of Object.entries(panels)) {
        panel.hidden = key !== name;
    }

    elements.region.setAttribute(
        "aria-busy",
        name === "loading" ? "true" : "false"
    );
}

function showError(error) {
    elements.errorText.textContent =
        error?.status === 401
            ? "Você precisa entrar na sua conta para ver este conteúdo."
            : "Verifique sua conexão e tente novamente.";

    document.title = `Erro ao carregar | ${SITE_NAME}`;
    showState("error");
}

function showNotFound() {
    document.title = `Conteúdo não encontrado | ${SITE_NAME}`;
    showState("not-found");
}

/* ---------------------------------------------------------
   ID da URL
   --------------------------------------------------------- */
function getContentId() {
    const value = new URLSearchParams(window.location.search).get("id");
    const id = value ? value.trim() : "";

    return ID_PATTERN.test(id) ? id : null;
}

/* ---------------------------------------------------------
   Dados
   --------------------------------------------------------- */
async function fetchContent(id) {
    const content = await apiClient.get(
        `${ENDPOINT}/${encodeURIComponent(id)}`
    );

    if (!content || typeof content !== "object" || content.id == null) {
        throw new Error("Resposta inválida da API.");
    }

    return content;
}

/* Quem é o usuário autenticado.
   Usa o módulo de sessão do projeto, se existir. Se não existir ou
   falhar, devolve null e nenhuma ação é exibida (falha segura). */
async function resolveCurrentUserId() {
    try {
        const session = await import("../../core/session.js");
        const id = await session.getCurrentUserId?.();

        return id == null || id === "" ? null : String(id);
    } catch {
        return null;
    }
}

/* O ownerId serve só para decidir o que mostrar na tela.
   Não é autorização: o backend valida cada chamada. */
function shouldShowOwnerActions(content, currentUserId) {
    return (
        Boolean(currentUserId) &&
        content.ownerId != null &&
        String(content.ownerId) === currentUserId
    );
}

/* ---------------------------------------------------------
   Formatação
   --------------------------------------------------------- */
function parseDate(value) {
    if (!value) return null;

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeTags(hashtags) {
    if (!Array.isArray(hashtags)) return [];

    return hashtags
        .filter(tag => typeof tag === "string")
        .map(tag => tag.replace(/^#+/, "").trim())
        .filter(Boolean);
}

function setTime(timeElement, date, formatter) {
    timeElement.dateTime = date.toISOString();
    timeElement.textContent = formatter.format(date);
}

/* ---------------------------------------------------------
   Renderização
   --------------------------------------------------------- */
function renderTags(hashtags) {
    const tags = normalizeTags(hashtags);

    const items = tags.map(tag => {
        const fragment = elements.tagTemplate.content.cloneNode(true);
        fragment.querySelector('[data-field="tag"]').textContent = tag;
        return fragment;
    });

    elements.tags.replaceChildren(...items);
    elements.tags.hidden = items.length === 0;
}

function renderDates(content) {
    const created = parseDate(content.createdAt);
    const updated = parseDate(content.updatedAt);

    elements.created.closest("li").hidden = !created;

    if (created) setTime(elements.created, created, dateFormatter);

    /* Só mostra "Atualizado em" se houve alteração depois da criação */
    const wasUpdated =
        updated && (!created || updated.getTime() - created.getTime() > 1000);

    elements.updatedItem.hidden = !wasUpdated;

    if (wasUpdated) setTime(elements.updated, updated, dateTimeFormatter);
}

function renderContent(content, isOwner) {
    const title = content.title?.trim() || "Sem título";

    elements.title.textContent = title;
    elements.author.textContent =
        content.ownerName?.trim() || "autor não informado";
    elements.body.textContent =
        typeof content.body === "string" ? content.body : "";

    document.title = `${title} | ${SITE_NAME}`;

    renderDates(content);
    renderTags(content.hashtags);

    const hasVersion =
        content.version != null && String(content.version).trim() !== "";

    elements.versionItem.hidden = !hasVersion;

    if (hasVersion) elements.version.textContent = String(content.version);

    /* Aviso de rascunho: só aparece se a API marcar como não publicado */
    const isDraft = content.published === false;
    const badge = elements.statusWrapper.querySelector(".content-status");

    badge.textContent = isOwner
        ? "Rascunho: só você pode ver"
        : "Rascunho: conteúdo não publicado";
    elements.statusWrapper.hidden = !isDraft;
}

function renderActions(content, isOwner) {
    resetActions();

    if (!isOwner) {
        elements.footer.hidden = true;
        return;
    }

    const id = encodeURIComponent(String(content.id));

    elements.edit.href = `${EDIT_PAGE}?id=${id}`;
    elements.history.href = `${HISTORY_PAGE}?id=${id}`;

    elements.edit.hidden = false;
    elements.history.hidden = false;
    elements.deleteButton.hidden = false;
    elements.footer.hidden = false;
}

function resetActions() {
    elements.edit.hidden = true;
    elements.history.hidden = true;
    elements.deleteButton.hidden = true;
    elements.deleteConfirm.hidden = true;
    elements.actionError.hidden = true;
    elements.actionError.textContent = "";
}

/* ---------------------------------------------------------
   Carregamento
   --------------------------------------------------------- */
async function loadContent() {
    const requestId = ++state.requestId;

    showState("loading");

    let content;

    try {
        content = await fetchContent(state.id);
    } catch (error) {
        if (requestId !== state.requestId) return;

        /* Inexistente (404) ou sem acesso (403) */
        if (error?.status === 404 || error?.status === 403) {
            showNotFound();
        } else {
            showError(error);
        }

        return;
    }

    const currentUserId = await resolveCurrentUserId();

    if (requestId !== state.requestId) return;

    const isOwner = shouldShowOwnerActions(content, currentUserId);

    state.currentUserId = currentUserId;

    renderContent(content, isOwner);
    renderActions(content, isOwner);
    showState("article");
}

/* ---------------------------------------------------------
   Exclusão
   --------------------------------------------------------- */
function showActionError(message) {
    elements.actionError.textContent = message;
    elements.actionError.hidden = false;
}

function getDeleteErrorMessage(error) {
    switch (error?.status) {
        case 401:
            return "Sua sessão expirou. Entre novamente para excluir.";
        case 403:
            return "Você não tem permissão para excluir este conteúdo.";
        case 404:
            return "Este conteúdo já foi removido.";
        default:
            return "Não foi possível excluir o conteúdo. Tente novamente.";
    }
}

function setDeleting(isDeleting) {
    state.isDeleting = isDeleting;

    elements.deleteConfirmButton.disabled = isDeleting;
    elements.deleteCancel.disabled = isDeleting;
    elements.deleteConfirmButton.textContent = isDeleting
        ? "Excluindo…"
        : "Excluir definitivamente";
}

function openDeleteConfirm() {
    elements.actionError.hidden = true;
    elements.deleteConfirm.hidden = false;
    elements.deleteCancel.focus();
}

function closeDeleteConfirm() {
    elements.deleteConfirm.hidden = true;
    elements.deleteButton.focus();
}

async function deleteContent() {
    if (state.isDeleting) return;

    /* Sem usuário identificado não há como enviar o X-User-Id exigido */
    if (!state.currentUserId) {
        elements.deleteConfirm.hidden = true;
        showActionError("Não foi possível identificar sua conta. Entre novamente.");
        return;
    }

    setDeleting(true);

    try {
        /* X-User-Id é exigido pelo contrato. A autenticação (JWT)
           continua sendo responsabilidade do cliente HTTP compartilhado. */
        await apiClient.delete(
            `${ENDPOINT}/${encodeURIComponent(state.id)}`,
            { headers: { "X-User-Id": state.currentUserId } }
        );
    } catch (error) {
        setDeleting(false);
        elements.deleteConfirm.hidden = true;
        showActionError(getDeleteErrorMessage(error));
        elements.deleteButton.focus();
        return;
    }

    /* 204 No Content: volta para a exploração */
    window.location.assign(EXPLORE_PAGE);
}

/* ---------------------------------------------------------
   Eventos
   --------------------------------------------------------- */
elements.deleteButton.addEventListener("click", openDeleteConfirm);
elements.deleteCancel.addEventListener("click", closeDeleteConfirm);
elements.deleteConfirmButton.addEventListener("click", deleteContent);

elements.deleteConfirm.addEventListener("keydown", event => {
    if (event.key === "Escape" && !state.isDeleting) {
        closeDeleteConfirm();
    }
});

elements.retry.addEventListener("click", loadContent);

/* ---------------------------------------------------------
   Início
   --------------------------------------------------------- */
state.id = getContentId();

if (state.id) {
    loadContent();
} else {
    /* ID ausente ou em formato inválido: nem chega a consultar a API */
    showNotFound();
}