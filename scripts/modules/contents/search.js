import { apiClient } from "../../core/api-client.js";

/* =========================================================
   BUSCAR CONTEÚDOS
   Endpoint: GET /api/contents/search?keyword={termo}

   O termo também fica na URL do navegador (?keyword=), para
   que recarregar, voltar e compartilhar o link funcionem.
   ========================================================= */

const ENDPOINT = "/api/contents/search";
const DETAIL_PAGE = "../detail/index.html";
const EXCERPT_LENGTH = 220;

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric"
});

const elements = {
    form: document.querySelector("#search-form"),
    input: document.querySelector("#search-keyword"),
    submit: document.querySelector("#search-submit"),
    region: document.querySelector("#search-region"),
    summary: document.querySelector("#search-summary"),
    idle: document.querySelector("#search-idle"),
    loading: document.querySelector("#search-loading"),
    error: document.querySelector("#search-error"),
    errorText: document.querySelector("#search-error-text"),
    retry: document.querySelector("#search-retry"),
    empty: document.querySelector("#search-empty"),
    emptyText: document.querySelector("#search-empty-text"),
    list: document.querySelector("#search-list"),
    cardTemplate: document.querySelector("#search-card-template"),
    tagTemplate: document.querySelector("#search-tag-template")
};

const defaultSubmitLabel = elements.submit.textContent.trim();

const state = {
    term: "",
    requestId: 0,
    isSearching: false
};

/* ---------------------------------------------------------
   Estados da tela
   --------------------------------------------------------- */
function showState(name) {
    const panels = {
        idle: elements.idle,
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

    if (name === "idle" || name === "loading" || name === "error") {
        elements.summary.hidden = true;
    }
}

function showError(error) {
    const status = error?.status;

    elements.errorText.textContent =
        status === 401 || status === 403
            ? "Você precisa entrar na sua conta para buscar conteúdos."
            : "Verifique sua conexão e tente novamente.";

    showState("error");
}

/* Bloqueia novos envios enquanto a busca está em andamento */
function setSearching(isSearching) {
    state.isSearching = isSearching;

    elements.submit.disabled = isSearching;
    elements.submit.setAttribute("aria-disabled", String(isSearching));
    elements.submit.textContent = isSearching
        ? "Pesquisando…"
        : defaultSubmitLabel;
}

/* ---------------------------------------------------------
   URL e navegação
   --------------------------------------------------------- */
function getTermFromUrl() {
    const value = new URLSearchParams(window.location.search).get("keyword");
    return value ? value.trim() : "";
}

function updateUrl(term) {
    const url = new URL(window.location.href);

    if (term) {
        url.searchParams.set("keyword", term);
    } else {
        url.searchParams.delete("keyword");
    }

    window.history.pushState({ term }, "", url.href);
}

function buildDetailUrl(id) {
    const params = new URLSearchParams({ id: String(id) });
    return `${DETAIL_PAGE}?${params}`;
}

/* ---------------------------------------------------------
   Dados
   --------------------------------------------------------- */
async function fetchResults(term) {
    const query = new URLSearchParams({ keyword: term });
    const data = await apiClient.get(`${ENDPOINT}?${query}`);

    /* Página Spring (data.content). Um array simples também é aceito. */
    const items = Array.isArray(data) ? data : data?.content;

    if (!Array.isArray(items)) {
        throw new Error("Resposta inválida da API.");
    }

    const totalElements = Number.isInteger(data?.totalElements)
        ? data.totalElements
        : items.length;

    return { items, totalElements };
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
   Cartões (mesmo padrão da exploração)
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

/* ---------------------------------------------------------
   Resumo e mensagem de lista vazia
   --------------------------------------------------------- */
function renderSummary({ term, shown, total, hasHiddenItems }) {
    const nodes = [];

    if (hasHiddenItems) {
        /* Algum item foi descartado: o total da API não vale para a tela */
        nodes.push(`Resultados para “${term}”`);
    } else if (shown < total) {
        const strong = document.createElement("strong");
        strong.textContent = String(shown);

        nodes.push(
            "Mostrando ",
            strong,
            ` de ${total} resultados para “${term}”`
        );
    } else {
        const strong = document.createElement("strong");
        strong.textContent = String(total);

        nodes.push(
            strong,
            ` ${total === 1 ? "resultado" : "resultados"} para “${term}”`
        );
    }

    elements.summary.replaceChildren(...nodes);
    elements.summary.classList.remove("contents-sr-only");
    elements.summary.hidden = false;
}

function renderEmpty(term) {
    elements.emptyText.textContent =
        `Não encontramos conteúdos para “${term}”. ` +
        "Tente outras palavras ou confira a grafia.";

    /* Mantém o aviso para leitores de tela sem repetir o texto na tela */
    elements.summary.textContent = `Nenhum resultado para “${term}”`;
    elements.summary.classList.add("contents-sr-only");
    elements.summary.hidden = false;
}

/* ---------------------------------------------------------
   Busca
   --------------------------------------------------------- */
async function runSearch(term, { pushHistory = false } = {}) {
    const requestId = ++state.requestId;

    state.term = term;
    elements.input.value = term;
    elements.input.setCustomValidity("");

    if (pushHistory) updateUrl(term);

    setSearching(true);
    showState("loading");

    let result;

    try {
        result = await fetchResults(term);
    } catch (error) {
        /* Uma busca mais nova já assumiu a tela */
        if (requestId !== state.requestId) return;

        setSearching(false);
        showError(error);
        return;
    }

    if (requestId !== state.requestId) return;

    setSearching(false);

    const items = result.items.filter(isPublicItem);

    if (items.length === 0) {
        showState("empty");
        renderEmpty(term);
        return;
    }

    renderList(items);
    showState("list");
    renderSummary({
        term,
        shown: items.length,
        total: result.totalElements,
        hasHiddenItems: items.length !== result.items.length
    });
}

function resetToIdle() {
    state.requestId += 1;
    state.term = "";

    elements.input.value = "";
    elements.input.setCustomValidity("");

    setSearching(false);
    showState("idle");
}

/* ---------------------------------------------------------
   Eventos
   --------------------------------------------------------- */
elements.form.addEventListener("submit", event => {
    event.preventDefault();

    /* Impede envios duplicados durante a busca */
    if (state.isSearching) return;

    const term = elements.input.value.trim();

    if (!term) {
        elements.input.setCustomValidity("Digite um termo para buscar.");
        elements.input.reportValidity();
        return;
    }

    elements.input.setCustomValidity("");

    runSearch(term, { pushHistory: term !== state.term });
});

elements.input.addEventListener("input", () => {
    elements.input.setCustomValidity("");
});

elements.retry.addEventListener("click", () => {
    if (state.isSearching || !state.term) return;

    runSearch(state.term);
});

window.addEventListener("popstate", () => {
    const term = getTermFromUrl();

    if (term) {
        runSearch(term);
    } else {
        resetToIdle();
    }
});

const initialTerm = getTermFromUrl();

if (initialTerm) {
    runSearch(initialTerm);
} else {
    resetToIdle();
}