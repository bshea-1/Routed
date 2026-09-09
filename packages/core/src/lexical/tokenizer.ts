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
    'using', 'use', 'run', 'implement', 'add',
    // Common English verbs, time, and generic nouns that should not anchor coding skills
    'go', 'goes', 'going', 'went', 'gone',
    'tell', 'tells', 'telling', 'told',
    'say', 'says', 'saying', 'said',
    'know', 'knows', 'knowing', 'knew', 'known',
    'see', 'sees', 'seeing', 'saw', 'seen',
    'come', 'comes', 'coming', 'came',
    'look', 'looks', 'looking', 'looked',
    'give', 'gives', 'giving', 'gave', 'given',
    'get', 'gets', 'getting', 'got', 'gotten',
    'take', 'takes', 'taking', 'took', 'taken',
    'good', 'great', 'best', 'better',
    'day', 'daily', 'today', 'tonight', 'tomorrow', 'week', 'month', 'year',
    'far', 'near', 'much', 'many', 'long', 'short',
    'world', 'thing', 'things', 'way', 'ways', 'loop'
]);
export const TECHNICAL_SYNONYMS: Record<string, string[]> = {
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
export interface TokenizeProvenance {
    tokens: string[];
    directTokens: string[];
    expandedTokens: string[];
}

export function tokenizeWithProvenance(text: string, options: {
    removeStopWords?: boolean;
    minLength?: number;
    expandSynonyms?: boolean;
} = {}): TokenizeProvenance {
    const removeStopWords = options.removeStopWords ?? true;
    const minLength = options.minLength ?? 2;
    const expandSynonyms = options.expandSynonyms ?? true;
    if (!text || typeof text !== 'string')
        return { tokens: [], directTokens: [], expandedTokens: [] };
    const cleaned = text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
        .replace(/[-_]/g, ' ');
    const rawTokens = cleaned.split(/\s+/).filter(Boolean);
    const directTokens: string[] = [];
    const expandedTokens: string[] = [];
    const allTokensSet = new Set<string>();

    for (const token of rawTokens) {
        if (token.length < minLength)
            continue;
        if (removeStopWords && STOP_WORDS.has(token))
            continue;
        if (!allTokensSet.has(token)) {
            allTokensSet.add(token);
            directTokens.push(token);
        }

        // Automatic compound word decomposition for long technical words (roots must be >= 4 chars)
        if (token.length > 7) {
            for (const [rootKey, syns] of Object.entries(TECHNICAL_SYNONYMS)) {
                if (rootKey.length >= 4 && token.includes(rootKey) && token !== rootKey) {
                    if (!allTokensSet.has(rootKey)) {
                        allTokensSet.add(rootKey);
                        expandedTokens.push(rootKey);
                    }
                    if (expandSynonyms) {
                        for (const syn of syns) {
                            if (!allTokensSet.has(syn)) {
                                allTokensSet.add(syn);
                                expandedTokens.push(syn);
                            }
                        }
                    }
                }
            }
        }

        if (expandSynonyms && Array.isArray(TECHNICAL_SYNONYMS[token])) {
            for (const syn of TECHNICAL_SYNONYMS[token]) {
                if (!allTokensSet.has(syn)) {
                    allTokensSet.add(syn);
                    expandedTokens.push(syn);
                }
            }
        }
    }
    return {
        tokens: Array.from(allTokensSet),
        directTokens,
        expandedTokens,
    };
}

export function tokenize(text: string, options: {
    removeStopWords?: boolean;
    minLength?: number;
    expandSynonyms?: boolean;
} = {}): string[] {
    return tokenizeWithProvenance(text, options).tokens;
}

export interface NegationResult {
    positiveQuery: string;
    negatedTokens: string[];
}

const STATE_PRESERVATION_VERBS = /\b(?:stop|cancel|abort|kill|terminate|pause|interrupt|end|halt)\b/i;
const AFFIRMATIVE_NEGATIONS = /\b(?:do\s+not|don'?t)\s+(?:forget|hesitate)\s+(?:to\s+)?/gi;
const CONDITIONAL_PASSIVE_REGEX = /(?:,\s*|;\s*|\band\s+)?\b(?:if|unless|while|when|in case|as long as)\b[^,.;]+?\b(?:do\s+not|don'?t)\s+(?:stop|cancel|abort|kill|terminate|pause|interrupt)[^,.;]*/gi;
const DIRECT_NEGATION_REGEX = /\b(?:do\s+not|don'?t|don\s+not|never|avoid|without|skip|no\s+need\s+(?:for|to))\s+(?:run|use|invoke|execute|perform|trigger|start|call|apply)?\s*([^,.;]+?)(?:,\s*|;\s*|\.\s*|but\s+|instead\s+|just\s+|only\s+|$)/gi;

function cleanQueryString(q: string): string {
    let res = q.trim();
    res = res.replace(/^[,\s;.]+|[,\s;.]+$/g, '').trim();
    res = res.replace(/\b(and|but|then|instead|plus)\s*$/gi, '').trim();
    return res.replace(/^[,\s;.]+|[,\s;.]+$/g, '').trim();
}

export function parseNegation(query: string): NegationResult {
    let workingQuery = query;

    // 1. Anti-negations like 'don't forget to run X' -> 'run X' (affirmative intent)
    workingQuery = workingQuery.replace(AFFIRMATIVE_NEGATIONS, '');

    // 2. Conditional passive clauses like 'and if X is already running do not stop it'
    workingQuery = workingQuery.replace(CONDITIONAL_PASSIVE_REGEX, ' ').trim();

    // 3. Direct tool negation: 'do not run a security audit', 'avoid X', 'skip Y'
    const negatedTokens = new Set<string>();
    let match: RegExpExecArray | null;
    const regex = new RegExp(DIRECT_NEGATION_REGEX.source, 'gi');
    while ((match = regex.exec(workingQuery)) !== null) {
        const phrase = match[1].trim();
        if (!STATE_PRESERVATION_VERBS.test(phrase)) {
            const tokens = tokenize(phrase, { minLength: 2, removeStopWords: true, expandSynonyms: false });
            for (const t of tokens) {
                negatedTokens.add(t);
            }
        }
    }

    const strippedQuery = workingQuery.replace(DIRECT_NEGATION_REGEX, ' ').replace(/\s+/g, ' ');
    const positiveQuery = cleanQueryString(strippedQuery);

    return {
        positiveQuery: positiveQuery || query,
        negatedTokens: Array.from(negatedTokens),
    };
}
export function generateNGrams(tokens: string[], n = 2): string[] {
    if (tokens.length < n)
        return [];
    const ngrams: string[] = [];
    for (let i = 0; i <= tokens.length - n; i++) {
        ngrams.push(tokens.slice(i, i + n).join(' '));
    }
    return ngrams;
}
export function normalizeIdentifier(name: string): string[] {
    const parts = name.toLowerCase().split(/[-_.\s]+/).filter(Boolean);
    const result = [...parts];
    if (parts.length > 1) {
        result.push(parts.join(' '));
        result.push(parts.join(''));
    }
    return result;
}
