import { apiClient } from "../../core/api-client.js";

/* =========================================================
   EXPLORAR CONTEÚDOS
   Endpoint: GET /api/contents/explore (página Spring)

   Parâmetro enviado: apenas `page` (base 0 na API).
   Na URL do navegador, `?page=` usa base 1 e serve só para
   manter a página ao recarregar ou voltar.
   ========================================================= */

const ENDPOINT = "/api/contents/explore";
const DETAIL_PAGE = "../detail/index.html";
const EXCERPT_LENGTH = 220;

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric"
});

const elements = {
    title: document.querySelector("#explore-title"),
    region: document.querySelector("#explore-region"),
    summary: document.querySelector("#explore-summary"),
    loading: document.querySelector("#explore-loading"),
    error: document.querySelector("#explore-error"),
    errorText: document.querySelector("#explore-error-text"),
    retry: document.querySelector("#explore-retry"),
    empty: document.querySelector("#explore-empty"),
    list: document.querySelector("#explore-list"),
    pagination: document.querySelector("#explore-pagination"),
    paginationInfo: document.querySelector("#explore-pagination-info"),
    paginationList: document.querySelector("#explore-pagination-list"),
    cardTemplate: document.querySelector("#explore-card-template"),
    tagTemplate: document.querySelector("#explore-tag-template"),
    pageItemTemplate: document.querySelector("#explore-page-item-template")
};

const state = {
    page: 1,
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

    if (name === "loading" || name === "error") {
        elements.summary.hidden = true;
        elements.pagination.hidden = true;
    }
}

function showError(error) {
    const status = error?.status;

    elements.errorText.textContent =
        status === 401 || status === 403
            ? "Você precisa entrar na sua conta para ver os conteúdos."
            : "Verifique sua conexão e tente novamente.";

    showState("error");
}

/* ---------------------------------------------------------
   URL e navegação
   --------------------------------------------------------- */
function getPageFromUrl() {
    const value = Number.parseInt(
        new URLSearchParams(window.location.search).get("page"),
        10
    );

    return Number.isInteger(value) && value >= 1 ? value : 1;
}

function updateUrl(page, { replace = false } = {}) {
    const url = new URL(window.location.href);

    if (page <= 1) {
        url.searchParams.delete("page");
    } else {
        url.searchParams.set("page", String(page));
    }

    const method = replace ? "replaceState" : "pushState";
    window.history[method]({ page }, "", url.href);
}

function buildDetailUrl(id) {
    const params = new URLSearchParams({ id: String(id) });
    return `${DETAIL_PAGE}?${params}`;
}

/* ---------------------------------------------------------
   Dados
   --------------------------------------------------------- */
async function fetchPage(page) {
    const query = new URLSearchParams({ page: String(page - 1) });
    const data = await apiClient.get(`${ENDPOINT}?${query}`);

    if (!data || !Array.isArray(data.content)) {
        throw new Error("Resposta inválida da API.");
    }

    return data;
}

function readPageMeta(data, requestedPage) {
    const totalElements = Number.isInteger(data.totalElements)
        ? data.totalElements
        : data.content.length;

    const totalPages = Number.isInteger(data.totalPages)
        ? data.totalPages
        : 1;

    const currentPage = Number.isInteger(data.number)
        ? data.number + 1
        : requestedPage;

    return { totalElements, totalPages, currentPage };
}

/* Só exibe o que pode ser linkado e que não foi marcado como rascunho */
function isPublicItem(item) {
    return Boolean(item) && item.id != null && item.published !== false;
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

/* ---------------------------------------------------------
   Cartões
   --------------------------------------------------------- */
function createCard(item) {
    const fragment = elements.cardTemplate.content.cloneNode(true);
    const field = name => fragment.querySelector(`[data-field="${name}"]`);

    const link = field("link");
    link.textContent = item.title?.trim() || "Sem título";
    link.href = buildDetailUrl(item.id);

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

    field("author").textContent =
        item.ownerName?.trim() || "autor não informado";

    const time = field("date");
    const date = parseDate(item.createdAt);

    if (date) {
        time.dateTime = date.toISOString();
        time.textContent = dateFormatter.format(date);
    } else {
        time.closest("li").remove();
    }

    return fragment;
}

function renderList(items) {
    elements.list.replaceChildren(...items.map(createCard));
}

function renderSummary(totalElements, hasHiddenItems) {
    /* Se algum item foi descartado, o total da API não vale para a tela */
    if (hasHiddenItems) {
        elements.summary.hidden = true;
        return;
    }

    const strong = document.createElement("strong");
    strong.textContent = String(totalElements);

    const label =
        totalElements === 1
            ? " conteúdo publicado"
            : " conteúdos publicados";

    elements.summary.replaceChildren(strong, label);
    elements.summary.hidden = false;
}

/* ---------------------------------------------------------
   Paginação
   --------------------------------------------------------- */
function getPageSequence(current, total) {
    const pages = new Set([1, total]);

    for (let page = current - 2; page <= current + 2; page++) {
        if (page >= 1 && page <= total) pages.add(page);
    }

    const sorted = [...pages].sort((a, b) => a - b);
    const sequence = [];

    sorted.forEach((page, index) => {
        if (index > 0) {
            const difference = page - sorted[index - 1];

            if (difference === 2) {
                sequence.push(page - 1);
            } else if (difference > 2) {
                sequence.push("gap");
            }
        }

        sequence.push(page);
    });

    return sequence;
}

function createPageItem(label, page, options = {}) {
    const { isCurrent = false, isDisabled = false, ariaLabel, isOptional = false } =
        options;

    const fragment = elements.pageItemTemplate.content.cloneNode(true);
    const item = fragment.querySelector("li");
    const button = fragment.querySelector('[data-field="page"]');

    button.textContent = label;
    button.dataset.page = String(page);

    if (ariaLabel) button.setAttribute("aria-label", ariaLabel);

    if (isCurrent) {
        button.setAttribute("aria-current", "page");
    }

    if (isDisabled) {
        button.disabled = true;
        button.setAttribute("aria-disabled", "true");
    }

    if (isOptional) {
        item.classList.add("contents-pagination__item--optional");
    }

    return fragment;
}

function createGapItem() {
    const item = document.createElement("li");
    item.className =
        "contents-pagination__item contents-pagination__item--optional";

    const gap = document.createElement("span");
    gap.className = "contents-pagination__gap";
    gap.setAttribute("aria-hidden", "true");
    gap.textContent = "…";

    item.append(gap);
    return item;
}

function renderPagination(currentPage, totalPages) {
    if (totalPages <= 1) {
        elements.pagination.hidden = true;
        elements.paginationList.replaceChildren();
        return;
    }

    const items = [
        createPageItem("Anterior", currentPage - 1, {
            isDisabled: currentPage <= 1,
            ariaLabel: "Página anterior"
        })
    ];

    for (const entry of getPageSequence(currentPage, totalPages)) {
        if (entry === "gap") {
            items.push(createGapItem());
            continue;
        }

        items.push(
            createPageItem(String(entry), entry, {
                isCurrent: entry === currentPage,
                isOptional: Math.abs(entry - currentPage) > 1,
                ariaLabel: `Página ${entry}`
            })
        );
    }

    items.push(
        createPageItem("Próxima", currentPage + 1, {
            isDisabled: currentPage >= totalPages,
            ariaLabel: "Próxima página"
        })
    );

    elements.paginationInfo.textContent = `Página ${currentPage} de ${totalPages}`;
    elements.paginationList.replaceChildren(...items);
    elements.pagination.hidden = false;
}

/* ---------------------------------------------------------
   Carregamento
   --------------------------------------------------------- */
function moveFocusToTop() {
    const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;

    elements.title.setAttribute("tabindex", "-1");
    elements.title.focus({ preventScroll: true });
    elements.region.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start"
    });
}

async function loadPage(page, { history = "none", moveFocus = false } = {}) {
    const requestId = ++state.requestId;
    state.page = page;

    if (history === "push") updateUrl(page);
    if (history === "replace") updateUrl(page, { replace: true });

    showState("loading");

    let data;

    try {
        data = await fetchPage(page);
    } catch (error) {
        if (requestId === state.requestId) showError(error);
        return;
    }

    /* Ignora respostas de uma página que o usuário já deixou */
    if (requestId !== state.requestId) return;

    const meta = readPageMeta(data, page);

    /* Página pedida além do fim (ex.: ?page=999): volta para a última */
    if (meta.totalPages > 0 && page > meta.totalPages) {
        loadPage(meta.totalPages, { history: "replace", moveFocus });
        return;
    }

    const items = data.content.filter(isPublicItem);
    const hasHiddenItems = items.length !== data.content.length;

    if (items.length === 0) {
        showState("empty");
        elements.summary.hidden = true;
        renderPagination(meta.currentPage, meta.totalPages);
    } else {
        renderList(items);
        showState("list");
        renderSummary(meta.totalElements, hasHiddenItems);
        renderPagination(meta.currentPage, meta.totalPages);
    }

    if (moveFocus) moveFocusToTop();
}

/* ---------------------------------------------------------
   Eventos
   --------------------------------------------------------- */
elements.paginationList.addEventListener("click", event => {
    const button = event.target.closest("button[data-page]");

    if (!button || button.disabled) return;

    const page = Number.parseInt(button.dataset.page, 10);

    if (!Number.isInteger(page) || page === state.page) return;

    loadPage(page, { history: "push", moveFocus: true });
});

elements.retry.addEventListener("click", () => {
    loadPage(state.page);
});

window.addEventListener("popstate", () => {
    loadPage(getPageFromUrl());
});

loadPage(getPageFromUrl());