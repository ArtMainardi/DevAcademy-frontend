/*
 * Armazenamento local da sessão.
 *
 * O token JWT é mantido exclusivamente no sessionStorage.
 * Os dados são removidos quando a sessão de navegação termina.
 *
 * Este módulo não realiza autenticação, autorização ou validação
 * da assinatura e da validade do token.
 */

const TOKEN_STORAGE_KEY = "devacademy_access_token";

/**
 * Salva o token JWT da sessão atual.
 *
 * @param {string} token - Token JWT recebido da API.
 * @returns {void}
 */
export function saveToken(token) {
    if (typeof token !== "string" || token.trim() === "") {
        throw new TypeError("O token informado é inválido.");
    }

    try {
        sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
        throw new Error("Não foi possível salvar o token da sessão.");
    }
}

/**
 * Obtém o token JWT armazenado.
 *
 * Retorna null quando não existe token ou quando o armazenamento
 * não está disponível.
 *
 * @returns {string|null}
 */
export function getToken() {
    try {
        return sessionStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
        return null;
    }
}

/**
 * Verifica se existe um token armazenado.
 *
 * A existência do token não garante que ele seja válido,
 * esteja dentro do prazo de validade ou tenha autorização.
 *
 * @returns {boolean}
 */
export function hasToken() {
    return getToken() !== null;
}

/**
 * Remove o token JWT da sessão atual.
 *
 * @returns {void}
 */
export function removeToken() {
    try {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
        throw new Error("Não foi possível remover o token da sessão.");
    }
}