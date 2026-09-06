export const STOP_WORDS = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
    'any', 'are', 'aren\'t', 'as', 'at', 'be', 'because', 'been', 'before', 'being',
    'below', 'between', 'both', 'but', 'by', 'can', 'can\'t', 'cannot', 'could',
    'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t',
    'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t',
    'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s',
    'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how',
    'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is',
    'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most',
    'mustn\'t', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once',
    'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over',
    'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should',
    'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their',
    'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they',
    'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through',
    'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d',
    'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when',
    'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom',
    'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d',
    'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves',
    'please', 'help', 'want', 'need', 'like', 'make', 'create', 'build', 'write',
    'using', 'use', 'run', 'implement', 'add'
]);
export const TECHNICAL_SYNONYMS = {
    'ram': ['memory'],
    'oom': ['memory', 'leak'],
    'a11y': ['accessibility'],
    'i18n': ['internationalization', 'localization'],
    'l10n': ['localization'],
    'auth': ['authentication', 'authorization'],
    'gc': ['garbage', 'collection', 'memory'],
    'css': ['styling', 'styles'],
    'ui': ['interface', 'frontend'],
    'ux': ['user', 'experience'],
    'db': ['database'],
    'perf': ['performance'],
    // Multilingual technical roots (German, Spanish, French)
    'speicher': ['memory'],
    'speicherleck': ['memory', 'leak'],
    'leck': ['leak'],
    'sicherheit': ['security'],
    'sicherheitsprüfung': ['security', 'rules', 'audit'],
    'sicherheitsregeln': ['security', 'rules', 'auditor', 'audit'],
    'sicherheitsrichtlinien': ['security', 'rules', 'auditor', 'audit'],
    'richtlinien': ['rules', 'policies'],
    'zugriffsregeln': ['security', 'rules', 'access'],
    'datenbank': ['database'],
    'leistung': ['performance'],
    'fehler': ['error', 'bug'],
    'berechtigung': ['permission', 'auth'],
    'zugriff': ['access'],
    'oberfläche': ['interface', 'ui'],
    'memoria': ['memory'],
    'fuga': ['leak'],
    'seguridad': ['security'],
    'rendimiento': ['performance'],
    'mémoire': ['memory'],
    'fuite': ['leak'],
    'sécurité': ['security'],
};
export function tokenize(text, options = {}) {
    const removeStopWords = options.removeStopWords ?? true;
    const minLength = options.minLength ?? 2;
    const expandSynonyms = options.expandSynonyms ?? true;
    if (!text || typeof text !== 'string')
        return [];
    const cleaned = text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
        .replace(/[-_]/g, ' ');
    const rawTokens = cleaned.split(/\s+/).filter(Boolean);
    const tokens = [];
    for (const token of rawTokens) {
        if (token.length < minLength)
            continue;
        if (removeStopWords && STOP_WORDS.has(token))
            continue;
        tokens.push(token);
        // Automatic compound word decomposition for long technical words
        if (token.length > 7) {
            for (const [rootKey, syns] of Object.entries(TECHNICAL_SYNONYMS)) {
                if (token.includes(rootKey) && token !== rootKey) {
                    if (!tokens.includes(rootKey)) {
                        tokens.push(rootKey);
                    }
                    if (expandSynonyms) {
                        for (const syn of syns) {
                            if (!tokens.includes(syn)) {
                                tokens.push(syn);
                            }
                        }
                    }
                }
            }
        }
        if (expandSynonyms && TECHNICAL_SYNONYMS[token]) {
            for (const syn of TECHNICAL_SYNONYMS[token]) {
                if (!tokens.includes(syn)) {
                    tokens.push(syn);
                }
            }
        }
    }
    return tokens;
}
export function generateNGrams(tokens, n = 2) {
    if (tokens.length < n)
        return [];
    const ngrams = [];
    for (let i = 0; i <= tokens.length - n; i++) {
        ngrams.push(tokens.slice(i, i + n).join(' '));
    }
    return ngrams;
}
export function normalizeIdentifier(name) {
    const parts = name.toLowerCase().split(/[-_.\s]+/).filter(Boolean);
    const result = [...parts];
    if (parts.length > 1) {
        result.push(parts.join(' '));
        result.push(parts.join(''));
    }
    return result;
}
//# sourceMappingURL=tokenizer.js.map