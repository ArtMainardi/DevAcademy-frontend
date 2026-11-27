import { apiClient } from "../../core/api-client.js";

/* =========================================================
   MEUS CONTEÚDOS
   Endpoint: GET /api/contents/my (página Spring)

   Autenticação: JWT, enviado pelo cliente HTTP compartilhado.
   O contrato exige também X-User-Id. Ele NÃO é autenticação:
   vem do módulo de sessão (fonte confiável), nunca de ID fixo,
   campo digitado, URL ou conteúdo recebido. Sem esse ID, a
   requisição não é feita. Quem autoriza é sempre o backend.
   ========================================================= */

const ENDPOINT = "/api/contents/my";
const DETAIL_PAGE = "../detail/index.html";
const EDIT_PAGE = "../edit/index.html";
const HISTORY_PAGE = "../history/index.html";
const EXCERPT_LENGTH = 220;

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric"
});

const elements = {
    region: document.querySelector("#my-region"),
    summary: document.querySelector("#my-summary"),
    loading: document.querySelector("#my-loading"),
    error: document.querySelector("#my-error"),
    errorText: document.querySelector("#my-error-text"),
    retry: document.querySelector("#my-retry"),
    empty: document.querySelector("#my-empty"),
    list: document.querySelector("#my-list"),
    cardTemplate: document.querySelector("#my-card-template"),
    tagTemplate: document.querySelector("#my-tag-template")
};

const state = {
    requestId: 0
};

/* ---------------------------------------------------------
   Estados da tela
   --------------------------------------------------------- */
function showState(name) {
    const panels = {
        loading: elements.loading,
        error: elements.error,
        empty: elements.empty,
        list: elements.list
    };

    for (const [key, panel] of Object.entries(panels)) {
        panel.hidden = key !== name;
    }

    elements.region.setAttribute(
        "aria-busy",
        name === "loading" ? "true" : "false"
    );

    if (name !== "list") elements.summary.hidden = true;
}

function showError(message) {
    elements.errorText.textContent = message;
    showState("error");
}

function getLoadErrorMessage(error) {
    switch (error?.status) {
        case 401:
            return "Você precisa entrar na sua conta para ver seus conteúdos.";
        case 403:
            return "Você não tem permissão para ver estes conteúdos.";
        default:
            return "Verifique sua conexão e tente novamente.";
    }
}

/* ---------------------------------------------------------
   Dados
   --------------------------------------------------------- */
/* Quem é o usuário autenticado: só do módulo de sessão.
   Se não for possível obter, devolve null e nada é requisitado. */
async function resolveTrustedUserId() {
    try {
        const session = await import("../../core/session.js");
        const id = await session.getCurrentUserId?.();

        return id == null || id === "" ? null : String(id);
    } catch {
        return null;
    }
}

async function fetchMyContents(userId) {
    const data = await apiClient.get(ENDPOINT, {
        headers: { "X-User-Id": userId }
    });

    /* Página Spring (data.content). Um array simples também é aceito. */
    const items = Array.isArray(data) ? data : data?.content;

    if (!Array.isArray(items)) {
        throw new Error("Resposta inválida da API.");
    }

    const totalElements = Number.isInteger(data?.totalElements)
        ? data.totalElements
        : items.length;

    return {
        items: items.filter(item => item && item.id != null),
        totalElements
    };
}

/* O ownerId só decide o que MOSTRAR. Conhecer o ID do usuário não
   dá permissão: editar e ver histórico são autorizados pelo backend. */
function isOwnedByUser(item, userId) {
    return item.ownerId != null && String(item.ownerId) === userId;
}

/* ---------------------------------------------------------
   Formatação
   --------------------------------------------------------- */
function createExcerpt(body) {
    if (typeof body !== "string") return "";

    const text = body.replace(/\s+/g, " ").trim();

    if (text.length <= EXCERPT_LENGTH) return text;

    let cut = text.slice(0, EXCERPT_LENGTH);
    const lastSpace = cut.lastIndexOf(" ");

    if (lastSpace > EXCERPT_LENGTH * 0.6) {
        cut = cut.slice(0, lastSpace);
    }

    return `${cut.replace(/[\s.,;:!?-]+$/, "")}…`;
}

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

function buildUrl(page, id) {
    return `${page}?id=${encodeURIComponent(String(id))}`;
}

/* ---------------------------------------------------------
   Cartões
   --------------------------------------------------------- */
function renderStatus(statusElement, published) {
    /* Sem o campo na resposta, não afirma nada sobre a publicação */
    if (typeof published !== "boolean") {
        statusElement.closest("p").remove();
        return;
    }

    statusElement.textContent = published ? "Publicado" : "Rascunho";
    statusElement.classList.toggle("content-status--draft", !published);
}

function createCard(item, userId) {
    const fragment = elements.cardTemplate.content.cloneNode(true);
    const field = name => fragment.querySelector(`[data-field="${name}"]`);

    renderStatus(field("status"), item.published);

    const link = field("link");
    link.textContent = item.title?.trim() || "Sem título";
    link.href = buildUrl(DETAIL_PAGE, item.id);

    const summary = field("summary");
    const excerpt = createExcerpt(item.body);

    if (excerpt) {
        summary.textContent = excerpt;
    } else {
        summary.remove();
    }

    const tagList = field("tags");
    const tags = normalizeTags(item.hashtags);

    if (tags.length > 0) {
        for (const tag of tags) {
            const tagItem = elements.tagTemplate.content.cloneNode(true);
            tagItem.querySelector('[data-field="tag"]').textContent = tag;
            tagList.append(tagItem);
        }
    } else {
        tagList.remove();
    }

    const time = field("date");
    const date = parseDate(item.createdAt);

    if (date) {
        time.dateTime = date.toISOString();
        time.textContent = dateFormatter.format(date);
    } else {
        time.closest("ul").remove();
    }

    const edit = field("edit");
    const history = field("history");

    if (isOwnedByUser(item, userId)) {
        edit.href = buildUrl(EDIT_PAGE, item.id);
        history.href = buildUrl(HISTORY_PAGE, item.id);
    } else {
        /* Sem confirmação de autoria, não oferece ações; o título abre o detalhe */
        edit.closest(".content-card__actions").remove();
    }

    return fragment;
}

function renderList(items, userId) {
    elements.list.replaceChildren(...items.map(item => createCard(item, userId)));
}

function renderSummary(shown, total) {
    const strong = document.createElement("strong");

    if (shown < total) {
        strong.textContent = String(shown);
        elements.summary.replaceChildren(
            "Mostrando ",
            strong,
            ` de ${total} conteúdos`
        );
    } else {
        strong.textContent = String(total);
        elements.summary.replaceChildren(
            strong,
            total === 1 ? " conteúdo" : " conteúdos"
        );
    }

    elements.summary.hidden = false;
}

/* ---------------------------------------------------------
   Carregamento
   --------------------------------------------------------- */
async function loadContents() {
    const requestId = ++state.requestId;

    showState("loading");

    const userId = await resolveTrustedUserId();

    if (requestId !== state.requestId) return;

    /* Sem o ID do usuário autenticado, a requisição não é feita */
    if (!userId) {
        showError(
            "Configuração pendente: não foi possível identificar o usuário autenticado. " +
            "Entre novamente ou verifique o módulo de sessão do projeto."
        );
        return;
    }

    let result;

    try {
        result = await fetchMyContents(userId);
    } catch (error) {
        if (requestId !== state.requestId) return;

        showError(getLoadErrorMessage(error));
        return;
    }

    if (requestId !== state.requestId) return;

    if (result.items.length === 0) {
        showState("empty");
        return;
    }

    renderList(result.items, userId);
    showState("list");
    renderSummary(result.items.length, result.totalElements);
}

/* ---------------------------------------------------------
   Eventos
   --------------------------------------------------------- */
elements.retry.addEventListener("click", loadContents);

loadContents();