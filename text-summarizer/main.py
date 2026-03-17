from __future__ import annotations
import math, re
from collections import Counter, defaultdict
from typing import List, Tuple, Dict, Set, Optional
from flask import Flask, request, jsonify, render_template_string, abort
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024  # 2MB of text max

# --- Lightweight resources ---
STOPWORDS: Set[str] = {
    # Expanded compact english stoplist
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at', 'be', 'because', 'been',
    'before', 'being', 'below', 'between', 'both', 'but', 'by', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each',
    'few', 'for', 'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his',
    'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'let', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'of',
    'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some',
    'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those',
    'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who',
    'whom', 'why', 'with', 'will', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves'
}
CUE_BONUS = {
    "in conclusion", "overall", "we find", "we found", "in summary", "to conclude",
    "this study", "this report", "this article", "the results show", "in essence", "key findings", "ultimately"
}
TOKEN_RE = re.compile(r"[A-Za-z0-9\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u017F'\-]+", re.UNICODE)
URL_RE = re.compile(r"(https?://|www\.)\S+", re.IGNORECASE)
CODE_BLOCK_RE = re.compile(r"```.+?```|`[^`]+`", re.DOTALL)
BULLET_RE = re.compile(r"^[\s>*-]*([*-]|\u2022|\u2023)\s+", re.MULTILINE)
ENTITY_RE = re.compile(r"\b(?:[A-Z\u00C0-\u00D6\u00D8-\u00DE][A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u017F]+(?:\s+[A-Z\u00C0-\u00D6\u00D8-\u00DE][A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u017F]+)*)\b")
ALLOWED_METHODS = {"freq", "textrank", "hybrid", "sumbasic", "luhn", "position", "entity"}

def normalize_input(text: str) -> str:
    """Lightweight cleaning before sentence splitting."""
    if not text:
        return ""
    cleaned = CODE_BLOCK_RE.sub(" ", text)
    cleaned = URL_RE.sub(" [link] ", cleaned)
    cleaned = BULLET_RE.sub("", cleaned)
    cleaned = re.sub(r"\r\n?", "\n", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    return cleaned.strip()


def sent_split(text: str) -> List[str]:
    """Sentence segmentation with light multilingual + abbreviation handling."""
    t = normalize_input(text)
    if not t:
        return []
    compact = re.sub(r"\s+", " ", t)
    split_re = r"(?<=[\.?!\u3002\uFF01\uFF1F])\s+(?=(?:['\"\(\[]?)[A-Z\u00C0-\u00D6\u00D8-\u00DE0-9])"
    parts = re.split(split_re, compact)
    if len(parts) == 1:
        if re.search(r"[\.?!…]", compact):
            parts = re.split(r"(?<=[\.?!…])\s+", compact)
    if len(parts) == 1:
        parts = re.split(r"(?<=[\u3002\uFF01\uFF1F\u2026])\s+|\n+", t)
    NON_END_ABBR = {
        'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Capt', 'Cpt', 'Lt', 'Mt', 'Jr', 'Sr', 'Rev', 'Col', 'Gen', 'Adm', 'St',
        'i.e', 'e.g', 'etc', 'cf', 'viz', 'vs', 'a.m', 'p.m', 'et al', 'Ing', 'Lic', 'Srta', 'Sr', 'Sra'
    }
    abbr_re = r'\b(' + '|'.join(map(re.escape, NON_END_ABBR)) + r')\.$'
    sentences = []
    i = 0
    while i < len(parts):
        s = parts[i].strip()
        i += 1
        while i < len(parts) and re.search(abbr_re, s):
            s += ' ' + parts[i].strip()
            i += 1
        if s:
            sentences.append(s)
    cleaned = []
    for s in sentences:
        s = s.replace('..', '.')
        cleaned.append(s.strip(' -'))
    return [s for s in cleaned if len(s.strip()) > 1]


def tokenize(s: str) -> List[str]:
    return [w.lower().strip("'") for w in TOKEN_RE.findall(s.lower()) if w.strip("'")]

def content_tokens(tokens: List[str]) -> List[str]:
    # Improved stemming: more rules, handle plurals/irregulars better
    out = []
    for w in tokens:
        if w in STOPWORDS or w.isdigit():
            continue
        if len(w) > 4:
            for suf in ("ings", "ingly", "edly", "able", "ible", "ness", "less", "ment", "tion", "sion", "ious", "ions", "ers", "ies"):
                if w.endswith(suf) and len(w) - len(suf) >= 3:
                    w = w[:-len(suf)]
                    break
        if len(w) > 3 and w.endswith("ed"):
            if w[-3] == w[-4]:  # doubled consonant
                w = w[:-3]
            else:
                w = w[:-2]
        elif len(w) > 3 and w.endswith("es"):
            w = w[:-2]
        elif len(w) > 3 and w.endswith("s"):
            w = w[:-1]
        out.append(w)
    return out

def entity_focus_scores(sentences: List[str]) -> List[float]:
    """Boost sentences that carry repeating capitalized entities."""
    if not sentences:
        return []
    occ: Dict[str, Set[int]] = defaultdict(set)
    for idx, sent in enumerate(sentences):
        for ent in ENTITY_RE.findall(sent):
            lower_ent = ent.lower()
            if lower_ent in STOPWORDS or len(ent) <= 2:
                continue
            occ[ent.strip()].add(idx)
    scores = [0.0] * len(sentences)
    for shared in occ.values():
        if len(shared) < 2:
            continue
        bonus = math.log(len(shared) + 1) / 3.0
        for idx in shared:
            scores[idx] += bonus
    return scores

def jaccard(a: Set[str], b: Set[str]) -> float:
    if not a or not b: return 0.0
    u = a | b
    i = a & b
    return len(i) / (len(u) + 1e-9)

def normalize(scores: List[float]) -> List[float]:
    if not scores: return scores
    lo, hi = min(scores), max(scores)
    if hi - lo < 1e-9:
        return [0.0 for _ in scores]
    return [(s - lo) / (hi - lo) for s in scores]

def tfidf_sentence_scores(sent_tokens: List[List[str]]) -> List[float]:
    N = len(sent_tokens)
    df = Counter()
    for toks in sent_tokens:
        df.update(set(toks))
    tf_global = Counter()
    for toks in sent_tokens:
        tf_global.update(toks)
    # Improved: stricter IDF, length normalization
    wscore = {}
    for w, tf in tf_global.items():
        idf = math.log(N / (df[w] + 1e-9))  # Stricter log(N/df)
        wscore[w] = tf * idf
    scores = []
    for toks in sent_tokens:
        s = sum(wscore.get(w, 0.0) for w in toks) / (len(toks) + 1e-9)  # Normalize by length
        scores.append(s)
    return scores

def luhn_scores(sent_tokens: List[List[str]]) -> List[float]:
    """Classic Luhn scoring via dense clusters of significant words."""
    freq = Counter(w for sent in sent_tokens for w in sent)
    if not freq:
        return [0.0] * len(sent_tokens)
    avg_freq = sum(freq.values()) / (len(freq) + 1e-9)
    threshold = avg_freq * 1.2
    significant = {w for w, c in freq.items() if c >= threshold and len(w) > 2}
    scores = []
    for tokens in sent_tokens:
        if not tokens:
            scores.append(0.0)
            continue
        positions = [i for i, w in enumerate(tokens) if w in significant]
        if not positions:
            scores.append(0.0)
            continue
        window = max(4, int(math.log(len(tokens) + 1) * 4))
        accum = 0.0
        start = 0
        while start < len(positions):
            end = start
            while end + 1 < len(positions) and positions[end + 1] - positions[end] <= window:
                end += 1
            span = positions[end] - positions[start] + 1
            sig = end - start + 1
            accum += (sig ** 2) / (span + 1)
            start = end + 1
        scores.append(accum / (len(tokens) + 1))
    return scores

def position_scores(sentences: List[str]) -> List[float]:
    """Sentence importance via exponential decay from intro/outro."""
    N = len(sentences)
    if N == 0:
        return []
    denom = max(1, N - 1)
    avg_len = sum(len(s) for s in sentences) / (N + 1e-9)
    pos_scores = []
    for idx, sent in enumerate(sentences):
        rel_head = idx / denom
        rel_tail = (N - 1 - idx) / denom
        anchor = math.exp(-2.2 * rel_head) + math.exp(-2.0 * rel_tail)
        length_adj = 1.1 if len(sent) >= avg_len else 0.95
        pos_scores.append(anchor * length_adj)
    return pos_scores

def sumbasic_sentence_scores(sent_tokens: List[List[str]]) -> Tuple[List[float], Dict[str, float]]:
    freq = Counter(w for sent in sent_tokens for w in sent)
    total = sum(freq.values()) or 1.0
    probs = {w: freq[w] / total for w in freq}
    scores = []
    for tokens in sent_tokens:
        if not tokens:
            scores.append(0.0)
        else:
            avg = sum(probs.get(w, 0.0) for w in tokens) / (len(tokens) + 1e-9)
            scores.append(avg)
    return scores, probs

def sumbasic_select(
    sent_tokens: List[List[str]],
    k: int,
    seed_scores: Optional[List[float]] = None,
    probs: Optional[Dict[str, float]] = None,
) -> List[int]:
    """Iterative SumBasic selection with probability updates."""
    if probs is None:
        _, probs = sumbasic_sentence_scores(sent_tokens)
    running = dict(probs)
    selected: List[int] = []
    used: Set[int] = set()
    while len(selected) < k and len(used) < len(sent_tokens):
        best_idx, best_score = -1, -1.0
        for idx, tokens in enumerate(sent_tokens):
            if idx in used or not tokens:
                continue
            avg = sum(running.get(w, 0.0) for w in tokens) / (len(tokens) + 1e-9)
            if seed_scores:
                avg = 0.65 * avg + 0.35 * seed_scores[idx]
            if avg > best_score:
                best_score, best_idx = avg, idx
        if best_idx < 0:
            break
        selected.append(best_idx)
        used.add(best_idx)
        for w in set(sent_tokens[best_idx]):
            running[w] = running[w] ** 2  # damp repeating terms
    if not selected:
        selected = list(range(min(k, len(sent_tokens))))
    return sorted(selected)

def compute_budget(sentence_count: int, requested_k: Optional[int], ratio: Optional[float]) -> int:
    if sentence_count == 0:
        return 0
    if ratio is not None:
        ratio = max(0.05, min(0.9, ratio))
        k = max(1, int(round(sentence_count * ratio)))
    else:
        k = requested_k or 5
    return max(1, min(k, sentence_count))

def textrank_scores(sent_tokens: List[List[str]]) -> List[float]:
    N = len(sent_tokens)
    sets = [set(t) for t in sent_tokens]
    # Build similarity matrix
    W = [[0.0] * N for _ in range(N)]
    for i in range(N):
        for j in range(i + 1, N):
            sim = jaccard(sets[i], sets[j])
            W[i][j] = W[j][i] = sim
    # Optimized PageRank: vectorized, better dead-end handling
    d = 0.85
    r = [1.0 / N] * N
    outs = [sum(row) for row in W]
    for _ in range(30):  # Increased iterations for better convergence
        nr = [(1 - d) / N] * N
        for j in range(N):
            if outs[j] == 0:
                contrib = r[j] / N
                for i in range(N):
                    nr[i] += d * contrib
            else:
                for i in range(N):
                    if W[j][i] > 0:
                        nr[i] += d * (W[j][i] / outs[j]) * r[j]
        # Normalize new ranks to sum to 1
        total = sum(nr)
        if total > 0:
            nr = [x / total for x in nr]
        r = nr
    return r

def apply_bonuses(scores: List[float], sentences: List[str]) -> List[float]:
    N = len(sentences)
    boost_factor = 1.1 if N < 10 else 1.05 if N < 50 else 1.02  # Adaptive: stronger for short texts
    boosted = scores[:]
    entity_norm = normalize(entity_focus_scores(sentences))
    for i, s in enumerate(sentences):
        low = s.lower()
        if any(phrase in low for phrase in CUE_BONUS):
            boosted[i] *= 1.10  # Increased cue bonus
        if i in (0, 1, N - 1, N - 2):
            boosted[i] *= boost_factor
        if entity_norm and entity_norm[i] > 0:
            boosted[i] *= 1 + 0.2 * entity_norm[i]
    return boosted

def mmr_select(base_scores: List[float], sent_sets: List[Set[str]], k: int, summary_ratio: Optional[float] = None) -> List[int]:
    """Maximal marginal relevance with adaptive lambda derived from redundancy."""
    n = len(sent_sets)
    if n == 0:
        return []
    if k >= n:
        return list(range(n))
    total_sim = 0.0
    pairs = 0
    step = 1 if n <= 80 else max(1, n // 80)
    for i in range(0, n, step):
        for j in range(i + 1, n, step):
            total_sim += jaccard(sent_sets[i], sent_sets[j])
            pairs += 1
    avg_jac = total_sim / (pairs + 1e-9)
    compression = k / max(1, n)
    lambda_ = 0.45 + 0.25 * (1 - avg_jac) + 0.2 * (1 - compression)
    if summary_ratio is not None:
        lambda_ += 0.1 * (1 - summary_ratio)
    lambda_ = max(0.35, min(0.92, lambda_))
    selected, candidates = [], list(range(n))
    while candidates and len(selected) < k:
        if not selected:
            best = max(candidates, key=lambda i: base_scores[i])
        else:
            def mmr(i: int) -> float:
                sim_to_sel = max((jaccard(sent_sets[i], sent_sets[j]) for j in selected), default=0.0)
                return lambda_ * base_scores[i] - (1 - lambda_) * sim_to_sel
            best = max(candidates, key=mmr)
        selected.append(best)
        candidates.remove(best)
    return sorted(selected)

def post_process_summary(summary_sents: List[str]) -> List[str]:
    # New: Trim redundant punctuation, capitalize, remove extra spaces
    processed = []
    seen = set()
    for s in summary_sents:
        s = re.sub(r'\s+', ' ', s.strip())
        s = s[0].upper() + s[1:] if s else s
        s = re.sub(r'([.!?])\s*([A-Za-z])', r'\1 \2', s)  # Ensure space after punctuation
        key = s.lower()
        if key in seen:
            continue
        seen.add(key)
        processed.append(s)
    return processed

def summarize(
    text: str,
    max_sentences: int = 5,
    method: str = "sumbasic",
    ratio: Optional[float] = None,
) -> Dict:
    sentences = sent_split(text)
    if not sentences:
        return {"summary": "", "sentences": []}
    raw_tokens = [tokenize(s) for s in sentences]
    word_count = sum(len(t) for t in raw_tokens)
    if word_count <= 5:
        summary_sents = post_process_summary([sentences[0]])
        achieved_ratio = len(summary_sents) / len(sentences)
        return {
            "method": "sumbasic",
            "k": 1,
            "indices": [0],
            "sentences": summary_sents,
            "summary": " ".join(summary_sents),
            "ratio_used": 1.0,
            "source_sentences": len(sentences),
            "achieved_ratio": round(achieved_ratio, 3),
            "word_count": word_count,
            "char_count": len(text),
        }
    sent_tokens = [content_tokens(t) for t in raw_tokens]
    sent_tokens = [t if t else tokenize(s) for t, s in zip(sent_tokens, sentences)]
    freq_scores = normalize(tfidf_sentence_scores(sent_tokens))
    freq_scores = normalize(apply_bonuses(freq_scores, sentences))
    tr_scores = normalize(textrank_scores(sent_tokens))
    luhn = normalize(luhn_scores(sent_tokens))
    pos_scores = normalize(position_scores(sentences))
    entity_scores = normalize(entity_focus_scores(sentences))
    sumbasic_raw, sumbasic_probs = sumbasic_sentence_scores(sent_tokens)
    sumbasic_scores = normalize(sumbasic_raw)
    score_layers = {
        "freq": freq_scores,
        "textrank": tr_scores,
        "luhn": luhn,
        "position": pos_scores,
        "entity": entity_scores,
        "sumbasic": sumbasic_scores,
    }
    method = (method or "sumbasic").lower()
    allowed_methods = set(score_layers.keys()) | {"hybrid"}
    if method not in allowed_methods:
        method = "sumbasic"
    k = compute_budget(len(sentences), max_sentences, ratio)
    sent_sets = [set(t) for t in sent_tokens]
    ratio_used = ratio if ratio is not None else k / max(1, len(sentences))
    if method == "hybrid":
        weights = {
            "freq": 0.28,
            "textrank": 0.22,
            "luhn": 0.18,
            "position": 0.17,
            "entity": 0.15,
        }
        base = [
            sum(weights[name] * score_layers[name][i] for name in weights)
            for i in range(len(sentences))
        ]
        base = normalize(base)
        chosen_idx = mmr_select(base, sent_sets, k=k, summary_ratio=ratio_used)
    elif method == "sumbasic":
        seed = normalize([
            0.4 * freq_scores[i] + 0.3 * entity_scores[i] + 0.3 * pos_scores[i]
            for i in range(len(sentences))
        ])
        preliminary = sumbasic_select(sent_tokens, k, seed_scores=seed, probs=sumbasic_probs)
        filler_base = sumbasic_scores
        if len(preliminary) < k:
            mmr_fill = mmr_select(filler_base, sent_sets, k=k, summary_ratio=ratio_used)
            selected_set = set(preliminary)
            for idx in mmr_fill:
                if idx not in selected_set:
                    preliminary.append(idx)
                    selected_set.add(idx)
                if len(preliminary) == k:
                    break
        chosen_idx = sorted(preliminary)
    else:
        base = score_layers[method]
        chosen_idx = mmr_select(base, sent_sets, k=k, summary_ratio=ratio_used)
    summary_sents = post_process_summary([sentences[i] for i in chosen_idx])
    achieved_ratio = len(summary_sents) / max(1, len(sentences))
    return {
        "method": method,
        "k": k,
        "indices": chosen_idx,
        "sentences": summary_sents,
        "summary": " ".join(summary_sents),
        "ratio_used": round(ratio_used, 3),
        "source_sentences": len(sentences),
        "achieved_ratio": round(achieved_ratio, 3),
        "word_count": word_count,
        "char_count": len(text),
    }

HTML = """
<!doctype html>
<html lang="en" class="scroll-smooth">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config = { darkMode: 'class' };
</script>
<title>lite-summarizer</title>
<style>
  textarea { transition: height 120ms ease; }
  @media (max-width: 640px) { textarea { min-height: 12rem; } }
</style>
</head>
<body class="bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 transition-colors duration-300">
<div class="max-w-4xl mx-auto p-4 space-y-5">
  <header class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">lite-summarizer - no LLMs</h1>
      <p class="text-sm text-slate-600 dark:text-slate-300">Purely extractive TF-IDF/TextRank/Luhn/SumBasic stack with entity-aware MMR.</p>
    </div>
    <button id="theme-toggle" class="self-start rounded-full border border-slate-200 px-3 py-1 text-sm dark:border-slate-700" aria-label="Toggle theme" aria-pressed="false" title="Toggle dark mode">
      Light
    </button>
  </header>
  <form id="frm" class="space-y-3" aria-label="Summarizer form">
    <label for="text" class="text-sm font-medium text-slate-600 dark:text-slate-200">Source text</label>
    <textarea id="text" class="w-full min-h-[16rem] rounded-lg border border-slate-200 bg-white/80 p-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700" placeholder="Paste or type content. Supports articles, notes, transcripts." aria-describedby="limit-hint preview stats"></textarea>
    <div class="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400" id="stats" aria-live="polite">
      <span>Words <strong id="word-count">0</strong></span>
      <span>Characters <strong id="char-count">0</strong></span>
      <span>Sentence estimate <strong id="sentence-count">0</strong></span>
    </div>
    <div class="flex flex-wrap items-center gap-4 rounded-lg bg-slate-50/70 p-3 dark:bg-slate-800/60">
      <label class="text-sm flex-1 min-w-[180px]">Summary length
        <div class="flex items-center gap-2">
          <input id="ratio" type="range" min="10" max="60" step="5" value="30" class="w-full" aria-label="Summary length percentage">
          <span id="ratio-label" class="w-12 text-right text-xs font-semibold">30%</span>
        </div>
      </label>
      <label class="text-sm">Sentence cap
        <input id="k" type="number" min="1" max="40" value="8" class="mt-1 w-20 rounded border border-slate-200 p-1 dark:border-slate-600" aria-label="Sentence cap fallback">
      </label>
      <label class="text-sm">Model
        <select id="method" class="mt-1 rounded border border-slate-200 p-1 dark:border-slate-600" aria-label="Summarization method">
          <option value="sumbasic" selected>SumBasic (default)</option>
          <option value="hybrid">Hybrid blend</option>
          <option value="luhn">Luhn clusters</option>
          <option value="position">Position-aware</option>
          <option value="freq">TF-IDF</option>
          <option value="textrank">TextRank</option>
          <option value="entity">Entity focus</option>
        </select>
      </label>
      <button id="go" class="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 transition-opacity opacity-40 cursor-not-allowed" aria-disabled="true" title="Run summarizer (Ctrl+Enter)">Summarize</button>
    </div>
    <div id="limit-hint" class="hidden text-xs text-red-600 dark:text-amber-400" role="status" aria-live="polite"></div>
    <p id="preview" class="text-xs text-slate-500 dark:text-slate-400" aria-live="polite"></p>
  </form>
  <section id="out" class="hidden space-y-3 rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70" tabindex="-1" aria-live="polite">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-lg font-semibold">Summary</h2>
      <div class="flex flex-wrap gap-2">
        <button id="copy" class="rounded bg-emerald-500 px-3 py-1 text-sm font-medium text-white shadow" title="Copy summary text (Ctrl+C)">Copy</button>
        <button id="download" class="rounded bg-slate-200 px-3 py-1 text-sm font-medium text-slate-800 shadow dark:bg-slate-800 dark:text-white" title="Download as .txt" disabled>Download</button>
        <button id="share" class="rounded bg-blue-500 px-3 py-1 text-sm font-medium text-white shadow" title="Share summary">Share</button>
      </div>
    </div>
    <div id="meta" class="text-xs text-slate-500 dark:text-slate-400" aria-live="polite"></div>
    <div id="summary" class="rounded-lg border border-slate-100 bg-slate-50/80 p-3 text-sm leading-relaxed dark:border-slate-700 dark:bg-slate-800/60" role="region" aria-label="Summary text" tabindex="-1"></div>
    <div>
      <h3 class="text-sm font-semibold text-slate-600 dark:text-slate-200">Sentences</h3>
      <ol id="list" class="list-decimal space-y-2 pl-6 text-sm"></ol>
    </div>
  </section>
  <div id="loading" class="hidden fixed inset-0 z-20 bg-white/70 backdrop-blur-md dark:bg-gray-900/60" aria-hidden="true">
    <div class="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div class="h-12 w-12 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600"></div>
      <p class="text-sm text-slate-600 dark:text-slate-300">Distilling the essentials...</p>
    </div>
  </div>
  <div id="toast" class="pointer-events-none fixed bottom-4 left-1/2 z-30 hidden -translate-x-1/2 rounded-full px-4 py-2 text-sm text-white shadow-lg" role="status" aria-live="assertive"></div>
  <footer class="pt-6 text-xs text-slate-500 dark:text-slate-400">Hand-tuned extractive summarizer | lightweight + local</footer>
</div>
<script>
const textArea = document.getElementById('text');
const goBtn = document.getElementById('go');
const loading = document.getElementById('loading');
const toast = document.getElementById('toast');
const themeToggle = document.getElementById('theme-toggle');
const ratioInput = document.getElementById('ratio');
const ratioLabel = document.getElementById('ratio-label');
const wordCountEl = document.getElementById('word-count');
const charCountEl = document.getElementById('char-count');
const sentenceCountEl = document.getElementById('sentence-count');
const limitHint = document.getElementById('limit-hint');
const preview = document.getElementById('preview');
const summaryEl = document.getElementById('summary');
const out = document.getElementById('out');
const listEl = document.getElementById('list');
const copyBtn = document.getElementById('copy');
const shareBtn = document.getElementById('share');
const downloadBtn = document.getElementById('download');
const metaEl = document.getElementById('meta');
const kInput = document.getElementById('k');
const methodSelect = document.getElementById('method');
const MIN_INPUT_CHARS = 12;
let isProcessing = false;

const syncButtonState = () => {
  const textReady = textArea.value.trim().length >= MIN_INPUT_CHARS;
  const disabled = isProcessing || !textReady;
  goBtn.disabled = disabled;
  goBtn.setAttribute('aria-disabled', String(disabled));
  goBtn.classList.toggle('opacity-40', disabled);
  goBtn.classList.toggle('cursor-not-allowed', disabled);
};

const estimateSentences = (text) => {
  const splits = text.split(/[.!?\u3002\uFF01\uFF1F\\n]/).filter(Boolean);
  return Math.max(1, splits.length);
};

const autoResize = () => {
  textArea.style.height = 'auto';
  textArea.style.height = Math.min(textArea.scrollHeight, 1200) + 'px';
};

const updateStats = () => {
  const text = textArea.value;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  const sentences = estimateSentences(text);
  wordCountEl.textContent = words;
  charCountEl.textContent = chars;
  sentenceCountEl.textContent = sentences;
  const ratio = Number(ratioInput.value);
  const target = Math.max(1, Math.round(sentences * ratio / 100));
  preview.textContent = `Targeting about ${target} sentences (~${ratio}% of source).`;
  ratioLabel.textContent = ratio + '%';
  const warnThreshold = 200000;
  if (chars > warnThreshold) {
    limitHint.classList.remove('hidden');
    limitHint.textContent = 'Heads up: large input, consider trimming for faster runs (server cap 300k chars).';
  } else {
    limitHint.classList.add('hidden');
    limitHint.textContent = '';
  }
  syncButtonState();
};

const showToast = (message, tone = 'info') => {
  toast.textContent = message;
  toast.classList.remove('hidden', 'bg-red-500', 'bg-emerald-500', 'bg-slate-800');
  const toneMap = { success: 'bg-emerald-500', error: 'bg-red-500', info: 'bg-slate-800' };
  toast.classList.add(toneMap[tone] || toneMap.info);
  setTimeout(() => toast.classList.add('hidden'), 2600);
};

const toggleLoading = (show) => {
  loading.classList.toggle('hidden', !show);
};

const applyTheme = (isDark) => {
  document.documentElement.classList.toggle('dark', isDark);
  themeToggle.setAttribute('aria-pressed', String(isDark));
  themeToggle.textContent = isDark ? 'Dark' : 'Light';
};

const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
applyTheme(prefersDark.matches);
prefersDark.addEventListener('change', (evt) => applyTheme(evt.matches));
themeToggle.addEventListener('click', () => applyTheme(!document.documentElement.classList.contains('dark')));

textArea.addEventListener('input', () => {
  autoResize();
  updateStats();
});

ratioInput.addEventListener('input', () => updateStats());
methodSelect.addEventListener('change', () => updateStats());

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !goBtn.disabled) {
    goBtn.click();
  }
});

document.getElementById('frm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = textArea.value || '';
  if (text.trim().length < MIN_INPUT_CHARS) {
    showToast(`Need at least ${MIN_INPUT_CHARS} characters to summarize.`, 'error');
    syncButtonState();
    return;
  }
  isProcessing = true;
  syncButtonState();
  toggleLoading(true);
  const payload = {
    text,
    k: parseInt(kInput.value || '8', 10),
    method: methodSelect.value,
    ratio: Number(ratioInput.value) / 100,
  };
  try {
    const res = await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Summarization failed');
    }
    out.classList.remove('hidden');
    summaryEl.textContent = data.summary || 'No summary produced.';
    metaEl.textContent = `Sentences ${data.sentences.length}/${data.source_sentences} | Compression ${(data.achieved_ratio * 100).toFixed(1)}% | Words ${data.word_count}`;
    listEl.innerHTML = '';
    data.sentences.forEach((s) => {
      const li = document.createElement('li');
      li.textContent = s;
      listEl.appendChild(li);
    });
    downloadBtn.disabled = !data.summary;
    showToast('Summary ready!', 'success');
    summaryEl.focus();
  } catch (err) {
    showToast(err.message || 'Something went wrong', 'error');
  } finally {
    isProcessing = false;
    toggleLoading(false);
    syncButtonState();
  }
});

copyBtn.addEventListener('click', async () => {
  const text = summaryEl.textContent;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied summary', 'success');
  } catch {
    showToast('Clipboard blocked', 'error');
  }
});

downloadBtn.addEventListener('click', () => {
  if (!summaryEl.textContent.trim()) return;
  const blob = new Blob([summaryEl.textContent], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'summary.txt';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
});

shareBtn.addEventListener('click', async () => {
  const summary = summaryEl.textContent.trim();
  if (!summary) return;
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Summary', text: summary });
    } catch (err) {
      if (err && err.name !== 'AbortError') {
        showToast('Share failed', 'error');
      }
    }
  } else {
    showToast('Share not supported on this device', 'info');
  }
});

updateStats();
autoResize();
syncButtonState();
</script>
</body>
</html>
"""

@app.route("/", methods=["GET"])
def index():
    return render_template_string(HTML)

@app.route("/api/summarize", methods=["POST"])
def api_summarize():
    try:
        payload = request.get_json(force=True, silent=False)
    except Exception:
        abort(400)
    text = (payload.get("text") or "").strip()
    if not text:
        return jsonify(error="empty text"), 400
    if len(text) > 300_000:
        return jsonify(error="text too long"), 413
    k = int(payload.get("k") or 5)
    raw_ratio = payload.get("ratio")
    try:
        ratio = float(raw_ratio) if raw_ratio is not None else None
    except (TypeError, ValueError):
        ratio = None
    method = (payload.get("method") or "sumbasic").lower()
    if method not in ALLOWED_METHODS:
        method = "sumbasic"
    result = summarize(text, max_sentences=k, method=method, ratio=ratio)
    return jsonify(result)

if __name__ == "__main__":
    app.run(debug=True)






