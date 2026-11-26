/*
 * Cliente HTTP central da aplicação.
 *
 * Responsabilidades:
 * - Centralizar as requisições HTTP com fetch.
 * - Configurar os cabeçalhos das requisições.
 * - Adicionar o token JWT nas rotas protegidas.
 * - Tratar respostas JSON, respostas sem corpo e erros HTTP.
 *
 * Não realiza autenticação, autorização ou redirecionamentos.
 */

import { API_BASE_URL } from "../config/api-config.js";

import {
    getToken
} from "./storage.js";

/* =========================================================
   1. CONFIGURAÇÃO
   ========================================================= */

// Endpoints públicos que não recebem Authorization.
const PUBLIC_ENDPOINTS = new Set([
    "POST /api/users",
    "POST /api/auth/login"
]);

/* =========================================================
   2. ERRO DA API
   ========================================================= */

/**
 * Erro estruturado para respostas HTTP não bem-sucedidas.
 *
 * @param {string} message - Mensagem apresentada ao módulo chamador.
 * @param {number} status - Código HTTP da resposta.
 */
export class ApiError extends Error {
    constructor(message, status) {
        super(message);

        this.name = "ApiError";
        this.status = status;
    }
}

/* =========================================================
   3. UTILITÁRIOS INTERNOS
   ========================================================= */

/**
 * Normaliza o caminho para verificar se uma rota é pública.
 *
 * @param {string} path
 * @returns {string}
 */
function normalizePath(path) {
    const pathname = new URL(
        path,
        API_BASE_URL
    ).pathname;

    return pathname.replace(/\/+$/, "") || "/";
}

/**
 * Verifica se uma requisição corresponde a um endpoint público.
 *
 * @param {string} method
 * @param {string} path
 * @returns {boolean}
 */
function isPublicEndpoint(method, path) {
    const normalizedMethod = method.toUpperCase();
    const normalizedPath = normalizePath(path);

    return PUBLIC_ENDPOINTS.has(
        `${normalizedMethod} ${normalizedPath}`
    );
}

/**
 * Monta a URL da requisição com os parâmetros de consulta.
 *
 * Aceita um objeto comum ou uma instância de URLSearchParams.
 *
 * @param {string} path
 * @param {Object|URLSearchParams} [query]
 * @returns {string}
 */
function buildUrl(path, query) {
    const url = new URL(
        path,
        `${API_BASE_URL.replace(/\/+$/, "")}/`
    );

    if (!query) {
        return url.toString();
    }

    const params = query instanceof URLSearchParams
        ? query
        : new URLSearchParams();

    if (!(query instanceof URLSearchParams)) {
        for (const [key, value] of Object.entries(query)) {
            if (value === undefined || value === null) {
                continue;
            }

            if (Array.isArray(value)) {
                for (const item of value) {
                    params.append(key, String(item));
                }
            } else {
                params.append(key, String(value));
            }
        }
    }

    params.forEach((value, key) => {
        url.searchParams.append(key, value);
    });

    return url.toString();
}

/**
 * Lê o corpo da resposta sem assumir que existe JSON.
 *
 * Retorna null quando a resposta não possui corpo.
 *
 * @param {Response} response
 * @returns {Promise<unknown>}
 */
async function parseResponse(response) {
    if (response.status === 204) {
        return null;
    }

    const text = await response.text();

    if (!text.trim()) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

/**
 * Extrai uma mensagem segura do erro retornado pela API.
 *
 * Prioridade:
 * 1. detail
 * 2. message
 * 3. title
 *
 * @param {unknown} data
 * @returns {string|null}
 */
function extractErrorMessage(data) {
    if (!data || typeof data !== "object") {
        return null;
    }

    const fields = [
        data.detail,
        data.message,
        data.title
    ];

    for (const value of fields) {
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }

    return null;
}

/**
 * Cria um erro HTTP sem incluir cabeçalhos ou dados da requisição.
 *
 * @param {Response} response
 * @param {unknown} data
 * @returns {ApiError}
 */
function createHttpError(response, data) {
    const message = extractErrorMessage(data);

    return new ApiError(
        message || `A API retornou um erro HTTP ${response.status}.`,
        response.status
    );
}

/* =========================================================
   4. CLIENTE HTTP CENTRAL
   ========================================================= */

/**
 * Realiza uma requisição HTTP para a API.
 *
 * @param {string} method
 * @param {string} path
 * @param {Object} [options]
 * @param {Object|URLSearchParams} [options.query]
 * @param {unknown} [options.body]
 * @param {Object} [options.headers]
 * @returns {Promise<unknown>}
 */
export async function request(
    method,
    path,
    {
        query,
        body,
        headers = {}
    } = {}
) {
    const normalizedMethod = method.toUpperCase();
    const url = buildUrl(path, query);

    const requestHeaders = new Headers(headers);

    const hasBody = body !== undefined && body !== null;

    // O Content-Type só é definido quando existe corpo JSON.
    if (hasBody) {
        requestHeaders.set(
            "Content-Type",
            "application/json"
        );
    }

    // Todas as rotas protegidas recebem o token automaticamente.
    // As duas rotas públicas nunca recebem Authorization.
    if (!isPublicEndpoint(normalizedMethod, path)) {
        const token = getToken();

        if (token) {
            requestHeaders.set(
                "Authorization",
                `Bearer ${token}`
            );
        }
    } else {
        requestHeaders.delete("Authorization");
    }

    let response;

    try {
        response = await fetch(url, {
            method: normalizedMethod,
            headers: requestHeaders,
            body: hasBody
                ? JSON.stringify(body)
                : undefined
        });
    } catch {
        throw new Error(
            "Não foi possível conectar à API. Verifique sua conexão e tente novamente."
        );
    }

    let data;

    try {
        data = await parseResponse(response);
    } catch {
        throw new Error(
            "Não foi possível interpretar a resposta da API."
        );
    }

    if (!response.ok) {
        throw createHttpError(response, data);
    }

    return data;
}

/* =========================================================
   5. MÉTODOS HTTP
   ========================================================= */

/**
 * Realiza uma requisição GET.
 *
 * @param {string} path
 * @param {Object} [options]
 * @returns {Promise<unknown>}
 */
export function get(path, options = {}) {
    return request("GET", path, options);
}

/**
 * Realiza uma requisição POST.
 *
 * @param {string} path
 * @param {unknown} [body]
 * @param {Object} [options]
 * @returns {Promise<unknown>}
 */
export function post(path, body, options = {}) {
    return request("POST", path, {
        ...options,
        body
    });
}

/**
 * Realiza uma requisição PUT.
 *
 * @param {string} path
 * @param {unknown} [body]
 * @param {Object} [options]
 * @returns {Promise<unknown>}
 */
export function put(path, body, options = {}) {
    return request("PUT", path, {
        ...options,
        body
    });
}

/**
 * Realiza uma requisição PATCH.
 *
 * @param {string} path
 * @param {unknown} [body]
 * @param {Object} [options]
 * @returns {Promise<unknown>}
 */
export function patch(path, body, options = {}) {
    return request("PATCH", path, {
        ...options,
        body
    });
}

/**
 * Realiza uma requisição DELETE.
 *
 * @param {string} path
 * @param {Object} [options]
 * @returns {Promise<unknown>}
 */
export function del(path, options = {}) {
    return request("DELETE", path, options);
}